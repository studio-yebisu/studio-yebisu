# Ryoshuをローカルで試す

このページは保存済みの架空データを紹介します。OCRやAIは実行しません。実際のアプリは[RyoshuのGitHub](https://github.com/studio-yebisu/ryoshu)から取得します。

1. [動作要件](https://github.com/studio-yebisu/ryoshu/blob/main/docs/REQUIREMENTS.md)と[モデルの利用条件](https://github.com/studio-yebisu/ryoshu/blob/main/THIRD_PARTY.md)を確認します。
2. WindowsにPython3.12またはuvとOllamaを用意し、公式ソースのフォルダーで「初回セットアップ.cmd」をダブルクリックします。初回の依存・モデル取得にはネット接続が必要です。
3. 「Ryoshu.cmd」または「起動.cmd」をダブルクリックし、まず架空PDFで試します。準備後のOCR・AI判断・SQLite帳簿保存はPC内です。GPUは不要です。
4. 未確認の帳簿が先に作られます。原本、用途、事業割合、支払元、税区分はあとから確認します。CSVは件数・行数・借貸・形式を見て保存します。

[導入手順](https://github.com/studio-yebisu/ryoshu/blob/main/docs/INSTALL.md) / [100件のテスト画像・検証結果](https://github.com/studio-yebisu/ryoshu/blob/main/docs/testing/README.md) / [全100件の画像一覧](https://github.com/studio-yebisu/ryoshu/blob/main/docs/testing/gallery.md)

アプリコードはMIT、OCR重み等は別条件です。最低RAM・未知の実物領収書の精度・実会計サービスへのCSV取込は確認済みとしていません。100件は修正にも使った架空の回帰データです。

この紹介ではアプリ固定版5b601be1a3fe3ebdb600d0a53c557917652a876d（元の100件のOCR・AI検証はa163a295f5e87532ef592021cee207adc2a53f6d）の原本・結果を引き継いでいます。新しい映像の描画・タイムラインはOpus5.5が執筆し、紹介ページ・記事・事実データ・制御ラッパー・書出し・確認・公開は制作担当が行います。今回100件の推論は再実行していません。

紹介ページと映像ソースのコードは[MIT](LICENSE)、MP4はサイトの[映像利用条件](../../MEDIA-LICENSE.md)です。

## v1.0.0の追加記録

ファイル・フォルダー・ドロップでの一括取り込み、PDFのページ分割、進捗・停止・再試行、あとからの一括確認、4形式のCSV、検証付きバックアップ復元に対応します。130件のPython検査・28項目の実ブラウザー操作が成功しました。画面検査のOCR・AI値は保存済み結果の再現です。

別に原本100件のOCR・AIを新規実行し、家賃の誤提案を修正して再実行しました。金額・円額未確定97/97（返金3件除外）、日付99/100、店名86/100、暫定科目47/48。全100件のソース、最終科目データでの条件差分照合と3件の新規読取は別々に記録します。元の架空100件は修正にも使った回帰データです。映像と4件の保存済み例はv0.4時点の記録を保持します。

原本・金額・科目・用途は必ず本人が確認し、税務上の最終判断は税理士に確認してください。確認済みは本人の操作で、税理士の承認・法的適合の証明ではありません。アプリの専門家による法務審査は未実施です。

[v1.0.0配布ZIP](https://github.com/studio-yebisu/ryoshu/releases/tag/v1.0.0) / [改善・レビュー・再検証](https://github.com/studio-yebisu/ryoshu/blob/3922cd584050e0f92d21fe56d7e5645a3a4edcbb/docs/testing/v1/README.md) / [確認方針](https://github.com/studio-yebisu/ryoshu/blob/3922cd584050e0f92d21fe56d7e5645a3a4edcbb/docs/REVIEW-POLICY.md) / [機械可読の追加記録](app-update.json)
