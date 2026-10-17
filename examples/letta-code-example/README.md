# 記憶の変更を、保存前に点検する — Letta Code の記憶検査の作例

記憶ファイル（Markdown と `.memfs.config.json`）を編集して stage すると、commit の前に、固定版 Letta Code の検査が文字数の上限・フォルダーごとの案内（`MEMORY.md`）・保護ファイル・設定の保護を確かめます。その検査を、架空の「さくら読書会」の記憶への8つの変更と、実際の Git の `git commit` で動かし、通ったか止まったかと原典の診断文を保存する作例です。

```text
編集する → 名前を指定して stage → 原典の検査（API・検査スクリプト・pre-commit）
  → commit が通る／止まる → HEAD と stage を確かめる → 原因だけを戻して再検査 → 1件を JSON で保存
```

- 動かすもの：`letta-ai/letta-code` 固定コミット `316e4c0545b549c453e0f85cc81d3540404eff74`（0.34.14）の、改変していない `parseMemoryConstraintsConfig`・`validateMemoryTreeConstraints`・`validateMemoryFileFrontmatter`・`detectMemoryFormat`・`isProjectedMemoryPath` と、`MEMORY_CONSTRAINTS_VALIDATOR_SCRIPT`（Git の pre-commit 用の検査スクリプト）。
- 動かさないもの：エージェントとの会話、記憶の自動抽出や想起、モデルの推論、Letta Cloud・ログイン・同期、`/init`、実際のエージェントの記憶と方針。

## ファイル

| ファイル | 内容 |
| --- | --- |
| `run.mjs` | 照合 → 8つの新しい非公開リポジトリで実行 → 確認 → 記録を行う CLI |
| `loader.mjs` | 原典の `.ts` をそのまま読むための解決フック（「`@/`」と原典内の拡張子なし相対 import を `.ts` へ）。ソースの書き換えはしない |
| `input/memory-changes.json` | 制作側が実行前に固定した、架空の記憶・初期方針・L01〜L08 の変更 |
| `input/expected.json` | 実行前に決めた期待（commit の成否と理由の一部）。実結果を得た後の照合だけに使う |
| `outputs/memory-runs.json` | 実行記録。run.mjs のすべての確認が通ったときだけ作られる |
| `outputs/method.md` | 手順・3つの層の違い・確認の中身・読み方・限界 |
| `index.html`・`style.css`・`app.js` | 保存した記録を照合してから読む、スマホ優先のページ |
| `request.txt`・`brief.json` | 依頼文と制作ブリーフ |
| `vendor/letta-code/`・`vendor-lock.json` | 改変していない原典8ファイルと、その SHA-256・バイト数・Git blob |
| `video/`・`render.py`・`tools/motion-reel/` | 解説動画の編集ソースと書き出し用の道具（動画は後の工程） |

## 初期方針は既定より厳しい

`{"version":1,"maxDepth":2,"maxFileCharacters":900,"maxCoreMemoryCharacters":1200,"readOnlyFiles":["persona.md"]}` を基準の commit に入れています。原典の既定（1ファイル20000文字、ルートの合計65536文字）より厳しい架空の方針で、小さなデータで境目を確かめるために実行前に決めました。実際のエージェントで採用された方針ではありません。L08 のように方針を上げる変更は、原典の検査スクリプトが人の承認なしでは止めます。この作例は承認を装わず、`LETTA_MEMORY_CONSTRAINTS_UPDATE` も設定しません。

## 3つの層

- 検査API `validateMemoryTreeConstraints`：stage の木を、基準の commit から読んだ初期方針で検査します。
- `validateMemoryFileFrontmatter`：記憶として投影される各 Markdown の先頭を検査します。**原典の検査スクリプトには入っていない**ため、APIとして別に呼んでいます。
- 原典の検査スクリプト：直接1回と、実際の `git commit` の pre-commit で1回。検査APIと同じ関数に加え、`.memfs.config.json` の変更を止めます。

検査がエラーを返さないことは、人の承認・内容の正しさ・事実の正確さ・採用の決定ではありません。

## 再現の手順

公開されているこのフォルダーを直接使わず、**コピーした別のフォルダー**で実行してください。

1. このフォルダーを丸ごと別の場所にコピーする。
2. コピーの中の `outputs/memory-runs.json` を、同じコピーの中で `outputs/memory-runs.recorded.json` などへ名前を変える（run.mjs は既にある記録を上書きせずに止まります）。公開済みの原本は変更しません。
3. コピーの外に、まだ無いフォルダーの名前を決めて実行する。

```text
node run.mjs --artifact-dir <コピーの外の、まだ無いフォルダー>
```

- 必要なもの：Node 24（TypeScript の型除去が標準で有効な版。制作側は 24.18.0 で準備）と Git 2.32 以上。**npm の導入は不要**で、通信・アカウント・API キー・課金も要りません。
- `--artifact-dir` は新しく作られ、その中に `repos/L01`〜`repos/L08`（それぞれ独立した `.git`）、空のホームとグローバル設定、ログ、記録の非公開の写しが入ります。既にあるフォルダー、このフォルダーの中、このフォルダーを含む場所は拒否します。
- 失敗したときは終了コードが0以外になり、公開用の記録は書かれません。artifact-dir に `failure-report.json` と短い `run-log.txt` が残ります（公開しません）。
- 記録に手元の絶対パスが現れた場合は、書き換えずに artifact-dir に残して止まります。

ページは `fetch` と Web Crypto で記録とハッシュを確かめるため、`https` か `http://localhost` で開いてください。`file://` では照合できず、理由だけを表示します。

### 動画の書き出し（別の依存）

動画の書き出しは同梱の `render.py` が `tools/motion-reel/render.mjs` を使って行います。これは作例の実行（run.mjs）とは別の道具で、Chrome・FFmpeg と、`tools/motion-reel/` で `npm install --ignore-scripts` した依存が要ります。run.mjs の実行にはこれらは要りません。

```text
python render.py --out <このフォルダーの外の、空のフォルダー>
```

## 原典スキルから使ったもの

`vendor/letta-code/src/skills/builtin/initializing-memory/SKILL.md` からは、Harness Constraints・ルートを案内にする段階的な構造・「9. Verify」の構造の確認だけを、架空の記憶に当てはめました。`foo.md` と `foo/` を並べない条件は原典の検査に無いため、run.mjs が stage のパスで同じ条件を照合します（原典のコードではありません）。`/init` の流れ（履歴の検出と分析、利用者への質問、Git からの利用者の推定、サブエージェント、別モデル、記憶の編集と統合）は実行していません。詳しくは `outputs/method.md`。

## 利用条件

- `vendor/letta-code/` の8ファイル：letta-ai/letta-code 固定コミット `316e4c0545b549c453e0f85cc81d3540404eff74` のファイルを改変せずに置いたもので、Apache License 2.0（`vendor/letta-code/LICENSE`）。
- run.mjs・loader.mjs・ページ・説明文・架空の入力・動画の編集ソース：MIT License（`LICENSE`・Copyright (c) 2026 Studio Yebisu）。
- `tools/motion-reel/`：同梱の `LICENSE` に従います。

## 作った人と動かしたもの

run.mjs・loader.mjs・ページ・この説明は Claude Opus 5.5 が書きました。架空の記憶・初期方針・期待は制作側が実行前に固定したものです。実行・照合・動画の書き出し・公開は制作側が行います。記録の値はモデルではなく、原典の関数と Git が返したものです。

## 制作側による実行と照合

Node24.18.0と実Gitで8ケースを実行し、208件の自動確認が通りました。2件でcommitを作り、6件は意図した検査で止まり、HEADとstageの変更を保持しました。別の制作側の照合で全8リポジトリのGitオブジェクト・index・入力bytes・原典hookを確認。別コピー・新しいNodeプロセス・新しい8Gitで、固定した架空のGit日時のもと、実行記録全bytesが一致しました。`outputs/independent-checks.json` と `outputs/reproduction-checks.json` に確認した範囲があります。


## 図で見る無音動画


大きな概念図と短いラベルで、入力・関係・変化・出力を見せます。動画は32秒の無音です。音声ガイド、読み上げ、ナレーションはありません。

図の状態は、固定版の原典APIとツールを実際に動かして得た保存済みの入力・出力に基づきます。デモでは図を切り替えて違いを比べ、実際の結果を保存できます。補足のcomparison.htmlから元の全8件の入力と出力を開けます。ブラウザーでAIエージェントを動かすものではありません。

今回、既存の図形・動き・映像のビデオpacketを保持して、MP4の音声トラックと編集ソースの音声ガイドを除去しました。図と映像ソースは既存のClaude Opus5.5制作を引き継ぎ、無音再生・素材照合・配布物の更新は制作側が担当しました。人による審美的承認と実機iOS/Safari/VoiceOverの確認は未確認です。
