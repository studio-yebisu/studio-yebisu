# Crawl4AI：Pythonからページを文章と項目に変える仕組み

Crawl4AIはPythonのライブラリです。BrowserConfigとCrawlerRunConfigを用意し、AsyncWebCrawler.arunへURLと設定を渡します。図の「仕組み・開いて待つ・取り出す」で同じページと節が動きます。4部品は今回のAPI利用の説明用の整理です。

元の実行では、制作担当が原制作のworkflow.pyを実行し、手元の架空3ページと404の診断を計4回の実arunで読みました。3ページは合計6節。書き出しページだけはJSで追加する節を待ちます。要点はp.keypointの原文で、AIの要約ではありません。MarkdownとCSS抽出のJSONは本文からの並列出力です。

診断のHTTP404はsuccess=trueですが資料へは受理しません。診断にはwait_for、css_selector、extraction_strategyを渡していないことも保っています。全体の結果メモresult.mdはworkflow.pyによるまとめで、ページごとのライブラリの生Markdownではありません。

「全体の結果メモを保存」は元と同じ5852バイトの文書です。desk.html・desk.css・元app.mjsは元の実結果ビューアとして保全。fixture7ファイル、原典5資料、実入力・実出力・元検証など25の元ファイルを変更していません。旧ビューアの別名HTMLでは、28秒動画の欄だけを新しい32秒動画へのリンクに替えています。元のクロールや推論を再実行せず、新しい図と映像をOpus5.5で執筆しています。制作側の表示・状態・再現説明の補正と、描画・検証・包装を区別しました。

## 再現

この作例ディレクトリをHTTPで配信してindex.htmlを開きます。編集画面はvideo/index.html。17素材をconcept/manifest.jsonのバイト数とSHA-256で照合し、不一致なら図と主操作を止めます。書き出しに必要なものはPython、Node20以上、Chrome、FFmpegと同梱Motion Reelの依存です。

```powershell
python -m http.server 8080
npm ci --ignore-scripts --no-audit --no-fund --prefix tools/motion-reel
python render-visual.py --out ../crawl-review-portrait --width 720 --height 1280 --strip-at 11.5
python render-visual.py --out ../crawl-review-wide --width 1280 --height 720 --strip-at 16.9
```

依存は未導入のときだけ用意します。出力は空の専用フォルダへ。32秒・30fps・音声なし。--stills-onlyなら代表・連続フレームのみを描きます。原制作の実API検査はverification.json、新しい図と映像の検査はvisual-verification.jsonを参照してください。

## 出典

Crawl4AI0.9.5、unclecode/crawl4ai @6192d5e5b59cb21f9ca418fd6b798de47c0741d3。Apache License2.0末尾に追加の帰属表示条件があり、原文LICENSEとNOTICEを保全しています。

This product includes software developed by UncleCode (https://x.com/unclecode) as part of the Crawl4AI project (https://github.com/unclecode/crawl4ai).

This project uses Crawl4AI (https://github.com/unclecode/crawl4ai) for web data extraction.

独自の作例/架空入力/図/動画はMIT、Copyright(c)2026 Studio Yebisu。公開Webの取得・再帰巡回・LLM/Cloud/APIキーは未使用です。ローカルサーバーの記録は外部ホスト通信の観測ではありません。実機iOS/VoiceOver、200%ズーム、人の審美的承認、クリップボード内容の再取得は未確認です。
