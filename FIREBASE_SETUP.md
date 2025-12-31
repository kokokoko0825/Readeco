# Firebase セットアップガイド

このアプリでは、Firebaseを使用して書籍データ、ユーザー設定、フレンド情報を保存しています。

## 1. Firebaseプロジェクトの作成

### ステップ1: Firebase Consoleにアクセス

1. https://console.firebase.google.com/ にアクセスします
2. Googleアカウントでログインします

### ステップ2: プロジェクトを作成

1. 「プロジェクトを追加」をクリック
2. プロジェクト名を入力（例: `Readeco`）
3. Google Analyticsの設定（オプション）
4. プロジェクトを作成

## 2. Webアプリの追加

### ステップ1: Webアプリを追加

1. Firebase Consoleのプロジェクトダッシュボードで「</>」アイコン（Webアプリを追加）をクリック
2. アプリのニックネームを入力（例: `Readeco Web`）
3. 「このアプリのFirebase Hostingも設定します」はチェック不要（オプション）
4. 「アプリを登録」をクリック

### ステップ2: Firebase設定を取得

アプリ登録後、以下のような設定情報が表示されます：

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

## 3. Firebase Authenticationの設定

### ステップ1: Authenticationを有効化

1. Firebase Consoleで「Authentication」を選択
2. 「始める」をクリック
3. 「Sign-in method」タブを選択

### ステップ2: メール/パスワード認証を有効化

1. 「メール/パスワード」を選択
2. 「有効にする」をクリック
3. 「メール/パスワード（最初の方法）」を有効にする
4. 「保存」をクリック

これで、メールアドレスとパスワードを使用したサインアップ・サインインが可能になります。

## 4. Firestore Databaseの設定

### ステップ1: Firestore Databaseを作成

1. Firebase Consoleで「Firestore Database」を選択
2. 「データベースを作成」をクリック
3. セキュリティルールを選択：
   - **開発モード**: テスト用（30日間の無料期間）
   - **本番モード**: セキュリティルールを設定（推奨）

### ステップ2: セキュリティルールの設定（本番モードの場合）

本番モードを選択した場合、以下のようなセキュリティルールを設定してください：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 書籍データ（認証済みユーザーのみアクセス可能）
    match /books/{bookId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
    
    // ユーザー設定（認証済みユーザーのみアクセス可能）
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // フレンド関係（認証済みユーザーのみアクセス可能）
    match /friends/{friendId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
  }
}
```

**注意**: これらのセキュリティルールは、Firebase Authenticationを使用していることを前提としています。

## 5. アプリへの設定

### 方法1: 環境変数を使用（推奨）

1. プロジェクトのルートディレクトリに `.env` ファイルを作成：

```env
FIREBASE_API_KEY=YOUR_API_KEY
FIREBASE_AUTH_DOMAIN=YOUR_AUTH_DOMAIN
FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
FIREBASE_STORAGE_BUCKET=YOUR_STORAGE_BUCKET
FIREBASE_MESSAGING_SENDER_ID=YOUR_MESSAGING_SENDER_ID
FIREBASE_APP_ID=YOUR_APP_ID
```

2. `.env` ファイルを `.gitignore` に追加して、Gitにコミットしないようにしてください

### 方法2: 直接コードに記述（開発用）

`utils/firebase.ts` ファイルの `firebaseConfig` を直接編集：

```typescript
const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_AUTH_DOMAIN',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_STORAGE_BUCKET',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID',
};
```

## 6. 必要なパッケージのインストール

以下のコマンドで必要なパッケージをインストールしてください：

```bash
npm install firebase @react-native-async-storage/async-storage
```

または

```bash
pnpm install firebase @react-native-async-storage/async-storage
```

## 7. データ構造

### books コレクション

```typescript
{
  title: string;
  author: string;
  isbn: string;
  url: string;
  imageUrl: string;
  publisher?: string;
  publishDate?: string;
  price?: number;
  description?: string; // あらすじ
  userId: string;
  addedAt: Timestamp;
}
```

### users コレクション

```typescript
{
  userId: string;
  displayName: string;
  email?: string;
  profileImageUrl?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### friends コレクション

```typescript
{
  userId: string;
  friendId: string;
  friendDisplayName: string;
  createdAt: Timestamp;
}
```

## 8. 動作確認

1. Firebase設定を完了したら、アプリを起動します
2. 認証画面が表示されるので、サインアップまたはサインインします
3. 認証後、メイン画面（本棚）が表示されます
4. 「登録」タブから本をバーコードスキャンして追加
5. 「本棚」タブで追加した本が表示されることを確認
6. 「設定」タブでユーザー設定とフレンド登録をテスト
7. 「設定」タブからサインアウトできることを確認

## トラブルシューティング

### エラー: 「Firebase: Error (auth/...)」

- Firebase設定が正しく設定されているか確認してください
- 環境変数が正しく読み込まれているか確認してください

### エラー: 「Permission denied」

- Firestoreのセキュリティルールを確認してください
- 開発モードを使用している場合、30日間の無料期間が過ぎていないか確認してください

### エラー: 「書籍の追加に失敗しました」

- Firestore Databaseが正しく作成されているか確認してください
- ネットワーク接続を確認してください

## 認証機能について

このアプリでは、Firebase Authenticationを使用して以下の機能を提供しています：

- **サインアップ**: メールアドレスとパスワードで新規アカウントを作成
- **サインイン**: 既存のアカウントでログイン
- **サインアウト**: ログアウトして認証画面に戻る
- **認証ガード**: 認証されていないユーザーは自動的に認証画面にリダイレクト

認証状態は自動的に管理され、アプリを再起動してもログイン状態が維持されます。

## 参考リンク

- [Firebase Console](https://console.firebase.google.com/)
- [Firestore ドキュメント](https://firebase.google.com/docs/firestore)
- [Firebase Authentication ドキュメント](https://firebase.google.com/docs/auth)
- [Firebase Authentication メール/パスワード認証](https://firebase.google.com/docs/auth/web/password-auth)

