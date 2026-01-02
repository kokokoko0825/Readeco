import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';

import { AuthGuard } from '@/components/AuthGuard';
import { CustomSplashScreen } from '@/components/SplashScreen';
import { AuthProvider } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';

// スプラッシュスクリーンを表示させたままにする
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [showCustomSplash, setShowCustomSplash] = useState(Platform.OS === 'web');

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
    }
  }, []);

  // フォントが読み込まれるまで何も表示しない
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
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
      {showCustomSplash && (
        <CustomSplashScreen onFinish={() => setShowCustomSplash(false)} />
      )}
      </ThemeProvider>
    </AuthProvider>
  );
}
