import * as WebBrowser from 'expo-web-browser';
import type { Unsubscribe } from 'firebase/firestore';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getUserId } from '@/utils/firebase-auth';
import { isBookAlreadyAdded, subscribeUserBooks, type BookData } from '@/utils/firebase-books';
import { searchBooksByAuthor, type Book } from '@/utils/rakuten-api';

type TabType = 'available' | 'preorder';

interface NewBook extends Book {
  publishDateFormatted?: string;
}

/**
 * 楽天APIのsalesDateをDateオブジェクトに変換
 * 形式は "YYYY年MM月DD日" や "YYYYMMDD" など様々な可能性がある
 */
function parseSalesDate(salesDate?: string): Date | null {
  if (!salesDate) return null;

  try {
    // "YYYY年MM月DD日" 形式を試す
    const match1 = salesDate.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (match1) {
      const year = parseInt(match1[1], 10);
      const month = parseInt(match1[2], 10) - 1; // 月は0ベース
      const day = parseInt(match1[3], 10);
      return new Date(year, month, day);
    }

    // "YYYYMMDD" 形式を試す
    if (/^\d{8}$/.test(salesDate)) {
      const year = parseInt(salesDate.substring(0, 4), 10);
      const month = parseInt(salesDate.substring(4, 6), 10) - 1;
      const day = parseInt(salesDate.substring(6, 8), 10);
      return new Date(year, month, day);
    }

    // その他の形式はDateコンストラクタに任せる
    const date = new Date(salesDate);
    if (!isNaN(date.getTime())) {
      return date;
    }
  } catch (error) {
    console.error('Error parsing sales date:', salesDate, error);
  }

  return null;
}

/**
 * 発売日をフォーマット
 */
function formatPublishDate(salesDate?: string): string {
  if (!salesDate) return '';
  
  const date = parseSalesDate(salesDate);
  if (!date) return salesDate;

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  
  return `${year}年${month}月${day}日`;
}

export default function NewScreen() {
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('available');
  const [userBooks, setUserBooks] = useState<BookData[]>([]);
  const [availableBooks, setAvailableBooks] = useState<NewBook[]>([]);
  const [preorderBooks, setPreorderBooks] = useState<NewBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<NewBook | null>(null);
  const [showBookDetailModal, setShowBookDetailModal] = useState(false);
  const unsubscribeRef = useRef<Unsubscribe | null>(null);

  // ユーザーの書籍を取得
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
          setUserBooks(updatedBooks);
        });
      } catch (err) {
        console.error('Error setting up books subscription:', err);
        setError('書籍の読み込みに失敗しました');
        setLoading(false);
      }
    } else {
      setUserBooks([]);
      setLoading(false);
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [user]);

  // ユーザーの書籍から著者リストを取得して検索
  useEffect(() => {
    if (!user || userBooks.length === 0) {
      setAvailableBooks([]);
      setPreorderBooks([]);
      setLoading(false);
      return;
    }

    const fetchNewBooks = async () => {
      try {
        setLoading(true);
        setError(null);

        const userId = getUserId();
        if (!userId) {
          setError('ログインが必要です');
          setLoading(false);
          return;
        }

        // ユーザーが登録している本の著者リストを取得（重複除去）
        const authorsSet = new Set<string>();
        userBooks.forEach((book) => {
          if (book.author && book.author.trim()) {
            authorsSet.add(book.author.trim());
          }
        });

        const authors = Array.from(authorsSet);
        if (authors.length === 0) {
          setAvailableBooks([]);
          setPreorderBooks([]);
          setLoading(false);
          return;
        }

        // ユーザーが登録している本のISBNセット（高速検索用）
        const userIsbns = new Set<string>();
        userBooks.forEach((book) => {
          if (book.isbn) {
            userIsbns.add(book.isbn.replace(/[-\s]/g, ''));
          }
        });

        // 著者ごとの最も新しい（最近の）登録済み本の発売日を計算
        const newestPublishDateByAuthor = new Map<string, Date>();
        userBooks.forEach((book) => {
          if (!book.author || !book.author.trim()) return;
          
          const author = book.author.trim();
          const publishDate = parseSalesDate(book.publishDate);
          
          if (publishDate) {
            const currentNewest = newestPublishDateByAuthor.get(author);
            if (!currentNewest || publishDate > currentNewest) {
              newestPublishDateByAuthor.set(author, publishDate);
            }
          }
        });

        // 現在の日付（時刻部分を0時0分0秒に設定）
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const allAvailableBooks: NewBook[] = [];
        const allPreorderBooks: NewBook[] = [];

        // 各著者について検索
        for (const author of authors) {
          try {
            const books = await searchBooksByAuthor(author, 30);
            
            for (const book of books) {
              // 本棚に登録されていない書籍のみを対象
              const normalizedIsbn = book.isbn.replace(/[-\s]/g, '');
              if (userIsbns.has(normalizedIsbn)) {
                continue;
              }

              // ISBNで追加チェック（念のため）
              const isAdded = await isBookAlreadyAdded(userId, normalizedIsbn);
              if (isAdded) {
                continue;
              }

              // 発売日をパース
              const publishDate = parseSalesDate(book.publishDate);
              
              const newBook: NewBook = {
                ...book,
                publishDateFormatted: formatPublishDate(book.publishDate),
              };

              if (publishDate) {
                // 発売日が今日以前 → 発売済み
                if (publishDate <= today) {
                  // ユーザーの登録済み本の最も新しい発売日より前の本は除外
                  const newestPublishDate = newestPublishDateByAuthor.get(author);
                  if (newestPublishDate && publishDate < newestPublishDate) {
                    // この著者の最も新しい登録済み本の発売日より前なので除外
                    continue;
                  }
                  allAvailableBooks.push(newBook);
                } else {
                  // 発売日が今日より後 → 予約販売中（登録済み本の発売日チェックは不要）
                  allPreorderBooks.push(newBook);
                }
              } else {
                // 発売日が不明な場合は発売済みとして扱うが、
                // 登録済み本の発売日チェックができないため除外
                // （発売日が不明な本は表示しない）
                continue;
              }
            }

            // APIレート制限を考慮して少し待機
            await new Promise((resolve) => setTimeout(resolve, 500));
          } catch (err) {
            console.error(`Error fetching books for author ${author}:`, err);
            // エラーが発生しても他の著者の検索を続行
          }
        }

        // 発売日でソート（新しい順）
        allAvailableBooks.sort((a, b) => {
          const dateA = parseSalesDate(a.publishDate);
          const dateB = parseSalesDate(b.publishDate);
          if (!dateA || !dateB) return 0;
          return dateB.getTime() - dateA.getTime();
        });

        allPreorderBooks.sort((a, b) => {
          const dateA = parseSalesDate(a.publishDate);
          const dateB = parseSalesDate(b.publishDate);
          if (!dateA || !dateB) return 0;
          return dateA.getTime() - dateB.getTime(); // 予約は古い順（発売が近い順）
        });

        setAvailableBooks(allAvailableBooks);
        setPreorderBooks(allPreorderBooks);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching new books:', err);
        setError('新刊情報の取得に失敗しました');
        setLoading(false);
      }
    };

    fetchNewBooks();
  }, [user, userBooks]);

  const currentBooks = useMemo(() => {
    return activeTab === 'available' ? availableBooks : preorderBooks;
  }, [activeTab, availableBooks, preorderBooks]);

  const handleBookPress = (book: NewBook) => {
    setSelectedBook(book);
    setShowBookDetailModal(true);
  };

  const handleCloseModal = () => {
    setShowBookDetailModal(false);
    setSelectedBook(null);
  };

  const handleOpenRakutenLink = async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch (error) {
      console.error('Error opening browser:', error);
      Alert.alert('エラー', 'ブラウザを開けませんでした');
    }
  };

  const renderBookItem = ({ item }: { item: NewBook }) => {
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
            <View style={[styles.bookImagePlaceholder, {
              backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#E0E0E0',
            }]} />
          )}
          <View style={styles.bookInfo}>
            <ThemedText style={styles.bookTitle} numberOfLines={2}>
              {item.title}
            </ThemedText>
            {item.publishDateFormatted && (
              <ThemedText style={styles.publishDate}>
                {item.publishDateFormatted}
              </ThemedText>
            )}
            <ThemedText style={styles.bookAuthor} numberOfLines={1}>
              {item.author}
            </ThemedText>
          </View>
        </View>
      </Pressable>
    );
  };

  const renderSeparator = () => <View style={styles.itemDivider} />;

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <ThemedText style={styles.emptyText}>
        {activeTab === 'available'
          ? '発売中の新刊情報がありません'
          : '予約販売中の新刊情報がありません'}
      </ThemedText>
      <ThemedText style={styles.emptySubText}>
        登録した本の同作者の新刊が表示されます
      </ThemedText>
    </View>
  );

  if (loading && userBooks.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
        </View>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* タブバー */}
      <View style={styles.tabBar}>
        <Pressable
          style={[
            styles.tabButton,
            activeTab === 'available' && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab('available')}>
          <ThemedText
            style={[
              styles.tabButtonText,
              activeTab === 'available' && styles.tabButtonTextActive,
            ]}>
            発売中
          </ThemedText>
        </Pressable>
        <Pressable
          style={[
            styles.tabButton,
            activeTab === 'preorder' && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab('preorder')}>
          <ThemedText
            style={[
              styles.tabButtonText,
              activeTab === 'preorder' && styles.tabButtonTextActive,
            ]}>
            予約販売中
          </ThemedText>
        </Pressable>
      </View>

      {/* 書籍リスト */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
        </View>
      ) : (
        <FlatList
          data={currentBooks}
          renderItem={renderBookItem}
          keyExtractor={(item) => item.isbn}
          ItemSeparatorComponent={renderSeparator}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={renderEmptyState}
        />
      )}

      {/* 書籍詳細モーダル */}
      <Modal
        visible={showBookDetailModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseModal}>
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: Colors[colorScheme ?? 'light'].background },
            ]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>書籍詳細</ThemedText>
              <Pressable onPress={handleCloseModal}>
                <Icon
                  name="close"
                  size={24}
                  color={Colors[colorScheme ?? 'light'].text}
                />
              </Pressable>
            </View>

            {selectedBook && (
              <ScrollView
                style={styles.modalBody}
                showsVerticalScrollIndicator={false}>
                {/* 表紙画像 */}
                <View style={styles.coverContainer}>
                  {selectedBook.imageUrl ? (
                    <Image
                      source={{ uri: selectedBook.imageUrl }}
                      style={styles.coverImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <View
                      style={[
                        styles.coverPlaceholder,
                        {
                          backgroundColor:
                            colorScheme === 'dark' ? '#2A2A2A' : '#FFFFFF',
                        },
                      ]}>
                      <Icon
                        name="book"
                        size={48}
                        color={Colors[colorScheme ?? 'light'].icon}
                      />
                    </View>
                  )}
                </View>

                {/* タイトル */}
                <ThemedText style={styles.detailTitle}>
                  {selectedBook.title}
                </ThemedText>

                {/* 著者名 */}
                <ThemedText style={styles.detailAuthor}>
                  {selectedBook.author}
                </ThemedText>

                {/* 詳細情報 */}
                <View style={styles.detailsContainer}>
                  {selectedBook.publisher && (
                    <View style={styles.detailRow}>
                      <Icon
                        name="business"
                        size={20}
                        color={Colors[colorScheme ?? 'light'].icon}
                        style={styles.detailIcon}
                      />
                      <ThemedText style={styles.detailLabel}>出版社:</ThemedText>
                      <ThemedText style={styles.detailValue}>
                        {selectedBook.publisher}
                      </ThemedText>
                    </View>
                  )}

                  {selectedBook.publishDateFormatted && (
                    <View style={styles.detailRow}>
                      <Icon
                        name="calendar-today"
                        size={20}
                        color={Colors[colorScheme ?? 'light'].icon}
                        style={styles.detailIcon}
                      />
                      <ThemedText style={styles.detailLabel}>発売日:</ThemedText>
                      <ThemedText style={styles.detailValue}>
                        {selectedBook.publishDateFormatted}
                      </ThemedText>
                    </View>
                  )}

                  {selectedBook.price && (
                    <View style={styles.detailRow}>
                      <Icon
                        name="attach-money"
                        size={20}
                        color={Colors[colorScheme ?? 'light'].icon}
                        style={styles.detailIcon}
                      />
                      <ThemedText style={styles.detailLabel}>価格:</ThemedText>
                      <ThemedText style={styles.detailValue}>
                        ¥{selectedBook.price.toLocaleString()}
                      </ThemedText>
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
                    <ThemedText style={styles.detailValue}>
                      {selectedBook.isbn}
                    </ThemedText>
                  </View>
                </View>

                {/* あらすじ */}
                {selectedBook.description && (
                  <View style={styles.descriptionContainer}>
                    <ThemedText style={styles.descriptionTitle}>あらすじ</ThemedText>
                    <ThemedText style={styles.descriptionText}>
                      {selectedBook.description}
                    </ThemedText>
                  </View>
                )}

                {/* 楽天ブックスへのリンク */}
                {selectedBook.url && (
                  <Pressable
                    style={styles.linkButton}
                    onPress={() => handleOpenRakutenLink(selectedBook.url)}>
                    <Icon
                      name="open-in-new"
                      size={20}
                      color="#fff"
                      style={styles.linkIcon}
                    />
                    <ThemedText style={styles.linkButtonText}>
                      楽天ブックスで見る
                    </ThemedText>
                  </Pressable>
                )}
              </ScrollView>
            )}
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
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#838A2D',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  listContainer: {
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  bookItem: {
    paddingVertical: 16,
  },
  bookItemPressed: {
    opacity: 0.6,
  },
  bookItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookImage: {
    width: 80,
    height: 120,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
    marginRight: 16,
  },
  bookImagePlaceholder: {
    width: 80,
    height: 120,
    borderRadius: 4,
    marginRight: 16,
  },
  bookInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  bookTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    lineHeight: 22,
  },
  publishDate: {
    fontSize: 14,
    marginBottom: 6,
    opacity: 0.8,
  },
  bookAuthor: {
    fontSize: 14,
    opacity: 0.7,
  },
  itemDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginLeft: 96, // 画像の幅 + マージン
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '600',
  },
  emptySubText: {
    fontSize: 14,
    opacity: 0.7,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FF0000',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '90%',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalBody: {
    flex: 1,
    paddingHorizontal: 20,
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
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  detailTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 30,
  },
  detailAuthor: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.7,
  },
  detailsContainer: {
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  detailIcon: {
    marginRight: 12,
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
    marginBottom: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  descriptionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 24,
    opacity: 0.9,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#838A2D',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
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