/**
 * バーコードスキャナー画面
 * 状態マシンベースのシンプルな実装
 */

import { Icon } from '@/components/Icon';
import { BarcodeScanner } from '@/components/scanner/BarcodeScanner';
import { BookConfirmModal } from '@/components/scanner/BookConfirmModal';
import { ScanOverlay } from '@/components/scanner/ScanOverlay';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { showAlert } from '@/utils/alert';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

export default function BarcodeScannerScreen() {
  const {
    state,
    scannedCount,
    handleScan,
    confirmBook,
    confirmAndStop,
    skipBook,
    dismissError,
    startScanning,
    stopScanning,
  } = useBarcodeScanner();

  // 画面表示時にスキャン開始
  useEffect(() => {
    console.log('BarcodeScannerScreen mounted, starting scanner');
    startScanning();
    return () => {
      console.log('BarcodeScannerScreen unmounting, stopping scanner');
      stopScanning();
    };
  }, [startScanning, stopScanning]);

  // 状態変化をログに出力
  useEffect(() => {
    console.log('Scanner state changed:', state);
  }, [state]);

  // 閉じるボタンの処理
  const handleClose = () => {
    stopScanning();
    if (scannedCount > 0) {
      showAlert('登録完了', `${scannedCount}冊の本を登録しました。`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } else {
      router.back();
    }
  };

  // 本棚に追加してスキャンを停止
  const handleConfirmAndStop = async () => {
    const bookTitle =
      state.status === 'confirming'
        ? state.book.title.length > 25
          ? state.book.title.substring(0, 25) + '...'
          : state.book.title
        : '';

    await confirmAndStop();

    // 保存成功後にアラート表示して画面を閉じる
    showAlert('追加完了', `「${bookTitle}」を本棚に追加しました。`, [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  // 本棚に追加して連続スキャン（アラートなしで即座に次のスキャンへ）
  const handleContinuousScan = async () => {
    await confirmBook();
    // アラートは表示せず、ヘッダーの「〇冊登録済み」で確認可能
  };

  // エラー時のアラート
  useEffect(() => {
    if (state.status === 'error') {
      showAlert('エラー', state.message, [
        {
          text: state.canRetry ? '再スキャン' : 'OK',
          onPress: dismissError,
        },
      ]);
    }
  }, [state, dismissError]);

  // カメラをアクティブに保つ状態かどうか（連続スキャンのためにconfirming/saving中もカメラを維持）
  const isCameraActive =
    state.status === 'scanning' ||
    state.status === 'cooldown' ||
    state.status === 'confirming' ||
    state.status === 'saving';

  // スキャン可能な状態かどうか（UIの表示用）
  const isScanning = state.status === 'scanning' || state.status === 'cooldown';

  // 現在の状態を表示するテキスト
  const getStatusText = () => {
    switch (state.status) {
      case 'scanning':
        return 'バーコードをカメラの中央に合わせてください';
      case 'cooldown':
        return '次のスキャン準備中...';
      case 'searching':
        return '本を検索中...';
      default:
        return '';
    }
  };

  return (
    <View style={styles.container}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <Pressable style={styles.closeButton} onPress={handleClose}>
          <Icon name="close" size={28} color="#fff" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>バーコードを読み取る</Text>
          {scannedCount > 0 && (
            <Text style={styles.headerSubtitle}>{scannedCount}冊登録済み</Text>
          )}
        </View>
        <View style={styles.headerPlaceholder} />
      </View>

      {/* スキャナー */}
      <View style={styles.scannerContainer}>
        <BarcodeScanner
          onScan={handleScan}
          isActive={isCameraActive}
          onPermissionDenied={handleClose}
          resetTrigger={scannedCount}
        />

        {/* スキャン領域オーバーレイ（ネイティブのみ、Webはhtml5-qrcodeが独自表示） */}
        {Platform.OS !== 'web' && <ScanOverlay visible={isScanning} />}

        {/* ローディングオーバーレイ */}
        {state.status === 'searching' && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>本を検索中...</Text>
          </View>
        )}
      </View>

      {/* フッター */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>{getStatusText()}</Text>
        {isScanning && (
          <Text style={styles.footerSubtext}>連続して複数の本を登録できます</Text>
        )}
      </View>

      {/* 本の確認モーダル */}
      <BookConfirmModal
        book={state.status === 'confirming' || state.status === 'saving' ? state.book : null}
        visible={state.status === 'confirming' || state.status === 'saving'}
        onConfirm={handleConfirmAndStop}
        onContinuousScan={handleContinuousScan}
        onClose={skipBook}
        isSaving={state.status === 'saving'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  closeButton: {
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
  headerPlaceholder: {
    width: 44,
  },
  scannerContainer: {
    flex: 1,
    position: 'relative',
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
  footer: {
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
  },
  footerText: {
    color: '#fff',
    fontSize: 15,
    textAlign: 'center',
  },
  footerSubtext: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
  },
});
