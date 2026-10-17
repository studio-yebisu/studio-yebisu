# 同じ書き出し、違う続き。（32秒・無音の図解）

保存済みのCPU実行（[FareedKhan-dev/train-llm-from-scratch](https://github.com/FareedKhan-dev/train-llm-from-scratch/tree/bdd480a518094ca834e05ab32131dc126b522d3d) 固定コミット bdd480a、MIT）の結果を説明する、編集できる動画ソースです。自作の英文96行 → 学習側だけのBPE → 同じ初期値から0回更新と800回更新の2つのモデル → 同じ書き出しの保存済みの続き → JSONの記録、を1枚のつながった図のまま動かします。

- 32秒・30fps・960フレーム。縦720×1280が主、横1280×720は別に組んだレイアウトで描きます（どちらも余白の帯なし）。
- 音はありません。ナレーション・読み上げ・字幕の書き起こし・音声トラック・ミュート操作もありません。`motionConfig.audioEvents` は空です。
- 続きの文は、この作例で学習した小さなTransformerが保存した出力です。この動画ソースは学習も生成もしません。ループや歯車、動く部品は概念の動きで、確率・注意の重み・重みの推移・トークンごとの対応・学習バッチの記録ではありません。

## ファイル

| ファイル | 内容 |
| --- | --- |
| `index.html` | 編集画面（再生・一時停止・最初へ・位置のスライダー・6つの場面ボタン・素材の確認表示） |
| `video.css` | 編集画面と書き出し時の表示 |
| `video.js` | 素材の確認と Canvas への描画。`window.seek(t)`・`window.motionConfig`・`window.motionReady` |
| `storyboard.json` | 描く物・出入りの時刻・配置・データの出所・制限 |
| `assets/` | 固定した9つの素材と `manifest.json`（読むだけ。書き換えない） |

## 開き方

`video/` の1つ上（作例のフォルダ）で静的なHTTPサーバーを起動し、`video/index.html` を開きます。SHA-256を確かめるため、`file://` ではなく `localhost` か HTTPS で開いてください。

```bash
python -m http.server 8866
```

ブラウザーで `http://localhost:8866/video/index.html` を開きます。

- 開いた直後は **一時停止** で、0秒の画面です。「再生」で再生し、最後まで行くと止まります（もう一度押すと最初から）。
- 位置のスライダー（文字16px）や場面ボタンで動かすと再生は止まります。場面ボタンは各場面の開始0.4秒後（見出しが出た状態）へ移ります。「最初へ」は0秒です。
- 素材の状態は「9/9 素材を確かめました」のように表示されます。

## 素材の確認と失敗したとき

描く前に、`assets/manifest.json` の生のバイト列のSHA-256を固定値 `06c12f34ace165c708b26afad72cc513da2c8407d636dcf5712e307099b612e9` と比べ、manifest に並ぶ9つの素材のバイト数とSHA-256をすべて確かめます。そのうえで次を照合します。

- `training-run.json` が保存済みの実行記録（`c2a688ba…c39e0`）で、入力3つ（`stories.txt`・`prompts.json`・`run-config.json`）が固定値と一致すること。
- 記録の形式・原典48ファイル・確認44項目・P01〜P08の8件・英文96行（学習83行・検証13行、検証13行はすべて学習側にもある）・語彙417・135,552パラメータ・0回と800回・保存点0/200/400/600/800。
- `independent-checks.json` の16件の全文SHA-256を、記録の全文から計算し直して一致すること。
- `diagram-data.json` が記録と英文の写しであること、`timeline.json` が32秒・30fps・960フレーム・無音・6場面で、場面の時刻と入力が決めたとおりであること。
- `original-verification.json` は以前の28秒の動画の確認記録です。原典の固定コミットだけを照合し、この動画の確認としては扱いません。

`stories.txt` は文字列として読むだけで、データやPythonを実行しません。どれか1つでも読み込めない（HTTP 404・503 など）、JSONとして読めない、ハッシュやバイト数が違う場合は、図を消して隠し、操作を無効にし、実際の理由と「もう一度読み込む」（ページを読み直す）だけを出します。代わりのデータは使いません。

## 時間の契約

- `window.motionConfig = { duration: 32, fps: 30, width: 720, height: 1280, posterTime: 31, audioEvents: [] }`。`window.renderConfig` の `width`・`height`・`fps` があればそれを使い、横長なら横のレイアウトで描きます。
- `window.seek(t)` は、時刻 t だけから完成した1枚を描きます。呼ぶ順番・壁時計・乱数・前のフレームには依存しません。
- `window.motionReady` はフォントの準備と9素材の確認が終わると解決し、確認に失敗すると理由付きで失敗します。
- `window.__MOTION_RENDER__` が真なら、編集画面の部品とタイマーを止め、Canvas だけを指定の大きさちょうどで表示します。CSSアニメーションは使っていません。
- 最後の2.5秒（29.5秒〜）は止まった画面です。ポスターは31秒。

## 書き出し

作例のフォルダにある `render.py` が、同梱の `tools/motion-reel/render.mjs` で書き出します。`render.py` はソースを一時フォルダへコピーし（ソースの中には書きません）、`video/index.html` をその入口にします。出力先はソースの外の、空のフォルダにしてください。

```bash
# 縦（主）
python render.py --out ../renders/train-llm-vertical --width 720 --height 1280
# 横（別レイアウト）
python render.py --out ../renders/train-llm-wide --width 1280 --height 720
# 静止画と確認用の資料だけ
python render.py --out ../renders/train-llm-stills --stills-only
```

必要なもの：Node.js 20 以上、Chrome（または導入済みの Playwright Chromium）、FFmpeg と ffprobe。初回のみ `tools/motion-reel/` で `npm install --ignore-scripts` を行います（`package.json`・`package-lock.json` 同梱。依存の導入にはネット接続が要ります）。レンダラーはローカルの素材だけを読み、外部への通信は遮断します。

この README を書いた時点で、書き出し・ブラウザーでの表示確認・人による確認・実機iOSでの確認は、この制作担当では行っていません。それらは別の工程で行い、結果は別に記録されます。

## ライセンス

- 図・コード・文章：MIT License（Copyright (c) 2026 Studio Yebisu）。
- 原典：FareedKhan-dev/train-llm-from-scratch、MIT License（Copyright (c) 2025 Fareed Khan）。原典のロゴ・画面・画像は使っていません。外部のフォントやCDNも使っていません。


## 制作側の確認

受領した8ファイルの原本は非公開で保存しました。制作側の修正範囲は../verification.jsonに記録しています。元の58runtime/vendor/input/outputとCPU学習・16出力は保全し、再学習・再生成はしていません。

縦720×1280・横1280×720、32秒/30fps/960フレーム、音声ストリーム0として書き出しました。任意時刻の一致、代表・連続フレーム、コンタクトシート、スマホ幅の図と操作、全デコード、両MP4の最後までの再生、9素材の照合と失敗復旧を確認しています。これはエージェントによる技術確認で、人の承認や実機iPhoneでの確認ではありません。
