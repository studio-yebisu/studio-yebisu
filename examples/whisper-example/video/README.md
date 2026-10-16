# 解説動画の元ページ（しおり工房 字幕デスク・Whisper作例）

「転記の誤りを、そのまま直せる。」を伝える、28秒・1280×720・30fps（840フレーム）の**無音**の解説動画を描く、編集できる元ページです。Canvas 2D で、指定した時刻の完成した画面を毎回最初から描きます。

- 入力は、作例用に書いた架空の原稿を手元の Windows 音声合成（Microsoft Haruka Desktop）で読み上げた**合成音声**です。人の録音ではありません。
- 映像は、実画面の**静止キャプチャ**と実際の記録を編集でつないだものです。続けて録画した画面ではなく、ページ上で音声認識を動かしたものでもありません。
- 文の修正は、読み上げ原稿を参照して手で行ったものです。音声を聞いて確かめた校正ではなく、発音・音質・時刻の正しさは未確認です。自動の修正や人による承認を示すものでもありません。
- 映像に音はありません。元の合成音声は、作例のページ（`../index.html`）か `../input/review-ja.wav` で再生できます。

映像のコードと文章は Claude Opus 5.5 が書きました。音声認識は Whisper base が制作時に1回行ったもので、このページでは動きません。

## ファイル

| ファイル | 中身 |
| --- | --- |
| `index.html` | プレビュー（再生ボタン・時刻スライダー・読み込みの状態・関連ファイルへのリンク） |
| `video.js` | 素材の読み込みと照合、各時刻の描画、`window.seek`・`window.motionConfig`・`window.motionReady` |
| `video.css` | プレビューの見た目。書き出し時は canvas だけを表示 |
| `storyboard.json` | 制作ブリーフ、場面ごとの時刻・伝えること・入り・出・素材、切り抜きの座標 |
| `assets/` | 実画面のキャプチャ4枚、`screen-manifest.json`、`waveform.json`（制作側が用意） |

## 使うデータ

映像に出す文・数・時刻は、次のファイルを読み込んで取り出します。`video.js` に転記の文を書き写していません。

| ファイル | 映像で使うところ |
| --- | --- |
| `../request.txt` | 「入力：」の行の最初の一文（場面1） |
| `../input/script.json` | 読み上げた原稿の1文目、声の名前の照合（場面3） |
| `../input/review-ja.wav` | SHA-256・標本数・長さの照合と、0.1秒ごとの RMS の計算（場面1・2） |
| `assets/waveform.json` | WAV から求めた RMS と照らし合わせる記録 |
| `../outputs/session.json` | 長さ・形式、転記の条件、5区間の id・時刻・文（場面1〜4） |
| `../outputs/review-ja.srt` | Whisper が書いた原出力の SRT（時刻行と文の照合） |
| `../outputs/edit-record.json` | 直した後の5区間、直した区間の一覧、聞いての確認・時刻の確認が未実施であること（場面3・4） |
| `../outputs/reference-review.json` | 原稿参照による修正の記録（照合） |
| `../outputs/browser-edited.srt` | ブラウザーが保存した SRT。最初と最後の区間をそのまま表示（場面5） |
| `assets/screen-manifest.json` | 実画面4枚の SHA-256 と大きさ |

読み込み時の照合（どれか一つでも合わなければ、代わりの映像を出さずに失敗を表示し、`window.motionReady` は reject します）：

- 14ファイルの SHA-256 を、制作記録 `runtime/frozen-reviewed-source.json`（2026-10-16T09:56:34Z）の値と比べる
- WAV の SHA-256 が `session.json`・`waveform.json` の記録と同じ。PCM16・モノラル・16kHz・標本数が記録と同じ
- WAV の標本から求めた0.1秒ごとの RMS が `waveform.json` の値と ±0.00002 以内
- `session.json` の5区間と `review-ja.srt` の番号・時刻行・文が同じ
- `edit-record.json` の5区間の時刻が原出力と同じ。文が変わった区間が `changed_segment_ids`（0・1・4）と同じ
- `browser-edited.srt` の SHA-256 が `edit-record.json` の記録と同じ。番号は1から連番、時刻行は原出力と同じ、文は直した記録と同じ
- 実画面4枚の SHA-256 と画素数が `screen-manifest.json` と同じ。切り抜きが画像の内側にある

ここに書いた照合は `video.js` が読み込むたびに行う処理です。この README を書いた時点で、ブラウザーでの実行・書き出し・フレームの確認はしていません。

## 実画面の切り抜き

画素は変えず、等倍率で置きます。パネルの枠の外に約10pxの余白を含め、文字を切りません。強調の枠（場面3）は映像側で切り抜きの上に重ねたものです。

| 名前 | 画像 | x | y | 幅 | 高さ | 倍率 | 場面 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 区間の一覧（原出力） | `desktop-raw.png`（1265×1886） | 78 | 477 | 526 | 532 | 0.88 | 4〜8秒 |
| 文を直す欄（編集前） | `desktop-raw.png` | 600 | 477 | 602 | 667 | 0.7 | 8〜11秒 |
| 文を直す欄（id 0 を直した後） | `desktop-edited-first.png`（1265×1940） | 600 | 503 | 602 | 665 | 0.7 | 10.6〜15.5秒 |
| 3区間を直した後の一覧 | `desktop-edited-last.png`（1265×1911） | 78 | 503 | 526 | 590 | 0.79 | 15.5〜20秒 |
| 保存パネル（見出しとボタンまで） | `desktop-edited-first.png` | 600 | 1167 | 602 | 165 | 1.1 | 20〜24秒 |
| スマホ幅の初期画面（上部） | `phone-raw.png`（375×812） | 0 | 0 | 375 | 524 | 0.9 | 24〜28秒 |

- `desktop-edited-first.png` は SRT と TXT の両方を保存した後に撮った画面で、保存パネルの状態の行は TXT の保存を示しています。保存パネルの切り抜きはその行を含めず（y 1332 まで）、SRT の中身は `outputs/browser-edited.srt` の実ファイルで示します。ダウンロードの表示は撮影していません。
- `phone-raw.png` は 390×844 を指定して撮りましたが、実際の画素は 375×812 です。編集前の初期画面です。
- 文を直す欄の2枚は、パネルの上端をそろえて0.45秒で入れ替えます（編集上のつなぎ）。

## 時刻の約束

- `window.motionConfig = {duration: 28, fps: 30, width: 1280, height: 720, posterTime: 13.5, audioEvents: []}`。`window.renderConfig` の幅・高さ・fps があれば初期化時に反映します。1280×720 以外の大きさは同じ配置を等倍率で収めるだけで、別の縦横比として作り直したり確認したりはしていません。
- `window.seek(秒)` は Promise を返し、その時刻の完成した画面を描きます。毎回 canvas を初期化し、変換・クリップ・状態を前のフレームから持ち越しません。タイマー・壁時計・乱数・積算は描画に使いません。
- 再生ボタンとスライダーはプレビュー専用です。`window.__MOTION_RENDER__` が真のときは登録しません。自動では再生しません。

## プレビューを開く

この作例のフォルダ（`video/` の一つ上）でローカルサーバーを立てます。SHA-256 の照合に `crypto.subtle` を使うので、`file://` では開けません。

```powershell
python -m http.server 8862 --bind 127.0.0.1
# → http://127.0.0.1:8862/video/index.html
```

任意の時刻を描くには、開いたページの開発者ツールで `await window.seek(13.5)` のように呼びます。スライダーでは ← → で0.1秒、PageUp・PageDown で2秒、Home・End で先頭・末尾へ移ります。

## 書き出し（制作側が行う）

必要なもの：Node.js 20 以上、Google Chrome、FFmpeg と ffprobe、Python 3.9 以上。この作例のフォルダ（`video/` の一つ上）で実行します。出力先は作例の外の、空のフォルダを指定します。既にあるファイルは上書きしません。

```powershell
npm ci --ignore-scripts --no-audit --no-fund --prefix tools/motion-reel
python render.py --out ../whisper-render-first
```

`render.py` は作例を一時フォルダへ写し、`video/index.html` を `<base href="video/">` 付きでその一番上に置いてから、同梱の `tools/motion-reel/render.mjs` で代表フレーム・連続フレーム・ポスター・同じ時刻の再描画の一致・`video.mp4`（音声トラックなし）を書き出します。静止画だけなら `--stills-only` を付けます。

書き出した映像のフレーム確認、MP4 のデコードと再生の確認は制作側が別に行い、その記録はここには書きません。

## ライセンス

映像のコードと文章：MIT License（Copyright (c) 2026 Studio Yebisu）。作例の `LICENSE` を参照。画面のキャプチャは作例自身のページを撮ったものです。Whisper のコードと重みは MIT License（Copyright (c) 2022 OpenAI）で、OpenAI による承認や推奨を示すものではありません。
