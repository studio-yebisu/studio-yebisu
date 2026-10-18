# Effekseer VFX：指示書から、実描画を見て直す

Markdownの指示/参照、Pythonレシピ/CLIとCoreコンパイラー、Godot Lab、別AIのvfx-reviewを持つスキルです。手順と依頼を読んだ作者AIがブリーフとコードを書き、制作担当が別工程でビルドと実描画を実行します。画像が作者へ戻る見直しと、画像/基準だけを別AIへ渡す確認を分けます。6部品は説明用整理で、共通スキーマではありません。

元は架空ガード1件。0.5秒/60FPS、15項目（不可視2基準点含む）、粒子上限27、3制作回、4Opus受領。Core1.80.7/.NET9.0.20/Godot4.7Forward+/プラグイン1.80.5.1の元記録を保ち、再推論・再ビルド・Godot再描画・再採点はしません。Ringの固定頂点色を青/紺へ直した2回目と、効かない指定を消した3回目は、既存32画像が全バイト一致です。

## 開く・保存する

index.htmlは51素材を大きさ/SHAで照合し、元PNGで紹介します。HTTPSかループバックのHTTPで開いてください。原PNG32枚はf0〜f30とf36、1280×800です。表示用の防御側の切抜きは元styles.cssと同じx240/y296/360×288、比較はx290/y330/270×240。効果の画を描き直しません。選んだフレームがf30で効果を出さないのは正常です。

desk.htmlは元の31枚ビューア、assets/guard-real-render.mp4は元のf1〜f30の30フレーム/0.5秒/無音です。新しい紹介動画の32秒と分けます。effect-library.zipは元28ライブラリファイル+旧README/LICENSE/通知の31ファイル、データだけの保存です。旧READMEの再現コマンドはvendor等もある全source.zipと別途のツール環境を前提にします。Core/.NET/Godot/プラグイン/cacheや私的実行根拠はZIPへ含みません。元のverified状態を持ち込めるという意味ではありません。

## 紹介映像を描く

Python、Node20以上、Chrome、FFmpegが必要です。未導入の依存だけを用意し、空の出力先へ書きます。VFX自体の再ビルドは不要です。

```powershell
python -m http.server 8080
npm ci --ignore-scripts --no-audit --no-fund --prefix tools/motion-reel
python render-visual.py --out ../effekseer-review-portrait --width 720 --height 1280 --strip-at 10.2
python render-visual.py --out ../effekseer-review-wide --width 1280 --height 720 --strip-at 10.2
```

--stills-onlyは代表と連続フレームだけ。32秒/30fps、縦720×1280/横1280×720、完全無音。編集はvideo/index.htmlで7場面や任意時刻を選べます。window.seekは順番に依存せず、フォントと51素材/実PNGの準備を待ちます。音声ガイド・原稿・音源は作っていません。

## 原典と確認範囲

kanaworksai-hue/effekseer-vfx-skill@c28919890f0483c0f968a884ea03979803d3b528/0.2.0/MIT2026KanaWorks_AI。元134配布の133件は公式の生バイト一致、vfx.cmd1件は元CRLFのままで公式LFへ正規化した内容一致です。effekseer-ai由来のMITや第三者通知を保持します。

元208公開ファイルと旧28秒映像は履歴へ、旧画面/編集はdesk.html/video/legacy.htmlへ保全。元の4受領と実行範囲はverification.json、新しい図と映像はvisual-verification.jsonに分けます。source.zip/verification.jsonは今回の包装で新設です。新しい8原本のOpus執筆と、制作側の事実整理/ZIP/補正/描画/QA/公開を区別します。

独立レビューは元の効果に対する別AIのshipで人の承認ではありません。任意のf2〜f4の薄い楕円の提案は未適用です。実ゲーム組込み・実機性能・飛び道具・ビーム・iOS/Safari/VoiceOver・200%ズーム・人の審美的承認・全入力や意味・clipboard再取得は未確認です。
