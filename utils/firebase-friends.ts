/**
 * Firebaseを使用したフレンド管理
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';

// フレンド関係の型
export interface FriendRelation {
  id?: string;
  userId: string; // フレンドを追加したユーザー
  friendId: string; // フレンドのユーザーID
  friendDisplayName: string; // フレンドの表示名
  createdAt: Date;
}

// FirestoreのドキュメントをFriendRelationに変換
function docToFriendRelation(
  docSnap: QueryDocumentSnapshot<DocumentData>
): FriendRelation {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    userId: data.userId,
    friendId: data.friendId,
    friendDisplayName: data.friendDisplayName,
    createdAt: data.createdAt?.toDate() || new Date(),
  };
}

/**
 * フレンドを追加
 */
export async function addFriend(
  userId: string,
  friendId: string,
  friendDisplayName: string
): Promise<string> {
  try {
    // 既にフレンド登録されているかチェック
    const existingQuery = query(
      collection(db, 'friends'),
      where('userId', '==', userId),
      where('friendId', '==', friendId)
    );
    const existingSnapshot = await getDocs(existingQuery);

    if (!existingSnapshot.empty) {
      throw new Error('既にフレンド登録されています');
    }

    // 自分自身をフレンドに追加しようとしている場合
    if (userId === friendId) {
      throw new Error('自分自身をフレンドに追加することはできません');
    }

    const friendData: Omit<FriendRelation, 'id'> = {
      userId,
      friendId,
      friendDisplayName,
      createdAt: new Date(),
    };

    const docRef = await addDoc(collection(db, 'friends'), {
      ...friendData,
      createdAt: friendData.createdAt,
    });

    return docRef.id;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    console.error('Error adding friend:', error);
    throw new Error('フレンドの追加に失敗しました');
  }
}

/**
 * ユーザーのフレンド一覧を取得
 */
export async function getUserFriends(userId: string): Promise<FriendRelation[]> {
  try {
    const q = query(collection(db, 'friends'), where('userId', '==', userId));

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docToFriendRelation);
  } catch (error) {
    console.error('Error fetching user friends:', error);
    throw new Error('フレンド一覧の取得に失敗しました');
  }
}

/**
 * フレンド関係を削除
 */
export async function removeFriend(friendRelationId: string): Promise<void> {
  try {
    const docRef = doc(db, 'friends', friendRelationId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error removing friend:', error);
    throw new Error('フレンドの削除に失敗しました');
  }
}

/**
 * ユーザーIDでユーザーを検索（フレンド追加用）
 */
export async function searchUserByUserId(
  userId: string
): Promise<{ userId: string; displayName: string } | null> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return null;
    }

    const data = userSnap.data();
    return {
      userId: data.userId,
      displayName: data.displayName,
    };
  } catch (error) {
    console.error('Error searching user by ID:', error);
    return null;
  }
}

