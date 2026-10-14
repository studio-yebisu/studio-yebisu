# Studio Yebisu

AIスキルを用途・実作例・使い方から選べる日本語の統合サイト。UI/UX、AIスライド、モーション、エージェント・便利スキルを扱う。

依頼された紹介制作には `skills/studio-yebisu/SKILL.md` を使う。記事データと出典を正本にし、共通サイトを生成する。制作モデルの既定はユーザー指定の `claude-opus-5-5`。モデルを使っていない実行をOpus制作と記載しない。

既存3リポジトリは専門制作の正本。`data/projects.json` に対応と公開先を記す。ローカルでは `python scripts/workspace.py` で `workspace/` に接続する。元のGit履歴・dirty・ignored原本を保持し、コピーや上書きによる統合をしない。

統合カタログは `python scripts/sync_catalog.py`、サイト生成は `python scripts/build.py`、掲載検査は `python scripts/check.py`。外部出典の確認と実制作済みを区別する。公開物に認証情報、ローカル履歴、モデル実行ログを含めない。

この統合サイトと最初の一件のサイト反映はユーザー依頼済み。新しい紹介についても依頼で承認された掲載範囲を引き継ぐ。関係のないサービス・アカウント・課金へ拡張しない。

