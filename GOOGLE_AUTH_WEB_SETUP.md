# Google認証 Web環境セットアップガイド

このガイドでは、Web環境でGoogle認証を正しく動作させるための設定手順を説明します。

## 必要な設定

### 1. Firebase Consoleで承認済みドメインを追加

Google認証を使用するには、Firebase Consoleで使用するドメインを承認する必要があります。

#### 手順:

1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. プロジェクト「readeco-5f99e」を選択
3. 左メニューから「Authentication」を選択
4. 「Settings」タブを選択
5. 「Authorized domains」セクションまでスクロール
6. 以下のドメインを追加:
   - `localhost` (開発環境用)
   - 本番環境のドメイン（例: `your-app.pages.dev`）
   - Cloudflare Pagesのドメイン（デプロイ後に表示されるURL）

#### 追加方法:

1. 「Add domain」ボタンをクリック
2. ドメイン名を入力（例: `localhost`）
3. 「Add」をクリック

**注意**: `localhost`は開発環境で必要です。本番環境では、実際のドメイン（Cloudflare PagesのURLなど）を追加してください。

### 2. Google Cloud Consoleでの設定（オプション、エラーが出る場合のみ）

通常、Firebase Consoleの設定だけで十分ですが、エラーが続く場合は以下の設定も確認してください。

#### OAuth 2.0 クライアントIDの設定確認:

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. プロジェクトを選択（Firebaseプロジェクトと同じ）
3. 「APIとサービス」>「認証情報」を選択
4. 「OAuth 2.0 クライアント ID」の一覧から「Web client (auto created by Google Service)」を探してクリック
5. 「承認済みのJavaScriptの生成元」セクションで以下を追加:
   - `http://localhost:8081` (Expo開発サーバー)
   - `http://localhost:19006` (Expo Web)
   - 本番環境のURL（例: `https://your-app.pages.dev`）
6. 「承認済みのリダイレクト URI」セクションで以下を追加:
   - `http://localhost:8081/__/auth/handler`
   - `http://localhost:19006/__/auth/handler`
   - `https://your-app.pages.dev/__/auth/handler`
7. 「保存」をクリック

### 3. OAuth同意画面の設定確認

1. Google Cloud Consoleで「APIとサービス」>「OAuth同意画面」を選択
2. 「User Type」が「External」に設定されていることを確認
3. テストユーザーを追加（開発中の場合）:
   - 「Test users」セクションで「ADD USERS」をクリック
   - 使用するGoogleアカウントのメールアドレスを追加
   - 「SAVE」をクリック

**注意**: アプリを公開する場合は、OAuth同意画面を「公開」状態にする必要があります。

## 実装の変更点

以下の変更が行われました：

1. **Web環境用のGoogle認証関数を追加**
   - `utils/firebase-auth.ts`に`signInWithGooglePopup()`関数を追加
   - FirebaseのネイティブなPopup認証を使用

2. **プラットフォーム別の認証処理**
   - Web環境: Firebase `signInWithPopup`を使用
   - iOS/Android: `expo-auth-session`を使用

3. **エラーハンドリングの改善**
   - Web環境特有のエラーメッセージを追加
   - ポップアップブロック、ドメイン未承認などのエラーに対応

## トラブルシューティング

### エラー: "Access blocked: Authorization Error"

**原因**: Google Cloud ConsoleまたはFirebase Consoleでドメインが承認されていません。

**解決方法**:
1. Firebase Consoleで「Authorized domains」にドメインを追加
2. Google Cloud Consoleで「承認済みのJavaScriptの生成元」にURLを追加

### エラー: "auth/unauthorized-domain"

**原因**: 現在のドメインがFirebase Consoleで承認されていません。

**解決方法**:
1. Firebase Console > Authentication > Settings > Authorized domainsにアクセス
2. 現在使用しているドメインを追加

### エラー: "auth/popup-blocked"

**原因**: ブラウザがポップアップをブロックしています。

**解決方法**:
1. ブラウザのアドレスバーでポップアップブロックのアイコンをクリック
2. このサイトのポップアップを許可
3. Google認証ボタンを再度クリック

### エラー: "auth/popup-closed-by-user"

**原因**: ユーザーが認証ポップアップを閉じました。

**解決方法**: これは正常な動作です。ユーザーが再度認証を試みることができます。

## 開発環境での動作確認

1. 開発サーバーを起動:
   ```bash
   pnpm start
   ```

2. ブラウザでアプリを開く（通常は`http://localhost:8081`）

3. 認証画面で「Googleでサインイン」ボタンをクリック

4. Googleアカウントを選択

5. 認証が成功すると、メイン画面に遷移

## 本番環境へのデプロイ

Cloudflare Pagesにデプロイする場合:

1. アプリをビルド:
   ```bash
   pnpm run build:web
   ```

2. Cloudflare Pagesにデプロイ:
   ```bash
   pnpm run deploy:pages
   ```

3. デプロイ後に表示されるURL（例: `https://readeco.pages.dev`）をFirebase Consoleの「Authorized domains」に追加

## 参考リンク

- [Firebase Authentication - Authorized Domains](https://firebase.google.com/docs/auth/web/google-signin#authenticate_with_firebase_using_the_google_provider_object)
- [Google Cloud Console - OAuth 2.0設定](https://console.cloud.google.com/apis/credentials)
- [Firebase Console](https://console.firebase.google.com/)
