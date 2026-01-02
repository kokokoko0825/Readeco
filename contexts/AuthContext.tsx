/**
 * 認証状態を管理するコンテキスト
 */

import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/utils/firebase';
import { setUserSettings, getUserSettings } from '@/utils/firebase-users';
import { subscribeUserBooks, type BookData } from '@/utils/firebase-books';
import { searchBooksByAuthor, type Book } from '@/utils/rakuten-api';
import { getUserId } from '@/utils/firebase-auth';

interface PreloadedNewBooksData {
  availableBooks: BookWithFormatted[];
  preorderBooks: BookWithFormatted[];
  lastUpdated: number;
}

interface BookWithFormatted extends Book {
  publishDateFormatted?: string;
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
 * 発売日をフォーマット
 */
function formatPublishDate(salesDate?: string): string {
  if (!salesDate) return '';
  
  const date = parseSalesDate(salesDate);
  if (!date) return salesDate;

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  
  return `${year}年${month}月${day}日`;
}

/**
 * 楽天APIのsalesDateをDateオブジェクトに変換
 */
function parseSalesDate(salesDate?: string): Date | null {
  if (!salesDate) return null;

  try {
    const match1 = salesDate.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (match1) {
      const year = parseInt(match1[1], 10);
      const month = parseInt(match1[2], 10) - 1;
      const day = parseInt(match1[3], 10);
      return new Date(year, month, day);
    }

    if (/^\d{8}$/.test(salesDate)) {
      const year = parseInt(salesDate.substring(0, 4), 10);
      const month = parseInt(salesDate.substring(4, 6), 10) - 1;
      const day = parseInt(salesDate.substring(6, 8), 10);
      return new Date(year, month, day);
    }

    const date = new Date(salesDate);
    if (!isNaN(date.getTime())) {
      return date;
    }
  } catch (error) {
    console.error('Error parsing sales date:', salesDate, error);
  }

  return null;
}

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

    const userIsbns = new Set<string>();
    userBooks.forEach((book) => {
      if (book.isbn) {
        userIsbns.add(book.isbn.replace(/[-\s]/g, ''));
      }
    });

    const newestPublishDateByAuthor = new Map<string, Date>();
    userBooks.forEach((book) => {
      if (!book.author || !book.author.trim()) return;
      
      const author = book.author.trim();
      const publishDate = parseSalesDate(book.publishDate);
      
      if (publishDate) {
        const currentNewest = newestPublishDateByAuthor.get(author);
        if (!currentNewest || publishDate > currentNewest) {
          newestPublishDateByAuthor.set(author, publishDate);
        }
      }
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allAvailableBooks: BookWithFormatted[] = [];
    const allPreorderBooks: BookWithFormatted[] = [];

    // 少ない並列度でゆっくり取得
    const BATCH_SIZE = 1;
    const BATCH_DELAY = 3000;

    const searchAuthorBooks = async (author: string): Promise<{ available: BookWithFormatted[]; preorder: BookWithFormatted[] }> => {
      try {
        const books = await searchBooksByAuthor(author, 30);
        
        const authorAvailableBooks: BookWithFormatted[] = [];
        const authorPreorderBooks: BookWithFormatted[] = [];
        
        for (const book of books) {
          const normalizedIsbn = book.isbn.replace(/[-\s]/g, '');
          if (userIsbns.has(normalizedIsbn)) {
            continue;
          }

          const publishDate = parseSalesDate(book.publishDate);
          
          const newBook: BookWithFormatted = {
            ...book,
            publishDateFormatted: formatPublishDate(book.publishDate),
          };

          if (publishDate) {
            if (publishDate <= today) {
              const newestPublishDate = newestPublishDateByAuthor.get(author);
              if (newestPublishDate && publishDate < newestPublishDate) {
                continue;
              }
              authorAvailableBooks.push(newBook);
            } else {
              authorPreorderBooks.push(newBook);
            }
          }
        }

        return { available: authorAvailableBooks, preorder: authorPreorderBooks };
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
            
            // バックグラウンドプリロード開始
            setIsPreloadingBooks(true);
            preloadNewBooksData(books).then((data) => {
              if (data) {
                setPreloadedNewBooksData(data);
              }
              setIsPreloadingBooks(false);
            });
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

