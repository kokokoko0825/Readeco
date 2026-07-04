# 楽天ブックスAPI移行対応

## 問題の概要

2026年5月13日以降、楽天ブックスAPIの旧エンドポイントが完全停止し、新刊情報の取得および本の登録機能が動作しなくなった。

## 原因

楽天ウェブサービスが2026年2月10日にセキュリティ強化を目的としたインフラアップグレードを実施。移行期間（2026年2月10日〜5月13日）を経て、5月14日に旧APIが完全停止した。

主な変更点:
1. **ドメイン変更**: `app.rakuten.co.jp` → `openapi.rakuten.co.jp`
2. **認証システム刷新**: `accessKey`パラメータが必須化
3. **アプリ再登録**: 新しいアプリケーションIDとアクセスキーの取得が必要

## 修正内容

### `utils/rakuten-api.ts`

1. エンドポイントURLを新ドメインに変更
   - 旧: `https://app.rakuten.co.jp/services/api/BooksTotal/Search/20170404`
   - 新: `https://openapi.rakuten.co.jp/services/api/BooksTotal/Search/20170404`

2. `accessKey`パラメータを追加
   - 環境変数: `EXPO_PUBLIC_RAKUTEN_ACCESS_KEY`
   - 全APIリクエストに`accessKey`を含めるよう修正

3. `getRakutenAccessKey()`関数を追加
   - アクセスキーの取得と検証を行う

### `.env.example`

- 必要な環境変数のテンプレートを追加
- `EXPO_PUBLIC_RAKUTEN_ACCESS_KEY`を追加

## 必要な対応

アプリを動作させるには、以下の手順が必要:

1. [楽天ウェブサービス](https://webservice.rakuten.co.jp/app/create)でアプリを再登録
2. 新しいアプリケーションIDとアクセスキーを取得
3. `.env`ファイルに以下を設定:
   ```
   EXPO_PUBLIC_RAKUTEN_APPLICATION_ID=your_new_application_id
   EXPO_PUBLIC_RAKUTEN_ACCESS_KEY=your_new_access_key
   ```

## 参考リンク

- [楽天ウェブサービス 公式ドキュメント](https://webservice.rakuten.co.jp/documentation/books-total-search)
- [楽天APIアップデート情報](https://webservice.tumblr.com/)
