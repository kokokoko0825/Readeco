/**
 * VisionCamera バーコードスキャナーコンポーネント
 * react-native-vision-camera v4 の CodeScanner API を使用
 * MLKit (Android) / VisionKit (iOS) ベースで高精度なバーコード認識
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
  type Code,
} from 'react-native-vision-camera';

interface VisionCameraBarcodeScannerProps {
  onScan: (barcode: string) => void;
  isActive: boolean;
  onPermissionDenied?: () => void;
  resetTrigger?: number;
}

export function VisionCameraBarcodeScanner({
  onScan,
  isActive,
  onPermissionDenied,
  resetTrigger,
}: VisionCameraBarcodeScannerProps) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const [isInitialized, setIsInitialized] = useState(false);

  const lastScannedRef = useRef<string>('');
  const onScanRef = useRef(onScan);
  const isActiveRef = useRef(isActive);

  // コールバックを最新に保つ
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  // isActiveの最新値をrefに保持
  useEffect(() => {
    isActiveRef.current = isActive;
    // isActiveがfalseになったらリセット
    if (!isActive) {
      lastScannedRef.current = '';
    }
  }, [isActive]);

  // resetTriggerが変わったらlastScannedRefをリセット（連続スキャン用）
  useEffect(() => {
    if (resetTrigger !== undefined) {
      console.log('Reset trigger changed, clearing lastScannedRef');
      lastScannedRef.current = '';
    }
  }, [resetTrigger]);

  // CodeScanner設定（依存配列を空にしてスキャナーの再初期化を防ぐ）
  const codeScanner = useCodeScanner({
    codeTypes: ['ean-13', 'ean-8', 'upc-a', 'upc-e'],
    onCodeScanned: useCallback(
      (codes: Code[]) => {
        if (!isActiveRef.current || codes.length === 0) return;

        const code = codes[0];
        const value = code.value;

        if (!value) return;

        // 同じバーコードの連続読み取りを防止
        if (value === lastScannedRef.current) return;

        lastScannedRef.current = value;
        console.log('VisionCamera barcode scanned:', value, 'type:', code.type);
        onScanRef.current(value);
      },
      []
    ),
  });

  // 初回マウント時に権限リクエスト
  useEffect(() => {
    const initCamera = async () => {
      if (hasPermission === false) {
        await requestPermission();
      }
      setIsInitialized(true);
    };
    initCamera();
  }, [hasPermission, requestPermission]);

  // カメラエラーハンドラー
  const handleError = useCallback((error: Error) => {
    console.error('VisionCamera error:', error);
  }, []);

  // カメラ初期化完了ハンドラー
  const handleInitialized = useCallback(() => {
    console.log('VisionCamera initialized');
  }, []);

  // 初期化中
  if (!isInitialized) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.statusText}>カメラを初期化中...</Text>
      </View>
    );
  }

  // デバイスがない場合
  if (!device) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionTitle}>カメラが見つかりません</Text>
          <Text style={styles.permissionText}>
            このデバイスにはカメラがないか、利用できない状態です
          </Text>
          {onPermissionDenied && (
            <Pressable
              style={[styles.permissionButton, styles.secondaryButton]}
              onPress={onPermissionDenied}
            >
              <Text style={styles.permissionButtonText}>閉じる</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  // 権限がない場合
  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionTitle}>カメラの権限が必要です</Text>
          <Text style={styles.permissionText}>
            バーコードをスキャンするにはカメラの権限が必要です
          </Text>
          <Pressable style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>権限を許可する</Text>
          </Pressable>
          {onPermissionDenied && (
            <Pressable
              style={[styles.permissionButton, styles.secondaryButton]}
              onPress={onPermissionDenied}
            >
              <Text style={styles.permissionButtonText}>閉じる</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive}
        codeScanner={codeScanner}
        onError={handleError}
        onInitialized={handleInitialized}
        enableZoomGesture={false}
        torch="off"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
  permissionContainer: {
    padding: 24,
    alignItems: 'center',
  },
  permissionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionText: {
    color: '#ccc',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: '#838A2D',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 8,
  },
  secondaryButton: {
    backgroundColor: '#666',
    marginTop: 12,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
