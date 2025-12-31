/**
 * 認証状態を管理するコンテキスト
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/utils/firebase';
import { setUserSettings, getUserSettings } from '@/utils/firebase-users';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAuthenticated: false,
});

export function useAuth() {
  return useContext(AuthContext);
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 認証状態の変更を監視
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setLoading(false);
      
      // ユーザーが認証された場合、Firestoreにユーザー設定が存在するか確認
      if (user) {
        try {
          const userId = user.uid;
          const existingSettings = await getUserSettings(userId);
          
          if (!existingSettings) {
            // ユーザー設定が存在しない場合、作成
            await setUserSettings(userId, {
              displayName: user.displayName || 'ユーザー',
              email: user.email,
              profileImageUrl: user.photoURL,
            });
          } else {
            // 既存の設定がある場合、プロフィール情報を更新（変更がある場合）
            const needsUpdate = 
              existingSettings.displayName !== (user.displayName || 'ユーザー') ||
              existingSettings.email !== user.email ||
              existingSettings.profileImageUrl !== user.photoURL;
            
            if (needsUpdate) {
              await setUserSettings(userId, {
                displayName: user.displayName || existingSettings.displayName,
                email: user.email || existingSettings.email,
                profileImageUrl: user.photoURL || existingSettings.profileImageUrl,
              });
            }
          }
        } catch (error) {
          // エラーが発生しても認証状態の更新は続行
          console.error('Error syncing user settings:', error);
        }
      }
    });

    // クリーンアップ
    return () => unsubscribe();
  }, []);

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

