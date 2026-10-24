# TanStack AI 作例：チャットに型付きの読み取り道具を足す

ケース `tanstack-ai-example`／カタログ `resource-tanstack-ai`

## これは何か

**TanStack AI**（[TanStack/ai](https://github.com/TanStack/ai)、MIT）は、ストリーミングチャットやツール呼び出しなどをアプリへ組み込むTypeScript SDKです。この作例では、架空の商品カタログ3件を読む**読み取り専用のサーバーツール `get_products` を1つ**だけ定義し、実モデルに2問を実行しました。

- 入力の型 `{ query: string, maxPrice?: number }`・出力の型 `{ products: Product[] }` をzodで定義しています。
- 実行は **2026-10-24** に成功済み。2問とも道具を実際に呼び、期待どおりの商品が返ることを確認しました。
- 公開ページ（`index.html`）は**実行記録の再生**です。ブラウザーからモデルやツールを呼びません。

## 実際の入出力（samples.json より）

| 質問 | 道具の入力 | 道具が返したもの | モデルの応答 |
| --- | --- | --- | --- |
| 青いマグカップを探す | `{query:"blue"}` | 青いマグカップ（1,800円）×1件 | 「青いマグカップ」が1件、価格は1,800円 |
| 予算は2,500円 | `{query:"all", maxPrice:2500}` | 青（1,800円）・赤（2,200円）のマグ×2件 | 予算内は2点と回答 |

サンプルJSONには、実際のプロンプト、モデルの応答テキスト、道具の入出力、記録されたストリーミングイベント（時刻つき）がそのまま入っています。記録された実行にはエラーはありません。

## 今回の実行環境

| 項目 | 値 |
| --- | --- |
| SDK | `@tanstack/ai` 1.0.0・`@tanstack/ai-claude-code` 1.0.0・`@tanstack/ai-sandbox` 1.0.0・`@tanstack/ai-sandbox-local-process` 1.0.0 |
| モデル | `claude-opus-5-5` |
| 接続 | 既存のClaude Codeホストのログイン。APIキーは注入していません |
| Node.js | v24.18.0 |
| 依存の整合性 | `package-lock.json` に記録 |

## 再現手順

実行には既存のClaude Codeログインが必要です。新しい課金や認証は始めません。

```text
npm ci          # package-lock.json どおりに依存を揃える
node run.mjs    # 2問を実行し out/<日時>/ に記録を書く
```

実行の記録は `out/` へ書き込まれ、公開物には含まれません。公開データに認証情報やセッションの生ログは入っていません。

## この作例の道具の縛り

- 許可する道具は自分が定義した読み取り専用の `get_products` だけで、ファイルやシェルの道具は使えません。
- local-process のサンドボックスは**セキュリティ上の隔離ではありません**。本番では、信頼できる道具だけを選び、サーバー側の権限と実行環境を別途設計してください。
- 権限の回避を指示するオプションは使っていません。

## 固定版とライセンス

| 項目 | 値 |
| --- | --- |
| ソース | [TanStack/ai @ 98055ca01af9e449d039f61e380b0d3c158acbb1](https://github.com/TanStack/ai/tree/98055ca01af9e449d039f61e380b0d3c158acbb1) |
| ライセンス | [MIT](https://github.com/TanStack/ai/blob/98055ca01af9e449d039f61e380b0d3c158acbb1/LICENSE)（[同梱のコピー](third-party/tanstack-LICENSE)）。SDKのコードはMIT。接続先のモデル・API・クラウドの条件と料金は別です |
| 注記 | core 1.0の安定化は、実験段階の `@tanstack/ai-harness` と `@tanstack/ai-harness-cli` のAPI安定性を保証しません |

## まだ確かめていないこと

- 長い会話・複数ツール・並列呼び出し、UI向けパッケージ（Reactなど）による表示。
- 実験段階の harness / harness-cli（今回の必須構成に含めていません）。
- 性能・料金・接続先サービスの条件。
- 実機のiOS SafariやVoiceOverでの表示・操作。

## ファイル

- `run.mjs` — 再現用の実行コード（2問を実行し記録を書く）
- `samples.json` — 公開用の実行記録（プロンプト・応答・道具入出力・イベント）
- `runtime-results.json` — 実行結果の要約
- `index.html` / `style.css` / `app.js` — 実行記録の再生ページ
- `video/` — 26秒・無音の説明映像の編集ソース（Motion Reelの時間契約に従う）
- `package.json` / `package-lock.json` — 固定した依存

## 説明動画と編集ソース

26秒・30fps・音声なしの[縦動画](../../media/tanstack-ai-example.mp4)と[横動画](../../media/tanstack-ai-example-wide.mp4)、[編集ソース](video/index.html)を掲載しています。動画の再利用条件は[サイトのメディア利用条件](../../media-rights.html)を参照してください。
