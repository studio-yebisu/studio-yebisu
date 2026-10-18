# LangGraph：状態と工程をつなぎ、同じ続きへ

Pythonで共有状態と工程・条件を組むフレームワークです。6部品はStateGraph/条件の道/compile/InMemorySaver/interrupt/Commandという選んだAPIの説明用整理です。元のAIが実装を執筆し、制作担当がPythonで実行しました。実行時の5ノードは規則の関数で、AIやLLMを呼びません。

## 保存された3件を読む

index.htmlは21素材を大きさとSHAで照合して、元のjobsオブジェクトを図にします。HTTPSかループバックHTTPで開いてください。通常8000円と高額36000円はどちらも停止し、テストのtrue/falseを同じthreadへ渡して再開しました。30000円以上のフラグは拒否条件ではありません。返却日なしは見積も停止もなくneeds_inputで終わります。図やボタンからPythonを実行したり、承認を送信したりしません。

元のoutputs/runs.json37859B、result.md4677B、3件の実JSON13841/3921/13900B、入力と最終stateは同じです。新3JSONは元jobオブジェクトのUTF8/LF包装で、新推論やグラフ実行ではありません。request.txt2256Bは元の公開の再現依頼文です。元のグラフ・インストール・モデルは再実行していません。6/4/6チェックポイントは速さや品質の点数ではありません。

## 編集と描画

Python、Node20以上、Chrome、FFmpeg/ffprobeが必要です。source.zipは従来と同じくexamples/langgraph-example/とmedia/、公開brief-to-demo本文/通知を持つ展開ルート形式です。依存や環境・認証・モデル履歴は含みません。展開ルートでHTTP配信し、/examples/langgraph-example/を開けます。新32秒の再現は次です。

```powershell
python -m http.server 8080
npm ci --ignore-scripts --no-audit --no-fund --prefix examples/langgraph-example/tools/motion-reel
python examples/langgraph-example/render-visual.py --out renders/langgraph-portrait --width 720 --height 1280 --strip-at 14.2
python examples/langgraph-example/render-visual.py --out renders/langgraph-wide --width 1280 --height 720 --strip-at 14.2
```

空の出力先へ書きます。--stills-onlyは代表と連続画像だけ。--strip-atは指定秒の周囲12フレームで、14.2秒指定なら30fpsの14.0秒からです。window.seekは順番に依存しない任意時刻の図です。縦720×1280/横1280×720、32秒/30fps、無音。新たなLangGraph実行は不要です。

desk.htmlは元の全文ビューアです。旧28秒の編集ソースはvideo/legacy.htmlとlegacy.js/css/README/storyboardへ、元のrender.pyはその旧入口へ向けました。旧28秒の映像原本と元source.zipは私的な履歴へ保全しています。元READMEとverification.jsonは原制作時の記録、新図の技術確認はvisual-verification.jsonです。

## 原典と範囲

langchain-ai/langgraph@d4149cc1f5384364d1a21092b4c2f582a6e7af8f、MIT Copyright(c)2024 LangChain, Inc.。4Python版langgraph1.2.15/checkpoint4.3.0/prebuilt1.1.0/sdk0.4.7と172公式Gitblobのrawbytesを確認しました。元の157installedfiles確認/3実グラフ/2Opus受領と、新しい8原本のOpus執筆・制作側の事実整理/包装/補正/描画/QA/公開を分けます。

InMemorySaverは同一プロセスのメモリだけ。再開はreviewの先頭からで、interruptより前に副作用を置いていません。テスト回答は人の承認ではありません。永続化/再起動後の再開、LLM判断、LangSmith/Cloud、実予約/在庫確保/送信/決済、実機iOS/Safari/VoiceOver、200%ズーム、人の審美的承認、全入力や意味/性能、clipboard再取得は未確認です。ナレーション・音声ガイド・原稿・音源・音声トラックは作っていません。
