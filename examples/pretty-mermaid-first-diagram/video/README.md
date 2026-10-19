# Pretty Mermaid の仕組み — 32秒・無音の解説映像（編集ソース）

1枚の大きな構造図が動き、Pretty Mermaid が何でできていて、何を入れ、何が出て、次にどう使うかを示します。文字だけの場面やナレーションはありません。

- 指示書（SKILL.md と参照資料3件）と架空の依頼が、同じ作者AIへ入る
- 作者AIが `.mmd` を保存する（CLIは実行しない）。制作担当が別の役として受け取る
- 制作担当が同じ `.mmd` と設定をローカルの Node CLI（`scripts/render.mjs`）へ渡す
- SVG（beautiful-mermaid）／同じSVGを Resvg で画像化した PNG／別経路の文字図
- 別工程で読んで原文と照合し、`.mmd`・SVG・PNG・文字図を使い分ける

## ファイル

| ファイル | 役割 |
| --- | --- |
| `index.html` | 映像のページ。確認用の操作は `.preview-only` で、書き出しでは隠す |
| `video.js` | `window.seek`・`window.motionConfig`・`window.motionReady`、場面の正本 `SCENES` と `REVEAL`、確認用の再生 |
| `video.css` | 確認用の見た目と、書き出し時に図だけをビューポートいっぱいに描く指定 |
| `storyboard.json` | 7場面の説明（伝わること・入る状態・出る状態・動き）。描画には読み込まない写し |
| `../concept.js` | 共有ローダーと描画。図解ページと同じ構造図・移動表（`TRIPS`・`ARRIVALS`・`GLOWS`）を使う |

## 時間の契約

- `window.motionConfig = { duration: 32, fps: 30, width: 720, height: 1280, posterTime: 31, audioEvents: [] }`
- `window.renderConfig` の `width`・`height`・`fps` があれば読み込み時に反映し、`motionConfig` も同じ値にする。縦（720×1280）と横（1280×720）は配置を作り直す
- `window.seek(seconds)` は秒だけから完成した1枚を描き直す。前のフレーム、呼び出し順、壁時計、fpsには依存しない。乱数・タイマー・CSSアニメーションは使わない。検証が終わる前や失敗後は Promise を reject する
- `window.motionReady` は、フォントの準備と、共有ローダーによる28ファイルのSHA-256照合・3つのPNG（幅1200）とSVGの読み込みを待つ。失敗したら reject し、図を消して操作を止める
- `window.__MOTION_RENDER__` が真、または `?render` のときは確認用の再生（requestAnimationFrame）を動かさない

場面の時刻：0 指示書と依頼／4 作者AIが.mmdを書く／8 制作担当がCLIへ／14 3つの経路／20 読んで照合／26 使い分け／29–32 全体の地図。

## 確認用に開く

このフォルダの1つ上（作例のフォルダ）をローカルのWebサーバーで配信し、`video/index.html` を開きます。WebCrypto と fetch を使うため、`file://` では開けません。外部のフォント・CDN・音声・モデルは読み込みません。

書き出しは親の工程が担当します。公開ソースの `render-visual.py` は、作例のフォルダを使い捨ての場所へ写し、`video/index.html` を `<base href="video/">` 付きの入口にして同梱の Motion Reel レンダラーへ渡します。

## 確認の状態

- 書き出し、コンタクトシート、任意時刻の決定性確認、連続フレーム、MP4の再生確認：**制作担当が別工程で確認。範囲は ../visual-verification.json**
- 人による見た目の承認：なし
- この編集ソースは保存済みの原出力を読むだけで、モデル呼び出し・原典CLIの実行・図の生成はしない

画面と映像のソースは Studio Yebisu の独自制作（MIT License）。図の出力は imxv/Pretty-mermaid-skills（固定版 e234ab73c2992f03c36db04fd55ebb90abca9c45、MIT License）の原典CLIが元の制作で書き出したファイルです。
