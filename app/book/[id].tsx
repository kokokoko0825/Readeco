import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getBookById, deleteBook, type BookData } from '@/utils/firebase-books';
import { getUserId } from '@/utils/firebase-auth';
import { Icon } from '@/components/Icon';

export default function BookCardScreen() {
  const colorScheme = useColorScheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [book, setBook] = useState<BookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  
  // 現在のユーザーIDを取得
  const currentUserId = getUserId();
  
  // 自分の本かどうかを判定
  const isMyBook = book && currentUserId && book.userId === currentUserId;

  useEffect(() => {
    if (id) {
      loadBook();
    }
  }, [id]);

  const loadBook = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const bookData = await getBookById(id);
      if (!bookData) {
        Alert.alert('エラー', '書籍が見つかりませんでした。', [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]);
        return;
      }
      setBook(bookData);
    } catch (error) {
      console.error('Error loading book:', error);
      Alert.alert('エラー', '書籍の読み込みに失敗しました。', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!book?.id) return;

    Alert.alert('削除確認', 'この本を本棚から削除しますか？', [
      {
        text: 'キャンセル',
        style: 'cancel',
      },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          try {
            setDeleting(true);
            await deleteBook(book.id!);
            Alert.alert('削除完了', '本棚から削除しました。', [
              {
                text: 'OK',
                onPress: () => router.back(),
              },
            ]);
          } catch (error) {
            console.error('Error deleting book:', error);
            Alert.alert('エラー', '削除に失敗しました。');
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

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

  if (!book) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon
            name="error-outline"
            size={48}
            color={Colors[colorScheme ?? 'light'].icon}
          />
          <ThemedText style={styles.errorText}>書籍が見つかりませんでした</ThemedText>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <ThemedText style={styles.backButtonText}>戻る</ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backIconButton} onPress={() => router.back()}>
          <Icon
            name="arrow-back"
            size={24}
            color={Colors[colorScheme ?? 'light'].text}
          />
        </Pressable>
        <ThemedText style={styles.headerTitle}>書籍詳細</ThemedText>
        {isMyBook ? (
          <Pressable
            style={styles.deleteIconButton}
            onPress={handleDelete}
            disabled={deleting}>
            <Icon
              name="delete-outline"
              size={24}
              color={deleting ? '#999' : Colors[colorScheme ?? 'light'].text}
            />
          </Pressable>
        ) : (
          <View style={styles.deleteIconButton} />
        )}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 表紙画像 */}
        <View style={styles.coverContainer}>
          {book.imageUrl ? (
            <Image
              source={{ uri: book.imageUrl }}
              style={styles.coverImage}
              resizeMode="contain"
            />
          ) : (
            <View
              style={[
                styles.coverPlaceholder,
                {
                  backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#FFFFFF',
                },
              ]}>
              <View style={styles.coverCardContent}>
                {book.author && (
                  <ThemedText
                    style={[
                      styles.coverCardAuthor,
                      {
                        color: colorScheme === 'dark' ? '#9BA1A6' : '#6A4028',
                      },
                    ]}
                    numberOfLines={2}
                    ellipsizeMode="tail">
                    {book.author}
                  </ThemedText>
                )}
                <ThemedText
                  style={styles.coverCardTitle}
                  numberOfLines={8}
                  ellipsizeMode="tail">
                  {book.title}
                </ThemedText>
                {book.publisher && (
                  <ThemedText
                    style={[
                      styles.coverCardPublisher,
                      {
                        color: colorScheme === 'dark' ? '#9BA1A6' : '#687076',
                      },
                    ]}
                    numberOfLines={1}
                    ellipsizeMode="tail">
                    {book.publisher}
                  </ThemedText>
                )}
              </View>
            </View>
          )}
        </View>

        {/* タイトル（画像がある場合のみ表示） */}
        {book.imageUrl && <ThemedText style={styles.title}>{book.title}</ThemedText>}

        {/* 著者名 */}
        <ThemedText style={styles.author}>{book.author}</ThemedText>

        {/* 詳細情報 */}
        <View style={styles.detailsContainer}>
          {book.publisher && (
            <View style={styles.detailRow}>
              <Icon
                name="business"
                size={20}
                color={Colors[colorScheme ?? 'light'].icon}
                style={styles.detailIcon}
              />
              <ThemedText style={styles.detailLabel}>出版社:</ThemedText>
              <ThemedText style={styles.detailValue}>{book.publisher}</ThemedText>
            </View>
          )}

          {book.publishDate && (
            <View style={styles.detailRow}>
              <Icon
                name="calendar-today"
                size={20}
                color={Colors[colorScheme ?? 'light'].icon}
                style={styles.detailIcon}
              />
              <ThemedText style={styles.detailLabel}>発売日:</ThemedText>
              <ThemedText style={styles.detailValue}>{book.publishDate}</ThemedText>
            </View>
          )}

          {book.price && (
            <View style={styles.detailRow}>
              <Icon
                name="attach-money"
                size={20}
                color={Colors[colorScheme ?? 'light'].icon}
                style={styles.detailIcon}
              />
              <ThemedText style={styles.detailLabel}>価格:</ThemedText>
              <ThemedText style={styles.detailValue}>¥{book.price.toLocaleString()}</ThemedText>
            </View>
          )}

          <View style={styles.detailRow}>
            <Icon
              name="qr-code"
              size={20}
              color={Colors[colorScheme ?? 'light'].icon}
              style={styles.detailIcon}
            />
            <ThemedText style={styles.detailLabel}>ISBN:</ThemedText>
            <ThemedText style={styles.detailValue}>{book.isbn}</ThemedText>
          </View>
        </View>

        {/* あらすじ */}
        {book.description && (
          <View style={styles.descriptionContainer}>
            <ThemedText style={styles.descriptionTitle}>あらすじ</ThemedText>
            <ThemedText style={styles.descriptionText}>{book.description}</ThemedText>
          </View>
        )}

        {/* 楽天ブックスへのリンク */}
        {book.url && (
          <Pressable
            style={styles.linkButton}
            onPress={async () => {
              try {
                await WebBrowser.openBrowserAsync(book.url);
              } catch (error) {
                console.error('Error opening browser:', error);
                Alert.alert('エラー', 'ブラウザを開けませんでした');
              }
            }}>
            <Icon
              name="open-in-new"
              size={20}
              color="#fff"
              style={styles.linkIcon}
            />
            <ThemedText style={styles.linkButtonText}>楽天ブックスで見る</ThemedText>
          </Pressable>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backIconButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  deleteIconButton: {
    padding: 8,
  },
  content: {
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  backButton: {
    marginTop: 20,
    backgroundColor: '#838A2D',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  coverContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  coverImage: {
    width: 200,
    height: 280,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  coverPlaceholder: {
    width: 200,
    height: 280,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  coverCardContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  coverCardAuthor: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    textAlign: 'center',
  },
  coverCardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 8,
  },
  coverCardPublisher: {
    fontSize: 12,
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 'auto',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  author: {
    fontSize: 18,
    textAlign: 'center',
    paddingHorizontal: 16,
    marginBottom: 24,
    opacity: 0.7,
  },
  detailsContainer: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailIcon: {
    marginRight: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
    minWidth: 80,
  },
  detailValue: {
    fontSize: 14,
    flex: 1,
  },
  descriptionContainer: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  descriptionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 24,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#838A2D',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 24,
  },
  linkIcon: {
    marginRight: 8,
  },
  linkButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

