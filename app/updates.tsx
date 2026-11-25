import { useIsFocused } from '@react-navigation/native';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { ThemedText } from '@/components/themed-text';
import { RELEASE_CHANGE_LABELS, RELEASE_NOTES } from '@/constants/release-notes';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useReleaseNotes } from '@/contexts/ReleaseNotesContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function UpdatesScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const isDark = scheme === 'dark';
  const { user } = useAuth();
  const { markReleasesSeen } = useReleaseNotes();
  const focused = useIsFocused();
  const [laidOut, setLaidOut] = useState(false);

  useEffect(() => {
    // 遷移予約時ではなく、履歴がレイアウトされフォーカスを得た後に確認位置を保存する。
    if (focused && laidOut) void markReleasesSeen();
  }, [focused, laidOut, markReleasesSeen]);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace(user ? '/(tabs)/Settings' : '/auth');
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: isDark ? '#4A4034' : '#E4DCCF' }]}>
        <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel="戻る" style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <ThemedText type="subtitle" accessibilityRole="header">リリースノート</ThemedText>
      </View>
      <ScrollView contentContainerStyle={styles.content} onLayout={() => setLaidOut(true)}>
        <View style={styles.intro}>
          <ThemedText style={styles.eyebrow}>Readeco の更新情報</ThemedText>
          <ThemedText style={styles.title} accessibilityRole="header">読書を、少しずつ快適に。</ThemedText>
          <ThemedText style={styles.description}>新しい機能や改善、不具合の修正をお知らせします。</ThemedText>
        </View>
        {RELEASE_NOTES.map((release) => (
          <View key={release.id} style={[styles.release, {
            backgroundColor: isDark ? '#231E19' : '#FFFFFF',
            borderColor: isDark ? '#4A4034' : '#E4DCCF',
          }]}>
            <View style={styles.metadata}>
              <ThemedText style={styles.date}>{release.date}</ThemedText>
              {release.version && <ThemedText style={styles.version}>v{release.version}</ThemedText>}
            </View>
            <ThemedText style={styles.releaseTitle} accessibilityRole="header">{release.title}</ThemedText>
            {release.changes.map((change, index) => (
              <View key={index} style={styles.change}>
                <ThemedText style={[styles.changeType, { color: isDark ? '#D4C4A8' : '#6A4028' }]}>
                  {RELEASE_CHANGE_LABELS[change.type]}
                </ThemedText>
                <ThemedText style={styles.changeText}>{change.text}</ThemedText>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
  backButton: { padding: 12, marginRight: 4, minWidth: 48, minHeight: 48 },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, paddingBottom: 48 },
  intro: { marginVertical: 16, marginBottom: 28 },
  eyebrow: { fontSize: 13, opacity: 0.65, marginBottom: 8 },
  title: { fontSize: 24, lineHeight: 34, fontWeight: '700', marginBottom: 12 },
  description: { fontSize: 14, lineHeight: 23, opacity: 0.75 },
  release: { padding: 20, borderWidth: 1, borderRadius: 16, marginBottom: 16 },
  metadata: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 10 },
  date: { fontSize: 13, opacity: 0.65 },
  version: { fontSize: 12, opacity: 0.6 },
  releaseTitle: { fontSize: 18, lineHeight: 27, fontWeight: '700', marginBottom: 16 },
  change: { marginBottom: 12 },
  changeType: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
  changeText: { fontSize: 14, lineHeight: 24 },
});
