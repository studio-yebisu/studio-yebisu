# 出典と取り込み範囲

統合サイトは既存3プロジェクトを専門制作の正本として保持します。元のファイルを移動せず、公開用のカタログ情報だけを正規化します。

| 分野 | 取り込むもの | 元の制作環境 |
|---|---|---|
| UI・UX | スキル12件と補助ライブラリ1件、ガイド、原典、依頼文、操作できる制作デスク | awesome-claude-ui-ux-design-ja |
| AIスライド | 現行の厳選61件、作例表紙、依頼文、原典と利用条件 | awesome-codex-ppt-skills-ja |
| モーション | 公開版の34件、作例動画・画像への案内、原典と利用条件 | awesome-claude-motion-design-ja |

元のガイドの確認記録を引き継いでおり、110件すべての原典や実行環境を新たに再検査したものではありません。AIスライドの全制作環境・原典コード・巨大な一式ZIPは統合サイトへ複製しません。統合版の作例表紙と依頼文は、実際の制作記録から取得します。操作できる初回作例と解説動画は、この統合サイト内に収録します。

UI・UXの従来のPages URLは2026-10-15の確認で404だったため、コミット済みの静的ガイドを `integrations/ui-ux/` に保持し、公開時は `guides/ui-ux/` に配置します。原ガイドのLICENSE・ATTRIBUTIONを保持し、統合サイトへ戻るナビゲーションを追加します。元リポジトリの作業ファイルは変更しません。

固定したコミットとデータのハッシュは `data/import-manifest.json`。未コミット作業を勝手に公開しないため、モーションは取得済みの `origin/main`、UI・スライドはコミット済み `HEAD` を取り込みます。

初回制作で参照する原典：

- [Anthropic Frontend Design](https://github.com/anthropics/skills/blob/dbd4588f9e1033efb41dad4bef2f7947c8993d44/skills/frontend-design/SKILL.md)。画面の構成・書体・操作に指針を適用。Apache-2.0。原典本文は公開物へコピーせず、参照先を残します。
- [Motion Reel](https://github.com/studio-yebisu/motion-reel)。任意時刻の描画、フレームレビュー、動画書き出し。MIT。実行環境は既存のローカルスキルを使用します。
- `brief-to-demo` と `studio-yebisu` は今回作成するStudio Yebisuの独自スキル。MIT。

公開する制作記録にはモデル名、入力のハッシュ、成果物のハッシュ、実施した確認の要約を残します。Claude Codeの認証情報、会話・実行ログ全文、個人のアカウント情報は `.local/` に保持し、公開物へ含めません。
