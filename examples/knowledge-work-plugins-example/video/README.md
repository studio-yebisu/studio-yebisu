# 動画ソース：発言を束ねても、違いは残す。（32秒・無音）

架空ヒアリング3件の**保存済みの整理**を、1枚のつながった図で描く編集できる動画ソースです。3冊のメモから同じ15枚の発言が出て、5つのまとまりへ移り、F05の支持・反する声・数えない声を分け、F03の3本の別の道を見せ、F05を原文の行P03-L02へたどってから提案R05と保存へつなぎます。

- 32秒・30fps・960フレーム。縦 720×1280 と横 1280×720 は、それぞれ別に配置を組んで描きます（縦を拡大・切り抜きした横ではありません）。
- **無音**です。ナレーション・読み上げ・音声ガイド・音声トラック・字幕原稿・音源ファイルはありません。`window.motionConfig.audioEvents` は空の配列です。
- 動画の中でAIは動きません。新しい整理・推論・プラグインの導入・コネクターの接続はしていません。

## 素材と固定

`video.js` は `assets/manifest.json` の SHA-256（`addd74065288b887752f680f576f60f885111f03bfc96de2d35f9f3e7996d23f`）を固定し、manifest に並ぶ7つの素材のバイト数とSHA-256を照合してから描きます。1つでも合わない・読めない・形が違う場合は描かず、画面を消してエラーを出し、操作を止めます（プレビューでは「再読み込み」）。代わりの内容は持っていません。

| 素材 | 役割 |
|---|---|
| `assets/interviews.json` | メモ3冊（P01・P02・P03）と各5行の行ID。架空の自己申告。 |
| `assets/synthesis.json` | 2026-10-16 に保存した整理：観察15・発見5・提案5。支持の人数・確からしさ・反する発言・R05の優先度を描く。 |
| `assets/diagram-data.json` | 制作側が用意した保存結果への索引（短い名前、F03の3本の道、未分類O02、F05の反するO09）。synthesis.json と1件ずつ一致することを確かめてから使う。新しい整理ではない。 |
| `assets/timeline.json` | 7場面の時刻と見出し。動きの時刻はこの in/out から決める。 |
| `assets/samples.json` | 保存の例（F05・P03-L02・P02-L04）。終盤の保存名 `synthesis-F05.md` に使う。 |
| `assets/upstream.json` | 下端に出す固定版：anthropics/knowledge-work-plugins f652327・product-management 1.2.0・Apache-2.0。 |
| `assets/original-verification.json` | **旧版（28秒）の動画と作例までの確認記録**。入力・出力のハッシュが素材と同じかを確かめるためだけに読み、この32秒版の確認としては扱わない。 |

場面ごとの「伝えること・入る状態・状態・変化・出る状態・使う事実」は `storyboard.json` にあります。

## 描くことと描かないこと

- 同じ15枚の紙片は参加者の色・参加者ID・行番号を保ったまま移動するだけで、増えも消えもしません。
- F05の支持はP03-L02だけ（1/3人・低）。P02-L04は斜線と破線の「反する」列に置いて数えません。P01-L02は点線の「未分類」に置き、どちらにも数えません。これは欠けではありません。
- F03の3枚（控え→メール、当日の変更→SMS、未定→まだ選ばない）は3本の別々の道で、1つの手段の票として合わせたり、勝者を決めたりしません。
- F04（写真2人・前回名1人）は、今の良い点として色を変えたまま地図に残ります。
- R05は「月表示を作る前に、今の探し方を観察する」という**まだ行っていない**計画です。月表示を作った・改善したという意味ではありません。紙には「未実施」の判を押します。
- 引用の全文は図に載せません。全文は `assets/interviews.json` と作例ページ（`../index.html`）の折りたたみで読めます。

## 時間の契約

- `window.seek(seconds)` は絶対時刻だけから完成した1枚を描き、Promise を返します。呼び出し順・壁時計・前のフレームに依存しません。各フレームは `ctx.save()`／`ctx.restore()` で囲みます。乱れは要素IDから決めた値だけを使います。
- `window.motionConfig = { duration: 32, fps, width, height, posterTime: 31, audioEvents: [] }`。`window.renderConfig` の width・height・fps を初期化時に反映し、縦か横かで配置を作り直します。
- `window.motionReady` は7素材の照合とフォントの準備が終わってから解決します。失敗すると reject します。
- `window.__MOTION_RENDER__ === true` のときは操作パネルを隠し、キャンバスだけをそのサイズで置きます。再生用のタイマーや requestAnimationFrame は動かしません。
- 29.5秒以降は何も動きません（最後の2.5秒に入場の動きなし）。
- フォントはOSの日本語フォント（ヒラギノ／游ゴシック・游明朝／Noto など）を使い、外部のCDNは読みません。別のOSやフォントでは同じ画にならないことがあります。

## プレビュー

作例フォルダーをHTTPで配信し、`video/index.html` を開きます（`file://` では素材を読めません）。

```
python -m http.server 8863 --bind 127.0.0.1
```

`http://127.0.0.1:8863/video/index.html` を開くと、照合のあと**止まった状態**で0秒を表示します。自動再生・ループはしません。再生／一時停止、最初へ、最後へ、最初から再生、0〜32秒の位置、7つの場面ボタン、縦・横の切り替えがあります。端末の「視差効果を減らす／動きを減らす」設定がオンなら、再生は場面ごとの止まった画で進みます。`?size=wide` を付けると横で開きます。

## 書き出し（制作側の工程）

新しい `render-visual.py`（同梱の Motion Reel レンダラー `tools/motion-reel/render.mjs` を使う）で、ソースの外の空のフォルダーへ書き出します。縦 720×1280 が既定です。

```text
npm ci --ignore-scripts --no-audit --no-fund --prefix tools/motion-reel
python render-visual.py --out ../rendered-portrait --width 720 --height 1280
```

横は `python render-visual.py --out ../rendered-wide --width 1280 --height 720` で描きます。入口が使い捨てのコピーとbase URLを用意します。音の指定は付けません。

レンダラーは同じ時刻を別の順序と新しいページで描いてPNGの一致を記録します（60%の時刻＝19.2秒）。32秒（終端）も `seek(32)` で描けます。

## 執筆時点の作業の区別

- **元のスキル適用（2026-10-16・やり直していない）**：Claude Opus 5.5 が固定版 Synthesize Research を架空メモへ1回適用し、`synthesis.json` を保存しました。人によるレビューは受けていません。
- **今回の図の改修**：Claude Opus 5.5（claude-opus-5-5）が、図中心の作例画面（`../index.html`・`../style.css`・`../app.js`）と、この32秒の動画ソース（`index.html`・`video.css`・`video.js`・`storyboard.json`・この README）を新しく書きました。素材・入力・出力は変えていません。
- **Opus執筆時点では未実施だった工程**：32秒版の書き出し、決定性・コンタクトシート・連続フレームの確認、MP4の再生確認、ポスター、配布物、公開。旧版（28秒）の動画・ポスター・確認記録をこの版のものとして扱いません。人による内容・見た目の承認、実機iOS/Safari/VoiceOver も未確認です。

## ライセンス

この動画ソースは MIT License（Copyright (c) 2026 Studio Yebisu、`../LICENSE`）。描いている原典 anthropics/knowledge-work-plugins（固定コミット `f652327d4e953d7957d99e735c3c7f9964e9d2e5`、product-management 1.2.0）は Apache-2.0 です。同梱の原典は `../vendor/knowledge-work-plugins/` にあります。Anthropic による承認や推奨を示すものではありません。


## 制作担当の確認と再描画

受領8原本は非公開に保全し、制作担当の変更を../verification.jsonへ記録しました。元24ファイルと7原典を保持し、整理は再実行していません。32秒30fps960フレーム、縦720×1280・横1280×720、音声ストリーム0。任意時刻、代表・連続フレーム、スマホの図、実保存、全デコードとMP4終了を確認しました。人の承認と実機iPhoneは未確認です。

全体をHTTP配信してプレビューできます。付属のMotion Reel依存をtools/motion-reel内へ導入してから、ケースのルートで次を実行します。既存の出力は上書きしません。render.pyは元28秒時代の入口で、新しい縦横の描画にはrender-visual.pyを使います。

```text
python render-visual.py --out ../rendered-portrait --width 720 --height 1280
python render-visual.py --out ../rendered-wide --width 1280 --height 720
```
