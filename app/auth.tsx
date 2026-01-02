/**
 * 認証画面（サインアップ・サインイン）
 */

import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View
} from 'react-native';

import { Icon } from '@/components/Icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { showAlert } from '@/utils/alert';
import { signIn, signInWithGoogle, signUp } from '@/utils/firebase-auth';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

// WebBrowserを完了させる（Google認証用）
WebBrowser.maybeCompleteAuthSession();

export default function AuthScreen() {
  const colorScheme = useColorScheme();
  const { user, loading: authLoading } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Google認証の設定
  // 注意: Firebase ConsoleでOAuth 2.0クライアントIDを設定する必要があります
  // Web Client IDはFirebase Console > Authentication > Sign-in method > Google > Web SDK configuration から取得
  const googleAuthConfig = useMemo(() => {
    const config: Google.GoogleAuthRequestConfig = {};
    
    // プラットフォームに応じてクライアントIDを設定
    const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
    const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
    const expoClientId = process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID;
    
    // リダイレクトURIを設定（Expo開発環境用）
    // exp://localhost:8081 や exp://192.168.0.22:8081 などの形式
    // 注意: Google Cloud ConsoleでこれらのリダイレクトURIを許可する必要があります
    if (Platform.OS !== 'web') {
      // 開発環境のリダイレクトURIを設定
      // expo-auth-sessionが自動的に設定してくれますが、明示的に設定することも可能
      // config.redirectUri = Linking.createURL('/', { scheme: 'exp' });
    }

    // iOSの場合、iosClientIdが必須
    if (Platform.OS === 'ios') {
      if (iosClientId) {
        config.iosClientId = iosClientId;
        if (webClientId) config.webClientId = webClientId;
        if (expoClientId) config.expoClientId = expoClientId;
      }
    }
    // Androidの場合、androidClientIdが推奨
    else if (Platform.OS === 'android') {
      if (androidClientId) {
        config.androidClientId = androidClientId;
        if (webClientId) config.webClientId = webClientId;
        if (expoClientId) config.expoClientId = expoClientId;
      }
    }
    // Webの場合、webClientIdが必須
    else {
      if (webClientId) {
        config.webClientId = webClientId;
      }
    }

    return config;
  }, []);

  // Google認証が有効かどうか（必要なクライアントIDが設定されているか）
  const isGoogleAuthEnabled = useMemo(() => {
    if (Platform.OS === 'ios') {
      return !!process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
    } else if (Platform.OS === 'android') {
      return !!process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
    } else {
      return !!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    }
  }, []);

  // Google認証の設定
  // 注意: React Hooksのルールにより、条件付きでフックを呼び出すことはできません
  // そのため、設定が不完全な場合でもuseAuthRequestを呼び出しますが、
  // 実際の使用時にはisGoogleAuthEnabledでチェックします
  // iOSで実行している場合、iosClientIdが必須なので、設定されていない場合は
  // 空のオブジェクトではなく、最小限の設定を渡します
  // 注意: useAuthRequestは常に呼び出す必要があるため、設定が不完全な場合でも呼び出します
  const finalConfig = useMemo(() => {
    if (isGoogleAuthEnabled) {
      return googleAuthConfig;
    }
    // 設定が不完全な場合、プラットフォームに応じた最小限の設定を渡します
    // iOSの場合、iosClientIdが必須なので、空文字列を渡します（実際の使用時にはisGoogleAuthEnabledでチェック）
    if (Platform.OS === 'ios') {
      return {
        iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || 'dummy-ios-client-id',
        webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || 'dummy-web-client-id',
      };
    } else if (Platform.OS === 'android') {
      return {
        androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || 'dummy-android-client-id',
        webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || 'dummy-web-client-id',
      };
    } else {
      return {
        webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || 'dummy-web-client-id',
      };
    }
  }, [isGoogleAuthEnabled, googleAuthConfig]);
  
  const [request, response, promptAsync] = Google.useAuthRequest(finalConfig);

  // 認証済みの場合はメイン画面にリダイレクト
  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/(tabs)');
    }
  }, [user, authLoading]);

  // Google認証のレスポンスを処理
  useEffect(() => {
    if (response?.type === 'success') {
      handleGoogleSignIn(response.authentication);
    } else if (response?.type === 'error') {
      console.error('Google auth error:', response.error);
      showAlert('エラー', 'Google認証に失敗しました');
      setGoogleLoading(false);
    }
  }, [response]);

  const handleGoogleSignIn = async (authentication: any) => {
    if (!authentication?.idToken) {
      showAlert('エラー', '認証情報の取得に失敗しました');
      setGoogleLoading(false);
      return;
    }

    try {
      await signInWithGoogle(authentication.idToken, authentication.accessToken);
      // 認証成功後、自動的にメイン画面に遷移
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Google sign in error:', error);
      showAlert('エラー', error instanceof Error ? error.message : 'Google認証に失敗しました');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleSignInPress = async () => {
    // クライアントIDが設定されていない場合
    if (!isGoogleAuthEnabled) {
      showAlert(
        '設定が必要です',
        `Google認証を使用するには、環境変数にGoogle Client IDを設定してください。\n\n${
          Platform.OS === 'ios'
            ? 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID'
            : Platform.OS === 'android'
            ? 'EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID'
            : 'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'
        }を設定してください。\n\n詳細はGOOGLE_AUTH_SETUP.mdを参照してください。`
      );
      return;
    }

    try {
      setGoogleLoading(true);
      const result = await promptAsync();
      if (result.type === 'cancel') {
        setGoogleLoading(false);
      }
    } catch (error) {
      console.error('Error prompting Google auth:', error);
      showAlert('エラー', 'Google認証の開始に失敗しました');
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      showAlert('エラー', 'メールアドレスとパスワードを入力してください');
      return;
    }

    if (isSignUp && !displayName.trim()) {
      showAlert('エラー', '表示名を入力してください');
      return;
    }

    if (password.length < 6) {
      showAlert('エラー', 'パスワードは6文字以上で入力してください');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        await signUp(email.trim(), password, displayName.trim());
        showAlert('成功', 'アカウントを作成しました', [
          {
            text: 'OK',
            onPress: () => {
              // 認証成功後、自動的にメイン画面に遷移
              router.replace('/(tabs)');
            },
          },
        ]);
      } else {
        await signIn(email.trim(), password);
        // 認証成功後、自動的にメイン画面に遷移
        router.replace('/(tabs)');
      }
    } catch (error) {
      console.error('Auth error:', error);
      showAlert('エラー', error instanceof Error ? error.message : '認証に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 認証状態の読み込み中
  if (authLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].text} />
          <ThemedText style={styles.loadingText}>読み込み中...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  // 認証済みの場合は何も表示しない（リダイレクト処理中）
  if (user) {
    return null;
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Image
              source={require('@/public/images/Logo.svg')}
              style={{ width: 80, height: 80 }}
              resizeMode="contain"
            />
            <ThemedText style={styles.title}>Readeco</ThemedText>
            <ThemedText style={styles.subtitle}>
              {isSignUp ? 'アカウントを作成' : 'ログイン'}
            </ThemedText>
          </View>

          <View style={styles.form}>
            {isSignUp && (
              <View style={styles.inputContainer}>
                <ThemedText style={styles.label}>表示名</ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    { color: Colors[colorScheme ?? 'light'].text, borderColor: '#E0E0E0' },
                  ]}
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="表示名を入力"
                  placeholderTextColor="#999"
                  autoCapitalize="words"
                />
              </View>
            )}

            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>メールアドレス</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { color: Colors[colorScheme ?? 'light'].text, borderColor: '#E0E0E0' },
                ]}
                value={email}
                onChangeText={setEmail}
                placeholder="メールアドレスを入力"
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>

            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>パスワード</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { color: Colors[colorScheme ?? 'light'].text, borderColor: '#E0E0E0' },
                ]}
                value={password}
                onChangeText={setPassword}
                placeholder="パスワードを入力（6文字以上）"
                placeholderTextColor="#999"
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
              />
            </View>

            <Pressable
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.submitButtonText}>
                  {isSignUp ? 'サインアップ' : 'サインイン'}
                </ThemedText>
              )}
            </Pressable>

            <Pressable
              style={styles.switchButton}
              onPress={() => {
                setIsSignUp(!isSignUp);
                setEmail('');
                setPassword('');
                setDisplayName('');
              }}>
              <ThemedText style={styles.switchButtonText}>
                {isSignUp
                  ? '既にアカウントをお持ちの方はこちら'
                  : 'アカウントをお持ちでない方はこちら'}
              </ThemedText>
            </Pressable>

            {/* Google認証ボタン（設定されている場合のみ表示） */}
            {isGoogleAuthEnabled && (
              <>
                {/* 区切り線 */}
                <View style={styles.dividerContainer}>
                  <View style={styles.divider} />
                  <ThemedText style={styles.dividerText}>または</ThemedText>
                  <View style={styles.divider} />
                </View>

                <Pressable
                  style={[styles.googleButton, googleLoading && styles.googleButtonDisabled]}
                  onPress={handleGoogleSignInPress}
                  disabled={googleLoading || loading}>
                  {googleLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Icon name="google" size={20} color="#fff" style={styles.googleIcon} />
                      <ThemedText style={styles.googleButtonText}>
                        Googleで{isSignUp ? 'サインアップ' : 'サインイン'}
                      </ThemedText>
                    </>
                  )}
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    opacity: 0.7,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  submitButton: {
    backgroundColor: '#838A2D',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  switchButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  switchButtonText: {
    fontSize: 14,
    opacity: 0.7,
    textDecorationLine: 'underline',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    opacity: 0.6,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4285F4',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 8,
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleIcon: {
    marginRight: 8,
  },
  googleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

