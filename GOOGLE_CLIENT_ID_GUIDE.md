# Google Client ID 確認ガイド

このガイドでは、iOS Client IDとAndroid Client IDをどこで確認・取得できるかを説明します。

## 確認方法

### 方法1: Google Cloud Consoleで確認（推奨）

1. **Google Cloud Consoleにアクセス**
   - https://console.cloud.google.com/ にアクセス
   - Firebaseプロジェクトと同じプロジェクトを選択

2. **認証情報ページを開く**
   - 左側のメニューから「APIとサービス」>「認証情報」を選択

3. **OAuth 2.0 クライアント IDの一覧を確認**
   - 「OAuth 2.0 クライアント ID」セクションに、作成済みのクライアントIDが表示されます
   - 種類が「iOS」または「Android」のものを探します

### 方法2: Firebase Consoleから確認

1. **Firebase Consoleにアクセス**
   - https://console.firebase.google.com/ にアクセス
   - プロジェクトを選択

2. **Authenticationの設定を開く**
   - 左側のメニューから「Authentication」を選択
   - 「Sign-in method」タブを選択
   - 「Google」を選択

3. **Web SDK configurationを確認**
   - 「Web SDK configuration」セクションに「Web client ID」が表示されます
   - これはWeb用のクライアントIDです

**注意**: Firebase Consoleでは、iOS/Android用のクライアントIDは直接表示されません。Google Cloud Consoleで確認する必要があります。

## クライアントIDが存在しない場合の作成方法

### iOS Client IDの作成

1. Google Cloud Console > APIとサービス > 認証情報
2. 「認証情報を作成」>「OAuth 2.0 クライアント ID」を選択
3. アプリケーションの種類で「iOS」を選択
4. 以下の情報を入力：
   - **名前**: 任意の名前（例: "Readeco iOS"）
   - **Bundle ID**: `app.json`の`ios.bundleIdentifier`と同じ値
     - 現在の値: `com.anonymous.Readeco`
5. 「作成」をクリック
6. 表示された「クライアント ID」をコピー

### Android Client IDの作成

1. Google Cloud Console > APIとサービス > 認証情報
2. 「認証情報を作成」>「OAuth 2.0 クライアント ID」を選択
3. アプリケーションの種類で「Android」を選択
4. 以下の情報を入力：
   - **名前**: 任意の名前（例: "Readeco Android"）
   - **パッケージ名**: `app.json`の`android.package`と同じ値
     - 現在の値: `com.anonymous.Readeco`
   - **SHA-1証明書フィンガープリント**: 開発用の場合は以下のコマンドで取得
5. 「作成」をクリック
6. 表示された「クライアント ID」をコピー

## SHA-1証明書フィンガープリントの取得方法（Android開発用）

開発環境（デバッグキーストア）の場合：

### macOS/Linux
```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

### Windows
```bash
keytool -list -v -keystore %USERPROFILE%\.android\debug.keystore -alias androiddebugkey -storepass android -keypass android
```

出力例：
```
証明書フィンガープリント:
     SHA1: A1:B2:C3:D4:E5:F6:...
```

この「SHA1:」の値をコピーして使用します。

## 環境変数の設定

取得したクライアントIDを`.env`ファイルに設定します：

```env
# Web Client ID（Firebase Consoleから取得）
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=1072707265240-17khjslkmmqgl0v7022chdj3ttodgdi8.apps.googleusercontent.com

# iOS Client ID（Google Cloud Consoleから取得）
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=YOUR_IOS_CLIENT_ID_HERE

# Android Client ID（Google Cloud Consoleから取得）
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=YOUR_ANDROID_CLIENT_ID_HERE
```

## 現在のプロジェクト情報

`app.json`から確認できる情報：

- **iOS Bundle ID**: `com.anonymous.Readeco`
- **Android Package**: `com.anonymous.Readeco`

これらの値は、Google Cloud ConsoleでクライアントIDを作成する際に必要です。

## トラブルシューティング

### クライアントIDが見つからない場合

1. Google Cloud Consoleで、正しいプロジェクトが選択されているか確認
2. Firebaseプロジェクトと同じプロジェクトを使用しているか確認
3. OAuth同意画面が設定されているか確認（初回作成時のみ必要）

### エラーが発生する場合

- Bundle ID / パッケージ名が`app.json`の値と一致しているか確認
- SHA-1証明書フィンガープリントが正しいか確認（Androidの場合）
- 環境変数が正しく設定されているか確認（`EXPO_PUBLIC_`プレフィックスが必要）

## 参考リンク

- [Google Cloud Console](https://console.cloud.google.com/)
- [Firebase Console](https://console.firebase.google.com/)
- [OAuth 2.0 クライアント IDの作成](https://support.google.com/cloud/answer/6158849)

