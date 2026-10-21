# Ryoshuをローカルで試す

このページは保存済みの架空データを紹介します。OCRやAIは実行しません。実際のアプリは[RyoshuのGitHub](https://github.com/studio-yebisu/ryoshu)から取得します。

1. [動作要件](https://github.com/studio-yebisu/ryoshu/blob/main/docs/REQUIREMENTS.md)と[モデルの利用条件](https://github.com/studio-yebisu/ryoshu/blob/main/THIRD_PARTY.md)を確認します。
2. WindowsにPython3.12またはuvとOllamaを用意し、公式ソースのフォルダーでsetup.ps1を実行します。初回の依存・モデル取得にはネット接続が必要です。
3. Ryoshu.cmdを開き、まず架空PDFで試します。準備後のOCR・AI判断・SQLite帳簿保存はPC内です。GPUは不要です。
4. 原本、用途、事業割合、支払元、税区分を本人が確認して登録します。CSVは件数・行数・借貸・形式を見て保存します。

[導入手順](https://github.com/studio-yebisu/ryoshu/blob/main/docs/INSTALL.md) / [100件のテスト画像・検証結果](https://github.com/studio-yebisu/ryoshu/blob/main/docs/testing/README.md) / [全100件の画像一覧](https://github.com/studio-yebisu/ryoshu/blob/main/docs/testing/gallery.md)

アプリコードはMIT、OCR重み等は別条件です。最低RAM・未知の実物領収書の精度・実会計サービスへのCSV取込は確認済みとしていません。100件は修正にも使った架空の回帰データです。

この紹介では公開済み固定版a163a295f5e87532ef592021cee207adc2a53f6dの原本・結果を引き継いでいます。新しい映像の描画・タイムラインはOpus5.5が執筆し、紹介ページ・記事・事実データ・制御ラッパー・書出し・確認・公開は制作担当が行います。今回100件の推論は再実行していません。

紹介ページと映像ソースのコードは[MIT](LICENSE)、MP4はサイトの[映像利用条件](../../MEDIA-LICENSE.md)です。
