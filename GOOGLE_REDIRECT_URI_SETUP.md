# Google認証リダイレクトURI設定ガイド

iPhoneでGoogle認証を使用する際に「アクセスをブロック」エラーが発生する場合、Google Cloud ConsoleでリダイレクトURIを許可する必要があります。

## エラーの原因

エラーメッセージ: `redirect_uri=exp://192.168.0.22:8081 flowName=GeneralOAuthFlow`

このエラーは、Google Cloud ConsoleでExpo開発環境のリダイレクトURIが許可されていないために発生します。

## 解決方法

### ステップ1: Google Cloud ConsoleでOAuth 2.0クライアントIDを確認

1. Google Cloud Console (https://console.cloud.google.com/) にアクセス
2. プロジェクトを選択（Firebaseプロジェクトと同じ）
3. 「APIとサービス」>「認証情報」を選択
4. 「OAuth 2.0 クライアント ID」セクションで、使用しているクライアントIDを確認
   - iOS: iOS Client ID
   - Android: Android Client ID
   - Web: Web Client ID

### ステップ2: 承認済みのリダイレクトURIを追加

1. 使用しているクライアントID（iOS/Android/Web）をクリックして編集
2. 「承認済みのリダイレクトURI」セクションに以下を追加：

#### iOS Client IDの場合

```
exp://localhost:8081
exp://127.0.0.1:8081
exp://192.168.0.22:8081
exp://192.168.0.*:8081
```

**注意**: `192.168.0.22`は開発環境のIPアドレスです。環境に応じて変更してください。

#### Android Client IDの場合

```
exp://localhost:8081
exp://127.0.0.1:8081
exp://192.168.0.22:8081
exp://192.168.0.*:8081
```

#### Web Client IDの場合

```
http://localhost:8081
http://127.0.0.1:8081
http://192.168.0.22:8081
```

### ステップ3: ワイルドカードの使用（推奨）

開発環境のIPアドレスが変わる可能性があるため、ワイルドカードを使用することもできます：

```
exp://192.168.0.*:8081
exp://192.168.*.*:8081
```

**注意**: ワイルドカードは一部のOAuthプロバイダーでサポートされていない場合があります。

### ステップ4: 本番環境用のリダイレクトURI

本番環境（Expo Goやビルド済みアプリ）の場合、以下の形式を使用：

```
readeco://
```

`app.json`の`scheme`で設定した値（`readeco`）を使用します。

## 現在の開発環境のIPアドレスを確認

ターミナルで以下のコマンドを実行：

```bash
# macOS/Linux
ifconfig | grep "inet " | grep -v 127.0.0.1

# または
ipconfig getifaddr en0
```

表示されたIPアドレス（例: `192.168.0.22`）をリダイレクトURIに追加してください。

## トラブルシューティング

### エラーが続く場合

1. **リダイレクトURIが正しく追加されているか確認**
   - Google Cloud Consoleで、追加したリダイレクトURIが保存されているか確認
   - 変更が反映されるまで数分かかる場合があります

2. **IPアドレスが変更されていないか確認**
   - 開発環境のIPアドレスが変わった場合、新しいIPアドレスを追加する必要があります
   - ワイルドカードを使用することで、この問題を回避できます

3. **OAuth同意画面の設定を確認**
   - Google Cloud Console > APIとサービス > OAuth同意画面
   - アプリが正しく設定されているか確認

4. **クライアントIDが正しいか確認**
   - 使用しているクライアントIDが、Google Cloud Consoleで作成したものと一致しているか確認

## 参考リンク

- [Google Cloud Console](https://console.cloud.google.com/)
- [OAuth 2.0 リダイレクトURIの設定](https://developers.google.com/identity/protocols/oauth2/web-server#creatingcred)


