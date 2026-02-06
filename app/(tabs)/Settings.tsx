import { APP_VERSION } from '@/constants/release-notes';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useReleaseNotes } from '@/contexts/ReleaseNotesContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { showAlert } from '@/utils/alert';
import { copyToClipboard } from '@/utils/clipboard';
import {
  deleteUserAccount,
  getUserEmail,
  getUserId,
  isGoogleUser,
  signOutUser,
  updateUserEmail,
  updateUserPassword,
} from '@/utils/firebase-auth';
import {
  addFriend,
  getUserFriends,
  removeFriend,
  searchUserByUserId,
  type FriendRelation,
} from '@/utils/firebase-friends';
import {
  getUserSettings,
  setUserSettings,
  type UserSettings,
} from '@/utils/firebase-users';

type ModalType =
  | 'displayName'
  | 'email'
  | 'password'
  | 'deleteAccount'
  | 'addFriend'
  | 'faq'
  | 'terms'
  | 'copyright'
  | 'privacy'
  | null;

// FAQデータ
const FAQ_DATA = [
  {
    question: 'バーコードがうまく読み取れません',
    answer: 'カメラを本のバーコードに近づけ、明るい場所でスキャンしてください。ISBN バーコード（978または979で始まる13桁の数字）に対応しています。',
  },
  {
    question: '登録した本が見つかりません',
    answer: '楽天ブックスおよびGoogle Books のデータベースに登録されていない本は検索できない場合があります。',
  },
  {
    question: 'フレンドを追加するには？',
    answer: '設定画面のフレンドセクションから、相手のユーザーIDを入力して追加できます。ユーザーIDはプロフィール欄でコピーできます。',
  },
  {
    question: 'アカウントを削除したい',
    answer: '設定画面の「危険な操作」セクションからアカウントを削除できます。削除すると全てのデータが失われ、復元できません。',
  },
  {
    question: 'オフラインでも使えますか？',
    answer: '本の検索・登録にはインターネット接続が必要です。登録済みの本棚の閲覧はオフラインでも可能です。',
  },
  {
    question: 'グループ化はどうやって行いますか？',
    answer: 'グループに属させたい本を長押しすることでグループ先を選択できます。',
  }
];

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  const { showReleaseNotes } = useReleaseNotes();
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userSettings, setUserSettingsState] = useState<UserSettings | null>(
    null
  );
  const [friends, setFriends] = useState<FriendRelation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isGoogleAuth, setIsGoogleAuth] = useState(false);

  // モーダル管理
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  // フォーム状態
  const [displayName, setDisplayName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [friendUserId, setFriendUserId] = useState('');
  const [deleteConfirmPassword, setDeleteConfirmPassword] = useState('');

  const isDark = colorScheme === 'dark';
  const cardBg = isDark ? '#231E19' : '#FCFAF2';
  const borderColor = isDark ? '#5A4030' : '#6A4028';
  const inputBg = isDark ? '#2D2520' : '#F5F5F5';
  const borderDefault = isDark ? '#3D352D' : '#E0E0E0';
  const buttonSecondaryBg = isDark ? '#3D352D' : '#E5E5E5';
  const secondaryTextColor = isDark ? '#B8A998' : '#666';

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      const id = getUserId();
      const email = getUserEmail();
      const googleAuth = isGoogleUser();

      if (!id) {
        setLoading(false);
        return;
      }
      setUserId(id);
      setUserEmail(email);
      setIsGoogleAuth(googleAuth);

      // ユーザー設定を取得
      const settings = await getUserSettings(id);
      if (settings) {
        setUserSettingsState(settings);
        setDisplayName(settings.displayName);
      } else {
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
      showAlert('エラー', '設定の読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const resetModalState = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setNewEmail('');
    setFriendUserId('');
    setDeleteConfirmPassword('');
  };

  const openModal = (type: ModalType) => {
    resetModalState();
    if (type === 'displayName') {
      setDisplayName(userSettings?.displayName || '');
    }
    if (type === 'email') {
      setNewEmail(userEmail || '');
    }
    setActiveModal(type);
  };

  const closeModal = () => {
    setActiveModal(null);
    resetModalState();
  };

  // 表示名を保存
  const handleSaveDisplayName = async () => {
    if (!userId || !displayName.trim()) {
      showAlert('エラー', '表示名を入力してください');
      return;
    }

    try {
      setSaving(true);
      await setUserSettings(userId, { displayName: displayName.trim() });
      const updatedSettings = await getUserSettings(userId);
      if (updatedSettings) {
        setUserSettingsState(updatedSettings);
      }
      closeModal();
      showAlert('完了', '表示名を変更しました');
    } catch (error) {
      console.error('Error saving display name:', error);
      showAlert('エラー', '表示名の保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  // メールアドレスを変更
  const handleChangeEmail = async () => {
    if (!newEmail.trim()) {
      showAlert('エラー', 'メールアドレスを入力してください');
      return;
    }
    if (!currentPassword) {
      showAlert('エラー', '現在のパスワードを入力してください');
      return;
    }

    try {
      setSaving(true);
      await updateUserEmail(newEmail.trim(), currentPassword);
      setUserEmail(newEmail.trim());
      closeModal();
      showAlert('完了', 'メールアドレスを変更しました');
    } catch (error) {
      console.error('Error changing email:', error);
      showAlert('エラー', error instanceof Error ? error.message : 'メールアドレスの変更に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  // パスワードを変更
  const handleChangePassword = async () => {
    if (!currentPassword) {
      showAlert('エラー', '現在のパスワードを入力してください');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      showAlert('エラー', '新しいパスワードは6文字以上で入力してください');
      return;
    }
    if (newPassword !== confirmPassword) {
      showAlert('エラー', '新しいパスワードが一致しません');
      return;
    }

    try {
      setSaving(true);
      await updateUserPassword(currentPassword, newPassword);
      closeModal();
      showAlert('完了', 'パスワードを変更しました');
    } catch (error) {
      console.error('Error changing password:', error);
      showAlert('エラー', error instanceof Error ? error.message : 'パスワードの変更に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  // アカウント削除
  const handleDeleteAccount = async () => {
    if (!deleteConfirmPassword) {
      showAlert('エラー', 'パスワードを入力してください');
      return;
    }

    try {
      setSaving(true);
      await deleteUserAccount(deleteConfirmPassword);
      closeModal();
      // 削除後は自動的にログアウト状態になる
    } catch (error) {
      console.error('Error deleting account:', error);
      showAlert('エラー', error instanceof Error ? error.message : 'アカウントの削除に失敗しました');
      setSaving(false);
    }
  };

  // フレンド追加
  const handleAddFriend = async () => {
    if (!userId || !friendUserId.trim()) {
      showAlert('エラー', 'ユーザーIDを入力してください');
      return;
    }

    try {
      setSaving(true);
      const friendUser = await searchUserByUserId(friendUserId.trim());
      if (!friendUser) {
        showAlert('エラー', 'ユーザーが見つかりませんでした');
        return;
      }

      await addFriend(userId, friendUser.userId, friendUser.displayName);
      setFriendUserId('');
      closeModal();
      await loadData();
      showAlert('完了', 'フレンドを追加しました');
    } catch (error) {
      console.error('Error adding friend:', error);
      showAlert('エラー', error instanceof Error ? error.message : 'フレンドの追加に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  // フレンド削除
  const handleRemoveFriend = async (
    friendRelationId: string,
    friendName: string
  ) => {
    showAlert('削除確認', `${friendName}をフレンドリストから削除しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeFriend(friendRelationId);
            await loadData();
            showAlert('完了', 'フレンドを削除しました');
          } catch (error) {
            console.error('Error removing friend:', error);
            showAlert('エラー', 'フレンドの削除に失敗しました');
          }
        },
      },
    ]);
  };

  // ユーザーIDをコピー
  const handleCopyUserId = async () => {
    if (!userId) return;
    const success = await copyToClipboard(userId);
    if (success) {
      showAlert('コピー完了', 'ユーザーIDをクリップボードにコピーしました');
    } else {
      showAlert('エラー', 'コピーに失敗しました');
    }
  };

  // サインアウト
  const handleSignOut = async () => {
    const doSignOut = async () => {
      try {
        await signOutUser();
      } catch (error) {
        console.error('Error signing out:', error);
        showAlert('エラー', 'サインアウトに失敗しました');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('サインアウトしますか？')) {
        await doSignOut();
      }
    } else {
      showAlert('サインアウト', 'サインアウトしますか？', [
        { text: 'キャンセル', style: 'cancel' },
        { text: 'サインアウト', style: 'destructive', onPress: doSignOut },
      ]);
    }
  };

  // 設定項目コンポーネント
  const SettingItem = ({
    icon,
    label,
    value,
    onPress,
    showArrow = true,
    danger = false,
    disabled = false,
  }: {
    icon: IconName;
    label: string;
    value?: string;
    onPress: () => void;
    showArrow?: boolean;
    danger?: boolean;
    disabled?: boolean;
  }) => (
    <Pressable
      style={[
        styles.settingItem,
        { borderBottomColor: borderColor },
        disabled && styles.settingItemDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}>
      <View style={styles.settingItemLeft}>
        <Icon
          name={icon}
          size={22}
          color={danger ? '#E53935' : Colors[colorScheme ?? 'light'].text}
          style={styles.settingItemIcon}
        />
        <ThemedText
          style={[styles.settingItemLabel, danger && styles.dangerText]}>
          {label}
        </ThemedText>
      </View>
      <View style={styles.settingItemRight}>
        {value && (
          <ThemedText style={styles.settingItemValue} numberOfLines={1}>
            {value}
          </ThemedText>
        )}
        {showArrow && (
          <Icon
            name="chevron-right"
            size={20}
            color={secondaryTextColor}
          />
        )}
      </View>
    </Pressable>
  );

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color={Colors[colorScheme ?? 'light'].text}
          />
          <ThemedText style={styles.loadingText}>読み込み中...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}>
        {/* プロフィールヘッダー */}
        <View style={[styles.profileHeader, { backgroundColor: cardBg }]}>
          <View style={styles.avatarContainer}>
            <Icon
              name="account-circle"
              size={80}
              color={Colors[colorScheme ?? 'light'].tint}
            />
          </View>
          <ThemedText style={styles.profileName}>
            {userSettings?.displayName || 'ユーザー'}
          </ThemedText>
          <ThemedText style={styles.profileEmail}>
            {userEmail || ''}
          </ThemedText>
          <Pressable style={styles.userIdBadge} onPress={handleCopyUserId}>
            <ThemedText style={styles.userIdText} numberOfLines={1}>
              ID: {userId?.slice(0, 12)}...
            </ThemedText>
            <Icon
              name="content-copy"
              size={14}
              color={secondaryTextColor}
            />
          </Pressable>
        </View>

        {/* アカウント設定 */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>アカウント設定</ThemedText>
          <View style={[styles.card, { backgroundColor: cardBg }]}>
            <SettingItem
              icon="person"
              label="表示名を変更"
              value={userSettings?.displayName}
              onPress={() => openModal('displayName')}
            />
            <SettingItem
              icon="email"
              label="メールアドレスを変更"
              value={userEmail || ''}
              onPress={() => openModal('email')}
              disabled={isGoogleAuth}
            />
            <SettingItem
              icon="lock"
              label="パスワードを変更"
              onPress={() => openModal('password')}
              disabled={isGoogleAuth}
            />
          </View>
          {isGoogleAuth && (
            <ThemedText style={styles.hintText}>
              Google認証でログインしているため、メールアドレスとパスワードの変更はできません
            </ThemedText>
          )}
        </View>

        {/* フレンド */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>フレンド</ThemedText>
            <Pressable
              style={styles.addFriendButton}
              onPress={() => openModal('addFriend')}>
              <Icon name="person-add" size={20} color="#fff" />
            </Pressable>
          </View>
          <View style={[styles.card, { backgroundColor: cardBg }]}>
            {friends.length === 0 ? (
              <View style={styles.emptyFriends}>
                <Icon
                  name="people-outline"
                  size={40}
                  color={isDark ? '#5A4030' : '#ccc'}
                />
                <ThemedText style={styles.emptyText}>
                  フレンドがいません
                </ThemedText>
                <ThemedText style={styles.emptySubText}>
                  ユーザーIDを共有してフレンドを追加しましょう
                </ThemedText>
              </View>
            ) : (
              friends.map((friend, index) => (
                <View
                  key={friend.id}
                  style={[
                    styles.friendItem,
                    index < friends.length - 1 && {
                      borderBottomWidth: 1,
                      borderBottomColor: borderColor,
                    },
                  ]}>
                  <View style={styles.friendInfo}>
                    <Icon
                      name="account-circle"
                      size={40}
                      color={Colors[colorScheme ?? 'light'].tint}
                    />
                    <View style={styles.friendDetails}>
                      <ThemedText style={styles.friendName}>
                        {friend.friendDisplayName}
                      </ThemedText>
                      <ThemedText style={styles.friendId}>
                        {friend.friendId.slice(0, 12)}...
                      </ThemedText>
                    </View>
                  </View>
                  <Pressable
                    style={styles.removeFriendButton}
                    onPress={() =>
                      handleRemoveFriend(friend.id!, friend.friendDisplayName)
                    }>
                    <Icon name="close" size={20} color="#999" />
                  </Pressable>
                </View>
              ))
            )}
          </View>
        </View>

        {/* 危険ゾーン */}
        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, styles.dangerText]}>
            危険な操作
          </ThemedText>
          <View style={[styles.card, { backgroundColor: cardBg }]}>
            <SettingItem
              icon="logout"
              label="サインアウト"
              onPress={handleSignOut}
              showArrow={false}
              danger
            />
            <SettingItem
              icon="delete-forever"
              label="アカウントを削除"
              onPress={() => openModal('deleteAccount')}
              showArrow={false}
              danger
              disabled={isGoogleAuth}
            />
          </View>
          {isGoogleAuth && (
            <ThemedText style={styles.hintText}>
              Google認証アカウントの削除は、Googleアカウント設定から行ってください
            </ThemedText>
          )}
        </View>

        {/* 法的情報 */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>法的情報</ThemedText>
          <View style={[styles.card, { backgroundColor: cardBg }]}>
            <SettingItem
              icon="help-outline"
              label="FAQ"
              onPress={() => openModal('faq')}
            />
            <SettingItem
              icon="article"
              label="利用規約"
              onPress={() => openModal('terms')}
            />
            <SettingItem
              icon="copyright"
              label="著作権情報"
              onPress={() => openModal('copyright')}
            />
            <SettingItem
              icon="policy"
              label="個人情報保護方針"
              onPress={() => openModal('privacy')}
            />
          </View>
        </View>

        {/* アプリについて */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>アプリについて</ThemedText>
          <View style={[styles.card, { backgroundColor: cardBg }]}>
            <SettingItem
              icon="article"
              label="リリースノート"
              onPress={showReleaseNotes}
            />
            <SettingItem
              icon="email"
              label="問い合わせ"
              onPress={() => Linking.openURL('mailto:support@readeco.org')}
            />
          </View>
        </View>

        {/* アプリ情報フッター */}
        <View style={styles.appInfoFooter}>
          <ThemedText style={styles.appVersion}>Readeco v{APP_VERSION}</ThemedText>
          <ThemedText style={styles.appUserId}>
            User ID: {userId || ''}
          </ThemedText>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* 表示名変更モーダル */}
      <Modal
        visible={activeModal === 'displayName'}
        transparent
        animationType="fade"
        onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalOverlay} onPress={closeModal}>
            <Pressable
              style={[styles.modalContent, { backgroundColor: cardBg }]}
              onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>表示名を変更</ThemedText>
                <Pressable onPress={closeModal} style={styles.modalCloseButton}>
                  <Icon
                    name="close"
                    size={24}
                    color={Colors[colorScheme ?? 'light'].text}
                  />
                </Pressable>
              </View>
              <ScrollView
                style={styles.modalBodyScroll}
                contentContainerStyle={styles.modalBody}
                keyboardShouldPersistTaps="handled">
                <ThemedText style={styles.inputLabel}>新しい表示名</ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: Colors[colorScheme ?? 'light'].text,
                      backgroundColor: inputBg,
                      borderColor: borderColor,
                    },
                  ]}
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="表示名を入力"
                  placeholderTextColor={isDark ? '#B8A998' : '#999'}
                />
              </ScrollView>
              <View style={styles.modalFooter}>
                <Pressable
                  style={[styles.modalButton, styles.cancelButton, { backgroundColor: buttonSecondaryBg }]}
                  onPress={closeModal}>
                  <ThemedText style={[styles.cancelButtonText, { color: isDark ? '#F5F0E6' : '#333' }]}>
                    キャンセル
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.modalButton, styles.primaryButton]}
                  onPress={handleSaveDisplayName}
                  disabled={saving}>
                  <ThemedText style={styles.primaryButtonText}>
                    {saving ? '保存中...' : '保存'}
                  </ThemedText>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </View>
      </Modal>

      {/* メールアドレス変更モーダル */}
      <Modal
        visible={activeModal === 'email'}
        transparent
        animationType="fade"
        onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalOverlay} onPress={closeModal}>
            <Pressable
              style={[styles.modalContent, { backgroundColor: cardBg }]}
              onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>
                  メールアドレスを変更
                </ThemedText>
                <Pressable onPress={closeModal} style={styles.modalCloseButton}>
                  <Icon
                    name="close"
                    size={24}
                    color={Colors[colorScheme ?? 'light'].text}
                  />
                </Pressable>
              </View>
              <ScrollView
                style={styles.modalBodyScroll}
                contentContainerStyle={styles.modalBody}
                keyboardShouldPersistTaps="handled">
                <ThemedText style={styles.inputLabel}>
                  新しいメールアドレス
                </ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: Colors[colorScheme ?? 'light'].text,
                      backgroundColor: inputBg,
                      borderColor: borderColor,
                    },
                  ]}
                  value={newEmail}
                  onChangeText={setNewEmail}
                  placeholder="新しいメールアドレス"
                  placeholderTextColor={isDark ? '#B8A998' : '#999'}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <ThemedText style={[styles.inputLabel, { marginTop: 16 }]}>
                  現在のパスワード
                </ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: Colors[colorScheme ?? 'light'].text,
                      backgroundColor: inputBg,
                      borderColor: borderColor,
                    },
                  ]}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="パスワードを入力"
                  placeholderTextColor={isDark ? '#B8A998' : '#999'}
                  secureTextEntry
                />
              </ScrollView>
              <View style={styles.modalFooter}>
                <Pressable
                  style={[styles.modalButton, styles.cancelButton, { backgroundColor: buttonSecondaryBg }]}
                  onPress={closeModal}>
                  <ThemedText style={[styles.cancelButtonText, { color: isDark ? '#F5F0E6' : '#333' }]}>
                    キャンセル
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.modalButton, styles.primaryButton]}
                  onPress={handleChangeEmail}
                  disabled={saving}>
                  <ThemedText style={styles.primaryButtonText}>
                    {saving ? '変更中...' : '変更'}
                  </ThemedText>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </View>
      </Modal>

      {/* パスワード変更モーダル */}
      <Modal
        visible={activeModal === 'password'}
        transparent
        animationType="fade"
        onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalOverlay} onPress={closeModal}>
            <Pressable
              style={[styles.modalContent, { backgroundColor: cardBg }]}
              onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>
                  パスワードを変更
                </ThemedText>
                <Pressable onPress={closeModal} style={styles.modalCloseButton}>
                  <Icon
                    name="close"
                    size={24}
                    color={Colors[colorScheme ?? 'light'].text}
                  />
                </Pressable>
              </View>
              <ScrollView
                style={styles.modalBodyScroll}
                contentContainerStyle={styles.modalBody}
                keyboardShouldPersistTaps="handled">
                <ThemedText style={styles.inputLabel}>
                  現在のパスワード
                </ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: Colors[colorScheme ?? 'light'].text,
                      backgroundColor: inputBg,
                      borderColor: borderColor,
                    },
                  ]}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="現在のパスワード"
                  placeholderTextColor={isDark ? '#B8A998' : '#999'}
                  secureTextEntry
                />
                <ThemedText style={[styles.inputLabel, { marginTop: 16 }]}>
                  新しいパスワード
                </ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: Colors[colorScheme ?? 'light'].text,
                      backgroundColor: inputBg,
                      borderColor: borderColor,
                    },
                  ]}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="新しいパスワード（6文字以上）"
                  placeholderTextColor={isDark ? '#B8A998' : '#999'}
                  secureTextEntry
                />
                <ThemedText style={[styles.inputLabel, { marginTop: 16 }]}>
                  新しいパスワード（確認）
                </ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: Colors[colorScheme ?? 'light'].text,
                      backgroundColor: inputBg,
                      borderColor: borderColor,
                    },
                  ]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="パスワードを再入力"
                  placeholderTextColor={isDark ? '#B8A998' : '#999'}
                  secureTextEntry
                />
              </ScrollView>
              <View style={styles.modalFooter}>
                <Pressable
                  style={[styles.modalButton, styles.cancelButton, { backgroundColor: buttonSecondaryBg }]}
                  onPress={closeModal}>
                  <ThemedText style={[styles.cancelButtonText, { color: isDark ? '#F5F0E6' : '#333' }]}>
                    キャンセル
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.modalButton, styles.primaryButton]}
                  onPress={handleChangePassword}
                  disabled={saving}>
                  <ThemedText style={styles.primaryButtonText}>
                    {saving ? '変更中...' : '変更'}
                  </ThemedText>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </View>
      </Modal>

      {/* アカウント削除モーダル */}
      <Modal
        visible={activeModal === 'deleteAccount'}
        transparent
        animationType="fade"
        onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalOverlay} onPress={closeModal}>
            <Pressable
              style={[styles.modalContent, { backgroundColor: cardBg }]}
              onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <ThemedText style={[styles.modalTitle, styles.dangerText]}>
                  アカウントを削除
                </ThemedText>
                <Pressable onPress={closeModal} style={styles.modalCloseButton}>
                  <Icon
                    name="close"
                    size={24}
                    color={Colors[colorScheme ?? 'light'].text}
                  />
                </Pressable>
              </View>
              <ScrollView
                style={styles.modalBodyScroll}
                contentContainerStyle={styles.modalBody}
                keyboardShouldPersistTaps="handled">
                <View style={styles.warningBox}>
                  <Icon name="warning" size={24} color="#E53935" />
                  <ThemedText style={styles.warningText}>
                    この操作は取り消せません。すべてのデータが削除されます。
                  </ThemedText>
                </View>
                <ThemedText style={[styles.inputLabel, { marginTop: 16 }]}>
                  パスワードを入力して確認
                </ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: Colors[colorScheme ?? 'light'].text,
                      backgroundColor: inputBg,
                      borderColor: borderColor,
                    },
                  ]}
                  value={deleteConfirmPassword}
                  onChangeText={setDeleteConfirmPassword}
                  placeholder="パスワードを入力"
                  placeholderTextColor={isDark ? '#B8A998' : '#999'}
                  secureTextEntry
                />
              </ScrollView>
              <View style={styles.modalFooter}>
                <Pressable
                  style={[styles.modalButton, styles.cancelButton, { backgroundColor: buttonSecondaryBg }]}
                  onPress={closeModal}>
                  <ThemedText style={[styles.cancelButtonText, { color: isDark ? '#F5F0E6' : '#333' }]}>
                    キャンセル
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.modalButton, styles.dangerButton]}
                  onPress={handleDeleteAccount}
                  disabled={saving}>
                  <ThemedText style={styles.dangerButtonText}>
                    {saving ? '削除中...' : '削除する'}
                  </ThemedText>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </View>
      </Modal>

      {/* フレンド追加モーダル */}
      <Modal
        visible={activeModal === 'addFriend'}
        transparent
        animationType="fade"
        onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalOverlay} onPress={closeModal}>
            <Pressable
              style={[styles.modalContent, { backgroundColor: cardBg }]}
              onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>
                  フレンドを追加
                </ThemedText>
                <Pressable onPress={closeModal} style={styles.modalCloseButton}>
                  <Icon
                    name="close"
                    size={24}
                    color={Colors[colorScheme ?? 'light'].text}
                  />
                </Pressable>
              </View>
              <ScrollView
                style={styles.modalBodyScroll}
                contentContainerStyle={styles.modalBody}
                keyboardShouldPersistTaps="handled">
                <ThemedText style={styles.inputLabel}>ユーザーID</ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: Colors[colorScheme ?? 'light'].text,
                      backgroundColor: inputBg,
                      borderColor: borderColor,
                    },
                  ]}
                  value={friendUserId}
                  onChangeText={setFriendUserId}
                  placeholder="フレンドのユーザーIDを入力"
                  placeholderTextColor={isDark ? '#B8A998' : '#999'}
                  autoCapitalize="none"
                />
                <ThemedText style={styles.inputHint}>
                  フレンドにあなたのユーザーIDを教えてもらい、入力してください
                </ThemedText>
              </ScrollView>
              <View style={styles.modalFooter}>
                <Pressable
                  style={[styles.modalButton, styles.cancelButton, { backgroundColor: buttonSecondaryBg }]}
                  onPress={closeModal}>
                  <ThemedText style={[styles.cancelButtonText, { color: isDark ? '#F5F0E6' : '#333' }]}>
                    キャンセル
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.modalButton, styles.primaryButton]}
                  onPress={handleAddFriend}
                  disabled={saving}>
                  <ThemedText style={styles.primaryButtonText}>
                    {saving ? '追加中...' : '追加'}
                  </ThemedText>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </View>
      </Modal>

      {/* FAQモーダル */}
      <Modal
        visible={activeModal === 'faq'}
        transparent
        animationType="fade"
        onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalOverlay} onPress={closeModal}>
            <Pressable
              style={[styles.modalContentLarge, { backgroundColor: cardBg }]}
              onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>FAQ</ThemedText>
                <Pressable onPress={closeModal} style={styles.modalCloseButton}>
                  <Icon
                    name="close"
                    size={24}
                    color={Colors[colorScheme ?? 'light'].text}
                  />
                </Pressable>
              </View>
              <ScrollView style={styles.legalModalBody}>
                {FAQ_DATA.map((item, index) => (
                  <View key={index} style={styles.faqItem}>
                    <ThemedText style={styles.faqQuestion}>
                      Q. {item.question}
                    </ThemedText>
                    <ThemedText style={styles.faqAnswer}>
                      A. {item.answer}
                    </ThemedText>
                  </View>
                ))}
                <View style={styles.legalFooter}>
                  <ThemedText style={styles.legalFooterText}>
                    その他のご質問は support@readeco.org までお問い合わせください
                  </ThemedText>
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </View>
      </Modal>

      {/* 利用規約モーダル */}
      <Modal
        visible={activeModal === 'terms'}
        transparent
        animationType="fade"
        onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalOverlay} onPress={closeModal}>
            <Pressable
              style={[styles.modalContentLarge, { backgroundColor: cardBg }]}
              onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>利用規約</ThemedText>
                <Pressable onPress={closeModal} style={styles.modalCloseButton}>
                  <Icon
                    name="close"
                    size={24}
                    color={Colors[colorScheme ?? 'light'].text}
                  />
                </Pressable>
              </View>
              <ScrollView style={styles.legalModalBody}>
                <ThemedText style={styles.legalSectionTitle}>
                  第1条（適用）
                </ThemedText>
                <ThemedText style={styles.legalText}>
                  本規約は、Readeco（以下「本サービス」）の利用に関する条件を定めるものです。ユーザーは本規約に同意した上で本サービスを利用するものとします。
                </ThemedText>

                <ThemedText style={styles.legalSectionTitle}>
                  第2条（利用登録）
                </ThemedText>
                <ThemedText style={styles.legalText}>
                  本サービスの利用を希望する者は、本規約に同意の上、所定の方法により利用登録を申請するものとします。登録情報に虚偽があった場合、利用を制限することがあります。
                </ThemedText>

                <ThemedText style={styles.legalSectionTitle}>
                  第3条（禁止事項）
                </ThemedText>
                <ThemedText style={styles.legalText}>
                  ユーザーは以下の行為を行ってはなりません。{'\n'}
                  ・法令または公序良俗に違反する行為{'\n'}
                  ・他のユーザーまたは第三者の権利を侵害する行為{'\n'}
                  ・本サービスの運営を妨害する行為{'\n'}
                  ・不正アクセスまたはこれを試みる行為
                </ThemedText>

                <ThemedText style={styles.legalSectionTitle}>
                  第4条（免責事項）
                </ThemedText>
                <ThemedText style={styles.legalText}>
                  本サービスは現状有姿で提供されます。運営者は、本サービスの完全性、正確性、有用性等について保証しません。本サービスの利用により生じた損害について、運営者は責任を負いません。
                </ThemedText>

                <ThemedText style={styles.legalSectionTitle}>
                  第5条（サービスの変更・終了）
                </ThemedText>
                <ThemedText style={styles.legalText}>
                  運営者は、事前の通知なく本サービスの内容を変更、または提供を終了することができます。
                </ThemedText>

                <View style={styles.legalFooter}>
                  <ThemedText style={styles.legalFooterText}>
                    最終更新日: 2026年1月25日
                  </ThemedText>
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </View>
      </Modal>

      {/* 著作権情報モーダル */}
      <Modal
        visible={activeModal === 'copyright'}
        transparent
        animationType="fade"
        onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalOverlay} onPress={closeModal}>
            <Pressable
              style={[styles.modalContentLarge, { backgroundColor: cardBg }]}
              onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>著作権情報</ThemedText>
                <Pressable onPress={closeModal} style={styles.modalCloseButton}>
                  <Icon
                    name="close"
                    size={24}
                    color={Colors[colorScheme ?? 'light'].text}
                  />
                </Pressable>
              </View>
              <ScrollView style={styles.legalModalBody}>
                <ThemedText style={styles.legalSectionTitle}>
                  アプリケーション著作権
                </ThemedText>
                <ThemedText style={styles.legalText}>
                  © 2026 Readeco. All rights reserved.{'\n\n'}
                  本アプリケーションおよびそのコンテンツ（ロゴ、デザイン、コード等）の著作権は Readeco に帰属します。
                </ThemedText>

                <ThemedText style={styles.legalSectionTitle}>
                  書籍データについて
                </ThemedText>
                <ThemedText style={styles.legalText}>
                  本アプリで表示される書籍情報は、以下のサービスから取得しています。{'\n\n'}
                  ・楽天ブックス API{'\n'}
                  ・Google Books API{'\n\n'}
                  各書籍の表紙画像、タイトル、著者情報等の著作権は、それぞれの権利者に帰属します。
                </ThemedText>

                <ThemedText style={styles.legalSectionTitle}>
                  オープンソースライセンス
                </ThemedText>
                <ThemedText style={styles.legalText}>
                  本アプリは以下のオープンソースソフトウェアを使用しています。{'\n\n'}
                  ・React Native (MIT License){'\n'}
                  ・Expo (MIT License){'\n'}
                  ・Firebase (Apache License 2.0){'\n\n'}
                  各ライブラリのライセンス情報は、それぞれの公式サイトをご確認ください。
                </ThemedText>

                <View style={styles.legalFooter}>
                  <ThemedText style={styles.legalFooterText}>
                    お問い合わせ: support@readeco.org
                  </ThemedText>
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </View>
      </Modal>

      {/* 個人情報保護方針モーダル */}
      <Modal
        visible={activeModal === 'privacy'}
        transparent
        animationType="fade"
        onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalOverlay} onPress={closeModal}>
            <Pressable
              style={[styles.modalContentLarge, { backgroundColor: cardBg }]}
              onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>個人情報保護方針</ThemedText>
                <Pressable onPress={closeModal} style={styles.modalCloseButton}>
                  <Icon
                    name="close"
                    size={24}
                    color={Colors[colorScheme ?? 'light'].text}
                  />
                </Pressable>
              </View>
              <ScrollView style={styles.legalModalBody}>
                <ThemedText style={styles.legalSectionTitle}>
                  1. 収集する情報
                </ThemedText>
                <ThemedText style={styles.legalText}>
                  本サービスでは、以下の情報を収集します。{'\n\n'}
                  ・メールアドレス（アカウント認証用）{'\n'}
                  ・表示名（任意設定）{'\n'}
                  ・登録した書籍情報{'\n'}
                  ・フレンド情報
                </ThemedText>

                <ThemedText style={styles.legalSectionTitle}>
                  2. 情報の利用目的
                </ThemedText>
                <ThemedText style={styles.legalText}>
                  収集した情報は以下の目的で利用します。{'\n\n'}
                  ・本サービスの提供・運営{'\n'}
                  ・ユーザー認証{'\n'}
                  ・サービス改善のための分析{'\n'}
                  ・重要なお知らせの通知
                </ThemedText>

                <ThemedText style={styles.legalSectionTitle}>
                  3. 情報の第三者提供
                </ThemedText>
                <ThemedText style={styles.legalText}>
                  法令に基づく場合を除き、ユーザーの同意なく個人情報を第三者に提供することはありません。
                </ThemedText>

                <ThemedText style={styles.legalSectionTitle}>
                  4. 情報の保護
                </ThemedText>
                <ThemedText style={styles.legalText}>
                  ユーザー情報は Firebase のセキュリティ機能により保護されています。不正アクセス、紛失、破壊、改ざんから保護するため、適切な技術的措置を講じています。
                </ThemedText>

                <ThemedText style={styles.legalSectionTitle}>
                  5. データの削除
                </ThemedText>
                <ThemedText style={styles.legalText}>
                  ユーザーはいつでもアカウントを削除し、関連するデータを消去することができます。設定画面の「アカウントを削除」から手続きできます。
                </ThemedText>

                <ThemedText style={styles.legalSectionTitle}>
                  6. お問い合わせ
                </ThemedText>
                <ThemedText style={styles.legalText}>
                  個人情報の取扱いに関するお問い合わせは、以下までご連絡ください。{'\n\n'}
                  support@readeco.org
                </ThemedText>

                <View style={styles.legalFooter}>
                  <ThemedText style={styles.legalFooterText}>
                    最終更新日: 2026年1月25日
                  </ThemedText>
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
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
  scrollContent: {
    paddingBottom: 40,
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

  // プロフィールヘッダー
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  avatarContainer: {
    marginBottom: 12,
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 12,
  },
  userIdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    gap: 6,
  },
  userIdText: {
    fontSize: 12,
    opacity: 0.6,
  },

  // セクション
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.6,
    marginBottom: 12,
    marginLeft: 4,
  },

  // カード
  card: {
    borderRadius: 12,
    overflow: 'hidden',
  },

  // 設定項目
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  settingItemDisabled: {
    opacity: 0.5,
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingItemIcon: {
    marginRight: 12,
  },
  settingItemLabel: {
    fontSize: 16,
  },
  settingItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '50%',
  },
  settingItemValue: {
    fontSize: 14,
    opacity: 0.6,
    marginRight: 4,
  },

  // フレンド
  addFriendButton: {
    backgroundColor: '#838A2D',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyFriends: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    opacity: 0.7,
  },
  emptySubText: {
    fontSize: 13,
    opacity: 0.5,
    marginTop: 4,
    textAlign: 'center',
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  friendDetails: {
    marginLeft: 12,
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
  },
  friendId: {
    fontSize: 12,
    opacity: 0.5,
    marginTop: 2,
  },
  removeFriendButton: {
    padding: 8,
  },

  // 危険ゾーン
  dangerText: {
    color: '#E53935',
  },

  // ヒントテキスト
  hintText: {
    fontSize: 12,
    opacity: 0.5,
    marginTop: 8,
    marginLeft: 4,
    lineHeight: 18,
  },

  // アプリ情報フッター
  appInfoFooter: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  appVersion: {
    fontSize: 14,
    opacity: 0.5,
    marginBottom: 4,
  },
  appUserId: {
    fontSize: 12,
    opacity: 0.4,
  },

  // 下部スペーサー
  bottomSpacer: {
    height: 40,
  },

  // モーダル
  modalOverlay: {
    flex: 1,
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    borderRadius: 16,
    padding: 24,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
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
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    marginBottom: 24,
  },
  modalBodyScroll: {
    maxHeight: 300,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#E5E5E5',
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#838A2D',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dangerButton: {
    backgroundColor: '#E53935',
  },
  dangerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // 入力
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
  },
  inputHint: {
    fontSize: 12,
    opacity: 0.5,
    marginTop: 8,
    lineHeight: 18,
  },

  // 警告ボックス
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(229, 57, 53, 0.1)',
    padding: 12,
    borderRadius: 8,
    gap: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#E53935',
    lineHeight: 20,
  },

  // 大きなモーダル（法的情報・リリースノート用）
  modalContentLarge: {
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  legalModalBody: {
    maxHeight: 400,
  },

  // FAQ スタイル
  faqItem: {
    marginBottom: 20,
  },
  faqQuestion: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
    lineHeight: 22,
  },
  faqAnswer: {
    fontSize: 14,
    opacity: 0.8,
    lineHeight: 22,
    paddingLeft: 8,
  },

  // 法的情報テキストスタイル
  legalSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  legalText: {
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.85,
  },
  legalFooter: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
    alignItems: 'center',
  },
  legalFooterText: {
    fontSize: 12,
    opacity: 0.5,
  },

  // リリースノートスタイル
  releaseItem: {
    marginBottom: 24,
  },
  releaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  releaseVersion: {
    fontSize: 18,
    fontWeight: '700',
    marginRight: 12,
  },
  releaseDate: {
    fontSize: 13,
    opacity: 0.5,
  },
  releaseChange: {
    flexDirection: 'row',
    paddingLeft: 8,
    marginBottom: 6,
  },
  releaseBullet: {
    fontSize: 14,
    marginRight: 8,
    opacity: 0.6,
  },
  releaseChangeText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
});
