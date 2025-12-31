/**
 * Firebaseを使用したユーザー管理
 */

import {
    doc,
    getDoc,
    setDoc,
    Timestamp,
    updateDoc,
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

    if (userSnap.exists()) {
      // 既存ユーザーの更新
      const updateData: any = {
        ...settings,
        updatedAt: now,
      };
      // undefinedの値を削除
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });
      await updateDoc(userRef, updateData);
    } else {
      // 新規ユーザーの作成
      await setDoc(userRef, {
        userId,
        displayName: settings.displayName || 'ユーザー',
        email: settings.email,
        profileImageUrl: settings.profileImageUrl,
        createdAt: now,
        updatedAt: now,
      });
    }
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

