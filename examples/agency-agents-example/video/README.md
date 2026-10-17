# 役割をつなぎ、使える予定へ。— 32秒・無音の図解（編集ソース）

架空イベント「こもれび つくる日」の6企画を表す1枚の文書が、UX設計（UX Architect）で引継ぎ書と土台CSSの色を受け取り、実装（Frontend Developer）で6本の時間の帯に開き、重ならない4企画が保存済みの予定メモになるまでを、同じ図形の動きで見せる動画の編集ソースです。

- 長さ 32秒・30fps（960フレーム）。縦 720×1280 が基準で、横 1280×720 は別に配置を組みます。
- **音はありません。** ナレーション・読み上げ・効果音・音の素材・字幕の原稿はなく、`audioEvents` は空です。S04「音のさんぽを聞く」は架空の企画名で、音は出しません。
- 保存済みの成果をつないだ図解です。動画の中で新しいAIの実行、予約、エージェントのインストールや自動の協調は描いていません。

## ファイル

| ファイル | 中身 |
|---|---|
| `index.html` | プレビュー画面。`../foundation.css`（元の土台・変更なし）と `video.css`・`video.js` を読み込む |
| `video.js` | 素材の確認、縦横の配置、1フレームの描画、`window.seek`・`window.motionConfig`・`window.motionReady`、プレビューの操作 |
| `video.css` | プレビュー画面と、書き出し時（`.is-render`）の画面いっぱいのキャンバス |
| `storyboard.json` | 場面ごとの入る状態・出る状態・動き・使う素材 |
| `assets/` | 8つの素材と `manifest.json`（この作業では変更していません） |

## 使う素材（固定の SHA-256 で確かめる）

`video.js` は `assets/manifest.json` を読み、SHA-256 が `3e5aa40af6c6c8c0fcda8b6cd5ddd740cba09e34fe44944013b30d22e8a3e70e` と一致することを確かめてから、記載の8ファイルそれぞれのバイト数と SHA-256、形を確かめます。どれか1つでも違えば、キャンバスを消して理由と「ページを読み込み直す」を出し、操作を止め、`window.motionReady` を reject します。内蔵の代わりのデータはありません。

| 素材 | 動画での使いみち |
|---|---|
| `event.json` | 6企画の ID・開始・終了・費用、イベント名と日付（入力 `input/event.json` と同じバイト列） |
| `ux-handoff.json` | 2つの役割の名前（節の添え書き）、UX段階の成果物に `foundation.css` と引継ぎ書があること |
| `recorded-itinerary.json` | 予定メモに入る4企画・件数・費用の合計・`fictional`・`reserved`。元の書き出し方で同じバイト列になることを照合 |
| `diagram-data.json` | 段階名（6企画・設計・実装・回る予定）、短い呼び名、重なり、14:00 で接する組、保存済みの選択 |
| `implementation-decisions.json` | A09（入れ替え案）が不採用、A06 が修正済みであること |
| `timeline.json` | 7場面の境目と見出し、重なりの場面で残す企画と入らない企画 |
| `upstream.json` | 出典の行（リポジトリ・固定コミット・MIT・著作権表示） |
| `original-verification.json` | 元の画面でブラウザーから保存した記録であること（履歴。この32秒版の確認ではない） |

色は `../foundation.css` のライトのトークン（`--color-bg`・`--color-action`・`--color-alert` など）を `getComputedStyle` で読みます。設計の場面で文書に付く色の見本は、このトークンの実際の値です。新しいCSSの文を作って見せることはしていません。書体は端末の日本語書体（foundation.css の `--font-sans`・`--font-serif`）で、外部のフォントや画像は読み込みません。

## 時間の契約（Motion Reel）

- `window.motionConfig = { duration: 32, fps, width, height, posterTime: 31, audioEvents: [] }`
- `window.renderConfig` の `width`・`height`・`fps` を起動時に反映します。高さが幅より大きければ縦、そうでなければ横の配置です。指定がなければ横 1280×720（同梱の `render.py` が大きさを渡さないため）。プレビューでは `?format=portrait` で縦、`?format=wide` で横になります。
- `window.motionReady` は、8つの素材の確認・トークンの読み込み・`document.fonts.ready` のあとに解決します。
- `window.seek(秒)` は 0〜32 の任意の時刻の完成した1枚を、その時刻だけから描きます（乱数・壁時計・前のフレームを使わず、毎回 `ctx.save()`／`ctx.restore()` でまるごと描く）。準備前に呼ばれた場合は Promise を返します。
- `window.__MOTION_RENDER__ === true` のときは操作部を出さず、プレビュー用のタイマーを動かしません。
- 29.3秒以降は何も動きません（終わりの2.5秒以上が止まった状態）。ポスターは31秒。

## プレビュー

サイトのフォルダー（この `video/` の1つ上）で HTTP サーバーを立てて開きます。

```text
python -m http.server 8863 --bind 127.0.0.1
```

`http://127.0.0.1:8863/video/index.html` を開きます。最初は止まっています。「再生」「最初へ」「最後へ」「もう一度再生」、再生位置の帯、7つの場面ボタンで操作でき、最後まで再生すると止まります（くり返しません）。ブラウザーの開発者ツールでは次のように1枚を描けます。

```js
await window.motionReady;
window.seek(31);
```

## 制作担当の書き出しと確認

Opusの執筆時点では描画・QAは未実施でした。受領8原本を保全した後に、制作担当が縦横32秒・30fps・960フレーム、任意時刻・代表/連続/contact・スマホ表示・実保存・全デコードと実MP4の終了を確認しました。音声ストリーム0、人の承認と実機iOSは未確認です。現在の範囲は[verification.json](../verification.json)にあります。

元のrender.pyを保持し、新しいrender-visual.pyで縦横の大きさを明示します。ソース一式を展開し、ケースのフォルダーで実行します。出力は別の空のフォルダーに置きます。

```text
npm ci --ignore-scripts --no-audit --no-fund --prefix tools/motion-reel
python render-visual.py --out ../rendered-portrait --width 720 --height 1280 --strip-at 11.8
python render-visual.py --out ../rendered-wide --width 1280 --height 720 --strip-at 11.8
```

最初のnpmコマンドは依存がない場合だけ必要です。入口は使い捨ての写しとbase URLを用意し、同梱のMotion Reelを使います。音の指定は付けません。原典・元の入力/出力・8固定素材は再生成しません。改修した表示と、元の役割適用の実行記録は別です。

## 出典と条件

- 役割ファイル: [msitarzewski/agency-agents](https://github.com/msitarzewski/agency-agents/tree/bd956db032d907387e6b9ddebff3e18f1de8c679)（固定コミット `bd956db032d907387e6b9ddebff3e18f1de8c679`、MIT、Copyright (c) 2025 AgentLand Contributors）。コミュニティ作成のもので、Anthropic 公式ではありません。README の「Option 3: Use as Reference」の使い方です。
- 2つの役割は、同じ Claude Opus 5.5 を別々の実行で順に当てたものです。この動画の編集ソース（visual-r1）は、そのあとの別の Claude Opus 5.5 の実行で書いたもので、元の2段階の出力を書き換えていません。
- UX Architect の役割ファイルが参照する `ai/agents/architect.md` は固定版になく、内容を補っていません。
- 描画のしくみは Motion Reel の時間の契約（Studio Yebisu、MIT）に沿っています。この作例のコードと文章は MIT License（Copyright (c) 2026 Studio Yebisu）です。
