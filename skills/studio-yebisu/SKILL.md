---
name: studio-yebisu
description: Studio Yebisu向けに紹介したいAIスキルやURLを調べ、分野の制作スキルを使った作例・日本語解説・短い動画を作り、統合サイトへ掲載する。「これどう」「作例を作って載せて」などの紹介制作に使う。
---

# Studio Yebisu 統括

ユーザーのネタを、使い方と実作例が揃う紹介へ仕上げる。統合サイトのルートはこのスキルの実体から `../..`。グローバルに接続されている場合は `python <skill-dir>/scripts/location.py` で実体のルートを取得する。分野の対応は `data/projects.json`、掲載の正本は `data/cases/<id>.json`。

## 分野と正本

- UI/UXは `workspace/ui-ux/` のカタログと実装、選んだデザインスキル。
- AIスライドは `workspace/slides/AGENTS.md` と制作方針、選んだ `skill-forks/`。原典の生成器・テンプレートを使う。
- モーションは `workspace/motion/` の制作資料。短いコード動画にはMotion Reel、既存Remotion案件にはその制作スキルを選ぶ。
- エージェント・便利スキルは実際の入力と出力を対にする。依頼を整理する場合は `../brief-to-demo/SKILL.md`。

`workspace/` がなければ `python scripts/workspace.py`。専門リポジトリのdirty・ignored原本を保つ。別モデルや子エージェントは依頼で指定された役割に応じて使い、担当ファイルを分ける。

## 一件を掲載まで通す

原典のREADME・SKILL・コードと利用条件を確認し、URLと固定版を記録する。Xは発見元として扱う。紹介できる能力と、この作例で試した範囲を分ける。

`python scripts/pipeline.py new <id> --source <url> --category <category>` で入力と制作ブリーフの場所を作る。`brief-to-demo`で目的と実入力を具体化し、選んだスキルを読んでから制作する。

制作の既定は `claude-opus-5-5`。`python scripts/produce.py --prompt <file>` は既存Claude Code認証で実行し、モデルの実行記録を `.local/` に保存する。認証情報や実行履歴全文を公開しない。別モデルへの自動切替はしない。モデルが利用できない場合はその事実を伝え、完了した別工程を保存する。

各記事に用途、実入力、試したこと、成果物、再現コマンド、出典・条件を持たせる。動画は操作の流れと実結果を見せ、再生可能なMP4と編集ソースを残す。Motion Reelでは任意時刻の描画とフレームレビューを確認する。

新しい紹介先をカタログにも追加するときは、記事JSONの `catalog_entry` に既存 `data/catalog.json` と同じ形の項目を入れる。サイト生成時に統合され、共有カタログの無関係な編集中データを公開へ巻き込まない。

`data/cases/<id>.json`に記録し、`python scripts/pipeline.py publish <id>` で検査とサイト生成を通す。ここまでのpublishはローカル反映。`--deploy`は依頼で承認済みの公開先だけに使う。公開後は実際のURLと動画・作例が開くことを確認する。

自動公開のstage対象はその一件の記事・作例・動画・固有スキル・制作記録だけ。共通画面や他の記事の変更を含める場合は、その依頼の対象を限定して別に扱う。既存のstageや未公開commitがあれば、所有者の作業を巻き込むpushを行わない。

既存の公開・掲載依頼で承認された範囲は工程ごとに再確認しない。未実行の検査、未視聴、未公開を完了扱いにしない。

