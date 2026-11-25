# Readeco のエージェント向け案内

- 基本の開発ルールは [AGENT.md](AGENT.md) を読む。パッケージ管理は pnpm を使う。
- 利用者に影響する変更、版の更新、リリース作業では、作業前に [リリース・告知の運用](docs/RELEASE_NOTES_GUIDE.md) を読む。
- 告知の正本は `constants/release-notes.json`。例：検索結果を改善したら、利用者が何をできるようになったかを書く。内部整理だけなら告知不要。
- 公開済みの告知ID・sequence・公開日は維持する。アプリの版と告知IDを結合しない。
- 実装や運用を変更した際は、上記ガイドと `docs/YYYYMMDD-title.md` の変更記録を更新する。
