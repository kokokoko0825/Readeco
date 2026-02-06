/**
 * Firebase設定と初期化
 *
 * 使用方法:
 * 1. Firebase Console (https://console.firebase.google.com/) でプロジェクトを作成
 * 2. Webアプリを追加してFirebase設定を取得
 * 3. 以下の環境変数を .env に設定してください (Web/Expo では EXPO_PUBLIC_ が必須):
 *    - EXPO_PUBLIC_FIREBASE_API_KEY
 *    - EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
 *    - EXPO_PUBLIC_FIREBASE_PROJECT_ID
 *    - EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
 *    - EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
 *    - EXPO_PUBLIC_FIREBASE_APP_ID
 *    （旧 FIREBASE_* はフォールバックとして利用）
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  getAuth,
  getReactNativePersistence,
  initializeAuth,
} from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';

type FirebaseEnv = {
  EXPO_PUBLIC_FIREBASE_API_KEY?: string;
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN?: string;
  EXPO_PUBLIC_FIREBASE_PROJECT_ID?: string;
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET?: string;
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?: string;
  EXPO_PUBLIC_FIREBASE_APP_ID?: string;
};

const firebaseEnv: FirebaseEnv = {
  EXPO_PUBLIC_FIREBASE_API_KEY:
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? process.env.FIREBASE_API_KEY,
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN:
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ??
    process.env.FIREBASE_AUTH_DOMAIN,
  EXPO_PUBLIC_FIREBASE_PROJECT_ID:
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ??
    process.env.FIREBASE_PROJECT_ID,
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET:
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    process.env.FIREBASE_STORAGE_BUCKET,
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ??
    process.env.FIREBASE_MESSAGING_SENDER_ID,
  EXPO_PUBLIC_FIREBASE_APP_ID:
    process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? process.env.FIREBASE_APP_ID,
};

function assertFirebaseEnv(
  env: FirebaseEnv,
): asserts env is Required<FirebaseEnv> {
  const missingKeys = Object.entries(env)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingKeys.length > 0) {
    throw new Error(
      `Firebase環境変数が未設定です: ${missingKeys.join(", ")}`,
    );
  }
}

assertFirebaseEnv(firebaseEnv);

// Firebase設定
const firebaseConfig = {
  apiKey: firebaseEnv.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: firebaseEnv.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: firebaseEnv.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: firebaseEnv.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: firebaseEnv.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: firebaseEnv.EXPO_PUBLIC_FIREBASE_APP_ID,
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
// Web と ネイティブ（iOS/Android）で初期化方法を分ける
let authInstance: Auth;

if (Platform.OS === 'web') {
  // Web では通常の getAuth を使用
  authInstance = getAuth(app);
} else {
  // ネイティブ（React Native）では AsyncStorage を永続化に利用
  // initializeAuth は同一アプリに対して一度だけ呼び出される必要がある
  try {
    authInstance = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // 既に initializeAuth 済みの場合は getAuth で再取得
    authInstance = getAuth(app);
  }
}

export const auth: Auth = authInstance;

export default app;
