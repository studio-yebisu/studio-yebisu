# 32秒の図解の編集元 — 手順を、ブラウザーの操作へ（Browser Use作例）

Browser Use（Pythonでブラウザーを動かすライブラリ）と同梱の参照スキルが何か、事前の手順がPythonを通ってブラウザーの部品を操作し、どんな結果が戻るかを、**一つの動く図**で示す32秒・**無音**の映像の編集元です。文字のスライドや結果画像の並びではなく、同じ形が移動・合流・入れ子になって変化します。

この映像は保存済みの実行記録を図にしたものです。操作の録画でも新しい実行でもなく、このページや映像の中でBrowser Use・Python・AIは動きません。音声トラック・ナレーション・効果音・読み上げはありません。

## ファイル

| ファイル | 役割 |
| --- | --- |
| `index.html` | 編集元のページ。停止したキャンバス、再生・先頭・最初から・末尾、0〜32秒の再生位置と時刻、7つの場面へ移るボタン、縦・横の切り替え、照合したファイルの一覧 |
| `video.js` | 映像の本体。18ファイルの照合、時刻 t の画を描く `window.seek`、編集用のプレビュー |
| `video.css` | ページの見た目（スマホ優先）と、書き出し時にキャンバスだけを表示領域いっぱいに置く指定 |
| `storyboard.json` | 制作ブリーフ、残り続ける形（入る時刻・出どころ）、7場面の時刻・伝えること・入る状態・出る状態・使う値 |
| `README.md` | この説明 |

## 使う素材（18ファイル）

`video.js` は `../concept/manifest.json` の生のバイト列を固定したSHA-256 `98fa56dccf5aec3d1c24ad24d05145b799fd42e72a148700b389360b4272c3c3` と比べ、載っている18ファイル（`concept/structure.json`・`brief.json`・`request.txt`・`run_browser.py`・入力2件・`outputs/browser-run.json`・`outputs/browser-selection.json`・`outputs/method.md`・`samples.json`・`fixture.html`・`fixture.js`・`vendor/browser-use/` の README・LICENSE・SKILL.md・actor.md・browser.md・`verification.json`）のバイト数とSHA-256を確かめます。閲覧ページ（`../index.html`）と同じ照合です。

続けて中身を照合します：形式と版（0.13.11・固定コミット）、5部品と6状態のID、件数12・12・4・2・0・12、操作の合計11回（fill2・select_option2・check2・click5）、`agent_run: false`・`llm_calls: 0`、入力の手順から求め直した条件と結果、入力の作業席との全項目の一致、期待IDの一致（照合だけ）、保存した `browser-selection.json` と実行記録のS04の一致、原文の引用が `SKILL.md`・`run_browser.py` の該当行にあること、LICENSEの著作権表示。一つでも合わなければ理由を出して止まり、キャンバスは紙の色だけにして、代わりの映像は描きません。「もう一度読み込む」は18ファイルすべてを取り直します。

映像に出る件数・席の番号・名前・料金・条件・操作の種類と回数・版・コミットは、すべて照合済みの記録から取り出します。コードに書いた期待値は照合にだけ使います。

## 残り続ける形

本（手引き）と2枚の栞（Actor・Browser）、破線の「Agent.run（LLM判断）は未実行」、Python の紙、事前の手順の箱と4つの札、Browser設定の札、Browserの枠、その中のPage、さらに中の7部品、12枚の席、カーソル（9〜20.4秒）、読み取りの2札、記録の箱と6フォルダー、照合の破線の小札、保存JSONの紙、保存の矢印。入る時刻と出どころは `storyboard.json` の `persistent_shapes` にあります。いったん出た形は最後まで残り、場面に合わせて強さだけが変わります。

## 7つの場面

| 秒 | 見出し | 伝えること |
| --- | --- | --- |
| 0〜4 | 手引きを読み、実装する | 参照スキルの話題の表からActorとBrowserを選び、Pythonを書いた |
| 4〜9 | Browser → Page → Element | 事前の手順と設定がPythonへ。枠・ページ・部品の入れ子 |
| 9〜14 | 文字検索と、条件の指定 | 同じ検索欄へfill「電源」→click（12件、電源なしも一致）。エリアと予算で4件 |
| 14〜20 | チェックして、さらに絞る | check2つ→clickで2件（W01・W11と料金）。0件は正常、リセットで12件 |
| 20〜25 | 画面から、結果を受け取る | 読み取り専用の evaluate・screenshot → 記録の6フォルダー。期待IDは照合だけ |
| 25〜29 | 選んだ結果を、JSONに | S04の2枚が保存JSONへ。作例ページの保存へつながる |
| 29〜32 | 仕組みを見て、実物を試す | 全体を止めて見せる。架空データ／保存済み実行の図解／無音 |

## 時間の契約

- `window.motionConfig = {duration: 32, fps, width, height, posterTime: 31, audioEvents: []}`。`fps`・`width`・`height` は `window.renderConfig` の値を使い、なければ30fps・縦720×1280です。幅が高さ以上なら横（1280×720の論理座標）、そうでなければ縦（720×1280の論理座標）の配置で組み、等倍率で収めます。
- `window.motionReady` は18ファイルの照合とフォントの準備が済むと解決し、失敗すると理由つきで拒否されます。
- `window.seek(seconds)` は時刻だけから完成した1フレームを描きます。毎回変換と透明度を戻してから描き、呼んだ順番・壁時計・乱数・前のフレームには依存しません。動きは閉形式の減速曲線です。準備前に呼ばれた場合は準備を待ってから描きます。
- 29秒からの3秒は同じ画で、暗転やフェードはしません。ポスターは31秒です。
- 編集用のプレビューは停止から始まり、「再生」を押したときだけ requestAnimationFrame で進みます。書き出し時（`window.__MOTION_RENDER__`）は動かしません。CSSのアニメーションは使いません。

## 開いて確かめる

照合に WebCrypto と fetch を使うため、`file://` ではなくローカルサーバーで開きます。作例フォルダ（`video/` の1つ上）で次を実行し、`http://127.0.0.1:8865/video/` を開きます。横の配置は `?layout=wide` でも開けます。

```powershell
python -m http.server 8865 --bind 127.0.0.1 --directory .
```

## 書き出し

制作側が用意する `../render-visual.py`（videoフォルダの1つ上、作例フォルダ内）で、縦と横をそれぞれ書き出します。出力先などそのほかの引数は `render-visual.py` の指定に従ってください。fpsや音声の指定は使いません（30fps・音なし）。

```powershell
python ../render-visual.py --out ../../browser-stills-portrait --width 720 --height 1280 --strip-at 15.4 --stills-only
python ../render-visual.py --out ../../browser-stills-wide --width 1280 --height 720 --strip-at 15.4 --stills-only
python ../render-visual.py --out ../../browser-film-portrait --width 720 --height 1280 --strip-at 15.4
python ../render-visual.py --out ../../browser-film-wide --width 1280 --height 720 --strip-at 15.4
```

書体は端末のものを使うため（Windows では Yu Gothic UI・Yu Mincho、macOS では Hiragino）、OSが違えば文字の幅や見た目が変わります。

## 確認の状況

この編集元を書いた時点では、書き出し・静止画とコンタクトシート・連続フレーム・別順と新しいページでの一致・MP4の全デコードと音声トラック0の確認・実機での再生・人による確認は、どれもまだ行っていません。これらは制作側で後から行い、その結果は別に記録します。

## ライセンス

映像の構成・コード・文章は MIT License（Copyright (c) 2026 Studio Yebisu、作例フォルダの `LICENSE`）。Browser Use は MIT License（Copyright (c) 2024 Gregor Zunic、`../vendor/browser-use/LICENSE`）。作業席の名称・料金・設備は架空のデータです。

制作側の補正：図の非強調部品の可読性を上げ、冒頭の手引きを拡大して同じ図へ戻る配置にしました。編集の向き操作の対象をボタンに限っています。執筆時点の未確認は上記のとおりで、現在の制作側QAは../visual-verification.jsonを参照してください。
