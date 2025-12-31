import { FlatList, Image, Pressable, StyleSheet, View, ActivityIndicator } from 'react-native';
import { useEffect, useState, useRef } from 'react';
import { router } from 'expo-router';
import type { Unsubscribe } from 'firebase/firestore';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { subscribeUserBooks, type BookData } from '@/utils/firebase-books';
import { getUserId } from '@/utils/firebase-auth';
import { useAuth } from '@/contexts/AuthContext';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  const [books, setBooks] = useState<BookData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const unsubscribeRef = useRef<Unsubscribe | null>(null);

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

  const renderBookItem = ({ item }: { item: BookData }) => {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.bookItem,
          pressed && styles.bookItemPressed,
        ]}
        onPress={() => {
          router.push({
            pathname: '/book/[id]',
            params: { id: item.id || '' },
          });
        }}>
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.bookThumbnail}
            resizeMode="cover"
          />
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
          </View>
        )}
      </Pressable>
    );
  };

  const renderSeparator = () => <View style={styles.itemDivider} />;

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons
        name="book-outlined"
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
          <MaterialIcons
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

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={books}
        renderItem={renderBookItem}
        keyExtractor={(item) => item.id || item.isbn}
        numColumns={3}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={renderEmptyState}
        refreshing={loading}
        onRefresh={loadBooks}
        columnWrapperStyle={styles.row}
      />
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
  bookThumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
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
});
