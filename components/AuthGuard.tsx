/**
 * 認証ガードコンポーネント
 * 認証されていない場合は認証画面にリダイレクト
 */

import { useEffect } from 'react';
import { router, usePathname } from 'expo-router';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const colorScheme = useColorScheme();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      // 認証画面以外の場合は認証画面にリダイレクト
      if (pathname !== '/auth' && !pathname.startsWith('/auth')) {
        router.replace('/auth');
      }
    } else if (!loading && isAuthenticated && pathname === '/auth') {
      // 認証済みで認証画面にいる場合はメイン画面にリダイレクト
      router.replace('/(tabs)');
    }
  }, [loading, isAuthenticated, pathname]);

  // ローディング中
  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].text} />
          <ThemedText style={styles.loadingText}>読み込み中...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  // 認証されていない場合は認証画面にリダイレクト（既にリダイレクト処理中）
  if (!isAuthenticated && pathname !== '/auth') {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].text} />
        </View>
      </ThemedView>
    );
  }

  // 認証済みまたは認証画面の場合は子コンポーネントを表示
  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
});

