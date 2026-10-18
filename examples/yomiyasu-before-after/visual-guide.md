# yomiyasu：推敲の指示書と、点検の道具

yomiyasuはMarkdownの指示書（SKILL.md）と参照資料、Pythonのlint/diffという2つの点検スクリプトを持つスキルです。主張・比重・言い切りの強さ・文の働きを保つ指示と、用途に合う資料、原文・用途/読み手・残す条件を同じAIへ渡します。AIの推敲の後、別の工程でlintが推敲後だけを、diffが原文と推敲後を読み、見直し候補を返します。原文と読み比べて使います。6部品は説明用の整理で、原典共通の入力形式ではありません。

元のOpus5.5がSKILL.mdとbusiness/gemini-syntax/slop-catalogを読んで推敲した、架空の敬体日本語3件（release/operation/research）をそのまま保持しています。8変更、14条件（5/4/5）で、保存した条件と実際の文字列を比べられます。画面と動画の改修で元の推敲・音声生成・Pythonの6回実行をやり直していません。文章は架空で、保存操作や予約検索のアプリを動かしたわけではありません。

lintは3件ともfindingsが空で、未使用のscoreは図に使いません。diffのreleaseは「行われません」の一部分を可能表現として分類しましたが、原文も推敲後も否定です。operationのつなぎ2→1は出現数で、「によって」が「と」になり「ただし」が残ります。researchもlogicに「ただし」の文があります。これらは候補で、追加修正を実行する道具や意味・品質の保証ではありません。候補の後の追加推敲、人の校閲・承認は記録していません。

## 開く・再現する

HTTPで配信しindex.htmlを開きます。図とvideo/index.htmlは同じ19素材の大きさ・SHA-256と内容を照合します。AIもPythonもブラウザーでは動かしません。動画は32秒・30fps・縦720×1280、横1280×720の別配置で、音声トラックなしの無音です。

```powershell
python -m http.server 8080
npm ci --ignore-scripts --no-audit --no-fund --prefix tools/motion-reel
python render-visual.py --out ../yomiyasu-review-portrait --width 720 --height 1280 --strip-at 10.2
python render-visual.py --out ../yomiyasu-review-wide --width 1280 --height 720 --strip-at 10.2
```

Python、Node20以上、Chrome、FFmpegとMotion Reelの依存が必要です。依存は未導入の場合だけ用意します。出力先は空の専用フォルダです。--stills-onlyで代表・連続フレームだけを描きます。入口のrender-visual.pyはvideo/index.htmlをフォルダ全体から配信できるよう一時コピーし、元ファイルを変えません。

原制作のREADME.md、app.js、styles.css、samples.json、video/scene.jsは履歴として同じバイトを保持しています。旧index.htmlはdesk.html、旧video/index.htmlはvideo/legacy.htmlで読めます。旧READMEが指す28秒映像の入口は現在video/legacy.htmlです。新しい図はconcept.js/concept.css、新映像はvideo/video.js/video.cssです。原制作にはsource.zipもverification.jsonもなく、今回初めてソースZIPと確認記録を包装しています。

## 原典と制作範囲

nanaism/yomiyasu @60bf877acebc86651e0b67d70112a66245f87758。版はこのコミットで、別のバージョン番号は付けていません。MIT License、Copyright(c)2026 nanaism。Unicode由来データには別途Unicode License V3（Copyright1991–2026 Unicode, Inc.）の通知を保持します。公式15ファイルのうち画像1件は同じバイト、元の14テキストはCRLFで公式GitはLFです。LFへ改行正規化した内容・Gitblobが一致し、元CRLFの配布バイトとSHAを変えていません。UPSTREAM.jsonは元の包装メタデータです。

新しいOpus5.5の8原本の受領と、制作側の事実構造・元CLIからの投影・既存結果のJSON包装・画面の保存ラベルと余白・hidden属性の制御・出現数の説明・再現用包装・描画・QAを分けて記録しています。制作側の自動検査や画面確認は、人の審美的承認、意味の同一性、実機iOS/Safari/VoiceOverや200%ズームの確認ではありません。業務文書だけに適用し、tech/essayは未適用です。クリップボードの再取得も未確認です。

制作側の描画補正：推敲の段階の終端で紙が空になっていた境界処理を直し、完了した言い回しが次の編集まで残るようにしました。最終映像はrenders-r2から描画し、執筆原本と区別しています。
