# 3D Asset Server：手順書から、素材の一式へ

MarkdownのSKILLは、検索→ファイルと全容量の確認→取得という3手順と、ID・形式・ライセンス・直接取得・大容量の規則です。ツールの実装は既存素材を探して取得します。3Dを生成するモデルではありません。

元のOpusは指示書と依頼を読んでrun.mjsを執筆し、制作担当が別工程でNodeの原典関数を実行しました。MCP/RESTは原典の別の入口で、今回の実行には使っていません。有効な配信元はPoly HavenとFabの2つだけ。Poly HavenはAPI/ファイル、Fabはリンクだけで通信していません。

1kはglTF・bin・画像3枚の計5ファイル、2277087B。8kの118636175Bは4MiB枠でフォルダー作成/取得通信の前に停止しました。A07のFabのskippedはこの予算超過や通信エラーとは別です。図の3つの切替は保存済みの異なる実記録で、自動的に解像度を下げた再試行ではありません。

取得した木箱はJames Ray Cock / Poly Haven / CC0。元GLTFLoaderビューアをdesk.htmlへ保ち、5ファイルの一式ZIPを保存できます。図の木箱画像は公開の実3D表示領域を制作担当が撮影したもので、Poly Havenのサムネイルや生成画像ではありません。新しい図は保存記録とローカルの実ファイルを読むだけで、AI・検索・再取得は行いません。

## 新しい図と動画を開く・描く

HTTPでindex.htmlを開きます。図と映像は同じ25素材の大きさとSHA-256を照合し、失敗時は止まって再読込を待ちます。A08/A04/A07の保存JSONは元のresultobjectをUTF8/LFで包装したもので、別の推論や新しい実行結果ではありません。

32秒・30fps、縦720×1280と横1280×720の別配置、無音で音声トラックなしです。

```powershell
python -m http.server 8080
npm ci --ignore-scripts --no-audit --no-fund --prefix tools/motion-reel
python render-visual.py --out ../asset-review-portrait --width 720 --height 1280 --strip-at 10.2
python render-visual.py --out ../asset-review-wide --width 1280 --height 720 --strip-at 10.2
```

Python、Node20以上、Chrome、FFmpegが必要です。依存は未導入の場合だけ用意し、空の出力先を使います。--stills-onlyは代表と連続フレームだけ。再現入口は一時コピーへ動画HTMLを置き、必要な元の一式ZIPもローカル配信します。元のNode検索/取得やビルドは映像再現には不要です。元の再実行手順README.md/run.mjs/render.pyは旧制作の説明です。

## 原典・保全・今回の範囲

arielshad/3d-asset-server@f605df3425011bae55ade114c9e7b276f5b1297b、0.1.0、Apache-2.0。既存58原典ファイルは固定Git treeのGitblobと生バイト一致、既存50dist/7threeを含む115lockfilesも元のハッシュと一致。three0.180.0はMIT。元のフォント・依存の通知はそのまま保持します。CC0は素材の条件で、ライブAPIには識別User-Agentと出どころ表示の別条件があります。

Powered by Poly Haven。Studio YebisuはPoly Havenの公式の製品・提携先ではありません。

元189公開casefilesは私的履歴へ保存。元の原典・入力・取得物・実行スクリプト・照合・旧ビューアを保持し、旧28秒の編集4ファイルはlegacy-*別名で同じバイトを保持。旧HTMLの参照だけ制作側が補正しました。元のsource.zipは履歴に残し、配布用ZIPは今回の図と映像のソースを含む包装へ更新しています。元verification.jsonと新visual-verification.jsonは別です。

元の2Opus受領・8API操作39確認・独立212照合・明示offline replay29確認・ライブ8通信と取得5filesは保全し、再推論/再取得/再ビルドしていません。新しい8原本のOpus5.5執筆と、制作側の事実構造・JSON包装・必要な補正・描画・QA・公開を区別します。6部品は説明用整理で原典の共通スキーマではありません。

新確認の詳細はvisual-verification.json。実機iOS/Safari/VoiceOver、200%ズーム、人の審美的承認、本番での画質/性能、クリップボード内容の再取得は未確認。音声ガイド・原稿・音源は作っていません。
