#!/bin/bash

# SHA-1証明書フィンガープリントを取得するスクリプト

# Android StudioのJavaを探す
ANDROID_STUDIO_JAVA=""
if [ -f "/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/java" ]; then
  ANDROID_STUDIO_JAVA="/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/java"
elif [ -f "/Applications/Android Studio.app/Contents/jre/Contents/Home/bin/java" ]; then
  ANDROID_STUDIO_JAVA="/Applications/Android Studio.app/Contents/jre/Contents/Home/bin/java"
fi

# Javaのパスを決定
if [ -n "$ANDROID_STUDIO_JAVA" ]; then
  JAVA_CMD="$ANDROID_STUDIO_JAVA"
  KEYTOOL_CMD="$(dirname "$JAVA_CMD")/keytool"
elif [ -f "/opt/homebrew/opt/openjdk/bin/java" ]; then
  JAVA_CMD="/opt/homebrew/opt/openjdk/bin/java"
  KEYTOOL_CMD="/opt/homebrew/opt/openjdk/bin/keytool"
elif command -v java &> /dev/null && java -version 2>&1 | grep -q "version"; then
  JAVA_CMD="java"
  KEYTOOL_CMD="keytool"
else
  echo "エラー: Javaが見つかりません"
  echo ""
  echo "Javaをインストールする方法:"
  echo "1. Homebrewを使用: brew install openjdk"
  echo "   インストール後、以下を実行:"
  echo "   echo 'export PATH=\"/opt/homebrew/opt/openjdk/bin:\$PATH\"' >> ~/.zshrc"
  echo "   source ~/.zshrc"
  echo ""
  echo "2. Android Studioをインストール（Javaが含まれます）"
  echo ""
  echo "3. Oracle JDKをインストール: https://www.oracle.com/java/technologies/downloads/"
  echo ""
  echo "または、Expo CLIを使用する方法:"
  echo "  expo credentials:manager"
  echo ""
  echo "詳細は SHA1_GET_GUIDE.md を参照してください。"
  exit 1
fi

# デバッグキーストアのパス
DEBUG_KEYSTORE="$HOME/.android/debug.keystore"

# キーストアが存在するか確認
if [ ! -f "$DEBUG_KEYSTORE" ]; then
  echo "警告: デバッグキーストアが見つかりません: $DEBUG_KEYSTORE"
  echo ""
  echo "キーストアを作成するには、以下のコマンドを実行してください:"
  echo "keytool -genkey -v -keystore ~/.android/debug.keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000"
  echo ""
  echo "または、Android Studioでプロジェクトを一度ビルドすると自動的に作成されます。"
  exit 1
fi

# SHA-1を取得
echo "SHA-1証明書フィンガープリントを取得中..."
echo ""

$KEYTOOL_CMD -list -v -keystore "$DEBUG_KEYSTORE" -alias androiddebugkey -storepass android -keypass android 2>&1 | grep -A 1 "SHA1:" | head -2

echo ""
echo "上記の「SHA1:」の値をコピーして、Google Cloud ConsoleのAndroid Client ID作成時に使用してください。"

