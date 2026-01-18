/**
 * 書籍のシリーズグループ化に関するユーティリティ
 */

import type { BookData } from './firebase-books';

/**
 * カスタムシリーズIDを生成
 */
export function createCustomSeriesId(): string {
  return `custom_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * タイトルから巻数や数字を取り除いて基本タイトルを抽出
 * 例: "ハリーポッター 1" -> "ハリーポッター"
 *     "進撃の巨人 第10巻" -> "進撃の巨人"
 *     "無用の皇子は西に向き　（1）" -> "無用の皇子は西に向き"
 */
export function extractBaseTitle(title: string): string {
  // 巻数パターンを除去
  // パターン: 数字、第○巻、vol.○、Vol.○、VOL.○、○巻、○話、○冊、○集
  let baseTitle = title.trim();

  // 末尾の巻数パターンを除去
  baseTitle = baseTitle.replace(
    /[\s　]*(第?\s*\d+\s*(巻|話|冊|集|vol\.?|Vol\.?|VOL\.?|volume|Volume|VOLUME))[\s　]*$/i,
    ''
  );

  // 末尾の単独数字を除去（ただし、数字のみのタイトルは除外）
  // 全角スペースにも対応
  baseTitle = baseTitle.replace(/[\s　]+\d+[\s　]*$/, '');

  // 末尾の括弧内の数字を除去（例: "タイトル (1)"、"タイトル　（1）"）
  // 全角括弧・半角括弧の両方に対応、全角スペースにも対応
  baseTitle = baseTitle.replace(/[\s　]*[\(（][^)）]*\d+[^)）]*[\)）][\s　]*$/, '');

  // 末尾のスペース（全角・半角）を除去
  baseTitle = baseTitle.replace(/[\s　]+$/, '');

  return baseTitle || title; // 空の場合は元のタイトルを返す
}

/**
 * 書籍のシリーズキーを生成
 * カスタムシリーズIDがある場合はそれを使用、なければ基本タイトル + 著者名
 */
export function getSeriesKey(book: BookData): string {
  // カスタムシリーズIDがある場合はそれを優先
  if (book.customSeriesId) {
    return `custom::${book.customSeriesId}`;
  }
  const baseTitle = extractBaseTitle(book.title);
  const author = book.author || '著者不明';
  return `${baseTitle}::${author}`;
}

/**
 * カスタムシリーズかどうかを判定
 */
export function isCustomSeries(seriesKey: string): boolean {
  return seriesKey.startsWith('custom::');
}

/**
 * 書籍リストをシリーズごとにグループ化
 */
export function groupBooksBySeries<T extends BookData>(books: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  for (const book of books) {
    const seriesKey = getSeriesKey(book);
    if (!groups.has(seriesKey)) {
      groups.set(seriesKey, []);
    }
    groups.get(seriesKey)!.push(book);
  }

  return groups;
}

/**
 * グループ化された書籍から代表となる書籍を取得
 * 最も最近追加された書籍を代表とする
 */
export function getRepresentativeBook<T extends BookData>(books: T[]): T {
  if (books.length === 1) {
    return books[0];
  }

  // 追加日時でソート（新しい順）
  const sorted = [...books].sort((a, b) => {
    const dateA = a.addedAt?.getTime() || 0;
    const dateB = b.addedAt?.getTime() || 0;
    return dateB - dateA;
  });

  return sorted[0];
}

/**
 * 書籍リストをシリーズでグループ化し、代表書籍のリストを返す
 */
export function getGroupedBooksRepresentatives<T extends BookData>(books: T[]): T[] {
  const groups = groupBooksBySeries(books);
  const representatives: T[] = [];

  for (const [seriesKey, seriesBooks] of groups) {
    const representative = getRepresentativeBook(seriesBooks) as T;
    // シリーズ情報を保持するため、カスタムプロパティを追加
    (representative as T & { _seriesCount?: number; _seriesKey?: string; _isCustomSeries?: boolean })._seriesCount =
      seriesBooks.length;
    (representative as T & { _seriesKey?: string })._seriesKey = seriesKey;
    (representative as T & { _isCustomSeries?: boolean })._isCustomSeries = isCustomSeries(seriesKey);
    representatives.push(representative);
  }

  return representatives;
}

/**
 * シリーズキーからそのシリーズに含まれるすべての本を取得
 */
export function getBooksBySeriesKey<T extends BookData>(
  books: T[],
  seriesKey: string
): T[] {
  const groups = groupBooksBySeries(books);
  return groups.get(seriesKey) || [];
}

