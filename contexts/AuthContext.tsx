/**
 * 認証状態を管理するコンテキスト
 */

import { auth } from '@/utils/firebase';
import { subscribeUserBooks, type BookData } from '@/utils/firebase-books';
import { getUserSettings, setUserSettings } from '@/utils/firebase-users';
import { classifyAuthorBooks, parseSalesDate, type NewBook } from '@/utils/new-books';
import { searchBooksByAuthor } from '@/utils/rakuten-api';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';

interface PreloadedNewBooksData {
  availableBooks: NewBook[];
  preorderBooks: NewBook[];
  lastUpdated: number;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  preloadedNewBooksData: PreloadedNewBooksData | null;
  isPreloadingBooks: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAuthenticated: false,
  preloadedNewBooksData: null,
  isPreloadingBooks: false,
});

export function useAuth() {
  return useContext(AuthContext);
}

interface AuthProviderProps {
  children: ReactNode;
}

// バックグラウンドデータ取得用のキャッシュ
let backgroundFetchCache: PreloadedNewBooksData | null = null;
let isBackgroundFetching = false;

/**
 * バックグラウンドで新刊データを取得
 */
async function preloadNewBooksData(userBooks: BookData[]): Promise<PreloadedNewBooksData | null> {
  if (isBackgroundFetching) {
    return null;
  }

  // キャッシュが24時間以内の場合はスキップ
  if (backgroundFetchCache && Date.now() - backgroundFetchCache.lastUpdated < 24 * 60 * 60 * 1000) {
    return backgroundFetchCache;
  }

  isBackgroundFetching = true;

  try {
    const authorsSet = new Set<string>();
    userBooks.forEach((book) => {
      if (book.author && book.author.trim()) {
        authorsSet.add(book.author.trim());
      }
    });

    const authors = Array.from(authorsSet);
    if (authors.length === 0) {
      isBackgroundFetching = false;
      return null;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allAvailableBooks: NewBook[] = [];
    const allPreorderBooks: NewBook[] = [];

    // バックグラウンドプリロードの最適化設定
    const BATCH_SIZE = 3; // 同時に検索する著者数（並列度を上げる）
    const BATCH_DELAY = 1000; // バッチ間の待機時間（1秒に短縮）

    const searchAuthorBooks = async (author: string): Promise<{ available: NewBook[]; preorder: NewBook[] }> => {
      try {
        const books = await searchBooksByAuthor(author, 30);
        
        return classifyAuthorBooks(author, books, userBooks, today);
      } catch (error) {
        console.log(`Background preload: skipping author ${author} due to error`);
        return { available: [], preorder: [] };
      }
    };

    for (let i = 0; i < authors.length; i += BATCH_SIZE) {
      const batch = authors.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map((author) => searchAuthorBooks(author));
      const batchResults = await Promise.all(batchPromises);
      
      batchResults.forEach((result) => {
        allAvailableBooks.push(...result.available);
        allPreorderBooks.push(...result.preorder);
      });
      
      if (i + BATCH_SIZE < authors.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY));
      }
    }

    allAvailableBooks.sort((a, b) => {
      const dateA = parseSalesDate(a.publishDate);
      const dateB = parseSalesDate(b.publishDate);
      if (!dateA || !dateB) return 0;
      return dateB.getTime() - dateA.getTime();
    });

    allPreorderBooks.sort((a, b) => {
      const dateA = parseSalesDate(a.publishDate);
      const dateB = parseSalesDate(b.publishDate);
      if (!dateA || !dateB) return 0;
      return dateA.getTime() - dateB.getTime();
    });

    const result = {
      availableBooks: allAvailableBooks,
      preorderBooks: allPreorderBooks,
      lastUpdated: Date.now(),
    };

    backgroundFetchCache = result;
    isBackgroundFetching = false;
    
    console.log('Background preload completed:', {
      availableCount: allAvailableBooks.length,
      preorderCount: allPreorderBooks.length,
    });

    return result;
  } catch (error) {
    console.error('Error preloading new books data:', error);
    isBackgroundFetching = false;
    return null;
  }
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [preloadedNewBooksData, setPreloadedNewBooksData] = useState<PreloadedNewBooksData | null>(null);
  const [isPreloadingBooks, setIsPreloadingBooks] = useState(false);
  const userBooksRef = useRef<BookData[]>([]);
  const unsubscribeUserBooksRef = useRef<(() => void) | null>(null);
  const preloadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 認証状態の変更を監視
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setLoading(false);
      
      if (user) {
        try {
          const userId = user.uid;
          const existingSettings = await getUserSettings(userId);
          
          if (!existingSettings) {
            await setUserSettings(userId, {
              displayName: user.displayName || 'ユーザー',
              email: user.email,
              profileImageUrl: user.photoURL,
            });
          } else {
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
          console.error('Error syncing user settings:', error);
        }

        // ユーザーの書籍を監視してバックグラウンドプリロードを開始
        try {
          if (unsubscribeUserBooksRef.current) {
            unsubscribeUserBooksRef.current();
          }

          unsubscribeUserBooksRef.current = subscribeUserBooks(user.uid, (books) => {
            userBooksRef.current = books;
            
            // バックグラウンドプリロード開始（デバウンス：500ms）
            if (preloadTimeoutRef.current) {
              clearTimeout(preloadTimeoutRef.current);
            }
            
            preloadTimeoutRef.current = setTimeout(() => {
              setIsPreloadingBooks(true);
              preloadNewBooksData(books).then((data) => {
                if (data) {
                  setPreloadedNewBooksData(data);
                }
                setIsPreloadingBooks(false);
              });
            }, 500);
          });
        } catch (error) {
          console.error('Error setting up background preload:', error);
        }
      } else {
        // ユーザーがログアウトした場合
        if (unsubscribeUserBooksRef.current) {
          unsubscribeUserBooksRef.current();
          unsubscribeUserBooksRef.current = null;
        }
        setPreloadedNewBooksData(null);
        setIsPreloadingBooks(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubscribeUserBooksRef.current) {
        unsubscribeUserBooksRef.current();
      }
      if (preloadTimeoutRef.current) {
        clearTimeout(preloadTimeoutRef.current);
      }
    };
  }, []);

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
    preloadedNewBooksData,
    isPreloadingBooks,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

