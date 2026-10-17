# 動画ソース：1件だけ進めて、続きはファイルへ。

Harness Creator の5つのファイル（作業の決まり・1件に絞る・今どこか・次へ渡す・実行して確かめる）が、小さな作業を1件だけに絞り、制作担当の実行記録を根拠に新しいセッションへファイルで引き継がせる様子を、1枚のつながった図の中で見せる **無音** の動画ソースです。文字のスライドではなく、同じ紙・カード・フォルダーが机 → 確かめる門 → フォルダー → 新しい机へ移動します。

- 32秒・30fps・960フレーム。音声トラック・ナレーション・読み上げ・効果音はありません（`audioEvents: []`）。
- 縦 720×1280（既定）と横 1280×720 を、それぞれの配置で描きます。縦の画面に横の絵を縮めて入れることはしません。
- 場面の時刻と見出しは `assets/timeline.json`、各場面の入り・変化・出・出典は `storyboard.json` にあります。

## ファイル

| ファイル | 役割 |
| --- | --- |
| `index.html` | プレビューと書き出しの入口 |
| `video.js` | 素材の照合と、時刻 t からの描画 |
| `video.css` | プレビューの見た目。書き出し時はキャンバスだけを実寸で置く |
| `storyboard.json` | 6場面の入り・変化・出・時点・実際の出典・合図 |
| `assets/` | 固定した素材10件と `manifest.json`（この作業では変更していません） |

## 素材と固定値

`assets/manifest.json` の SHA-256 を `9e049f50bdaf51486d705800e9d19bef93d143037362586dc76437c4a84f5050` に固定しています。`video.js` はこのマニフェストを取得してハッシュを確かめ、載っている10件（`diagram-data.json`・`exercise-run.json`・`handoff-data.json`・`harness-created.json`・`note-index.json`・`original-verification.json`・`queries.json`・`timeline.json`・`upstream.json`・`verification-run.json`）をすべて取得し、バイト数と SHA-256、さらに中身のつながり（8問の実際の出力と索引の全項目、Q03 → N02・Q06 → 0件、2つのセッションの状態、3ファイルだけの更新、雛形5ファイルの SHA-256、固定コミット `38ddcd2bf8d65271f668b94e7c875ca1d629d622`・MIT）を確かめてから `window.motionReady` を解決します。1つでも合わなければ `motionReady` を reject し、キャンバスを消し、操作を止め、理由と「もう一度読み込む」を出します。代わりのデータは持ちません。

`original-verification.json` は以前の28秒版の確認記録です。読み込みと照合はしますが、この動画の確認の根拠には使いません。

## 時刻の契約

- `window.motionConfig = { duration: 32, fps, width, height, posterTime: 31, audioEvents: [] }`。`window.renderConfig` の `width`・`height`・`fps` があればそれに従い、その大きさで配置を計算します（高さ ≥ 幅なら縦、そうでなければ横）。
- `window.seek(t)` は t だけから画面全体を描きます。前のフレームの積み重ね・壁時計・乱数・CSSアニメーションは使いません。準備前に呼ばれた場合は `motionReady` の後に描く Promise を返します。同じ t なら、順番を変えても、新しいページでも同じ絵になる設計です。
- `window.__MOTION_RENDER__ === true` のときはプレビューの再生・タイマーを動かしません。
- プレビューは停止状態で開き、自動では再生しません。再生／一時停止・最初から再生・先頭へ・最後へ・0〜32秒の位置・6場面へのジャンプがあります。横の配置は `index.html?layout=wide` で確かめられます（書き出しでは使わず、`renderConfig` に従います）。
- 29.5〜32秒は静止。ポスターは31秒。

## 書き出し（制作担当が後で行う）

同梱のレンダラーは Node.js 20 以上・Chrome・FFmpeg/ffprobe を使います。初回だけ `tools/motion-reel/` で `npm install --ignore-scripts` を実行します。出力先は毎回、作例フォルダーの外の空のフォルダーにします。

```bash
# 縦 720×1280（既定）。作例フォルダーの外の使い捨てコピーで描き、MP4とフレームの確認資料を作る
python render.py --out <空の出力フォルダー>

# フレームの確認資料だけ
python render.py --out <空の出力フォルダー> --stills-only --strip-at 21.0
```

横 1280×720 は、`render.py` と同じ使い捨てコピー（作例一式を作例の外へ写し、`index.html` を `video/index.html` に `<base href="video/">` を加えたものに置き換える）に対して、同梱のレンダラーへ大きさを渡します。

```bash
node tools/motion-reel/render.mjs --project <使い捨てコピー> --out <空の出力フォルダー> --width 1280 --height 720 --step 2 --strip-at 21.0 --video
```

音の指定（`--audio`・`--synth`）は使いません。

## 範囲：何が元の実行で、何がこの作業か

- **元の実行（今回やり直していない）**：固定版 `create-harness.mjs` を改変せずに実行した5ファイルの生成。1つ目の Opus のセッション（コード・検証スクリプト・文書を書き、雛形の4ファイルを書き換え、シェルは実行していない）。制作担当による `./init.sh`（終了コード0）・`build`・`search`・8問・不正入力11件の実行。2つ目の新しい Opus のセッション（保存ファイルと実行記録を読み、`feature_list.json`・`progress.md`・`session-handoff.md` の3つだけを更新し、シェルは実行していない）。
- **この作業**：その保存済みの記録を素材に、図の動画ソース（`index.html`・`video.css`・`video.js`・`storyboard.json`・この README）を新しく書いただけです。CLI・検証・AIのセッション・推論は実行していません。動きは考え方の説明で、AIの記憶を写したものではありません。
- **まだ行っていない確認**：書き出し、フレームの一致の確認、MP4の再生・目視、公開は、制作担当が後で行います。ここに書いた内容はそれらが済んだことを意味しません。

自動で作業を回す仕組み、信頼性・速度・効果の向上、ハーネスなしとの比較は示していません。構造の点検の点数は動画に出しません。

## 出典とライセンス

- Harness Creator：walkinglabs/learn-harness-engineering（固定コミット `38ddcd2bf8d65271f668b94e7c875ca1d629d622`）、MIT License、Copyright (c) 2025 WalkingLab。
- この動画ソースと架空の書店メモ：MIT License、Copyright (c) 2026 Studio Yebisu。書店名・運用はすべて架空です。
- 文字は端末のフォント（Hiragino・Yu Gothic・Meiryo・Noto など）を使います。外部のフォントやライブラリは読み込みません。


## 制作担当の確認

受領8原本は非公開で保存し、変更範囲は../verification.jsonに記録しました。元の73実装・入力・出力・状態と25原典は保全し、CLIと元の2セッションは再実行していません。32秒/30fps/960フレーム、縦720×1280・横1280×720、音声ストリーム0です。任意時刻の一致、代表/連続フレームとコンタクトシート、スマホの図と保存操作、全デコード、縦横MP4の終了、10素材と29実ファイルの照合、失敗と復旧を確認しました。人の承認と実機iPhoneは未確認です。
