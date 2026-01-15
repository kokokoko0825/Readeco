import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { Icon } from '@/components/Icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { showAlert } from '@/utils/alert';
import { getUserId } from '@/utils/firebase-auth';
import { addBookToFirebase, isBookAlreadyAdded } from '@/utils/firebase-books';
import { searchBooksByQuery, type Book } from '@/utils/rakuten-api';

export default function SearchResultsScreen() {
  const colorScheme = useColorScheme();
  const params = useLocalSearchParams<{ query: string | string[] }>();
  const query = Array.isArray(params.query) ? params.query[0] : params.query;
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [showBookModal, setShowBookModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (query) {
      // クエリが変わったらリセット
      setBooks([]);
      setCurrentPage(1);
      setHasMore(true);
      loadSearchResults(1, true);
    }
  }, [query]);

  const loadSearchResults = async (page: number, isInitial: boolean = false) => {
    if (!query) return;

    if (isInitial) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const decodedQuery = decodeURIComponent(query);
      const results = await searchBooksByQuery(decodedQuery, 30, page);

      if (results.length === 0) {
        // 結果が0件の場合はこれ以上読み込めない
        setHasMore(false);
      } else if (results.length < 30) {
        // 30件未満の場合は最後のページ
        setHasMore(false);
        if (isInitial) {
          setBooks(results);
        } else {
          setBooks((prev) => [...prev, ...results]);
        }
      } else {
        // 30件取得できた場合は次のページがある可能性がある
        if (isInitial) {
          setBooks(results);
        } else {
          setBooks((prev) => [...prev, ...results]);
        }
        setCurrentPage(page);
      }
    } catch (error) {
      console.error('Error loading search results:', error);
      if (isInitial) {
        showAlert(
          'エラー',
          error instanceof Error ? error.message : '検索に失敗しました'
        );
      } else {
        showAlert(
          'エラー',
          error instanceof Error ? error.message : '追加の検索結果の読み込みに失敗しました'
        );
      }
      setHasMore(false);
    } finally {
      if (isInitial) {
        setLoading(false);
      } else {
        setLoadingMore(false);
      }
    }
  };

  const loadMoreResults = () => {
    if (!loadingMore && hasMore && !loading) {
      loadSearchResults(currentPage + 1, false);
    }
  };

  const handleBookPress = (book: Book) => {
    setSelectedBook(book);
    setShowBookModal(true);
  };

  const handleAddBook = async () => {
    if (!selectedBook || isSaving) return;

    setIsSaving(true);
    try {
      const userId = getUserId();
      if (!userId) {
        showAlert('エラー', 'ログインが必要です');
        setIsSaving(false);
        return;
      }

      // 既に登録されているかチェック
      const alreadyAdded = await isBookAlreadyAdded(userId, selectedBook.isbn);
      if (alreadyAdded) {
        showAlert('既に登録されています', 'この本は既に本棚に追加されています。');
        setIsSaving(false);
        return;
      }

      // Firebaseに保存
      await addBookToFirebase(selectedBook, userId, selectedBook.description);

      // 状態をリセット
      setShowBookModal(false);
      setSelectedBook(null);

      showAlert('追加完了', '本棚に追加しました。', [
        {
          text: 'OK',
          onPress: () => {
            // 本棚ページに遷移
            router.replace('/(tabs)');
          },
        },
      ]);
    } catch (error) {
      console.error('Error adding book:', error);
      showAlert('エラー', '本の追加に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const renderBookItem = ({ item }: { item: Book }) => {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.bookItem,
          pressed && styles.bookItemPressed,
        ]}
        onPress={() => handleBookPress(item)}>
        <View style={styles.bookItemContent}>
          {item.imageUrl ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.bookImage}
              resizeMode="cover"
            />
          ) : (
            <View
              style={[
                styles.bookImagePlaceholder,
                {
                  backgroundColor:
                    colorScheme === 'dark' ? '#2D2520' : '#E0E0E0',
                },
              ]}>
              <Icon
                name="book"
                size={32}
                color={Colors[colorScheme ?? 'light'].icon}
              />
            </View>
          )}
          <View style={styles.bookInfo}>
            <ThemedText style={styles.bookTitle} numberOfLines={2}>
              {item.title}
            </ThemedText>
            <ThemedText style={styles.bookAuthor} numberOfLines={1}>
              {item.author}
            </ThemedText>
            {item.publisher && (
              <ThemedText style={styles.bookPublisher} numberOfLines={1}>
                {item.publisher}
              </ThemedText>
            )}
            {item.price && (
              <ThemedText style={styles.bookPrice}>
                ¥{item.price.toLocaleString()}
              </ThemedText>
            )}
          </View>
          <Icon
            name="keyboard-arrow-down"
            size={24}
            color={Colors[colorScheme ?? 'light'].icon}
            style={styles.arrowIcon}
          />
        </View>
      </Pressable>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Icon
        name="search-off"
        size={64}
        color={Colors[colorScheme ?? 'light'].icon}
        style={styles.emptyIcon}
      />
      <ThemedText style={styles.emptyText}>
        検索結果が見つかりませんでした
      </ThemedText>
      <ThemedText style={styles.emptySubText}>
        「{query ? decodeURIComponent(query) : ''}」に一致する本が見つかりませんでした
      </ThemedText>
    </View>
  );

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}>
            <Icon
              name="arrow-back"
              size={24}
              color={Colors[colorScheme ?? 'light'].text}
            />
          </Pressable>
          <ThemedText style={styles.headerTitle}>検索結果</ThemedText>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color={Colors[colorScheme ?? 'light'].tint}
          />
          <ThemedText style={styles.loadingText}>検索中...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Icon
            name="arrow-back"
            size={24}
            color={Colors[colorScheme ?? 'light'].text}
          />
        </Pressable>
        <View style={styles.headerTitleContainer}>
          <ThemedText style={styles.headerTitle}>検索結果</ThemedText>
          {query && (
            <ThemedText style={styles.headerSubtitle} numberOfLines={1}>
              「{decodeURIComponent(query)}」
            </ThemedText>
          )}
        </View>
        <View style={styles.headerRight} />
      </View>

      {/* 検索結果数 */}
      {books.length > 0 && (
        <View style={styles.resultCountContainer}>
          <ThemedText style={styles.resultCount}>
            {`${books.length}件の検索結果${hasMore ? ' （さらに読み込むことができます）' : ''}`}
          </ThemedText>
        </View>
      )}

      {/* 検索結果リスト */}
      <FlatList
        data={books}
        renderItem={renderBookItem}
        keyExtractor={(item, index) => `${item.isbn}-${index}`}
        contentContainerStyle={
          books.length === 0 ? styles.emptyListContainer : styles.listContainer
        }
        ListEmptyComponent={renderEmptyState}
        ItemSeparatorComponent={() => (
          <View
            style={[
              styles.separator,
              {
                backgroundColor:
                  colorScheme === 'dark' ? '#2D2520' : '#F5F5F5',
              },
            ]}
          />
        )}
        onEndReached={loadMoreResults}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadMoreContainer}>
              <ActivityIndicator
                size="small"
                color={Colors[colorScheme ?? 'light'].tint}
              />
              <ThemedText style={styles.loadMoreText}>
                読み込み中...
              </ThemedText>
            </View>
          ) : !hasMore && books.length > 0 ? (
            <View style={styles.loadMoreContainer}>
              <ThemedText style={styles.loadMoreText}>
                すべての検索結果を表示しました
              </ThemedText>
            </View>
          ) : null
        }
      />

      {/* 本の情報モーダル */}
      <Modal
        visible={showBookModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowBookModal(false)}>
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: Colors[colorScheme ?? 'light'].background },
            ]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>本の情報</ThemedText>
              <Pressable onPress={() => setShowBookModal(false)}>
                <Icon
                  name="close"
                  size={24}
                  color={Colors[colorScheme ?? 'light'].text}
                />
              </Pressable>
            </View>

            {selectedBook && (
              <ScrollView style={styles.modalBody}>
                {/* 本の画像 */}
                {selectedBook.imageUrl && (
                  <View style={styles.bookImageContainer}>
                    <Image
                      source={{ uri: selectedBook.imageUrl }}
                      style={styles.modalBookImage}
                      resizeMode="contain"
                    />
                  </View>
                )}

                {/* タイトル */}
                <ThemedText style={styles.modalBookTitle}>
                  {selectedBook.title}
                </ThemedText>

                {/* 作者名 */}
                <ThemedText style={styles.modalBookAuthor}>
                  {selectedBook.author}
                </ThemedText>

                {/* ISBN */}
                <View style={styles.bookInfoRow}>
                  <ThemedText style={styles.bookInfoLabel}>ISBN:</ThemedText>
                  <ThemedText style={styles.bookInfoValue}>
                    {selectedBook.isbn}
                  </ThemedText>
                </View>

                {/* 出版社 */}
                {selectedBook.publisher && (
                  <View style={styles.bookInfoRow}>
                    <ThemedText style={styles.bookInfoLabel}>出版社:</ThemedText>
                    <ThemedText style={styles.bookInfoValue}>
                      {selectedBook.publisher}
                    </ThemedText>
                  </View>
                )}

                {/* 発売日 */}
                {selectedBook.publishDate && (
                  <View style={styles.bookInfoRow}>
                    <ThemedText style={styles.bookInfoLabel}>発売日:</ThemedText>
                    <ThemedText style={styles.bookInfoValue}>
                      {selectedBook.publishDate}
                    </ThemedText>
                  </View>
                )}

                {/* 価格 */}
                {selectedBook.price && (
                  <View style={styles.bookInfoRow}>
                    <ThemedText style={styles.bookInfoLabel}>価格:</ThemedText>
                    <ThemedText style={styles.bookInfoValue}>
                      ¥{selectedBook.price.toLocaleString()}
                    </ThemedText>
                  </View>
                )}
              </ScrollView>
            )}

            {/* モーダルフッター */}
            <View style={styles.modalFooter}>
              <Pressable
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: colorScheme === 'dark' ? '#3D352D' : '#E0E0E0' }]}
                onPress={() => {
                  setShowBookModal(false);
                  setSelectedBook(null);
                }}>
                <ThemedText style={[styles.cancelButtonText, { color: colorScheme === 'dark' ? '#F5F0E6' : '#333' }]}>キャンセル</ThemedText>
              </Pressable>
              <Pressable
                style={[
                  styles.modalButton,
                  styles.addButton,
                  isSaving && styles.addButtonDisabled,
                ]}
                onPress={handleAddBook}
                disabled={isSaving}>
                {isSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <ThemedText style={styles.addButtonText}>登録</ThemedText>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  headerRight: {
    width: 40,
  },
  resultCountContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  resultCount: {
    fontSize: 14,
    opacity: 0.7,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    opacity: 0.7,
  },
  listContainer: {
    paddingVertical: 8,
  },
  emptyListContainer: {
    flex: 1,
  },
  bookItem: {
    paddingHorizontal: 16,
  },
  bookItemPressed: {
    opacity: 0.7,
  },
  bookItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  bookImage: {
    width: 60,
    height: 84,
    borderRadius: 6,
    backgroundColor: '#E0E0E0',
  },
  bookImagePlaceholder: {
    width: 60,
    height: 84,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookInfo: {
    flex: 1,
    gap: 4,
  },
  bookTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  bookAuthor: {
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 2,
  },
  bookPublisher: {
    fontSize: 12,
    opacity: 0.6,
  },
  bookPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#838A2D',
    marginTop: 4,
  },
  arrowIcon: {
    transform: [{ rotate: '-90deg' }],
  },
  separator: {
    height: 1,
    marginLeft: 88,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
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
  modalBody: {
    marginBottom: 20,
    maxHeight: 400,
  },
  bookImageContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalBookImage: {
    width: 150,
    height: 200,
    borderRadius: 8,
  },
  modalBookTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalBookAuthor: {
    fontSize: 16,
    marginBottom: 16,
    opacity: 0.8,
  },
  bookInfoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  bookInfoLabel: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 80,
  },
  bookInfoValue: {
    fontSize: 14,
    flex: 1,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#E0E0E0',
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#838A2D',
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadMoreContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadMoreText: {
    fontSize: 14,
    opacity: 0.6,
  },
});

