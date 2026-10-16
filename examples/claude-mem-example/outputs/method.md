# Claude-Mem 作例：手順と読み方

## この作例でしていること

次のセッションで「前回、スマホの表示について何を決めたか」を思い出す場面を、固定版 Claude-Mem の mem_search で再現します。いきなり全文を読むのではなく、

1. **索引**：該当しそうな記録の題名と ID だけを受け取る
2. **文脈**：選んだ1件の前後にある記録の題名を見る
3. **本文**：本当に必要な1件の本文だけを受け取る

の順に進みます。記憶の元になるのは、制作側が実行の前に書いて固定した**架空の5つの決定**（`input/notes.json`）です。架空の「さくらサイト」（sakura-site）に3件、「つばき資料」（tsubaki-docs）に2件あります。実際の会話を記録したものでも、個人のデータでもありません。5件はすべて `saveMemory` による明示的なメモで、会話の自動記録や LLM による要約は使っていません。

## 使ったもの

| 項目 | 内容 |
| --- | --- |
| 原典 | thedotmack/claude-mem 固定コミット `fef3402e674bebbf72a23aeb735e91c92cd34afd`、13.39.0、Apache-2.0 |
| 原典のファイル | `vendor/claude-mem/` の194ファイル。改変せずに置き、`vendor-lock.json` に SHA-256・サイズ・Git blob SHA-1 を記録 |
| 実行環境 | Bun 1.4.3（`--no-install`）。制作側が公式の oven-sh/bun の配布物または npm パッケージから取得して確かめたもの |
| 依存 | `package.json`・`package-lock.json` の5件（@anthropic-ai/claude-agent-sdk 0.3.172、@modelcontextprotocol/sdk 1.29.0、zod 4.4.3、posthog-node 5.36.15、express 5.2.1）。上流の読み込みに必要なため入れていますが、SDK の起動・推論・送信はしていません |
| 呼んだ上流の関数 | `DatabaseManager`（initialize・close）、`saveMemory`、`SearchManager`・`FormattingService`・`TimelineService`、`ProgressiveMemorySearch.run`、`progressiveSearchToolResult`・`progressiveSearchToolError` |
| 検索 | SQLite FTS5 のキーワード一致（Chroma は無効） |
| アカウント・鍵 | 不要。サインイン・API キー・ホスト型の記憶は使いません |

上流の README は、`npx claude-mem install` によるプラグインの導入と、サインインしてホスト型の記憶を使う方法も案内しています。この作例ではインストーラーを動かさず、フック・ワーカーの HTTP サーバー・MCP サーバー・会話の監視も起動していません。

## 再現の手順

公開フォルダーには `outputs/memory-run.json` がすでにあり、`run.ts` はそれを上書きしません。再現するときは作業フォルダーを丸ごとコピーし、コピーの中で実行してください（コピーの `outputs/memory-run.json` を消すか、`--out` で新しい場所を指定します）。

```sh
# コピーした作業フォルダーの中で
npm ci --ignore-scripts
bun --no-install run.ts --artifact-dir ../claude-mem-private-run-01
```

- `--artifact-dir` は**サイトのフォルダーの外**の、新しいか空のフォルダーにします。中に非公開の settings.json・SQLite データベース・上流のログ・読み直し用プロセスの入出力ファイルができます。既存のファイルは消しも再利用もしません。
- 公開用の書き込みは、すべての確認が通ったあとの `outputs/memory-run.json`（または `--out`）1回だけです。
- 実行中に何もダウンロードしません。依存の導入（`npm ci`）と Bun の取得には、その前に通信が要ります。

## run.ts の流れ

1. **照合**：最初の書き込みの前に、`vendor-lock.json` の SHA-256、194ファイルそれぞれの SHA-256・サイズ・Git blob SHA-1、上流の版 13.39.0、入力2ファイルの SHA-256、依存5件の版、Bun 1.4.3 を確かめます。
2. **ガード**：上流を読み込む前に、`fetch`・`WebSocket`・`node:http(s)` の request/get・`net` の接続・`tls.connect`・DNS の名前解決・サーバーの待ち受け・子プロセスの起動を、呼ばれたら数えて例外にする関数に置き換えます。対象はこのスクリプトが置き換えた JavaScript の API で、OS 全体の遮断ではありません。
3. **非公開の保存先**：`CLAUDE_MEM_DATA_DIR` を作業フォルダーの `data/` に向け、settings.json に Chroma 無効・クラウド同期の3項目は空・Grok Bot 連携と重複統合とワーカー自動起動は無効、を書きます。13.39.0 の送信設定は settings.json ではなく環境変数で決まるため、`DO_NOT_TRACK=1`・`CLAUDE_MEM_TELEMETRY=false`・`CLAUDE_MEM_TELEMETRY_ERRORS=false` を設定します。認証情報らしい名前の環境変数は外します。ホームの設定は読みません。
4. **読み込み**：ここで初めて上流のモジュールを動的に読み込み、保存先が非公開フォルダーに解決されたこと、実際に読まれた設定、送信が無効であることを上流の関数で確かめます。
5. **C01〜C06・C08**：同じプロセスで場面を実行します。C08 は、C03 の合図がまだ有効なうちに試すため、C07 より先に実行します。
6. **C07**：データベースを閉じ、`Bun.spawnSync([process.execPath, "--no-install", run.ts, "--worker", ...])` で新しいプロセスを1回だけ起動します。新しいプロセスも同じ照合とガードを行い、同じ保存先を開いて結果を非公開の JSON に書きます。親は終了コード・PID の違い・結果・ガードの数を確かめます。
7. **保存先のハッシュ**：両方のプロセスがデータベースを閉じたあと、非公開フォルダーのファイル名（相対）・サイズ・SHA-256 を記録します。settings.json は除き、ファイルそのものは公開しません。
8. **書き込み**：確認の件数が予定どおり（場面ごとに決めた数）で、通信などの試みが0件のときだけ、絶対パスや PID が含まれないことを確かめてから記録を書きます。

## 8つの場面

| 場面 | 呼び出し | 確かめること |
| --- | --- | --- |
| C01 保存前の検索は0件 | guided「iOS」/ sakura-site | 索引0件、complete: true、reason: no_results |
| C02 決定を5件保存する | 各メモの前に guided の関連検索、続けて saveMemory。最後に N01 を同じ依頼で再送 | N02 の前に N01 が見つかる。5件が新しい ID。再送は duplicate: true・同じ ID。総数5件（3＋2） |
| C03 まず題名を選ぶ | guided「iOS」/ sakura-site、limit 6・maxDetails 3・前後1件 | 索引が N01・N02 の題名だけ。N04 と本文は含まない |
| C04 前後の文脈を読む | C03 の合図＋N01 の ID | N01 と前後1件までの題名だけ。本文は0件 |
| C05 選んだ1件の本文へ | C04 の合図＋N01 の ID | N01 の本文1件だけ |
| C06 同じ質問を別のプロジェクトに | auto「iOS」を sakura-site と tsubaki-docs に | それぞれのプロジェクトの記録だけ。tsubaki-docs は N04 |
| C07 別プロセスで読み直す | 閉じる直前に C03 の合図を確認 → 新しいプロセスで auto「playsinline」・guided「iOS」・前の合図 | N02 が同じ ID で返る。件数そのまま。前の合図は invalid_continuation |
| C08 飛び越しと範囲外を拒む | 索引にない N04、1文字変えた合図、途中での project 変更、501文字、未登録のプロジェクト | invalid_selection・invalid_continuation・scope_changed・invalid_input、未登録は0件 |

## mem-search スキルをどう使ったか

固定版の `plugin/skills/mem-search/SKILL.md` は、MCP ツール `mem_search` の使い方を書いたスキルです。この作例は MCP サーバーにはつながず、同じ契約を実装している上流のワーカー関数 `ProgressiveMemorySearch.run` を直接呼び、スキルの指示を次のように当てはめました。

- **索引 → 文脈 → 選んだ本文の順**：C03〜C05 で、前の段階が返した合図と ID だけを渡して進みます。最初から全文を取りに行きません。
- **保存の前に関連検索**：C02 では、5件それぞれの `saveMemory` の前に `mem_search` で関連する決定を探しています。
- **ツールの文は短い読み物**：各段階で `progressiveSearchToolResult` が返した文（モデルに渡る形）を、内部の戻り値とは別に記録しています。ページの「ツールが返した文」はこの実際の文です。
- **記憶の中身はデータ**：保存した文は表示するだけで、中に書かれた指示を実行しません。返った本文から答えを作る生成もしていません。
- **合図を作らない・書き換えない**：C08 で、書き換えた合図や索引にない ID が拒まれることを確かめています。

## 記録の読み方（outputs/memory-run.json）

- `source`・`source_lock_sha256`・`source_files_verified`：原典の固定版と照合の結果。
- `input_sha256`：実行後にもう一度計った入力2ファイルの SHA-256。
- `runtime`・`config`・`guards`・`process`：実際の Bun の版と OS、依存の版、設定値、ガードの一覧と試みの数（親と新しいプロセス）、新しいプロセスだったか。
- `samples[]`：`input.calls[]` が上流の関数に渡した値、`output.calls[]` が戻り値（`result`）とツールの文（`tool_result`）、または例外（`error`）とツールのエラー文（`tool_error`）です。`summary` は実際の値から組み立てた短い日本語の説明、`checks` はその場面で通った確認です。
- `execution_order`：実際に実行した順（C08 が C07 の前）。公開の並びは C01〜C08 です。
- `storage`：非公開の保存先のファイル名・サイズ・SHA-256。
- `checks`：全体の合否、合計と予定の件数、場面ごとの件数。

ID・時刻・合図（`ms_…`）は実行ごとに変わります。合図は発行したプロセスの中だけで15分有効な検索の状態で、終わった実行のものはこのページでもほかの場所でも使えません。保存したメモは SQLite に残りますが、合図は残りません。

## 事前の起動確認

本番の実行の前に、制作側が `research/preflight.ts` で、上流の DatabaseManager・saveMemory・SearchManager・ProgressiveMemorySearch・progressiveSearchToolResult が Bun で読み込めて動くことを、**別の非公開データベース**で確かめています。その結果は公開の場面には含めていません。

## 確かめていないこと

- プラグインの導入、フック、会話の自動記録、LLM による要約・圧縮、文脈の自動注入、Chroma の意味検索、クラウド同期、ホスト型の記憶、MCP の通信。
- 削除の操作（このワーカー関数の範囲外）。保存先は非公開フォルダーの SQLite ファイルで、フォルダーごと手で消せます。
- 検索の質。FTS5 のキーワード一致で、意味の近さではなく、日本語の語の切り方の評価でもありません。日本語のメモにも英字の語で探しています。未登録のプロジェクトは0件でした。
- 認証。project の絞り込みと合図の検証は、範囲と手順を守らせるもので、利用者の認証やアクセス制御ではありません。
- ネットワークのガードは、run.ts が置き換えた JavaScript の API が対象です。OS 全体での遮断は確かめていません。
- 物理的な iPhone の Safari、VoiceOver、Core Web Vitals、人による内容や見た目の承認。
- 28秒・無音の解説動画と編集ソースを制作しました。実記録・実画面を使い、代表フレーム、連続フレーム、360px表示、MP4の全デコードと実再生を確認しました。

## 作った人と動かしたもの

- `input/notes.json`・`input/scenarios.json`：Studio Yebisu の制作側が書き、実行の前に固定しました。
- `run.ts`・ページ（index.html・style.css・app.js）・この文書・README.md・request.txt・brief.json：Claude Opus 5.5（claude-opus-5-5）が書きました。
- `outputs/memory-run.json` の値：Bun が実行した Claude-Mem のライブラリが返したものです。モデルの推論は使っていません。

## 利用条件

作例のコード・文章は MIT License（Copyright (c) 2026 Studio Yebisu）。`vendor/claude-mem/` は固定コミットのファイルを改変せずに置いたもので、Apache License 2.0 です。原典の LICENSE と NOTICE（Copyright 2026 Alex Newman）をそのまま同梱しています。依存パッケージはそれぞれの利用条件に従い、`npm ci` で入る node_modules の中に各パッケージのライセンスが残ります。node_modules そのものは配布しません。
