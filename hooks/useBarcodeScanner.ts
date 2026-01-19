/**
 * バーコードスキャナー状態管理フック
 * 状態マシンベースのシンプルな状態管理を提供
 */

import { useCallback, useRef, useState } from 'react';

import { isBookBarcode, normalizeBarcode, normalizeToISBN13 } from '@/utils/barcode-validator';
import { getUserId } from '@/utils/firebase-auth';
import { addBookToFirebase, isBookAlreadyAdded } from '@/utils/firebase-books';
import { searchBookByISBN, type Book } from '@/utils/rakuten-api';

// スキャナーの状態型
export type ScannerState =
  | { status: 'idle' }
  | { status: 'scanning' }
  | { status: 'cooldown'; until: number }
  | { status: 'searching'; isbn: string }
  | { status: 'confirming'; book: Book }
  | { status: 'saving'; book: Book }
  | { status: 'error'; message: string; canRetry: boolean };

// フックの戻り値型
export interface UseBarcodeScanner {
  state: ScannerState;
  scannedCount: number;
  handleScan: (barcode: string) => void;
  confirmBook: () => Promise<void>;
  confirmAndStop: () => Promise<void>;
  skipBook: () => void;
  dismissError: () => void;
  startScanning: () => void;
  stopScanning: () => void;
}

// 設定
const SCAN_COOLDOWN_MS = 1500; // スキャン間のクールダウン
const DUPLICATE_MEMORY_SIZE = 50; // 記憶する重複ISBNの数

export function useBarcodeScanner(): UseBarcodeScanner {
  const [state, setState] = useState<ScannerState>({ status: 'idle' });
  const [scannedCount, setScannedCount] = useState(0);

  // 重複検出用のセット（最近スキャンしたISBN）
  const recentScansRef = useRef<Set<string>>(new Set());
  // 処理中フラグ（連続スキャン防止）
  const isProcessingRef = useRef(false);
  // クールダウンタイマー
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * 重複ISBNを記録（メモリ制限付き）
   */
  const addToRecentScans = useCallback((isbn: string) => {
    const recentScans = recentScansRef.current;
    recentScans.add(isbn);
    // 古いエントリを削除してメモリを制限
    if (recentScans.size > DUPLICATE_MEMORY_SIZE) {
      const firstItem = recentScans.values().next().value;
      if (firstItem) {
        recentScans.delete(firstItem);
      }
    }
  }, []);

  /**
   * クールダウンを開始
   */
  const startCooldown = useCallback(() => {
    const until = Date.now() + SCAN_COOLDOWN_MS;
    setState({ status: 'cooldown', until });

    // クールダウン終了後にスキャン状態に戻る
    cooldownTimerRef.current = setTimeout(() => {
      setState((prev) => {
        if (prev.status === 'cooldown') {
          return { status: 'scanning' };
        }
        return prev;
      });
    }, SCAN_COOLDOWN_MS);
  }, []);

  /**
   * スキャン開始
   */
  const startScanning = useCallback(() => {
    setState({ status: 'scanning' });
  }, []);

  /**
   * スキャン停止
   */
  const stopScanning = useCallback(() => {
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
    setState({ status: 'idle' });
  }, []);

  /**
   * バーコードスキャン処理
   */
  const handleScan = useCallback(
    async (barcode: string) => {
      console.log('=== handleScan called ===');
      console.log('Barcode:', barcode);
      console.log('Current state:', state.status);
      console.log('isProcessing:', isProcessingRef.current);

      // 処理中の場合は無視
      if (isProcessingRef.current) {
        console.log('Already processing, ignoring');
        return;
      }

      // スキャン可能な状態でない場合は無視（scanning と cooldown を許可）
      if (state.status !== 'scanning' && state.status !== 'cooldown') {
        console.log('Not in scanning state, ignoring. Current state:', state.status);
        return;
      }

      const normalized = normalizeBarcode(barcode);
      console.log('Normalized barcode:', normalized);

      // 最近スキャンしたバーコードは無視（同じ本の連続読み取り防止）
      if (recentScansRef.current.has(normalized)) {
        console.log('Recently scanned, ignoring:', normalized);
        return;
      }
      console.log('New barcode, processing...');

      // 有効なバーコードか検証
      const isValid = isBookBarcode(normalized);
      console.log('isBookBarcode result:', isValid, 'for:', normalized);
      if (!isValid) {
        console.log('Invalid barcode, showing error');
        setState({
          status: 'error',
          message: '有効な書籍バーコードではありません。\nISBNバーコードをスキャンしてください。',
          canRetry: true,
        });
        return;
      }

      isProcessingRef.current = true;
      addToRecentScans(normalized);

      // cooldown中にスキャンされた場合、タイマーをキャンセル
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }

      // ISBN-13形式に正規化（ISBN-10の場合は変換）
      const isbn13 = normalizeToISBN13(normalized);
      console.log('Normalized to ISBN-13:', isbn13);
      console.log('Setting state to searching...');
      setState({ status: 'searching', isbn: isbn13 });

      try {
        // ユーザーIDを取得
        const userId = getUserId();
        if (!userId) {
          setState({
            status: 'error',
            message: 'ログインが必要です。',
            canRetry: false,
          });
          isProcessingRef.current = false;
          return;
        }

        // 既に登録済みかチェック（API呼び出し前に確認）
        const alreadyAdded = await isBookAlreadyAdded(userId, isbn13);
        if (alreadyAdded) {
          setState({
            status: 'error',
            message: 'この本は既に本棚に登録されています。',
            canRetry: true,
          });
          isProcessingRef.current = false;
          return;
        }

        // 楽天APIで本を検索
        console.log('Searching book by ISBN:', isbn13);
        const book = await searchBookByISBN(isbn13);
        console.log('Search result:', book);

        if (!book || !book.title || !book.author) {
          setState({
            status: 'error',
            message: `本が見つかりませんでした。\n\nISBN: ${isbn13}\n\n楽天ブックスのデータベースに該当する本がない可能性があります。`,
            canRetry: true,
          });
          isProcessingRef.current = false;
          return;
        }

        // 確認画面へ
        setState({ status: 'confirming', book });
        isProcessingRef.current = false;
      } catch (error) {
        console.error('Error searching book:', error);
        const errorMessage =
          error instanceof Error ? error.message : '本の検索に失敗しました。';

        let displayMessage = '本の検索に失敗しました。';
        if (errorMessage.includes('リクエストが多すぎます')) {
          displayMessage = 'リクエストが多すぎます。\nしばらく待ってから再度お試しください。';
        } else if (errorMessage.includes('ネットワーク')) {
          displayMessage = 'ネットワークエラーが発生しました。\n接続を確認してください。';
        }

        setState({
          status: 'error',
          message: displayMessage,
          canRetry: true,
        });
        isProcessingRef.current = false;
      }
    },
    [state.status, addToRecentScans]
  );

  /**
   * 本を本棚に追加（連続スキャン用）
   */
  const confirmBook = useCallback(async () => {
    if (state.status !== 'confirming') return;

    const book = state.book;
    setState({ status: 'saving', book });

    try {
      const userId = getUserId();
      if (!userId) {
        setState({
          status: 'error',
          message: 'ログインが必要です。',
          canRetry: false,
        });
        return;
      }

      await addBookToFirebase(book, userId, book.description);
      setScannedCount((prev) => prev + 1);

      // 保存成功後、クールダウンを開始
      startCooldown();
    } catch (error) {
      console.error('Error saving book:', error);
      setState({
        status: 'error',
        message: '本の保存に失敗しました。\nもう一度お試しください。',
        canRetry: true,
      });
    }
  }, [state, startCooldown]);

  /**
   * 本を本棚に追加してスキャンを停止
   */
  const confirmAndStop = useCallback(async () => {
    if (state.status !== 'confirming') return;

    const book = state.book;
    setState({ status: 'saving', book });

    try {
      const userId = getUserId();
      if (!userId) {
        setState({
          status: 'error',
          message: 'ログインが必要です。',
          canRetry: false,
        });
        return;
      }

      await addBookToFirebase(book, userId, book.description);
      setScannedCount((prev) => prev + 1);

      // 保存成功後、スキャンを停止
      setState({ status: 'idle' });
    } catch (error) {
      console.error('Error saving book:', error);
      setState({
        status: 'error',
        message: '本の保存に失敗しました。\nもう一度お試しください。',
        canRetry: true,
      });
    }
  }, [state]);

  /**
   * 本をスキップ
   */
  const skipBook = useCallback(() => {
    if (state.status !== 'confirming') return;
    // スキップ時はクールダウンを開始
    startCooldown();
  }, [state.status, startCooldown]);

  /**
   * エラーを閉じる
   */
  const dismissError = useCallback(() => {
    if (state.status !== 'error') return;
    // エラー解除後、スキャン状態に戻る
    setState({ status: 'scanning' });
  }, [state.status]);

  return {
    state,
    scannedCount,
    handleScan,
    confirmBook,
    confirmAndStop,
    skipBook,
    dismissError,
    startScanning,
    stopScanning,
  };
}
