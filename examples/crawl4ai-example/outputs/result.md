# Crawl4AI 作例：架空の手順書3ページの取得結果

workflow.py が実行結果（outputs/runs.json と同じデータ）から書き出したメモです。
要点は元のHTMLの段落を CSS セレクターでそのまま取り出したもので、AIが作った要約ではありません。

- ライブラリ：Crawl4AI 0.9.5（インストール元 unclecode/crawl4ai 6192d5e・Apache-2.0）
- ブラウザー：channel=chrome・headless
- 範囲：手元の 127.0.0.1 で配った作例用の架空の手順書3ページと、診断用の存在しない1ページだけを取得しました。公開Webの取得、リンクの巡回、取得の深さは試していません。LLM・クラウド・APIキーは使っていません。
- URL：URL のポート番号は、実行のたびに OS が割り当てる一時ポートです。保存済みの実行結果に残っている値で、今そのアドレスにサーバーはありません。

## 流れ

1. 操作：この作例の fixture/ を 127.0.0.1 の一時ポートで配る。
2. 依頼：AsyncWebCrawler.arun を 3 ページと診断用の1ページに呼ぶ（css_selector=main#guide・wait_for=css:#guide[data-ready="true"]・JsonCssExtractionStrategy の baseSelector=article.doc-section）。
3. 結果：HTTP 200 で受理 3/3 ページ、取り出した節 6、診断は HTTP 404（成功に数えない）。
4. 保存：各結果の model_dump は raw/（非公開）、公開用は outputs/runs.json・samples.json・このメモ。

## ページごとの結果

### 準備を始める｜木工ワークショップ運営メモ（架空）

- 元のファイル：`fixture/docs/start.html`
- URL：`http://127.0.0.1:55880/docs/start.html`
- HTTP 200・success=True・受理：はい
- 取り出した節（extracted_content の中身）：
  1. 参加者名簿を作る：名簿は開催の前日までに作り、氏名と卓番号の2列だけにします。（元のHTML）
  2. 工具の数をそろえる：のこぎりと小刀は卓ごとに同じ数を用意し、箱のふたに本数を書きます。（元のHTML）

### 当日の確認｜木工ワークショップ運営メモ（架空）

- 元のファイル：`fixture/docs/review.html`
- URL：`http://127.0.0.1:55880/docs/review.html`
- HTTP 200・success=True・受理：はい
- 取り出した節（extracted_content の中身）：
  1. 刃物を確かめる：刃こぼれのある工具は赤い箱に分け、その日は使いません。（元のHTML）
  2. 質問を集める：質問は付箋1枚に1つ書いてもらい、卓番号を左上に添えます。（元のHTML）

### 記録の書き出し｜木工ワークショップ運営メモ（架空）

- 元のファイル：`fixture/docs/export.html`・`fixture/docs/dynamic-export.js`
- URL：`http://127.0.0.1:55880/docs/export.html`
- HTTP 200・success=True・受理：はい
- 取り出した節（extracted_content の中身）：
  1. 記録をまとめる：終了後30分以内に、付箋の写真と名簿をひとつのフォルダに入れます。（元のHTML）
  2. 書き出す前に確かめる：フォルダ名を日付と会場名にし、参加者の顔や連絡先が写った写真を除きます。（JavaScriptが追加）

## 取得エラー（別扱い）

- URL：`http://127.0.0.1:55880/docs/missing.html`
- HTTP 404・ライブラリの success=True・受理：いいえ
- error_message：（空）
- success はライブラリがページを受け取って処理できたかを示す旗で、HTTP の成否とは別です。この作例では success と HTTP 200 の両方を満たしたときだけ受理しています。

## 確認

- [x] Crawl4AI の版：インストール済みの crawl4ai.__version__ は 0.9.5（想定 0.9.5）。
- [x] 元のHTMLとJavaScript：期待する6節の見出し・要点がソースにあり、書き出しページの最後の節は export.html になく dynamic-export.js だけにあることを、取得前に確かめました。
- [x] 3ページを HTTP 200 で受理：/docs/start.html：HTTP 200・success=True、/docs/review.html：HTTP 200・success=True、/docs/export.html：HTTP 200・success=True
- [x] 取り出した節が元の見出し・要点と一致：extracted_content から読んだ節は合計 6。3ページとも、元のHTML・JavaScriptに書かれた見出しと要点に、順番も含めて一致しました。
- [x] Markdown に6節の見出しと要点がある：raw_markdown に6節すべての見出しと要点の文がそのまま含まれています。
- [x] ナビ・フッター・選ばないページの目印が出力にない：NAV_ONLY_SENTINEL・FOOTER_ONLY_SENTINEL・UNSELECTED_SENTINEL は、3ページの Markdown と extracted_content のどこにもありません。
- [x] JavaScriptが追加した節を取り出せた：export.html のソースにない「書き出す前に確かめる」が、wait_for で待った後の取得結果に含まれています。
- [x] 存在しないページは 404 として別扱い：/docs/missing.html：HTTP 404・ライブラリの success=True・受理しない。成功件数に数えていません。
- [x] サーバーに届いたのは許したパスだけ：記録 8 件。robots.txt 1 回、選ばないページ 0 回、想定外のパスなし。外部ホスト（example.invalid）への通信はこのサーバーの記録には現れないため、ここでは確かめていません。
- [x] 公開用の出力に手元のパスがない：公開用の JSON に、作業フォルダ・作例フォルダ・Python・ホームの絶対パスは含まれていません。

This project uses Crawl4AI (https://github.com/unclecode/crawl4ai) for web data extraction.
