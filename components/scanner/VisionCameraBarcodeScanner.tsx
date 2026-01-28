/**
 * Expo Camera ベースのバーコードスキャナーコンポーネント
 * Expo Go でも動作するように、react-native-vision-camera ではなく
 * expo-camera の CameraView / バーコードスキャン機能を利用する。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from 'expo-camera';

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
  const [permission, requestPermission] = useCameraPermissions();
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

  // Expo Camera のバーコードコールバック
  const handleBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (!isActiveRef.current) return;

      const value = result.data;
      if (!value) return;

      // 同じバーコードの連続読み取りを防止
      if (value === lastScannedRef.current) return;

      lastScannedRef.current = value;
      console.log('ExpoCamera barcode scanned:', value, 'type:', result.type);
      onScanRef.current(value);
    },
    []
  );

  // 初回マウント時に権限リクエスト
  useEffect(() => {
    const initCamera = async () => {
      if (permission?.granted === false) {
        await requestPermission();
      }
      setIsInitialized(true);
    };
    initCamera();
  }, [permission?.granted, requestPermission]);

  // 初期化中
  if (!isInitialized) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.statusText}>カメラを初期化中...</Text>
      </View>
    );
  }

  // 権限がない場合
  if (!permission || !permission.granted) {
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
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        // expo-camera 側のバーコードタイプ指定（ISBN で使う EAN/UPC 系を許可）
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'],
        }}
        // 非アクティブ時はスキャンを止める
        onBarcodeScanned={isActive ? handleBarcodeScanned : undefined}
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
