# 動く説明図の編集ソース — 点数と根拠を、ひとつの図で。

Ragas 作例（`../README.md`）の保存済みの採点結果を、32秒・無音・30fps（960フレーム）の動く説明図にする編集ソースです。縦 720×1280 と横 1280×720 は、それぞれ別に組んだ配置で描きます（拡大縮小や黒帯ではありません）。

```text
開いた資料の本 → 変更前・変更後の回答の紙 → 3つの測る道具（同じ文字・文字の近さ・全文を含む）→ 値の札 → 保存できる1問
                └ 本に挟んだ付箋「照合メモ（入力）」（道具にはつながらない別の枝）
```

画面録画でも、Ragas の画面の再現でもありません。本・紙・櫛・物差し・袖・カードは Studio Yebisu が独自に作った説明図で、Ragas の公式の画面やロゴは使っていません。図に出る問い・参照文・回答の断片・時刻・値・照合メモのラベルは、保存済みの採点結果から読みます。映像の中で Ragas・Python・AI は動かず、点数を計算し直すこともしません。音声はありません（`audioEvents: []`、音声トラック・ナレーション・字幕トラックなし）。

## ファイル

| ファイル | 内容 |
| --- | --- |
| `index.html` | 編集・確認用のページ。映像、再生・一時停止・先頭へ・時刻のつまみ、6場面へのジャンプ、素材7件の照合結果、出典と映像に出る4問の全文 |
| `video.css` | ページの見た目（端末のフォントだけ。CSS アニメーションなし） |
| `video.js` | 素材の照合と、任意の時刻の1枚を描く処理（`window.seek`） |
| `storyboard.json` | 場面ごとの時刻・伝えること・図の部品の同一性・入り方と出方・縦横の配置・使う記録・限界 |
| `assets/` | 制作側が固定した素材7件と `manifest.json`（変更しません） |

## 映像の中身

| 秒 | 見出し（`timeline.json`） | 使う記録 |
| --- | --- | --- |
| 0–5 | 同じ問いを、3つの物差しへ | 本・2枚の紙・3つの道具・カードの全体図。Q07 変更後の紙の縮小版が道具を通り、0・0.969・0 |
| 5–11 | 一文字でも、期限は変わる | Q07。本の時計（18時）の写しが変更後の紙の時計（19時）へ降り、1時間分の扇形。0・0.969・0。付箋は「資料と矛盾」（入力） |
| 11–17 | 全文を含んでも、追記は残る | Q08。資料の全文は袖に収まり全文を含むは1、足した1文の別紙は袖の外。0・0.581・1。付箋は「根拠のない追記」（入力） |
| 17–23 | 言い換えると、一致は0 | Q05。本の3つの札（予約なし・1回・7日間）から言い換えの「予約がない」「1度」「7日」へ暖色の点線。0・0.286・0。付箋は「資料と合う」（入力） |
| 23–27 | 同じ文字になれば、1 | Q01。変更前（9時）の 0・0.889・0 から、変更後（10時）の 1・1.000・1 へ |
| 27–32 | 点数と根拠を、持ち帰る | Q07 の全体図と値、作例ページの「この問いをJSONで保存」の案内。最後の2.5秒は止まった画面 |

- 値は `assets/evaluation.json` の `rows[].before.scores`・`rows[].after.scores` をそのまま使います。文字列の近さだけ小数第3位まで丸めて表示します（保存値は丸めていません）。
- 紙の断片（例：`…前日19時まで…`）は `video.js` の `VIEWS` に書いてあり、読み込み時にすべてが保存した参照文・回答の一部であることを確かめます。`…` は前後を省いた印です。全文は確認用ページの「素材と出典」で読めます。
- 付箋の照合メモは制作担当が入力に書いたもので、道具（指標）の判定でも LLM judge でも人による承認でもありません。Q08 の追記は「資料に根拠がない」という入力で、偽と自動で判定したものではありません。
- 0 を不合格、1 を合格として色分けしていません。道具の色（コバルト・ティール・オーカー）は道具の区別だけです。
- 変更前・変更後は意図して用意した2組の固定回答です。実際のシステムやモデルを直した記録ではありません。

## 素材（7件・固定）

`video.js` は `assets/manifest.json` を読み、その SHA-256 が固定値 `2543fb265ff55dafe5a70b8895c6c4d7fbfd4d3d5d1ce99656a5f4f8caf4b20e` と一致し、並ぶ7件が `video.js` の固定値と同じかを確かめてから、各素材のバイト数と SHA-256 を照合します。

| ファイル | 元 | SHA-256 |
| --- | --- | --- |
| `evaluation.json` | `outputs/evaluation.json` | `b3862890b1ee0d48ebad9991cc99310730cbc3769e4717fdd2e4678348c91ea3` |
| `faq-pairs.json` | `input/faq-pairs.json` | `d55fcce5eec82974b01d912dcf6f21de94aede03c37d2a16092b6fa9304705a2` |
| `metric-source.py` | `vendor/ragas/src/ragas/metrics/collections/_string.py` | `9935e46a0a048d4d5a7790abfd0d20c38909231da34b1aab5da5268758b00230` |
| `original-verification.json` | `verification.json`（前の版の記録） | `bd1d6d44521bd44eb106ef21e070b396814a0068515b8a69b52c7ef70d54a504` |
| `upstream.json` | 原典の情報 | `39641a2e0be9f97e6943e4d77b5013767486ce6cf03bf5dbbc94a12a83efa79d` |
| `diagram-data.json` | 元の結果を図用に写した値 | `96ddc83082b8c0beff94f5d5f0da73a90e9e14be52dae3b050e8a531141ea075` |
| `timeline.json` | 時刻表（6場面） | `96dfe78632370f4a13891da7c0a1a510f64d84aa2d5a18a0c313e8af898dc683` |

照合のあと、さらに次を確かめます。1つでも違えば `window.motionReady` は失敗し、映像を隠して操作を止め、短い理由と「もう一度読み込む」だけを出します。代わりのデータは持っていません。

- 入力：形式 `studio-yebisu-faq-fixture-v1`・架空・資料 D01〜D10・問い Q01〜Q10、参照文が資料の本文と同じ、20回答と照合メモの形
- 結果：形式 `studio-yebisu-ragas-result-v1`・固定コミット `298b68274234c060deacab3cf5fb52aa3a20e885`・`input_sha256` が入力と同じ・`ragas.metrics.collections` の60回の呼び出し・採点中の通信の試み0件・利用状況の送信停止・Python 3.12.9・rapidfuzz 3.14.6・手元の版名 `0.0.0+studio.298b68274234`（正式なリリース番号ではない）・3指標の定義と0〜1の範囲・10資料と20回答とメモが入力と同じ・各値の範囲（完全一致と包含は0か1）・平均と件数（4→7・4→8・近さの平均 0.7884922267275208→0.8835109447004609）と照合メモのラベル数が各問と合う
- `metric-source.py`：文字として読み、ExactMatch・StringPresence・NonLLMStringSimilarity の実装の行があることだけを確かめます。ブラウザーで Python を実行しません。
- `upstream.json`：原典・Apache-2.0・`_string.py` のハッシュが素材と同じ
- `original-verification.json`：前の制作での実行記録（60回・入力と結果のハッシュ・独立した照合20件が保存値と同じ・237ファイル・93パッケージ・人による承認なし）。ここにある映像とブラウザーの確認は前の版のもので、この映像の確認としては扱いません。
- `diagram-data.json`：集計・ラベル数・指標・資料・10行・照合メモの出所が結果と同じ、焦点（Q07/Q01 の時刻、Q08 の追記、Q05 の3条件）が保存した文字列と合う
- `timeline.json`：32秒・30fps・960フレーム・無音・6場面の時刻と問い

## 確認用ページの使い方

site フォルダー（`index.html` のある場所）で静的なサーバーを起動し、ブラウザーで開きます。

```text
python -m http.server 8000
http://localhost:8000/video/              縦 720×1280
http://localhost:8000/video/?layout=wide  横 1280×720
```

`file://` で直接開くと素材を照合できないため、理由だけを表示します。ページは止まった状態で始まり、再生は「再生」を押したときだけです。つまみや場面のボタンで時刻を動かすと一時停止します。「先頭へ」は0秒、最後まで進むと「もう一度再生」で0秒から再生します。素材が合わないときは映像を隠し、理由と「もう一度読み込む」を出します。

## 書き出し（再現の手順）

公開されている site フォルダーを直接使わず、コピーした別のフォルダーで行い、出力は site の外の新しい空のフォルダーへ書きます。Node.js 20 以上、Google Chrome、FFmpeg と ffprobe が必要です。同梱の Motion Reel レンダラー（`../tools/motion-reel/`、MIT License）の依存は、最初に1回だけ入れます。

```text
npm ci --ignore-scripts --no-audit --no-fund --prefix <コピー>/tools/motion-reel
python <コピー>/render.py --out <空のフォルダー>/tall --width 720 --height 1280
python <コピー>/render.py --out <空のフォルダー>/wide --width 1280 --height 720
```

`render.py` はソースを一時フォルダーへ写し、`video/index.html` を入口にしてレンダラーを呼びます。出力先がソースの中にある場合や空でない場合は止まり、既存の書き出しを上書きしません。レンダラーを直接使う場合：

```text
node <コピー>/tools/motion-reel/render.mjs --project <コピー>/video --out <空のフォルダー>/tall --video --width 720 --height 1280
node <コピー>/tools/motion-reel/render.mjs --project <コピー>/video --out <空のフォルダー>/wide --video --width 1280 --height 720
```

- レンダラーは `window.__MOTION_RENDER__` と `window.renderConfig`（幅・高さ・fps）を渡します。`video.js` はそのサイズの配置を選び、操作部品と再生用のタイマーを止め、canvas だけを正確な大きさで描きます。
- `window.motionReady` は、フォントの準備と7素材の照合が終わってから完了します。照合に失敗すると reject され、代わりの絵は描きません。
- `window.seek(秒)` は、呼んだ順番や壁時計・乱数・前のフレームに左右されず、その時刻の完成した1枚を描きます。
- 外部への通信・外部のフォント・CDN・画像は使いません。
- `posterTime` は31秒（Q07 の全体図と保存の案内が止まった画面）です。
- 公開する MP4 の置き場所は作例のページから `../../media/ragas-example.mp4`（縦）と `../../media/ragas-example-wide.mp4`（横）です。書き出し・確認・配置は制作側が行います。

## 原典と版

- Ragas：[vibrantlabsai/ragas](https://github.com/vibrantlabsai/ragas/tree/298b68274234c060deacab3cf5fb52aa3a20e885) の固定コミット `298b68274234c060deacab3cf5fb52aa3a20e885`。同梱の原典8ファイルは `../vendor/ragas/`（改変なし）。
- 採点は前の制作で、未改変の固定版を Python 3.12.9（93パッケージ固定）の環境に入れ、`ExactMatch`・`NonLLMStringSimilarity(distance_measure=DistanceMeasure.LEVENSHTEIN)`・`StringPresence` の `await metric.ascore(reference=..., response=...)` を20回答に各1回、計60回呼んだものです。LLM・埋め込み・APIキー・アカウント・有料API・検索・生成は使っていません。
- 試していないこと：Ragas の LLM を使う指標、検索の評価、実際の RAG システム、モデルの比較、実機の iOS。

## 作った人と動かしたもの

このフォルダーの5ファイル（`index.html`・`video.css`・`video.js`・`storyboard.json`・この README）と説明図の部品・動きは、Claude Opus 5.5 が今回あらたに書きました。`assets/` の7素材は制作側が固定したものです。架空の入力と照合メモは制作担当が用意し、実際の採点は前の制作で制作側が行いました。今回の映像のために指標・モデル・API を動かし直してはいません。前の版の28秒の映像は別の制作物で、この映像ではありません。

## 確かめたこと・まだのこと

このソースを書いた時点では、ブラウザーでの表示、書き出し、フレームの確認、MP4 の再生、実機での表示はどれも行っていません。それらと包装・公開は制作側が別に行い、結果は制作側の記録に残します。人による承認、実機の iPhone Safari・VoiceOver の確認も、このソースでは主張しません。

## 利用条件

- この映像ソース・作例のコード・文章・架空の入力：MIT License（Copyright (c) 2026 Studio Yebisu、`../LICENSE`）。
- Ragas：Apache License 2.0、Copyright [2023] [Vibrant Labs]。全文は `../vendor/ragas/LICENSE`。
- Motion Reel のレンダラー：MIT License（`../tools/motion-reel/LICENSE`）。依存（Playwright など）はそれぞれの利用条件に従います。


## 制作側の確認

受領した8ファイルの原本は非公開で保存しました。制作側の修正範囲は../verification.jsonに記録しています。原典APIの再実行はしていません。元の60指標値と19runtime/vendor/input/outputを保持しています。

縦720×1280・横1280×720、32秒/30fps/960フレーム、音声ストリーム0として書き出しました。任意時刻の一致、代表・連続フレーム、コンタクトシート、スマホ幅の図と操作、全デコード、両MP4の最後までの再生、7素材の照合と失敗復旧を確認しています。これはエージェントによる技術確認で、人の承認や実機iPhoneでの確認ではありません。
