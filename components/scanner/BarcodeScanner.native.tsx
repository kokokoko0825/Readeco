/**
 * バーコードスキャナー - Native版 (iOS/Android)
 * react-native-vision-camera (MLKit/VisionKitベース) を使用
 */

import { VisionCameraBarcodeScanner } from './VisionCameraBarcodeScanner';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  isActive: boolean;
  onPermissionDenied?: () => void;
}

export function BarcodeScanner({ onScan, isActive, onPermissionDenied }: BarcodeScannerProps) {
  return (
    <VisionCameraBarcodeScanner
      onScan={onScan}
      isActive={isActive}
      onPermissionDenied={onPermissionDenied}
    />
  );
}
