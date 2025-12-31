/**
 * 楽天ブックスAPIを使用して本を検索するユーティリティ
 * 
 * 使用方法:
 * 1. https://webservice.rakuten.co.jp/app/create でアプリを登録
 * 2. アプリ登録後、アプリケーションIDを取得
 * 3. .envファイルに RAKUTEN_APPLICATION_ID を設定するか、
 *    searchBookByISBN関数のapplicationIdを直接設定してください
 */

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
const MAX_REQUESTS_PER_WINDOW = 3; // ウィンドウ内の最大リクエスト数
const REQUEST_WINDOW = 10 * 1000; // 10秒間のウィンドウ
const MIN_REQUEST_INTERVAL = 2000; // 最小リクエスト間隔（2秒）

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
  while (requestHistory.length > 0 && now - requestHistory[0].timestamp > REQUEST_WINDOW) {
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
    (req) => now - req.timestamp <= REQUEST_WINDOW
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
 * ISBNコードで本を検索
 * @param isbn ISBNコード（10桁または13桁、ハイフンなし推奨）
 * @returns 本の情報、見つからない場合はnull
 */
export async function searchBookByISBN(isbn: string): Promise<Book | null> {
  // 楽天ブックスAPIのアプリケーションID
  const applicationId = '1098150694499447345';

  try {
    // ISBNコードを正規化
    const normalizedISBN = isbn.replace(/[-\s]/g, '');
    
    // ISBNが空でないかチェック
    if (!normalizedISBN || normalizedISBN.length === 0) {
      throw new Error('ISBNコードが空です');
    }
    
    // ISBNの形式をチェック（10桁または13桁の数字）
    if (!/^\d{10}(\d{3})?$/.test(normalizedISBN)) {
      throw new Error(`無効なISBN形式です: ${normalizedISBN}`);
    }
    
    // キャッシュをチェック
    const cachedBook = getCachedBook(normalizedISBN);
    if (cachedBook !== undefined) {
      console.log('キャッシュから本の情報を取得:', normalizedISBN);
      // キャッシュから取得した場合でも、リクエスト履歴に追加して連続リクエストを防ぐ
      // （実際のAPIリクエストは送信しないが、リクエスト間隔の制御のため）
      addToRequestHistory(normalizedISBN);
      return cachedBook;
    }
    
    // リクエスト制限をチェック
    const canRequest = canMakeRequest(normalizedISBN);
    if (!canRequest.allowed) {
      throw new Error(canRequest.reason || 'リクエストが多すぎます。しばらく待ってから再度お試しください。');
    }
    
    // リクエスト履歴に追加
    addToRequestHistory(normalizedISBN);
    
    // 楽天ブックスAPIのエンドポイント
    const apiUrl = 'https://app.rakuten.co.jp/services/api/BooksTotal/Search/20170404';
    
    const params = new URLSearchParams({
      applicationId: applicationId,
      format: 'json',
      isbnjan: normalizedISBN, // 楽天APIではisbnjanパラメータを使用
      hits: '1',
      sort: 'standard',
    });
    
    console.log('楽天APIリクエスト:', {
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
        console.warn('エラーレスポンスのパースに失敗:', e);
      }
      
      // 429エラー（レート制限）の場合は特別なメッセージ
      if (response.status === 429) {
        throw new Error('リクエストが多すぎます。しばらく待ってから再度お試しください。');
      }
      
      // 400エラーの場合は詳細を表示
      if (response.status === 400) {
        console.error('楽天API 400エラー詳細:', {
          isbn: normalizedISBN,
          url: `${apiUrl}?${params.toString()}`,
          errorMessage,
        });
        throw new Error(`リクエストエラー: ${errorMessage}。ISBNコード「${normalizedISBN}」が正しいか確認してください。`);
      }
      
      throw new Error(errorMessage);
    }

    const data: RakutenApiResponse = await response.json();

    if (!data.Items || data.Items.length === 0) {
      return null;
    }

    const item = data.Items[0].Item;

    const book: Book = {
      title: item.title,
      author: item.author || '著者不明',
      isbn: item.isbn,
      url: item.itemUrl,
      imageUrl: item.largeImageUrl || item.mediumImageUrl || item.smallImageUrl || '',
      publisher: item.publisherName,
      publishDate: item.salesDate,
      price: item.itemPrice,
    };
    
    // キャッシュに保存
    setCachedBook(normalizedISBN, book);
    
    return book;
  } catch (error) {
    // エラーが発生した場合でも、nullをキャッシュして短時間の再リクエストを防ぐ
    const normalizedISBN = isbn.replace(/[-\s]/g, '');
    if (normalizedISBN && /^\d{10}(\d{3})?$/.test(normalizedISBN)) {
      // エラーがレート制限関連でない場合のみキャッシュ（レート制限の場合は再試行を許可）
      if (!(error instanceof Error && error.message.includes('リクエストが多すぎます'))) {
        setCachedBook(normalizedISBN, null);
      }
    }
    
    console.error('Error fetching book from Rakuten API:', error);
    throw error;
  }
}

/**
 * タイトルや著者で本を検索（将来の拡張用）
 * @param query 検索クエリ（タイトル、著者など）
 * @param maxResults 最大結果数（デフォルト: 10）
 * @returns 本の情報の配列
 */
export async function searchBooksByQuery(
  query: string,
  maxResults: number = 10
): Promise<Book[]> {
  // 楽天ブックスAPIのアプリケーションID
  const applicationId = '1098150694499447345';

  try {
    const apiUrl = 'https://app.rakuten.co.jp/services/api/BooksTotal/Search/20170404';
    
    const params = new URLSearchParams({
      applicationId: applicationId,
      format: 'json',
      keyword: query,
      hits: maxResults.toString(),
      sort: 'standard',
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
      author: Item.author || '著者不明',
      isbn: Item.isbn,
      url: Item.itemUrl,
      imageUrl: Item.largeImageUrl || Item.mediumImageUrl || Item.smallImageUrl || '',
      publisher: Item.publisherName,
      publishDate: Item.salesDate,
      price: Item.itemPrice,
    }));
  } catch (error) {
    console.error('Error fetching books from Rakuten API:', error);
    throw error;
  }
}

