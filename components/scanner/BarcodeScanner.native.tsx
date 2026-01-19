/**
 * バーコードスキャナー - Native版 (iOS/Android)
 * react-native-vision-camera (MLKit/VisionKitベース) を使用
 */

import { VisionCameraBarcodeScanner } from './VisionCameraBarcodeScanner';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  isActive: boolean;
  onPermissionDenied?: () => void;
  resetTrigger?: number;
}

export function BarcodeScanner({ onScan, isActive, onPermissionDenied, resetTrigger }: BarcodeScannerProps) {
  return (
    <VisionCameraBarcodeScanner
      onScan={onScan}
      isActive={isActive}
      onPermissionDenied={onPermissionDenied}
      resetTrigger={resetTrigger}
    />
  );
}
