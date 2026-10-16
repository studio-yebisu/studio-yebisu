# 手順と読み方 — OpenHands Agent Canvas の自動化ファイル入出力

この作例は、固定版 OpenHands Agent Canvas 1.27.1（`OpenHands/OpenHands` コミット `e4775b4ba61a83ba80af5f7b0b826201b8e8ea05`）の自動化ファイルの入出力APIを、架空の8つの設定に使った記録です。動かすのはファイルの書き出しと読み込みの関数だけで、Agent Canvas のアプリ・サーバー、エージェント、モデル、予定の登録、Webhook、リポジトリの取得、Cloud は使いません。

## 1. 何をしているか（初めての人向け）

Agent Canvas の自動化は「いつ動くか（きっかけ）」「何を頼むか（prompt）」「どのリポジトリを見るか（参照先）」などの設定です。別の環境へ持ち運ぶとき、設定は次の形の `.automation.json` になります。

```json
{
  "version": 1,
  "kind": "automation",
  "spec": { "name": "…", "trigger": { "type": "cron", "schedule": "0 9 * * 6" }, "enabled": false, "prompt": "…" }
}
```

外側の `version`・`kind` を「封筒」、`spec` を設定の本体と呼んでいます。

1. **書き出す**：`serializeAutomation(設定)` が、サービス側の設定から封筒つきのファイルを作る。`getAutomationExportFilename` が名前を付ける。
2. **読み戻す**：`parseAutomationFile(ファイル)` が、封筒と本体の形を確かめる。通れば設定（spec）を返し、通らなければ `AutomationFileValidationError` を投げ、`issues` に誤りを1行ずつ入れる。
3. **直して再確認**：誤りの行を読み、その1か所だけを直したファイルを、もう一度読み込む。
4. **保存する**：形が通ったファイルを、そのまま `.automation.json` として保存する。

## 2. 原典と依存

| 何 | どこから | 照合 |
| --- | --- | --- |
| 原典12ファイル（`src/utils/automation-export.ts`、`src/manifests/` の6ファイル、`src/types/automation.ts`、README・LICENSE・package.json・package-lock.json） | 固定コミット `e4775b4` | SHA-256・バイト数・Git blob |
| 依存29ファイル（`@openhands/extensions` 0.30.0 の `automations/index.js` から届くファイルと package.json・LICENSE） | 原典の `package-lock.json` が固定する npm の tgz（integrity `sha512-lPyH0iqS…moonA==`） | SHA-256・バイト数・tgz の中の位置 |

封筒の値（`fileVersion`・`fileKind`・`filenameSuffix`）は原典の中に書かれていません。原典は依存パッケージの `AUTOMATION_INTERFACE`（`interface.json`）を `validateInterfaceManifest` で審査し、通ったときだけ `getImportExportSpec()` で返します。run.mjs は `hasAutomationInterface()` が true であること、返った封筒が同梱の `interface.json` の `importExport` と同じであることを確かめます。偽の manifest や代わりの関数は使っていません。

## 3. run.mjs の手順

1. `--artifact-dir` が、まだ無く、このフォルダーの外の場所かを確かめる。`outputs/automation-runs.json` か `outputs/exports/` が既にあれば止まる。
2. `vendor-lock.json`・入力2ファイルの SHA-256 を、実行前に固定した値（run.mjs の中の定数）と照合する。ロックに載った41ファイルを1つずつ読み、SHA-256・バイト数・Git blob（原典）・tgz の中の位置（依存）を照合する。原典の package.json と package-lock.json が `@openhands/extensions` 0.30.0 を同じ resolved・integrity で固定していることも確かめる。
3. 入力が O01〜O08 の8件で、入力の中のURLがすべて架空の `example.invalid` であることを確かめる。
4. ここで初めて読み込み補助を登録し、原典の `.ts` を Node 24 の型除去でそのまま読み込む。解決するのは「`#/`」→ `vendor/openhands/src/*.ts`、原典の中の拡張子なし相対 import → 同じフォルダーの `.ts`、`@openhands/extensions/automations` → `vendor/extensions/automations/index.js` だけ。それ以外のパッケージは拒否する。読み込み中に原典が `console.warn` に出した文は記録に残す。
5. 8件を呼ぶ。
   - **export-roundtrip**（O01・O02・O07・O08）：`serializeAutomation(input)` → `JSON.stringify` → `JSON.parse` → `parseAutomationFile`。通ったら `serializeAutomation(parsed)` → もう一度 `parseAutomationFile`。名前は `getAutomationExportFilename({ id, name })` に入力の id と name を渡す。
   - **import**（O03〜O06）：`parseAutomationFile(input)`。通ったら `serializeAutomation(parsed)` → `JSON.stringify` → `JSON.parse` → もう一度 `parseAutomationFile` → `serializeAutomation`。ファイルには id が無いので、名前は作例の番号（O04 など）を id として渡す。設定にサーバー側の項目は足さない。
   - 止まったら `AutomationFileValidationError` の `name`・`message`・`issues` だけをそのまま残す。それ以外の例外が出たら、記録を書かずに止まる。
6. 同じ8件をもう一度呼び、結果がすべて同じことと、入力が変わっていないことを確かめる。
7. 実データから観察を作る（入力にあってファイルに無い項目、event の条件、schedule の値と空白で区切った欄の数、参照先の元と書き出し後と落ちた件、prompt の文字が同じか、O03 と O04 の入力の違い）。
8. 結果を得た後でだけ `input/expected.json` と照合する。期待は結果・誤り・観察の作成には使わない。
9. 実行の後も41ファイルとロックが同じか、記録に手元の絶対パスが無いかを確かめる。
10. すべての確認が通ったときだけ、artifact-dir に非公開の写しを書き、`outputs/exports/Oxx.automation.json`（形が通った件、原典が書き出した封筒をそのまま2字下げの JSON と末尾の改行で）、最後に `outputs/automation-runs.json` を1回書く。どれも上書きしない。

## 4. 記録の読み方

`outputs/automation-runs.json` の `results` は8件で、各件に次があります。

| 項目 | 中身 |
| --- | --- |
| `input` | 実行前に固定した入力の全文 |
| `accepted` | `parseAutomationFile` が設定を返したか |
| `file`・`file_path`・`file_sha256` | 原典が書き出した封筒と、その保存先・SHA-256（止まった読み込みでは null） |
| `filename`・`filename_source` | `getAutomationExportFilename` が付けた名前と、渡した id・name |
| `parsed` | `parseAutomationFile` が返した設定 |
| `roundtrip` | 2回目の書き出しと読み戻しの結果、`reparsed_equals_parsed`・`reserialized_equals_file` |
| `error` | 止まったときの `name`・`message`・`issues`（原典の文そのまま） |
| `observations` | 上の値から作った観察。期待のファイルからは作っていない |

期待との照合は `oracle_comparison`、確認の一覧は `verification.checks` に、実結果とは分けて置いています。確認の数は記録の `checks` から数えたもので、あらかじめ決めた数ではありません。

ファイル名は、原典の規則では名前の英数字（小文字にし、それ以外の文字の並びを `-` にしたもの）から作られます。名前が日本語だけ（「読書会・週次メモ」など）だと英数字が無いため id が使われ、「架空PRの確認」なら `pr` が使われます。実際に付いた名前は、記録の `filename` で確かめてください。

## 5. 8件で確かめること

- **O01**：毎週土曜9時の cron がファイルに残り、`id`・`created_at`・`last_run` は外れる。`enabled: false`・`model: null`・`timeout` もそのまま。
- **O02**：event の `source`・`on` の配列・`filter` がファイルと読み戻しでそのまま。Webhook は配信しない。
- **O03 → O04**：O03 は `spec.trigger.schedule: required for a scheduled trigger` で止まる。O04 は O03 に `schedule` だけを戻した入力で、別に呼んで形が通る。入力の違いは run.mjs が2つの入力から計算し、`spec.trigger.schedule` の1か所だけであることを確かめる。直す内容は実行前に固定した入力で、AI が考えたものではない。
- **O05**：封筒の version（`"2.0"`）・kind（`"other"`）、きっかけの種類（`manual`）、`enabled: "false"`（文字列）、`timeout: 0`、空の plugin の6つが、1回の読み込みで6行の `issues` として返る。
- **O06**：`schedule: "not-a-cron"` でも形が通る。**原典の読み込み検査は cron の書き方を確かめない**。空でない文字列かだけを見る。
- **O07**：参照先が2件の設定を書き出すと、ファイルには先頭の1件の `url`・`ref` だけが `repository`・`branch` として入る。2件目は落ち、古い `repository`・`branch` も上書きされる。**このファイルは2件の参照先の完全な控えではない**。
- **O08**：prompt の `<script>` タグ・`{{form.repository}}`・改行が、ファイル・読み戻し・2回目の読み戻しで同じ文字のまま。ページは `textContent` だけで表示する。

## 6. 限界

- 形が通った6件は、ファイルの形の検査を通っただけです。動く自動化が6件できたわけでも、予定を登録したわけでも、品質の点数でもありません。
- `parseAutomationFile` が通したことは、cron の正しさ、実行の時刻、タイムゾーンの正しさ、参照先の存在、prompt の内容の正しさや安全性を意味しません。
- 形が通った件はすべて `enabled: false` です。予定は登録も実行もしていません。
- Agent Canvas のアプリ・サーバー（読み込みの画面、`/v1/validate` などの API）、エージェントやモデル、スケジューラー、Webhook、リポジトリの取得、OpenHands Cloud は使っていません。サーバー側の検査がこのファイルをどう扱うかは確かめていません。
- 上流への変更の提案（PR）はしておらず、原典の開発者向けの全体テストは行っていません。
- 参照先はすべて架空の `example.invalid` で、取得していません。通信・認証は使っていません。
- run.mjsの8件/107自動確認、独立Python155照合、新Nodeで記録・6ファイルの全bytes一致、6幅48件と実保存/コピー/エラー復旧、28秒無音動画のフレーム確認・全デコード・ネイティブ再生を制作側が確認しました。実機iOS・Safari・VoiceOver、人による内容や見た目の承認は未確認です。
