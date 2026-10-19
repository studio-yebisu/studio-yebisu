# PDF Creator 作例：解説映像の編集ソース

同じ日本語のMarkdown（架空のワークショップ「紙からはじめる、小さな展示」）から、PDF Creator の原典 `markdown_to_pdf()` で保存した2つのPDFを、28秒で説明する映像の編集ソースです。

- 実際の書き出し：1280×720、30fps、28秒（840フレーム）、**無音**（音声トラックなし）
- 素材：最終PDFから書き出した実ページ画像 `assets/paper-page-1.png`・`assets/phone-page-1.png`・`assets/phone-page-2.png`。Canvas2D で切り抜き・縮小・拡大するだけで、画素の描き足しや書き換えはしません
- 画面上の常設表示：「実PDFのページ画像から編集／連続操作の録画ではありません」「無音」
- 題材は架空のイベントです。実際の開催・申込窓口・外部送信はありません

同梱のrender.pyとMotion Reelで実際に書き出し、代表/連続フレーム・全デコード・実MP4終端再生を確認しました。範囲は ../verification.json が現在の記録です。

## 何を伝えるか（場面）

| 時刻 | 場面 | 画面に見えるもの |
|---|---|---|
| 0–5.3秒 | 操作 | `inputs/event.md` の該当行（行番号つき・文字で再掲）と、指定した2つの版（A4で配る／細いページで読む） |
| 5.3–10.5秒 | 原典APIと保存結果 | `markdown_to_pdf()`・`backend=chrome`。実ページ画像3枚を実寸比で並べ、A4 1ページ・細いページ 2ページ |
| 10.5–16.5秒 | 拡大 | A4 1ページ目と細いページ 1/2 の実画素の切り抜き。同じ日付・時間と、原稿どおりの架空イベントの注意書き |
| 16.5–22.5秒 | 全ページ確認 | 細いページ 2/2 の切り抜き（流れの4〜6・持ち物）と、全3ページの縮小 |
| 22.5–28秒 | 再利用 | `request.txt` の要点（原稿・用途・言語とフォント・全ページ確認）と、保存された `outputs/atelier-a4.pdf`・`outputs/atelier-phone.pdf`・`inputs/event.md` |

全ページの縮小は全体の見え方の説明用で、本文は拡大した切り抜きで読ませます。

## ファイル

- `index.html`：映像の画面とプレビュー（再生・一時停止、0〜28秒のシーク、時刻表示）
- `video.css`：配色と、論理ステージ 1280×720 上の配置
- `video.js`：`window.seek(秒)` で任意時刻の画面を描く処理、素材の読み込みと照合、プレビュー操作
- `storyboard.json`：場面の時刻・字幕・出典表示、切り抜き範囲（ページ画素座標）、注釈枠、抜粋する行、残る確認項目

## プレビュー

`file://` では素材を読み込めません。作例フォルダ（この `video/` の1つ上）をHTTPで配信して開きます。

```text
python -m http.server 8000 --bind 127.0.0.1
```

ブラウザで `http://127.0.0.1:8000/video/index.html` を開きます。PNG 3枚・`outputs/manifest.json`・`inputs/event.md`・`request.txt`・`storyboard.json` の読み込みと照合が終わるまで、再生ボタンとシークは無効です。どれかが失敗した場合は、失敗したファイル名を表示して無効のままにします。

## 書き出し（Motion Reel）

作例フォルダにある `render.py` と `tools/motion-reel/` を使います。必要なもの：Python 3.9以上、Node.js 20以上、Google Chrome、FFmpeg と ffprobe。`tools/motion-reel/node_modules` が無い場合は、そのフォルダで `npm ci --ignore-scripts --no-audit --no-fund` を一度実行します。

作例フォルダで実行します。出力先は毎回、作例フォルダの外の空のフォルダにします（既存の出力は上書きしません）。

```text
python render.py --out ../motion-review/stills --stills-only
python render.py --out ../motion-review/camera --stills-only --strip-at 11.1
python render.py --out ../motion-review/final
```

`render.py` は作例フォルダを一時フォルダへ複写し、複写側の入口HTMLにだけ `<base href="video/">` を足して描画します。元の `video/index.html` は書き換えません。そのため `index.html` には `<base>` を書かないでください。

レンダラーは `window.__MOTION_RENDER__` と `window.renderConfig` を渡します。この映像は渡された幅・高さ・fpsを初期化時に反映し、書き出し中はプレビューの再生を始めません。

## 編集するとき

- 時刻・字幕・出典表示・切り抜き範囲は `storyboard.json` で変えられます。`view` はページPNGの画素座標 `[x, y, 幅, 高さ]`、`at` は論理ステージ上の左上、`scale` はページ画素1つあたりの論理pxです
- 切り抜き範囲は、実PNGを原寸で見て読み取った文字位置に余白を足した値です。範囲を変えたら、`crop_contains` の文字がすべて枠に入っているかを描画したフレームで確かめてください
- 原稿や依頼文の抜粋は、元ファイルの指定行と一致しないと準備が失敗します。ファイル名・寸法・ページ数は `outputs/manifest.json` から表示します
- 時間で変わる見た目は `seek` の中だけで決めます。CSSのトランジションやアニメーション、タイマー、前のフレームの積算は使いません

## 読み込み時の照合

- 使うPNGが manifest のページ画像であり、幅・高さが記録どおりであること
- 安全な接続（`127.0.0.1` などのHTTP）では、PNG 3枚と `inputs/event.md` の sha256 が manifest と一致すること
- `storyboard.json` のファイル名・寸法・ページ数が manifest と一致すること
- 抜粋した行が `inputs/event.md`・`request.txt` の該当行と一致すること
- 切り抜き範囲がページ画像の内側にあること

## 確認の状況

済んでいること（映像を作る前）：

- PDF2種は、原典の `markdown_to_pdf()` と Chrome バックエンドで生成されています。A4（warm-terra + japanese-a4.css、210×297mm）は1ページ、細いページ（mobile + japanese-phone.css、148×210mm）は2ページです
- `validation.json` には、取り出した文字と原稿の照合結果と、エージェントによる全3ページの画像確認が記録されています。人による承認はしていません
- 生成は Windows・Chrome の1環境で、親の工程が互換のための処理（Chrome の場所の指定、一時ユーザープロファイル、UTF-8、HTMLの `lang="ja"`、インストール済みの Noto Sans JP の扱い）を足して行いました。原典のコマンドが他のOSや環境でそのまま同じ結果になることは確かめていません
- macOS のプレビュー、Adobe Acrobat Reader、実際の印刷、和文の禁則すべてへの対応、WeasyPrint、表、一括変換は確認範囲外です

映像で実施した確認（制作担当）：

- 同梱render.py/レンダラーで28秒・720p・30fps・840フレーム・音声なしのMP4を出力
- 代表フレーム、コンタクトシート、13.5秒ポスター、速い寄りと切り替え付近の連続フレームを視覚確認
- 同じ時刻を別の順序/新しいページで描き、一致を確認（同じ実行環境のprobeに限定）
- MP4を全デコードし、ネイティブの動画再生で先頭から28秒終端まで確認

storyboard.jsonの制作時ステータスと未実行チェックの一覧は元の設計記録です。現在の実行・視覚確認の正本は ../verification.json。自動検査/エージェントの視覚確認は、人による承認や全環境の品質保証ではありません。

## 出典とライセンス

- 原典：PDF Creator（daymade/claude-code-skills の `daymade-docs/pdf-creator`、コミット `e37b50c323cf99471f18ac17a11c923bb96ce2ba`）。MIT License、Copyright (c) 2025 daymade
- この映像の構成・コード・文章：Copyright (c) 2026 Studio Yebisu、MIT License
- 映像の文字はシステムフォントで表示します。フォント本体は同梱していません。PDFの中には、生成時のフォントのサブセットが埋め込まれています
- 架空のイベントの原稿・PDF・ページ画像は、この作例のために Studio Yebisu が作ったものです
