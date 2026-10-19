# LivePortrait 実行例：実装メモ

状態：コードとジョブ定義は作成済み、**実行はまだしていません**。この文書には結果・画質・動画の評価は含みません。

## LivePortrait とは

LivePortrait は Kuaishou（KlingTeam）が公開している肖像アニメーション手法の公式 PyTorch 実装です（論文 arXiv:2407.03168、コードは MIT ライセンス）。1 枚の顔画像から外観特徴と暗黙的な 3D キーポイントを推定し、そのキーポイントを動かして特徴をワープ・デコードすることで新しいフレームを生成します。上流のフルパイプラインには、顔検出とクロップ、駆動動画からの動き抽出、stitching と目・口の retargeting、元画像へのペーストバック、Gradio UI が含まれます。

## この例で使う範囲

- 上流：`KlingTeam/LivePortrait` @ `9b294b3d0536135442ea73cb01e6cb3ca7029dd3`。フルチェックアウトから、無改変の `src/live_portrait_wrapper.py` の `LivePortraitWrapper`（HUMAN）と `src/config/inference_config.py` の `InferenceConfig` を import します。`models.yaml` も上流のものをそのまま使います。
- 重み：`KlingTeam/LivePortrait` @ `82a4fa6735ca58432b6ce39301b4b9ee066dea47`（MIT、ゲートなし）の 5 ファイル。`InferenceConfig` の `checkpoint_F/M/W/G/S` はすべて重みルートを明示的に指しています。
- 呼び出すのは元の wrapper メソッドだけです。上流コード、`torch.load`、サードパーティのモジュールには、モンキーパッチも差し替えも改変も加えていません。
- 実行環境：CPU・float32、`flag_use_half_precision=False`、`flag_do_torch_compile=False`、torch のスレッド数は intra/inter とも 4、seed は 20261020。

実行しないもの：`LivePortraitPipeline`／`inference.py`／Gradio、クロッパー（InsightFace の検出モデル、`landmark.onnx`）、駆動動画からの動き抽出、音声・リップシンク、比率ベースの目・口 retargeting、ペーストバック、動物モード、ComfyUI。上流のフルパイプラインでは顔検出が初期化されますが、この部分集合では初期化されません。InsightFace の検出モデル（非商用ライセンス）は取得も使用もしていません。

## 役割分担

- 作成側（AI、Claude Opus 5.5）：`prepare_input.py`、`run_example.py`、`inputs/jobs.json`、本文書を書きました。コードの実行も、結果の作成もしていません。
- オペレーター：専用環境（Python 3.11.15、torch 2.6.0+cpu、numpy 1.26.4、Pillow 11.3.0、opencv 4.10.0.84、scipy 1.13.1、PyYAML 6.0.1、rich 13.7.1、PATH 上の FFmpeg／ffprobe）を用意し、上の 2 本のスクリプトを別途実行します。コマンドと標準出力の生記録はオペレーター側の非公開記録として残し、公開はしません。

## 入力画像と手動クロップ

- 元画像：上流リポジトリに同梱の `assets/examples/source/s9.jpg` で、オペレーターがバイト単位でそのまま `inputs/mona-lisa-original.jpg` にコピーしました（sha256 `84a6bfcb…f43f2a`）。レオナルド・ダ・ヴィンチ《モナ・リザ》の複製画像です。AI が生成した画像でも、新しい人物の写真でも、録画でもありません。
- `prepare_input.py` は author 側のラッパーで、上流の自動顔検出の代わりになるものです。PIL のエッジ座標で固定のクロップ枠 `[110, 100, 610, 600]` を切り出し（500×500）、Pillow LANCZOS で 512×512 RGB にリサイズして `inputs/portrait-crop.png` に保存します。元画像は読み込むだけで変更せず、既存の出力ファイルがあれば処理を拒否します。寸法・ハッシュ・クロップ情報は標準出力に JSON で出します。
- `run_example.py` はこのクロップを元画像からメモリ上で再計算し、保存済み PNG とピクセルが一致しなければ停止します。
- 512→256 の縮小は、上流の `prepare_source` 内部の `cv2.resize` が行います。

## モデル内部の流れ

| 記号 | 上流の名前 | この例での役割 |
|---|---|---|
| F | `appearance_feature_extractor` | 外観特徴ボリューム f_s を **1 回だけ**抽出し、2 ジョブ・全 72 フレームで再利用する |
| M | `motion_extractor` | 1 回実行。正準キーポイント x_c,s（21 点）、pitch/yaw/roll、表情オフセット exp、scale、t を推定する |
| — | `transform_keypoint` | x = scale·(x_c,s·R + exp) + t（t は x, y 成分のみ）。元のポーズで 1 回計算して x_s を得て、以降は全フレームで共有。各フレームで目標の x_d を計算する |
| S | `stitching` | x_s と x_d から補正量（exp の補正と tx, ty）を推定し、x_d に加える |
| W | `warping_module` | x_s → x_d（stitching 後）の対応から f_s を変形する |
| G | `spade_generator` | 変形後の特徴を 512×512 の画像にデコードする |
| — | `parse_output` | [0,1] にクリップして uint8 に変換する（上流の処理） |

21 個の点は M が学習した**暗黙的な** 3D キーポイントです。目や口といった解剖学的なランドマークではありません。

フレームごとに、推定された `source_info` を clone し、推定 yaw（度）にスケジュール値を足すだけです。scale・t・pitch・roll・exp と x_c,s は推定値をそのまま保持し、キーポイントに任意のオフセットを直接加えることはしていません。上流の Gradio のポーズ編集も推定 yaw に変化量を加える方式です（`src/gradio_pipeline.py`）。ただし、この例は Gradio を経由しません。

呼び出し回数（予定）：`LivePortraitWrapper` 1、`prepare_source` 1、`get_kp_info` 1、`extract_feature_3d` 1、`transform_keypoint` 73、`stitching` 72、`warp_decode` 72、`parse_output` 72。実際の回数はランナー側で各呼び出しが戻った時点に数えて記録し、予定と一致しなければ失敗とします。内部トレースは行いません。

## 角度の意味

- ジョブは 2 つです。`yaw08`（振幅 8°）と `yaw16`（振幅 16°）。どちらも同じクロップ、同じ推定値、同じスケジュール形状を使い、stitching は有効です。
- 各ジョブ 36 フレーム、12 fps、3 秒。オフセットは `round(振幅·sin(2π·i/35), 6)` で、最初と最後のフレームは明示的に 0 にしています。
- この度数は**モデルの推定 yaw に加える入力の制御値**です。生成画像の頭部角度を測った値ではなく、角度の精度は検証していません。推定 yaw そのものもモデルの推定値です。
- オフセット 0 のフレームも、stitching・W・G を通って生成されたフレームです。元画像ではありません。ベースラインとして別に推論することもしていません。

## 読み込むが実行しないもの

`stitching_retargeting_module.pth` の 1 ファイルには、stitching・lip・eye の 3 つのネットワークが入っています。上流の `LivePortraitWrapper` は 3 つともロードしますが、この例が呼ぶのは stitching だけです。lip と eye の retargeting は呼びません。つまり、ロードされるチェックポイントは 5 ファイル（F、M、W、G、S）で、実行されるネットワークは F、M、W、G と stitching です。

## 出力（実行後に作られるもの）

- 非公開の `--frames-dir`：各ジョブ 36 枚の 512×512 RGB PNG（`yaw08/frame-000000.png` …）と、stitching 前後のキーポイント配列（`.npy`）。全フレームは公開しません。
- 公開の `--output`：
  - `yaw08/frames/frame-000000.png` などの代表フレーム。各ジョブでインデックス 0, 9, 18, 26, 35 の 5 枚を、生成フレームからバイト単位でそのままコピーします。
  - `yaw08.mp4` と `yaw16.mp4`。36 枚の PNG を順番どおりに FFmpeg に渡し、libx264・yuv420p・faststart・12 fps・音声なし（`-an`）で作ります。補間、トリミング、エフェクト、顔のオーバーレイ、正規化は行いません。yuv420p への変換と H.264 圧縮は、`parse_output` とは別の後段の処理です。
  - `results.json`：ランナーが実測値をまとめたファイルです。上流のネイティブ出力ではありません。中身は、ピン、ハッシュ、推定ポーズ、21 点キーポイント、テンソル形状、フレームごとの数値と sha256、ffprobe の結果（フレーム数 36、512×512、音声ストリーム 0）、呼び出し回数、1 回の CPU 実行の経過時間（ベンチマークではない）です。すべての検査に通った場合だけ書き出されます。
- 例外が起きた場合は、その時点で停止します。途中までの生成物はそのまま残し、`results.json` は作りません。

## 再現手順（プレースホルダー）

```bash
git clone https://github.com/KlingTeam/LivePortrait <upstream>
git -C <upstream> checkout 9b294b3d0536135442ea73cb01e6cb3ca7029dd3
huggingface-cli download KlingTeam/LivePortrait --revision 82a4fa6735ca58432b6ce39301b4b9ee066dea47 \
  --include "liveportrait/base_models/*" "liveportrait/retargeting_models/*" --local-dir <weights>

# ケースルート（inputs/ がある場所）で実行
python prepare_input.py
python run_example.py --upstream <upstream> --weights <weights> --jobs inputs/jobs.json \
  --output <公開出力ディレクトリ> --frames-dir <非公開フレームディレクトリ>
```

実行にはフルの上流チェックアウトと、固定した 5 つの重みファイルが必要です。`vendor/liveportrait/` は読むために選んだ上流ファイルの一部をそのままのバイトでコピーしたもので、アプリケーション全体ではないため、これだけでは実行できません。ランナーは実行前に、上流ファイルの git blob、重みの sha256、各ライブラリのバージョンを照合し、一致しなければ停止します。

## 未確認のこと

表示品質、画質、動画の見え方、自然さ、同一性の保持は、作成時点ではいずれも確認していません。実行後に別途確認します。人による承認も、まだ受けていません。
