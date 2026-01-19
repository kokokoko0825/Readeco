/**
 * バーコードスキャナー - Web版
 * html5-qrcode を使用
 */

import { WebBarcodeScanner } from './WebBarcodeScanner';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  isActive: boolean;
  onPermissionDenied?: () => void;
  resetTrigger?: number;
}

export function BarcodeScanner({ onScan, isActive, resetTrigger }: BarcodeScannerProps) {
  return <WebBarcodeScanner onScan={onScan} isActive={isActive} resetTrigger={resetTrigger} />;
}
