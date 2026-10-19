# Quartz 図解動画（無音32秒）の編集ソース

Quartz を「AIが読む指示書、役割トークンのCSS、React部品、lint規則のまとまり」として見せる、一枚のつながった図の動画です。指示書と依頼から同じ作者AIがコードとfixtureを書き、制作担当が別工程で確かめ、`body.quartz` ＋ `QuartzPortalProvider` の範囲で役割トークンが8部品へ届き、Timelineで選んだidが App へ戻って同じ段の入力と出力が開き、JSONがブラウザーへ渡るまでを、同じ形が動いてつながる図で示します。

ナレーション、読み上げ、効果音、音声トラックはありません（`audioEvents: []`）。

## ファイル

| ファイル | 役割 |
| --- | --- |
| `index.html` | 確認用の画面。`video.js` を読み込みます。 |
| `video.js` | 時間割（`stateAt`）と1枚の描画。`window.seek`、`window.motionConfig`、`window.motionReady` を持ちます。 |
| `video.css` | 確認用の操作部品。書き出し時は隠れます。 |
| `storyboard.json` | 7場面の時刻、伝えること、入る状態と出る状態。 |
| `../concept.js` | 図解ページと共通の、読み込み検証と図の描画。動画からは関数だけを読み込み、ページの初期化は動きません。 |

## 時間の契約

- `window.motionConfig = {duration: 32, fps: 30, width: 720, height: 1280, posterTime: 31, audioEvents: []}`。`window.renderConfig` に `width`・`height`・`fps` があれば、その値を `motionConfig` に写して使います。
- `window.seek(秒)` は時刻だけから1枚を描き直し、Promiseを返します。前のフレーム、呼び出し順、壁時計、FPS、乱数、タイマー、CSSアニメーションに頼りません。7.2秒のような任意の時刻も描けます。
- `window.motionReady` は、フォントの準備、素材30件の大きさとSHA-256、図に使う事実の照合、撮影PNG 2枚の復号が済むと解決します。どれかが失敗すると拒否し、キャンバスを消して操作を止めます。確認前の `seek` は拒否します。`#retry` で30件すべてを読み直します。
- 縦 720×1280 と横 1280×720 は、それぞれの配置を描き直します（縦を縮めた横ではありません）。確認画面では `button[data-orient]` だけが向きを切り替えます。
- `window.__MOTION_RENDER__` が真なら操作部品を隠し、確認用の再生（requestAnimationFrame）を動かしません。

## 場面

| 秒 | 場面 |
| --- | --- |
| 0 | 指示書の8手順と規則、依頼文 |
| 4 | 同じ作者AIがコードとfixtureを書き、制作担当が別工程で配置とlint・build・390/1280を確かめる |
| 8 | body.quartz の範囲、役割トークン、8部品、App.theme の明示切替 |
| 14 | fixture → App.sampleId → toSpans(run) → Timeline、押したid → onSpanClick → App.openSteps |
| 20 | 選んだ段の状態・入力・出力（完了、ツール失敗、入力待ち。すべて静的サンプル） |
| 26 | 事例全体のJSONをブラウザーへ渡す、desk.html の実物、小さな撮影の差し込み |
| 29 | 全体の図を止めて表示（31秒がポスター） |

## 書き出し（親工程）

Motion Reel のレンダラーで、空の出力先を毎回用意して書き出します。`video.js` は `../concept.js` と `site/` 直下の素材30件を読むため、レンダラーが `video/` の一つ上（`site/`）まで配信できる設定で使います。

```text
node <motion-reel>/scripts/render.mjs --project <site>/video --out <空のフォルダ>/review --strip-at 7.2
node <motion-reel>/scripts/render.mjs --project <site>/video --out <空のフォルダ>/portrait --width 720 --height 1280 --video
node <motion-reel>/scripts/render.mjs --project <site>/video --out <空のフォルダ>/wide --width 1280 --height 720 --video
```

`--synth` や `--audio` は付けません。公開ページは縦を `../../media/quartz-agent-console.mp4`、横を `../../media/quartz-agent-console-wide.mp4` として読みます。

## 元のReact画面を作り直すとき

`desk.html` は元のReact画面（Quartzの8部品が実際に動く画面）の保存版です。`npm run build` は `vite build` のあとに `tools/publish.mjs` を実行し、`index.html` と `assets/` を書き出します。この `site/` でそのまま実行すると、新しい図解ページの `index.html` を上書きします。作り直しが必要な場合は、`site/` を使い捨ての別フォルダへ複製してそこでビルドし、結果を確かめてから必要なものだけを戻してください。元のビルド手順（`tools/` や `package.json`）は変更していません。

## 確認の状況

- この図解ページと32秒動画の自動検査、フレームの確認、MP4の書き出し、再生の確認は、親工程で行います。このソースを書いた時点では未実施です。人による承認もまだありません。
- 元の画面の Quartz lint、Vite build、390/1280px のブラウザー確認は、元のReact画面だけの記録です。新しい図や動画の確認には当てはめません。
- レンダラーが記録する同一時刻のPNG一致は、同じ実行環境での再現性を示すだけです。

## 出典と利用条件

- Quartz：arla6ka/skills の `systems/quartz`、固定版 `1aaaa1b47ba5a18b47b0ebcac684ade460c6823f`、MIT License、Copyright (c) 2026 Arlan Marat。
- 図、動画の構成、文言、このソースは Studio Yebisu の制作（claude-opus-5-5 で作成）です。図はQuartzの部品をそのまま再利用したものではありません。実際の部品は `desk.html` で動きます。
- 表示する3件の実行ログは事前に書いた静的サンプルで、秒は架空の時刻です。AI、ツール、通信、原典の取得は動きません。


制作担当による出荷時の描画・操作・再生の確認範囲は ../visual-verification.json、現在の再現入口は ../render-visual.py と ../visual-guide.md です。上の未実施という記述はOpus執筆時点を示します。
