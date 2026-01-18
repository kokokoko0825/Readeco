/**
 * バーコードスキャナー - Web版
 * html5-qrcode を使用
 */

import { WebBarcodeScanner } from './WebBarcodeScanner';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  isActive: boolean;
  onPermissionDenied?: () => void;
}

export function BarcodeScanner({ onScan, isActive }: BarcodeScannerProps) {
  return <WebBarcodeScanner onScan={onScan} isActive={isActive} />;
}
