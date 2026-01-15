import { BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WebBarcodeScanner } from '@/components/WebBarcodeScanner';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { showAlert } from '@/utils/alert';
import { getUserId } from '@/utils/firebase-auth';
import { addBookToFirebase, isBookAlreadyAdded } from '@/utils/firebase-books';
import { searchBookByISBN, type Book } from '@/utils/rakuten-api';

const SCAN_AREA_WIDTH = 300;
const SCAN_AREA_HEIGHT = 150;

export default function BarcodeScannerScreen() {
  const colorScheme = useColorScheme();
  // Web版ではWebBarcodeScannerが直接getUserMediaを使用するため、useCameraPermissionsは不要
  // ただし、expo-cameraのuseCameraPermissionsはWebでも動作するため、条件付きで使用
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const screenHeight = Dimensions.get('window').height;
  const screenWidth = Dimensions.get('window').width;
  // ヘッダーの高さ（paddingTop: 50 + paddingBottom: 20 + コンテンツの高さ約20px）
  const headerHeight = 90;
  // フッターの高さ（padding: 20 + テキストの高さ約20px）
  const footerHeight = 60;
  // scannerContainerの高さ（画面の高さからヘッダーとフッターを引いた高さ）
  const scannerContainerHeight = screenHeight - headerHeight - footerHeight;
  // マスクの高さを計算（scannerContainerの高さからスキャンエリアの高さを引いて2で割る）
  // 2pxの余裕を持たせて、枠線内への侵入を防ぐ（上下それぞれ1pxずつ）
  const maskTopHeight = Math.floor((scannerContainerHeight - SCAN_AREA_HEIGHT) / 2) - 1;
  const maskSideWidth = (screenWidth - SCAN_AREA_WIDTH) / 2;
  // 状態変数（デバッグ用、UI表示用に保持）
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [lastRequestTime, setLastRequestTime] = useState<number>(0); // 最後にリクエストを送信した時刻
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [lastScannedISBN, setLastScannedISBN] = useState<string>(''); // 最後にスキャンしたISBNコード
  const [foundBook, setFoundBook] = useState<Book | null>(null);
  const [showBookModal, setShowBookModal] = useState(false);
  const [showingAlert, setShowingAlert] = useState(false); // アラート表示中かどうか
  const [isRequesting, setIsRequesting] = useState(false); // リクエスト送信中かどうか
  const [isSaving, setIsSaving] = useState(false); // 保存中かどうか
  const [addedBooksCount, setAddedBooksCount] = useState(0); // 登録した本の数
  const SCAN_COOLDOWN = 2000; // 2秒間のクールダウン（連続登録のため短縮）
  
  // 即座にチェックできるようにuseRefを使用
  const lastScannedISBNRef = useRef<string>('');
  const isProcessingRef = useRef<boolean>(false);
  const lastRequestTimeRef = useRef<number>(0);

  useEffect(() => {
    if (permission && !permission.granted && !permission.canAskAgain) {
      // 権限が拒否された場合の処理は既にUIで表示される
    }
  }, [permission]);

  const handleBarCodeScanned = async (result: BarcodeScanningResult) => {
    // 連続スキャンを防ぐ: 処理中は即座に無視（useRefで即座にチェック）
    if (isProcessingRef.current || scanned || loading || isRequesting || showBookModal || showingAlert) {
      return;
    }

    const { data } = result;
    if (!data) return;

    // ISBNを正規化（ハイフンを削除）
    const isbn = data.replace(/[-\s]/g, '');

    // 同じISBNコードが連続して読み取られた場合は無視（useRefで即座にチェック）
    if (isbn === lastScannedISBNRef.current) {
      return;
    }

    // クールダウン期間中は無視（最後のリクエスト完了後5秒以内は新しいリクエストを送信しない）
    const now = Date.now();
    if (lastRequestTimeRef.current > 0 && now - lastRequestTimeRef.current < SCAN_COOLDOWN) {
      const remainingTime = Math.ceil((SCAN_COOLDOWN - (now - lastRequestTimeRef.current)) / 1000);
      console.log(`クールダウン期間中です。あと${remainingTime}秒待ってから再度スキャンしてください。`);
      return;
    }

    // 即座にブロックするため、useRefを先に設定
    isProcessingRef.current = true;
    lastScannedISBNRef.current = isbn;
    
    // 状態も更新
    setLastScannedISBN(isbn);
    setScanned(true);
    setIsRequesting(true);
    setLoading(true);

    try {
      // ISBNが有効かチェック（10桁または13桁）
      if (!/^\d{10}(\d{3})?$/.test(isbn)) {
        setShowingAlert(true);
        showAlert('エラー', '有効なISBNコードを読み込んでください。', [
          {
            text: 'OK',
            onPress: () => {
              setShowingAlert(false);
              setScanned(false);
              setLastScannedISBN(''); // ISBNコードをリセット
              setIsRequesting(false); // リクエスト送信フラグをリセット
              lastScannedISBNRef.current = ''; // useRefもリセット
              isProcessingRef.current = false; // 処理中フラグをリセット
            },
          },
        ]);
        setLoading(false);
        setIsRequesting(false); // リクエスト送信フラグをリセット
        return;
      }

      // 楽天ブックスAPIで本を検索（キャッシュから取得する場合もある）
      const book = await searchBookByISBN(isbn);
      
      // リクエスト完了時刻を記録（キャッシュから取得した場合でも記録）
      const requestTime = Date.now();
      lastRequestTimeRef.current = requestTime;
      setLastRequestTime(requestTime);
      
      // 本の情報が正しく取得できたかチェック
      if (book && book.title && book.author && book.isbn) {
        // 本の情報が正しく取得できた場合
        setFoundBook(book);
        setShowBookModal(true);
      } else {
        // 本が見つからない、または情報が不完全な場合
        setLoading(false);
        setIsRequesting(false);
        isProcessingRef.current = false;
        setShowingAlert(true);
        showAlert(
          '本が見つかりませんでした',
          '楽天ブックスのデータベースに該当する本が見つかりませんでした。\n\nISBNコードが正しいか、または別の方法で登録してください。',
          [
            {
              text: 'OK',
              onPress: () => {
                setShowingAlert(false);
                setScanned(false);
                setLastScannedISBN('');
                setIsRequesting(false);
                lastScannedISBNRef.current = '';
                isProcessingRef.current = false;
              },
            },
          ]
        );
      }
    } catch (error) {
      // リクエスト完了時刻を記録（エラー時も記録）
      const requestTime = Date.now();
      lastRequestTimeRef.current = requestTime;
      setLastRequestTime(requestTime);
      
      console.error('Error searching book:', error);
      const errorMessage = error instanceof Error ? error.message : '本の検索に失敗しました。';
      
      // ISBNを取得（エラーメッセージから抽出するか、変数から取得）
      const isbn = result.data?.replace(/[-\s]/g, '') || '不明';
      
      // エラーメッセージに応じて適切なメッセージを表示
      let alertMessage = '本の検索に失敗しました。';
      if (errorMessage.includes('リクエストが多すぎます') || errorMessage.includes('リクエスト間隔が短すぎます')) {
        alertMessage = 'リクエストが多すぎます。\nしばらく待ってから再度お試しください。';
      } else if (errorMessage.includes('リクエストエラー')) {
        alertMessage = `リクエストエラーが発生しました。\n\n${errorMessage}\n\nISBNコード「${isbn}」が正しいか確認してください。`;
      } else if (errorMessage.includes('無効なISBN形式')) {
        alertMessage = `無効なISBN形式です。\n\n読み取ったコード: ${isbn}\n\nもう一度スキャンしてください。`;
      }
      
      setLoading(false);
      setIsRequesting(false);
      isProcessingRef.current = false;
      setShowingAlert(true);
      showAlert('エラー', alertMessage, [
        {
          text: 'OK',
          onPress: () => {
            setShowingAlert(false);
            setScanned(false);
            setLastScannedISBN('');
            setIsRequesting(false);
            lastScannedISBNRef.current = '';
            isProcessingRef.current = false;
          },
        },
      ]);
    } finally {
      setLoading(false);
      setIsRequesting(false); // リクエスト送信フラグをリセット
      isProcessingRef.current = false; // 処理中フラグをリセット
    }
  };

  const handleClose = () => {
    if (addedBooksCount > 0) {
      showAlert(
        '登録完了',
        `${addedBooksCount}冊の本を登録しました。\n本棚に戻ります。`,
        [
          {
            text: 'OK',
            onPress: () => {
              router.back();
            },
          },
        ]
      );
    } else {
      router.back();
    }
  };

  // Web用のバーコードスキャンハンドラー
  const handleWebBarcodeScanned = (result: { data: string }) => {
    console.log('handleWebBarcodeScanned called with:', result);
    // BarcodeScanningResult形式に変換
    const barcodeResult: BarcodeScanningResult = {
      data: result.data,
      type: 'ean13', // デフォルト値
      cornerPoints: [],
      bounds: { origin: { x: 0, y: 0 }, size: { width: 0, height: 0 } },
    };
    console.log('Calling handleBarCodeScanned with:', barcodeResult);
    // handleBarCodeScannedは非同期関数なので、直接呼び出す（awaitは不要）
    handleBarCodeScanned(barcodeResult).catch((error) => {
      console.error('Error in handleBarCodeScanned:', error);
    });
  };

  // Web版では、WebBarcodeScannerが直接getUserMediaを使用するため、
  // 権限チェックはWebBarcodeScanner内で行われる
  // ただし、expo-cameraのuseCameraPermissionsはWebでも動作するため、ネイティブ版のみ権限チェック
  if (Platform.OS !== 'web') {
    if (!permission) {
      return (
        <ThemedView style={styles.container}>
          <View style={styles.centerContent}>
            <ThemedText style={styles.statusText}>カメラの権限を確認中...</ThemedText>
          </View>
        </ThemedView>
      );
    }

    if (!permission.granted) {
      return (
        <ThemedView style={styles.container}>
          <View style={styles.centerContent}>
            <Icon
              name="camera-alt"
              size={64}
              color={Colors[colorScheme ?? 'light'].icon}
            />
            <ThemedText style={styles.errorText}>カメラの権限が必要です</ThemedText>
            <ThemedText style={styles.errorSubText}>
              バーコードをスキャンするにはカメラの権限が必要です
            </ThemedText>
            {permission.canAskAgain && (
              <Pressable style={styles.closeButton} onPress={requestPermission}>
                <ThemedText style={styles.closeButtonText}>権限をリクエスト</ThemedText>
              </Pressable>
            )}
            <Pressable style={[styles.closeButton, { marginTop: 12, backgroundColor: '#666' }]} onPress={handleClose}>
              <ThemedText style={styles.closeButtonText}>閉じる</ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      );
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.closeIconButton} onPress={handleClose}>
          <Icon name="close" size={28} color="#fff" />
        </Pressable>
        <View style={styles.headerCenter}>
          <ThemedText style={styles.headerTitle}>バーコードを読み取る</ThemedText>
          {addedBooksCount > 0 && (
            <ThemedText style={styles.headerSubtitle}>
              {addedBooksCount}冊登録済み
            </ThemedText>
          )}
        </View>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.scannerContainer}>
        {Platform.OS === 'web' ? (
          <WebBarcodeScanner
            onBarcodeScanned={handleWebBarcodeScanned}
            style={StyleSheet.absoluteFillObject}
            disabled={
              isProcessingRef.current ||
              scanned ||
              loading ||
              isRequesting ||
              showBookModal ||
              showingAlert ||
              (lastRequestTimeRef.current > 0 && Date.now() - lastRequestTimeRef.current < SCAN_COOLDOWN)
            }
          />
        ) : (
          <CameraView
            onBarcodeScanned={
              isProcessingRef.current ||
              scanned ||
              loading ||
              isRequesting ||
              showBookModal ||
              showingAlert ||
              (lastRequestTimeRef.current > 0 && Date.now() - lastRequestTimeRef.current < SCAN_COOLDOWN)
                ? undefined
                : handleBarCodeScanned
            }
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'],
            }}
            style={StyleSheet.absoluteFillObject}
            facing="back"
            enableTorch={false}
            autofocus="on"
            zoom={0}
            mode="picture"
          />
        )}
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <ThemedText style={styles.loadingText}>本を検索中...</ThemedText>
          </View>
        )}
        {!scanned && !loading && (
          <View style={styles.overlay}>
            {/* 上部のマスク */}
            <View style={[styles.maskTop, { height: maskTopHeight }]} />
            {/* 中央のスキャンエリア */}
            <View style={[styles.scanAreaContainer, { height: SCAN_AREA_HEIGHT }]}>
              {/* 左側のマスク */}
              <View style={[styles.maskSide, { width: maskSideWidth, height: SCAN_AREA_HEIGHT }]} />
              <View style={[styles.scanArea, { width: SCAN_AREA_WIDTH, height: SCAN_AREA_HEIGHT }]}>
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
              </View>
              {/* 右側のマスク */}
              <View style={[styles.maskSide, { width: maskSideWidth, height: SCAN_AREA_HEIGHT }]} />
            </View>
            {/* 下部のマスク */}
            <View style={[styles.maskBottom, { height: maskTopHeight }]} />
          </View>
        )}
      </View>

      {!scanned && (
        <View style={styles.instructions}>
          <ThemedText style={styles.instructionText}>
            バーコードをカメラの中央に合わせてください
          </ThemedText>
          <ThemedText style={styles.instructionSubText}>
            連続して複数の本を登録できます
          </ThemedText>
        </View>
      )}

      {scanned && !loading && (
        <View style={styles.rescanContainer}>
          <Pressable
            style={styles.rescanButton}
            onPress={() => {
              setScanned(false);
              setLastRequestTime(0); // クールダウンをリセット
              setLastScannedISBN(''); // ISBNコードをリセット
              setIsRequesting(false); // リクエスト送信フラグをリセット
              lastRequestTimeRef.current = 0; // useRefもリセット
              lastScannedISBNRef.current = ''; // useRefもリセット
              isProcessingRef.current = false; // 処理中フラグをリセット
            }}>
            <ThemedText style={styles.rescanButtonText}>もう一度スキャン</ThemedText>
          </Pressable>
        </View>
      )}

      {/* 本の情報を表示するモーダル */}
      <Modal
        visible={showBookModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowBookModal(false);
          setScanned(false);
          setLastScannedISBN(''); // ISBNコードをリセット
          setIsRequesting(false); // リクエスト送信フラグをリセット
          lastScannedISBNRef.current = ''; // useRefもリセット
          isProcessingRef.current = false; // 処理中フラグをリセット
        }}>
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: Colors[colorScheme ?? 'light'].background },
            ]}>
            {foundBook && (
              <>
                {/* サムネイル画像 */}
                {foundBook.imageUrl ? (
                  <Image
                    source={{ uri: foundBook.imageUrl }}
                    style={styles.bookThumbnail}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={styles.bookThumbnailPlaceholder}>
                    <Icon
                      name="book"
                      size={48}
                      color={Colors[colorScheme ?? 'light'].icon}
                    />
                  </View>
                )}

                {/* タイトル */}
                <ThemedText
                  style={[
                    styles.bookTitle,
                    { color: Colors[colorScheme ?? 'light'].text },
                  ]}>
                  {foundBook.title}
                </ThemedText>

                {/* 作者名 */}
                <ThemedText
                  style={[
                    styles.bookAuthor,
                    { color: Colors[colorScheme ?? 'light'].text },
                  ]}>
                  {foundBook.author}
                </ThemedText>

                {/* ボタン */}
                <View style={styles.modalButtons}>
                  <Pressable
                    style={[styles.modalButton, styles.cancelButton, { backgroundColor: colorScheme === 'dark' ? '#3D352D' : '#E0E0E0' }]}
                    onPress={() => {
                      setShowBookModal(false);
                      setScanned(false);
                      setFoundBook(null);
                      setLastScannedISBN(''); // ISBNコードをリセット
                      setIsRequesting(false); // リクエスト送信フラグをリセット
                      lastScannedISBNRef.current = ''; // useRefもリセット
                      isProcessingRef.current = false; // 処理中フラグをリセット
                    }}>
                    <ThemedText style={[styles.cancelButtonText, { color: colorScheme === 'dark' ? '#F5F0E6' : '#333' }]}>スキップ</ThemedText>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.modalButton,
                      styles.addButton,
                      isSaving && styles.addButtonDisabled,
                    ]}
                    disabled={isSaving}
                    onPress={async () => {
                      if (!foundBook || isSaving) return;

                      setIsSaving(true);
                      try {
                        const userId = getUserId();
                        if (!userId) {
                          showAlert('エラー', 'ログインが必要です', [
                            {
                              text: 'OK',
                              onPress: () => {
                                setIsSaving(false);
                              },
                            },
                          ]);
                          return;
                        }

                        // 既に登録されているかチェック
                        const alreadyAdded = await isBookAlreadyAdded(userId, foundBook.isbn);
                        if (alreadyAdded) {
                          // 状態をリセット
                          setShowBookModal(false);
                          setScanned(false);
                          setFoundBook(null);
                          setLastScannedISBN('');
                          setIsRequesting(false);
                          lastScannedISBNRef.current = '';
                          isProcessingRef.current = false;

                          // 連続登録のため、画面遷移せずにスキャン画面に留まる
                          showAlert('既に登録されています', 'この本は既に本棚に追加されています。\n続けて次の本をスキャンできます。');
                          return;
                        }

                        // Firebaseに保存
                        await addBookToFirebase(foundBook, userId, foundBook.description);

                        // 登録した本の数をインクリメント
                        setAddedBooksCount((prev) => prev + 1);

                        // 状態をリセット
                        setShowBookModal(false);
                        setScanned(false);
                        setFoundBook(null);
                        setLastScannedISBN('');
                        setIsRequesting(false);
                        lastScannedISBNRef.current = '';
                        isProcessingRef.current = false;

                        // 連続登録のため、画面遷移せずにスキャン画面に留まる
                        const bookTitle = foundBook.title.length > 30
                          ? foundBook.title.substring(0, 30) + '...'
                          : foundBook.title;
                        showAlert(
                          '追加完了',
                          `「${bookTitle}」を本棚に追加しました。\n\n続けて次の本をスキャンできます。`
                        );
                      } catch (error) {
                        console.error('Error adding book to Firebase:', error);
                        showAlert(
                          'エラー',
                          '本の追加に失敗しました。\nもう一度お試しください。',
                          [
                            {
                              text: 'OK',
                              onPress: () => {
                                setIsSaving(false);
                              },
                            },
                          ]
                        );
                      } finally {
                        setIsSaving(false);
                      }
                    }}>
                    <ThemedText style={styles.addButtonText}>
                      {isSaving ? '保存中...' : '本棚に追加'}
                    </ThemedText>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  closeIconButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.8,
    marginTop: 2,
  },
  placeholder: {
    width: 44,
  },
  scannerContainer: {
    flex: 1,
    position: 'relative',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  maskTop: {
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    overflow: 'hidden',
  },
  maskBottom: {
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    overflow: 'hidden',
  },
  scanAreaContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    zIndex: 1,
  },
  maskSide: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  scanArea: {
    position: 'relative',
    backgroundColor: 'transparent',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#fff',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#fff',
    fontSize: 16,
  },
  instructions: {
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  instructionText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
  },
  instructionSubText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 12,
    marginTop: 4,
    opacity: 0.7,
  },
  rescanContainer: {
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  rescanButton: {
    backgroundColor: '#838A2D',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  rescanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    backgroundColor: '#838A2D',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
  },
  errorSubText: {
    color: '#fff',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    opacity: 0.8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  bookThumbnail: {
    width: 150,
    height: 200,
    borderRadius: 8,
    marginBottom: 16,
    backgroundColor: '#f0f0f0',
  },
  bookThumbnailPlaceholder: {
    width: 150,
    height: 200,
    borderRadius: 8,
    marginBottom: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  bookAuthor: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.7,
  },
  modalButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#E0E0E0',
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#838A2D',
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

