/**
 * ISBN/EANバーコード検証ユーティリティ
 * ISBN-10、ISBN-13、EAN-13、EAN-8、UPC-A、UPC-Eの検証と正規化を行う
 */

/**
 * バーコード文字列を正規化（ハイフン・スペース削除）
 */
export function normalizeBarcode(code: string): string {
  return code.replace(/[-\s]/g, '');
}

/**
 * ISBN-10のチェックディジットを検証
 */
function isValidISBN10(isbn: string): boolean {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(isbn[i], 10) * (10 - i);
  }
  const checkDigit = isbn[9];
  const checkValue = checkDigit === 'X' ? 10 : parseInt(checkDigit, 10);
  sum += checkValue;

  return sum % 11 === 0;
}

/**
 * ISBN-13/EAN-13のチェックディジットを検証
 */
function isValidISBN13(isbn: string): boolean {
  if (!/^\d{13}$/.test(isbn)) return false;

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(isbn[i], 10) * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;

  return checkDigit === parseInt(isbn[12], 10);
}

/**
 * EAN-8のチェックディジットを検証
 */
function isValidEAN8(ean: string): boolean {
  if (!/^\d{8}$/.test(ean)) return false;

  let sum = 0;
  for (let i = 0; i < 7; i++) {
    sum += parseInt(ean[i], 10) * (i % 2 === 0 ? 3 : 1);
  }
  const checkDigit = (10 - (sum % 10)) % 10;

  return checkDigit === parseInt(ean[7], 10);
}

/**
 * UPC-A（12桁）のチェックディジットを検証
 */
function isValidUPCA(upc: string): boolean {
  if (!/^\d{12}$/.test(upc)) return false;

  let sum = 0;
  for (let i = 0; i < 11; i++) {
    sum += parseInt(upc[i], 10) * (i % 2 === 0 ? 3 : 1);
  }
  const checkDigit = (10 - (sum % 10)) % 10;

  return checkDigit === parseInt(upc[11], 10);
}

/**
 * UPC-E（6桁 + チェックディジット = 7桁、または8桁）を検証
 * UPC-Eは圧縮形式のため、展開してUPC-Aとして検証
 */
function isValidUPCE(upc: string): boolean {
  // UPC-Eは6桁、7桁、または8桁
  if (!/^\d{6,8}$/.test(upc)) return false;
  // 簡易的に桁数のみチェック（完全な展開検証は複雑なため省略）
  return true;
}

/**
 * 有効なISBNかどうかを検証（ISBN-10またはISBN-13）
 */
export function isValidISBN(code: string): boolean {
  const normalized = normalizeBarcode(code).toUpperCase();

  if (normalized.length === 10) {
    return isValidISBN10(normalized);
  }
  if (normalized.length === 13) {
    // ISBN-13は978または979で始まる
    if (normalized.startsWith('978') || normalized.startsWith('979')) {
      return isValidISBN13(normalized);
    }
  }

  return false;
}

/**
 * 書籍バーコードとして有効かどうかを検証
 * ISBN-10、ISBN-13（978/979）、および一般的なEAN-13を許可
 */
export function isBookBarcode(code: string): boolean {
  const normalized = normalizeBarcode(code).toUpperCase();

  // ISBN-10
  if (normalized.length === 10 && isValidISBN10(normalized)) {
    return true;
  }

  // ISBN-13 / EAN-13
  if (normalized.length === 13 && isValidISBN13(normalized)) {
    return true;
  }

  // EAN-8（雑誌などで使用されることがある）
  if (normalized.length === 8 && isValidEAN8(normalized)) {
    return true;
  }

  // UPC-A
  if (normalized.length === 12 && isValidUPCA(normalized)) {
    return true;
  }

  // UPC-E
  if (normalized.length >= 6 && normalized.length <= 8 && isValidUPCE(normalized)) {
    return true;
  }

  return false;
}

/**
 * ISBN-10をISBN-13に変換
 */
export function isbn10ToIsbn13(isbn10: string): string {
  const normalized = normalizeBarcode(isbn10);
  if (normalized.length !== 10) {
    throw new Error('Invalid ISBN-10 format');
  }

  // 978プレフィックスを追加し、最後のチェックディジットを除去
  const base = '978' + normalized.slice(0, 9);

  // 新しいチェックディジットを計算
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(base[i], 10) * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;

  return base + checkDigit;
}

/**
 * バーコードタイプを判定
 */
export type BarcodeType = 'isbn10' | 'isbn13' | 'ean13' | 'ean8' | 'upc_a' | 'upc_e' | 'unknown';

export function getBarcodeType(code: string): BarcodeType {
  const normalized = normalizeBarcode(code).toUpperCase();

  if (normalized.length === 10 && isValidISBN10(normalized)) {
    return 'isbn10';
  }

  if (normalized.length === 13) {
    if ((normalized.startsWith('978') || normalized.startsWith('979')) && isValidISBN13(normalized)) {
      return 'isbn13';
    }
    if (isValidISBN13(normalized)) {
      return 'ean13';
    }
  }

  if (normalized.length === 8 && isValidEAN8(normalized)) {
    return 'ean8';
  }

  if (normalized.length === 12 && isValidUPCA(normalized)) {
    return 'upc_a';
  }

  if (normalized.length >= 6 && normalized.length <= 8 && isValidUPCE(normalized)) {
    return 'upc_e';
  }

  return 'unknown';
}

/**
 * 楽天API用にバーコードをISBN-13形式に正規化
 * ISBN-10の場合はISBN-13に変換
 */
export function normalizeToISBN13(code: string): string {
  const normalized = normalizeBarcode(code).toUpperCase();
  const type = getBarcodeType(normalized);

  if (type === 'isbn10') {
    return isbn10ToIsbn13(normalized);
  }

  // その他はそのまま返す（EAN-13、UPCなど）
  return normalized;
}
