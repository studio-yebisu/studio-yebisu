# Defuddle：HTMLから、読む本文を取り出す

DefuddleはJavaScriptの本文抽出ライブラリです。HTMLをDocumentへ変え、URLと設定を添えてfull版へ渡します。題名・著者のメタ情報と本文を分けて取り出し、本文はMarkdownへ変換します。図の領域は入力HTMLと固定ソースから描いた説明で、内部の削除ログや選択器を計測したものではありません。

同じ固定fullバンドルをブラウザーで3件実行し、題名・著者・全文を元のNode出力と照合します。語句の照合は作例側の別工程です。reading.md1294B、operation.md1213B、research.md1132Bは元contentのUTF8そのままで、要約や新しいAI出力ではありません。保存手順や8人のテストは架空の文章で、実際のアプリ操作や調査を実行した記録ではありません。

## 開く・描く

HTTPでindex.htmlを開きます。図と映像は同じ21素材の大きさとSHAを照合し、破損時は止まって再読込を待ちます。URLは文脈として渡すだけで取得しません。useAsync:false、markdown:true、removeImages:true。元入力に画像はなく、画像除去の効果は未検証です。

32秒・30fps、縦720×1280と横1280×720の別配置、完全無音です。

```powershell
python -m http.server 8080
npm ci --ignore-scripts --no-audit --no-fund --prefix tools/motion-reel
python render-visual.py --out ../defuddle-review-portrait --width 720 --height 1280 --strip-at 10.2
python render-visual.py --out ../defuddle-review-wide --width 1280 --height 720 --strip-at 10.2
```

Python、Node20以上、Chrome、FFmpegが必要です。依存は未導入の場合だけ用意し、空の出力先を使います。--stills-onlyは代表と連続フレームだけ。再現入口は一時コピーへ動画HTMLを置き、作例全体を配信します。元のNode抽出やDefuddleの再ビルドは映像再現には不要です。

## 原典・保全・確認

kepano/defuddle@556d74e8c8fd68c49912d4b11a4ae9ec04d7b2b5、0.19.5、MIT、Copyright(c)2025StephAngo(@kepano)。元README/LICENSE/package/lockの4件はCRLFの配布原本で、公式LFとは生バイトが異なりCRLFだけ正規化した内容/Gitblobが一致。追加の公式src4件はLFの全バイト一致です。元の生成fullバンドルのハッシュは原公開ビルドと一致し、今回再ビルドしていません。依存の利用条件はvendor/defuddle/THIRD_PARTY_NOTICES.txtに保持します。

元18公開ファイルは履歴へ保全し、16件と2つの旧HTML別名desk.html/video/legacy.htmlを同じバイトで残しました。旧README/28秒ソースは元制作の説明です。新しい32秒と図の確認はvisual-verification.jsonへ分けます。source.zipとverification.jsonは今回の包装で新設しました。

新しい8原本のOpus5.5執筆と、制作側の事実構造・Markdown包装・補正・描画・QA・公開を区別します。原モデル・Node3件・ビルドを再実行していません。実機iOS/Safari/VoiceOver、200%ズーム、人の審美的承認、意味や全ページの品質保証、クリップボード内容の再取得は未確認です。音声ガイド・原稿・音源は作っていません。
