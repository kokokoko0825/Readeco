/**
 * 楽天ブックスAPIを使用して本を検索するユーティリティ
 * 楽天APIで見つからない場合はGoogle Books APIにフォールバック
 *
 * 使用方法:
 * 1. https://webservice.rakuten.co.jp/app/create でアプリを登録
 * 2. アプリ登録後、アプリケーションIDを取得
 * 3. .envファイルに EXPO_PUBLIC_RAKUTEN_APPLICATION_ID を設定してください
 *    （サーバー実行時は RAKUTEN_APPLICATION_ID でも可）
 */
// Google Books API Key(Firebase API Keyと共通)
const GOOGLE_BOOKS_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY ??
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY ??
  process.env.FIREBASE_API_KEY ??
  "";

const getRakutenApplicationId = (): string => {
  const applicationId =
    process.env.EXPO_PUBLIC_RAKUTEN_APPLICATION_ID ??
    process.env.RAKUTEN_APPLICATION_ID;
  if (!applicationId) {
    throw new Error(
      "楽天APIのアプリケーションIDが未設定です。Expo(Web/iOS/Android)では EXPO_PUBLIC_RAKUTEN_APPLICATION_ID を .env に設定してください。",
    );
  }
  return applicationId;
};

// Google Books APIのレスポンス型
interface GoogleBooksVolumeInfo {
  title: string;
  authors?: string[];
  publisher?: string;
  publishedDate?: string;
  description?: string;
  industryIdentifiers?: {
    type: string;
    identifier: string;
  }[];
  imageLinks?: {
    thumbnail?: string;
    smallThumbnail?: string;
    small?: string;
    medium?: string;
    large?: string;
  };
  infoLink?: string;
}

interface GoogleBooksSaleInfo {
  listPrice?: {
    amount: number;
    currencyCode: string;
  };
  retailPrice?: {
    amount: number;
    currencyCode: string;
  };
}

interface GoogleBooksItem {
  volumeInfo: GoogleBooksVolumeInfo;
  saleInfo?: GoogleBooksSaleInfo;
}

interface GoogleBooksApiResponse {
  totalItems: number;
  items?: GoogleBooksItem[];
}

interface RakutenBookItem {
  title: string;
  author: string;
  isbn: string;
  itemUrl: string;
  largeImageUrl: string;
  mediumImageUrl: string;
  smallImageUrl: string;
  publisherName?: string;
  salesDate?: string;
  itemPrice?: number;
  itemCaption?: string; // 商品説明（あらすじ）
}

interface RakutenApiResponse {
  Items: {
    Item: RakutenBookItem;
  }[];
}

export interface Book {
  title: string;
  author: string;
  isbn: string;
  url: string;
  imageUrl: string;
  publisher?: string;
  publishDate?: string;
  price?: number;
  description?: string; // あらすじ
}

// キャッシュ用のインターフェース
interface CacheEntry {
  book: Book | null;
  timestamp: number;
}

// リクエスト履歴管理
interface RequestHistory {
  timestamp: number;
  isbn: string;
}

// キャッシュ（ISBN -> 結果）
const bookCache = new Map<string, CacheEntry>();
const CACHE_DURATION = 60 * 60 * 1000; // 1時間

// リクエスト履歴（最近のリクエスト時刻を記録）
const requestHistory: RequestHistory[] = [];
const MAX_REQUESTS_PER_WINDOW = 2; // ウィンドウ内の最大リクエスト数（3→2に削減）
const REQUEST_WINDOW = 15 * 1000; // 15秒間のウィンドウ（10→15に拡大）
const MIN_REQUEST_INTERVAL = 3000; // 最小リクエスト間隔（2秒→3秒に増加）

/**
 * キャッシュから本の情報を取得
 */
function getCachedBook(isbn: string): Book | null | undefined {
  const entry = bookCache.get(isbn);
  if (!entry) return undefined;

  const now = Date.now();
  if (now - entry.timestamp > CACHE_DURATION) {
    // キャッシュが期限切れ
    bookCache.delete(isbn);
    return undefined;
  }

  return entry.book;
}

/**
 * 本の情報をキャッシュに保存
 */
function setCachedBook(isbn: string, book: Book | null): void {
  bookCache.set(isbn, {
    book,
    timestamp: Date.now(),
  });
}

/**
 * リクエスト履歴をクリーンアップ（古いエントリを削除）
 */
function cleanupRequestHistory(): void {
  const now = Date.now();
  while (
    requestHistory.length > 0 &&
    now - requestHistory[0].timestamp > REQUEST_WINDOW
  ) {
    requestHistory.shift();
  }
}

/**
 * リクエストを送信できるかチェック
 */
function canMakeRequest(isbn: string): { allowed: boolean; reason?: string } {
  const now = Date.now();

  // 古い履歴をクリーンアップ
  cleanupRequestHistory();

  // 最小リクエスト間隔をチェック
  if (requestHistory.length > 0) {
    const lastRequest = requestHistory[requestHistory.length - 1];
    const timeSinceLastRequest = now - lastRequest.timestamp;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      return {
        allowed: false,
        reason: `リクエスト間隔が短すぎます。${Math.ceil((MIN_REQUEST_INTERVAL - timeSinceLastRequest) / 1000)}秒待ってから再度お試しください。`,
      };
    }
  }

  // ウィンドウ内のリクエスト数をチェック
  const recentRequests = requestHistory.filter(
    (req) => now - req.timestamp <= REQUEST_WINDOW,
  );

  if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldestRequest = recentRequests[0];
    const waitTime = REQUEST_WINDOW - (now - oldestRequest.timestamp);
    return {
      allowed: false,
      reason: `リクエストが多すぎます。${Math.ceil(waitTime / 1000)}秒待ってから再度お試しください。`,
    };
  }

  return { allowed: true };
}

/**
 * リクエスト履歴に追加
 */
function addToRequestHistory(isbn: string): void {
  requestHistory.push({
    timestamp: Date.now(),
    isbn,
  });
  cleanupRequestHistory();
}

/**
 * Google Books APIで本を検索(フォールバック用)
 * @param isbn ISBNコード
 * @returns 本の情報、見つからない場合はnull
 */
async function searchBookByISBNFromGoogle(isbn: string): Promise<Book | null> {
  try {
    const apiUrl = `https://www.googleapis.com/books/v1/volumes`;
    const params = new URLSearchParams({
      q: `isbn:${isbn}`,
      maxResults: "1",
    });
    if (GOOGLE_BOOKS_API_KEY) {
      params.set("key", GOOGLE_BOOKS_API_KEY);
    }

    console.log("Google Books APIリクエスト:", {
      isbn: isbn,
      url: `${apiUrl}?q=isbn:${isbn}`,
    });

    const response = await fetch(`${apiUrl}?${params.toString()}`);

    if (!response.ok) {
      const status = response.status;
      const message =
        GOOGLE_BOOKS_API_KEY.length > 0
          ? `Google Books API request failed: ${status}`
          : "Google Books APIキーが未設定です。EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY または EXPO_PUBLIC_FIREBASE_API_KEY を .env に設定してください。";
      throw new Error(message);
    }

    const data: GoogleBooksApiResponse = await response.json();

    if (!data.items || data.items.length === 0) {
      console.log("Google Books APIで本が見つかりませんでした:", isbn);
      return null;
    }

    const item = data.items[0];
    const volumeInfo = item.volumeInfo;
    const saleInfo = item.saleInfo;

    // ISBNを取得(ISBN_13を優先)
    let bookIsbn = isbn;
    if (volumeInfo.industryIdentifiers) {
      const isbn13 = volumeInfo.industryIdentifiers.find(
        (id) => id.type === "ISBN_13",
      );
      const isbn10 = volumeInfo.industryIdentifiers.find(
        (id) => id.type === "ISBN_10",
      );
      bookIsbn = isbn13?.identifier || isbn10?.identifier || isbn;
    }

    // 画像URLを取得(HTTPSに変換)
    let imageUrl = "";
    if (volumeInfo.imageLinks) {
      const rawUrl =
        volumeInfo.imageLinks.medium ||
        volumeInfo.imageLinks.large ||
        volumeInfo.imageLinks.thumbnail ||
        volumeInfo.imageLinks.smallThumbnail ||
        "";
      // HTTPをHTTPSに変換
      imageUrl = rawUrl.replace(/^http:/, "https:");
    }

    // 価格を取得(日本円の場合のみ)
    let price: number | undefined;
    if (saleInfo?.listPrice?.currencyCode === "JPY") {
      price = saleInfo.listPrice.amount;
    } else if (saleInfo?.retailPrice?.currencyCode === "JPY") {
      price = saleInfo.retailPrice.amount;
    }

    const book: Book = {
      title: volumeInfo.title || "不明なタイトル",
      author: volumeInfo.authors?.join(", ") || "著者不明",
      isbn: bookIsbn,
      url:
        volumeInfo.infoLink || `https://books.google.com/books?vid=ISBN${isbn}`,
      imageUrl: imageUrl,
      publisher: volumeInfo.publisher,
      publishDate: volumeInfo.publishedDate,
      price: price,
      description: volumeInfo.description,
    };

    console.log("Google Books APIから本を取得:", book.title);
    return book;
  } catch (error) {
    console.error("Google Books APIエラー:", error);
    throw error;
  }
}

/**
 * ISBNコードで本を検索
 * @param isbn ISBNコード（10桁または13桁、ハイフンなし推奨）
 * @returns 本の情報、見つからない場合はnull
 */
export async function searchBookByISBN(isbn: string): Promise<Book | null> {
  try {
    // 楽天ブックスAPIのアプリケーションID
    const applicationId = getRakutenApplicationId();

    // ISBNコードを正規化
    const normalizedISBN = isbn.replace(/[-\s]/g, "");

    // ISBNが空でないかチェック
    if (!normalizedISBN || normalizedISBN.length === 0) {
      throw new Error("ISBNコードが空です");
    }

    // ISBNの形式をチェック（10桁または13桁の数字）
    if (!/^\d{10}(\d{3})?$/.test(normalizedISBN)) {
      throw new Error(`無効なISBN形式です: ${normalizedISBN}`);
    }

    // キャッシュをチェック
    const cachedBook = getCachedBook(normalizedISBN);
    if (cachedBook !== undefined) {
      console.log("キャッシュから本の情報を取得:", normalizedISBN);
      // キャッシュから取得した場合でも、リクエスト履歴に追加して連続リクエストを防ぐ
      // （実際のAPIリクエストは送信しないが、リクエスト間隔の制御のため）
      addToRequestHistory(normalizedISBN);
      return cachedBook;
    }

    // リクエスト制限をチェック
    const canRequest = canMakeRequest(normalizedISBN);
    if (!canRequest.allowed) {
      throw new Error(
        canRequest.reason ||
          "リクエストが多すぎます。しばらく待ってから再度お試しください。",
      );
    }

    // リクエスト履歴に追加
    addToRequestHistory(normalizedISBN);

    // 楽天ブックスAPIのエンドポイント
    const apiUrl =
      "https://app.rakuten.co.jp/services/api/BooksTotal/Search/20170404";

    const params = new URLSearchParams({
      applicationId: applicationId,
      format: "json",
      isbnjan: normalizedISBN, // 楽天APIではisbnjanパラメータを使用
      hits: "1",
      sort: "standard",
    });

    console.log("楽天APIリクエスト:", {
      isbn: normalizedISBN,
      url: `${apiUrl}?${params.toString()}`,
    });

    const response = await fetch(`${apiUrl}?${params.toString()}`);

    if (!response.ok) {
      // エラーレスポンスの詳細を取得
      let errorMessage = `API request failed: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.error && errorData.error.message) {
          errorMessage = errorData.error.message;
        } else if (errorData.Error) {
          errorMessage = errorData.Error;
        } else if (errorData.error_description) {
          errorMessage = errorData.error_description;
        }
      } catch (e) {
        // JSONパースに失敗した場合はデフォルトメッセージを使用
        console.warn("エラーレスポンスのパースに失敗:", e);
      }

      // 429エラー（レート制限）の場合は特別なメッセージ
      if (response.status === 429) {
        throw new Error(
          "リクエストが多すぎます。しばらく待ってから再度お試しください。",
        );
      }

      // 400エラーの場合は詳細を表示
      if (response.status === 400) {
        console.error("楽天API 400エラー詳細:", {
          isbn: normalizedISBN,
          url: `${apiUrl}?${params.toString()}`,
          errorMessage,
        });
        throw new Error(
          `リクエストエラー: ${errorMessage}。ISBNコード「${normalizedISBN}」が正しいか確認してください。`,
        );
      }

      throw new Error(errorMessage);
    }

    const data: RakutenApiResponse = await response.json();

    if (!data.Items || data.Items.length === 0) {
      // 楽天APIで見つからない場合、Google Books APIにフォールバック
      console.log(
        "楽天APIで本が見つかりませんでした。Google Books APIで検索します:",
        normalizedISBN,
      );
      const googleBook = await searchBookByISBNFromGoogle(normalizedISBN);
      if (googleBook) {
        // Google Booksから取得した本をキャッシュに保存
        setCachedBook(normalizedISBN, googleBook);
        return googleBook;
      }
      // どちらのAPIでも見つからない場合はnullをキャッシュして返す
      setCachedBook(normalizedISBN, null);
      return null;
    }

    const item = data.Items[0].Item;

    const book: Book = {
      title: item.title,
      author: item.author || "著者不明",
      isbn: item.isbn,
      url: item.itemUrl,
      imageUrl:
        item.largeImageUrl || item.mediumImageUrl || item.smallImageUrl || "",
      publisher: item.publisherName,
      publishDate: item.salesDate,
      price: item.itemPrice,
      description: item.itemCaption, // あらすじ
    };

    // キャッシュに保存
    setCachedBook(normalizedISBN, book);

    return book;
  } catch (error) {
    console.error("Error fetching book from Rakuten API:", error);
    throw error;
  }
}

/**
 * タイトルや著者で本を検索（将来の拡張用）
 * @param query 検索クエリ（タイトル、著者など）
 * @param maxResults 最大結果数（デフォルト: 10、最大30）
 * @param page ページ番号（デフォルト: 1）
 * @returns 本の情報の配列
 */
export async function searchBooksByQuery(
  query: string,
  maxResults: number = 10,
  page: number = 1,
): Promise<Book[]> {
  // 楽天ブックスAPIのアプリケーションID
  const applicationId = getRakutenApplicationId();

  try {
    const apiUrl =
      "https://app.rakuten.co.jp/services/api/BooksTotal/Search/20170404";

    // 最大30件に制限（楽天ブックスAPIの仕様）
    const hits = Math.min(maxResults, 30);

    const params = new URLSearchParams({
      applicationId: applicationId,
      format: "json",
      keyword: query,
      hits: hits.toString(),
      page: page.toString(),
      sort: "standard",
    });

    const response = await fetch(`${apiUrl}?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data: RakutenApiResponse = await response.json();

    if (!data.Items || data.Items.length === 0) {
      return [];
    }

    return data.Items.map(({ Item }) => ({
      title: Item.title,
      author: Item.author || "著者不明",
      isbn: Item.isbn,
      url: Item.itemUrl,
      imageUrl:
        Item.largeImageUrl || Item.mediumImageUrl || Item.smallImageUrl || "",
      publisher: Item.publisherName,
      publishDate: Item.salesDate,
      price: Item.itemPrice,
      description: Item.itemCaption, // あらすじ
    }));
  } catch (error) {
    console.error("Error fetching books from Rakuten API:", error);
    throw error;
  }
}

/**
 * 著者名で本を検索（著者名完全一致）
 * @param author 著者名
 * @param maxResults 最大結果数（デフォルト: 30）
 * @returns 本の情報の配列（著者名が完全一致するもののみ）
 */
export async function searchBooksByAuthor(
  author: string,
  maxResults: number = 30,
): Promise<Book[]> {
  try {
    // まずキーワード検索で著者名を含む本を取得
    const books = await searchBooksByQuery(author, maxResults);

    // 著者名が完全一致するもののみをフィルタリング
    return books.filter((book) => book.author === author);
  } catch (error) {
    console.error("Error fetching books by author:", error);
    throw error;
  }
}
