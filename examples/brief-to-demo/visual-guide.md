# brief-to-demo：依頼から、制作の設計図へ

brief-to-demoはAIに読ませるMarkdownの指示書です。成果物から分野を選び、受け取っていない事実を足さず、推測した条件をassumptionsへ分け、短い依頼を11項目の制作ブリーフへ整えます。図は同じ本と依頼→1つのAI→11項目の書類→仮の条件のポケット→実JSONと制作へ渡す依頼文をつなぎます。4つの群と6部品は説明用整理です。

保存済みのui/slides/motionは、元のOpus5.5の原案に元の制作担当のスライドルート調整を含みます。この改修ではブリーフを再生成せず、値をそのまま包装しています。新しいJSONと引き継ぎ文はWindowsのCRLFで保存し、ファイルのbytes/SHAを固定しています。引き継ぎ文はCRLFだけLFへそろえると旧ビューアのhandoffTextと同じ内容です。inputsは各3件の「次に受け取る素材」で、実際に素材が提供された記録ではありません。各5件のstepsとacceptanceは制作計画です。12のassumptionsは未提供の情報と仮の解釈・設計で、確認済みの事実や承認ではありません。

次の制作先はfrontend-design、sol-editorial-ja/MckEngine、Motion Reelです。今回、受付画面・PPTX・20秒の製品動画を制作していません。agentsは原典のcategoryの選択肢にありますが保存済み作例はありません。この新しい32秒の概念図解動画と、motionブリーフが計画した20秒の製品動画を区別します。ブラウザーでAIを実行する機能もありません。

## 開く・再現する

HTTPで配信しindex.htmlを開きます。図とvideo/index.htmlは同じ12素材の大きさ・SHA-256と内容を照合します。動画は32秒・30fps・縦720×1280、横1280×720の別配置で、完全無音です。

```powershell
python -m http.server 8080
npm ci --ignore-scripts --no-audit --no-fund --prefix tools/motion-reel
python render-visual.py --out ../brief-review-portrait --width 720 --height 1280 --strip-at 10.2
python render-visual.py --out ../brief-review-wide --width 1280 --height 720 --strip-at 10.2
```

Python、Node20以上、Chrome、FFmpegとMotion Reelの依存が必要です。依存は未導入の場合だけ用意します。空の出力フォルダを使い、--stills-onlyで代表・連続フレームだけを描けます。render-visual.pyは一時コピーに映像の入口を置き、フォルダ全体の素材を配信するため、video/だけをprojectに指定する必要はありません。

元のapp.js/styles.css/samples.json/video/scene.jsは、既存のGit/公開と同じバイトで保持しています。元のWindowsのapp.jsとsamples.jsonはCRLF、Gitと公開はLFでした。内容が同じでもバイトとSHAは異なり、旧制作記録のsamples371724…はWindows原本、現在の公開原本859dd112…はLFを指します。両方の履歴を私的に保全し、今回の配布は既存の公開LFを引き継いでいます。旧indexはdesk.html、旧video/indexはvideo/legacy.htmlへ残しました。

## 原典と条件

studio-yebisu/studio-yebisu @bc2984ab4208e349aded79b3694cc2cb98b8a4a6、skills/brief-to-demo/SKILL.mdとLICENSEの公式2Gitblobと同じバイトをvendorに同梱。MIT License、Copyright(c)2026 Studio Yebisu。元のルートskills/brief-to-demoも同じ固定内容です。frontend-designはdbd4588…のApache2.0、Motion Reelは5619854…のMIT、Mck-ppt-design-skillはe190e08…のApache2.0を確認しています。それらの次の制作を実行・検証したという意味ではありません。

新しいOpus5.5の8原本の受領を、制作側の事実構造・既存のJSONと引き継ぎ文章の包装・再現スクリプト・描画・QA・掲載と分けています。原制作にはsource.zip/verification.jsonはなく、今回初めて包装します。確認記録はvisual-verification.jsonです。自動検査やエージェントの画面確認は、人の審美的承認、実機iOS/Safari/VoiceOver、200%ズーム、ブリーフの実用上の有効性の保証ではありません。クリップボード内容の再取得は未確認です。
