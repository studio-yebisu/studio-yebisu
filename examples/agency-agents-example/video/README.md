# AIに渡す、専門家の指示書集 — 32秒・無音の図解（編集ソース・visual-r2）

Agency Agents の**役割の指示書そのもの**を主役にした動画の編集ソースです。棚から1枚の指示書（UX Architect）が出て、担当・仕事・約束・進め方・成果物・確認観点の6つの部分に開き、今回の依頼と材料と一緒にAIへ入って引き継ぎ書とCSS土台になり、それが Frontend Developer の指示書と一緒に**同じAIの2回目の入力**になって企画ガイドに至るまでを、同じ図形の動きで見せます。

- 長さ 32秒・30fps（960フレーム）。縦 720×1280 が基準で、横 1280×720 は配置を別に組みます。
- **音はありません。** ナレーション・読み上げ・効果音・音の素材・字幕の原稿はなく、`audioEvents` は空です。
- 制作済みの流れを図にしたものです。動画の中で新しいAIの実行はしていません。処理中の表示やログ、人やロボットの顔、エージェント同士の会話は描きません。
- 架空イベント「こもれび つくる日」の時間の地図は、最後に小さな成果として出るだけです（r1 の時間の帯中心の構成は置き換えました）。

## ファイル

| ファイル | 中身 |
|---|---|
| `index.html` | プレビュー画面。`../foundation.css`（元の土台・変更なし）と `video.css`・`video.js` を読み込む |
| `video.js` | 素材の確認、縦横の配置、1フレームの描画、`window.seek`・`window.motionConfig`・`window.motionReady`、プレビューの操作 |
| `video.css` | プレビュー画面と、書き出し時（`.is-render`）の画面いっぱいのキャンバス |
| `storyboard.json` | 場面ごとの伝えること・入る状態・動き・出る状態・使う実ファイル、ずっと残る部品の一覧 |

`assets/` にある8ファイルと `assets/manifest.json` は r1 の素材で、この visual-r2 の `video.js` は読み込みません（消さずに残しています）。

## 使う素材（固定の SHA-256 で確かめる）

`video.js` は図のページと同じ `../concept/manifest.json` を読み、SHA-256 が

```text
522efc56d1f288949d12c156ff913a83634b7015442c1f19c0a6b9722ddefae8
```

と一致することを確かめてから、記載の11ファイルを `../` を付けたパスで読み、それぞれのバイト数と SHA-256、形を確かめます。どれか1つでも違えば、キャンバスを消して理由と「もう一度読み込む」を出し、操作を止め、`window.motionReady` を reject します。「もう一度読み込む」は実際に11ファイルを取り直します。内蔵の代わりのデータはありません。

| 素材（作例のフォルダーから） | バイト数 | 動画での使いみち |
|---|---:|---|
| `concept/structure.json` | 5941 | 6つの部分の見出し・節・意味、2つの役割の名前・短い名前・ファイル、各部分の原文の抜粋と今回の適用、入力ファイル、成果の説明、編集上の注記、実行の記録（同じ Opus 5.5） |
| `vendor/agency-agents/README.md` | 86245 | 棚に並べる役割ファイルの実際の名前（design/ と engineering/ の先頭5件ずつ）。「Option 3: Use as Reference」の節があること |
| `vendor/agency-agents/design/design-ux-architect.md` | 16260 | `name:` と、structure.json の6つの原文の抜粋・節名が実在すること |
| `vendor/agency-agents/engineering/engineering-frontend-developer.md` | 9283 | 同上 |
| `input/event.json` | 3997 | 架空であること、6企画のID・時刻（企画ガイドの小さな時間の地図）、題名 |
| `outputs/ux-handoff.json` | 35054 | 順に当てた記録・固定コミット・同じイベント。1回目の成果物の一覧が structure.json と一致すること |
| `foundation.css` | 19090 | 3つのテーマの記述。色そのものは読み込んだ CSS のライトのトークンから取る（CSS土台の5色の見本） |
| `outputs/implementation.md` | 33045 | A09 を採用しなかった記録があること |
| `outputs/browser-itinerary.json` | 3000 | 保存した予定の S01・S03・S05・S06・4企画・1,000円（入力の企画と照合） |
| `request.txt` | 4300 | 2つの役割と固定コミットが書かれた依頼文であること |
| `vendor/agency-agents/LICENSE` | 1079 | 出典の行の MIT と著作権表示 |

書体は端末の日本語書体（foundation.css の `--font-sans`・`--font-serif`・`--font-mono`）で、外部のフォント・画像・通信は使いません。

## 場面と時刻

| 秒 | 場面 | 伝えること |
|---|---|---|
| 0–4 | 指示書集 | README の一覧から10枚の紙の棚。UX Architect の1枚が前へ出て、ほかは小さな棚に残る。見出し「AIに渡す、専門家の指示書集」 |
| 4–10 | 中身 | 同じ紙が6つの帯に開く（見出し＋今回の適用）。「仕事」「成果物」を順に強調し、原文の節と英語の抜粋を出す。6項目は制作担当の整理で全役割の形式ではないことを注記 |
| 10–13 | 渡す | 帯が細い線へたたまれ、紙が「今回の依頼と材料」と一緒にAIへ合流。右上に「制作済みの流れを図解」 |
| 13–16 | 成果物 | AIから引き継ぎ書とCSS土台（実際の色トークン）が出る |
| 16–23 | 次の実行 | 同じ部品が2回の実行の図へ組み替わる。Frontend Developer の紙が棚から出て、引き継ぎ書とCSSが同じAIの2回目の入口へ運ばれ、企画ガイドと「保存した予定 4企画・1,000円」が出る |
| 23–28 | 全体 | 図を少し引き、「役割を選ぶ → 依頼と渡す → 成果を確かめる」。光が道を1回だけ通る |
| 28–32 | 作例へ | 「実際の作例を触る →」と「架空のイベント作例／AI実行は制作時」。28.8秒以降は止まった1枚 |

各場面の入る状態・動き・出る状態・使う実ファイルは `storyboard.json` にあります。

## 時間の契約（Motion Reel）

- `window.motionConfig = { duration: 32, fps, width, height, posterTime: 31, audioEvents: [] }`
- `window.renderConfig` の `width`・`height`・`fps` を起動時に反映します。高さが幅より大きければ縦、そうでなければ横の配置です。指定がなければ縦 720×1280。プレビューでは `?format=portrait` で縦、`?format=wide` で横になります。
- `window.motionReady` は、11の素材の確認・色と書体のトークンの読み込み・`document.fonts.ready` のあとに解決します。
- `window.seek(秒)` は 0〜32 の任意の時刻の完成した1枚を、その時刻だけから描きます。乱数・壁時計・前のフレームを使わず、毎回 `ctx.save()`／`ctx.restore()` でまるごと描きます。準備前に呼ばれた場合は Promise を返します。
- `window.__MOTION_RENDER__ === true` のときは操作部を出さず、プレビュー用のタイマーを動かしません。
- 28.8秒以降は何も動きません。ポスターは31秒。

## プレビュー

作例のフォルダー（この `video/` の1つ上）で HTTP サーバーを立てて開きます（SHA-256 の計算に localhost か HTTPS が必要です）。

```text
python -m http.server 8863 --bind 127.0.0.1
```

`http://127.0.0.1:8863/video/index.html` を開きます。最初は止まっています。「再生」「最初へ」「最後へ」「もう一度再生」、再生位置の帯、7つの場面ボタンで操作でき、最後まで再生すると止まります（くり返しません）。開発者ツールでは次のように1枚を描けます。

```js
await window.motionReady;
window.seek(31);
```

## 書き出しの手順（制作担当）

Opus 5.5 が執筆した時点では、描画・フレームの確認・MP4 の書き出し・QA は行っていません。制作担当がこのあとで行います。

作例のフォルダーで、同梱の Motion Reel のレンダラーを `render-visual.py` から使います。大きさを明示し、出力は毎回別の空のフォルダーに置きます。音の指定は付けません。

```text
npm ci --ignore-scripts --no-audit --no-fund --prefix tools/motion-reel
python render-visual.py --out ../rendered-portrait --width 720 --height 1280 --strip-at 19.6
python render-visual.py --out ../rendered-wide --width 1280 --height 720 --strip-at 19.6
```

最初の npm コマンドは依存がない場合だけ必要です。`render-visual.py` は使い捨ての写しを作り、`<base href="video/">` を入れた入口から描くので、`../concept/manifest.json` などのパスは作例のフォルダーを指します。`--strip-at 19.6` は引き継ぎ書とCSSが2回目の入口へ運ばれる速い動きの連続フレームです。

残る確認（未実施）：縦横それぞれの任意時刻の描画とフレームの一致、コンタクトシートでの読む順序と文字の大きさ（375px 幅のスマホで縦動画の主なラベルが読めるか）、実際の MP4 の再生と音声ストリームがないこと、32秒で終わること、ポスターの書き出し。人による視聴と承認も未確認です。

## 出典と条件

- 役割ファイル: [msitarzewski/agency-agents](https://github.com/msitarzewski/agency-agents/tree/bd956db032d907387e6b9ddebff3e18f1de8c679)（固定コミット `bd956db032d907387e6b9ddebff3e18f1de8c679`、MIT、Copyright (c) 2025 AgentLand Contributors）。コミュニティ作成のもので、Anthropic 公式ではありません。README の「Option 3: Use as Reference」の使い方です。
- 2つの役割は、同じ Claude Opus 5.5 を別々の実行で順に当てたもので、ファイルは制作担当が渡しました。この動画の編集ソース（visual-r2）は、そのあとの別の Claude Opus 5.5 の実行で書いたもので、元の入力・成果物を書き換えていません。
- 6つの部分は、この2つの原典を制作担当が説明用に整理したもので、全役割に共通する形式ではありません。成功指標は目標で、この作例で達成を測った結果ではありません。
- UX Architect の役割ファイルが参照する `ai/agents/architect.md` と `ai/memory-bank` は固定版になく、内容を補っていません。
- 描画のしくみは Motion Reel の時間の契約（Studio Yebisu、MIT）に沿っています。この作例のコードと文章は MIT License（Copyright (c) 2026 Studio Yebisu）です。
