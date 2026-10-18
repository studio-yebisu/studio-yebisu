# Browser Use：手引きから実装、画面の操作、結果の受け取りへ

Browser UseはPythonでブラウザーを動かすライブラリです。同梱のskills/open-source/SKILL.mdはPython実装のための参照スキルで、話題ごとに読む文書を選びます。今回使ったのはActor APIとBrowser設定の文書です。スキル自体がブラウザーを操作するわけではありません。

元のOpusがrun_browser.pyを書き、制作担当がPythonを実行しました。事前に決めた手順を、Browser（BrowserSession）→Page→Elementの直接操作APIで実行。成功した操作はfill2・select_option2・check2・click5の11回、実DOMと6枚の画面PNGを記録しています。期待IDは照合専用で、出力は実DOMの値です。Agent.run、LLMの操作判断・要素探し・抽出、Cloudは実行していません。

文字「電源」は「電源なし」にも含まれるのでS02は12件。恵比寿・800円以内で4件、土曜・電源ありを加えてW01/W11の2件。S05の0件は正常な結果、S06のresetで12件に戻ります。条件は累積します。架空の作業席であり、実在施設の料金・予約ではありません。

今回の図は「手引き・動かす・受け取る」の3段階と5部品で説明します。5部品は今回の説明用整理で、全機能共通の構造ではありません。図と映像ではPythonやBrowser Useを新しく動かしません。元の入力・実出力・APIドライバー・原典・検証36ファイルを保持し、旧ビューアをdesk.html/desk.css/desk.jsとして残しました。旧ビューアは動画欄だけ現在の32秒図解へのリンクへ更新しています。

## 再現

この作例フォルダをHTTPで配信してindex.htmlを開きます。編集画面はvideo/index.html。18素材をconcept/manifest.jsonのバイト数とSHA-256で照合し、不一致なら図と主操作を止めます。既存実行を再度行う手順は元のREADME.mdとrun_browser.pyを参照してください。今回の動画の再現に元のBrowser Use実行は不要です。

```powershell
python -m http.server 8080
npm ci --ignore-scripts --no-audit --no-fund --prefix tools/motion-reel
python render-visual.py --out ../browser-review-portrait --width 720 --height 1280 --strip-at 15.4
python render-visual.py --out ../browser-review-wide --width 1280 --height 720 --strip-at 15.4
```

Python、Node20以上、Chrome、FFmpegと同梱Motion Reelの依存が必要です。依存は未導入の場合だけ用意します。出力は空の専用フォルダへ。--stills-onlyなら代表・連続フレームだけを描きます。32秒・30fps・音声なし。原制作のAPI検査はverification.json、今回の図と映像はvisual-verification.jsonに分けて記録しています。Opusの8執筆原本と、制作側によるコントラスト、冒頭の拡大、編集操作、説明、描画、確認、包装は区別しています。

## 出典

browser-use/browser-use @c75e8476e26d18b7617643bc2ae082fae8eae431、0.13.11。MIT License、Copyright(c)2024 Gregor Zunic。vendor/browser-use/LICENSEと公式参照文書を改変せず保持しています。独自の作例・架空データ・図・動画はMIT、Copyright(c)2026 Studio Yebisu。

実機iOS/Safari/VoiceOver、200%ズーム、人による審美的承認、クリップボード内容の再取得は未確認です。JSON保存はネイティブボタンの保存要求と原本URLのバイト一致を確認し、ブラウザー保存ツールによるファイル返却は確認できていません。
