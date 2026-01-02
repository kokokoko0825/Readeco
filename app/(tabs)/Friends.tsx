import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Icon } from '@/components/Icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { showAlert } from '@/utils/alert';
import { extractBaseTitle, getBooksBySeriesKey, getGroupedBooksRepresentatives } from '@/utils/book-series';
import { getUserId } from '@/utils/firebase-auth';
import { getBooksByUserIds, type BookData } from '@/utils/firebase-books';
import { getUserFriends, type FriendRelation } from '@/utils/firebase-friends';

// フレンドの本の型（BookDataにフレンド情報を追加）
interface FriendBook extends BookData {
  friendDisplayName: string;
  friendId: string;
}

export default function FriendsScreen() {
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  const [friends, setFriends] = useState<FriendRelation[]>([]);
  const [friendBooks, setFriendBooks] = useState<FriendBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeriesKey, setSelectedSeriesKey] = useState<string | null>(null);
  const [showSeriesModal, setShowSeriesModal] = useState(false);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      const userId = getUserId();
      if (!userId) {
        setLoading(false);
        return;
      }

      // フレンド一覧を取得
      const friendsList = await getUserFriends(userId);
      setFriends(friendsList);

      // フレンドの本を取得
      if (friendsList.length > 0) {
        const friendIds = friendsList.map((f) => f.friendId);
        const books = await getBooksByUserIds(friendIds);

        // フレンド情報を本に追加
        const booksWithFriendInfo: FriendBook[] = books.map((book) => {
          const friend = friendsList.find((f) => f.friendId === book.userId);
          return {
            ...book,
            friendDisplayName: friend?.friendDisplayName || '不明',
            friendId: book.userId,
          };
        });

        setFriendBooks(booksWithFriendInfo);
      } else {
        setFriendBooks([]);
      }
    } catch (error) {
      console.error('Error loading friends data:', error);
      showAlert('エラー', 'データの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // フィルターされた本のリスト
  const filteredBooks = useMemo(() => {
    let filtered = friendBooks;

    // フレンドでフィルター
    if (selectedFriendId) {
      filtered = filtered.filter((book) => book.friendId === selectedFriendId);
    }

    // 検索クエリでフィルター
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (book) =>
          book.title.toLowerCase().includes(query) ||
          book.author.toLowerCase().includes(query) ||
          book.friendDisplayName.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [friendBooks, selectedFriendId, searchQuery]);

  // シリーズでグループ化された書籍リスト
  const groupedFilteredBooks = useMemo(() => {
    return getGroupedBooksRepresentatives(filteredBooks);
  }, [filteredBooks]);

  // 選択されたシリーズの本一覧
  const selectedSeriesBooks = useMemo(() => {
    if (!selectedSeriesKey) return [];
    return getBooksBySeriesKey(filteredBooks, selectedSeriesKey);
  }, [selectedSeriesKey, filteredBooks]);

  // シリーズの基本タイトルを取得
  const seriesBaseTitle = useMemo(() => {
    if (!selectedSeriesKey || selectedSeriesBooks.length === 0) return '';
    const firstBook = selectedSeriesBooks[0];
    return extractBaseTitle(firstBook.title);
  }, [selectedSeriesKey, selectedSeriesBooks]);

  const handleBookPress = (item: FriendBook) => {
    const seriesCount = (item as FriendBook & { _seriesCount?: number })._seriesCount;
    const seriesKey = (item as FriendBook & { _seriesKey?: string })._seriesKey;
    const hasSeries = seriesCount !== undefined && seriesCount > 1 && seriesKey;

    if (hasSeries) {
      // シリーズの場合はモーダルを表示
      setSelectedSeriesKey(seriesKey);
      setShowSeriesModal(true);
    } else {
      // 単体の場合は詳細ページに遷移
      if (item.id) {
        router.push({
          pathname: '/book/[id]',
          params: { id: item.id },
        });
      }
    }
  };

  const renderBookItem = ({ item }: { item: FriendBook }) => {
    const seriesCount = (item as FriendBook & { _seriesCount?: number })._seriesCount;
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

  const renderEmptyState = () => {
    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator
            size="large"
            color={Colors[colorScheme ?? 'light'].text}
          />
          <ThemedText style={styles.emptyText}>読み込み中...</ThemedText>
        </View>
      );
    }

    if (friends.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Icon
            name="people-outline"
            size={48}
            color={Colors[colorScheme ?? 'light'].icon}
          />
          <ThemedText style={styles.emptyText}>
            フレンドが登録されていません
          </ThemedText>
          <ThemedText style={styles.emptySubText}>
            設定ページからフレンドを追加してください
          </ThemedText>
        </View>
      );
    }

    if (friendBooks.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Icon
            name="book"
            size={48}
            color={Colors[colorScheme ?? 'light'].icon}
          />
          <ThemedText style={styles.emptyText}>
            フレンドの登録した本がありません
          </ThemedText>
          <ThemedText style={styles.emptySubText}>
            フレンドが本を登録するとここに表示されます
          </ThemedText>
        </View>
      );
    }

    if (groupedFilteredBooks.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Icon
            name="search-off"
            size={48}
            color={Colors[colorScheme ?? 'light'].icon}
          />
          <ThemedText style={styles.emptyText}>
            条件に一致する本が見つかりませんでした
          </ThemedText>
          <ThemedText style={styles.emptySubText}>
            フィルターを変更して再度お試しください
          </ThemedText>
        </View>
      );
    }

    return null;
  };

  const selectedFriend = friends.find((f) => f.friendId === selectedFriendId);

  return (
    <ThemedView style={styles.container}>
      
      {/* フィルター選択部分 */}
      <View style={styles.filterHeader}>
        <Pressable
          style={({ pressed }) => [
            styles.filterSelector,
            {
              backgroundColor: pressed
                ? colorScheme === 'dark'
                  ? '#2A2A2A'
                  : 'rgba(0, 0, 0, 0.05)'
                : 'transparent',
            },
          ]}
          onPress={() => setShowFilterModal(true)}>
          <ThemedText style={styles.filterText}>
            {selectedFriend ? selectedFriend.friendDisplayName : '全て'}
          </ThemedText>
          <Icon
            name="keyboard-arrow-down"
            size={20}
            color={Colors[colorScheme ?? 'light'].text}
          />
        </Pressable>
      </View>

      {/* 本のリスト */}
      <FlatList
        data={groupedFilteredBooks}
        renderItem={renderBookItem}
        keyExtractor={(item) => item.id || `${item.friendId}-${item.isbn}`}
        numColumns={3}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={renderEmptyState}
        refreshing={loading}
        onRefresh={loadData}
        columnWrapperStyle={styles.row}
      />

      {/* フィルターモーダル */}
      <Modal
        visible={showFilterModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}>
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: Colors[colorScheme ?? 'light'].background },
            ]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>フィルター</ThemedText>
              <Pressable onPress={() => setShowFilterModal(false)}>
                <Icon
                  name="close"
                  size={24}
                  color={Colors[colorScheme ?? 'light'].text}
                />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* 検索バー */}
              <View style={styles.searchContainer}>
                <Icon
                  name="search"
                  size={20}
                  color={Colors[colorScheme ?? 'light'].text}
                  style={styles.searchIcon}
                />
                <TextInput
                  style={[
                    styles.searchInput,
                    { color: Colors[colorScheme ?? 'light'].text },
                  ]}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="タイトル、著者、フレンド名で検索"
                  placeholderTextColor="#999"
                />
                {searchQuery.length > 0 && (
                  <Pressable
                    style={styles.clearSearchButton}
                    onPress={() => setSearchQuery('')}>
                    <Icon name="close" size={18} color="#999" />
                  </Pressable>
                )}
              </View>

              {/* フレンド一覧 */}
              <ThemedText style={styles.filterSectionTitle}>フレンド</ThemedText>
              <Pressable
                style={[
                  styles.friendOption,
                  !selectedFriendId && {
                    backgroundColor:
                      colorScheme === 'dark' ? '#2A2A2A' : '#F0F0F0',
                  },
                ]}
                onPress={() => {
                  setSelectedFriendId(null);
                }}>
                <Icon
                  name={!selectedFriendId ? 'radio-button-checked' : 'radio-button-unchecked'}
                  size={20}
                  color={!selectedFriendId ? '#838A2D' : Colors[colorScheme ?? 'light'].text}
                />
                <ThemedText style={styles.friendOptionText}>すべてのフレンド</ThemedText>
              </Pressable>
              {friends.map((friend) => (
                <Pressable
                  key={friend.id}
                  style={[
                    styles.friendOption,
                    selectedFriendId === friend.friendId && {
                      backgroundColor:
                        colorScheme === 'dark' ? '#2A2A2A' : '#F0F0F0',
                    },
                  ]}
                  onPress={() => {
                    setSelectedFriendId(friend.friendId);
                  }}>
                  <Icon
                    name={
                      selectedFriendId === friend.friendId
                        ? 'radio-button-checked'
                        : 'radio-button-unchecked'
                    }
                    size={20}
                    color={
                      selectedFriendId === friend.friendId
                        ? '#838A2D'
                        : Colors[colorScheme ?? 'light'].text
                    }
                  />
                  <ThemedText style={styles.friendOptionText}>
                    {friend.friendDisplayName}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable
                style={[styles.modalButton, styles.applyButton]}
                onPress={() => setShowFilterModal(false)}>
                <ThemedText style={styles.applyButtonText}>適用</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* シリーズ一覧モーダル */}
      <Modal
        visible={showSeriesModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSeriesModal(false)}>
        <View style={styles.seriesModalOverlay}>
          <View
            style={[
              styles.seriesModalContent,
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
                renderItem={({ item }) => (
                  <Pressable
                    style={({ pressed }) => [
                      styles.seriesBookItem,
                      pressed && styles.bookItemPressed,
                    ]}
                    onPress={() => {
                      setShowSeriesModal(false);
                      if (item.id) {
                        router.push({
                          pathname: '/book/[id]',
                          params: { id: item.id },
                        });
                      }
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
                )}
                keyExtractor={(item) => item.id || `${item.userId}-${item.isbn}`}
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
  header: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  filterHeader: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 12,
  },
  filterSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  filterText: {
    fontSize: 16,
  },
  listContainer: {
    paddingTop: 8,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
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
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 24,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  clearSearchButton: {
    padding: 4,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  friendOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  friendOptionText: {
    fontSize: 16,
    marginLeft: 12,
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
  },
  applyButton: {
    backgroundColor: '#838A2D',
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  seriesModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  seriesModalContent: {
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
