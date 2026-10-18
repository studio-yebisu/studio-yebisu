# Make Interfaces Feel Better：指針から、実際の画面へ

AIが読むMarkdownのUIレビュー/実装指針です。SKILLと文字/面と操作範囲/動き/アイコン/性能の5参照、既存画面と依頼を同じAIへ渡し、レビューと実装を受け取り、別工程で実際に確認します。6部品は今回の説明用整理で、APIや自動検出器、原典の共通スキーマではありません。

## 使えるもの

index.htmlは34素材を大きさとSHAで照合し、元のexport.mjsのsummarize/serializeExportを呼んで、同じ保存JSONと照合します。all3件370秒06:10/560B、two2件275秒04:35/399B、one1件190秒03:10/252B。制作メモは原文のままです。元の実画面はdesk.html#all、修正前はbefore/desk.html。任意の選択、メモOFF、0件拒否と復帰も試せます。元before/index.html、app.mjs/style.css/export.mjs/clips.json/原JSON/レビュー/確認記録は維持しています。別名の相互リンクと動画欄だけ制作側の補正です。

beforeは依頼用の架空画面です。元AIがソースを読みレビュー/改善UIを執筆し、制作担当が関連10行を3群へ統合・技術補正後、別工程でNode8条件とブラウザー/修正前後4JSONを検証しました。原典quickは上限5で、依頼が最大3群へ絞っています。元の推論、Nodeスイートや制御試験は再実行していません。Approveは限定範囲のエージェント確認です。

## 編集と描画

Python、Node20以上、Chrome、FFmpeg/ffprobeが必要です。ZIPは従来と同じくexamples/make-interfaces-feel-better-example/とmedia/、公開brief-to-demoとMITを持つ展開ルート形式です。依存・認証・モデル履歴は含みません。HTTPSかループバックHTTPで開いてください。

```powershell
python -m http.server 8080
npm ci --ignore-scripts --no-audit --no-fund --prefix examples/make-interfaces-feel-better-example/tools/motion-reel
python examples/make-interfaces-feel-better-example/render-visual.py --out renders/interfaces-portrait --width 720 --height 1280 --strip-at 14.6
python examples/make-interfaces-feel-better-example/render-visual.py --out renders/interfaces-wide --width 1280 --height 720 --strip-at 14.6
```

空の出力先へ書きます。--stills-onlyは代表と連続画像だけ。--strip-atは指定秒の周囲12枚です。縦720×1280/横1280×720、32秒/30fps、無音。window.seekの任意時刻は順番に依存しません。新しい推論や元Node検査の実行は不要です。

元の28秒編集はvideo/legacy.htmlへ、render.pyはその旧入口へ向けています。旧MP4と元source.zipは私的履歴へ保全。現在の32秒にはrender-visual.pyを使います。verification.json/review.md/validation.jsonは元制作の記録、新しい図の技術確認はvisual-verification.jsonです。

## 原典と確認の境界

jakubkrehel/make-interfaces-feel-better@35545ea1512ad59fa463e6b1f95ca9c052981fe6、MIT Copyright(c)2026 Jakub Krehel。8公式Gitblobと元配布のrawbytes一致を確認。2原受領と新しい8原本のOpus執筆、制作側の事実整理/包装/補正/描画/QA/公開を区別します。

Animationsパネル10%再生は未実施で、元の私的コピーで遷移時間を10倍にした代替観察です。元の準備/例外/HTTP503は制御試験。通常の準備時間や失敗率を測っていません。実機iOS/Safari/VoiceOver/macOS、200%ブラウザーズーム、人の審美的承認、全入力/意味/使いやすさ/性能、clipboard再取得は未確認です。映像素材はなく架空のメタ情報だけです。動画変換/送信/設定保存/モデル呼出しはなく、JSONはブラウザーへの手渡しまでを示します。音声ガイド/TTS/原稿/音源/音声トラックは作っていません。
