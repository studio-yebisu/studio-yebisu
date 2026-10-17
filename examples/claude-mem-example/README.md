# Claude-Mem 作例：必要な記憶だけ、図で開く

架空の2案件の決定5件を、題名 → 前後の文脈 → 選んだ本文の順に取り出す作例です。保存済みの実結果を、一つの大きな概念図と32秒の無音の縦横動画で説明します。

- `index.html`・`style.css`・`app.js`：図で読む画面。題名・前後・本文・案件・開き直すを選び、該当する実行記録をJSONで保存できます。
- `comparison.html`・`comparison.css`・`comparison.js`：元の8場面の記録を読む画面を保持しています。
- `video/`：動く概念図の編集ソース、固定した7素材、代表・連続フレームの確認資料。縦720×1280と横1280×720は別の配置で描きます。詳細は`video/README.md`。
- `input/notes.json`・`input/scenarios.json`：実行前に固定した架空の5メモと8場面。
- `run.ts`・`outputs/memory-run.json`：元の実行スクリプトと、実際に返った入力・出力の記録。
- `outputs/independent-checks.json`・`outputs/method.md`：元の独立したSQLite照合、実行方法と範囲。
- `vendor/claude-mem/`・`vendor-lock.json`：固定版の原典194ファイルとハッシュ。

ブラウザーは保存した記録を表示します。操作でClaude-Mem・Bun・モデルを新たに実行するものではありません。図の本文は保存されたメモであり、生成した回答ではありません。

## 元の実行と今回の改修

元の制作では、固定版Claude-Mem13.39.0（thedotmack/claude-mem、コミット`fef3402e674bebbf72a23aeb735e91c92cd34afd`）のDatabaseManager・saveMemory・SearchManager・ProgressiveMemorySearch・progressiveSearchToolResultを改変せずBun1.4.3で動かしました。明示的な保存、SQLite FTS5のキーワード検索、guided/autoによる段階的な取り出し、新しいBunプロセスから同じ保存先を開く8場面・99の自動確認と、別のPython sqlite3による読取照合が残っています。

今回の図中心の改修では、この実行・入力・出力・原典の208ファイルを同じバイト列で引き継ぎました。推論やAPIの再実行はしていません。新しい図と映像のコードをClaude Opus5.5が執筆し、制作側が見出しの重なりの補正、検証・書き出し・文書・配布・掲載を担当しました。元の制作モデルの根拠と、今回の執筆範囲を区別しています。

新しい画面はIAB Chromiumの7幅×5場面で横はみ出しなし・主操作44px以上、全8場面の原入力・出力、実JSON保存5件、題名→前後→本文の操作、HTTP503・壊れたJSON・ハッシュ違いからの再取得を確認しました。編集ソースの7素材照合・失敗時の停止と再取得・シーク・再生/一時停止・リセット、32秒の縦横MP4の全デコードと再生終了、代表・連続フレーム・360px画像・終端を確認しています。音声トラックと音声ガイドはありません。依頼文コピーはUIの成功応答まで確認し、クリップボード内容の再取得は未確認です。

自動検査・エージェントの画面確認は、人による内容や見た目の承認とは別です。実機iOS/Safari/VoiceOver・Core Web Vitalsは未確認です。

## 再現

```sh
npm ci --ignore-scripts
bun --no-install run.ts --artifact-dir ../claude-mem-private-run-01
```

`--artifact-dir`は公開フォルダー外の新しいか空の保存先を指定します。設定・DB・完全なログは非公開のままにします。元の出力を上書きせず、コピーした作例で`--out <新しいパス>`を使ってください。この限定実行にはアカウント・APIキーは不要です。依存とBunの取得には事前の通信が必要です。

## 範囲と利用条件

プラグイン・フック・会話の自動記録・LLM要約・文脈注入・Chromaの意味検索・クラウド同期・MCP通信は試していません。公式mem-searchスキルの順序を、実ワーカー関数に直接適用した範囲です。検索語はiOS/playsinlineで、日本語の検索品質の評価ではありません。案件は検索範囲であり、認証ではありません。続きの合図は発行したプロセスの中だけで15分有効です。新しいプロセスでは保存したメモを新しい問いで探し、古い合図は使えません。

独自の作例・図・文書はMIT License（Copyright (c)2026 Studio Yebisu）。原典194ファイルはApache-2.0（vendor/claude-mem/LICENSE・NOTICE、Copyright2026 Alex Newman）を保持しています。依存パッケージは各ライセンスに従います。node_modules、Bun、DB・設定・ログ・認証・モデル履歴は配布しません。
