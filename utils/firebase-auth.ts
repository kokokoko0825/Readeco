/**
 * Firebase Authenticationを使用した認証機能
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithCredential,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  updateEmail,
  updatePassword,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
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
 * Google認証でサインイン（Web環境用）
 * Firebaseの signInWithPopup を使用
 */
export async function signInWithGooglePopup(): Promise<UserCredential> {
  try {
    const provider = new GoogleAuthProvider();
    // 日本語でGoogle認証画面を表示
    provider.setCustomParameters({
      prompt: 'select_account',
      hl: 'ja',
    });

    const userCredential = await signInWithPopup(auth, provider);

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
    console.error('Error signing in with Google popup:', error);

    // エラーメッセージを日本語化
    let errorMessage = 'Google認証に失敗しました';
    if (error.code === 'auth/account-exists-with-different-credential') {
      errorMessage = 'このメールアドレスは既に別の認証方法で登録されています';
    } else if (error.code === 'auth/popup-closed-by-user') {
      errorMessage = 'Google認証がキャンセルされました';
    } else if (error.code === 'auth/popup-blocked') {
      errorMessage = 'ポップアップがブロックされました。ブラウザの設定を確認してください';
    } else if (error.code === 'auth/unauthorized-domain') {
      errorMessage = 'このドメインは承認されていません。Firebase Consoleで承認済みドメインを設定してください';
    } else if (error.code === 'auth/api-key-not-valid') {
      errorMessage = 'Firebase APIキーが無効です。Firebase設定を確認してください';
    }

    throw new Error(errorMessage);
  }
}

/**
 * Google認証でサインイン（モバイル環境用）
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

/**
 * 再認証（セキュリティ操作前に必要）
 * @param password 現在のパスワード
 */
export async function reauthenticateUser(password: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) {
    throw new Error('ユーザーがログインしていません');
  }

  try {
    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);
  } catch (error: any) {
    console.error('Error reauthenticating:', error);

    let errorMessage = '再認証に失敗しました';
    if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
      errorMessage = 'パスワードが正しくありません';
    } else if (error.code === 'auth/too-many-requests') {
      errorMessage = 'リクエストが多すぎます。しばらく待ってから再度お試しください';
    }

    throw new Error(errorMessage);
  }
}

/**
 * メールアドレスを変更
 * @param newEmail 新しいメールアドレス
 * @param currentPassword 現在のパスワード（再認証用）
 */
export async function updateUserEmail(
  newEmail: string,
  currentPassword: string
): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('ユーザーがログインしていません');
  }

  try {
    // 再認証
    await reauthenticateUser(currentPassword);

    // メールアドレスを更新
    await updateEmail(user, newEmail);

    // Firestoreのユーザー設定も更新
    const existingSettings = await getUserSettings(user.uid);
    if (existingSettings) {
      await setUserSettings(user.uid, {
        ...existingSettings,
        email: newEmail,
      });
    }
  } catch (error: any) {
    console.error('Error updating email:', error);

    if (error.message) {
      throw error; // 再認証エラーはそのまま投げる
    }

    let errorMessage = 'メールアドレスの変更に失敗しました';
    if (error.code === 'auth/email-already-in-use') {
      errorMessage = 'このメールアドレスは既に使用されています';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = '無効なメールアドレスです';
    } else if (error.code === 'auth/requires-recent-login') {
      errorMessage = '再ログインが必要です。一度ログアウトして再度ログインしてください';
    }

    throw new Error(errorMessage);
  }
}

/**
 * パスワードを変更
 * @param currentPassword 現在のパスワード
 * @param newPassword 新しいパスワード
 */
export async function updateUserPassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('ユーザーがログインしていません');
  }

  try {
    // 再認証
    await reauthenticateUser(currentPassword);

    // パスワードを更新
    await updatePassword(user, newPassword);
  } catch (error: any) {
    console.error('Error updating password:', error);

    if (error.message) {
      throw error; // 再認証エラーはそのまま投げる
    }

    let errorMessage = 'パスワードの変更に失敗しました';
    if (error.code === 'auth/weak-password') {
      errorMessage = 'パスワードが弱すぎます（6文字以上必要）';
    } else if (error.code === 'auth/requires-recent-login') {
      errorMessage = '再ログインが必要です。一度ログアウトして再度ログインしてください';
    }

    throw new Error(errorMessage);
  }
}

/**
 * アカウントを削除
 * @param currentPassword 現在のパスワード（再認証用）
 */
export async function deleteUserAccount(currentPassword: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('ユーザーがログインしていません');
  }

  try {
    // 再認証
    await reauthenticateUser(currentPassword);

    // アカウントを削除
    await deleteUser(user);
  } catch (error: any) {
    console.error('Error deleting account:', error);

    if (error.message) {
      throw error; // 再認証エラーはそのまま投げる
    }

    let errorMessage = 'アカウントの削除に失敗しました';
    if (error.code === 'auth/requires-recent-login') {
      errorMessage = '再ログインが必要です。一度ログアウトして再度ログインしてください';
    }

    throw new Error(errorMessage);
  }
}

/**
 * 現在のユーザーのメールアドレスを取得
 */
export function getUserEmail(): string | null {
  const user = auth.currentUser;
  return user ? user.email : null;
}

/**
 * 現在のユーザーがGoogle認証かどうかを確認
 */
export function isGoogleUser(): boolean {
  const user = auth.currentUser;
  if (!user) return false;
  return user.providerData.some((provider) => provider.providerId === 'google.com');
}
