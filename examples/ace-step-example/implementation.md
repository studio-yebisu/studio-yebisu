# ACE-Step v1 実行例：架空パズルゲームの20秒BGMを1回だけ生成する

ケース `ace-step-example` / カタログ `resource-ace-step`

## 役割と現状

- この3ファイル（`run_example.py`、`inputs/jobs.json`、`implementation.md`）は Claude Opus 5.5（`claude-opus-5-5`）が書いた。作成者はモデルを実行していない。
- モデルを動かすのはオペレーター。実行はまだ行われておらず、WAV も計測値もまだ無い。
- 試聴も品質確認もまだしていない。生成後も、数値の計測と聴いた印象は別々に記録する。
- 公開サイトのブラウザは、保存済みの結果 JSON を読んで WAV を再生するだけ。ブラウザでモデルを動かさず、API キーもアカウント連携も要らない。

## 使う版

| 項目 | 固定値 |
| --- | --- |
| ソース | [ace-step/ACE-Step @ 1bee4c9f](https://github.com/ace-step/ACE-Step/tree/1bee4c9f5b43e30995f8d4d33b3919197ce1bd68)（`setup.py` のパッケージ `ace_step` 0.2.0） |
| モデル | [ACE-Step/ACE-Step-v1-3.5B @ 82cd0d7b](https://huggingface.co/ACE-Step/ACE-Step-v1-3.5B/tree/82cd0d7b6322bd28cd4e830fe675ddb6180ce36c)（公開・ゲートなし・Apache-2.0） |
| API | `acestep.pipeline_ace_step.ACEStepPipeline` を改変せずに使う |

使うのは元の **ACE-Step v1（3.5B）** で、2026-01-28 に公開された最新の **ACE-Step v1.5** ではない。v1.5 のコード・重み・手順はこの例に含めない。

## 実行するもの・しないもの

する:

1. `ACEStepPipeline(...)` を作り、`load_checkpoint(<モデルディレクトリ>)` を1回、`__call__(...)` を1回だけ呼ぶ。
2. ソース自身が WAV と `*_input_params.json` を保存する。ランナーはどちらも書き換えない。

しない:

- Gradio UI（`acestep` コマンド）、API サーバ（`infer-api.py`）、ComfyUI、学習、LoRA。
- audio2audio・retake・repaint・edit・extend、追加の生成、別シードでの試行。
- 正規化・フェード・トリミング・リサンプリング・ループ加工。
- MERT・m-hubert の実行。README によると、これらは学習時に表現を揃える（REPA）ためのもので、推論時に `load_checkpoint` が読み込むのは `ace_step_transformer`、`music_dcae_f8c8`、`music_vocoder`、`umt5-base` の4つだけ。
- ダウンロードと認証。`HF_HUB_OFFLINE=1` と `TRANSFORMERS_OFFLINE=1` を設定し、4つのサブディレクトリが揃っていなければ読み込み前に止める（ソースが持つ `snapshot_download` へのフォールバックには入らない）。

## ジョブ（`inputs/jobs.json`）

- 依頼（架空）：架空のパズルゲーム「こもれび小箱」向けの、20秒のオリジナル・インストゥルメンタルBGM。
- `labels` は日本語の説明でモデルには渡さない。`api_params` は `ACEStepPipeline.__call__` の実在の引数だけで、`save_path` を除く全引数を明示している。存在しない引数を入れたり、どれかを書き漏らしたりするとランナーは止まる。
- 主な値：`task="text2music"`、`format="wav"`、`audio_duration=20.0`、`lyrics=""`、`batch_size=1`、`infer_step=27`、`scheduler_type="euler"`、`cfg_type="apg"`、`guidance_scale=15.0`、`manual_seeds="20261020"`、`retake_seeds="20261020"`。
- guidance と ERG まわり（`omega_scale=10.0`、`guidance_interval=0.5`、`guidance_interval_decay=0.0`、`min_guidance_scale=3.0`、`use_erg_tag/lyric/diffusion=true`、`guidance_scale_text/lyric=0.0`）はソースの既定値をそのまま書いてある。既定値との差分はランナーが `inspect.signature` で記録する。
- シードは文字列で渡す。`set_seeds` は数字だけの文字列を int に変換する。
- ジャンル・テンポ・楽器・雰囲気は要望で、出力がそうなったかは測っていない。

## 準備

1. Python 3.11 の専用環境を用意し、固定コミットの `requirements.txt` に沿って依存を入れる（この例のファイルはインストール作業をしない）。`ace_step` 自体はグローバルにインストールしない。ランナーは `--upstream` を `sys.path` の先頭に追加し、`acestep` がそこから読み込まれたことを確認する。
2. 固定リビジョンのモデルをローカルディレクトリに置き、その直下に4つのサブディレクトリがある状態にする。
3. モデルのピン記録 JSON を用意する。形式：

```json
{
  "repo_id": "ACE-Step/ACE-Step-v1-3.5B",
  "revision": "82cd0d7b6322bd28cd4e830fe675ddb6180ce36c",
  "files": [
    {"path": "umt5-base/config.json", "bytes": 848, "sha256": "<64桁の小文字16進>"}
  ]
}
```

`repo_id` と `revision` は書いてあれば照合し、無ければ記録だけする。`files` には4つのサブディレクトリ内のファイルをすべて載せる。ランナーは読み込み前に次を確認する。

- ディスク上の全ファイルについて、サイズと sha256 がピン記録と一致する。
- `jobs.json` に固定した公式ツリーの値と一致する（LFS ファイルは sha256、通常ファイルは git blob sha1）。
- サブディレクトリ内にピン記録に無いファイルが無い。

## 実行コマンド

`site` ディレクトリで実行する。ファイル名はこのまま使う。

```powershell
python run_example.py `
  --upstream <ACE-Step 1bee4c9f のチェックアウト> `
  --model-dir <ACE-Step-v1-3.5B 82cd0d7b のローカルディレクトリ> `
  --model-pin-record <モデルピン記録.json> `
  --jobs inputs/jobs.json `
  --out <空または存在しない出力ディレクトリ> `
  --device cpu `
  --threads 4
```

- 今の GPU は承認済みの別作業で使われているので、まず CPU で動かす。`--device cpu` は torch を import する前に `CUDA_VISIBLE_DEVICES=-1` を設定し、float32 で動かす。`--device cuda` は bfloat16 で、GPU が空いたときだけオペレーターの判断で使う。
- README の速度表は GPU での値。CPU（float32）での所要時間は見積もらず、実測をそのまま記録する。
- `ACE_PIPELINE_DTYPE` が設定されていると、ソース内で dtype が上書きされるので止める。

## 出力（`--out` 以下）

| パス | 書くもの | 内容 |
| --- | --- | --- |
| `audio/cozy-puzzle-bgm_seed20261020.wav` | ソース | `save_wav_file`（`torchaudio.save`、soundfile バックエンド） |
| `audio/cozy-puzzle-bgm_seed20261020_input_params.json` | ソース | ソースが WAV の隣に保存する入力記録（絶対パスを含む） |
| `private/raw-return.json` | ランナー | `__call__` の戻り値そのまま（非公開） |
| `private/run-record.json`、`private/upstream-log.txt` | ランナー | 絶対パス・実行環境・ソースのログ（非公開） |
| `public/return.public.json` | ランナー | 戻り値のパスを `--out` からの相対パスにした公開用の写し |
| `execution-summary.json` | ランナー | 成功したときだけ書く。パスは相対パス |
| `failure.json` | ランナー | 失敗したときだけ書く。段階・例外・切り詰めたトレースバック・その時点のファイル一覧（成功の代わりにはならない） |

`execution-summary.json` には次を分けて記録する。

- ソースとモデルの照合結果、実際のバージョン、device・dtype・スレッド数。
- 要求した `api_params` と、ソース既定値との比較。
- `__call__` の呼び出し回数（1回でなければ失敗）、ランナー側の時間計測、ソース自身が返す `timecosts`。
- 境界観測：`get_text_embeddings`・`text2music_diffusion_process`・`latents2audio`・`save_wav_file` について、入口と出口の時刻と、引数・戻り値の形。サブクラスが `super()` を呼び、元の戻り値をそのまま返すだけ。アテンションや各ステップの挙動、音楽の質を測ったものではない。`get_text_embeddings_null` は観測していない。
- 保存ファイルの sha256・バイト数。
- WAV の実測値（soundfile/numpy）：フレーム数・サンプルレート・チャンネル数・サブタイプ、有限値かどうか、ピーク・RMS、|x|≥1 のサンプル数、冒頭0.5秒と末尾0.5秒の値。
- 要求した長さ（20.0秒）と実際の長さとその差。長さはソースの潜在フレーム計算とデコードで決まり、20.0秒ちょうどとは限らない。ランナーは長さを揃えない。

## 主張しないこと

プロンプトの内容や波形の統計からは、次のことを言わない。

- 既存作品との類似が無い（オリジナルである）こと
- ボーカルが無いこと
- ノイズが無いこと
- 終わり方がなめらかなこと、ループできること
- 要望したジャンル・楽器・雰囲気・テンポになっていること

試聴の結果は、誰がいつ聴いたかとあわせて別に記録する。

## ライセンスと再配布

- ACE-Step のコードは [Apache License 2.0](https://github.com/ace-step/ACE-Step/blob/1bee4c9f5b43e30995f8d4d33b3919197ce1bd68/LICENSE)、モデルは Hugging Face で `apache-2.0` と表示されている。
- 公式 README は、生成物のオリジナリティを確認すること、AI を使ったことを明示すること、保護された様式や素材を使う場合は許諾を得ることを勧めている。公開するときは AI 生成であることを明記する。
- モデルの重み、Python 環境、キャッシュはこの例と一緒に再配布しない。公開するのは生成された WAV と、パスを相対化した結果 JSON だけ。
