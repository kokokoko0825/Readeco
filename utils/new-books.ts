/**
 * 新刊ページの振り分けロジック（新刊ページとバックグラウンドプリロードで共通）
 */

import { extractBaseTitle } from './book-series';
import type { BookData } from './firebase-books';
import { normalizeAuthor, type Book } from './rakuten-api';

/**
 * 発売からこの日数を過ぎても買われていない巻があるシリーズは、購入をやめたとみなす
 */
const ABANDON_DAYS = 60;

export interface NewBook extends Book {
  publishDateFormatted?: string;
}

const dateParseCache = new Map<string, Date | null>();

/**
 * 楽天APIのsalesDateをDateオブジェクトに変換（キャッシュ機能付き）
 * 形式は "YYYY年MM月DD日" や "YYYYMMDD" など様々な可能性がある
 */
export function parseSalesDate(salesDate?: string): Date | null {
  if (!salesDate) return null;

  if (dateParseCache.has(salesDate)) {
    return dateParseCache.get(salesDate) ?? null;
  }

  let result: Date | null = null;

  // "YYYY年MM月DD日" 形式
  const match = salesDate.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (match) {
    result = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
  } else if (/^\d{8}$/.test(salesDate)) {
    // "YYYYMMDD" 形式
    result = new Date(
      parseInt(salesDate.substring(0, 4), 10),
      parseInt(salesDate.substring(4, 6), 10) - 1,
      parseInt(salesDate.substring(6, 8), 10)
    );
  } else {
    // その他の形式はDateコンストラクタに任せる
    const date = new Date(salesDate);
    if (!isNaN(date.getTime())) {
      result = date;
    }
  }

  dateParseCache.set(salesDate, result);
  return result;
}

/**
 * 発売日をフォーマット
 */
export function formatPublishDate(salesDate?: string): string {
  if (!salesDate) return '';

  const date = parseSalesDate(salesDate);
  if (!date) return salesDate;

  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

/**
 * シリーズ判定用のキー（巻数とスペースを除いたタイトル）
 * 例: "呪術廻戦 30" と "呪術廻戦 31" → "呪術廻戦"、"MAO（32）" → "MAO"
 */
function getSeriesTitleKey(title: string): string {
  return extractBaseTitle(title).replace(/[\s　]/g, '');
}

/**
 * 著者の検索結果を発売中・予約販売中に振り分ける
 *
 * - 本棚に登録済みの本は除外
 * - シリーズごとに、最後に買った巻（そのシリーズを1冊も持っていなければ著者の最後に買った本）より前の本は除外
 * - 発売から ABANDON_DAYS 日を過ぎても買われていない巻があるシリーズは、購入をやめたとみなしてシリーズごと除外
 *   例: 30巻まで購入済みで31巻が70日前に発売 → 31巻も予約中の32巻も表示しない
 *       30巻まで購入済みで31巻が10日前に発売 → 31巻を発売中、32巻を予約販売中に表示
 */
export function classifyAuthorBooks(
  author: string,
  books: Book[],
  userBooks: BookData[],
  today: Date
): { available: NewBook[]; preorder: NewBook[] } {
  const normalizedAuthor = normalizeAuthor(author);
  const userIsbns = new Set(
    userBooks.filter((book) => book.isbn).map((book) => book.isbn.replace(/[-\s]/g, ''))
  );

  // 著者・シリーズごとの、最後に買った本の発売日
  let newestOwnedDate: Date | null = null;
  const newestOwnedDateBySeries = new Map<string, Date>();
  for (const book of userBooks) {
    if (!book.author || normalizeAuthor(book.author) !== normalizedAuthor) continue;
    const date = parseSalesDate(book.publishDate);
    if (!date) continue;

    if (!newestOwnedDate || date > newestOwnedDate) {
      newestOwnedDate = date;
    }
    const seriesKey = getSeriesTitleKey(book.title);
    const current = newestOwnedDateBySeries.get(seriesKey);
    if (!current || date > current) {
      newestOwnedDateBySeries.set(seriesKey, date);
    }
  }

  // 最後に買った本より後の未購入本をシリーズごとにまとめる
  const candidatesBySeries = new Map<string, { book: NewBook; date: Date }[]>();
  for (const book of books) {
    if (userIsbns.has(book.isbn.replace(/[-\s]/g, ''))) continue;

    // 発売日が不明な本は判定できないため表示しない
    const date = parseSalesDate(book.publishDate);
    if (!date) continue;

    const seriesKey = getSeriesTitleKey(book.title);
    // 最後に買った本と同日発売の本も除外する（例: 29巻と30巻が同日発売で30巻だけ所有している場合、
    // 29巻を「買っていない巻」と数えるとシリーズごと購入をやめた扱いになるため）
    const baseline = newestOwnedDateBySeries.get(seriesKey) ?? newestOwnedDate;
    if (baseline && date <= baseline) continue;

    const candidates = candidatesBySeries.get(seriesKey) ?? [];
    candidates.push({
      book: { ...book, publishDateFormatted: formatPublishDate(book.publishDate) },
      date,
    });
    candidatesBySeries.set(seriesKey, candidates);
  }

  const abandonBefore = new Date(today);
  abandonBefore.setDate(today.getDate() - ABANDON_DAYS);

  const available: NewBook[] = [];
  const preorder: NewBook[] = [];
  for (const candidates of candidatesBySeries.values()) {
    if (candidates.some(({ date }) => date < abandonBefore)) continue;

    for (const { book, date } of candidates) {
      if (date <= today) {
        available.push(book);
      } else {
        preorder.push(book);
      }
    }
  }

  return { available, preorder };
}
