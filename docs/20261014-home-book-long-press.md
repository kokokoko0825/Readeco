# ホームの本の長押し修正

## 原因と変更

Webブラウザの画像保存・共有メニューが、本の長押し操作と競合していた。
ホームの本カードでWebのコンテキストメニュー、文字選択、Safariのタッチコールアウトを無効にした。表紙画像のポインターイベントを無効にし、親の本カードで操作を受け取る。

## 操作例

1巻の表紙を0.5秒長押しし、2巻をタップすると2冊をグループにまとめる。

## 確認

TypeScriptと対象ファイルのESLintを実行。TypeScriptは既存の認証・スキャナー関連などのエラーで失敗。実機Safariでの長押し動作は未確認。

## プレビューデプロイ

`pnpm run build:web` は成功。CloudflareのOAuth再認証後、本番ブランチが `main` であることを確認し、`preview-long-press` ブランチとしてアップロードした。

- プレビューURL: https://preview-long-press.readeco.pages.dev
- 今回の固定URL: https://770ee9c1.readeco.pages.dev
- コマンド: `pnpm exec wrangler pages deploy dist --project-name readeco --branch preview-long-press --commit-dirty=true`

## テキスト選択ハンドルの追加修正

本一覧に `home-book-grid` のIDを付け、Webでその子要素すべてに `-webkit-user-select: none`、`user-select: none`、`-webkit-touch-callout: none` を適用する。親カードの指定だけでは子要素の選択を防げない場合があるため、子要素にも明示する。画面を離れた際は追加したスタイルを削除する。

例: 表紙のない本のタイトルを長押しした場合も、青いテキスト選択ハンドルを抑制してグループ選択操作を受け付ける。

対象ファイルのESLintとWebビルドは成功。対象ファイルのTypeScriptエラーはなし（プロジェクト全体の既存エラーは残る）。プレビューを更新済み。今回の固定URLは https://c30eaeef.readeco.pages.dev 。実機の選択ハンドル抑制は未確認。
