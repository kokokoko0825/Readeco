/**
 * Firebaseを使用した書籍データの管理
 */

import {
    addDoc,
    collection,
    deleteDoc,
    deleteField,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    query,
    Timestamp,
    updateDoc,
    where,
    type DocumentData,
    type QueryDocumentSnapshot,
    type Unsubscribe
} from 'firebase/firestore';
import { db } from './firebase';
import type { Book } from './rakuten-api';

// Firebaseに保存する書籍データの型
export interface BookData extends Book {
  id?: string; // FirestoreのドキュメントID
  userId: string; // ユーザーID
  addedAt: Date; // 追加日時
  description?: string; // あらすじ
  customSeriesId?: string; // カスタムシリーズID（ドラッグ&ドロップでグループ化）
}

// FirestoreのドキュメントをBookDataに変換
function docToBookData(docSnap: QueryDocumentSnapshot<DocumentData>): BookData {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    title: data.title,
    author: data.author,
    isbn: data.isbn,
    url: data.url,
    imageUrl: data.imageUrl,
    publisher: data.publisher,
    publishDate: data.publishDate,
    price: data.price,
    description: data.description,
    userId: data.userId,
    addedAt: data.addedAt?.toDate() || new Date(),
    customSeriesId: data.customSeriesId,
  };
}

/**
 * オブジェクトからundefined値を除外するヘルパー関数
 */
function removeUndefinedValues<T extends Record<string, any>>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * 書籍をFirebaseに追加
 */
export async function addBookToFirebase(
  book: Book,
  userId: string,
  description?: string
): Promise<string> {
  try {
    const bookData: Omit<BookData, 'id'> = {
      ...book,
      userId,
      addedAt: new Date(),
      description,
    };

    // undefined値を除外してFirestoreに保存
    const firestoreData = removeUndefinedValues({
      ...bookData,
      addedAt: Timestamp.fromDate(bookData.addedAt),
    });

    const docRef = await addDoc(collection(db, 'books'), firestoreData);

    return docRef.id;
  } catch (error) {
    console.error('Error adding book to Firebase:', error);
    throw new Error('書籍の追加に失敗しました');
  }
}

/**
 * ユーザーの書籍一覧を取得（一度だけ）
 */
export async function getUserBooks(userId: string): Promise<BookData[]> {
  try {
    // まず、whereのみでクエリを実行（インデックスが不要）
    const q = query(
      collection(db, 'books'),
      where('userId', '==', userId)
    );

    const querySnapshot = await getDocs(q);
    const books = querySnapshot.docs.map(docToBookData);
    
    // クライアント側でソート（addedAtの降順）
    books.sort((a, b) => {
      const dateA = a.addedAt.getTime();
      const dateB = b.addedAt.getTime();
      return dateB - dateA; // 降順
    });
    
    return books;
  } catch (error: any) {
    console.error('Error fetching user books:', error);
    
    // インデックスエラーの場合、より詳細なメッセージを表示
    if (error.code === 'failed-precondition' && error.message?.includes('index')) {
      const errorMessage = 
        'Firestoreのインデックスが必要です。\n\n' +
        '以下のリンクからインデックスを作成してください：\n' +
        (error.message.match(/https:\/\/[^\s]+/) || ['Firebase Console'])[0] +
        '\n\nまたは、FIREBASE_INDEX_SETUP.mdを参照してください。';
      throw new Error(errorMessage);
    }
    
    throw new Error('書籍一覧の取得に失敗しました');
  }
}

/**
 * ユーザーの書籍一覧をリアルタイムで監視
 * @param userId ユーザーID
 * @param callback 書籍一覧が更新されたときに呼ばれるコールバック関数
 * @returns リスナーの解除関数
 */
export function subscribeUserBooks(
  userId: string,
  callback: (books: BookData[]) => void
): Unsubscribe {
  try {
    const q = query(
      collection(db, 'books'),
      where('userId', '==', userId)
    );

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const books = querySnapshot.docs.map(docToBookData);
        
        // クライアント側でソート（addedAtの降順）
        books.sort((a, b) => {
          const dateA = a.addedAt.getTime();
          const dateB = b.addedAt.getTime();
          return dateB - dateA; // 降順
        });
        
        callback(books);
      },
      (error: any) => {
        console.error('Error in user books subscription:', error);
        
        // インデックスエラーの場合、より詳細なメッセージを表示
        if (error.code === 'failed-precondition' && error.message?.includes('index')) {
          const errorMessage = 
            'Firestoreのインデックスが必要です。\n\n' +
            '以下のリンクからインデックスを作成してください：\n' +
            (error.message.match(/https:\/\/[^\s]+/) || ['Firebase Console'])[0] +
            '\n\nまたは、FIREBASE_INDEX_SETUP.mdを参照してください。';
          console.error(errorMessage);
        }
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('Error setting up user books subscription:', error);
    throw new Error('書籍一覧の監視に失敗しました');
  }
}

/**
 * 書籍IDで書籍を取得
 */
export async function getBookById(bookId: string): Promise<BookData | null> {
  try {
    const docRef = doc(db, 'books', bookId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return docToBookData(docSnap as QueryDocumentSnapshot<DocumentData>);
  } catch (error) {
    console.error('Error fetching book by ID:', error);
    throw new Error('書籍の取得に失敗しました');
  }
}

/**
 * 書籍を更新
 */
export async function updateBook(
  bookId: string,
  updates: Partial<BookData>
): Promise<void> {
  try {
    const docRef = doc(db, 'books', bookId);
    const updateData: any = {};

    // 各フィールドを処理
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === undefined) {
        // nullまたはundefinedの場合はフィールドを削除
        updateData[key] = deleteField();
      } else if (key === 'addedAt' && value instanceof Date) {
        // DateオブジェクトをTimestampに変換
        updateData[key] = Timestamp.fromDate(value);
      } else {
        updateData[key] = value;
      }
    }

    await updateDoc(docRef, updateData);
  } catch (error) {
    console.error('Error updating book:', error);
    throw new Error('書籍の更新に失敗しました');
  }
}

/**
 * 書籍を削除
 */
export async function deleteBook(bookId: string): Promise<void> {
  try {
    const docRef = doc(db, 'books', bookId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting book:', error);
    throw new Error('書籍の削除に失敗しました');
  }
}

/**
 * ISBNで書籍が既に登録されているかチェック
 */
export async function isBookAlreadyAdded(
  userId: string,
  isbn: string
): Promise<boolean> {
  try {
    const q = query(
      collection(db, 'books'),
      where('userId', '==', userId),
      where('isbn', '==', isbn)
    );

    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error('Error checking if book is already added:', error);
    return false;
  }
}

/**
 * 複数のユーザーの書籍一覧を取得（フレンドの本を取得するため）
 */
export async function getBooksByUserIds(userIds: string[]): Promise<BookData[]> {
  try {
    if (userIds.length === 0) {
      return [];
    }

    // Firestoreの`in`クエリは最大10個の値までしか指定できないため、
    // 10個ずつに分割してクエリを実行
    const batchSize = 10;
    const allBooks: BookData[] = [];

    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      const q = query(
        collection(db, 'books'),
        where('userId', 'in', batch)
      );

      const querySnapshot = await getDocs(q);
      const books = querySnapshot.docs.map(docToBookData);
      allBooks.push(...books);
    }

    // クライアント側でソート（addedAtの降順）
    allBooks.sort((a, b) => {
      const dateA = a.addedAt.getTime();
      const dateB = b.addedAt.getTime();
      return dateB - dateA; // 降順
    });

    return allBooks;
  } catch (error: any) {
    console.error('Error fetching books by user IDs:', error);
    
    // インデックスエラーの場合、より詳細なメッセージを表示
    if (error.code === 'failed-precondition' && error.message?.includes('index')) {
      const errorMessage = 
        'Firestoreのインデックスが必要です。\n\n' +
        '以下のリンクからインデックスを作成してください：\n' +
        (error.message.match(/https:\/\/[^\s]+/) || ['Firebase Console'])[0] +
        '\n\nまたは、FIREBASE_INDEX_SETUP.mdを参照してください。';
      throw new Error(errorMessage);
    }
    
    throw new Error('書籍一覧の取得に失敗しました');
  }
}

