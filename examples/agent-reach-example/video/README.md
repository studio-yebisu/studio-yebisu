# 概念図フィルム：情報を読む、手順書と点検キット（32秒・無音）

Agent Reach を「AIが情報を読むための、手順書と接続点検キット」として示す編集ソースです。同じ図形（URLの札・手順書・接続点検の計器・読む人・既存CLI・接続先・材料・根拠カード・メモ）が移動・変形し、何を渡し、何がどの道具で読まれ、何が手元に残るかを描きます。スクリーンショット、画面録画、ログ、音声は使いません。

| 項目 | 値 |
|---|---|
| 尺・fps | 32.0秒、30fps（960フレーム） |
| サイズ | 縦 720×1280、横 1280×720。どちらも同じ時刻表で、配置は別々に組んでいます（帯をつけた縮小ではありません） |
| 音 | なし（`audioEvents: []`）。ナレーション・音声ガイド・字幕音声もありません |
| ポスター | 31.0秒（全体の道筋が静止した状態） |
| 編集ソース | `index.html`（プレビュー）、`video.js`（照合と描画）、`video.css`、`storyboard.json`（場面・図形・出典・未確認の点） |

## 素材

`../concept/manifest.json` の生バイトを固定SHA-256（`c75b9b1a…8c3c`）で照合し、そこに載る13件だけを読みます。各ファイルのバイト数とSHA-256、内容（3部品・引用が原典の該当行にあること・2経路・doctorのwarn/null・gh api 8回とtwitter 1回・原典6ファイル・投稿1件・根拠8枚の3/3/2・メモの期待SHA-256）が一致しないときは描画せず、エラーと「もう一度読み込む」だけを出します。代わりのデータは持っていません。フォントはOSの日本語フォントだけを使い、外部から読み込みません。

## プレビュー

ソースバンドルのルート（`examples/` がある階層）で配信して開きます。SHA-256の照合にブラウザーの暗号機能を使うため、`file://` では開けません。

```bash
python -m http.server 8000
# 縦：http://localhost:8000/examples/agent-reach-example/video/?w=720&h=1280
# 横：http://localhost:8000/examples/agent-reach-example/video/?w=1280&h=720
```

最初は0秒で停止しています。再生・一時停止、最初へ、最後へ、最初から再生、スライダー、7つの場面（0・4・10・14・18・24・29秒）への移動があり、どれも同じ `window.seek(秒)` で描きます。場面の説明は字幕欄に出ます。

## 書き出し（再現手順）

必要なもの：Node.js 20以上、Python 3、Google Chrome、FFmpegとffprobe。ソースバンドルのルートで実行します。

```bash
npm ci --ignore-scripts --no-audit --no-fund --prefix examples/agent-reach-example/tools/motion-reel
python examples/agent-reach-example/render-visual.py --out renders/portrait --width 720 --height 1280
python examples/agent-reach-example/render-visual.py --out renders/wide --width 1280 --height 720
```

- `render-visual.py` は制作側がこの後に追加するラッパーです（この編集ソースの作成時点では存在しません）。既存の `render.py` と同じく作例を一時フォルダへ複製し、`video/index.html` を入口（`<base href="video/">`）にして同梱の `tools/motion-reel/render.mjs` へ `--width`・`--height`・`--fps 30`・`--video` を渡す想定です。音声の指定はしません。
- 出力先は作例フォルダの外の空フォルダにしてください。既存の出力は上書きしません。
- 描画は `window.renderConfig` の幅・高さ・fpsを反映します。縦長なら縦の配置、横長なら横の配置を選びます。書き出し時（`window.__MOTION_RENDER__`）はタイマーを動かさず、Canvasだけを画面いっぱいに置きます。

## 確認の状態

この編集ソースは作成しただけで、実際の描画・書き出し・目視の確認はまだ行っていません。未実施の項目は `storyboard.json` の `pendingChecks` にあります。保証や合格の記録ではありません。

## この映像が示す範囲

- 取得は2026-10-15（UTC）に制作担当が実行した記録です（doctor、gh api 8回、twitter tweet 1回）。保存結果の整理と根拠メモはAIが別工程で作りました。映像はAIがCLIを実行したとは示しません。
- doctorの判定はGitHub・Xともwarn／active_backend: nullのままです。warnは「読めない」でも「読める保証」でもありません。
- YouTube・Reddit・Web、Hermes内での実行、初回インストール・自動更新、料金・認証不要・速度は確かめていません。
- 投稿の本文・返信・数値・画像は映像に使っていません。

## 出典とライセンス

- Agent Reach 原典：[Panniantong/Agent-Reach @ 94f06c1](https://github.com/Panniantong/Agent-Reach/tree/94f06c1969dfc1834001269d79d3ad0972d9dee6)、MIT License、Copyright (c) 2025 Agent Eyes（[../vendor/agent-reach/LICENSE](../vendor/agent-reach/LICENSE)）。
- この映像の構成・図形・コード：MIT License、Copyright (c) 2026 Studio Yebisu（[../LICENSE](../LICENSE)）。
- MITはAgent Reachとこの作例の条件です。X・GitHubなど接続先の規約、ghやtwitter-cliのライセンス、第三者の投稿の権利には及びません。
