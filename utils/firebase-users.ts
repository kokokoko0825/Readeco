/**
 * Firebaseを使用したユーザー管理
 */

import {
    doc,
    getDoc,
    Timestamp,
    writeBatch,
    type DocumentData
} from 'firebase/firestore';
import { db } from './firebase';

// ユーザー設定の型
export interface UserSettings {
  userId: string;
  displayName: string;
  email?: string;
  profileImageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

// FirestoreのドキュメントをUserSettingsに変換
function docToUserSettings(docData: DocumentData): UserSettings {
  return {
    userId: docData.userId,
    displayName: docData.displayName,
    email: docData.email,
    profileImageUrl: docData.profileImageUrl,
    createdAt: docData.createdAt?.toDate() || new Date(),
    updatedAt: docData.updatedAt?.toDate() || new Date(),
  };
}

/**
 * ユーザー設定を作成または更新
 */
export async function setUserSettings(
  userId: string,
  settings: Partial<Omit<UserSettings, 'userId' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    const now = Timestamp.now();

    const displayName = settings.displayName || userSnap.data()?.displayName || 'ユーザー';
    const privateData = Object.fromEntries(
      Object.entries({
        userId,
        displayName,
        email: settings.email,
        profileImageUrl: settings.profileImageUrl,
        updatedAt: now,
        ...(!userSnap.exists() ? { createdAt: now } : {}),
      }).filter(([, value]) => value !== undefined)
    );

    // 公開先にはメール等を渡さず、設定と表示名を同じバッチで更新する。
    const batch = writeBatch(db);
    batch.set(userRef, privateData, { merge: true });
    batch.set(doc(db, 'publicProfiles', userId), { userId, displayName });
    await batch.commit();
  } catch (error) {
    console.error('Error setting user settings:', error);
    throw new Error('ユーザー設定の保存に失敗しました');
  }
}

/**
 * ユーザー設定を取得
 */
export async function getUserSettings(userId: string): Promise<UserSettings | null> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return null;
    }

    return docToUserSettings(userSnap.data());
  } catch (error) {
    console.error('Error getting user settings:', error);
    throw new Error('ユーザー設定の取得に失敗しました');
  }
}

