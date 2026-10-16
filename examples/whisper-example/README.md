# しおり工房 字幕デスク（Whisper作例）

音を聞いて、字幕を整える。保存済みの Whisper 出力をブラウザーで編集する作例です。

作例用に書いた架空の「しおり工房」の編集指示を手元の Windows 音声で読み上げ、固定版の [openai/whisper](https://github.com/openai/whisper/tree/86098128c0b4f24f0e2aa2994de830614b474227)（コミット `86098128c0b4f24f0e2aa2994de830614b474227`）の base モデルで、CPU を使って1回だけ転記します。画面はその保存済みの出力を読み、区間を聞き直しながら文を直して、時刻はそのままの SRT で保存します。

> **実行・技術確認済み。** 独自の合成音声21.014063秒を固定版Whisper base/CPU4threadsで1回転記し、5区間・6形式を保存しました。実ブラウザーで原稿参照による3区間の修正とSRT/TXT保存を照合。音声の聴取と時刻精度は未確認です。最新の範囲は verification.json を参照してください。

## 操作の流れ

1. **音声を聞く** — 画面上部の音声を、ブラウザー標準の再生ボタンで聞きます。自動では再生しません。
2. **区間を選ぶ** — Whisper が返した区間（id・時刻・文）の一覧から一つ選ぶと、音声の再生位置がその区間の頭へ移ります。再生は自分で始めます。
3. **原出力と原稿を見比べる** — 選んだ区間の Whisper の原出力が編集欄の下に出ます。読み上げた原稿は「読み上げた原稿」を開くと読めます（原稿は Whisper に渡していません）。
4. **一つの文を直す** — 「字幕の文」で選んだ区間の文だけを直します。改行は自分で調整できます。時刻は Whisper の推定値のままです。直すと「編集中」になり、「この区間を元に戻す」で原出力に戻せます。
5. **SRT を保存する** — 「編集したSRTを保存」で、全区間を1から連番にした SRT をブラウザーのダウンロードに渡します。区間の数と時刻は原出力と同じで、変わるのは直した文だけです。「原出力SRT」は Whisper の書き出しそのものです。

## ブラウザーでしていること・していないこと

- ページを開いても Whisper は動きません。ブラウザーの中での推論、音声のアップロード、新しい転記はありません。サーバーもいりません（静的ファイルを配るだけ）。
- 編集はブラウザーの中だけです。どこにも送らず、localStorage などにも残しません。再読み込みすると消えます。
- 実際の転記は、制作側が手元で `run_transcribe.py` を実行して行います（重みの取得が先に必要です）。

## 入力

- `input/script.json` — 作例用に書いたオリジナルの原稿4文と、音声の出どころ。`reference_text` は人が転記と見比べるためのもので、Whisper には渡しません（`initial_prompt` なし）。
- `input/review-ja-source.wav` — `make_input.ps1` が Windows の System.Speech で、インストール済みの **Microsoft Haruka Desktop**（rate -1・volume 100）に読ませた合成音声です。人の録音・会議・実在の話者ではありません。外部のサービスやアカウントは使いません。
- `input/review-ja.wav` — 上を ffmpeg で 16kHz・モノラル・PCM16 にした、転記に使う音声です。

## 再現の手順

Windows で、この作例のフォルダから実行します。`OUTSIDE_EXAMPLE_CACHE` と `OUTSIDE_EXAMPLE_VENV` は、**この作例フォルダの外**の自分のフォルダに置き換えてください（重み・キャッシュ・仮想環境を作例に入れないため）。

```powershell
# 1. 原稿を手元の Windows 音声で読み上げる（既にあるファイルは上書きしない）
pwsh -File make_input.ps1

# 2. 転記用に 16kHz・モノラル・PCM16 にする（-n で上書きしない）
ffmpeg -n -i input/review-ja-source.wav -ar 16000 -ac 1 -c:a pcm_s16le input/review-ja.wav

# 3. 仮想環境に固定版のソースと依存を入れる
python -m venv OUTSIDE_EXAMPLE_VENV
OUTSIDE_EXAMPLE_VENV\Scripts\python -m pip install -r requirements.txt

# 4. 重みを先に取得して SHA-256 を照合する（転記はしない）
OUTSIDE_EXAMPLE_VENV\Scripts\python run_transcribe.py --model-dir OUTSIDE_EXAMPLE_CACHE --prepare-model

# 5. 転記を1回実行する（outputs/ が既にあって空でなければ止まる）
OUTSIDE_EXAMPLE_VENV\Scripts\python run_transcribe.py --model-dir OUTSIDE_EXAMPLE_CACHE

# 6. 画面を開く
python -m http.server 8862 --bind 127.0.0.1
# → http://127.0.0.1:8862/index.html
```

- `make_input.ps1` は Windows PowerShell 5.1（`powershell.exe -File make_input.ps1`）でも動くよう、ASCII だけで書いています。指定の声が無い・無効なときは、ほかの声を使わずに止まります。
- `run_transcribe.py` は `torch.set_num_threads(4)` のうえで `whisper.load_model("base", device="cpu", download_root=--model-dir)` と `model.transcribe(audio, language="ja", task="transcribe", fp16=False, temperature=0, condition_on_previous_text=False, verbose=False)` を呼び、`whisper.utils.get_writer("all")` で書き出します。推論先は device="cpu" と読み込んだパラメータの実deviceで確認します。GPUが搭載されていても推論には使いません。
- 区間の時刻が音声の長さ（＋0.15秒）を超えるなど、結果が前提と違うときは `outputs/` を作らず、途中のファイルを `.outputs.partial-<日時>/` に残して止まります。このフォルダは公開しません。
- 制作側は Python 3.13.7 で実行しました。原典 README の「Python 3.9.9 と PyTorch 1.10.1」は OpenAI がモデルの学習・評価に使った環境の説明です。制作側が実際に使った環境は verification.json に記録しています。

## 実行済みの出力

| ファイル | 中身 |
| --- | --- |
| `outputs/review-ja.json` | Whisper が返した result をそのまま（tokens・avg_logprob などを含む） |
| `outputs/review-ja.srt`・`.txt`・`.vtt`・`.tsv`・`.jsonl` | `get_writer("all")` の書き出しそのまま |
| `outputs/session.json` | 音声の SHA-256・長さ・形式、転記の設定、重みの SHA-256、1回の実行の時間、区間（id・start・end・text）、各出力の SHA-256 |

Whisper の生の出力と元の入力は変えずに残します。人が直した文は、画面から保存する別の SRT（`review-ja-edited.srt`）だけに入ります。`session.json` の時間は「この1回の実行」の値で、音声の合成と重みの取得を含まず、速さの比較ではありません。

## 確かめていないこと

- 人の録音、会議、雑音のある音声、長い音声、ストリーミング
- ブラウザー内の推論、ほかのモデル（tiny・small・turbo など）、GPU
- 実機の iPhone Safari、VoiceOver などの読み上げソフト
- 字幕の品質や時刻の正しさの自動判定、字幕のアクセシビリティ基準への適合
- 実際に聞いていない録音での精度

この作例の音声は1本の短い合成音声で、精度のベンチマークではありません。

## ライセンス

- 作例のコード・文章・原稿：MIT License（Copyright (c) 2026 Studio Yebisu）。`LICENSE` を参照。
- Whisper のコードとモデルの重み：MIT License（Copyright (c) 2022 OpenAI）。固定版の `LICENSE`・`README.md`・`model-card.md` と読んだソースを `vendor/whisper/` に原文のまま置いています。
- 読み上げ音声：手元の Windows 音声で作った作例用の素材です。音声エンジンそのものは同梱・再配布しません。
- 依存パッケージ（PyTorch・tiktoken・numba・numpy など）はそれぞれのライセンスに従います。表記は制作側が集めます。
- モデルの重み・キャッシュ・仮想環境・実行ファイルは含めていません。
- 外部の計測・解析は使っていません。OpenAI による承認や推奨を示すものではありません。

## 掲載した結果

入力input/script.jsonとinput/review-ja.wav、原出力outputs/review-ja.{json,jsonl,txt,srt,vtt,tsv}、設定と時間outputs/session.json、原稿参照の修正根拠outputs/reference-review.json、実ブラウザー保存outputs/browser-{original,edited}.srtとbrowser-edited.txt、入出力7対samples.json、実行メモoutputs/result.mdを残しています。原出力は書き換えません。

動画は28秒・1280×720・30fps・840フレーム・無音。実画面と実データを編集した説明で連続録画ではありません。原音は別のWAVです。映像とUIは制作担当が確認しましたが、音声の聴取品質と時刻精度、実機iOS、VoiceOver、人による審美的承認は未確認です。video/storyboard.jsonは制作時の設計、現在の検証はverification.jsonです。

ZIPにはexamples/whisper-example/、media/、公開brief-to-demoの本文とMIT表記を含みます。モデル重み・cache・venv・node_modules・認証・私的統括スキル・モデル履歴全文は同梱しません。展開先ルートをHTTP配信して /examples/whisper-example/ を開けます。既存outputsを再実行で上書きせず、別の空の --out を指定してください。動画出力先もソースの外の空フォルダへ置きます。

```text
npm ci --ignore-scripts --no-audit --no-fund --prefix examples/whisper-example/tools/motion-reel
python examples/whisper-example/render.py --out renders/whisper-first
```

## 同梱した入力で再実行する

閲覧だけならPython/Whisperのインストールは不要です。ZIPを展開したルートをHTTP配信してください。ASRを再実行する場合は、同梱のinput/review-ja.wavをそのまま使えるため、上の音声合成・FFmpeg変換の工程は省けます。仮想環境とモデルの準備後、この作例のフォルダで次を実行します。別の空の出力先へ保存され、掲載済みのoutputs/は保全されます。

```text
python run_transcribe.py --model-dir OUTSIDE_EXAMPLE_CACHE --out ../whisper-asr-second
```

原稿の音声合成だけを再現するときも、既存音声を上書きせず `pwsh -File make_input.ps1 -OutPath ../whisper-new-source.wav` のように新しい出力先を指定してください。
