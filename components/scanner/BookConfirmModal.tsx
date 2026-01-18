/**
 * 本の確認モーダルコンポーネント
 * スキャンした本の情報を表示し、追加/スキップの選択を提供
 */

import { Icon } from '@/components/Icon';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { type Book } from '@/utils/rakuten-api';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

interface BookConfirmModalProps {
  book: Book | null;
  visible: boolean;
  onConfirm: () => void;
  onSkip: () => void;
  isSaving: boolean;
}

export function BookConfirmModal({
  book,
  visible,
  onConfirm,
  onSkip,
  isSaving,
}: BookConfirmModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  if (!book) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onSkip}>
      <View style={styles.overlay}>
        <View style={[styles.content, { backgroundColor: colors.background }]}>
          {/* サムネイル */}
          {book.imageUrl ? (
            <Image source={{ uri: book.imageUrl }} style={styles.thumbnail} resizeMode="contain" />
          ) : (
            <View style={[styles.thumbnailPlaceholder, { backgroundColor: colorScheme === 'dark' ? '#3D352D' : '#E8E8E8' }]}>
              <Icon name="book" size={48} color={colors.icon} />
            </View>
          )}

          {/* タイトル */}
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={3}>
            {book.title}
          </Text>

          {/* 著者 */}
          <Text style={[styles.author, { color: colors.icon }]} numberOfLines={2}>
            {book.author}
          </Text>

          {/* 出版社・価格 */}
          <View style={styles.metaRow}>
            {book.publisher && (
              <Text style={[styles.meta, { color: colors.icon }]}>{book.publisher}</Text>
            )}
            {book.price && (
              <Text style={[styles.meta, { color: colors.icon }]}>
                {book.price.toLocaleString()}円
              </Text>
            )}
          </View>

          {/* ボタン */}
          <View style={styles.buttons}>
            <Pressable
              style={[
                styles.button,
                styles.skipButton,
                { backgroundColor: colorScheme === 'dark' ? '#3D352D' : '#E0E0E0' },
              ]}
              onPress={onSkip}
              disabled={isSaving}
            >
              <Text
                style={[
                  styles.skipButtonText,
                  { color: colorScheme === 'dark' ? '#F5F0E6' : '#333' },
                ]}
              >
                スキップ
              </Text>
            </Pressable>

            <Pressable
              style={[styles.button, styles.confirmButton, isSaving && styles.buttonDisabled]}
              onPress={onConfirm}
              disabled={isSaving}
            >
              <Text style={styles.confirmButtonText}>{isSaving ? '保存中...' : '本棚に追加'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  thumbnail: {
    width: 140,
    height: 200,
    borderRadius: 8,
    marginBottom: 16,
    backgroundColor: '#f0f0f0',
  },
  thumbnailPlaceholder: {
    width: 140,
    height: 200,
    borderRadius: 8,
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  author: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  meta: {
    fontSize: 12,
  },
  buttons: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  skipButton: {},
  skipButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#838A2D',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
