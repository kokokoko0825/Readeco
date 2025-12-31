import { useState, useEffect } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  TextInput,
  Alert,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getUserSettings, setUserSettings, type UserSettings } from '@/utils/firebase-users';
import {
  getUserFriends,
  addFriend,
  removeFriend,
  searchUserByUserId,
  type FriendRelation,
} from '@/utils/firebase-friends';
import { getUserId } from '@/utils/firebase-auth';
import { useAuth } from '@/contexts/AuthContext';
import { signOutUser } from '@/utils/firebase-auth';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  const [userId, setUserId] = useState<string | null>(null);
  const [userSettings, setUserSettingsState] = useState<UserSettings | null>(null);
  const [friends, setFriends] = useState<FriendRelation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUserSettingsModal, setShowUserSettingsModal] = useState(false);
  const [showFriendModal, setShowFriendModal] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [friendUserId, setFriendUserId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      const id = getUserId();
      if (!id) {
        setLoading(false);
        return;
      }
      setUserId(id);

      // ユーザー設定を取得
      const settings = await getUserSettings(id);
      if (settings) {
        setUserSettingsState(settings);
        setDisplayName(settings.displayName);
      } else {
        // 新規ユーザーの場合はデフォルト設定を作成
        await setUserSettings(id, { displayName: 'ユーザー' });
        const newSettings = await getUserSettings(id);
        if (newSettings) {
          setUserSettingsState(newSettings);
          setDisplayName(newSettings.displayName);
        }
      }

      // フレンド一覧を取得
      const friendsList = await getUserFriends(id);
      setFriends(friendsList);
    } catch (error) {
      console.error('Error loading settings:', error);
      Alert.alert('エラー', '設定の読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveUserSettings = async () => {
    if (!userId || !displayName.trim()) {
      Alert.alert('エラー', '表示名を入力してください');
      return;
    }

    try {
      setSaving(true);
      await setUserSettings(userId, { displayName: displayName.trim() });
      const updatedSettings = await getUserSettings(userId);
      if (updatedSettings) {
        setUserSettingsState(updatedSettings);
      }
      setShowUserSettingsModal(false);
      Alert.alert('保存完了', '設定を保存しました');
    } catch (error) {
      console.error('Error saving user settings:', error);
      Alert.alert('エラー', '設定の保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleAddFriend = async () => {
    if (!userId || !friendUserId.trim()) {
      Alert.alert('エラー', 'ユーザーIDを入力してください');
      return;
    }

    try {
      setSaving(true);
      // ユーザーを検索
      const friendUser = await searchUserByUserId(friendUserId.trim());
      if (!friendUser) {
        Alert.alert('エラー', 'ユーザーが見つかりませんでした');
        return;
      }

      await addFriend(userId, friendUser.userId, friendUser.displayName);
      setFriendUserId('');
      setShowFriendModal(false);
      await loadData(); // フレンド一覧を再読み込み
      Alert.alert('追加完了', 'フレンドを追加しました');
    } catch (error) {
      console.error('Error adding friend:', error);
      if (error instanceof Error) {
        Alert.alert('エラー', error.message);
      } else {
        Alert.alert('エラー', 'フレンドの追加に失敗しました');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveFriend = async (friendRelationId: string, friendName: string) => {
    Alert.alert('削除確認', `${friendName}をフレンドリストから削除しますか？`, [
      {
        text: 'キャンセル',
        style: 'cancel',
      },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeFriend(friendRelationId);
            await loadData(); // フレンド一覧を再読み込み
            Alert.alert('削除完了', 'フレンドを削除しました');
          } catch (error) {
            console.error('Error removing friend:', error);
            Alert.alert('エラー', 'フレンドの削除に失敗しました');
          }
        },
      },
    ]);
  };

  const handleSignOut = async () => {
    Alert.alert('サインアウト', 'ログアウトしますか？', [
      {
        text: 'キャンセル',
        style: 'cancel',
      },
      {
        text: 'サインアウト',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOutUser();
            // 認証画面にリダイレクト（AuthGuardが処理）
          } catch (error) {
            console.error('Error signing out:', error);
            Alert.alert('エラー', 'サインアウトに失敗しました');
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

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* ユーザー情報セクション */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>ユーザー情報</ThemedText>
          <View style={styles.userInfoContainer}>
            <ThemedText style={styles.userInfoLabel}>表示名:</ThemedText>
            <ThemedText style={styles.userInfoValue}>
              {userSettings?.displayName || '未設定'}
            </ThemedText>
          </View>
          {userId && (
            <View style={styles.userInfoContainer}>
              <ThemedText style={styles.userInfoLabel}>ユーザーID:</ThemedText>
              <ThemedText style={styles.userInfoValue} numberOfLines={1}>
                {userId}
              </ThemedText>
            </View>
          )}
          <Pressable
            style={styles.editButton}
            onPress={() => setShowUserSettingsModal(true)}>
            <MaterialIcons
              name="edit"
              size={20}
              color="#fff"
              style={styles.editButtonIcon}
            />
            <ThemedText style={styles.editButtonText}>ユーザー設定を編集</ThemedText>
          </Pressable>
        </View>

        {/* フレンドセクション */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>フレンド</ThemedText>
            <Pressable
              style={styles.addButton}
              onPress={() => setShowFriendModal(true)}>
              <MaterialIcons name="person-add" size={20} color="#fff" />
            </Pressable>
          </View>
          {friends.length === 0 ? (
            <ThemedText style={styles.emptyText}>フレンドが登録されていません</ThemedText>
          ) : (
            friends.map((friend) => (
              <View key={friend.id} style={styles.friendItem}>
                <View style={styles.friendInfo}>
                  <MaterialIcons
                    name="person"
                    size={24}
                    color={Colors[colorScheme ?? 'light'].text}
                    style={styles.friendIcon}
                  />
                  <View style={styles.friendDetails}>
                    <ThemedText style={styles.friendName}>{friend.friendDisplayName}</ThemedText>
                    <ThemedText style={styles.friendId}>{friend.friendId}</ThemedText>
                  </View>
                </View>
                <Pressable
                  style={styles.removeFriendButton}
                  onPress={() => handleRemoveFriend(friend.id!, friend.friendDisplayName)}>
                  <MaterialIcons name="delete-outline" size={20} color="#ff4444" />
                </Pressable>
              </View>
            ))
          )}
        </View>

        {/* サインアウトセクション */}
        <View style={styles.section}>
          <Pressable style={styles.signOutButton} onPress={handleSignOut}>
            <MaterialIcons name="logout" size={20} color="#ff4444" style={styles.signOutIcon} />
            <ThemedText style={styles.signOutText}>サインアウト</ThemedText>
          </Pressable>
        </View>
      </ScrollView>

      {/* ユーザー設定モーダル */}
      <Modal
        visible={showUserSettingsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowUserSettingsModal(false)}>
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: Colors[colorScheme ?? 'light'].background },
            ]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>ユーザー設定</ThemedText>
              <Pressable onPress={() => setShowUserSettingsModal(false)}>
                <MaterialIcons
                  name="close"
                  size={24}
                  color={Colors[colorScheme ?? 'light'].text}
                />
              </Pressable>
            </View>
            <View style={styles.modalBody}>
              <ThemedText style={styles.inputLabel}>表示名</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { color: Colors[colorScheme ?? 'light'].text, borderColor: '#E0E0E0' },
                ]}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="表示名を入力"
                placeholderTextColor="#999"
              />
            </View>
            <View style={styles.modalFooter}>
              <Pressable
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowUserSettingsModal(false)}>
                <ThemedText style={styles.cancelButtonText}>キャンセル</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveUserSettings}
                disabled={saving}>
                <ThemedText style={styles.saveButtonText}>
                  {saving ? '保存中...' : '保存'}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* フレンド追加モーダル */}
      <Modal
        visible={showFriendModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFriendModal(false)}>
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: Colors[colorScheme ?? 'light'].background },
            ]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>フレンドを追加</ThemedText>
              <Pressable onPress={() => setShowFriendModal(false)}>
                <MaterialIcons
                  name="close"
                  size={24}
                  color={Colors[colorScheme ?? 'light'].text}
                />
              </Pressable>
            </View>
            <View style={styles.modalBody}>
              <ThemedText style={styles.inputLabel}>ユーザーID</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { color: Colors[colorScheme ?? 'light'].text, borderColor: '#E0E0E0' },
                ]}
                value={friendUserId}
                onChangeText={setFriendUserId}
                placeholder="フレンドのユーザーIDを入力"
                placeholderTextColor="#999"
                autoCapitalize="none"
              />
              <ThemedText style={styles.inputHint}>
                フレンドのユーザーIDを入力して追加してください
              </ThemedText>
            </View>
            <View style={styles.modalFooter}>
              <Pressable
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowFriendModal(false)}>
                <ThemedText style={styles.cancelButtonText}>キャンセル</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleAddFriend}
                disabled={saving}>
                <ThemedText style={styles.saveButtonText}>
                  {saving ? '追加中...' : '追加'}
                </ThemedText>
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
  scrollView: {
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
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  userInfoContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  userInfoLabel: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 100,
  },
  userInfoValue: {
    fontSize: 14,
    flex: 1,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#838A2D',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
  },
  editButtonIcon: {
    marginRight: 8,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#838A2D',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
    paddingVertical: 20,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  friendIcon: {
    marginRight: 12,
  },
  friendDetails: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  friendId: {
    fontSize: 12,
    opacity: 0.6,
  },
  removeFriendButton: {
    padding: 8,
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
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  inputHint: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 4,
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
  cancelButton: {
    backgroundColor: '#E0E0E0',
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#838A2D',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ff4444',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  signOutIcon: {
    marginRight: 8,
  },
  signOutText: {
    color: '#ff4444',
    fontSize: 16,
    fontWeight: '600',
  },
});

