# Scenario 3D Collection 作例：設定と出力をたどる3D素材集

ケース `scenario-3d-collection-example`／カタログ `resource-scenario-3d-collection`

## これは何か

**Scenario 3D Collection**（[scenario-labs/3d-collection](https://huggingface.co/datasets/scenario-labs/3d-collection)、CC BY 4.0）は、AIで生成された1,342件の3D作例と1,500点の出力ファイルを公開した素材集です。参照入力・プロンプト・生成設定・SHA-256のメタデータが付きます。

この作例では、そのうち**3件（カエル・宝箱・ランタン）**を選び、固定リビジョンから取得してハッシュを照合し、実物のGLBをブラウザーで回して見ます。**新しい3D生成は実行していません。** 配布済みの成果物の取得・照合・閲覧がこの作例のすべてです。

## 実際に確かめたこと（2026-10-24）

| 項目 | 結果 |
| --- | --- |
| 取得元 | 固定リビジョン `55b4c002b4c1529fc48da3dff98516c3069bfa3f` |
| 照合 | 3件の `output.glb`・入力PNG・プレビューJPGのSHA-256が、配布メタデータとすべて一致 |
| Blender検査 | 5.2.1 LTS（ファイル内スクリプトの自動実行は無効）。メッシュ各1・テクスチャ画像各1点。三角形はカエル34,998・宝箱36,506・ランタン38,155 |
| 範囲 | 1,342件中3件。全件の検証ではありません |

## 入力と出力

- **入力**：配布メタデータからの選定（プロンプト・生成設定・参照入力の確認）。約39GBの一括取得はしていません。
- **出力**：3件のGLB・入力画像・プレビューに加え、当サイトの表示確認用レンダリング（`render.png`）。レンダリングは照明・カメラ・表示倍率を変えた表示のためのもので、GLB本体のバイトは無改変です。

## ページと映像

- `index.html` — three.js 0.180.0の実ビューア。ドラッグで回転、モデル切替、ワイヤーフレーム切替。WebGLが使えない環境では実物のBlenderレンダリングを表示。
- `video/` — 26秒・無音の説明映像の編集ソース。実GLBをWebGLで描き、設定→取得・照合→実物表示の流れを見せます。

## ライセンスと帰属

| もの | 条件 |
| --- | --- |
| 3D素材（GLB・入力画像・プレビュー） | **Scenario**／[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。当サイトによる変更はありません（表示の正規化・照明・カメラのみ。バイトは無改変） |
| データセットのLICENSE | [同梱のコピー](third-party/Scenario-LICENSE) |
| この作例のページ・映像コード | [MIT](LICENSE) |
| three.js 0.180.0 | [MIT](vendor/three/LICENSE) |

別公開のHunyuan版393件はこの収録範囲に含まれず、別の利用条件が適用されます。

## 再現の目安

- GLBの照合：`samples.json`・`asset-sources.json` のSHA-256を、固定リビジョンのメタデータと比べてください。
- Blenderでの検査：`inspect_blender.py` が読み込みと統計の取得に使ったスクリプトです（ファイル内スクリプトの自動実行は無効で実行してください）。
- 全体取得（約39GB）は不要です。必要なファイルだけを選んで取得する手順が原典READMEの想定です。

## まだ確かめていないこと

- 1,342件全体の品質・画質・ゲーム・制作での適性。
- 実寸の保証（GLBの寸法は任意の読込座標です）。
- 実機のiOS Safari・VoiceOverでの表示・操作。

## ファイル

- `assets/<key>/` — model.glb（配布のまま）・input.png・preview.jpg・metadata.json・render.png（当サイトの表示用）
- `samples.json` — 公開用の記録（3件の設定・ハッシュ・統計）／`runtime-results.json` — 照合・検査の要約
- `asset-sources.json` — 素材の出所URL・SHA-256／`selected.json` — 選定の記録
- `inspect_blender.py` — Blender検査のスクリプト
- `vendor/three/` — three.js 0.180.0（無改変・MIT）

## 説明動画と編集ソース

26秒・30fps・音声なしの[縦動画](../../media/scenario-3d-collection-example.mp4)と[横動画](../../media/scenario-3d-collection-example-wide.mp4)、[編集ソース](video/index.html)を掲載しています。動画の再利用条件は[サイトのメディア利用条件](../../media-rights.html)を参照してください。
