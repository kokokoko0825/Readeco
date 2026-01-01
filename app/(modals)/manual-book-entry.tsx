import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getUserId } from '@/utils/firebase-auth';
import { addBookToFirebase } from '@/utils/firebase-books';
import type { Book } from '@/utils/rakuten-api';
import { Icon } from '@/components/Icon';

export default function ManualBookEntryScreen() {
  const colorScheme = useColorScheme();
  const [isSaving, setIsSaving] = useState(false);

  // フォーム状態
  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [publisher, setPublisher] = useState('');
  const [author, setAuthor] = useState('');
  const [price, setPrice] = useState('');
  const [publishDate, setPublishDate] = useState('');
  const [description, setDescription] = useState('');

  // バリデーション
  const validateForm = (): boolean => {
    if (!title.trim()) {
      Alert.alert('エラー', 'タイトルは必須です。');
      return false;
    }
    return true;
  };

  // 保存処理
  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    try {
      const userId = getUserId();
      if (!userId) {
        Alert.alert('エラー', 'ログインが必要です');
        setIsSaving(false);
        return;
      }

      // Book型のオブジェクトを作成
      // 手動入力の場合、ISBNは空文字列またはタイムスタンプベースのIDを生成
      const manualISBN = `manual_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      const book: Book = {
        title: title.trim(),
        author: author.trim() || '著者不明',
        isbn: manualISBN,
        url: '', // 手動入力の場合はURLなし
        imageUrl: imageUrl.trim() || '',
        publisher: publisher.trim() || undefined,
        publishDate: publishDate.trim() || undefined,
        price: price.trim() ? parseFloat(price.trim()) : undefined,
        description: description.trim() || undefined,
      };

      // Firebaseに保存
      await addBookToFirebase(book, userId, book.description);

      Alert.alert('追加完了', '本棚に追加しました。', [
        {
          text: 'OK',
          onPress: () => {
            router.back();
          },
        },
      ]);
    } catch (error) {
      console.error('Error adding book to Firebase:', error);
      Alert.alert(
        'エラー',
        '本の追加に失敗しました。\nもう一度お試しください。',
        [
          {
            text: 'OK',
            onPress: () => {
              setIsSaving(false);
            },
          },
        ]
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (isSaving) return;
    router.back();
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        {/* ヘッダー */}
        <View
          style={[
            styles.header,
            {
              borderBottomColor:
                colorScheme === 'dark' ? '#404040' : '#E0E0E0',
            },
          ]}>
          <Pressable
            style={styles.closeButton}
            onPress={handleClose}
            disabled={isSaving}>
            <Icon
              name="close"
              size={28}
              color={Colors[colorScheme ?? 'light'].text}
            />
          </Pressable>
          <ThemedText style={styles.headerTitle}>手動で本を登録</ThemedText>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          keyboardShouldPersistTaps="handled">
          {/* 表紙サムネイルプレビュー */}
          {imageUrl ? (
            <View style={styles.thumbnailPreview}>
              <Image
                source={{ uri: imageUrl }}
                style={styles.thumbnailImage}
                resizeMode="contain"
              />
              <Pressable
                style={styles.removeImageButton}
                onPress={() => setImageUrl('')}>
                <Icon name="close" size={20} color="#fff" />
              </Pressable>
            </View>
          ) : (
            <View style={styles.thumbnailPlaceholder}>
              <Icon
                name="image"
                size={48}
                color={Colors[colorScheme ?? 'light'].icon}
              />
              <ThemedText style={styles.thumbnailPlaceholderText}>
                表紙画像なし
              </ThemedText>
            </View>
          )}

          {/* タイトル（必須） */}
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>
              タイトル <ThemedText style={styles.required}>*</ThemedText>
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  color: Colors[colorScheme ?? 'light'].text,
                  backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#FFFFFF',
                  borderColor: colorScheme === 'dark' ? '#404040' : '#E0E0E0',
                },
              ]}
              value={title}
              onChangeText={setTitle}
              placeholder="本のタイトルを入力"
              placeholderTextColor={
                Colors[colorScheme ?? 'light'].text + '80'
              }
              editable={!isSaving}
            />
          </View>

          {/* 表紙サムネイルURL（任意） */}
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>表紙サムネイルURL（任意）</ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  color: Colors[colorScheme ?? 'light'].text,
                  backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#FFFFFF',
                  borderColor: colorScheme === 'dark' ? '#404040' : '#E0E0E0',
                },
              ]}
              value={imageUrl}
              onChangeText={setImageUrl}
              placeholder="https://example.com/image.jpg"
              placeholderTextColor={
                Colors[colorScheme ?? 'light'].text + '80'
              }
              keyboardType="url"
              autoCapitalize="none"
              editable={!isSaving}
            />
          </View>

          {/* 著者名（任意） */}
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>著者名（任意）</ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  color: Colors[colorScheme ?? 'light'].text,
                  backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#FFFFFF',
                  borderColor: colorScheme === 'dark' ? '#404040' : '#E0E0E0',
                },
              ]}
              value={author}
              onChangeText={setAuthor}
              placeholder="著者名を入力"
              placeholderTextColor={
                Colors[colorScheme ?? 'light'].text + '80'
              }
              editable={!isSaving}
            />
          </View>

          {/* 出版社（任意） */}
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>出版社（任意）</ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  color: Colors[colorScheme ?? 'light'].text,
                  backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#FFFFFF',
                  borderColor: colorScheme === 'dark' ? '#404040' : '#E0E0E0',
                },
              ]}
              value={publisher}
              onChangeText={setPublisher}
              placeholder="出版社名を入力"
              placeholderTextColor={
                Colors[colorScheme ?? 'light'].text + '80'
              }
              editable={!isSaving}
            />
          </View>

          {/* 価格（任意） */}
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>価格（任意）</ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  color: Colors[colorScheme ?? 'light'].text,
                  backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#FFFFFF',
                  borderColor: colorScheme === 'dark' ? '#404040' : '#E0E0E0',
                },
              ]}
              value={price}
              onChangeText={setPrice}
              placeholder="例: 1000"
              placeholderTextColor={
                Colors[colorScheme ?? 'light'].text + '80'
              }
              keyboardType="numeric"
              editable={!isSaving}
            />
          </View>

          {/* 発売日（任意） */}
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>発売日（任意）</ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  color: Colors[colorScheme ?? 'light'].text,
                  backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#FFFFFF',
                  borderColor: colorScheme === 'dark' ? '#404040' : '#E0E0E0',
                },
              ]}
              value={publishDate}
              onChangeText={setPublishDate}
              placeholder="例: 2024年1月1日"
              placeholderTextColor={
                Colors[colorScheme ?? 'light'].text + '80'
              }
              editable={!isSaving}
            />
          </View>

          {/* あらすじ（任意） */}
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>あらすじ（任意）</ThemedText>
            <TextInput
              style={[
                styles.input,
                styles.textArea,
                {
                  color: Colors[colorScheme ?? 'light'].text,
                  backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#FFFFFF',
                  borderColor: colorScheme === 'dark' ? '#404040' : '#E0E0E0',
                },
              ]}
              value={description}
              onChangeText={setDescription}
              placeholder="あらすじを入力"
              placeholderTextColor={
                Colors[colorScheme ?? 'light'].text + '80'
              }
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              editable={!isSaving}
            />
          </View>
        </ScrollView>

        {/* 保存ボタン */}
        <View
          style={[
            styles.footer,
            {
              borderTopColor: colorScheme === 'dark' ? '#404040' : '#E0E0E0',
              backgroundColor: Colors[colorScheme ?? 'light'].background,
            },
          ]}>
          <Pressable
            style={[
              styles.saveButton,
              isSaving && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={isSaving}>
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.saveButtonText}>
                本棚に追加
              </ThemedText>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 44,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: 20,
    paddingBottom: 100,
  },
  thumbnailPreview: {
    alignSelf: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  thumbnailImage: {
    width: 150,
    height: 200,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ff4444',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailPlaceholder: {
    alignSelf: 'center',
    width: 150,
    height: 200,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
  },
  thumbnailPlaceholderText: {
    marginTop: 8,
    fontSize: 12,
    opacity: 0.6,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  required: {
    color: '#ff4444',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 44,
  },
  textArea: {
    minHeight: 120,
    paddingTop: 12,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    backgroundColor: 'transparent',
    borderTopWidth: 1,
  },
  saveButton: {
    backgroundColor: '#838A2D',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

