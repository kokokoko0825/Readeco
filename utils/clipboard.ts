import { Platform } from 'react-native';

/**
 * クリップボードにテキストをコピーする
 * Web環境ではブラウザのClipboard APIを使用し、
 * ネイティブ環境ではexpo-clipboardを使用します
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      // Web環境ではブラウザのClipboard APIを使用
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      } else if (typeof document !== 'undefined') {
        // フォールバック: テキストエリアを使用してコピー
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          const successful = document.execCommand('copy');
          document.body.removeChild(textArea);
          return successful;
        } catch (err) {
          document.body.removeChild(textArea);
          console.error('Fallback copy failed:', err);
          return false;
        }
      }
      return false;
    } else {
      // ネイティブ環境ではexpo-clipboardを使用
      // 動的インポートを使用してWeb環境ではバンドルされないようにする
      const Clipboard = await import('expo-clipboard');
      await Clipboard.setStringAsync(text);
      return true;
    }
  } catch (error) {
    console.error('Error copying to clipboard:', error);
    return false;
  }
}

