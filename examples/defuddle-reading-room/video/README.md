# 図解32秒・無音の元ページ（Defuddle 作例）

`index.html`・`video.css`・`video.js` が、32秒・30fps・無音の図解動画の編集できるソースです。縦 720×1280（主）と横 1280×720 を、同じ時刻表で別々に組み直して描きます。場面の設計は `storyboard.json` にあります。以前の28秒の映像ソースは `legacy.html` と `scene.js` に、そのまま残しています。

## 何を描くか

Defuddle（kepano/defuddle、固定コミット `556d74e8c8fd68c49912d4b11a4ae9ec04d7b2b5`、v0.19.5、MIT）は、Webページの Document から本文と題名・著者を取り出す JavaScript のライブラリです。full版は本文をMarkdownに変換します。SKILL.md・モデル・要約AIではありません。

映像は作例ページ（`../index.html`）と同じ概念図を使います。

- 渡す：架空の読書会のページ（入力HTMLの領域から描いた図）→ `reading.html` → DOMParser の Document。URL（取得しない）と3つの設定を添える。
- 取り出す：Defuddle の中の3つの部屋（題名・著者／本文を選ぶ／Markdown）。部屋の中の動きは原典の説明にもとづく説明図で、内部の削除ログや選ばれた要素・処理の時間の記録ではありません。
- 使う：返る値（title・author・content）→ 作例側の語句の照合 → `reading.md` → メモと元のページ。

## 使う素材と実際の呼び出し

`motionReady` は、フォントの準備、`../concept/manifest.json` の21件の大きさとSHA-256の照合、記録どうしの中身の対応の確認を待ちます。そのあと照合済みのハッシュのSRIを付けて `../vendor/defuddle/defuddle.full.js` を読み込み、3件を1回ずつ実際に取り出します。

```js
new Defuddle(new DOMParser().parseFromString(sample.input, 'text/html'),
  {url: sample.url, markdown: true, useAsync: false, removeImages: true}).parse()
```

返った title・author・content が `../extraction-results.json` と `../samples.json` に全文一致し、content のUTF-8が `../outputs/<id>.md` とバイト単位で一致したときだけ描きます。どれかが違えば描画を止め、操作をすべて無効にし、「もう一度読み込む」を出します。フレームごとに Defuddle を呼ぶことはなく、映像の題名・著者・Markdownの行・語句の印・ファイルの大きさは、この読み込み時の戻り値（例は reading）から読みます。Node・AI・外部の通信は使いません。

## 時間の契約（Motion Reel）

- `window.motionConfig = {duration: 32, fps, width, height, posterTime: 31, audioEvents: []}`。
- `window.renderConfig` の `width`・`height`（偶数）と `fps` があれば、配置の前に反映します。大きさが決まっているときは向きの切り替えボタンだけを止めます。
- `window.seek(秒)` は、その時刻の完成した画面を毎回最初から描きます。呼ぶ順番、壁時計、乱数、前のフレームに依存しません。描画は `save`・`restore` で閉じています。
- `window.__MOTION_RENDER__` が真、または `?render` のときはプレビューの再生を止め、canvas だけを画面いっぱいに出します。
- 最後の動きは28.9秒で終わり、29〜32秒は静止します（点滅もありません）。ポスターは31秒。
- 音声のトラック・ナレーション・読み上げ・音の合成は一切ありません。

## 場面

| 秒 | 見出し | 内容 |
| --- | --- | --- |
| 0〜4 | Defuddle：本文を取り出すライブラリ | 箱のふたが上がり、3つの部屋が順に見える |
| 4〜8 | 渡す：ページのHTMLをDocumentに | ページが外側の領域と記事に分かれ、HTMLファイル → Document。URLと3つの設定が添えられる |
| 8〜14 | 取り出す：題名・著者と本文を分ける | 札は題名・著者の部屋へ、段落は虫めがねの下へ、外側の領域はふるいの下へ（説明図） |
| 14〜20 | 本文が、Markdownの行になる | 札が title・author に入り、段落が ## ・段落・- の行と実際の文字になる |
| 20〜26 | 語句を文字どおり照合（作例側） | 残る4語の行に藍の印、本文の外の3語は無いと数える。意味や品質の採点ではない |
| 26〜29 | 保存して、読む・見比べる | 行が reading.md（1,294 B）になり、メモと元のページへ |
| 29〜32 | Webページの本文を、Markdownで取り出す | 全体の経路で静止 |

## 開き方と書き出し

`fetch` と `crypto.subtle` を使うため、作例のフォルダ（`index.html` のある階層）をローカルのHTTPサーバーで配信して `video/index.html` を開きます。自動では再生しません。

書き出しの手順・使ったコマンド・環境・確認の結果は、制作担当が描画したあとに `../visual-guide.md` と `../visual-verification.json` へ記録します。

```text
【再現のコマンド：制作担当が実際に描画したあとに記入】
```

## 現在の状態

このソースは claude-opus-5-5 が書いたもので、書いた時点ではブラウザーでの表示、フレームの描画、MP4の書き出し、映像の確認のどれも行っていません。制作担当の技術的な確認は、人による承認とは別のものです。

## ライセンス

映像のコードと文章：MIT License、Copyright (c) 2026 Studio Yebisu。Defuddle：MIT License、Copyright (c) 2025 Steph Ango (@kepano)（`../vendor/defuddle/LICENSE`、同梱ライブラリの告知は `../vendor/defuddle/THIRD_PARTY_NOTICES.txt`）。

制作側の再現入口は作例ルートのrender-visual.py。空の出力先へ縦720×1280/横1280×720で描きます。詳しくは../visual-guide.md、実際の新QAは../visual-verification.json。執筆時点の未検査と後の制作側QAを区別します。
