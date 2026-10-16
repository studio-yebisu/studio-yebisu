# 小さなモデルを、ゼロから育てる

[Train LLM From Scratch](https://github.com/FareedKhan-dev/train-llm-from-scratch/tree/bdd480a518094ca834e05ab32131dc126b522d3d)（固定コミット bdd480a、MIT）の学生向けCPUトラックを、原典のコードのまま実行する作例です。作例のために書いた英文96行だけで、BPEの語彙を作り、小さなTransformerを最初から学習し、学習前と800回更新後のモデルに同じ8つの書き出しを渡して続きを比べます。

ページ（`index.html`）は、保存した実行記録 `outputs/training-run.json` と3つの入力を読み、SHA-256と中身を確かめてから表示します。ページの中で Python・学習・AI は動きません。記録がまだない、または入力と合わないときは、理由と「もう一度読み込む」だけを出します。

## 何をする練習か

原典の [GPUなしで学ぶガイド](https://github.com/FareedKhan-dev/train-llm-from-scratch/blob/bdd480a518094ca834e05ab32131dc126b522d3d/docs/student/README.md) の順番どおりに進めます。

1. **データ**：`input/stories.txt` を原典の `split_text` が末尾12.5%付近の改行で学習側と検証側に分けます。
2. **BPE**：学習側の文だけで、バイト単位のBPEを語彙512の指定で学習します（実際の語彙数は実行記録に残ります）。
3. **学習前**：`train_transformer.py --steps 0` は一度も更新せずにモデルを保存します。これがランダムな初期値のままの「学習前」です。
4. **学習**：同じ設定・同じseedで `--steps 800`。同じ初期値から800回更新し、200回ごとに途中の状態も保存します。
5. **生成**：2つのモデルに、学習前に固定した8つの書き出しを渡し、最も確率の高いトークンを選ぶ設定（top_k 1）で48トークンずつ続けます。
6. **記録**：損失・重みのSHA-256・生成の全文とトークンID・コマンドと所要秒を1つのJSONに残します。

英文は名前・場所・物を入れ替える短い型の繰り返しで、後半の32行は前半と同じ行です。検証側の損失は同じファイルの末尾で測るため、汎化や文章の品質を表しません。出力が学習文の型に寄ることも、崩れることも、繰り返すこともあります。どの出力も選び直さず、手直しせずに載せます。

## ファイル

| ファイル | 内容 |
| --- | --- |
| `input/stories.txt` | 作例のために書いた英文96行（学習前に固定） |
| `input/prompts.json` | 8つの書き出し P01〜P08 と生成条件（学習前に固定） |
| `input/run-config.json` | seed・語彙数・モデル・更新回数などの設定（学習前に固定） |
| `run.py` | 原典のCLIを順に実行し、結果を照合して記録を書くスクリプト |
| `outputs/training-run.json` | 実CPU実行済みの記録（再実行では上書きしません） |
| `outputs/method.md` | 手順と、損失・生成の読み方 |
| `index.html` `style.css` `app.js` | 記録を読むページ |
| `request.txt` | 同じ練習を自分の英文で頼む依頼文 |
| `brief.json` | この作例の制作ブリーフ |
| `vendor/train-llm-from-scratch/` | 原典の固定コミットの48ファイル（無改変） |

## 手元で再現する

配布済みの記録を保ったまま再学習するには、まずこのフォルダで次を実行して、新しい作業用コピーを作ります。既存の同名フォルダがあれば止まり、上書きしません。モデルの保存先はこのコピーの外に指定します。

```bash
python -c "from pathlib import Path; import shutil; source=Path.cwd(); target=source.parent/'train-llm-rerun'; assert not target.exists(), 'train-llm-rerun already exists'; shutil.copytree(source,target,ignore=shutil.ignore_patterns('training-run.json','source.zip','node_modules','__pycache__','*.pyc'))"
cd ../train-llm-rerun
```

Python 3.10 以上と、CPUだけのPCで動きます。GPUとCUDAは要りません。

```bash
python -m venv .venv
```

仮想環境を有効にします。

```powershell
# Windows（PowerShell）
.venv\Scripts\Activate.ps1
```

```bash
# macOS・Linux
source .venv/bin/activate
```

今回のWindows実行ではCPU版を明示して導入しました。Windows/Linuxで同じCPU構成を使う場合は、先に次を実行します。macOSでは通常のrequirementsから導入し、実行はCPUを指定します（macOSでの実行は未確認）。

```bash
# Windows / Linux：今回使ったCPUビルドを明示
python -m pip install torch==2.11.0 --index-url https://download.pytorch.org/whl/cpu
```

```bash
python -m pip install -r requirements.txt
```

学習を実行します。保存先は空のフォルダで、このフォルダの外に置きます。

```bash
python run.py --artifact-dir ../training-artifacts
```

終わったらページを開きます。

```bash
python -m http.server 8866
```

ブラウザーで `http://localhost:8866/` を開きます。入力のSHA-256を確かめるため、HTTPS か localhost で開いてください。

- 依存の導入にはネット接続が要ります。`run.py` の実行中は、データのダウンロード・事前学習済みの重み・外部APIを使いません。
- `../training-artifacts` には HDF5・tokenizer.json・チェックポイント・各コマンドの完全なログが入ります。このフォルダの外なので配信されません。公開する記録には、そのハッシュとバイト数だけを書きます。
- `outputs/training-run.json` が既にあると、`run.py` は上書きせずに止まります。やり直すときは、記録を別の場所へ移し、空の保存先を指定してください。
- どれかのコマンドが0以外で終わるか、確認が1つでも通らなければ、記録は書かれません。理由は端末と保存先の `logs/run-failure.txt` に出ます。
- 所要秒は実行したPCで測った経過時間です。性能比較の値ではありません。環境と依存の版は記録の `environment` に残ります。

## 原典をどう使ったか

- `scripts/prepare_tiny_data.py`・`scripts/train_transformer.py`・`scripts/generate_text.py` は、改変せずにCLIとして実行します。`run.py` は48ファイルのSHA-256を実行の前後で確かめます。
- 8つの書き出しは、`generate_text.py` の `load_trained_model` で読んだモデルの `generate` と、原典の `safe_decode` で文字にします。P01 は同じ条件の `generate_text.py` のCLIも実行し、全文が一致することを確かめます。
- 原典の TinyStories や Tiny Shakespeare のダウンロード、GPU向けの preset、SFT・報酬モデル・DPO・PPO・GRPO・量子化・ベンチマークは使っていません。

## 制作とライセンス

- `run.py`・ページ・解説文・依頼文は Claude Opus 5.5 が書きました。続きの文章は、この作例で学習した小さなTransformerが生成したもので、Claude の出力ではありません。同じ練習を別のAIに頼む場合、その利用環境は別に必要です。
- 作例のコード・文章・英文・書き出し：MIT License（Copyright (c) 2026 Studio Yebisu）。`LICENSE` を参照。
- `vendor/train-llm-from-scratch/`：FareedKhan-dev/train-llm-from-scratch の固定コミットのファイルで、MIT License（Copyright (c) 2025 Fareed Khan）。原典の `LICENSE` をそのまま同梱しています。


## この作例で実際に確認した実行

原典48ファイルと入力3ファイルを固定し、原典のデータ準備・0回更新・800回更新・P01の学習前後の生成CLIをCPUで実行しました。Opus納品のrun.pyと同じ53ファイルを固定した私的コピーで実行し、最終納品とバイト一致を確認してから実行記録を受領しています。学習のやり直しや出力の選別はしていません。

実モデルは135,552パラメータ、語彙は上限512に対して実417、重みの出力行は448（余り31）です。83行・3,072トークンを学習、末尾13行・483トークンを検証用に分けました。検証側13行すべてと同じ文が学習側にも含まれます。損失6.1135から0.1900という値は文型を覚える練習の記録で、独立した汎化や知識の評価ではありません。800回のCLI実行はこのPCで23.103秒（初期評価・最後の評価・保存を含む）でした。他のPCの速度は表しません。

学習前が同じseedの新規初期値であること、実HDF5が原典の分割・符号化と完全一致すること、8入力×学習前後の16出力の全文・トークンIDが再生成と一致することを、別の検証コードでも確認しました。同じ7個の検証トークン窓448トークンを両モデルへ渡した結果もoutputs/independent-checks.jsonに残しています。P08「What is the capital of Japan?」の後は物語の文が続き、質問には答えません。

配布済みのoutputs/training-run.jsonを保ったまま再実行する場合は、必要な入力・run.py・requirements.txt・vendor/を新しい作業用フォルダへコピーしてから実行してください。空の外部保存先を使い、既存の記録やモデルを上書きしません。動画と公開画面の最終確認はverification.jsonに別記します。


公開版の動画は28秒・1280×720・30fps・840フレーム・無音です。8つの入力素材のSHA-256、代表/連続フレーム・360px表示・同時刻の別順/新ページPNG一致・全デコード・実MP4終端を制作担当が確認しました。自動検査とエージェントによる視覚確認で、人による承認や実機iOS確認ではありません。最終範囲はverification.jsonを参照してください。
