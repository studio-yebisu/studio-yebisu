# 編集動画：URLから、根拠メモへ（28秒・無音）

Agent Reach 作例の使い方を、公開URLを渡す → 接続確認 → 実際に読む → 根拠を分ける → 日本語メモを持ち帰る、の順で説明する短い動画です。素材は、制作時に実際に読んだ結果を表示した保存結果ビューアのスクリーンショット5枚と、保存済みのメモ・比較データ・実行記録です。連続した画面録画ではなく、映像内で新しい取得やAIの実行はしていません。

| 項目 | 値 |
|---|---|
| 尺・サイズ | 28.0秒、1280×720、30fps（840フレーム） |
| 音 | なし（`audioEvents: []`） |
| ポスター | 13.5秒（実取得の結果の場面） |
| 編集ソース | `index.html`（プレビュー）、`video.js`（描画）、`video.css`、`storyboard.json`（場面・字幕・素材・未確認の点） |

## プレビュー

ソースバンドルのルート（`examples/` がある階層）で次を実行し、ブラウザーで開きます。

```bash
python -m http.server 8000
# http://localhost:8000/examples/agent-reach-example/video/
```

- 「再生」で再生・一時停止、スライダーで任意の秒へ移動できます。どちらも同じ `window.seek(秒)` で描きます。
- 読み込み時に、`../outputs/movie-materials.json` にあるSHA-256と寸法で、スクリーンショット5枚とメモ・比較データ・実行記録を照合します。一致しない・読めないときはエラーを表示し、再生ボタンを無効にします。代わりの画面は出しません。
- SHA-256の照合にブラウザーの暗号機能を使うため、`file://` やlocalhost以外のHTTPでは開けません。
- 作例ページへ戻る：[../index.html#all](../index.html#all)／実際のメモ：[../outputs/research-note.md](../outputs/research-note.md)

## 書き出し（再現手順）

必要なもの：Node.js 20以上、Python 3、Google Chrome、FFmpegとffprobe。ソースバンドルのルートで実行します。

```bash
npm ci --ignore-scripts --no-audit --no-fund --prefix examples/agent-reach-example/tools/motion-reel
python examples/agent-reach-example/render.py --out renders/video-first
```

- `render.py` は作例フォルダを一時フォルダへ複製し、`video/index.html` を入口にして（`<base href="video/">` を加えて）同梱のMotion Reelレンダラーを動かします。出力先は作例フォルダの外の空フォルダにしてください。既存の出力は上書きしません。
- 出力：2秒ごとの静止画、全体シート、ポスター、8.1秒前後の連続フレーム、`video.mp4`、`capture.json`、`review.html`。静止画だけなら `--stills-only` を付けます。
- 描画は1枚のCanvas 2Dで、`seek` のたびにCanvasを初期化して時刻だけから全体を描き直します。タイマー・乱数・CSSアニメーション・前フレームの積み重ねには依存しません。`window.renderConfig` の幅・高さ・fpsを反映しますが、配置は16:9用で、ほかの比率では余白つきで縮小表示になります。
- フォントは外部から読み込まず、OSの日本語フォント（游ゴシック・游明朝、ヒラギノなど）を使います。別のOSやフォントでは文字の形と幅が変わることがあります。

同梱render.pyで28秒・720p・30fps・840フレーム・無音のMP4を実際に出力しました。代表/連続フレーム、MP4の全デコードと再生終端、同じ実行環境で16.8秒を別の順序と新しいページで再描画した一致を確認しています。現在の範囲は [../verification.json](../verification.json)。人による承認ではありません。storyboard.jsonのpendingチェック欄は元の制作設計記録です。

## この動画が示す範囲

- 実際に読んだのは、gh APIによる固定版（コミット `94f06c1`）の原典6ファイルと、twitter-cli 0.8.5による公開投稿1件だけです（2026-10-15 UTC、制作側で1回）。
- doctorの判定はGitHub・Xとも `warn`／`active_backend: null` のまま示しています。warnは「読めない」でも「読める保証」でもありません。
- YouTube・Reddit・Webの読み取り、Hermes Agent内での実行、全プラットフォームの無料利用・認証不要、取得の速さは確かめていません。実行記録の時刻は速度の測定ではありません。
- メモは制作時に作成済みのファイルです。映像内のダウンロード完了表示はなく、ブラウザー標準のファイル保存イベントも確認していません。
- 紹介投稿の本文・引用・返信・動画・画像・数値は映像に使っていません。

## 出典とライセンス

- Agent Reach 原典：[Panniantong/Agent-Reach @ 94f06c1](https://github.com/Panniantong/Agent-Reach/tree/94f06c1969dfc1834001269d79d3ad0972d9dee6)、MIT License、Copyright (c) 2025 Agent Eyes。作例には固定コミットの54ファイルを書き換えずに同梱しています（[../vendor/agent-reach/LICENSE](../vendor/agent-reach/LICENSE)）。
- この動画の構成・文字・コード、スクリーンショットに写る保存結果ビューア、メモ：MIT License、Copyright (c) 2026 Studio Yebisu（[../LICENSE](../LICENSE)）。
- MITはAgent Reachとこの作例の条件です。X・GitHubなど接続先サービスの規約、ghやtwitter-cliなど別のCLIのライセンス、第三者の投稿の権利には及びません。
