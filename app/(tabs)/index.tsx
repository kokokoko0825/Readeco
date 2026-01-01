import { router } from 'expo-router';
import type { Unsubscribe } from 'firebase/firestore';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { extractBaseTitle, getBooksBySeriesKey, getGroupedBooksRepresentatives } from '@/utils/book-series';
import { getUserId } from '@/utils/firebase-auth';
import { subscribeUserBooks, type BookData } from '@/utils/firebase-books';

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  const [books, setBooks] = useState<BookData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const unsubscribeRef = useRef<Unsubscribe | null>(null);
  const [selectedSeriesKey, setSelectedSeriesKey] = useState<string | null>(null);
  const [showSeriesModal, setShowSeriesModal] = useState(false);

  useEffect(() => {
    if (user) {
      const userId = getUserId();
      if (!userId) {
        setError('ログインが必要です');
        setLoading(false);
        return;
      }

      // 既存のリスナーを解除
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }

      // リアルタイムリスナーを設定
      try {
        setLoading(true);
        setError(null);
        
        unsubscribeRef.current = subscribeUserBooks(userId, (updatedBooks) => {
          setBooks(updatedBooks);
          setLoading(false);
          setError(null);
        });
      } catch (err) {
        console.error('Error setting up books subscription:', err);
        setError('書籍の読み込みに失敗しました');
        setLoading(false);
      }
    } else {
      // ログアウト時は書籍をクリア
      setBooks([]);
      setLoading(false);
    }

    // クリーンアップ関数：コンポーネントのアンマウント時またはuserが変更された時にリスナーを解除
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [user]);

  const loadBooks = () => {
    // リアルタイムリスナーが既に設定されているため、手動リロードは不要
    // ただし、エラー状態をリセットするために使用
    if (user) {
      const userId = getUserId();
      if (!userId) {
        setError('ログインが必要です');
        return;
      }

      // 既存のリスナーを解除して再設定
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }

      try {
        setLoading(true);
        setError(null);
        
        unsubscribeRef.current = subscribeUserBooks(userId, (updatedBooks) => {
          setBooks(updatedBooks);
          setLoading(false);
          setError(null);
        });
      } catch (err) {
        console.error('Error setting up books subscription:', err);
        setError('書籍の読み込みに失敗しました');
        setLoading(false);
      }
    }
  };

  // シリーズでグループ化された書籍リスト
  const groupedBooks = useMemo(() => {
    return getGroupedBooksRepresentatives(books);
  }, [books]);

  // 選択されたシリーズの本一覧
  const selectedSeriesBooks = useMemo(() => {
    if (!selectedSeriesKey) return [];
    return getBooksBySeriesKey(books, selectedSeriesKey);
  }, [selectedSeriesKey, books]);

  // シリーズの基本タイトルを取得
  const seriesBaseTitle = useMemo(() => {
    if (!selectedSeriesKey || selectedSeriesBooks.length === 0) return '';
    const firstBook = selectedSeriesBooks[0];
    return extractBaseTitle(firstBook.title);
  }, [selectedSeriesKey, selectedSeriesBooks]);

  const handleBookPress = (item: BookData) => {
    const seriesCount = (item as BookData & { _seriesCount?: number })._seriesCount;
    const seriesKey = (item as BookData & { _seriesKey?: string })._seriesKey;
    const hasSeries = seriesCount !== undefined && seriesCount > 1 && seriesKey;

    if (hasSeries) {
      // シリーズの場合はモーダルを表示
      setSelectedSeriesKey(seriesKey);
      setShowSeriesModal(true);
    } else {
      // 単体の場合は詳細ページに遷移
      router.push({
        pathname: '/book/[id]',
        params: { id: item.id || '' },
      });
    }
  };

  const renderBookItem = ({ item }: { item: BookData }) => {
    const seriesCount = (item as BookData & { _seriesCount?: number })._seriesCount;
    const hasSeries = seriesCount !== undefined && seriesCount > 1;

    return (
      <Pressable
        style={({ pressed }) => [
          styles.bookItem,
          pressed && styles.bookItemPressed,
        ]}
        onPress={() => handleBookPress(item)}>
        {item.imageUrl ? (
          <View style={styles.thumbnailContainer}>
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.bookThumbnail}
              resizeMode="cover"
            />
            {hasSeries && (
              <View style={styles.seriesBadge}>
                <ThemedText style={styles.seriesBadgeText}>{seriesCount}</ThemedText>
              </View>
            )}
          </View>
        ) : (
          <View
            style={[
              styles.bookThumbnailPlaceholder,
              {
                backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#FFFFFF',
              },
            ]}>
            <View style={styles.bookCardContent}>
              {item.author && (
                <ThemedText
                  style={[
                    styles.bookCardAuthor,
                    {
                      color: colorScheme === 'dark' ? '#9BA1A6' : '#6A4028',
                    },
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail">
                  {item.author}
                </ThemedText>
              )}
              <ThemedText
                style={styles.bookCardTitle}
                numberOfLines={4}
                ellipsizeMode="tail">
                {item.title}
              </ThemedText>
            </View>
            {hasSeries && (
              <View style={styles.seriesBadge}>
                <ThemedText style={styles.seriesBadgeText}>{seriesCount}</ThemedText>
              </View>
            )}
          </View>
        )}
      </Pressable>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Icon
        name="book"
        size={48}
        color={Colors[colorScheme ?? 'light'].icon}
      />
      <ThemedText style={styles.emptyText}>
        登録した本がありません
      </ThemedText>
      <ThemedText style={styles.emptySubText}>
        登録ページから本を追加してください
      </ThemedText>
    </View>
  );

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

  if (error) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon
            name="error-outline"
            size={48}
            color={Colors[colorScheme ?? 'light'].icon}
          />
          <ThemedText style={styles.errorText}>{error}</ThemedText>
          <Pressable style={styles.retryButton} onPress={loadBooks}>
            <ThemedText style={styles.retryButtonText}>再試行</ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  const renderSeriesBookItem = ({ item }: { item: BookData }) => {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.seriesBookItem,
          pressed && styles.bookItemPressed,
        ]}
        onPress={() => {
          setShowSeriesModal(false);
          router.push({
            pathname: '/book/[id]',
            params: { id: item.id || '' },
          });
        }}>
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.seriesBookThumbnail}
            resizeMode="cover"
          />
        ) : (
          <View
            style={[
              styles.seriesBookThumbnailPlaceholder,
              {
                backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#FFFFFF',
              },
            ]}>
            <View style={styles.bookCardContent}>
              {item.author && (
                <ThemedText
                  style={[
                    styles.bookCardAuthor,
                    {
                      color: colorScheme === 'dark' ? '#9BA1A6' : '#6A4028',
                    },
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail">
                  {item.author}
                </ThemedText>
              )}
              <ThemedText
                style={styles.bookCardTitle}
                numberOfLines={4}
                ellipsizeMode="tail">
                {item.title}
              </ThemedText>
            </View>
          </View>
        )}
        <ThemedText style={styles.seriesBookTitle} numberOfLines={2}>
          {item.title}
        </ThemedText>
      </Pressable>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={groupedBooks}
        renderItem={renderBookItem}
        keyExtractor={(item) => item.id || item.isbn}
        numColumns={3}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={renderEmptyState}
        refreshing={loading}
        onRefresh={loadBooks}
        columnWrapperStyle={styles.row}
      />

      {/* シリーズ一覧モーダル */}
      <Modal
        visible={showSeriesModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSeriesModal(false)}>
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: Colors[colorScheme ?? 'light'].background },
            ]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>
                {seriesBaseTitle || 'シリーズ一覧'}
              </ThemedText>
              <Pressable onPress={() => setShowSeriesModal(false)}>
                <Icon
                  name="close"
                  size={24}
                  color={Colors[colorScheme ?? 'light'].text}
                />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody}>
              <FlatList
                data={selectedSeriesBooks}
                renderItem={renderSeriesBookItem}
                keyExtractor={(item) => item.id || item.isbn}
                numColumns={3}
                scrollEnabled={false}
                columnWrapperStyle={styles.seriesRow}
              />
            </ScrollView>
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
  listContainer: {
    paddingTop: 20,
    paddingHorizontal: 12,
    paddingBottom: 20,
  },
  row: {
    justifyContent: 'flex-start',
    paddingHorizontal: 8,
  },
  bookItem: {
    flex: 1,
    margin: 4,
    aspectRatio: 2 / 3, // 縦横比を2:3に設定（本の表紙の一般的な比率）
    maxWidth: '31%', // 3列に配置するため、各アイテムの最大幅を約33%に設定
  },
  bookItemPressed: {
    opacity: 0.6,
  },
  thumbnailContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  bookThumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  seriesBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#838A2D',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  seriesBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  bookThumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bookCardContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 6,
  },
  bookCardAuthor: {
    fontSize: 9,
    fontWeight: '500',
    marginBottom: 4,
    textAlign: 'center',
  },
  bookCardTitle: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 14,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    fontWeight: '600',
  },
  emptySubText: {
    fontSize: 14,
    marginTop: 8,
    opacity: 0.7,
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
  retryButton: {
    marginTop: 20,
    backgroundColor: '#838A2D',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
    maxWidth: 600,
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
    flex: 1,
    marginRight: 16,
  },
  modalBody: {
    maxHeight: 500,
  },
  seriesRow: {
    justifyContent: 'flex-start',
    paddingHorizontal: 4,
  },
  seriesBookItem: {
    flex: 1,
    margin: 4,
    maxWidth: '31%',
  },
  seriesBookThumbnail: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  seriesBookThumbnailPlaceholder: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  seriesBookTitle: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'center',
  },
});
