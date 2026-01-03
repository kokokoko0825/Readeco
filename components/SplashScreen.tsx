import { useEffect, useState } from 'react';
import { Animated, Image, Platform, StyleSheet, View } from 'react-native';
import { ThemedText } from './themed-text';

interface SplashScreenProps {
  onFinish: () => void;
}

export function CustomSplashScreen({ onFinish }: SplashScreenProps) {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.8));

  useEffect(() => {
    // フェードインとスケールアニメーション
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // 2秒後にフェードアウトして終了
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        onFinish();
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, [fadeAnim, scaleAnim, onFinish]);

  const backgroundColor = '#FCFAF2';

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}>
        {Platform.OS === 'web' ? (
          <img
            src="/images/Logo.svg"
            alt="Readeco Logo"
            style={{ width: 120, height: 120 }}
          />
        ) : (
          <Image
            source={require('@/public/images/Logo.svg')}
            style={{ width: 120, height: 120 }}
            resizeMode="contain"
          />
        )}
        <ThemedText style={styles.appName}>Readeco</ThemedText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  content: {
    alignItems: 'center',
    gap: 16,
  },
  appName: {
    fontSize: 36,
    fontWeight: 'bold',
    marginTop: 8,
  },
  tagline: {
    fontSize: 16,
    opacity: 0.7,
  },
});
