# 編集動画：3ページを選び、元の段落を取り出して保存する（28秒・無音）

Crawl4AI を初めて見る人に向けた短い説明動画の**編集ソース**です。伝えたいことは1つです：**3ページを選び、元の段落を取り出して Markdown と JSON に保存する。404 は受理に数えない。**

| 時刻 | 場面 | 見せること |
|---|---|---|
| 0–4秒 | 1 依頼 | 指定した3ページ（図）と、保存先の2ファイル |
| 4–9秒 | 2 取り方 | `css_selector` `main#guide`・`baseSelector` `article.doc-section`・`h2`→`heading`・`p.keypoint`→`keypoint`。AIの要約ではない。`arun` は4回（文書3・存在しないURL1） |
| 9–15秒 | 3 取り出した節 | 準備のページの実際の2節（見出しと要点）と、実際のビューアのカード2枚。受理3/3・節6 |
| 15–19秒 | 4 JSを待つ | ソースの節は1、約0.4秒後に `dynamic-export.js` が1節を足し、`wait_for` の後に取り出した節は2。足された節「書き出す前に確かめる」 |
| 19–23秒 | 5 404 | `/docs/missing.html` は HTTP 404・`success: true`・受理しない。文書の受理は3/3のまま |
| 23–28秒 | 6 保存した結果 | 保存した3行と取得エラー1行、範囲、サーバー記録、版と固定コミット、実際のビューア（スマートフォン幅） |

3ページの紙が28秒を通して画面に残り、入力の図 → 構造の列 → 上の帳 → 保存した結果の行と形を変えて、ページ・節・ファイルをつなぎます。左下には常に「架空のローカル文書／保存結果から編集／無音」と出ます。

| 項目 | 値 |
|---|---|
| 尺・サイズ | 28.0秒、1280×720、30fps（840フレーム） |
| 音 | **なし**（`audioEvents: []`。効果音・音楽・ナレーションなし） |
| ポスター | 13.5秒（「3 取り出した節」が出そろった場面） |
| 制作段階 | 編集ソース（書き出し前・制作側の確認待ち）。MP4 はまだありません |
| 編集ソース | `index.html`（プレビュー）、`video.js`（描画）、`video.css`、`storyboard.json`（ブリーフ・場面・値の出どころ・素材・範囲・残りの確認） |

## 素材

連続した画面録画ではなく、保存済みの実行結果と実際の画面から編集した動画です。使うのは作例フォルダの次のローカルファイルだけで、外部のフォント・画像・ライブラリ・通信はありません。

| ファイル | SHA-256 | 使い方 |
|---|---|---|
| [../outputs/runs.json](../outputs/runs.json) | `0b932f3a…18f5` | 全ての文字・数値・セレクター・節の文。元のHTMLの節の数とJSの待ち時間は、この中の入力ファイルの写しから数える |
| [../outputs/result.md](../outputs/result.md) | `aba3649b…16e6` | 映像には描かない。保存したファイルとして名前を示すため、実在と一致だけを確かめる |
| [../samples.json](../samples.json) | `a1fda4dc…3377` | 取得エラーが受理されていないことの照合と、保存したファイルとしての名前 |
| [../assets/screen-start.png](../assets/screen-start.png) | `af94e3a8…cb9c` | 3：準備のページのカード2枚 |
| [../assets/screen-export.png](../assets/screen-export.png) | `85282c68…5007` | 4：書き出しのページのカード2枚（2枚目が JavaScript の追加した節） |
| [../assets/screen-missing.png](../assets/screen-missing.png) | `17e3d762…5188` | 5：判定欄（404・success・受理しない）と説明の最初の行 |
| [../assets/screen-phone.png](../assets/screen-phone.png) | `f231f447…def0` | 6：スマートフォン幅の最初の画面（保存済みの実行結果・3/3・6・404） |

- 全40桁の値は `video.js` の `FILES`・`SHOTS` と `storyboard.json` の `assets` にあります。制作側が凍結した確認済みファイルの記録から転記した値で、実行時にその記録は読みません。
- 読み込み時に、7ファイルの SHA-256、画像の寸法、`runs.json` の中の重要な事実（版0.9.5と固定コミット、スキーマとセレクター、3ページの HTTP 200・受理と各2節、`extracted_content` と `sections` と Markdown の一致、元のHTMLの節2・2・1、JSが足した節がJSにだけあること、404・`success: true`・受理しないこと、受理＝success かつ HTTP 200、サーバー記録8件・`robots.txt`・選ばないページ0件、10件の照合がすべて通過）を確かめます。さらに各場面の静止時刻で一度描き、文字が枠に収まるかを確かめます。どれかが合わないときは、エラーを Canvas と状態欄に出して操作を無効にし、`window.motionReady` を拒否します。代わりの画面や値は出しません。
- スクリーンショットは作例ビューアのネイティブ画面を同じ画素のまま PNG にしたもので、モックアップではなく、Crawl4AI 本体の画面でもありません。画像は改変せず、切り抜きと拡大縮小は描画時にだけ行います。強調枠は切り抜きの外側か、UI 要素の外側の余白に線だけを描きます。画面の小さな文字に頼らず、同じ値を横に大きく組んでいます。
- 3ページの紙（入力の図）は、`runs.json` のパスと節の数から描いた図で、スクリーンショットではありません。画面にも「入力：指定した3ページ（図）」と出します。
- 「元のHTMLにある節 1」は `export.html` のファイルに書かれた節の数です。JavaScript を止めて取得した結果ではありません。実際の取得は3ページとも `wait_for` の後の1回ずつです。

## 編集する（例：ポスターの場面の見出しを変える）

1. `video.js` の `sceneResults` にある `title('取り出したのは、元の段落そのもの')` の文字を書き換えて保存します。見出しは44px（入りきらないときは40pxまで縮む）です。40pxでも入らない文字は、読み込み時の検査で止まります。
2. 下の「プレビュー」の手順でページを開き直し、状態の欄に「準備完了」と出るのを待ちます。
3. 開発者ツールのコンソールで `window.seek(13.5)` を実行すると、その時刻の完成した画面が描かれます。`window.seek(9.0)`（紙が帳へ変形する途中）、`window.seek(15.0)`（画面の切り替え）、`window.seek(23.3)`（保存した結果への着地）も確かめます。
4. 「再生」とスライダーで通して見て、読む時間と重なりを確かめます。
5. 場面の時刻を変えたときは、`video.js` の `SCENES` と各場面の関数の秒、紙の変形の秒（`pageGeom`・`highlight`・`missingLayer`）、`CHECK_TIMES`、`storyboard.json` の `scenes` をそろえます。
6. 映像に出す値を増やすときは、`video.js` の `select()` で `runs.json` の該当フィールドから取り出し、`storyboard.json` の `facts` に出どころを書き足します。値を直接打ち込まないでください。

## プレビュー

作例フォルダ（`workflow.py` がある階層）で次を実行し、ブラウザーで開きます。

```bash
python -m http.server 8000
# http://127.0.0.1:8000/video/
```

- 準備ができると状態の欄に「準備完了」と出て、再生ボタンとスライダーが使えるようになります。自動再生はしません。動きを減らす設定のときも、13.5秒の静止画で止まったまま、ボタンを押したときだけ動きます。
- 「再生」で再生・一時停止、スライダー（0–28秒）で任意の秒へ移動できます。矢印キーで0.1秒、PageUp・PageDown で2秒、Home・End で最初と最後へ動きます。どの操作も同じ `window.seek(秒)` で描きます。28秒で止まり、もう一度「再生」を押すと0秒から始まります。
- SHA-256 の照合にブラウザーの暗号機能を使うため、`file://` や、localhost・127.0.0.1 以外の HTTP では開けません（エラーとして表示します）。

## 任意の時刻を描く約束

- `window.seek(秒)` は、その時刻の完成した画面を、前に呼んだ時刻や経過時間に関係なく描きます。呼ぶたびに Canvas の幅と高さを設定し直して内容・変換・クリップ・スタイルを初期化し、コンテキスト（`willReadFrequently: true`）を取り直してから、全レイヤーを時刻だけから描き直します。タイマー・乱数・CSSアニメーション・前フレームの積み重ねに依存せず、描画ごとの画素の読み戻しもしません。準備前に呼ばれたときは、準備後に描く Promise を返します。
- `window.motionConfig` は `{duration: 28, fps: 30, width: 1280, height: 720, posterTime: 13.5, audioEvents: []}`。`window.renderConfig` の幅・高さ・fps を初期化時に一度だけ反映します。配置は**横長16:9（1280×720）用だけ**です。ほかの寸法を渡すと同じ配置を余白つきで縮小して描き、比率ごとの再配置はしていません。
- `window.motionReady` は、データ・画像の照合とデコード・フォントの準備・文字の収まりの検査・最初の1枚の描画が終わると解決し、問題があれば拒否されます。状態は `window.motionState`（`loading`・`ready`・`error`）、`<html data-motion>`、エラー文は `window.motionError` でも読めます。
- `window.__MOTION_RENDER__` が真のときは、プレビュー用の再生を止め、操作部を隠して、画面いっぱいに Canvas だけを置きます。
- フォントは OS の日本語フォント（ヒラギノ、游明朝・游ゴシック、メイリオ、Noto など）を使います。別の OS やフォントでは文字の形と幅が変わることがあります。

## 書き出し（再現手順）

必要なもの：Node.js 20以上、Python 3、Google Chrome、FFmpeg と ffprobe。作例フォルダ（`render.py` がある階層）で実行します。

```bash
npm ci --ignore-scripts --no-audit --no-fund --prefix tools/motion-reel
python render.py --out ../crawl4ai-render-first
```

- `npm ci` はレンダラーの依存（Playwright）を `tools/motion-reel/node_modules/` に入れます。この `node_modules/` は公開する作例ソースには含めません。
- [`../render.py`](../render.py) は作例フォルダを一時フォルダへ複製し、`video/index.html` を入口にして（`<base href="video/">` を加えて）同梱の [Motion Reel レンダラー](../tools/motion-reel/render.mjs) を動かします。そのため `index.html` には `<base>` を書かず、素材は `video.js` の場所から `../outputs/…`・`../assets/…`・`../samples.json` の相対パスで読みます。
- 出力先は**作例フォルダの外の空フォルダ**にしてください。`render.py` は作例フォルダの中や空でないフォルダを拒否し、既存の出力を上書きしません。上の例は作例フォルダと同じ階層に `crawl4ai-render-first` を作ります。
- 出力には代表時刻の静止画（2秒ごと）、全体シート、ポスター（13.5秒）、連続フレーム（既定は8.1秒前後。紙の変形を見るなら `--strip-at 9.0`）、`video.mp4`（音なし）、`capture.json`、`review.html` が入ります。静止画だけを出すときは `--stills-only` を付けます。

## 確認の状態

この編集ソースを納品した時点では、ブラウザーでの読み込み、実際の描画、切り抜き位置とフレームの目視確認、MP4 の書き出しと再生、同じ時刻の再描画一致、プレビュー操作の確認は、いずれも**未実施**です（一覧は `storyboard.json` の `remaining`）。書き出しと確認は制作側が行い、その結果は書き出し後の `verification.json` に記録されます。この README や `storyboard.json` には確認結果を書いていません。人による承認でもありません。

## この動画が示さないこと

- 公開Webでの取得、リンクの巡回（deep crawl）、取得の深さ。取得したのは手元の 127.0.0.1 で配った作例用の架空の手順書3ページと、存在しない1ページだけです。
- LLM・Crawl4AI Cloud・APIキー・アカウント・支払い・プロキシ・ステルス・ボット対策の回避。いずれも使っていません。要点はAIの要約ではありません。
- 外部ホストへの通信が無かったこと。手元のサーバーの記録には外部ホストへの通信は現れないため、通信の安全性は保証しません。
- ライブの取得。作例ビューアは保存済みの結果を読むだけで、動画もライブの取得やAIの動作を描きません。
- 時刻・所要時間・速さ・品質の比較。物理的な iPhone・Safari・VoiceOver での確認。

## 出典とライセンス

- この動画の構成・文字・コード：MIT License、Copyright (c) 2026 Studio Yebisu（[../LICENSE](../LICENSE)）。編集ソースは Claude Opus 5.5（`claude-opus-5-5`）が作成しました。
- スクリーンショットに写る作例ビューアと、架空の手順書（`../fixture/`）：Studio Yebisu のオリジナル（MIT License）。
- 書き出しに使う Motion Reel レンダラー（`../tools/motion-reel/`）：MIT License（[../tools/motion-reel/LICENSE](../tools/motion-reel/LICENSE)）。
- Crawl4AI 0.9.5：Apache License 2.0（[../vendor/crawl4ai/LICENSE](../vendor/crawl4ai/LICENSE)）。原典：[unclecode/crawl4ai @ 6192d5e5b59cb21f9ca418fd6b798de47c0741d3](https://github.com/unclecode/crawl4ai/tree/6192d5e5b59cb21f9ca418fd6b798de47c0741d3)
  - This product includes software developed by UncleCode (https://x.com/unclecode) as part of the Crawl4AI project (https://github.com/unclecode/crawl4ai).
  - This project uses Crawl4AI (https://github.com/unclecode/crawl4ai) for web data extraction.
- Crawl4AI 本体・依存パッケージ・ブラウザーは同梱していません。
