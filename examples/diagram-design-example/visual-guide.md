# Diagram Design：手順から、編集できる図へ

AIが読むMarkdownの指針・参照・HTMLひな形と、Pythonの点検/SVG書き出し補助です。依頼の担当・分岐・戻り・完了条件と既存の配色を渡すと、AIが図の形式を選びHTML内のSVGを執筆します。元の制作担当が別工程で点検し、同じ正本HTMLからSVGを書き出し、ブラウザーでPNGを撮影しました。新しい画面はその保存済みファイルを読む紹介用で、図の生成や業務を実行しません。6部品は説明用整理です。

元は45種類中スイムレーン1種類で、9つの意味の型は当てはめていません。9工程・10矢印・3担当、2つの戻り道。C3で解決確認→E09→R5で対応記録が完了条件です。18文片のうちF1〜F12が業務事実で、元の検査12条件と別の数です。未解決の主語を受付へ読んだA1など4解釈は人の確認がありません。業務は架空です。

元Opusの2受領、self_check.py --offline、原典リポジトリのverify-geometry.py、export_svg.py --system-fontsとブラウザーPNG撮影は保全し再実行していません。geometryが拾う下地は8〜14px高で、日本語の16px下地は別に8px間隔/重なりを照合した記録です。SVG18412BとPNG190200Bは元の同じ図で、PNGはSVGexporterからの出力ではありません。4経路JSON245/155/200/257Bは元routeobjectそのままのUTF8/LF包装です。

## 開く・描く

HTTPでindex.htmlを開きます。27素材のサイズとSHAを照合し、破損時は止まって再読込を待ちます。原の図はdesk.htmlとdiagrams/intake.htmlで、1280pxの内部スクロールを保ちます。新しい紹介図だけスマホに全体を収めます。新映像は32秒・30fps、縦720×1280/横1280×720の別配置、完全無音です。

```powershell
python -m http.server 8080
npm ci --ignore-scripts --no-audit --no-fund --prefix tools/motion-reel
python render-visual.py --out ../diagram-review-portrait --width 720 --height 1280 --strip-at 10.2
python render-visual.py --out ../diagram-review-wide --width 1280 --height 720 --strip-at 10.2
```

Python、Node20以上、Chrome、FFmpegが必要です。依存は未導入の場合だけ用意し、空の出力先を使います。--stills-onlyは代表と連続フレームだけ。原典CLI検査・SVG書き出し・図のPNG撮影は、新しい概念動画の再現には不要です。原典animation controllerを図へ追加したものではありません。

## 原典・保全・確認の範囲

cathrynlavery/diagram-design@d97c5c7477e54cee17cfa6459190610da0643a05、SKILL metadata2.6/plugin2.6.99、MIT、Copyright(c)2025CathrynLavery。vendorの289件は固定Windowsチェックアウトのまま保持し、公式Gitblobと8件は生バイト一致、281件はCRLFだけ正規化した内容一致です。LICENSE/THIRD_PARTY_LICENSESを保持し、原典アイコンは使っていません。

元303公開ファイルと旧28秒MP4は履歴へ保全し、元の画面と旧編集HTMLをdesk.html/video/legacy.htmlへ残します。元READMEや検査は原制作の説明で、今回新設したverification.jsonは原制作記録の要約、新しい図と映像の確認はvisual-verification.jsonです。source.zipも今回の包装で新設します。

新しい8原本のOpus5.5執筆と、制作側の事実構造・元経路の包装・補正・描画・QA・公開は別です。実機iOS/Safari/VoiceOver、200%ズーム、人の審美的承認、意味やすべての入力/性能、クリップボード内容の再取得は未確認です。音声ガイド・原稿・音源は作っていません。
