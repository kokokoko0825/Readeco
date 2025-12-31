/**
 * Firebase設定と初期化
 * 
 * 使用方法:
 * 1. Firebase Console (https://console.firebase.google.com/) でプロジェクトを作成
 * 2. Webアプリを追加してFirebase設定を取得
 * 3. 以下の環境変数を設定するか、直接設定値を記述してください:
 *    - FIREBASE_API_KEY
 *    - FIREBASE_AUTH_DOMAIN
 *    - FIREBASE_PROJECT_ID
 *    - FIREBASE_STORAGE_BUCKET
 *    - FIREBASE_MESSAGING_SENDER_ID
 *    - FIREBASE_APP_ID
 */

import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';

// Firebase設定
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || 'AIzaSyDUoqexTI_LyZ7FkVnjNWFgXjMQSTOsqdI',
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'readeco-5f99e.firebaseapp.com',
  projectId: process.env.FIREBASE_PROJECT_ID || 'readeco-5f99e',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'readeco-5f99e.firebasestorage.app',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '1072707265240',
  appId: process.env.FIREBASE_APP_ID || '1:1072707265240:web:5f0ca3d043f8919f4d2dad',
};

// Firebaseアプリの初期化（既に初期化されている場合は再利用）
let app: FirebaseApp;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

// Firestoreのインスタンスを取得
export const db: Firestore = getFirestore(app);

// Authのインスタンスを取得
// 注意: Firebase v11では、@react-native-async-storage/async-storageがインストールされていれば、
// 自動的に検出されて使用されます。警告が表示される場合でも、実際には動作します。
export const auth: Auth = getAuth(app);

export default app;



