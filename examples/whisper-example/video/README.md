# 図解動画の元ページ（声を、文と時刻へ・Whisper 作例）

Whisper が「音声認識モデルと Python ツール」であることと、実際の入力 WAV が特徴・encoder・decoder を通って文と推定時刻の5区間になり、SRT へ保存されるまでを、一つのつながった図で見せる **32秒・無音** の図解動画です。縦 720×1280 と横 1280×720 を、同じ時刻表のまま別々の配置で描きます。Canvas 2D で、指定した時刻の完成した画面を毎回最初から描きます。

- 映像に音はありません。`audioEvents` は空で、音声要素・音の再生・ナレーションはありません（入力WAVのバイトは26素材の照合に使います）。Whisper に渡した実際の入力音声は、作例ページ（`../index.html`）の再生欄か `../input/review-ja.wav` で別に聞けます。
- 図の中の波形・色面・5区間・修正・SRT はすべて照合済みの実記録から描きます。色面は同じ前処理 API を元の WAV へ当てた表示用の平均で、推論の内部記録ではありません。encoder・decoder の箱は構造の説明で、注意や活性の計測ではありません。
- 修正例は原稿を参照した手動の編集例です。Whisper の自動修正でも、音声を聞いての校正でもありません。5区間の時刻は変えていません。
- 映像とコードは claude-opus-5-5 が書きました。音声認識は制作時に Whisper base（CPU）が1回行ったもので、このページでは動きません。

## ファイル

| ファイル | 中身 |
| --- | --- |
| `index.html` | プレビュー（再生・一時停止・先頭へ・最初から再生・末尾へ、0〜32秒のスライダー、7場面への移動、縦横の切り替え、素材の照合状態） |
| `video.js` | 時刻ごとの値（`filmParams`）、見出し・吹き出し、`window.seek`・`window.motionConfig`・`window.motionReady` |
| `video.css` | プレビューの見た目。書き出し時は canvas だけを表示 |
| `storyboard.json` | ブリーフ、7場面の入り・出・時刻・見出し・出典、残り続ける図形 |
| `../app.js` | 作例ページと共通の照合（`loadValidatedAssets`）と概念図の描画（`diagramLayout`・`drawDiagram`） |

## 使う素材と照合

`../concept/manifest.json` を `cache: 'no-store'` で読み、SHA-256 が固定値 `faf7566d8b89263f22ebb65e7b80abd999f37ef20261e209377e4cf14b03788f` と一致することを確かめてから、記載の26件をすべて取り直して大きさと SHA-256 を照合します。続けて中身の対応を確かめます。

- 構造の記録：形式・固定版（86098128c0b4f24f0e2aa2994de830614b474227・20250625）・6部品のID・各引用が出典の該当行にあること
- 実行の設定：base・CPU・ja・transcribe・fp16 なし・temperature 0・condition_on_previous_text なし・initial_prompt なし・原稿なし・word_timestamps なし・4スレッド・重みの SHA-256
- 入力 WAV：16kHz・モノラル・PCM16・336225標本。標本から求め直した0.1秒ごとの RMS が `waveform.json` の211窓と一致
- 色面：同じ音声の SHA-256、前処理 API、形（80×5101・80×2101・80×96）、行列の値が 0〜1 の有限値で全体 min-max
- 区間：`structure.json`・`session.json`・`review-ja.json` の5区間が一致し、5区間の開始・終了が記録どおり
- 修正：id 0・1・4 の文だけが変わり、5区間の時刻は不変。`reference-review.json`・`edit-record.json` と一致し、聴取と時刻の確認は未実施の扱い
- SRT：原出力（441 B）と修正例（420 B）の番号・時刻行・文が区間と一致

どれか一つでも合わなければ図を描かず（空の紙だけ）、操作を無効にし、`window.motionReady` は reject します。プレビューでは「もう一度読み込む」で26件をすべて取り直します。

ここに書いた照合は、ページを開くたびに `../app.js` が行う処理の説明です。この README を書いた時点で、ブラウザーでの実行・描画・フレームの確認はしていません。

## 時刻の約束

- `window.motionConfig = {duration: 32, fps: 30, width, height, posterTime: 31, audioEvents: []}`。`window.renderConfig` の幅・高さ・fps があれば初期化時に反映し、幅が高さより大きければ横の配置、それ以外は縦の配置で描きます。
- `window.motionReady` は26件の照合と `document.fonts.ready` を待ちます。
- `window.seek(秒)` は Promise を返し、その時刻の完成した画面を描きます。値はすべて絶対時刻からの閉形式で、前のフレームや呼び出し順・壁時計・乱数に依存しません。描画ごとに変換と状態を初期化し、`save`/`restore` で閉じます。
- 7場面：0〜4・4〜9・9〜14・14〜20・20〜25・25〜29・29〜32秒。最後の場面の入りは28.4〜28.9秒に終わり、29〜32秒は静止します。暗転はしません。
- `window.__MOTION_RENDER__` が真のときは、プレビューの再生・タイマー・イベントを登録しません。自動では再生しません。

場面ごとの入り・出・時刻・出典は `storyboard.json` にあります。

## プレビューを開く

作例のフォルダ（`video/` の一つ上）でローカルサーバーを立てます。SHA-256 の照合に `crypto.subtle` を使うので、`file://` では開けません。

```powershell
python -m http.server 8862 --bind 127.0.0.1
# → http://127.0.0.1:8862/video/index.html
```

## 書き出し（制作側が行う）

制作側が用意する `../render-visual.py`（作例のフォルダに置くラッパー）で、作例の外の空のフォルダへ書き出します。既存の出力は上書きしません。音の指定は付けません。

```powershell
python render-visual.py --out ../whisper-visual-portrait --width 720 --height 1280
python render-visual.py --out ../whisper-visual-wide --width 1280 --height 720
# 静止画だけ確かめるとき
python render-visual.py --out ../whisper-visual-stills --width 720 --height 1280 --stills-only
```

既存の `render.py` は旧28秒版の入口として残しています。

## 確認の状態

- 描画・フレーム確認・同じ時刻の再描画の一致・MP4 の書き出しとデコード・再生：**未実施（制作側が後で行う）**
- 音声：映像は無音。入力音声の聴取、発音や時刻の正しさ、人の承認は確かめていません。

## ライセンス

映像のコードと文章：MIT License（Copyright (c) 2026 Studio Yebisu）。作例の `LICENSE` を参照。Whisper のコードと重みは MIT License（Copyright (c) 2022 OpenAI）で、OpenAI による承認や推奨を示すものではありません。

制作側の補正：非強調部品の可読性を上げ、向き操作の対象をボタンだけに限定しました。素材の取得が一件失敗した後に別の取得の進捗表示がエラー文を上書きしないよう補正しています。上記の未実施は執筆時点の状態で、現在の制作側QAは../visual-verification.jsonを参照してください。
