# SHA-1証明書フィンガープリント取得ガイド

Android Client IDを作成する際に必要なSHA-1証明書フィンガープリントの取得方法を説明します。

## 方法1: Expo CLIを使用（推奨・最も簡単）

Expoプロジェクトの場合、以下のコマンドでSHA-1を取得できます：

```bash
# Expo CLIがインストールされていない場合
npm install -g expo-cli

# SHA-1を取得
expo credentials:manager
```

または、EAS CLIを使用：

```bash
# EAS CLIがインストールされていない場合
npm install -g eas-cli

# ログイン（初回のみ）
eas login

# SHA-1を取得
eas credentials
```

## 方法2: Javaをインストールしてkeytoolを使用

### ステップ1: Javaをインストール

#### Homebrewを使用（macOS）

```bash
# OpenJDKをインストール
brew install openjdk

# インストール後、パスを設定
echo 'export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

#### 手動インストール

1. https://www.oracle.com/java/technologies/downloads/ にアクセス
2. macOS用のJDKをダウンロードしてインストール
3. または、https://adoptium.net/ からOpenJDKをダウンロード

### ステップ2: デバッグキーストアを作成（存在しない場合）

デバッグキーストアが存在しない場合は、以下のコマンドで作成：

```bash
mkdir -p ~/.android
keytool -genkey -v -keystore ~/.android/debug.keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000
```

### ステップ3: SHA-1を取得

```bash
# macOS/Linux
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android

# Windows
keytool -list -v -keystore %USERPROFILE%\.android\debug.keystore -alias androiddebugkey -storepass android -keypass android
```

出力例：
```
証明書フィンガープリント:
     SHA1: A1:B2:C3:D4:E5:F6:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB
     SHA256: ...
```

この「SHA1:」の値をコピーして使用します。

## 方法3: Android Studioを使用

1. Android Studioを開く
2. プロジェクトを開く
3. 右側の「Gradle」タブを開く
4. `app` > `Tasks` > `android` > `signingReport` をダブルクリック
5. 出力されたSHA-1値をコピー

## 方法4: プロジェクト内のスクリプトを使用

プロジェクトルートに `get-sha1.sh` スクリプトを作成しました。Javaがインストールされている場合、以下のコマンドで実行できます：

```bash
./get-sha1.sh
```

## トラブルシューティング

### Javaが見つからない場合

- Javaがインストールされているか確認: `java -version`
- パスが正しく設定されているか確認: `which java`
- Android Studioを使用している場合、Android Studioに含まれるJavaを使用できます

### デバッグキーストアが見つからない場合

- Android Studioでプロジェクトを一度ビルドすると自動的に作成されます
- または、上記の方法2のステップ2で手動作成できます

### SHA-1が取得できない場合

- 開発環境では、SHA-1がなくてもAndroid Client IDを作成できます（後で追加可能）
- または、本番用のキーストアを使用する場合は、そのキーストアのSHA-1を取得してください

## 注意事項

- **開発用**: デバッグキーストアのSHA-1を使用
- **本番用**: リリース用キーストアのSHA-1を使用（別途作成が必要）

開発段階では、SHA-1がなくてもAndroid Client IDを作成できますが、後で追加することをおすすめします。

