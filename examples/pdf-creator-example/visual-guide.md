# PDF Creator の構造紹介を描画する

今回の32秒紹介は、保存した原制作を説明する新しい無音動画です。元のinputs/event.md、2つのPDFと3ページ画像、Python変換器、原典は保全し、元の推論/PDF生成/lintを再実行しません。元の2受領と新しい図のOpus5.5受領は別です。親の事実整理/実行補助/技術補正/描画/QA/包装も区別します。

Node.js20以上、Python3、Chrome、FFmpeg/ffprobeが必要です。初回はtools/motion-reelでnpm install --ignore-scriptsを行います。公開された5ファイルのレンダラーを使います。出力と作業用フォルダーはこの展開ソースの外に置きます。

```text
python render-visual.py --out ../renders/portrait --width 720 --height 1280 --strip-at 14.4
python render-visual.py --out ../renders/wide --width 1280 --height 720 --strip-at 14.4
```

--stills-onlyは代表/連続/contact用です。出力は空の新しいフォルダーへ。video/index.htmlをルートに据えた一時コピーを作り、フォントと23固定素材の検証/画像decodeを待ち、seek(秒)で描きます。音はありません。横は別配置です。同一環境のPNG一致を別OS/フォントや人の審美的承認へ一般化しません。

元の全ページビューアはdesk.html#paper/phone、実PDFはoutputs/atelier-a4.pdfとatelier-phone.pdf、旧28秒無音紹介はvideo/legacy.htmlとlegacy.mp4へ保全。元render.pyはlegacy入口を参照します。新32秒にはrender-visual.pyを使います。元PDFの再生成はbuild_pdfs.pyの原手順で別工程です。新図の選択や再生は変換を行いません。

原典daymade/claude-code-skills@e37b50c323cf99471f18ac17a11c923bb96ce2ba、MIT2025daymade。18同梱ファイルを固定公式Gitblobとrawbytes一致確認。元の実行はChrome指定、2テーマと和文CSS/Windows/lang=ja/UTF8/静的TrueTypeの補助を使用。全文Notoフォントは配布しません。表なしのため表境界ゲートは対象外です。WeasyPrint/一括/自動backendや全日本語を検証していません。元の全ページ/文字/埋込フォント確認は人の承認や別reader/実印刷の保証ではありません。新しい確認はvisual-verification.jsonへ分けて記録します。
