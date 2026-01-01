# Cloudflare Workers/Pages デプロイガイド

このドキュメントでは、ReadecoアプリをCloudflare Workers/Pagesにデプロイする手順を説明します。

## 前提条件

- Node.js (v18以上推奨)
- pnpm (v8以上推奨)
- Cloudflareアカウント（無料アカウントで可）

## セットアップ手順

### 1. 依存関係のインストール

まず、必要な依存関係をインストールします：

```bash
pnpm install
```

### 2. Cloudflareアカウントにログイン

Wranglerを使用してCloudflareアカウントにログインします：

```bash
pnpm exec wrangler login
```

または：

```bash
pnpm dlx wrangler login
```

ブラウザが開き、Cloudflareアカウントでの認証を求められます。認証が完了すると、ローカル環境でWranglerが使用できるようになります。

### 3. wrangler.tomlの設定

プロジェクトルートにある`wrangler.toml`ファイルを編集して、あなたのCloudflareアカウントIDを設定してください。

Cloudflareダッシュボード（https://dash.cloudflare.com/）にアクセスし、右上のアカウントIDをコピーして、`wrangler.toml`の`account_id`に設定してください。

**注意**: `wrangler.toml`の`account_id`フィールドは現在コメントアウトされていますが、必要に応じて有効化できます。通常、`wrangler login`後に自動的に設定されるため、明示的に設定する必要はありません。

### 4. 環境変数の設定（オプション）

アプリケーションで環境変数を使用する場合、Cloudflareダッシュボードで設定するか、以下のコマンドでシークレットを設定できます：

```bash
# 例: 楽天APIのアプリケーションIDを設定
pnpm exec wrangler secret put RAKUTEN_APPLICATION_ID
```

または：

```bash
pnpm dlx wrangler secret put RAKUTEN_APPLICATION_ID
```

## デプロイ方法

ReadecoアプリをCloudflareにデプロイするには、以下の2つの方法があります：

### 方法1: Cloudflare Pagesを使用（推奨）

Expo Webアプリは静的サイトとしてビルドできるため、Cloudflare Pagesを使用するのが最適です。

#### 手動デプロイ

1. Webアプリをビルド：

```bash
pnpm run build:web
```

これにより、`dist`ディレクトリに静的ファイルが生成されます。

**注意**: Expoのバージョンによっては、出力ディレクトリが`web-build`になる場合があります。その場合は、`package.json`の`deploy:pages`スクリプト内の`dist`を`web-build`に変更してください。

2. Cloudflare Pagesにデプロイ：

```bash
pnpm run deploy:pages
```

または、Cloudflareダッシュボードから直接デプロイすることもできます：

1. [Cloudflare Pages](https://dash.cloudflare.com/?to=/:account/pages)にアクセス
2. 「プロジェクトを作成」をクリック
3. 「プロジェクトをアップロード」を選択
4. ビルドした`dist`ディレクトリをドラッグ&ドロップ
5. プロジェクト名を入力してデプロイ

#### 自動デプロイ（Git連携）

1. Cloudflare Pagesダッシュボードで「GitHubと接続」または「GitLabと接続」を選択
2. リポジトリを選択
3. ビルド設定を以下に設定：
   - **ビルドコマンド**: `pnpm run build:web`
   - **ビルド出力ディレクトリ**: `dist`
   - **ルートディレクトリ**: `/`（プロジェクトルート）
   - **Node.js バージョン**: `18` または `20`（推奨）

これにより、GitHub/GitLabへのプッシュのたびに自動的にデプロイが行われます。

### 方法2: Cloudflare Workersを使用

Cloudflare WorkersでAPIやサーバーレス関数をホストする場合：

```bash
pnpm run deploy:worker
```

**注意**: 現在、Workerのエントリーポイント（`src/index.ts`）は作成されていません。APIが必要な場合は、Workerファイルを作成してください。

## デプロイ後の確認

デプロイが完了すると、以下のようなURLが表示されます：

- **Cloudflare Pages**: `https://<project-name>.pages.dev`
- **Cloudflare Workers**: `https://<worker-name>.<subdomain>.workers.dev`

このURLにアクセスして、アプリケーションが正常に動作することを確認してください。

## トラブルシューティング

### ビルドエラーが発生する場合

- Node.jsのバージョンを確認（v18以上推奨）
- `node_modules`を削除して再インストール：`rm -rf node_modules && pnpm install`
- Expoのキャッシュをクリア：`pnpm exec expo start --clear`

### デプロイエラーが発生する場合

- `wrangler login`が完了しているか確認
- `wrangler.toml`の設定が正しいか確認
- Cloudflareアカウントの制限（無料プランの場合、1日あたりのデプロイ回数に制限がある場合があります）

### SPAルーティングが動作しない場合

`public/_redirects`ファイルが正しく配置されているか確認してください。このファイルは、すべてのルートを`index.html`にリダイレクトして、Expo Routerのクライアントサイドルーティングを有効にします。

## カスタムドメインの設定

Cloudflare Pagesでカスタムドメインを使用する場合：

1. Cloudflare Pagesダッシュボードでプロジェクトを開く
2. 「カスタムドメイン」タブを開く
3. ドメインを入力して設定
4. DNSレコードを追加（Cloudflareが自動的に設定してくれる場合もあります）

## 参考リンク

- [Cloudflare Pages ドキュメント](https://developers.cloudflare.com/pages/)
- [Cloudflare Workers ドキュメント](https://developers.cloudflare.com/workers/)
- [Wrangler CLI ドキュメント](https://developers.cloudflare.com/workers/wrangler/)
- [Expo Web ドキュメント](https://docs.expo.dev/workflow/web/)

