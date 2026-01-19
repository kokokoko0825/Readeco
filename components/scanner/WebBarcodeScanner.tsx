/**
 * Web用バーコードスキャナーコンポーネント
 * BarcodeDetector API（ネイティブ）を優先使用
 * 非対応ブラウザ（Safari等）ではQuagga2にフォールバック
 */

import Quagga from '@ericblade/quagga2';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface WebBarcodeScannerProps {
  onScan: (barcode: string) => void;
  isActive: boolean;
  resetTrigger?: number;
}

// BarcodeDetector APIの型定義
interface BarcodeDetectorOptions {
  formats: string[];
}

interface DetectedBarcode {
  rawValue: string;
  format: string;
}

declare class BarcodeDetector {
  constructor(options?: BarcodeDetectorOptions);
  detect(image: ImageBitmapSource): Promise<DetectedBarcode[]>;
  static getSupportedFormats(): Promise<string[]>;
}

const SCANNER_ID = 'barcode-scanner';
const QUAGGA_CONTAINER_ID = 'quagga-container';

// BarcodeDetector APIが利用可能かチェック
const isBarcodeDetectorSupported = (): boolean => {
  return 'BarcodeDetector' in window;
};

// ISBNバーコードかどうかを判定
const isISBNBarcode = (code: string): boolean => {
  const normalized = code.replace(/[-\s]/g, '');
  return normalized.length === 13 && (normalized.startsWith('978') || normalized.startsWith('979'));
};

// Quagga2用のスタイルを注入
const injectQuaggaStyles = () => {
  const styleId = 'quagga-styles';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    #${QUAGGA_CONTAINER_ID} {
      width: 100%;
      height: 100%;
      position: relative;
      overflow: hidden;
    }
    #${QUAGGA_CONTAINER_ID} video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    #${QUAGGA_CONTAINER_ID} canvas {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    }
    #${QUAGGA_CONTAINER_ID} canvas.drawingBuffer {
      display: none;
    }
  `;
  document.head.appendChild(style);
};

export function WebBarcodeScanner({ onScan, isActive, resetTrigger }: WebBarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetector | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastScannedRef = useRef<string>('');
  const isMountedRef = useRef(true);
  const scannerModeRef = useRef<'native' | 'quagga' | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [scannerMode, setScannerMode] = useState<'native' | 'quagga' | null>(null);

  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  // resetTriggerが変わったらlastScannedRefをリセット（連続スキャン用）
  useEffect(() => {
    if (resetTrigger !== undefined) {
      lastScannedRef.current = '';
    }
  }, [resetTrigger]);

  // BarcodeDetector APIを使用したスキャン
  const initNativeScanner = async () => {
    try {
      // サポートされているフォーマットを確認
      const supportedFormats = await BarcodeDetector.getSupportedFormats();
      if (!supportedFormats.includes('ean_13')) {
        return false;
      }

      // BarcodeDetectorを初期化
      detectorRef.current = new BarcodeDetector({ formats: ['ean_13'] });

      // カメラを起動
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) return false;

      video.srcObject = stream;
      await video.play();

      scannerModeRef.current = 'native';
      setScannerMode('native');
      setIsInitialized(true);

      // 検出ループ
      const detectLoop = async () => {
        if (!isMountedRef.current || !detectorRef.current || !video) return;

        try {
          const barcodes = await detectorRef.current.detect(video);

          for (const barcode of barcodes) {
            const code = barcode.rawValue;
            if (!code) continue;

            // ISBNバーコードのみ処理
            if (!isISBNBarcode(code)) continue;

            // 同じコードの連続スキャンを防止
            if (code === lastScannedRef.current) continue;

            lastScannedRef.current = code;
            onScanRef.current(code);

            // 検出後、少し待機してから次の検出へ
            await new Promise(resolve => setTimeout(resolve, 1000));
            break;
          }
        } catch {
          // 検出エラーは無視（フレームがまだ準備できていない場合など）
        }

        // 次のフレームで再度検出
        if (isMountedRef.current) {
          animationRef.current = requestAnimationFrame(detectLoop);
        }
      };

      // 検出開始
      detectLoop();
      return true;

    } catch {
      return false;
    }
  };

  // Quagga2を使用したスキャン（フォールバック）
  const initQuaggaScanner = async () => {
    try {
      // Quagga用のスタイルを注入
      injectQuaggaStyles();

      // まずQuaggaモードに切り替えてDOMを更新
      scannerModeRef.current = 'quagga';
      setScannerMode('quagga');

      // DOMが更新されるのを待つ
      await new Promise(resolve => setTimeout(resolve, 100));

      const container = document.getElementById(QUAGGA_CONTAINER_ID);
      if (!container) {
        throw new Error('Quagga container not found');
      }

      await new Promise<void>((resolve, reject) => {
        Quagga.init(
          {
            inputStream: {
              name: 'Live',
              type: 'LiveStream',
              target: container,
              constraints: {
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
            },
            decoder: {
              readers: ['ean_reader'],
            },
            locate: true,
            frequency: 10,
          },
          (err: Error | null) => {
            if (err) {
              reject(err);
              return;
            }
            resolve();
          }
        );
      });

      Quagga.start();

      Quagga.onDetected((result: { codeResult?: { code?: string } }) => {
        if (!isMountedRef.current) return;

        const code = result.codeResult?.code;
        if (!code) return;

        // ISBNバーコードのみ処理
        if (!isISBNBarcode(code)) return;

        // 同じコードの連続スキャンを防止
        if (code === lastScannedRef.current) return;

        lastScannedRef.current = code;
        onScanRef.current(code);
      });

      setIsInitialized(true);
      return true;

    } catch (err) {
      console.error('Quagga init error:', err);
      return false;
    }
  };

  useEffect(() => {
    isMountedRef.current = true;

    const initScanner = async () => {
      // BarcodeDetector APIが利用可能な場合は優先使用
      if (isBarcodeDetectorSupported()) {
        const nativeSuccess = await initNativeScanner();
        if (nativeSuccess) return;
      }

      // BarcodeDetector APIが使えない場合はQuagga2にフォールバック
      const quaggaSuccess = await initQuaggaScanner();
      if (!quaggaSuccess) {
        setError('バーコードスキャナーの初期化に失敗しました');
      }
    };

    const timeoutId = setTimeout(initScanner, 300);

    return () => {
      isMountedRef.current = false;
      clearTimeout(timeoutId);

      // Native scanner cleanup
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      // Quagga cleanup
      if (scannerModeRef.current === 'quagga') {
        try {
          Quagga.offDetected();
          Quagga.stop();
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, []);

  useEffect(() => {
    if (!isActive) {
      lastScannedRef.current = '';
    }
  }, [isActive]);

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorHint}>ページを再読み込みしてください</Text>
        </View>
      </View>
    );
  }

  // Quagga2モードの場合
  if (scannerMode === 'quagga') {
    return (
      <View style={styles.container}>
        <div
          id={QUAGGA_CONTAINER_ID}
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
            overflow: 'hidden',
          }}
        />
        {!isInitialized && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>カメラを起動中...</Text>
          </View>
        )}
        {isInitialized && (
          <View style={styles.scanGuideOverlay} pointerEvents="none">
            <View style={styles.scanGuideBox}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
            <Text style={styles.guideText}>上段のバーコード(978...)を枠内に合わせてください</Text>
          </View>
        )}
      </View>
    );
  }

  // BarcodeDetector APIモードの場合（デフォルト）
  return (
    <View style={styles.container}>
      <video
        ref={videoRef}
        id={SCANNER_ID}
        playsInline
        muted
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
      {!isInitialized && (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>カメラを起動中...</Text>
        </View>
      )}
      {isInitialized && (
        <View style={styles.scanGuideOverlay} pointerEvents="none">
          <View style={styles.scanGuideBox}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          <Text style={styles.guideText}>上段のバーコード(978...)を枠内に合わせてください</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
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
    marginBottom: 12,
  },
  errorHint: {
    color: '#aaa',
    textAlign: 'center',
    fontSize: 14,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
  },
  scanGuideOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanGuideBox: {
    width: 300,
    height: 80,
    position: 'relative',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 8,
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#4CAF50',
  },
  topLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 8,
  },
  guideText: {
    color: '#fff',
    fontSize: 14,
    marginTop: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
  },
});
