# 自動化の設定を、持ち運ぶ前に点検する — OpenHands Agent Canvas の自動化ファイル入出力の作例

OpenHands Agent Canvas では、自動化の設定（名前・いつ動くか・prompt・参照先など）を `.automation.json` というファイルに書き出し、別の場所で読み込めます。この作例は、その書き出しと読み込みを行う**原典の関数そのもの**を、架空の8つの設定に使い、形が通ったか、止まった理由、書き出しで落ちる項目を保存したものです。

```text
設定を書く → serializeAutomation で .automation.json に書き出す → parseAutomationFile で読み戻す
  → 形が通る／誤りの一覧で止まる → 誤りの1か所だけ直して再確認 → ファイルを保存
```

- 動かすもの：`OpenHands/OpenHands` 固定コミット `e4775b4ba61a83ba80af5f7b0b826201b8e8ea05`（Agent Canvas 1.27.1）の、改変していない `serializeAutomation`・`getAutomationExportFilename`・`parseAutomationFile`・`AutomationFileValidationError`（`src/utils/automation-export.ts`）と、`hasAutomationInterface`・`getImportExportSpec`（`src/manifests/automation-interface.ts`）。ファイルの封筒（version・kind・接尾辞）は、原典の `package-lock.json` が固定する `@openhands/extensions` 0.30.0 の実物の `interface.json` を、原典の審査（`validateInterfaceManifest`）が通したものから来ます。
- 動かさないもの：Agent Canvas のアプリ・サーバー、エージェントやモデルの実行、予定の登録やスケジューラー、Webhook の配信、リポジトリの取得、OpenHands Cloud。通信・ログイン・API キーも使いません。

## ファイル

| ファイル | 内容 |
| --- | --- |
| `run.mjs` | 照合 → 原典の読み込み → 8件の書き出し・読み戻し → 確認 → 記録を行う CLI |
| `loader.mjs` | 原典の `.ts` をそのまま読むための解決フック（「`#/`」と原典内の拡張子なし相対 import を `.ts` へ、`@openhands/extensions/automations` を同梱の実物へ）。ソースの書き換えや差し替えはしない |
| `input/automation-settings.json` | 制作側が実行前に固定した、架空の O01〜O08 の設定 |
| `input/expected.json` | 実行前に決めた期待（形が通る件・止まる件・理由の一部）。実結果を得た後の照合だけに使う |
| `outputs/automation-runs.json` | 実行記録。run.mjs のすべての確認が通ったときだけ作られる |
| `outputs/exports/Oxx.automation.json` | 形が通った件の、原典が実際に書き出したファイル（6件） |
| `outputs/method.md` | 手順・8件の読み方・確認の中身・限界 |
| `index.html`・`style.css`・`app.js` | 保存した記録を照合してから読む、スマホ優先のページ |
| `request.txt`・`brief.json` | 依頼文と制作ブリーフ |
| `vendor/openhands/`・`vendor/extensions/`・`vendor-lock.json` | 改変していない原典12ファイルと依存29ファイル、その SHA-256・バイト数・Git blob・npm の中の位置 |
| `video/`・`render.py`・`tools/motion-reel/` | 解説動画の編集ソースと書き出し用の道具（28秒・無音の動画と編集ソース） |

## 8件

| ID | 試し方 | 内容 |
| --- | --- | --- |
| O01 | 書き出し→読み戻し | 毎週土曜9時（`0 9 * * 6`・Asia/Tokyo）の無効な設定。`id`・`created_at`・`last_run` はファイルに入らない |
| O02 | 書き出し→読み戻し | event の `source`・`on` の配列・`filter` がそのまま残るか |
| O03 | 読み込み | cron なのに `schedule` が無いファイル |
| O04 | 読み込み | O03 に `schedule` だけを戻した、別の呼び出し |
| O05 | 読み込み | 封筒の version・kind、きっかけの種類、`enabled: "false"`（文字列）、`timeout: 0`、空の plugin の6つの不備 |
| O06 | 読み込み | `schedule: "not-a-cron"` |
| O07 | 書き出し→読み戻し | 参照先が2件ある設定 |
| O08 | 書き出し→読み戻し | prompt に `<script>` タグ・`{{form.repository}}`・改行を含む設定 |

## 「形が通った」は「動く」ではない

- 形が通った件は、**ファイルの形の検査**を通っただけです。動く自動化ができたわけでも、予定を登録したわけでも、品質の点数でもありません。
- **O06**：`parseAutomationFile` は cron・schedule の `schedule` が空でない文字列かだけを見ます。`not-a-cron` でも通ります。cron の書き方や、実際にいつ動くかは確かめていません。
- **O07**：`serializeAutomation` が書くファイルには、参照先（`repositories`）の**先頭の1件だけ**が `repository`・`branch` として入ります。2件目は落ち、古い `repository`・`branch` も先頭の値で上書きされます。参照先が複数ある設定の完全な控えにはなりません。
- 形が通った件はすべて `enabled: false`（無効）のままです。O05 の `enabled: "false"` は文字列なので止まります。
- O08 のタグや波かっこは原典の検査でもページでも、ただの文字のままです（ページは `textContent` だけで表示）。これは安全性の検査や無害化の保証ではありません。
- 参照先の `example.invalid` はすべて架空で、取得していません。内容の正しさや安全性、人による承認も確かめていません。

## 再現の手順

公開されているこのフォルダーを直接使わず、**コピーした別のフォルダー**で実行してください。

1. このフォルダーを丸ごと別の場所にコピーする。
2. コピーの中の `outputs/automation-runs.json` と `outputs/exports/` を、同じコピーの中で `outputs/automation-runs.recorded.json`・`outputs/exports.recorded/` などへ名前を変える（run.mjs は既にある記録やフォルダーを上書きせずに止まります）。公開済みの原本は変更しません。
3. コピーの外に、まだ無いフォルダーの名前を決めて実行する。

```text
node run.mjs --artifact-dir <コピーの外の、まだ無いフォルダー>
```

- 必要なもの：Node 24 以上（TypeScript の型除去が標準で有効な版。制作側の準備は 24.18.0）。**npm の導入は不要**で、通信・アカウント・API キー・課金も要りません。子プロセスも起動しません。
- 記録には時刻・乱数・手元の絶対パスを入れないので、同じ原典・同じ入力・同じ環境の別コピー/新Nodeで、記録と6出力の全bytes一致を確認しました。別OS・別バージョンでの一致は未確認です。
- `--artifact-dir` は新しく作られ、その中に記録の非公開の写し・書き出したファイルの写し・短い `run-log.txt` が入ります。既にあるフォルダー、このフォルダーの中、このフォルダーを含む場所は拒否します。
- 失敗したときは終了コードが0以外になり、公開用の記録は書かれません。artifact-dir に `failure-report.json` が残ります（公開しません）。
- 表示されるのは各件の結果の1行と、件数・確認数・記録の SHA-256 だけです。

ページは `fetch` と Web Crypto で記録とハッシュを確かめるため、`https` か `http://localhost` で開いてください。`file://` では照合できず、理由だけを表示します。

### 動画の書き出し（別の依存）

28秒・無音の解説動画と編集ソースがあります。書き出しは同梱の `render.py` が `tools/motion-reel/render.mjs`（Motion Reel）を使って行います。これは作例の実行（run.mjs）とは別の道具で、Chrome・FFmpeg と、`tools/motion-reel/` で `npm install --ignore-scripts` した依存が要ります。run.mjs の実行にはこれらは要りません。

## 利用条件

- `vendor/openhands/` の12ファイル：OpenHands/OpenHands 固定コミット `e4775b4ba61a83ba80af5f7b0b826201b8e8ea05` のファイルを改変せずに置いたもので、MIT License（`vendor/openhands/LICENSE`・Copyright © 2025 OpenHands contributors）。
- `vendor/extensions/` の29ファイル：npm の `@openhands/extensions` 0.30.0（integrity `sha512-lPyH0iqS…moonA==`）のファイルを改変せずに置いたもので、MIT License（`vendor/extensions/LICENSE`）。
- run.mjs・loader.mjs・ページ・説明文・架空の入力・動画の編集ソース：MIT License（`LICENSE`・Copyright (c) 2026 Studio Yebisu）。
- `tools/motion-reel/`：同梱の `LICENSE` に従います。
- OpenHands Cloud・Enterprise・モデルの API・各連携サービスは別の条件で、この作例では使っていません。

## 作った人と動かしたもの

run.mjs・loader.mjs・ページ・この説明は Claude Opus 5.5 が書きました。架空の設定と期待は制作側が実行前に固定したものです。実行・照合・ブラウザーでの確認・動画の書き出し・公開は制作側が行います。記録の値はモデルではなく、原典の関数が返したものです。モデル名は作例と動画の制作についてのもので、原典・実行環境・実行するエージェントを指すものではありません。

上流への変更の提案（PR）はしていません。そのため、原典の開発者向けの全体テスト（アプリ全体の型検査・テスト・lint など）は行っておらず、完了したとは書きません。

## 確認の状況

Node24.18.0で原典APIへ8件の架空設定を渡し、107件の自動確認が通りました。ファイルの形を受け付けた6件だけを実際の.automation.jsonへ保存し、2件は原典のエラーをそのまま記録しました。別のPythonプログラムによる155件の照合で原典41ファイル・入力・実結果・実ファイルを確認。別コピー・新しいNodeプロセスで、実行記録全bytesと6ファイル全bytesが一致しました。全体アプリや実際の自動化タスクは動かしていません。

## 完成後に確認した範囲

スマートフォンを中心とする6幅×8件、44px操作部、16pxフォーム文字、原文全文、実JSONと.automation.json保存、依頼文コピー、503・JSON・固定版エラーからの復旧を確認。28秒・1280×720・30fps・840フレームの無音動画を、実出力と無編集JPEG実画面2件を含む8素材から書き出しました。代表フレーム・5つの連続フレーム列・360px表示・終端・同時刻の別順序/新ページPNG一致・全デコード・ネイティブMP4終了までの再生を確認。実機iOS/Safari/VoiceOver・人による承認は未確認です。

Opus5.5が実行用ソース・日本語解説・映像編集ソースを作成し、制作側が架空入力の固定・原典取得・実API実行・独立照合・スマホ表示の調整・書き出しと公開確認を行いました。上流実装や、動作するエージェントへモデル名を付けたものではありません。モデル実行履歴全文や認証情報は同梱しません。
