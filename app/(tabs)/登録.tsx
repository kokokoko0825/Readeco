import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Icon } from '@/components/Icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getUserId } from '@/utils/firebase-auth';
import { addBookToFirebase, isBookAlreadyAdded } from '@/utils/firebase-books';
import {
  searchBookByISBN,
  searchBooksByQuery,
  type Book,
} from '@/utils/rakuten-api';

export default function RegisterScreen() {
  const colorScheme = useColorScheme();
  const [titleInput, setTitleInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [foundBook, setFoundBook] = useState<Book | null>(null);
  const [showBookModal, setShowBookModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<Book[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showIsbnModal, setShowIsbnModal] = useState(false);
  const [isbnModalInput, setIsbnModalInput] = useState('');
  const [isIsbnModalSearching, setIsIsbnModalSearching] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleBarcodeScan = () => {
    router.push('/(modals)/barcode-scanner');
  };

  const handleIsbnImport = () => {
    setShowIsbnModal(true);
    setIsbnModalInput('');
  };

  const handleIsbnModalSearch = async () => {
    if (!isbnModalInput.trim()) {
      Alert.alert('エラー', 'ISBNコードを入力してください');
      return;
    }

    // ISBNコードを正規化（ハイフンとスペースを削除）
    const normalizedISBN = isbnModalInput.replace(/[-\s]/g, '');

    // ISBNの形式をチェック（10桁または13桁の数字）
    if (!/^\d{10}(\d{3})?$/.test(normalizedISBN)) {
      Alert.alert('エラー', '有効なISBNコードを入力してください（10桁または13桁の数字）');
      return;
    }

    setIsIsbnModalSearching(true);
    try {
      const book = await searchBookByISBN(normalizedISBN);
      if (!book) {
        Alert.alert('見つかりませんでした', 'このISBNコードの本が見つかりませんでした。');
        setIsIsbnModalSearching(false);
        return;
      }

      // モーダルを閉じて、本の情報モーダルを表示
      setShowIsbnModal(false);
      setIsbnModalInput('');
      setFoundBook(book);
      setShowBookModal(true);
    } catch (error) {
      console.error('Error searching book by ISBN:', error);
      Alert.alert(
        'エラー',
        error instanceof Error ? error.message : '本の検索に失敗しました'
      );
    } finally {
      setIsIsbnModalSearching(false);
    }
  };

  const handleManualImport = () => {
    router.push('/(modals)/manual-book-entry');
  };

  // タイトル入力時の予測検索
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (titleInput.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsLoadingSuggestions(true);
      try {
        const results = await searchBooksByQuery(titleInput.trim(), 3);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch (error) {
        console.error('Error loading suggestions:', error);
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setIsLoadingSuggestions(false);
      }
    }, 500); // 500msのデバウンス

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [titleInput]);

  const handleSearchByTitle = async () => {
    if (!titleInput.trim()) {
      Alert.alert('エラー', 'タイトルを入力してください');
      return;
    }

    setIsSearching(true);
    setShowSuggestions(false);
    try {
      const results = await searchBooksByQuery(titleInput.trim(), 10);
      if (results.length === 0) {
        Alert.alert('見つかりませんでした', 'このタイトルの本が見つかりませんでした。');
        setIsSearching(false);
        return;
      }

      // 検索結果が1つの場合は直接表示、複数の場合は最初の1つを表示
      setFoundBook(results[0]);
      setShowBookModal(true);
    } catch (error) {
      console.error('Error searching book by title:', error);
      Alert.alert(
      'エラー',
      error instanceof Error ? error.message : '本の検索に失敗しました'
    );
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSuggestion = (book: Book) => {
    setTitleInput('');
    setShowSuggestions(false);
    setFoundBook(book);
    setShowBookModal(true);
  };

  const handleAddBook = async () => {
    if (!foundBook || isSaving) return;

    setIsSaving(true);
    try {
      const userId = getUserId();
      if (!userId) {
        Alert.alert('エラー', 'ログインが必要です');
        setIsSaving(false);
        return;
      }

      // 既に登録されているかチェック
      const alreadyAdded = await isBookAlreadyAdded(userId, foundBook.isbn);
      if (alreadyAdded) {
        Alert.alert('既に登録されています', 'この本は既に本棚に追加されています。');
        setIsSaving(false);
        return;
      }

      // Firebaseに保存
      await addBookToFirebase(foundBook, userId, foundBook.description);

      // 状態をリセット
      setShowBookModal(false);
      setFoundBook(null);
      setTitleInput('');

      Alert.alert('追加完了', '本棚に追加しました。', [
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
      Alert.alert('エラー', '本の追加に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const menuItems = [
    {
      id: 'barcode',
      icon: (
        <Icon
          name="barcode-scan"
          size={24}
          color={Colors[colorScheme ?? 'light'].text}
        />
      ),
      text: 'バーコードを読み込む',
      onPress: handleBarcodeScan,
    },
    {
      id: 'isbn',
      icon: (
        <Icon
          name="confirmation-number"
          size={24}
          color={Colors[colorScheme ?? 'light'].text}
        />
      ),
      text: 'ISBNでインポート',
      onPress: handleIsbnImport,
    },
    {
      id: 'manual',
      icon: (
        <Icon
          name="edit"
          size={24}
          color={Colors[colorScheme ?? 'light'].text}
        />
      ),
      text: '手動でデータをインポート',
      onPress: handleManualImport,
    },
  ];

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* タイトル検索エリア */}
        <View style={styles.searchSection}>
          <ThemedText style={styles.sectionTitle}>タイトルで検索</ThemedText>
          <View style={styles.titleInputContainer}>
            <TextInput
              style={[
                styles.titleInput,
                {
                  color: Colors[colorScheme ?? 'light'].text,
                  backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#FFFFFF',
                  borderColor: colorScheme === 'dark' ? '#404040' : '#E0E0E0',
                },
              ]}
              value={titleInput}
              onChangeText={setTitleInput}
              placeholder="タイトルを入力"
              placeholderTextColor="#999"
              autoCapitalize="none"
              editable={!isSearching}
              onFocus={() => {
                if (suggestions.length > 0) {
                  setShowSuggestions(true);
                }
              }}
            />
            <Pressable
              style={[
                styles.searchButton,
                isSearching && styles.searchButtonDisabled,
              ]}
              onPress={handleSearchByTitle}
              disabled={isSearching}>
              {isSearching ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <ThemedText style={styles.searchButtonText}>検索</ThemedText>
              )}
            </Pressable>
          </View>
          <ThemedText style={styles.inputHint}>
            タイトルを入力して本を検索・登録できます
          </ThemedText>

          {/* 予測検索結果 */}
          {showSuggestions && suggestions.length > 0 && (
            <View
              style={[
                styles.suggestionsContainer,
                {
                  backgroundColor: Colors[colorScheme ?? 'light'].background,
                  borderColor: colorScheme === 'dark' ? '#404040' : '#E0E0E0',
                },
              ]}>
              {isLoadingSuggestions ? (
                <View style={styles.suggestionLoading}>
                  <ActivityIndicator size="small" color={Colors[colorScheme ?? 'light'].text} />
                </View>
              ) : (
                suggestions.slice(0, 3).map((book, index) => (
                  <TouchableOpacity
                    key={`${book.isbn}-${index}`}
                    style={[
                      styles.suggestionItem,
                      index < suggestions.length - 1 && styles.suggestionItemBorder,
                    ]}
                    onPress={() => handleSelectSuggestion(book)}>
                    {book.imageUrl && (
                      <Image source={{ uri: book.imageUrl }} style={styles.suggestionImage} />
                    )}
                    <View style={styles.suggestionContent}>
                      <ThemedText style={styles.suggestionTitle} numberOfLines={1}>
                        {book.title}
                      </ThemedText>
                      <ThemedText style={styles.suggestionAuthor} numberOfLines={1}>
                        {book.author}
                      </ThemedText>
                    </View>
                    <Icon
                      name="keyboard-arrow-down"
                      size={20}
                      color={Colors[colorScheme ?? 'light'].text}
                      style={styles.suggestionArrow}
                    />
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </View>

        {/* 区切り線 */}
        <View style={styles.divider} />

        {/* メニューアイテム */}
        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => (
            <View key={item.id}>
              <Pressable
                style={({ pressed }) => [
                  styles.menuItem,
                  pressed && styles.menuItemPressed,
                ]}
                onPress={item.onPress}>
                <View style={styles.menuItemContent}>
                  <View style={styles.iconContainer}>{item.icon}</View>
                  <ThemedText style={styles.menuItemText}>{item.text}</ThemedText>
                </View>
              </Pressable>
              {index < menuItems.length - 1 && <View style={styles.itemDivider} />}
            </View>
          ))}
        </View>
      </ScrollView>

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

            {foundBook && (
              <ScrollView style={styles.modalBody}>
                {/* 本の画像 */}
                {foundBook.imageUrl && (
                  <View style={styles.bookImageContainer}>
                    <Image
                      source={{ uri: foundBook.imageUrl }}
                      style={styles.bookImage}
                      resizeMode="contain"
                    />
                  </View>
                )}

                {/* タイトル */}
                <ThemedText style={styles.bookTitle}>{foundBook.title}</ThemedText>

                {/* 作者名 */}
                <ThemedText style={styles.bookAuthor}>{foundBook.author}</ThemedText>

                {/* ISBN */}
                <View style={styles.bookInfoRow}>
                  <ThemedText style={styles.bookInfoLabel}>ISBN:</ThemedText>
                  <ThemedText style={styles.bookInfoValue}>{foundBook.isbn}</ThemedText>
                </View>

                {/* 出版社 */}
                {foundBook.publisher && (
                  <View style={styles.bookInfoRow}>
                    <ThemedText style={styles.bookInfoLabel}>出版社:</ThemedText>
                    <ThemedText style={styles.bookInfoValue}>{foundBook.publisher}</ThemedText>
                  </View>
                )}

                {/* 発売日 */}
                {foundBook.publishDate && (
                  <View style={styles.bookInfoRow}>
                    <ThemedText style={styles.bookInfoLabel}>発売日:</ThemedText>
                    <ThemedText style={styles.bookInfoValue}>{foundBook.publishDate}</ThemedText>
                  </View>
                )}

                {/* 価格 */}
                {foundBook.price && (
                  <View style={styles.bookInfoRow}>
                    <ThemedText style={styles.bookInfoLabel}>価格:</ThemedText>
                    <ThemedText style={styles.bookInfoValue}>
                      ¥{foundBook.price.toLocaleString()}
                    </ThemedText>
                  </View>
                )}
              </ScrollView>
            )}

            {/* モーダルフッター */}
            <View style={styles.modalFooter}>
              <Pressable
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowBookModal(false);
                  setFoundBook(null);
                }}>
                <ThemedText style={styles.cancelButtonText}>キャンセル</ThemedText>
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

      {/* ISBN入力モーダル（フルスクリーン） */}
      <Modal
        visible={showIsbnModal}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setShowIsbnModal(false)}>
        <ThemedView style={styles.fullModalContainer}>
          <View style={styles.fullModalHeader}>
            <ThemedText style={styles.fullModalTitle}>ISBNでインポート</ThemedText>
            <Pressable
              onPress={() => {
                setShowIsbnModal(false);
                setIsbnModalInput('');
              }}>
              <Icon
                name="close"
                size={24}
                color={Colors[colorScheme ?? 'light'].text}
              />
            </Pressable>
          </View>

          <View style={styles.fullModalBody}>
            <ThemedText style={styles.fullModalLabel}>ISBNコード</ThemedText>
            <TextInput
              style={[
                styles.fullModalInput,
                {
                  color: Colors[colorScheme ?? 'light'].text,
                  backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#FFFFFF',
                  borderColor: colorScheme === 'dark' ? '#404040' : '#E0E0E0',
                },
              ]}
              value={isbnModalInput}
              onChangeText={setIsbnModalInput}
              placeholder="ISBNコードを入力（10桁または13桁）"
              placeholderTextColor="#999"
              keyboardType="numeric"
              autoCapitalize="none"
              autoFocus={true}
              editable={!isIsbnModalSearching}
            />
            <ThemedText style={styles.fullModalHint}>
              ISBNコードを入力して本を検索・登録できます
            </ThemedText>

            <Pressable
              style={[
                styles.fullModalSearchButton,
                isIsbnModalSearching && styles.fullModalSearchButtonDisabled,
              ]}
              onPress={handleIsbnModalSearch}
              disabled={isIsbnModalSearching}>
              {isIsbnModalSearching ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <ThemedText style={styles.fullModalSearchButtonText}>検索</ThemedText>
              )}
            </Pressable>
          </View>
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  searchSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  titleInputContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  titleInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  suggestionsContainer: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    maxHeight: 300,
  },
  suggestionLoading: {
    padding: 16,
    alignItems: 'center',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  suggestionItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  suggestionImage: {
    width: 40,
    height: 60,
    borderRadius: 4,
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  suggestionAuthor: {
    fontSize: 12,
    opacity: 0.7,
  },
  suggestionArrow: {
    transform: [{ rotate: '-90deg' }],
  },
  searchButton: {
    backgroundColor: '#838A2D',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  searchButtonDisabled: {
    opacity: 0.6,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  inputHint: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 4,
  },
  divider: {
    height: 8,
    backgroundColor: '#F5F5F5',
  },
  menuContainer: {
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  menuItem: {
    paddingVertical: 16,
  },
  menuItemPressed: {
    opacity: 0.6,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    marginRight: 16,
    width: 24,
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 16,
    flex: 1,
  },
  itemDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  fullModalContainer: {
    flex: 1,
  },
  fullModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  fullModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  fullModalBody: {
    flex: 1,
    padding: 20,
  },
  fullModalLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  fullModalInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    marginBottom: 8,
  },
  fullModalHint: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 24,
  },
  fullModalSearchButton: {
    backgroundColor: '#838A2D',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullModalSearchButtonDisabled: {
    opacity: 0.6,
  },
  fullModalSearchButtonText: {
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
  bookImage: {
    width: 150,
    height: 200,
    borderRadius: 8,
  },
  bookTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  bookAuthor: {
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
});

