# 図解32秒・無音の元ページ（3D Asset Server 作例）

`index.html`・`video.css`・`video.js` が、32秒・30fps・無音の図解動画の編集できるソースです。縦 720×1280（主）と横 1280×720 を、同じ時刻表で別々に組み直して描きます。場面の設計は `storyboard.json` にあります。以前の28秒の映像ソースは `legacy.html` と `legacy-video.js`・`legacy-video.css`・`legacy-storyboard.json`・`legacy-README.md` に、そのまま残しています。

## 何を描くか

3D Asset Server（arielshad/3d-asset-server、固定コミット `f605df3425011bae55ade114c9e7b276f5b1297b`、v0.1.0、Apache-2.0）は、既にある3D素材を探して、配信元が許すファイルを取得する道具（ライブラリ・CLI・REST・MCP）と、AIが読むMarkdownの手順書（SKILL.md・AGENTS.md）です。3Dモデルや画像を生成するものではありません。

映像は作例ページ（`../index.html`）と同じ概念図を使います。

- 渡す：手順書の本（検索・確認・取得の見出し札、規則の5つの印）と依頼の札「木箱 / Web / CC0 / 4MiB」が AI（Opus）へ合流し、AIが書いた `run.mjs` が、別の工程の制作担当（Nodeで1回実行）へ渡ります。点線の札「他の入口 MCP / REST」は手引きにある入口で、今回は未実行です。
- 選んで確かめる：原典の AssetService が Poly Haven（API・直接取得）と Fab（リンクだけ）へ分かれ、Poly Haven から候補3件、Fab から検索URLだけが届きます。選んだ木箱のカードに CC0 と glTF 1k の札が付き、5つのファイルに開いて予算のゲートへ。A08 の 1k は予算の内側、A04 の 8k は脇道で止まります（取得の通信0件。自動の再試行や1kへの切り替えではありません）。
- 受け取る：1k の5ファイルが相対パスのまま保存フォルダーへ合流し、実物の木箱の静止画（制作担当が実3D表示を撮ったもの）と出典 James Ray Cock / Poly Haven / CC0。Fab だけを直接取得に絞った A07 は skipped（エラーではない）。最後にフォルダーが ZIP、静止画が実3Dの入口になります。

## 使う素材

`motionReady` は、フォントの準備、`../concept/manifest.json`（SHA-256 固定）の25件の大きさとSHA-256の照合、引用の行・8件の結果のIDと入力・固定版・3つの記録と元の結果の値の一致・A08 の5ファイル・A04 の予算と例外・A07 の skipped の確認、静止画のデコードを待ちます。どれかが違えば描画を止め、操作をすべて無効にし、「もう一度読み込む」を出します。

映像の候補・状態・ファイル・大きさ・出典・静止画は、この読み込み時に照合した記録と実ファイルから読みます。フレームごとの取得や通信はありません。原典のコード・Node・AI・Poly Haven・Fab は、ここでは動かしません。

## 時間の契約（Motion Reel）

- `window.motionConfig = {duration: 32, fps, width, height, posterTime: 31, audioEvents: []}`。
- `window.renderConfig` の `width`・`height`（偶数）と `fps` があれば、配置の前に反映します。大きさが決まっているときは向きの切り替えボタンだけを止めます。
- `window.seek(秒)` は、その時刻の完成した画面を毎回最初から描きます。呼ぶ順番、壁時計、乱数、前のフレームに依存しません。描画は `save`・`restore` で閉じています。
- `window.__MOTION_RENDER__` が真、または `?render` のときはプレビューの再生を止め、canvas だけを画面いっぱいに出します。
- 最後の動きは28.9秒で終わり、29〜32秒は静止します（点滅もありません）。ポスターは31秒。
- 音声のトラック・ナレーション・読み上げ・音の合成は一切ありません。

## 場面

| 秒 | 見出し | 内容 |
| --- | --- | --- |
| 0〜4 | 既存の3D素材を探し、一式で受け取る | 手順書の本が開き、見出し札3つと規則の印5つ。隣に AssetService と2つの配信元の形 |
| 4〜8 | 渡す：手順書と依頼から、AIが run.mjs を書く | 本と依頼がAIへ合流し、run.mjs が制作担当へ。Nodeで実行したのは制作担当 |
| 8〜14 | 原典の AssetService が配信元へ振り分ける | Poly Haven から候補3件、Fab は検索URLだけ。選んだ木箱に CC0 と glTF 1k |
| 14〜20 | 取得の前に、合計を予算と比べる | 5ファイルに開き、A08 1k 2.17MiB は通る、A04 8k 113.14MiB は脇道で止まる |
| 20〜26 | 受け取る：5ファイルが相対パスのままフォルダーへ | フォルダーへ合流し、実物の静止画と出典。A07 は skipped |
| 26〜29 | 保存した実物を、実3DとZIPで使う | ZIP と実3Dの札（映像の中で端末の保存はしない） |
| 29〜32 | 既存の3D素材を探し、一式で受け取る | 全体の経路で静止 |

## 開き方と書き出し

`fetch` と `crypto.subtle` を使うため、作例のフォルダ（`index.html` のある階層）をローカルのHTTPサーバーで配信して `video/index.html` を開きます。自動では再生しません。

書き出しの手順・使ったコマンド・環境・確認の結果は、制作担当が描画したあとに `../visual-guide.md` と `../visual-verification.json` へ記録します。

```text
python render-visual.py --out ../asset-review-portrait --width 720 --height 1280 --strip-at 10.2
python render-visual.py --out ../asset-review-wide --width 1280 --height 720 --strip-at 10.2
（作例ルートから実行。未導入の場合だけtools/motion-reelへ依存を導入。）
```

## 現在の状態

このソースは claude-opus-5-5 が書いたもので、書いた時点ではブラウザーでの表示、フレームの描画、MP4の書き出し、映像の確認のどれも行っていません。制作担当の技術的な確認は、人による承認とは別のものです。

## ライセンス

映像のコードと文章：MIT License、Copyright (c) 2026 Studio Yebisu。3D Asset Server：Apache License 2.0（`../vendor/3d-asset-server/LICENSE`。同梱のフォントと依存の告知は元のまま）。木箱のモデル：Wooden Crate 01 by James Ray Cock / Poly Haven / CC0。Poly Haven の公式のものでも、推薦を受けたものでもありません。

制作側の再現入口は作例ルートrender-visual.py。空の出力先へ縦720×1280/横1280×720。新しいQAは../visual-verification.json、原制作と今回の区別は../visual-guide.md。執筆時点の未検査と後の制作側QAを区別します。

制作側の今回の技術確認：25素材、3記録×3段階、6引用と出典、スマホ/配色16組、3破損と再読込、7場面と任意7.2秒、縦横960フレーム/32秒/音声0・全デコード・ネイティブ完走、出荷入口62PNG一致と30/31秒の静止を確認。元の推論/API/取得は再実行なし。詳しくは../visual-verification.json。人の承認ではありません。
