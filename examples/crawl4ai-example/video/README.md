# 図解の編集ソース：Crawl4AI ― ページを、使える形へ（32秒・無音）

Crawl4AI を初めて見る人に向けた、32秒・無音の動く概念図の**編集ソース**です。伝えたいことは1つです：**Crawl4AI は、Pythonからブラウザーを動かし、ページを文章（Markdown）と項目（JSON）に変えるライブラリ。**

URL・設定・Python の呼び出し・ブラウザー・待機の門・本文の範囲・2つの枝・2つの出力・全体の結果メモが、32秒を通して同じ図形として残り、移動・合流・変形でつながります。文章のスライド、スクリーンショット、ナレーション、読み上げ、効果音は使いません。

| 項目 | 値 |
|---|---|
| 尺・サイズ | 32.0秒・30fps（960フレーム）。縦 720×1280 と 横 1280×720 を、それぞれの配置で描く |
| 音 | **なし**（`audioEvents: []`。MP4にも音声トラックを付けない） |
| ポスター | 31秒（全体の図が止まった場面） |
| 静止 | 29.4秒から32秒まで動きなし。黒へのフェードなし |
| 制作段階 | 編集ソース（書き出し前）。MP4・ポスター・確認記録はまだありません |
| ファイル | `index.html`（編集画面）、`video.js`（描画と照合）、`video.css`、`storyboard.json`（場面・形・値の出どころ・素材・残りの確認） |

## 場面

| 秒 | 見出し | 形の動き |
|---|---|---|
| 0–4 | ページを、使える形へ（Pythonのライブラリ） | URLの札と設定の小片が Python の呼び出し帯へ集まり、ブラウザーが開いて nav・本文・footer が見える |
| 4–9 | 設定を渡して、開く | 小片が BrowserConfig と CrawlerRunConfig の札に広がり、Crawl4AIの範囲・広がったページ・閉じた待機の門が現れる |
| 9–14 | 描画を待つ | 書き出しページに、ページのJSから2節目「書き出す前に確かめる」が入り、`data-ready` が `true` になってから門が開く |
| 14–20 | 本文から、2つの形へ | `main#guide` を囲み、nav・footer が外れる。項目の型が `h2` と `p.keypoint` を見つけ、同じ2節が JSON の項目の対へ、同じ見出しが Markdown の紙へ並行して渡る |
| 20–25 | 同じ道で、3ページ → HTTPも確かめる | 全体が引き、3ページの紙札が同じ道を通って 3ページ・6節になる。診断は HTTP 404 の門へ進み、3ページの外に残る（項目の型は通らない） |
| 25–29 | 使う・保存する | Markdown と JSON が workflow.py の全体の結果メモ `result.md` に入る。404 は別欄 |
| 29–32 | ページを、使える形へ | 全体の道筋で静止。「実際の結果を開く → 作例ページで」と短いクレジット（押せるボタンの形にはしない） |

細かな秒・入りと出・持ち続ける形・値の出どころは `storyboard.json` にあります。

## 素材と照合

使うのは作例フォルダの中の保存済みファイル17件だけです。`../concept/manifest.json` を `cache: "no-store"` で読み、その SHA-256 が `3d551e51493965163f6d04ff45217904733da852dda723ecb4c2bbe851a79260` と一致することを確かめてから、一覧の17件のバイト数と SHA-256 を照合します。さらに次を確かめます。

- `outputs/runs.json`（33099 bytes・`0b932f3a…18f5`）と `outputs/result.md`（5852 bytes・`aba3649b…16e6`）が固定値どおり。
- Crawl4AI 0.9.5・固定コミット `6192d5e5b59cb21f9ca418fd6b798de47c0741d3`、スキーマ（`article.doc-section`・`h2`→heading・`p.keypoint`→keypoint）とセレクター（`main#guide`・nav/footer を除く・`wait_for`）。
- 3ページとも HTTP 200・受理、各2節が `extracted_content` と一致、元のHTMLの節は 2・2・1 で描画後は 2・2・2、書き出しの2節目は `dynamic-export.js` にだけある。
- 診断は HTTP 404・`success: true`・受理しない・`extracted_content: null`、設定に `wait_for`・`css_selector`・`extraction_strategy` が無い。
- LICENSE・NOTICE.txt・README に帰属表示の英文がある。

どれかが合わないとき、または読み込めないときは、Canvas を空にして操作を止め、状態の欄に短いエラーと「もう一度読み込む」を出します。`window.motionReady` は拒否されます。代わりの画面や値は出しません。再試行は17件をすべて読み直します。

映像の文字・数・見出しは照合済みのデータから取り出します（例：見出し・ページ名・パス・HTTP ステータス・節の数）。図形の配置と短いラベル（「描画を待つ」など）だけをこのソースに書いています。図形は説明のための絵で、実行の証拠ではありません。証拠は保存済みの実行結果です。

## 編集画面で見る

作例フォルダ（`workflow.py` がある階層）で次を実行し、ブラウザーで開きます。

```bash
python -m http.server 8000
# 縦：http://127.0.0.1:8000/video/
# 横：http://127.0.0.1:8000/video/?layout=wide
```

- 準備ができると状態の欄に「準備完了」と出て、操作が使えるようになります。自動再生はしません。最初は31秒（ポスター）の画面です。
- 「再生／一時停止」「最初へ」「最後へ」「最初から再生」、0–32秒のスライダー、0・4・9・14・20・25・29秒への移動ボタン（いずれも44px以上）があります。スライダーは矢印キーで1フレームずつ動きます。再生は経過時間から秒を計算し、32秒で止まります。
- 「縦 720×1280」「横 1280×720」で配置を切り替えられます（`window.motionConfig` の幅と高さも変わります）。
- Canvas の下の説明文は、表示中の場面が変わるたびに更新されます（読み上げ向け）。照合する17件の状態も一覧で見られます。
- SHA-256 の照合にブラウザーの暗号機能を使うため、`file://` や localhost 以外の HTTP では開けません（エラーとして表示します）。

## 任意の時刻を描く約束

- `window.seek(秒)` は、その秒の完成した1枚を、前に描いた秒や経過時間に関係なく描きます。毎回 `save`／`setTransform`／`clearRect` から始めて全体を描き直し、`restore` で終わります。タイマー・乱数・CSSアニメーション・前フレームの積み重ねは使いません。準備前に呼ばれたときは、準備後に描く Promise を返します。
- `window.motionConfig = {duration: 32, fps, width, height, posterTime: 31, audioEvents: []}`。`window.renderConfig` の幅・高さ・fps を初期化時に反映し、高さが幅以上なら縦の配置、そうでなければ横の配置を、その寸法に合わせて描きます（720×1280 と 1280×720 が設計寸法）。
- `window.motionReady` は17件の照合と `document.fonts.ready` の後に解決します。状態は `window.motionState`（`loading`・`ready`・`error`）、`<html data-motion>`、エラー文は `window.motionError` でも読めます。
- `window.__MOTION_RENDER__` が真のときは、編集画面の操作を作らず、再生用のタイマーも動かさず、Canvas だけを原寸で画面に置きます。
- フォントは OS のもの（ヒラギノ、游明朝・游ゴシック、メイリオなど）だけを使います。別の OS では文字の形と幅が変わることがあります。外部フォント・CDN・外部への通信はありません。

## 編集する（例：場面の秒を動かす）

1. `video.js` の `KEYS`（配置が整う秒と移動の秒）、`params()`（門・節・行などの秒）、`drawTokens()`（紙札の秒）、`SCENES` と `D.titles`（見出し）をそろえて直します。
2. 配置は `P`（縦）と `L`（横）の `s0`〜`s7` にあります。`[x, y, 幅, 高さ, 不透明度]` の順です。
3. `storyboard.json` の `scenes` と `persistentShapes` を同じ秒に直します。
4. 編集画面で該当の秒へ移動し、縦と横の両方で文字の収まりを見ます。映像に出す値を増やすときは `build()` で照合済みのデータから取り出し、`storyboard.json` の `sourceFields` に出どころを書き足します。値を直接書き込まないでください。

## 書き出し（制作側の手順）

必要なもの：Node.js 20以上、Python 3、Google Chrome、FFmpeg と ffprobe。作例フォルダで実行します。

```bash
npm ci --ignore-scripts --no-audit --no-fund --prefix tools/motion-reel
python render-visual.py --out ../crawl-review-portrait --width 720 --height 1280 --strip-at 11.5
python render-visual.py --out ../crawl-review-wide --width 1280 --height 720 --strip-at 16.9
```

- `render-visual.py` は作例フォルダ直下のラッパーです。作例を一時フォルダへ複製し、`video/index.html` を入口（`<base href="video/">`）にして同梱の `tools/motion-reel/render.mjs` へ寸法と動画書き出しの指定を渡します。30fpsは映像の設定から読みます。音声の指定はしません。`--stills-only` を付けると代表・連続フレームと同時刻の描画一致だけを確認できます。
- 出力先は作例フォルダの外の空フォルダにしてください。既存の出力は上書きしません。
- 素材は `video.js` の場所から `../` の相対パスで読みます。そのため `index.html` には `<base>` を書いていません。
- 公開先の名前は縦が `media/crawl4ai-example.mp4`（ポスター `crawl4ai-example.webp`）、横が `media/crawl4ai-example-wide.mp4` です（作例ページの `<video>` がこの名前を読みます）。

## 確認の状態

Opusの編集原本を受領した時点では、描画・再生・操作の検査は未実施でした。原本と制作側の補正を分けて保存し、書き出し後の確認範囲を [visual-verification.json](../visual-verification.json) に記録しています。`storyboard.json` の `remaining` は原本受領時点で制作側へ渡した確認項目です。自動検査やエージェントの目視を、人による審美的承認や実機iOSの確認とは扱いません。

## この図解が示さないこと

- 新しい取得・ライブの取得。描いているのは、制作担当が手元の `127.0.0.1` で配った架空の3ページと存在しない1ページに対して実行し、保存した4回の `arun` の結果です。
- 公開Webの取得、リンクの巡回、検索、Crawl4AI Cloud、APIキー、言語モデルによる推論や要約。いずれも使っていません。「要点」は `p.keypoint` の原文そのままです。
- 速さ、ほかのサイトでの動作や精度、外部への通信が無かったこと（手元のサーバーの記録は外部ホストへの通信を観測しません）、隔離の保証。
- Crawl4AI 全体の設計。4つの部品は今回のAPI利用を説明する整理です。

## 出典とライセンス

- この図解の構成・文字・コード：MIT License、Copyright (c) 2026 Studio Yebisu（[../LICENSE](../LICENSE)）。編集ソースは Claude Opus 5.5（`claude-opus-5-5`）が作成しました。
- 入力の架空の手順書（`../fixture/`）と `../workflow.py`：Studio Yebisu のオリジナル（MIT License）。
- 書き出しに使う Motion Reel レンダラー（`../tools/motion-reel/`）：MIT License（[../tools/motion-reel/LICENSE](../tools/motion-reel/LICENSE)）。
- Crawl4AI 0.9.5：Apache License 2.0 に、末尾の帰属表示の追加条件（Attribution Requirement）が付いています（[../vendor/crawl4ai/LICENSE](../vendor/crawl4ai/LICENSE)・[../NOTICE.txt](../NOTICE.txt)）。原典：[unclecode/crawl4ai @ 6192d5e5b59cb21f9ca418fd6b798de47c0741d3](https://github.com/unclecode/crawl4ai/tree/6192d5e5b59cb21f9ca418fd6b798de47c0741d3)
  - This product includes software developed by UncleCode (https://x.com/unclecode) as part of the Crawl4AI project (https://github.com/unclecode/crawl4ai).
  - This project uses Crawl4AI (https://github.com/unclecode/crawl4ai) for web data extraction.
- Crawl4AI 本体・依存パッケージ・ブラウザーは同梱していません。
