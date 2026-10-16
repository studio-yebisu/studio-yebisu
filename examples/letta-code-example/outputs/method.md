# 手順と読み方 — 記憶の変更を、保存前に点検する

この作例は、記憶ファイルを編集してから保存（commit）するまでの間に、固定版 Letta Code の検査が何を止めるかを、架空のデータと実際の Git で確かめるものです。

```text
記憶ファイルを編集する → 名前を指定して stage する → 原典の検査（上限・案内・保護・設定の保護）
  → 実際の git commit が通る／止まる → HEAD と stage を確かめる → 原因だけを戻して再検査 → 1件を JSON で保存
```

## 使うもの

- 原典：`letta-ai/letta-code` の固定コミット `316e4c0545b549c453e0f85cc81d3540404eff74`（0.34.14、Apache-2.0）。`vendor/letta-code/` に8ファイルを改変せずに置き、`vendor-lock.json` に SHA-256・バイト数・Git blob を記録しています。
- 実行環境：Node 24（TypeScript の型除去が標準で有効な版）と Git 2.32 以上。npm でのパッケージの導入はしません。
- 入力：`input/memory-changes.json`（架空の「さくら読書会」の記憶、初期方針、8つの変更）と `input/expected.json`（実行前に決めた期待）。どちらも制作側が実行前に固定し、SHA-256 を run.mjs に書いてあります。

## 初期方針

```json
{"version":1,"maxDepth":2,"maxFileCharacters":900,"maxCoreMemoryCharacters":1200,"readOnlyFiles":["persona.md"]}
```

原典の既定（`maxFileCharacters` 20000、`maxCoreMemoryCharacters` 65536、`maxDepth` 2、保護ファイルなし）より厳しい、架空の方針です。小さな架空データで上限の境目を確かめるために、実行の前に決めました。実際のエージェントで採用された方針ではありません。run.mjs は `LETTA_MEMORY_CONSTRAINTS_UPDATE`（原典で方針の変更を許す環境変数）を設定せず、設定されていれば実行を止めます。

## 8つの変更

| ID | 変更 | 実行前の期待 |
| --- | --- | --- |
| L01 | `bookclub/schedule.md` に1文を足す | commit される |
| L02 | L01 と同じ変更に加え、`bookclub/MEMORY.md`（子フォルダーの案内）を消す | 止まる（missing required index） |
| L03 | L02 と同じ変更で、`bookclub/MEMORY.md` だけを基準と同じ内容で残す | commit される |
| L04 | `bookclub/schedule.md` をちょうど901コードポイントにする | 止まる（901 > 900） |
| L05 | `bookclub/archive/2025/notes.md` を各階層の案内つきで足す（深さ3） | 止まる（depth 3 > 2） |
| L06 | ルート直下に `orientation.md` と `daily.md` を足し、ルートの合計を1201コードポイントにする | 止まる（1201 > 1200） |
| L07 | 保護した `persona.md` の本文を変える | 止まる（read-only） |
| L08 | `.memfs.config.json` の `maxFileCharacters` を 900 から 1100 へ上げる | 止まる（設定の保護） |

右の列は実行前に書いた期待で、結果を作るためには使いません。表示する結果・理由は、実行して返った値から作ります。

## run.mjs がすること

1. `--artifact-dir` が、まだ無く、このフォルダーの外で、このフォルダーを含まないことを確かめて作ります。`outputs/memory-runs.json` が既にあれば止まります（上書きしません）。
2. 原典8ファイル・ロック・入力2ファイルを照合します。合わなければ、原典を読み込む前に止まります。
3. `loader.mjs` の解決フックを登録してから、原典の `.ts` を読み込みます。補うのは「`@/名前`」と原典内の拡張子なし相対 import を `.ts` へ解決することだけで、ソースの書き換えや関数の差し替えはしません。
4. 8件それぞれに、`<artifact-dir>/repos/<ID>` の新しいフォルダーで `git init -b main` を行います（空のテンプレートを使うので、hook フォルダーは最初は空です）。設定はそのリポジトリだけに書きます：`core.autocrlf=false`、架空の `user.name`・`user.email`、`commit.gpgsign=false`、`core.hooksPath=.git/hooks`。子プロセスの環境は許可した項目だけで組み立て、ホームとグローバル設定は artifact-dir の中の空のものを指し、日時は固定します。
5. `accepted_files` を書いて基準の commit を作ります。その後で、原典の `MEMORY_CONSTRAINTS_VALIDATOR_SCRIPT` の文字列をそのまま `.git/letta-memory-constraints.cjs` に書き、次の2行だけの `.git/hooks/pre-commit` を置きます。

   ```sh
   #!/bin/sh
   exec node .git/letta-memory-constraints.cjs --layout root-marker
   ```

6. `proposed_files` に無いファイルを消し（その件の基準のファイルだけ）、内容が変わるファイルを書き、名前を指定して `git rm --cached` と `git add` をします。
7. 3つの層を別々に動かします（次の節）。
8. すべての件の後で、期待と照合し、確認の一覧を作ります。1つでも合わなければ、公開用の記録は書かず、artifact-dir に `failure-report.json` を残して0以外で終わります。
9. すべて合格のときだけ、`outputs/memory-runs.json` と artifact-dir の `memory-runs.json` に同じ内容を1回ずつ書きます。

`.git`・hook・検査スクリプト・ログはすべて artifact-dir の中にあり、公開するフォルダーには入りません。このフォルダーや親のリポジトリで `git init`・`git add`・`git commit` は行いません。

## 3つの層

| 層 | 呼ぶもの | 方針 | 見るもの |
| --- | --- | --- | --- |
| 検査API | `validateMemoryTreeConstraints` | 基準の commit の `.memfs.config.json` を `parseMemoryConstraintsConfig` で読んだ初期方針 | stage の木（`git ls-files --stage -z` と `git show :path`）。`layout: "root-marker"`、`requireRootMarker: true`、基準の木は HEAD（`git ls-tree -r -z` と `git show HEAD:path`） |
| frontmatter | `validateMemoryFileFrontmatter` | — | `detectMemoryFormat` と `isProjectedMemoryPath` で記憶として投影される Markdown（`skills/` 以外）すべて。内容は stage、直前の内容は HEAD |
| 原典の検査スクリプト | `.git/letta-memory-constraints.cjs` を直接1回、続けて `git commit` の pre-commit で1回 | stage にある `.memfs.config.json`（原典の既定値と重ねたもの） | 上の検査APIと同じ関数に加え、`.memfs.config.json` が変わっていれば人の承認なしでは止める |

- 検査スクリプトの中の `parseMemoryConstraintsConfig` と `validateMemoryTreeConstraints` は、run.mjs が呼ぶAPIと同じ関数の原典です。run.mjs はスクリプトの文字列にその関数のソースがそのまま入っていることを確かめます。
- frontmatter の検査は、原典の検査スクリプトには入っていません。原典の説明どおり、呼ぶ側が投影されるパスを選んで呼ぶ関数です。この作例では別の層として記録します。
- L08 では、検査APIは初期方針（900）で検査するのでエラーを返しません。止めるのは原典の検査スクリプトの設定の保護です。stage にある新しい設定は原典の parse で正しく読めること（1100）も記録します。
- L02 では `bookclub/` に案内が無いため、`bookclub/schedule.md` と `bookclub/reading.md` は記憶として投影されず、frontmatter の検査の対象にもなりません。原典のスキルの「案内の無いフォルダーは記憶ではない」という決まりのとおりです。

## 確認の中身

`verification.checks` に名前と合否を並べ、`total` はその数です（手で書いた数ではありません）。主なもの：

- 原典8ファイル・ロック・入力のハッシュ（実行の前と後）、固定版、Node と型除去
- 読み込み補助が解決したのが原典 `src/` の `.ts` だけであること
- 検査スクリプトに、APIと同じ原典の関数と既定値が入っていること。承認の環境変数を子プロセスに渡していないこと
- 各件：新しいリポジトリの場所、基準の前の hook フォルダーが空、基準の commit と stage の内容が入力とバイト一致、書いたスクリプトと hook のバイト一致
- 各件：原典CLIの直接実行で HEAD と stage が変わらないこと、CLI の終了コードと commit の成否が一致、CLI と pre-commit の理由の行が一致
- 止まった件：HEAD が基準のまま、stage がそのまま残る、HEAD の内容が基準のまま
- 通った件：HEAD が進み親が基準、HEAD の木が commit 前の stage と一致、stage と作業ツリーが空
- frontmatter のエラーが投影された全ファイルで空。L01〜L07 で検査APIのエラーと CLI の理由の行が一致
- L02/L03：違いが `bookclub/MEMORY.md` だけ、L03 の stage が L02 の stage に同じ blob の案内を足したもの、投影の違い
- L04：901コードポイント（UTF-8 のバイト数とは違う）を独立に数え、検査APIの数と一致。L06：ルートの合計1201を独立に数え、検査APIの数と一致
- L05 の深さ、L07 の保護、L08 の設定の保護と初期方針でのエラーなし
- 実結果を得た後の、実行前の期待（成否・理由の一部・件数）との一致
- 記録に手元の絶対パスが含まれないこと。含まれていた場合は記録を消したり書き換えたりせず、artifact-dir に残して止まります

## 記録の読み方

`outputs/memory-runs.json` の `results[]` の1件：

- `input`：`accepted_files`（基準の commit の全ファイル）と `proposed_files`（stage した全ファイル）の全文
- `baseline`：基準の commit・木・ファイル一覧（mode と blob）
- `change`：消したファイル、書いたファイル、`git diff --cached --name-status`
- `api`：初期方針、検査APIのエラー（または例外）、stage の設定の parse、記憶の形式、投影されたパスとされないパス、frontmatter の結果
- `cli`：原典の検査スクリプトを直接実行した stdout・stderr・終了コード・SHA-256・理由の行
- `git_commit`：実際の `git commit` の stdout・stderr・終了コード・SHA-256・理由の行、HEAD と stage の前後
- `reason_ja`：実際の理由の行・HEAD・stage から作った日本語の説明。期待のファイルは使っていません
- `oracle_comparison`（記録の上位）：実行前の期待との照合。結果とは分けて置いています

stage に残った変更は、まだ記憶として保存されていません。原典のスキルの「止まった commit は未完了として扱う」という読み方を、ページの表示に使っています。

## 原典スキルから使ったもの・使っていないもの

`vendor/letta-code/src/skills/builtin/initializing-memory/SKILL.md` からは、次だけを架空の記憶に当てはめました。

- Harness Constraints：ルートの `MEMORY.md`、途中の各フォルダーの `MEMORY.md`、`MEMORY.md` に frontmatter を付けない、他のファイルは `name` と `description` だけ、`foo.md` と `foo/` を並べない。前の4つは原典の検査APIと frontmatter の検査で確かめます。最後の1つは原典の検査に無いため、run.mjs が stage のパスに同じ条件を当てはめて照合します（原典の `find` コマンドではありません）。
- 構造：ルートは毎回読む方針と案内だけにし、詳細は子フォルダーの `MEMORY.md` の先に置く。架空の記憶は制作側がこの形で実行前に固定しました。
- 9. Verify のうち構造の確認。

使っていないもの：`/init` の流れの全体（既存の記憶の調査、`letta trajectories` での履歴の検出と書き出し、Git からの利用者の推定、利用者への質問、コードの調査、Workflow とサブエージェント、別モデルでの分析、記憶の編集と統合、エージェント名での commit）。9. Verify のうち判断が要る確認（ルートの役割、重複、粒度、persona の質、意味の変化）。この作例はモデルを動かさないため、それらを行ったとは書きません。

## 限界

- エージェントとの会話、記憶の自動抽出や想起、モデルの推論、Letta Cloud・ログイン・同期・リモート、`/init` は使っていません。実際のエージェントの記憶や方針にも触れていません。
- 検査がエラーを返さないことは、人の承認・内容の正しさ・事実の正確さ・採用の決定を意味しません。
- pre-commit は Git の仕組みで、OS のサンドボックスやセキュリティの保証ではありません。Git の pre-commit は `git commit --no-verify` で飛ばせます（この作例では使っていません）。
- 子プロセスの環境を絞り、ホームとグローバル設定を空のものに向けていますが、通信や OS 全体の遮断ではありません。run.mjs 自体は通信を行いません。
- 架空の8件の小さな確認です。大きな記憶、速さ、実際の運用での使いやすさは評価しません。
- ページは保存した記録を読むだけで、記憶を編集する画面ではありません。
