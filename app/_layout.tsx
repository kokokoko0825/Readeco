import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { AuthGuard } from '@/components/AuthGuard';
import { CustomSplashScreen } from '@/components/SplashScreen';
import { AuthProvider } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';

// スプラッシュスクリーンを表示させたままにする
SplashScreen.preventAutoHideAsync();

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> };

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [showCustomSplash, setShowCustomSplash] = useState(Platform.OS === 'web');
  const [deferredInstallEvent, setDeferredInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  // アイコンフォントを読み込む
  const [fontsLoaded, fontError] = useFonts({
    ...Ionicons.font,
    ...MaterialIcons.font,
    ...MaterialCommunityIcons.font,
  });

  // Webプラットフォームでフォントが読み込まれるまで待つ
  useEffect(() => {
    if (Platform.OS === 'web') {
      // WebではuseFontsがすぐに解決されることがあるが、
      // 実際のフォント読み込みを確認するため、少し待機
      if (fontsLoaded || fontError) {
        SplashScreen.hideAsync();
      }
    } else {
      if (fontsLoaded || fontError) {
        SplashScreen.hideAsync();
      }
    }
  }, [fontsLoaded, fontError]);

  // Register a basic service worker for PWA capabilities on web
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const registerServiceWorker = async () => {
      try {
        await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
      } catch (error) {
        console.warn('Service worker registration failed', error);
      }
    };

    registerServiceWorker();
  }, []);

  // WebプラットフォームでMaterial Iconsフォントを追加で読み込む（フォールバック用）
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      // 既に追加されているかチェック
      const existingMaterialIcons = document.querySelector('link[href*="Material+Icons"]');
      const existingMaterialCommunityIcons = document.querySelector('link[href*="Material+Symbols"]');
      const existingIonicons = document.querySelector('link[href*="Ionicons"]');

      // Material Iconsフォント
      if (!existingMaterialIcons) {
        const materialIconsLink = document.createElement('link');
        materialIconsLink.rel = 'stylesheet';
        materialIconsLink.href = 'https://fonts.googleapis.com/icon?family=Material+Icons';
        document.head.appendChild(materialIconsLink);
      }

      // Material Community Iconsフォント
      if (!existingMaterialCommunityIcons) {
        const materialCommunityIconsLink = document.createElement('link');
        materialCommunityIconsLink.rel = 'stylesheet';
        materialCommunityIconsLink.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined';
        document.head.appendChild(materialCommunityIconsLink);
      }

      // Ioniconsフォント（フォールバック用）
      if (!existingIonicons) {
        const ioniconsLink = document.createElement('link');
        ioniconsLink.rel = 'stylesheet';
        ioniconsLink.href = 'https://fonts.googleapis.com/css2?family=Ionicons';
        document.head.appendChild(ioniconsLink);
      }

      // Google Search Console認証メタタグ
      const existingGoogleVerification = document.querySelector('meta[name="google-site-verification"]');
      if (!existingGoogleVerification) {
        const googleVerificationMeta = document.createElement('meta');
        googleVerificationMeta.name = 'google-site-verification';
        googleVerificationMeta.content = 'F4I9W3r6lX1lKXofOLr8jkNwEpLi_rxmzpV-ZBIG574';
        document.head.appendChild(googleVerificationMeta);
      }
    }
  }, []);

  // Capture the beforeinstallprompt event to enable an explicit "Install" affordance on Chrome
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handler = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      setDeferredInstallEvent(event);
    };

    window.addEventListener('beforeinstallprompt', handler as EventListener);

    const handleInstalled = () => setDeferredInstallEvent(null);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler as EventListener);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredInstallEvent) return;

    try {
      await deferredInstallEvent.prompt();
    } finally {
      setDeferredInstallEvent(null);
    }
  };

  // フォントが読み込まれるまで何も表示しない
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <AuthProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AuthGuard>
            <Stack>
              <Stack.Screen name="auth" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="(modals)" options={{ headerShown: false }} />
              <Stack.Screen name="book/[id]" options={{ headerShown: false }} />
            </Stack>
            <StatusBar style="auto" />
          </AuthGuard>
          {Platform.OS === 'web' && deferredInstallEvent && (
            <View style={styles.installBanner}>
              <Text style={styles.installText}>アプリをインストールできます</Text>
              <Pressable style={styles.installButton} onPress={handleInstall}>
                <Text style={styles.installButtonText}>インストール</Text>
              </Pressable>
            </View>
          )}
          {showCustomSplash && (
            <CustomSplashScreen onFinish={() => setShowCustomSplash(false)} />
          )}
        </ThemeProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  installBanner: {
    position: 'fixed',
    bottom: 16,
    right: 16,
    left: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.8)',
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 9999,
  },
  installText: {
    color: '#ffffff',
    fontSize: 14,
    flex: 1,
    marginRight: 12,
  },
  installButton: {
    backgroundColor: '#6A4028',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  installButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
});
