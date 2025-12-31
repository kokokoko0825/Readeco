import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

// TODO: 実際のデータ構造に合わせて型を定義
interface FriendBook {
  id: string;
  title: string;
  author: string;
  friendName: string;
  // 他のプロパティを追加
}

export default function FriendsScreen() {
  const colorScheme = useColorScheme();

  // TODO: 実際のデータ取得ロジックに置き換え
  const friendBooks: FriendBook[] = [];

  const renderBookItem = ({ item }: { item: FriendBook }) => {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.bookItem,
          pressed && styles.bookItemPressed,
        ]}
        onPress={() => {
          // TODO: 本の詳細画面に遷移
          console.log('Friend book pressed:', item.id);
        }}>
        <View style={styles.bookItemContent}>
          <MaterialIcons
            name="book"
            size={24}
            color={Colors[colorScheme ?? 'light'].text}
            style={styles.bookIcon}
          />
          <View style={styles.bookInfo}>
            <ThemedText style={styles.bookTitle}>{item.title}</ThemedText>
            <View style={styles.bookMeta}>
              <ThemedText style={styles.bookAuthor}>{item.author}</ThemedText>
              <ThemedText style={styles.friendName}>
                {item.friendName}が登録
              </ThemedText>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  const renderSeparator = () => <View style={styles.itemDivider} />;

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons
        name="people-outline"
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

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={friendBooks}
        renderItem={renderBookItem}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={renderSeparator}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={renderEmptyState}
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
    paddingHorizontal: 20,
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
  bookIcon: {
    marginRight: 16,
  },
  bookInfo: {
    flex: 1,
  },
  bookTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  bookMeta: {
    gap: 2,
  },
  bookAuthor: {
    fontSize: 14,
    opacity: 0.7,
  },
  friendName: {
    fontSize: 12,
    opacity: 0.6,
  },
  itemDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
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
});

