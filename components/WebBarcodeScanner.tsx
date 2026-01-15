import { ThemedText } from '@/components/themed-text';
import Quagga, {
  QuaggaJSConfigObject,
  QuaggaJSResultObject,
} from '@ericblade/quagga2';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

// Web専用のバーコードスキャンコンポーネント
// Quagga2を使用してWebでISBNバーコード（EAN-13、EAN-8、UPC-A、UPC-E）をスキャン
// Quagga2は1Dバーコード専用で、位置検出が優秀なため精度が高い
export function WebBarcodeScanner({
  onBarcodeScanned,
  style,
  disabled,
}: {
  onBarcodeScanned: (result: { data: string }) => void;
  style?: any;
  disabled?: boolean;
}) {
  const scannerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const lastScannedRef = useRef<string>('');
  const onBarcodeScannedRef = useRef(onBarcodeScanned);
  const isMountedRef = useRef<boolean>(true);
  const isInitializingRef = useRef<boolean>(false);

  // コールバックを最新のものに更新
  useEffect(() => {
    onBarcodeScannedRef.current = onBarcodeScanned;
  }, [onBarcodeScanned]);

  useEffect(() => {
    if (Platform.OS !== 'web' || disabled) return;

    isMountedRef.current = true;

    const initScanner = async () => {
      // 既に初期化中または初期化済みの場合はスキップ
      if (isInitializingRef.current || isInitialized) return;
      isInitializingRef.current = true;

      try {
        if (!scannerRef.current || !isMountedRef.current) {
          isInitializingRef.current = false;
          return;
        }

        // Quagga2の設定
        const config: QuaggaJSConfigObject = {
          inputStream: {
            type: 'LiveStream',
            target: scannerRef.current,
            constraints: {
              width: { min: 640, ideal: 1280, max: 1920 },
              height: { min: 480, ideal: 720, max: 1080 },
              facingMode: 'environment', // バックカメラを優先
              aspectRatio: { min: 1, max: 2 },
            },
            area: {
              // スキャン領域を中央に限定して精度を向上
              top: '20%',
              right: '10%',
              left: '10%',
              bottom: '20%',
            },
          },
          locator: {
            patchSize: 'medium', // バーコード検出のパッチサイズ
            halfSample: true, // パフォーマンス向上のため半分のサンプリング
          },
          numOfWorkers: navigator.hardwareConcurrency || 4,
          frequency: 10, // スキャン頻度（fps）
          decoder: {
            readers: [
              'ean_reader', // EAN-13（ISBN-13で使用）
              'ean_8_reader', // EAN-8
              'upc_reader', // UPC-A
              'upc_e_reader', // UPC-E
            ],
            multiple: false, // 単一のバーコードのみ検出
          },
          locate: true, // バーコードの位置を自動検出
        };

        // Quagga2を初期化
        await new Promise<void>((resolve, reject) => {
          Quagga.init(config, (err) => {
            if (err) {
              console.error('Quagga init error:', err);
              reject(err);
              return;
            }
            resolve();
          });
        });

        if (!isMountedRef.current) {
          Quagga.stop();
          isInitializingRef.current = false;
          return;
        }

        // バーコード検出時のハンドラー
        const onDetected = (result: QuaggaJSResultObject) => {
          if (!isMountedRef.current || disabled) return;

          const code = result.codeResult?.code;
          if (!code) return;

          // 同じバーコードが連続して読み取られた場合は無視
          if (code === lastScannedRef.current) return;

          // 検出精度のチェック（エラー率が高い場合はスキップ）
          const decodedCodes = result.codeResult?.decodedCodes;
          if (decodedCodes) {
            const errors = decodedCodes
              .filter(
                (d: { error?: number }) => d.error !== undefined
              )
              .map((d: { error?: number }) => d.error as number);
            if (errors.length > 0) {
              const avgError =
                errors.reduce(
                  (sum: number, e: number) => sum + e,
                  0
                ) / errors.length;
              // エラー率が高すぎる場合はスキップ（誤検出防止）
              if (avgError > 0.1) {
                console.log(
                  `Skipping scan due to high error rate: ${avgError}`
                );
                return;
              }
            }
          }

          lastScannedRef.current = code;
          console.log('Barcode scanned (Quagga2):', code);

          // コールバックを安全に呼び出す
          try {
            onBarcodeScannedRef.current({ data: code });
            console.log('onBarcodeScanned callback called with:', code);
          } catch (callbackError) {
            console.error('Error in onBarcodeScanned callback:', callbackError);
          }
        };

        // 検出イベントを登録
        Quagga.onDetected(onDetected);

        // スキャン開始
        Quagga.start();
        setIsInitialized(true);
        isInitializingRef.current = false;

        console.log('Quagga2 scanner initialized successfully');
      } catch (err: any) {
        isInitializingRef.current = false;
        if (isMountedRef.current) {
          console.error('Error initializing Quagga2 scanner:', err);
          let errorMessage = 'カメラの初期化に失敗しました';
          if (err?.message?.includes('Permission')) {
            errorMessage = 'カメラのアクセス許可が必要です';
          } else if (
            err?.message?.includes('NotFoundError') ||
            err?.message?.includes('DevicesNotFoundError')
          ) {
            errorMessage = 'カメラが見つかりません';
          }
          setError(errorMessage);
        }
      }
    };

    // DOMが準備できてから初期化
    const timeoutId = setTimeout(() => {
      if (scannerRef.current && isMountedRef.current) {
        initScanner();
      }
    }, 100);

    return () => {
      // マウント状態を更新
      isMountedRef.current = false;
      clearTimeout(timeoutId);

      // Quagga2を停止
      try {
        Quagga.stop();
        Quagga.offDetected();
      } catch (e) {
        console.debug('Error stopping Quagga2:', e);
      }

      setIsInitialized(false);
      isInitializingRef.current = false;
    };
  }, [disabled, isInitialized]);

  // disabledが変更された場合にスキャナーを停止/再開
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    if (disabled && isInitialized) {
      try {
        Quagga.stop();
        setIsInitialized(false);
      } catch (e) {
        console.debug('Error stopping Quagga2:', e);
      }
    }
  }, [disabled, isInitialized]);

  if (Platform.OS !== 'web') {
    return null;
  }

  if (error) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <div
        ref={scannerRef}
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
        }}
      />
      <style>
        {`
          /* Quagga2のビデオ要素のスタイル調整 */
          div[data-quagga] video,
          .drawingBuffer {
            width: 100% !important;
            height: 100% !important;
            object-fit: cover !important;
          }
          /* canvasを非表示（デバッグ用に表示する場合はコメントアウト） */
          canvas.drawingBuffer {
            display: none;
          }
        `}
      </style>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
    padding: 20,
  },
});
