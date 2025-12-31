/**
 * ユーザーIDの管理（簡易版）
 * 
 * 本番環境では、Firebase Authenticationを使用することを推奨します
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_ID_KEY = '@readeco:userId';

/**
 * ユーザーIDを取得（存在しない場合は新規生成）
 */
export async function getOrCreateUserId(): Promise<string> {
  try {
    let userId = await AsyncStorage.getItem(USER_ID_KEY);
    
    if (!userId) {
      // 新しいユーザーIDを生成（簡易版：UUID風の文字列）
      userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      await AsyncStorage.setItem(USER_ID_KEY, userId);
    }
    
    return userId;
  } catch (error) {
    console.error('Error getting or creating user ID:', error);
    // エラー時は一時的なIDを返す
    return `temp_user_${Date.now()}`;
  }
}

/**
 * ユーザーIDを取得（存在しない場合はnull）
 */
export async function getUserId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(USER_ID_KEY);
  } catch (error) {
    console.error('Error getting user ID:', error);
    return null;
  }
}

/**
 * ユーザーIDを設定
 */
export async function setUserId(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(USER_ID_KEY, userId);
  } catch (error) {
    console.error('Error setting user ID:', error);
    throw error;
  }
}

