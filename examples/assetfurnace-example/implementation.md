# assetfurnace-example 実装メモ

カタログ: `resource-assetfurnace`
原本: [Bingeljell/image-to-3dlab](https://github.com/Bingeljell/image-to-3dlab)（AssetFurnace、旧 Image to 3D Lab）コミット `91879333e88a0571945b15b0e21e4bc95ec59e31`。CHANGELOG の最新は 0.4.4（2026-10-14）ですが、README の冒頭には 0.4.0 の下書き注記が残っています。リリースタグではなく、このコミットで特定します。

## 想定する依頼（架空）

> 手元にあるCC0の木箱をWeb3Dで試すため、形を変えずテクスチャ上限1024/512/256の実ファイルと容量を比較したい。

既存の3Dモデルのテクスチャを圧縮する作業です。画像から3Dを生成する依頼でも、その結果でもありません。

## 役割と範囲

| 段階 | 担当 | 内容 |
|---|---|---|
| 原本と入力の用意・検証 | 親作業（済） | 公式 Git blob 532 件と原本のバイト一致、入力5ファイルの複製 |
| 実装 | claude-opus-5-5 | `prepare_input.py`・`run_example.py`・`inputs/jobs.json`・この文書を書いた。実行はしていない |
| 実行 | オペレーター | 下記コマンドを実行する |
| サイト・動画・ブラウザQA | 今後の段階 | UI と動画はまだない。テストも人による承認もまだ行われていない |

**実行するもの**

1. **入力準備（Blender、AssetFurnace ではない）**: `prepare_input.py` を Blender 5.2.1 で1回だけ実行し、glTF・.bin・テクスチャ3枚を1つの GLB にまとめます。空のファクトリーシーンに読み込み、メッシュ3つ・三角形6576を確認してから、Blender 標準の glTF エクスポーターで書き出します。結合・間引き・リメッシュ・テクスチャ差し替え・レンダリングはしません。
2. **圧縮（AssetFurnace 原本）**: 無改変の `scripts/compress_glb_textures.py` を、同じ GLB から設定だけ変えて3回実行します（cap1024 / cap512 / cap256）。必要なのは Python と Pillow だけです。

**実行しないもの**: `pipeline.py`、画像→3D 生成（Pixal3D・TRELLIS.2・Hunyuan3D・SF3D）、Finish のリトポロジー（事前確認で Blender 5.2.1 に `quadriflow_remesh` が無いことが分かっています。回避策の追加や成功の偽装はしていません）、リペイント、Pixel Match、ベイク、リギング、ゲームへの組み込み、ComfyUI（8190番で別の作業が動いています。接続も変更もしません）。モデルの重みのダウンロードや読み込み、ライセンスへの同意、設定ファイルの初期化もしません。

## 3つのジョブ

すべて `--format png --quality 90 --map-quality 90` を指定し、上限 N を3つの引数に同じ値で渡します。

| ID | `--max-size`（カラー） | `--map-size`（データ） | `--normal-size`（法線） |
|---|---|---|---|
| cap1024 | 1024 | 1024 | 1024 |
| cap512 | 512 | 512 | 512 |
| cap256 | 256 | 256 | 256 |

- PNG にしたのは、データマップに JPEG の量子化を新たに加えないためです。縮小すれば画素は変わるので、視覚的に無劣化とは言いません。
- 原本は、再エンコードした結果が元より**小さいときだけ**画像を置き換えます。このため PNG を指定しても 1k の JPEG がそのまま残ることや、GLB 全体が入力とまったく同じになることがあります。結果は推測せず、実際のファイルを測ります。
- 法線マップはデータ画像の一つで、4つ目の分類ではありません。画像の役割（カラー/データ）はマテリアルのテクスチャ割り当てから数えます。

## 再現コマンド

`site/` フォルダから、Python 3.11 と Pillow 11.3.0 で実行します。

```powershell
python -I run_example.py `
  --upstream ..\upstream `
  --blender "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" `
  --out runs\run-01
```

- `--out` は、このフォルダの中にある新規または空のフォルダを指定します。記録されるパスを相対パスにするためです。
- `--threads` の既定値は4です。スレッド関連の環境変数を4にし、Blender にも `--threads 4` を渡します。OS の標準 API で使える場合は、このプロセスとその子プロセスだけを4コアに固定します。ほかのプロセスには触れません。
- Blender は次の形で1回だけ呼びます。
  `blender --background --factory-startup --threads 4 --python-exit-code 1 --python prepare_input.py -- <gltf> <out>/input/packed_input.glb <out>/preparation.json`
- 原本 CLI は `python -I <upstream>/scripts/compress_glb_textures.py <packed> <out>/outputs/<id>.glb ...` の形で3回呼びます。
- 再試行はしません。失敗した場合は `results.json` の `status` を `failed` にし、どこで失敗したかを記録します。

## 出力

```
<out>/input/packed_input.glb   Blender が書き出した入力GLB（実物）
<out>/preparation.json         Blender が書いた記録（バージョン、読み込んだメッシュ・三角形数、範囲、変換）
<out>/outputs/cap1024.glb ほか  原本 CLI が書いた GLB（実物）
<out>/results.json             公開用の測定記録
<out>/private/                 標準出力・標準エラーの全文、絶対パスを含む呼び出し記録（非公開で保管）
```

`results.json` は実行ラッパーが測った値をまとめたもので、モデルの出力でも原本のネイティブ JSON API でもありません。原本 CLI はテキストと GLB しか出力しません。そのテキストは `private/` に別に保存し、公開記録にはサイズとハッシュだけを載せます。

## 何を確かめ、何を確かめないか

`run_example.py` は自前の GLB 2.0 パーサーで読み直します。原本の `compress()` は検査のためには呼びません。

- **形が変わっていないこと（バイト比較）**: 3つの出力それぞれについて、メッシュ・アクセサ・ノード・シーン・マテリアル・テクスチャ・サンプラーの JSON と、画像以外のすべての bufferView の中身が入力 GLB と一致することを確認します。画像のバイト範囲のオフセットと長さは変わってよいものとします。
- **画像**: Pillow で実際にデコードし、宣言された MIME・ファイル先頭のマジックバイト・デコード形式が一致するかを見ます。あわせて寸法、埋め込みバイト数、置き換えられたか残されたか、GLB 全体が入力とバイト単位で同じかを記録します。
- **入力準備**: 元の glTF と比べて、ノードごとのメッシュ範囲と変換が許容誤差 1e-5 以内で一致するか、テクスチャのスロットが同じかを確認します。
- **確かめないもの**: バイトが一致しても、見た目が同じこと、ゲームでそのまま使えること、表示性能が良いことにはなりません。見た目は将来の段階で目で確認します。原本 README にある別アセットの画質・容量の数値は、この例の結果としては扱いません。経過時間はこのマシンでの壁時計時間で、性能の指標ではありません。

## ライセンス

- AssetFurnace（image-to-3dlab）のコード: Apache-2.0。再配布するときは `NOTICE` を残し、リポジトリへのリンクを付けます。
- 木箱モデル: Poly Haven「[Wooden Crate 01](https://polyhaven.com/a/wooden_crate_01)」、作者 James Ray Cock、CC0。素材の条件とコードのライセンスは別のものです。
- この例のラッパー（`prepare_input.py`・`run_example.py`）: MIT。
- Pillow と Blender は、それぞれのライセンスでインストール済みの別の依存物です。同梱はしていません。
- モデルの重みは使っていないので、モデルのライセンスに同意したとは主張しません。
