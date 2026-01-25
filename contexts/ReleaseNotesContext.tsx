/**
 * リリースノートコンテキスト
 * 新しいバージョンがリリースされた際に、アプリ全体でリリースノートモーダルを表示する
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { RELEASE_NOTES } from '@/constants/release-notes';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

// バージョン確認用のストレージキー
const LAST_SEEN_VERSION_KEY = '@readeco_last_seen_version';

interface ReleaseNotesContextType {
  showReleaseNotes: () => void;
}

const ReleaseNotesContext = createContext<ReleaseNotesContextType | null>(null);

export function useReleaseNotes() {
  const context = useContext(ReleaseNotesContext);
  if (!context) {
    throw new Error('useReleaseNotes must be used within a ReleaseNotesProvider');
  }
  return context;
}

interface ReleaseNotesProviderProps {
  children: React.ReactNode;
}

export function ReleaseNotesProvider({ children }: ReleaseNotesProviderProps) {
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  const isDark = colorScheme === 'dark';
  const cardBg = isDark ? '#231E19' : '#FCFAF2';

  // リリースノートを表示
  const showReleaseNotes = useCallback(() => {
    setVisible(true);
  }, []);

  // リリースノートを閉じる
  const hideReleaseNotes = useCallback(() => {
    setVisible(false);
  }, []);

  // 新しいバージョンがある場合にリリースノートを自動表示
  useEffect(() => {
    // 既にチェック済み、またはユーザーがログインしていない場合はスキップ
    if (hasChecked || !user) {
      return;
    }

    const checkNewVersion = async () => {
      try {
        // バージョンの取得（複数の方法を試行）
        const currentVersion =
          Constants.expoConfig?.version ||
          Constants.manifest?.version ||
          (Constants.manifest2?.extra?.expoClient as { version?: string })?.version ||
          '1.0.0';
        const lastSeenVersion = await AsyncStorage.getItem(LAST_SEEN_VERSION_KEY);

        // デバッグ用ログ（開発時のみ）
        if (__DEV__) {
          console.log('[ReleaseNotes] Current version:', currentVersion);
          console.log('[ReleaseNotes] Last seen version:', lastSeenVersion);
        }

        // 初回訪問または新しいバージョンの場合
        if (!lastSeenVersion || lastSeenVersion !== currentVersion) {
          if (__DEV__) {
            console.log('[ReleaseNotes] Showing release notes modal');
          }
          // 少し遅延させてから表示（画面のロード完了後）
          setTimeout(() => {
            setVisible(true);
          }, 800);
          // 現在のバージョンを保存
          await AsyncStorage.setItem(LAST_SEEN_VERSION_KEY, currentVersion);
        }

        setHasChecked(true);
      } catch (error) {
        console.error('Error checking version:', error);
        setHasChecked(true);
      }
    };

    checkNewVersion();
  }, [user, hasChecked]);

  return (
    <ReleaseNotesContext.Provider value={{ showReleaseNotes }}>
      {children}

      {/* リリースノートモーダル */}
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={hideReleaseNotes}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalOverlay} onPress={hideReleaseNotes}>
            <Pressable
              style={[styles.modalContent, { backgroundColor: cardBg }]}
              onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>リリースノート</ThemedText>
                <Pressable onPress={hideReleaseNotes} style={styles.modalCloseButton}>
                  <Icon
                    name="close"
                    size={24}
                    color={Colors[colorScheme ?? 'light'].text}
                  />
                </Pressable>
              </View>
              <ScrollView style={styles.modalBody}>
                {RELEASE_NOTES.map((release, index) => (
                  <View key={index} style={styles.releaseItem}>
                    <View style={styles.releaseHeader}>
                      <ThemedText style={styles.releaseVersion}>
                        v{release.version}
                      </ThemedText>
                      <ThemedText style={styles.releaseDate}>
                        {release.date}
                      </ThemedText>
                    </View>
                    {release.changes.map((change, changeIndex) => (
                      <View key={changeIndex} style={styles.releaseChange}>
                        <ThemedText style={styles.releaseBullet}>•</ThemedText>
                        <ThemedText style={styles.releaseChangeText}>
                          {change}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                ))}
              </ScrollView>
            </Pressable>
          </Pressable>
        </View>
      </Modal>
    </ReleaseNotesContext.Provider>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    maxHeight: 400,
  },
  releaseItem: {
    marginBottom: 24,
  },
  releaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  releaseVersion: {
    fontSize: 18,
    fontWeight: '700',
    marginRight: 12,
  },
  releaseDate: {
    fontSize: 13,
    opacity: 0.5,
  },
  releaseChange: {
    flexDirection: 'row',
    paddingLeft: 8,
    marginBottom: 6,
  },
  releaseBullet: {
    fontSize: 14,
    marginRight: 8,
    opacity: 0.6,
  },
  releaseChangeText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
});
