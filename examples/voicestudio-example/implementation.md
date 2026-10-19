# VoiceStudio 実装メモ：元の CLI からローカル ASR へ

## このケースがすること

VoiceStudio 0.5.7 の公開エージェントスキル（`skills/voicestudio/SKILL.md`）の手順に沿って進めます。まず手元で動いているバックエンドの状態と API 仕様を確かめ、そのあと **VoiceStudio 同梱の依存なし Python CLI** を使って、合成英語 WAV 3 本をそれぞれ 1 回ずつ文字起こしします。返ってきた `verbose_json` はバイト列を変えずに保存します。

- 機能：ローカルの音声ファイルを、ループバック上の OpenAI 互換ルート `POST /v1/audio/transcriptions` に送り、セグメント単位のタイムスタンプ付きテキストを受け取ります。
- 効果：ホスト型 API もアカウントも使いません。端末内の Faster-Whisper（CTranslate2）が文字起こしを行います。
- 証拠：元の CLI が出力した生 JSON、その SHA-256、要求フラグ、CLI 呼び出し回数、実行前の準備状態（readiness）と実行後の `/engines` の状態を、すべて `results.json` に記録します。

`model=faster-whisper` は VoiceStudio 内部の ASR エンジン ID です。OpenAI のサービスやホスト型モデルを指す名前ではありません。

## 役割分担

| 主体 | 担当 |
|---|---|
| 著者（Claude Opus 5.5, `claude-opus-5-5`） | `run_example.py`・`inputs/jobs.json`・本書の 3 ファイルを書いた。実行も QA も行っていない |
| オペレーター | 隔離環境の用意、モデルファイルの配置と照合、無改変バックエンドのループバック起動、本プログラムの実行 |
| VoiceStudio 本体（AGPL-3.0-only） | CLI（multipart 送信）、FastAPI ルート、モデル準備・ライセンス確認、`FasterWhisperBackend` |
| ASR モデル（MIT） | `Systran/faster-whisper-base@ebe41f70d5b6dfa9166e2c581c45c9c0cfc57b66`。バックエンド内で faster-whisper / CTranslate2 が実行する |
| ラッパー（`run_example.py`） | 事前検証、1 回ずつの呼び出し、生出力の保存、TXT への射影、記録 |
| 次フェーズのブラウザ図解 | 保存済みデータを読み、既存 WAV を再生するだけ。ASR・TTS・モデル推論は行わない |

SKILL.md は Markdown で書かれた手順書です。モデルではなく、自律的に動くエージェント群でもありません。本ケースで使ったのは、そのうち「Connect and discover」と「Transcribe」の 2 つの手順だけです。

## 処理の流れ

```text
run_example.py ─(subprocess, cwd=--source)─> python -m backend.speech_client transcribe <wav>
      │                                            --model faster-whisper --language en --format verbose_json
      │                                         │
      │                                         └─ multipart/form-data: model, response_format, language, file
      │                                              POST http://127.0.0.1:3900/v1/audio/transcriptions
      │                                         ▼
      │                         openai_compat.create_transcription → _transcribe_request
      │                           ├─ asr_model_missing_error()  未導入なら 409（自動ダウンロードしない）
      │                           ├─ load_active_asr_backend()
      │                           │    ├─ get_active_asr_backend()  OMNIVOICE_ASR_BACKEND=faster-whisper
      │                           │    ├─ ensure_backend_licence()  未受諾なら 403（受諾はしない）
      │                           │    └─ ensure_loaded()           インストール済みスナップショットを読む
      │                           ├─ backend.id != "faster-whisper" なら 400 model_not_active
      │                           └─ run_transcribe_guarded(…, 300 s)
      │                                ▼
      │                         FasterWhisperBackend.transcribe
      │                           WhisperModel(device=cpu, compute_type=int8 → float32 の順で試す)
      │                           model.transcribe(vad_filter=True, language="en", word_timestamps=False)
      │                           → segments{text,start,end} + language + duration
      │                                ▼
      │                         _result_segments → _openai_segments → VerboseTranscriptionResponse
      │                           text = 各セグメントの text を strip して空白で連結
      ▼
<id>.json  CLI の標準出力（そのままのバイト列。末尾 LF は CLI が付ける）
<id>.txt   ラッパーが text フィールドに LF を 1 つ足しただけのもの
```

### 各段の根拠（固定ソース 6f0ed2eb）

- **CLI**（`backend/speech_client/__main__.py`）：`_transcribe` が `model`・`response_format`・`language` と `file`（ファイル名と `audio/wav`）を `_encode_multipart` で組み立て、`/v1/audio/transcriptions` に POST します。`OMNIVOICE_API_KEY` が設定されている場合に限り Bearer ヘッダーを付けます。ループバックでは鍵は不要です。応答本文を stdout にそのまま書き出し、末尾に LF がなければ足します。
- **ルート**（`backend/api/routers/openai_compat.py`）：`timestamp_granularities` を送っていないので `want_words=False` となり、バックエンドには `word_timestamps=False` が渡されます。`prompt` も送っていないので `initial_prompt` は付きません。`temperature` も送っていないため渡されません。
- **エンジン選択とライセンス**（`backend/services/asr_backend.py`）：環境変数で固定されたエンジンは、黙って別のエンジンに差し替えられません。ライセンスは使用のたびに確認されます。`get_active_asr_backend()` は Whisper 系ではリクエストごとに新しいアダプターを作るため、モデルの読み込みが 1 回で済むとは限りません。
- **Faster-Whisper**：`vad_filter=True`（内蔵 Silero VAD）。`asr_decode_defaults()` は性能プリセット未設定なら `{}` を返し、ビーム幅などは faster-whisper ライブラリの既定値になります。デバイスは CTranslate2 で CUDA が使えなければ CPU/int8 を最初に試します。以上はソースから読み取った説明で、今回測った値ではありません。実際に観測された値は、実行後の `/engines` の `execution_evidence` にあるものだけです。
- **verbose_json**：セグメントの `seek`・`tokens`・`temperature`・`avg_logprob`・`compression_ratio`・`no_speech_prob` は、正規化されたセグメントに対応する値がないため、ルートが既定値の 0 や空配列で埋めます。デコーダーの温度や信頼度を表す値ではありません。

## 実行前の検証（ASR より前）

1. `vendor/pins.json` のコミット・バージョン・選定 20 ファイル・モデル版を確認する。
2. `--source` 内の選定 20 ファイルについて、バイト数・SHA-256・Git blob を照合する。全 3333 ファイルとアーカイブの照合はオペレーターが済ませた証拠であり、ここでは繰り返さない。
3. `inputs/jobs.json` が固定値（3 件、順序、要求フラグ）と完全に一致することを確認する。
4. 各 WAV のバイト数・SHA-256・RIFF/WAVE ヘッダー・24 kHz・モノラル・PCM16・長さを確認する。
5. `GET /health`：`status=ok` かつ `version=0.5.7` であること。
6. `GET /openapi.json`：`info.version=0.5.7` であること。さらに POST `/v1/audio/transcriptions` の multipart スキーマに `file`・`model`・`language`・`response_format` があり、`file` が必須であること。
7. `GET /engines`：ASR の `active=faster-whisper`、`active_model=Systran/faster-whisper-base`、`available=true` であること。保存するのは ASR の該当行の一部だけで、TTS・LLM の一覧やローカルパスは保存しない。
8. `GET /models`：対象モデルについて、インストール済みであること、不完全でないこと、ファイル数が 4、合計 147,882,941 B、ライセンスメタデータの版が `ebe41f70…` であること、受諾状態が `not_required` であることを確認する。受諾が必要な状態なら、その場で停止する。

ここまでは準備状態の確認です。モデルを実行した証拠にはなりません。

## 実行（オペレーターのみ）

```sh
<python> run_example.py \
  --source <固定済み VoiceStudio 0.5.7 フルチェックアウト> \
  --python <バックエンド用に用意した Python インタープリター> \
  --url http://127.0.0.1:3900 \
  --out <新規または空のフォルダー>
```

- `--url` に指定できるのは、ポートを明示したループバック IP リテラルの `http://` だけです。userinfo、クエリ、フラグメント、パス付きの URL は受け付けません。
- `--out` は、`--source`・`inputs/`・`vendor/` のいずれとも重ならない、新規または空のフォルダーにしてください。ファイルはすべて排他的に作成するので、既存ファイルを上書きすることはありません。
- 子プロセスではプロキシ用の環境変数・`PYTHONPATH`・`PYTHONSAFEPATH` を外します。`NO_PROXY` にはループバックを設定し、`PYTHONDONTWRITEBYTECODE=1` でソースのチェックアウトに `__pycache__` を作らないようにします。ほかの環境変数の値は変更も記録もしません。
- 元の CLI は `capabilities` で 1 回、`transcribe` でジョブごとに 1 回、計 4 回呼びます。再試行・best-of・追加フォーマット（text/SRT）での再実行・エンジン切替は行いません。外側のタイムアウト（900 秒）は異常を表に出すためのもので、超えても再送しません。
- 401・403・409・400（`model_not_active`）・504・終了コードが 0 以外・JSON として不正・検証不合格のいずれかに当たった時点で止まり、`failure.json` を書きます。エラー情報は最後の 1 行だけを、パスや Bearer を伏せ字にし、400 文字以内に切って残します。
- 再実行しても同じ結果になる保証はありません。再実行するかどうかはオペレーターが判断し、その場合は新しい `--out` を使ってください。

## 出力

| ファイル | 内容 |
|---|---|
| `progress.json` | `running` / `completed` / `failed` と現在のフェーズ、CLI 呼び出し回数 |
| `capabilities.json` | CLI の `capabilities` 出力（そのままのバイト列）。`voicestudio.speech.v1`・0.5.7・バッチ経路を検証済み |
| `<id>.json` | 成功した `transcribe` の CLI 出力（そのままのバイト列） |
| `<id>.txt` | ラッパーによる射影：返された `text` に LF を 1 つ足したもの。別の API 出力でも、別のモデル実行でも、修正版でもない |
| `results.json` | ソースのピン、スクリプト・入力・ソースのハッシュ、役割分担、要求フラグ、呼び出し回数、経過時間（1 回の実行のみ）、セグメント、参照文との文字列一致判定、WAV 不変チェック、準備状態と実行後状態の区別、パッケージ版 |
| `failure.json` | 失敗時のみ。フェーズ、種別、範囲を限ったエラー情報、それまでに完了したジョブ |

英語の参照文は、比較のために記録するだけです。リクエストには含めません。参照文との一致は文字列の完全一致（`literal_equal_to_returned_text`）だけで判定しており、`false` になるのは想定内です。差分はそのまま観察結果として残します。経過時間には、インタープリターの起動、アップロード、待ち行列、モデル読み込み、デコードがすべて含まれます。ベンチマークではありません。

## ライセンスと入力

- VoiceStudio 本体は AGPL-3.0-only です（`LICENSE`、`LICENSE-NOTICE.md`）。今回の選定 20 ファイルは無改変の抜粋で、実行には固定済みのフルチェックアウトと別途用意した実行環境が必要です。
- ASR モデル `Systran/faster-whisper-base` は、本体とは別のライセンス（MIT）です。アプリのレジストリでは `license_category=commercial`、`review_status=unreviewed` となっています。本ケースは法的な利用可否を判断していません。モデルの重み・キャッシュ・環境・認証情報は配布しません。
- 入力の 3 本は、以前の Chatterbox ケースで生成した英語の合成音声を、変更せずにコピーしたものです。今回は新たな TTS を行っていません。旧ケースの ASR を再実行するものでもありません。マイク録音でも、人の声の同意事例でもありません。
- フルバックエンドの実行時依存（faster-whisper、CTranslate2、FastAPI など）はオペレーターが別途用意しています。本クライアントは何もインストールしません。

## 検証していないこと

文字起こしの精度、WER、意味やタイミングの正しさ。単語レベルのアライメント（単語単位の粒度は要求していない）。他エンジンとの品質比較。646 言語への対応。マイク録音、デスクトップアプリ、ショートカット、テキスト挿入。MCP と WebSocket ストリーミング（どちらも広告されているだけで、使っていない）。翻訳、TTS、声のクローン・デザイン、吹き替え、話者分離。一般的な性能。人による試聴や見た目の承認。内部の活性やアテンション。

## 次フェーズ

保存した結果だけを読む、静かな接続図解・UI・32 秒のフィルム・記事を作ります。ナレーションや音声ガイドは付けません。サイトで使う音声は既存の 3 本の WAV だけで、ブラウザがそれを再生するだけです。


## 制作担当による受領後の保全補正

作者の3原本はexact受領として非公開に保全しました。実行前に制作担当が、成功した原典CLIのstdoutをJSON/時刻などの検証より先に専用ファイルへ保存する順序に補正しました。後段の検証で止まっても返却原本を失わないためで、原典・入力・API・モデル・要求の設定・再送方針は変えていません。作者による変更や実行とは区別します。
