# Ryoshuをローカルで試す

このページは紹介用の保存済み架空データです。OCR・AIは実行しません。映像と4例はv0.4時点です。実際のアプリは[Ryoshu GitHub](https://github.com/studio-yebisu/ryoshu)から取得します。

## v1.1.0の使い方

1. [動作要件](https://github.com/studio-yebisu/ryoshu/blob/main/docs/REQUIREMENTS.md)と[モデルの利用条件](https://github.com/studio-yebisu/ryoshu/blob/main/THIRD_PARTY.md)を確認し、Ollama Windows版を導入します。
2. [v1.1.0の配布ZIP](https://github.com/studio-yebisu/ryoshu/releases/tag/v1.1.0)を新しいフォルダーへ展開し、`Ryoshu.cmd`を実行します。初回にPython3.12.15・固定依存・OCR重み・約2.5GBのQwenモデルを自動取得します。ネット接続が必要です。
3. ブラウザーで復元用パスワードを設定します。通常はWindowsが自動で帳簿を開きます。Windowsの鍵とパスワードの両方が使えなくなると復元できないため、安全な場所へ保管します。
4. PDF・画像をまとめて選択、フォルダー選択、またはドロップして開始します。画像・読み取った文字と数字・科目を並べて確認し、画像はクリックして拡大します。
5. 原本・金額・科目・用途・事業割合・支払元・税区分を確認し、CSVを保存します。汎用CSV、freee、MFクラウド、弥生に対応。税務上の最終判断は税理士へ確認してください。

準備後のOCR・科目候補・CSV作成はPC内で行い、外部AIのログイン・APIキーは使いません。DB・保存原本・プレビュー・バックアップは暗号化します。書き出したCSVと原本は暗号化されない通常のファイルです。スマホ・LAN共有は対象外、最低RAMは未測定です。

[導入手順](https://github.com/studio-yebisu/ryoshu/blob/main/docs/INSTALL.md) / [新しい100件と安全性点検](https://github.com/studio-yebisu/ryoshu/blob/main/docs/testing/security/README.md) / [画像・OCR・科目を並べて見る](https://studio-yebisu.github.io/ryoshu/docs/testing/security/) / [100件の画像一覧](https://github.com/studio-yebisu/ryoshu/blob/main/docs/testing/gallery.md)

## 検証の範囲

暗号化対応のv1.1.0候補を凍結して架空100件を新規OCR・ローカルAIへ通しました。金額・円額未確定97/97（返金3件除外）、日付99/100、支払先86/100、暫定科目47/48、科目/保留条件89/100。その後の安全性・復元・UIの変更は別の試験です。最終配布ZIPで100件を再実行したという意味ではありません。同じ開発用100件での回帰検証で、未知の実物精度ではありません。

Python188検査と安全性に絞った49検査は成功。最終の画面28項目・安全性画面10項目と再レビューを完了し、公開sourceを固定しました。CSVは架空6件・7行・借貸299,095円の生成/再読込を確認し、各会計サービスへの実取込は未実施です。SQLCipher同梱OpenSSL3.6.0の残る制約は[点検結果](https://github.com/studio-yebisu/ryoshu/blob/main/docs/testing/security/README.md)へ記載しています。

アプリコードはMIT、モデル重みは別条件です。紹介ページと映像ソースのコードは[MIT](LICENSE)、MP4はサイトの[映像利用条件](../../MEDIA-LICENSE.md)です。[v1.0.0の100枚検証の履歴](https://github.com/studio-yebisu/ryoshu/blob/0b0fb7677475f50a2a8a28e1a7d3da836d454c79/docs/testing/v1/README.md)と[機械可読の更新記録](app-update.json)を保持しています。
