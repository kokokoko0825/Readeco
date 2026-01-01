import { ThemedText } from '@/components/themed-text';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

// Web専用のバーコードスキャンコンポーネント
// @zxing/libraryを使用してWebでISBNバーコード（EAN-13、EAN-8、UPC-A、UPC-E）をスキャン
export function WebBarcodeScanner({
  onBarcodeScanned,
  style,
  disabled,
}: {
  onBarcodeScanned: (result: { data: string }) => void;
  style?: any;
  disabled?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const codeReaderRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutIdsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const isMountedRef = useRef<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const lastScannedRef = useRef<string>('');
  const onBarcodeScannedRef = useRef(onBarcodeScanned);

  // コールバックを最新のものに更新
  useEffect(() => {
    onBarcodeScannedRef.current = onBarcodeScanned;
  }, [onBarcodeScanned]);

  useEffect(() => {
    if (Platform.OS !== 'web' || disabled) return;

    isMountedRef.current = true;
    abortControllerRef.current = new AbortController();
    const abortSignal = abortControllerRef.current.signal;

    const initScanner = async () => {
      try {
        // @zxing/libraryを動的にインポート
        const { 
          BrowserMultiFormatReader, 
          MultiFormatReader,
          BarcodeFormat, 
          DecodeHintType,
          HTMLCanvasElementLuminanceSource,
          BinaryBitmap,
          HybridBinarizer,
        } = await import('@zxing/library');
        
        if (!isMountedRef.current || abortSignal.aborted || !videoRef.current || !canvasRef.current) return;

        // バーコード形式のヒントを設定（ISBN用：EAN-13、EAN-8、UPC-A、UPC-E）
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);

        // BrowserMultiFormatReaderはカメラデバイスの取得に使用
        const browserReader = new BrowserMultiFormatReader(hints);
        
        // MultiFormatReaderは実際のデコードに使用
        const codeReader = new MultiFormatReader();
        codeReader.setHints(hints);
        
        codeReaderRef.current = { codeReader, HTMLCanvasElementLuminanceSource, BinaryBitmap, HybridBinarizer, hints, browserReader };

        // カメラデバイスを取得
        const devices = await browserReader.listVideoInputDevices();
        
        // バックカメラ（外カメラ）を探す
        // ラベルに "back", "rear", "environment", "後", "背面" などのキーワードが含まれるものを優先
        let backCamera = devices.find(device => {
          const label = device.label.toLowerCase();
          return label.includes('back') || 
                 label.includes('rear') || 
                 label.includes('environment') ||
                 label.includes('後') ||
                 label.includes('背面') ||
                 label.includes('外');
        });

        // バックカメラが見つからない場合は、facingModeで指定
        // それでも見つからない場合は最初のデバイスを使用
        const videoConstraints: any = {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        };

        if (backCamera) {
          // バックカメラが見つかった場合はdeviceIdを指定
          videoConstraints.deviceId = { exact: backCamera.deviceId };
        } else {
          // バックカメラが見つからない場合はfacingModeで指定
          videoConstraints.facingMode = 'environment';
        }

        // カメラストリームを開始
        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
        });

        if (!isMountedRef.current || abortSignal.aborted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        streamRef.current = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.setAttribute('autoplay', 'true');
          videoRef.current.setAttribute('muted', 'true');
          
          try {
            await videoRef.current.play();
          } catch (playError: any) {
            // "The operation was aborted"エラーは無視
            if (playError?.name === 'AbortError' || playError?.message === 'The operation was aborted') {
              console.debug('Video play was aborted, ignoring');
              return;
            }
            throw playError;
          }
        }

        if (!isMountedRef.current || abortSignal.aborted) return;

        // バーコードスキャンのループ（requestAnimationFrameを使用）
        let isScanning = false;
        let scanCount = 0;
        const scanBarcode = async () => {
          if (!isMountedRef.current || abortSignal.aborted || !videoRef.current || !canvasRef.current || disabled || isScanning) {
            if (isMountedRef.current && !abortSignal.aborted) {
              animationFrameRef.current = requestAnimationFrame(scanBarcode);
            }
            return;
          }

          const video = videoRef.current;
          const canvas = canvasRef.current;
          const readerData = codeReaderRef.current;

          if (!readerData) {
            if (isMountedRef.current && !abortSignal.aborted) {
              animationFrameRef.current = requestAnimationFrame(scanBarcode);
            }
            return;
          }

          // ビデオの準備状態を確認
          if (video.readyState !== video.HAVE_ENOUGH_DATA || video.videoWidth === 0 || video.videoHeight === 0) {
            if (isMountedRef.current && !abortSignal.aborted) {
              animationFrameRef.current = requestAnimationFrame(scanBarcode);
            }
            return;
          }

          const context = canvas.getContext('2d', { willReadFrequently: true });
          if (!context) {
            if (isMountedRef.current && !abortSignal.aborted) {
              animationFrameRef.current = requestAnimationFrame(scanBarcode);
            }
            return;
          }

          try {
            isScanning = true;

            // ビデオフレームをキャンバスに描画
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);

            // デバッグ用：定期的にログを出力
            scanCount++;
            if (scanCount % 30 === 0) {
              console.debug(`Scanning... (${scanCount} frames)`);
            }

            // バーコードをデコード（BinaryBitmapを使用）
            const { codeReader, HTMLCanvasElementLuminanceSource, BinaryBitmap, HybridBinarizer } = readerData;
            
            // CanvasからLuminanceSourceを作成
            const luminanceSource = new HTMLCanvasElementLuminanceSource(canvas);
            const hybridBinarizer = new HybridBinarizer(luminanceSource);
            const binaryBitmap = new BinaryBitmap(hybridBinarizer);
            
            // デコードを実行（同期実行）
            const result = codeReader.decode(binaryBitmap);

            if (!isMountedRef.current || abortSignal.aborted) return;

            // MultiFormatReaderのdecodeはResultオブジェクトを返す
            if (result && result.getText) {
              const scannedText = result.getText();
              
              // 同じバーコードが連続して読み取られた場合は無視
              if (scannedText && scannedText !== lastScannedRef.current && !disabled && isMountedRef.current && !abortSignal.aborted) {
                lastScannedRef.current = scannedText;
                console.log('Barcode scanned:', scannedText);
                
                // コールバックを安全に呼び出す（最新のコールバック参照を使用）
                try {
                  onBarcodeScannedRef.current({ data: scannedText });
                  console.log('onBarcodeScanned callback called with:', scannedText);
                } catch (callbackError) {
                  console.error('Error in onBarcodeScanned callback:', callbackError);
                }
              }
            }
          } catch (err: any) {
            // バーコードが見つからない場合はエラーを無視（継続的にスキャンするため）
            const errorName = err?.name || '';
            const errorMessage = err?.message || '';
            
            // "The operation was aborted"やAbortErrorは無視
            if (
              errorName === 'AbortError' ||
              errorMessage === 'The operation was aborted' ||
              errorMessage === 'Aborted' ||
              errorName === 'NotFoundException' || 
              errorName === 'NoQRCodeFoundException' ||
              errorMessage === 'Timeout' ||
              errorMessage.includes('No QR code') ||
              errorMessage.includes('not found')
            ) {
              // 正常なエラー（バーコードが見つからない、または処理が中断された）は無視
            } else {
              // その他のエラーはログに記録（最初の数回のみ詳細を出力）
              if (scanCount <= 10) {
                console.warn('Barcode scan error:', errorName, errorMessage, err);
              }
            }
          } finally {
            isScanning = false;
            // 次のフレームをスケジュール（適度な間隔を保つ）
            if (isMountedRef.current && !abortSignal.aborted) {
              animationFrameRef.current = requestAnimationFrame(scanBarcode);
            }
          }
        };

        // ビデオが読み込まれたらスキャンを開始
        const startScanning = () => {
          if (!isMountedRef.current || abortSignal.aborted) return;
          
          if (videoRef.current && videoRef.current.readyState >= videoRef.current.HAVE_METADATA) {
            scanBarcode();
          } else if (isMountedRef.current && !abortSignal.aborted) {
            // まだ準備できていない場合は少し待つ
            const timeoutId = setTimeout(startScanning, 100);
            timeoutIdsRef.current.add(timeoutId);
          }
        };

        if (videoRef.current && isMountedRef.current && !abortSignal.aborted) {
          const handleLoadedMetadata = () => {
            if (isMountedRef.current && !abortSignal.aborted) {
              startScanning();
            }
          };
          const handlePlaying = () => {
            if (isMountedRef.current && !abortSignal.aborted) {
              startScanning();
            }
          };
          
          videoRef.current.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
          videoRef.current.addEventListener('playing', handlePlaying, { once: true });
          
          // 既に読み込まれている場合
          if (videoRef.current.readyState >= videoRef.current.HAVE_METADATA) {
            startScanning();
          }
        }
      } catch (err: any) {
        // "The operation was aborted"エラーは無視
        if (err?.name === 'AbortError' || err?.message === 'The operation was aborted') {
          console.debug('Scanner initialization was aborted, ignoring');
          return;
        }
        
        if (isMountedRef.current) {
          console.error('Error initializing barcode scanner:', err);
          setError(err instanceof Error ? err.message : 'カメラの初期化に失敗しました');
        }
      }
    };

    initScanner();

    return () => {
      // マウント状態を更新
      isMountedRef.current = false;
      
      // AbortControllerで非同期処理を中断
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      // アニメーションフレームをキャンセル
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      // すべてのタイマーをクリーンアップ
      timeoutIdsRef.current.forEach(timeoutId => {
        clearTimeout(timeoutId);
      });
      timeoutIdsRef.current.clear();
      
      // ストリームを停止
      const stream = streamRef.current;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // videoRef.currentを変数にコピーして使用（クリーンアップ関数実行時の変更に対応）
      const video = videoRef.current;
      if (video) {
        try {
          video.srcObject = null;
          video.pause();
        } catch (e) {
          // エラーは無視（既にクリーンアップ済みの可能性がある）
          console.debug('Error cleaning up video:', e);
        }
      }

      // コードリーダーをリセット
      const readerData = codeReaderRef.current;
      if (readerData) {
        try {
          if (readerData.codeReader) {
            readerData.codeReader.reset();
          }
          if (readerData.browserReader) {
            readerData.browserReader.reset();
          }
        } catch (e) {
          // エラーは無視
          console.debug('Error resetting code reader:', e);
        }
        codeReaderRef.current = null;
      }
    };
  }, [disabled]); // onBarcodeScannedは依存配列から除外（useCallbackでラップされることを想定）

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
      <video
        ref={videoRef}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
        playsInline
        autoPlay
        muted
      />
      <canvas
        ref={canvasRef}
        style={{
          display: 'none',
        }}
      />
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

