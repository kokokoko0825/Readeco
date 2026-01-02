import { Alert, Platform } from 'react-native';

/**
 * プラットフォームに応じたアラートを表示する
 * Web版ではwindow.alertを使用し、ネイティブ版ではAlert.alertを使用します
 */
export function showAlert(
  title: string,
  message?: string,
  buttons?: Array<{
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
  }>
): void {
  if (Platform.OS === 'web') {
    // Web版ではwindow.alertを使用
    // タイトルとメッセージを組み合わせて表示
    const alertMessage = message ? `${title}\n\n${message}` : title;
    window.alert(alertMessage);
    
    // ボタンがある場合、最初のボタンのonPressを呼び出す（OKボタンとして扱う）
    if (buttons && buttons.length > 0) {
      const firstButton = buttons.find(btn => btn.style !== 'cancel') || buttons[0];
      if (firstButton.onPress) {
        // 非同期で実行される可能性があるため、少し遅延させてから実行
        setTimeout(() => {
          firstButton.onPress?.();
        }, 0);
      }
    }
  } else {
    // ネイティブ版ではAlert.alertを使用
    if (message !== undefined) {
      if (buttons && buttons.length > 0) {
        Alert.alert(title, message, buttons);
      } else {
        Alert.alert(title, message);
      }
    } else {
      Alert.alert(title);
    }
  }
}

