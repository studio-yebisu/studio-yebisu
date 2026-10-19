# 無音の説明映像（編集ソース）

ACE-Step V1 作例の32秒の説明映像です。作例ページと同じ `../concept.js` の `loadData`・`sceneAt`・`drawConcept` で、同じ構造図を時刻ごとに描きます。

- 32秒・30fps・ポスター31秒。縦720×1280が主で、横1280×720は配置を作り直して描きます（拡大縮小した流用ではありません）。
- **無音です。** `audioEvents` は空で、`<audio>`・音楽トラック・効果音・ナレーション・音声ガイドはありません。機能としての音楽WAVは作例のページ（`../index.html`）でだけ再生します。
- 図の動きは説明用の演出で、推論にかかった時間ではありません。格子とメルの模様は説明図です。下の帯の波形と、最後に動く波形の形だけが、保存WAVの実際の包絡（`../concept/waveforms.json`、320区間のmin/max）から描かれます。

## 開き方

`site/`（このフォルダの1つ上）をルートにしてローカルサーバーで開きます。`file://` では読み込みとSHA-256の確認ができません（ES module と `crypto.subtle` のため）。

```text
cd <site>
python -m http.server 8000 --bind 127.0.0.1
# http://127.0.0.1:8000/video/index.html
```

開くと、`../concept/manifest.json` を `cache: no-store` で読み、SHA-256 が固定値 `7858cef475daefb30ae1a4d0465fdbd7523705f842767c0dec7cecadfade8662` と一致するかを確かめ、一覧の25ファイルすべての大きさとSHA-256、facts（`ace-step-actual-facts@1`）、原典の引用6か所の行、ジョブ1件、WAVの形式と長さ、`storyboard.json` と場面の一致を確かめます。1つでも合わなければ映像を描かず、理由と「もう一度確かめる」を出します。

## 操作

- 縦／横：向きだけを変えます。時刻や再生状態は変えません。
- 再生・一時停止・最初から再生・先頭・末尾、0〜32秒（0.1秒刻み）のスライダー、7つの場面への移動。
- 「確かめた素材」に25ファイルの大きさとSHA-256、「ソースと出典」に編集ソースと原典へのリンクがあります。

## 書き出しの契約（Motion Reel）

| 項目 | 内容 |
| --- | --- |
| `window.motionConfig` | `{duration: 32, fps: 30, width: 720, height: 1280, posterTime: 31, audioEvents: []}`。`window.renderConfig` の `width`・`height`・`fps` があれば、最初のスクリプトで反映します |
| `window.motionReady` | 25ファイル・facts・引用・WAV・絵コンテをすべて確かめ、フォントの準備ができてから解決します。どれかが合わなければ reject します。代わりの「準備できた」扱いはしません |
| `window.seek(seconds)` | Promise を返し、その時刻の完成した1枚を描きます。状態は時刻だけで決まり、呼ぶ順番・壁時計・前のコマに依存しません（任意の7.2秒や順不同でも同じ画） |
| `window.__MOTION_RENDER__` | 真なら再生ループを動かさず、操作パネルを隠し、`#film` だけを余白・スクロールバー無しで指定の大きさに描きます |
| 静止 | 30〜32秒は形・位置・文字がすべて30秒の状態のままです |

書き出しの例（制作担当が別工程で行います）：

```text
node <motion-reel>/scripts/render.mjs --project <site>/video --out <empty-dir>/portrait --video
node <motion-reel>/scripts/render.mjs --project <site>/video --out <empty-dir>/wide --width 1280 --height 720 --video
```

音の指定（`--audio`・`--synth`）は付けません。この映像は `video/` の外にある `../concept.js` と `../concept/`・`../outputs/`・`../vendor/` などを読むので、書き出しでも `site/` 全体を同じオリジンから http で配信した状態で `video/index.html` を開く必要があります。`video/` だけを切り離したり `file://` で開いたりすると、確認に失敗して `motionReady` が reject します。

## 場面

`storyboard.json` に7場面の時刻・伝えること・入る状態・出る状態・動きがあります。場面の時刻と文言は `../concept.js` の `SCENES` が描画の元で、`storyboard.json` と一致しないと映像は読み込みを止めます。変えるときは両方を同じように直してください。

## 確認の状況

**作者の執筆時点の記録：未確認。** この編集ソースは作者AI（Claude Opus 5.5）が書いたもので、作者は描画・書き出し・再生を一度も行っていません。縦横の代表コマと連続コマ、任意時刻と順不同の描画の一致、30〜32秒の静止、無音のMP4の書き出しと終端、320/375px での作例ページの表示、破損時の停止と復旧は、制作担当がこれから別工程で確かめ、`../visual-verification.json` に記録します。それまでは確認済みとして扱わないでください。


## 受領後の制作担当の確認

25素材と6引用、7場面×縦横、任意7.2秒と順不同一致、通常32秒再生、代表・連続コマ、縦横32秒960フレーム・音声トラック0のMP4終端を別工程で確認しました。原音源は再合成していません。人の聴取や審美的承認、実機iOSは未確認です。詳細は `../visual-verification.json`、再描画は `../render-visual.py` とルートREADMEを参照してください。代表/連続コマは `review/portrait/review.html` と `review/wide/review.html` です。上の未確認は作者の執筆時点で、後の確認を新しいモデル実行へ付け替えるものではありません。
