# Claude-Mem 作例：必要な記憶だけ、3段階で。

固定版 Claude-Mem 13.39.0（thedotmack/claude-mem `fef3402e674bebbf72a23aeb735e91c92cd34afd`、Apache-2.0）の上流ワーカー関数を Bun で実行し、架空の5つの決定を mem_search の「索引 → 文脈 → 選んだ本文」の順に取り出した作例です。

- `index.html`・`style.css`・`app.js`：保存した実行記録を読むスマホ優先のページ。ブラウザーの中で Claude-Mem・Bun・Claude は動きません。
- `run.ts`：実行スクリプト（Bun 1.4.3）。
- `input/notes.json`・`input/scenarios.json`：制作側が実行前に固定した架空の5件と8場面。
- `outputs/memory-run.json`：実行記録（制作側が run.ts を実行して作成）。
- `outputs/method.md`：手順・確認の内容・記録の読み方・確かめていないこと。
- `vendor/claude-mem/`：原典194ファイル（無改変）。`vendor-lock.json` にハッシュを記録。
- `request.txt`：同じ確認を自分の架空データで試すときの依頼文。`brief.json`：制作ブリーフ。

## 実行

```sh
npm ci --ignore-scripts
bun --no-install run.ts --artifact-dir ../claude-mem-private-run-01
```

`--artifact-dir` はこのフォルダーの外の、新しいか空のフォルダーにします。非公開の設定・SQLite・ログはそこに置かれ、公開されるのは `outputs/memory-run.json` だけです。既にある記録は上書きしないので、再現はこのフォルダーをコピーして、コピーの `outputs/memory-run.json` を消すか `--out <新しいパス>` を付けて行ってください。アカウント・サインイン・API キーは要りません。依存の導入と Bun の取得には事前に通信が要り、実行中は何もダウンロードしません。

## 範囲

試したのは、saveMemory による明示的な保存、SQLite FTS5 のキーワード検索、mem_search の guided・auto、新しいプロセスでの読み直し、誤った続け方の拒否です。プラグインの導入、フック、会話の自動記録や LLM による要約、文脈の自動注入、Chroma、クラウド同期、ホスト型の記憶、MCP サーバーへの接続は含みません。mem-search スキルの手順は、MCP ではなく上流のワーカー関数に直接当てはめています。

## 作者と利用条件

run.ts・ページ・文書は Claude Opus 5.5 が書きました。入力は Studio Yebisu の制作側が書いた架空のもので、記録の値は Claude-Mem のライブラリが返したものです。

作例のコード・文章は MIT License（`LICENSE`、Copyright (c) 2026 Studio Yebisu）。`vendor/claude-mem/` は Apache License 2.0（`vendor/claude-mem/LICENSE`・`NOTICE`：Copyright 2026 Alex Newman）。依存パッケージは各自の利用条件に従い、`npm ci` で入る node_modules 内に各ライセンスが残ります。

## 今回の確認結果

実ワーカー関数で8場面・99の自動確認を実行し、別のPython sqlite3による読取で、5件の元の本文・メタデータ・3＋2件の内訳・4つの範囲指定FTS検索・DBのハッシュを照合しました。`outputs/independent-checks.json` に要点があります。実装の親による補正は推論範囲の文言と、スマホのネイティブ選択・表示順・開閉・短い状態表示です。API結果・元の入力は書き換えていません。

320/375/390/430px縦、844px横、1280pxのIAB Chromiumで横はみ出しがなく、44px操作対象・16px入力を確認しました。全8場面の入力・出力・ツール文、実JSON保存、依頼文のコピー、HTTP503・壊れたJSON・固定版違いからの再取得を確認しました。`video/` は実記録・実画面から作った28秒の無音動画の編集ソースです。MP4・ポスターはサイトの `media/`、ZIPには編集ソース・素材を含めています。

自動確認・エージェントの視覚確認は、人による承認や検索品質の保証ではありません。実機iOS/Safari/VoiceOver・Core Web Vitalsは未確認です。`vendor-lock.json` の外部名一覧は静的な走査の候補です。実際の導入依存は `package.json` と `package-lock.json` の固定5件を参照してください。Bunの実行ファイル・node_modules・DB・設定・完全なログ・モデル履歴・認証は配布しません。
