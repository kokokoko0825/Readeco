/**
 * Firebase Authenticationを使用した認証機能
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithCredential,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider,
  type User,
  type UserCredential,
} from 'firebase/auth';
import { auth } from './firebase';
import { setUserSettings, getUserSettings } from './firebase-users';

/**
 * サインアップ（新規登録）
 */
export async function signUp(
  email: string,
  password: string,
  displayName?: string
): Promise<UserCredential> {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    // 表示名を設定
    if (displayName && userCredential.user) {
      await updateProfile(userCredential.user, {
        displayName: displayName,
      });
    }

    // Firestoreにユーザー設定を保存
    const userId = userCredential.user.uid;
    await setUserSettings(userId, {
      displayName: displayName || userCredential.user.displayName || 'ユーザー',
      email: userCredential.user.email || email,
      profileImageUrl: userCredential.user.photoURL,
    });

    return userCredential;
  } catch (error: any) {
    console.error('Error signing up:', error);
    
    // エラーメッセージを日本語化
    let errorMessage = 'サインアップに失敗しました';
    if (error.code === 'auth/email-already-in-use') {
      errorMessage = 'このメールアドレスは既に使用されています';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = '無効なメールアドレスです';
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'パスワードが弱すぎます（6文字以上）';
    } else if (error.code === 'auth/api-key-not-valid') {
      errorMessage = 'Firebase APIキーが無効です。Firebase設定を確認してください';
    } else if (error.code === 'auth/network-request-failed') {
      errorMessage = 'ネットワークエラーが発生しました。接続を確認してください';
    }

    throw new Error(errorMessage);
  }
}

/**
 * サインイン（ログイン）
 */
export async function signIn(email: string, password: string): Promise<UserCredential> {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    
    // Firestoreにユーザー設定が存在しない場合は作成
    const userId = userCredential.user.uid;
    const existingSettings = await getUserSettings(userId);
    
    if (!existingSettings) {
      // ユーザー設定が存在しない場合、作成
      await setUserSettings(userId, {
        displayName: userCredential.user.displayName || 'ユーザー',
        email: userCredential.user.email || email,
        profileImageUrl: userCredential.user.photoURL,
      });
    }
    
    return userCredential;
  } catch (error: any) {
    console.error('Error signing in:', error);
    
    // エラーメッセージを日本語化
    let errorMessage = 'サインインに失敗しました';
    if (error.code === 'auth/user-not-found') {
      errorMessage = 'このメールアドレスは登録されていません';
    } else if (error.code === 'auth/wrong-password') {
      errorMessage = 'パスワードが正しくありません';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = '無効なメールアドレスです';
    } else if (error.code === 'auth/invalid-credential') {
      errorMessage = 'メールアドレスまたはパスワードが正しくありません';
    }

    throw new Error(errorMessage);
  }
}

/**
 * サインアウト（ログアウト）
 */
export async function signOutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
    throw new Error('サインアウトに失敗しました');
  }
}

/**
 * パスワードリセットメールを送信
 */
export async function resetPassword(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error: any) {
    console.error('Error sending password reset email:', error);
    
    // エラーメッセージを日本語化
    let errorMessage = 'パスワードリセットメールの送信に失敗しました';
    if (error.code === 'auth/user-not-found') {
      errorMessage = 'このメールアドレスは登録されていません';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = '無効なメールアドレスです';
    }

    throw new Error(errorMessage);
  }
}

/**
 * 現在のユーザーを取得
 */
export function getCurrentUser(): User | null {
  return auth.currentUser;
}

/**
 * ユーザーIDを取得（認証されている場合）
 */
export function getUserId(): string | null {
  const user = auth.currentUser;
  return user ? user.uid : null;
}

/**
 * Google認証でサインイン
 * @param idToken Google IDトークン
 * @param accessToken Google アクセストークン（オプション）
 */
export async function signInWithGoogle(
  idToken: string,
  accessToken?: string
): Promise<UserCredential> {
  try {
    const credential = GoogleAuthProvider.credential(idToken, accessToken);
    const userCredential = await signInWithCredential(auth, credential);

    // Firestoreにユーザー設定を保存（新規ユーザーの場合）
    const userId = userCredential.user.uid;
    const existingSettings = await getUserSettings(userId);
    
    if (!existingSettings) {
      // 新規ユーザーの場合、Firestoreにユーザー設定を作成
      await setUserSettings(userId, {
        displayName: userCredential.user.displayName || 'ユーザー',
        email: userCredential.user.email,
        profileImageUrl: userCredential.user.photoURL,
      });
    } else {
      // 既存ユーザーの場合、プロフィール情報を更新（変更がある場合）
      const needsUpdate = 
        existingSettings.displayName !== (userCredential.user.displayName || 'ユーザー') ||
        existingSettings.email !== userCredential.user.email ||
        existingSettings.profileImageUrl !== userCredential.user.photoURL;
      
      if (needsUpdate) {
        await setUserSettings(userId, {
          displayName: userCredential.user.displayName || existingSettings.displayName,
          email: userCredential.user.email || existingSettings.email,
          profileImageUrl: userCredential.user.photoURL || existingSettings.profileImageUrl,
        });
      }
    }

    return userCredential;
  } catch (error: any) {
    console.error('Error signing in with Google:', error);
    
    // エラーメッセージを日本語化
    let errorMessage = 'Google認証に失敗しました';
    if (error.code === 'auth/account-exists-with-different-credential') {
      errorMessage = 'このメールアドレスは既に別の認証方法で登録されています';
    } else if (error.code === 'auth/invalid-credential') {
      errorMessage = '認証情報が無効です';
    } else if (error.code === 'auth/api-key-not-valid') {
      errorMessage = 'Firebase APIキーが無効です。Firebase設定を確認してください';
    }

    throw new Error(errorMessage);
  }
}

