# Agent Reach 作例：公開URL2件を根拠メモに仕分ける

Agent Reach（接続を確認し、既存のCLIへ読み取りを振り分けるスキル）の手順で、第三者の紹介投稿1件と固定コミットの原典を実際に読み、結果を「原典で確認」「今回実際に読んだ」「未確認」に分けた作例です。ページは制作時に保存した結果を表示するだけで、新しい取得やAIの実行はしません。

## 使い方

1. **開く**：ソースバンドルのルート（`examples/` と `media/` がある階層）でHTTPサーバーを起動し、ページを開きます。

   ```bash
   python -m http.server 8000
   # http://localhost:8000/examples/agent-reach-example/
   ```

   `file://` で開くとブラウザーが保存データの読み込みを止め、エラーを表示します。
2. **絞り込む**：「すべて／原典で確認／今回実際に読んだ／未確認」のボタンで根拠カードを絞り込みます。URLの `#all`・`#source`・`#runtime`・`#unknown` でも同じ状態を開けます。
3. **原典を開く**：各カードの「根拠を開く」から、固定コミットのGitHub上の該当行、紹介投稿、保存した実行記録（`outputs/collection.json`）を開けます。
4. **メモを保存**：ページ上部の「調査メモ（Markdown）をダウンロード」で `outputs/research-note.md` を保存します。制作時に作成済みのファイルです。
5. **依頼文を再利用**：「依頼文を再利用する」の文面（`request.txt`）の3つの欄を埋め、別のリポジトリと投稿で同じ調べ方を依頼できます。

## ファイル

| ファイル | 内容 |
|---|---|
| `index.html`・`style.css`・`app.mjs` | 保存データのビューア（外部依存なし、相対パスのJSONとテキストだけを読む） |
| `outputs/comparison.json` | 根拠カード8枚（原典3・実取得3・未確認2） |
| `outputs/research-note.md` | 持ち帰り用の日本語調査メモ |
| `outputs/collection.json` | 制作時の実行記録（公開用に整理済み。認証値・生の出力は含まない） |
| `request.txt` | 再利用できる依頼文 |
| `samples.json` | 実際に得た結果3件の入力と出力 |
| `vendor/agent-reach/` | 固定コミットの原典54ファイル（無変更） |

## 制作時に実行したこと

固定コミット `94f06c1969dfc1834001269d79d3ad0972d9dee6` を対象に、既存の Python 3.13.7、gh 2.96.0、twitter-cli 0.8.5 で次の順に実行しました（2026-10-15 UTC）。

1. 原典の `agent-reach doctor --json`：GitHub・Xとも `warn`／`active_backend: null`。この判定は後の成功で書き換えていません。
2. `gh api` で原典6ファイルとリポジトリ・コミット情報を取得：すべて終了コード0、6ファイルの本文はGit上の同じファイルとSHA-256一致。
3. `twitter tweet 2110111219172712922 -n 1 --json`：終了コード0、`ok: true`、ID一致、本文あり。ClientTransaction初期化の警告を受け取りました（いつでも無害とは判断していません）。

## 再現

実際に実行した読み取りを再現する補助コマンドを同梱しています。

```bash
python examples/agent-reach-example/collect.py --private-out PATH
```

- バンドルのルートから実行します。この補助コマンドの既定経路を、この環境で実行済みです。原典6ファイルの一致・公開投稿のIDと非空本文・doctorのwarnを再確認しました。
- 前提：固定版Agent Reachの依存が入ったPython環境、gh、twitter-cli 0.8.5と、それぞれの既存の認証設定。Python環境とバックエンドは同梱していません。すでに使っている環境を更新する必要はありません。
- 固定版の原典と、実際に動く読み取り専用のバックエンドを使います。認証がない・期限切れのときは、そのプラットフォームで止まる想定です。
- `PATH` は公開フォルダの外にしてください。生の投稿・Cookie・認証値はコミットしないでください。

## 原典の扱いと調整

- `vendor/agent-reach/` は固定コミットの54ファイルをそのまま保持し、書き換えていません。複数のskillをまとめた集約skillは同梱していません。
- X の読み取りでは、原典の `twitter_cli_child_env` で既存の設定から子プロセス用の環境を組み、本物のtwitter-cliのコマンド入口を起動しました。呼び出し側の小さな安全用アダプターが、twitter-cliのブラウザーCookie自動読み取りだけを無効にしています。認証の検証処理と返ってきた出力は変えていません。設定は読み取り専用で参照し、新しいログイン・アカウント・サービス設定はしていません。
- 原典skillの「調査や任意のURLで必ず使う」という広い起動条件と、作業後に `agent-reach check-update` で更新を確認する規則は採用していません。今回は利用者が明示した目的に合わせ、GitHubとXの読み取りだけに絞り、自動更新や新しいサービスの追加はしていません。

## 試していないこと

- YouTube・Reddit・Webの実際の読み取り
- Hermes Agentの中での実行
- 全プラットフォームの無料利用・認証不要、取得の速さ、常に使えること
- 初回インストール、自動設定、複数プラットフォーム横断の検索、ほかのバックエンド
- 投稿の返信・引用投稿・動画・リンク先の記事

## ライセンス

- この作例の文章・データ・コード：MIT License、Copyright (c) 2026 Studio Yebisu（`LICENSE`）
- Agent Reach原典：MIT License、Copyright (c) 2025 Agent Eyes（`vendor/agent-reach/LICENSE`）
- MITはAgent Reachの条件で、X・GitHubなどのサービス規約、ほかのCLIのライセンス、第三者の投稿には及びません。紹介投稿の本文・引用・返信・動画・画像・数値は同梱していません。

## 動画と現在の確認記録

28秒・1280×720・30fps・840フレーム・無音。実データの画面と日本語メモを使う編集動画です。連続操作の録画ではありません。代表/連続フレーム、同時刻の描画一致、全デコード、実MP4の再生と終端を制作担当が確認しました。人による承認ではありません。現在の範囲は verification.json。storyboard.jsonの制作時チェック欄は元の設計記録です。

一式のルートで次を実行します。Node.js20以上・Python・Chrome・FFmpeg/ffprobeが必要です。Motion ReelのMIT実行ソースを同梱し、依存はlockfileに固定しています。依存本体・認証・生の投稿は含みません。

```text
npm ci --ignore-scripts --no-audit --no-fund --prefix examples/agent-reach-example/tools/motion-reel
python examples/agent-reach-example/render.py --out renders/video-first
```

再現用 collect.py の既定経路を、既存の明示認証・同じ環境で実行済みです。原典6ファイルの一致・対象投稿IDと非空本文・doctorのwarnを確認しました。再取得先の状態は変わるため、将来の成功や速度は保証しません。
