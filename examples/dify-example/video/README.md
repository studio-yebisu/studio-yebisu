# 動く説明図の編集ソース — 問い合わせを、担当へ。

Dify 作例（`../README.md`）の保存済みの実行結果を、32秒・無音・30fps（960フレーム）の動く説明図にする編集ソースです。縦 720×1280 と横 1280×720 は、それぞれ別に組んだ配置で描きます（拡大縮小や黒帯ではありません）。

```text
問い合わせの封筒（種類・緊急度・人数）→ 上から順に判定する1つの切り替え → 担当の机 → まとめる → 実際の引き継ぎメモ
```

画面録画でも、Dify の画面の再現でもありません。封筒・切り替え・机・メモは Studio Yebisu が独自に作った説明図で、Dify の公式の画面・エディター・ロゴは使っていません。図に出る ID・値・✓/×・通った線・件数・メモの行は、保存済みの実行記録から読みます。映像の中で Dify・graphon・AI は動かず、新しい実行もしません。音声はありません（`audioEvents: []`）。

## ファイル

| ファイル | 内容 |
| --- | --- |
| `index.html` | 編集・確認用のページ。映像、再生・一時停止・先頭へ・時刻のつまみ、6場面へのジャンプ、素材8件の照合結果、出典 |
| `video.css` | ページの見た目（端末のフォントだけ。CSS アニメーションなし） |
| `video.js` | 素材の照合と、任意の時刻の1枚を描く処理（`window.seek`） |
| `storyboard.json` | 場面ごとの時刻・伝えること・使う記録の場所・図の部品の同一性・入り方と出方・縦横の配置・限界 |
| `assets/` | 制作側が固定した素材8件と `manifest.json`（変更しません） |

## 映像の中身

| 秒 | 見出し（`timeline.json`） | 使う記録 |
| --- | --- | --- |
| 0–5 | 問い合わせを、担当へ | 7ノード・8本の線の全体図。3つの道が順に光り、8件の実際の内訳 3件・1件・4件 |
| 5–10 | 請求なら、請求窓口へ | D02（請求・通常・1人）。判定1 ×、判定2 ✓、請求窓口のメモ |
| 10–15 | 請求でも、至急を先に | D06（請求・至急・2人）。判定1 ✓。判定2は記録上も判定されておらず、薄く表示 |
| 15–22 | 99人から、100人へ | 別の記録 D04（99人→通常窓口）と D05（100人→優先対応）。それぞれのメモを左右に並べる |
| 22–27 | 入力の文字も、そのまま | D07 の件名 `{{ 7 * 7 }}` が封筒と一緒に進み、通常窓口のメモに文字のまま入る |
| 27–32 | 実際のメモを、保存する | D05 の実際のメモ・内訳・作例ページで保存できることの案内。最後の2.5秒は止まった画面 |

- ✓/× は、route ノードの記録 `process_data.condition_results`（上から順に判定した結果）から描きます。ブラウザーで判定し直してはいません。
- 99・100 の比較は、同じ記録の `inputs.conditions` にある実際の値と比較先 `"100"` です。
- D04 と D05 は番号・件名・本文も違う別の記録です。担当を決める3項目（種類・緊急度・人数）のうち違うのが人数だけ、という比較で、1件を書き換えたものではありません。
- D02 と D06 も別の記録で、緊急度と人数の両方が違います。判定の順を示す例で、入力を編集したものではありません。
- D07 の記号は文字として描くだけです。評価も実行もしておらず、安全性の検証でもありません。本文の `<script>` の行は映像に出さず、作例ページの折りたたみで原文を読めます。

## 素材（8件・固定）

`video.js` は `assets/manifest.json` を読み、その SHA-256 が固定値 `10392562045e5c71ad4ed9154fa823c0d3eeed4378a2033ca70001b4fe097559` と一致し、並ぶ8件が `video.js` の固定値と同じかを確かめてから、各素材のバイト数と SHA-256 を照合します。

| ファイル | 元 | SHA-256 |
| --- | --- | --- |
| `workflow-runs.json` | `outputs/workflow-runs.json` | `692cc2f8b07ca77a8b3ccdae0a8abc4359e8a8804985bc4b75db1b56241e6694` |
| `tickets.json` | `input/tickets.json` | `b752f26d73d9fc3f48f8a3389fe876b88d273f2780bc316fdd15232a4d0cdc83` |
| `expected.json` | `input/expected.json` | `0ef127da5302698a91ad9ceb1e7dcbd79863c037057fe07e514428213946b5be` |
| `independent-checks.json` | `outputs/independent-checks.json` | `efc466ec2dbd4845a35277225faf419e471872892d08d747130248973f25d2f4` |
| `vendor-lock.json` | `vendor-lock.json` | `e454e2189985857c0ac82258dc23b01f0010deecc1cc7bf737ff214d685696ff` |
| `workflow.yml` | `workflow.yml`（元のバイト列） | `d36f345c08705992f654571d35676a211bcae62abcfb6171c8655b308ab0776f` |
| `diagram-data.json` | 元の記録を図用に写した値 | `971c00ea65059192ca72cf3aacf126a505c88fd4d7d5bbce2a40afb6c3114de7` |
| `timeline.json` | 時刻表（6場面） | `735073a65b9ebe6e74254ca62b286c05cc0ef866c0f1c40aca232a5130c4a0dc` |

照合のあと、さらに次を確かめます。1つでも違えば `window.motionReady` は失敗し、映像を隠して操作を止め、短い理由と「もう一度読み込む」だけを出します。代わりのデータは持っていません。

- 記録の形式、Dify の固定版（langgenius/dify `f77facfe6520ed379d723288aed0b4806ad76143`・1.17.1）、graphon 0.7.0 と wheel の SHA-256、ロックとの一致（292ファイル）
- 入力2件と DSL のハッシュが記録と同じ、通信・子プロセスの試み0件、サーバーとモデルを使っていない記録、196の自動確認の合格、イベント合計160件
- 8件の入力・分岐が `tickets.json`・`expected.json` と同じ。各件の成功したノードの順、通った線、route の判定結果、メモが担当ノードの出力と最終イベントに一致
- `workflow.yml` を文字列として読み（YAML の解析器は使いません）、7ノードの ID と種類、8本の線、判定の順 urgent → billing、`至急`・`≥`・`'100'`・`請求` の条件を確認。実行イベントに現れた線の集合が DSL の8本と一致
- `independent-checks.json` の合格・元の記録の SHA-256・内訳、`diagram-data.json` の8件とつながりが記録と同じ、`timeline.json` が32秒・30fps・960フレーム・無音・6場面

## 確認用ページの使い方

site フォルダー（`index.html` のある場所）で静的なサーバーを起動し、ブラウザーで開きます。

```text
python -m http.server 8000
http://localhost:8000/video/              縦 720×1280
http://localhost:8000/video/?layout=wide  横 1280×720
```

`file://` で直接開くと素材を照合できないため、理由だけを表示します。ページは止まった状態で始まり、再生は「再生」を押したときだけです。つまみや場面のボタンで時刻を動かすと一時停止します。「先頭へ」は0秒、最後まで進むと「もう一度再生」で0秒から再生します。

## 書き出し（再現の手順）

公開されている site フォルダーを直接使わず、コピーした別のフォルダーで行い、出力は site の外の新しい空のフォルダーへ書きます。Node.js 20 以上、Google Chrome、FFmpeg と ffprobe が必要です。同梱の Motion Reel レンダラー（`../tools/motion-reel/`）の依存は、最初に1回だけ入れます。

```text
npm ci --ignore-scripts --prefix <コピー>/tools/motion-reel
node <コピー>/tools/motion-reel/render.mjs --project <コピー>/video --out <空のフォルダー>/tall --video --width 720 --height 1280
node <コピー>/tools/motion-reel/render.mjs --project <コピー>/video --out <空のフォルダー>/wide --video --width 1280 --height 720
```

制作側の `render.py` を使う場合も、縦と横をそれぞれネイティブの幅・高さで指定し、site の外の空のフォルダーへ書き出します（引数は `python render.py --help` を参照）。

- レンダラーは `window.__MOTION_RENDER__` と `window.renderConfig`（幅・高さ・fps）を渡します。`video.js` はそのサイズの配置を選び、操作部品を隠して canvas だけを正確な大きさで描きます。
- `window.seek(秒)` は、呼んだ順番や壁時計・乱数・前のフレームに左右されず、その時刻の完成した1枚を描きます。
- 出力先が空でなければレンダラーは止まり、既存の書き出しを上書きしません。外部への通信は行いません。
- `posterTime` は31秒（D05 のメモと内訳が止まった画面）です。

## 原典と版

- Dify：[langgenius/dify](https://github.com/langgenius/dify/tree/f77facfe6520ed379d723288aed0b4806ad76143) 1.17.1（コミット `f77facfe6520ed379d723288aed0b4806ad76143`）。
- 実行に使ったのは graphon 0.7.0 の公式 wheel（SHA-256 `6f7608aaaa65607c4935735137ed4b7029b1e6ca80202cbe829af3370cf4404e`）で、Dify 1.17.1 の `api/pyproject.toml` の宣言と `api/uv.lock` の固定と同じものです。
- 実行は `graphon.dsl.inspect`・`graphon.dsl.loads`・`GraphEngine.run()`。つながりは Dify 本体の `WorkflowGraphTopology` を改変せずに使いました。これは Dify の依存を使ったヘッドレスな DSL の実行で、Dify のアプリのセッションではありません。
- 試していないこと：Dify のサーバー・管理画面・API・Docker、difyctl、Dify の画面への DSL の取り込み、モデル（LLM）・意味による分類・要約・ナレッジ・ツール・プラグイン、入力フォームの検証、速さ。

## 作った人と動かしたもの

このフォルダーの5ファイル（`index.html`・`video.css`・`video.js`・`storyboard.json`・この README）と説明図の部品・動きは Claude Opus 5.5 が書きました。`assets/` の8素材は制作側が固定したものです。元の `workflow.yml`・実行のコード・実行記録は前の制作で作られ、架空の8件は制作側が実行の前に作り、graphon のエンジンで制作側が実行しました。今回の映像のために API やモデルを再び動かしてはいません。

## 確かめたこと・まだのこと

このソースを書いた時点では、書き出し・フレームの確認・MP4 の再生・実機での表示は行っていません。それらと包装・公開は制作側が別に行い、結果は制作側の記録に残します。人による承認、実機の iPhone Safari・VoiceOver の確認も、このソースでは主張しません。

## 利用条件

- この映像ソース・作例のコード・文章・架空の入力：MIT License（Copyright (c) 2026 Studio Yebisu、`../LICENSE`）。
- Dify：Dify Open Source License。Apache License 2.0 を基に、マルチテナントの環境での運用と、フロントエンド（`web/`）のロゴ・著作権表示の変更について追加の条件があります。全文は `../vendor/dify/LICENSE`。この作例は `web/` を使わず、ロゴや画面も使っていません。
- graphon 0.7.0：Apache License 2.0。全文は `../vendor/graphon-wheel/graphon-0.7.0.dist-info/licenses/LICENSE`。
- Motion Reel のレンダラー：MIT License（`../tools/motion-reel/LICENSE`）。依存（Playwright など）はそれぞれの利用条件に従います。


## 制作側の改修確認

元の8ファイルの受領原本は非公開で保全し、制作側は条件表示の読み取りを補正しました。Graphonのinputs.conditionsは最後に判定したグループの値なので、先のグループの人数は、固定した原入力と実記録の条件・判定結果から表示します。元の実行記録は変えていません。冒頭ラベルも8件の内訳とD02の封筒の例を区別する文面へ補正しました。

その版を縦720×1280・横1280×720で32秒/30fps/960フレームとして書き出し、任意時刻の一致、代表・連続フレーム、コンタクトシート、縦のスマホ表示、全デコードと両MP4の最後までの再生を確認しました。編集画面の8素材、シーク・再生・一時停止・リセット、素材不一致での停止と再読込も確認しています。確認の要点は../verification.jsonです。人による審美的承認・実機iPhone Safari・VoiceOverは未確認です。
