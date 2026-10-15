# 納品メモの細部を整える — 編集できる28秒の解説

Opus5.5が制作したHTML/CSS/JavaScriptの構成です。`index.html` をHTTPで開くとプレビューできます。`storyboard.json` は場面と素材の設計、`../captures.json` は本物のブラウザー画面と切り抜く位置、`../outputs/two.json` は実出力です。画面の再描画や架空のログではなく、保存した実画面を編集しています。連続操作の録画ではありません。

28秒・1280×720・30fps・無音。window.seek(t)で任意時刻を描き、motionReadyで素材を読み、motionConfig/renderConfigの値を使います。実際に書き出したMP4はZIP内の `media/make-interfaces-feel-better-example.mp4` です。

作例ルートのREADMEの手順で `tools/motion-reel` の依存を導入し、一式を展開したルートから次を実行します。

```text
python examples/make-interfaces-feel-better-example/render.py --out renders/first
```

同梱レンダラーを使った実レンダー、任意時刻一致、代表フレームと連続フレーム、全デコード、ネイティブMP4の終端再生を確認しています。レビュー資料は `review/contact.png` と `review/`、範囲は `../verification.json`。自動検査やエージェントの視覚確認を、人による承認や作品の品質保証とは扱いません。

映像・デモ・素材・レンダラーはStudio Yebisuの独自制作（MIT、../LICENSEと../tools/motion-reel/LICENSE）。指針の原典はJakub Krehel、固定35545ea1512ad59fa463e6b1f95ca9c052981fe6、MIT（../vendor/make-interfaces-feel-better/LICENSE）。フォントや依存パッケージは再配布していません。
