# Google認証セットアップガイド

このアプリでは、Firebase Authenticationを使用してGoogleアカウントでのサインアップ・サインインが可能です。

## 1. Firebase ConsoleでGoogle認証を有効化

### ステップ1: AuthenticationでGoogle認証を有効化

1. Firebase Console (https://console.firebase.google.com/) にアクセス
2. プロジェクトを選択
3. 「Authentication」を選択
4. 「Sign-in method」タブを選択
5. 「Google」を選択
6. 「有効にする」をクリック
7. 「プロジェクトのサポートメール」を選択または入力
8. 「保存」をクリック

### ステップ2: OAuth 2.0クライアントIDを取得

1. Google認証の設定画面で「Web SDK configuration」セクションを確認
2. 「Web client ID」をコピー（例: `123456789-abcdefghijklmnop.apps.googleusercontent.com`）

## 2. Expo用のGoogle認証設定

### ステップ1: Google Cloud ConsoleでOAuth 2.0クライアントIDを作成・確認

#### iOS Client IDの確認方法

1. Google Cloud Console (https://console.cloud.google.com/) にアクセス
2. プロジェクトを選択（Firebaseプロジェクトと同じ）
3. 「APIとサービス」>「認証情報」を選択
4. 「OAuth 2.0 クライアント ID」の一覧を確認
5. 種類が「iOS」のクライアントIDを探す
   - 既に存在する場合は、その「クライアント ID」をコピー
   - 存在しない場合は、以下の手順で作成：
     - 「認証情報を作成」>「OAuth 2.0 クライアント ID」を選択
     - アプリケーションの種類で「iOS」を選択
     - 名前を入力（例: "Readeco iOS"）
     - Bundle IDを入力（`app.json`の`ios.bundleIdentifier`と同じ値、例: `com.anonymous.Readeco`）
     - 「作成」をクリック
     - 表示された「クライアント ID」をコピー

#### Android Client IDの確認方法

1. Google Cloud Console (https://console.cloud.google.com/) にアクセス
2. プロジェクトを選択（Firebaseプロジェクトと同じ）
3. 「APIとサービス」>「認証情報」を選択
4. 「OAuth 2.0 クライアント ID」の一覧を確認
5. 種類が「Android」のクライアントIDを探す
   - 既に存在する場合は、その「クライアント ID」をコピー
   - 存在しない場合は、以下の手順で作成：
     - 「認証情報を作成」>「OAuth 2.0 クライアント ID」を選択
     - アプリケーションの種類で「Android」を選択
     - 名前を入力（例: "Readeco Android"）
     - パッケージ名を入力（`app.json`の`android.package`と同じ値、例: `com.anonymous.Readeco`）
     - SHA-1証明書フィンガープリントを入力（開発用の場合は、`keytool`コマンドで取得可能）
     - 「作成」をクリック
     - 表示された「クライアント ID」をコピー

#### 補足: SHA-1証明書フィンガープリントの取得方法（Android開発用）

開発環境の場合：
```bash
# macOS/Linux
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android

# Windows
keytool -list -v -keystore %USERPROFILE%\.android\debug.keystore -alias androiddebugkey -storepass android -keypass android
```

出力された「SHA1:」の値をコピーして使用します。

### ステップ2: 環境変数の設定

プロジェクトのルートディレクトリに `.env` ファイルを作成（または既存のファイルに追加）：

```env
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=YOUR_WEB_CLIENT_ID
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=YOUR_IOS_CLIENT_ID
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=YOUR_ANDROID_CLIENT_ID
EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID=YOUR_EXPO_CLIENT_ID
```

**注意**: 
- `EXPO_PUBLIC_` プレフィックスが必要です（Expoで環境変数を公開するため）
- Web Client IDは、Firebase Console > Authentication > Sign-in method > Google > Web SDK configuration から取得できます
- iOS/Android Client IDは、Google Cloud Consoleで作成する必要があります
- Expo Client IDは、Expo開発用のクライアントIDです（開発時のみ必要）

### ステップ3: app.jsonの設定（オプション）

`app.json`にGoogle認証の設定を追加することもできます：

```json
{
  "expo": {
    "ios": {
      "googleServicesFile": "./GoogleService-Info.plist"
    },
    "android": {
      "googleServicesFile": "./google-services.json"
    }
  }
}
```

## 3. 動作確認

1. アプリを起動
2. 認証画面で「Googleでサインイン」ボタンをタップ
3. Googleアカウントを選択
4. 認証が成功すると、メイン画面に遷移

## トラブルシューティング

### エラー: 「Google認証に失敗しました」

- Google認証がFirebase Consoleで有効になっているか確認
- OAuth 2.0クライアントIDが正しく設定されているか確認
- 環境変数が正しく読み込まれているか確認（`EXPO_PUBLIC_`プレフィックスが必要）

### エラー: 「認証情報が無効です」

- Google Cloud ConsoleでOAuth 2.0クライアントIDが正しく作成されているか確認
- Firebase ConsoleとGoogle Cloud Consoleで同じプロジェクトを使用しているか確認

### 警告: 「AsyncStorageが使用されていません」

- `@react-native-async-storage/async-storage`がインストールされているか確認
- Firebase v11では、AsyncStorageが自動的に検出されるはずです

## 参考リンク

- [Firebase Authentication ドキュメント](https://firebase.google.com/docs/auth)
- [Google認証の設定](https://firebase.google.com/docs/auth/web/google-signin)
- [Expo AuthSession ドキュメント](https://docs.expo.dev/guides/authentication/#google)

