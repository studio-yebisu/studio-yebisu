# Mem0 作例：好みを覚えて、次に引き出す

架空の2人（`aya` と `ken`）の「説明の見せ方」と「作例動画の好み」7件を、Mem0 のオープンソース版 Memory API に保存し、次の依頼で引き出せるかを確かめる作例です。検索・利用者ごとの絞り込み・更新・削除・別プロセスでの読み直し・誤った呼び出しの拒否を、8つの場面（M01〜M08）で実際の API を呼んで記録します。

- 原典：[mem0ai/mem0](https://github.com/mem0ai/mem0/tree/0724291bd864cf807e88ee8981c8226644e8fb42) 固定コミット `0724291bd864cf807e88ee8981c8226644e8fb42`（SDK 2.2.1、Apache-2.0、Copyright [2023] [Taranjeet Singh]）。使う156ファイルを `vendor/mem0/` に改変せずに同梱し、`vendor-lock.json` の SHA-256 で固定しています。
- 埋め込み：[sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2](https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2/tree/e8f8c211226b894fcb81acc59f3b34ba3efd5f42) 固定コミット `e8f8c21`（Apache-2.0、384次元）。CPU で動かします。重みはこの作例では配布せず、各自が取得します（下記）。
- 7件の好みと8つの場面は、この作例のために書いた架空のデータで、実行の前に固定しました（`input/`）。実在の人の記録や会話は含みません。

## 使うもの・使わないもの

Mem0 には、ホスト型の **Platform**（`from mem0 import MemoryClient`、`MEM0_API_KEY`、api.mem0.ai への通信）と、手元で動く **オープンソース版**（`from mem0 import Memory`）があります。この作例は後者だけを使います。アカウント・API キー・`mem0 init`・プラグインの導入・Platform の設定はありません。

| 部品 | この作例の設定 |
| --- | --- |
| Memory | `Memory.from_config(config)`（vendor/mem0 から読み込み、pip では入れない） |
| 埋め込み | `huggingface` プロバイダー。手元のモデルフォルダーを `SentenceTransformer` で CPU 読み込み（`local_files_only=True`、`trust_remote_code=False`） |
| ベクトルの保存先 | `qdrant` の埋め込みモード（`path` 指定・`on_disk: true`）。サーバーは立てない |
| 履歴 | SQLite（`history_db_path`） |
| LLM | `ollama` プロバイダーを閉じたポート `http://127.0.0.1:9`・モデル名 `unused-in-infer-false` で置くだけ。一度も呼ばない |
| 追加 | すべて `infer=False` |

### なぜ `infer=False` か

`Memory.add` の既定（`infer=True`）では、LLM が会話から要点を抜き出し、既存の記録と照らして追加や更新を決めます。この作例は外部の API や LLM サーバーを使わずに、保存・検索・更新・削除・履歴という Memory の直接の操作と、実際の埋め込みベクトルでの検索を確かめることに絞りました。そのため `infer=False` で、渡した文を1件ずつそのまま保存します。

**これは LLM による自動の抽出ではありません。** M05 の書き換えも、実行スクリプトが `Memory.update` を明示的に呼んだもので、Mem0 が古い好みを自動で直したのではありません。Memory は設定上 LLM のクライアントを必ず作るため、公式の Ollama プロバイダーを閉じたポートに向けて置いています。Ollama は起動せず、呼び出しもしません（実行中の通信の試みは記録され、0件でなければ失敗になります）。

### 現在の SDK での絞り込み

固定版の SDK では、`search` と `get_all` の利用者の指定は `filters={"user_id": "aya"}` の形です。`search(query, user_id="aya")` のように外に渡すと `ValueError` になります（M08 で実際の例外を記録）。`metadata` に入れた `topic` も `filters` に入れて絞り込めます（M04）。古い README や記事にある書き方と違う場合は、同梱した `vendor/mem0/mem0/memory/main.py` の実装に従っています。

`user_id` での分離は、アプリが渡す条件で検索範囲を分けるものです。**認証や権限の仕組みではありません。** 実際のアプリでは、呼び出す側が利用者を認証し、その人の ID だけを渡す必要があります。

## 8つの場面

| ID | 場面 | 呼ぶ API |
| --- | --- | --- |
| M01 | 7件を保存する | `add(text, user_id, metadata, infer=False)` を7回、`get_all` を利用者ごと |
| M02 | あやさんの好みを探す | `search(query, filters={"user_id": "aya"}, top_k=3, threshold=0.0, explain=True)` |
| M03 | 同じ質問をけんさんに | 同じ問いを `user_id: "ken"` で |
| M04 | 動画の好みだけに絞る | `filters={"user_id": "aya", "topic": "video"}` |
| M05 | 20秒から30秒へ更新 | `get` → `update(id, text=...)` → `get` → `history` → M04 と同じ検索 |
| M06 | 仮の予定を削除する | `get` → `delete(id)` → `get` → `get_all` → `history` |
| M07 | 別プロセスで読み直す | SQLite と Qdrant を閉じ、新しい Python プロセスで `Memory.from_config` から `search`・`get_all`・`get`・`history` |
| M08 | 未登録ユーザーは0件 | `user_id: "nobody"` の検索と、誤った呼び出し3件（filters なし・user_id を外に・threshold 1.1） |

検索の `score` は、Mem0 が順位付けに使う値です。確率や確信度ではありません。この構成では spaCy（固有表現の加点）と fastembed（BM25）を入れないため、検索は埋め込みの近さだけで並びます。

M06 の削除は、記録を `get`・`get_all`・`search` の対象から外す操作です。SQLite の履歴には、削除前の本文と `DELETE` の行が残ります。ファイルからの物理的な消去や履歴の削除は、この作例では確かめていません。

## 準備（最初の1回だけ通信します）

今回確認した環境は Windows x64・Python 3.13.7・CPU 4スレッドです。原典SDKはPython 3.10以上を要求しますが、この固定依存の再現には3.13環境を使ってください。ここでの依存の導入とモデルの取得には通信が要ります。`run.py` の実行中は通信を拒否します（次の節）。

1. 仮想環境を作り、CPU 版の PyTorch を PyTorch の CPU 用インデックスから入れます（Windows・Linux 共通）。

   ```bash
   python -m venv .venv
   # Windows: .venv\Scripts\activate   Linux: source .venv/bin/activate
   python -m pip install torch==2.11.0 --index-url https://download.pytorch.org/whl/cpu
   python -m pip install -r requirements.txt
   ```

   `mem0ai` は pip で入れません。`run.py` は `vendor/mem0` の固定版だけを読み込み、別の `mem0ai` が入っていると止まります。spaCy と fastembed も入れないでください（初回に別のモデルを取得しようとするため、止まります）。

2. 埋め込みモデルの11ファイル（約494MB）を、**公開フォルダーの外**に取得します。リポジトリ・リビジョン・ファイルは `input/model-source.json` のとおりです。

   ```python
   import json
   from huggingface_hub import snapshot_download

   with open("input/model-source.json", encoding="utf-8") as f:
       source = json.load(f)
   snapshot_download(
       repo_id=source["repository"],
       revision=source["commit"],
       allow_patterns=[entry["path"] for entry in source["files"]],
       local_dir="../mem0-model",  # 公開するフォルダーの外
   )
   ```

   `run.py` は11ファイルすべてを、サイズと SHA-256（LFS のファイル）または Git の blob SHA-1（小さなファイル）で照合し、余分なファイルがあれば止まります。実行中に自動でダウンロードすることはありません。

## 実行

公開済みの `outputs/memory-run.json` は消さずに残し、**別の作業フォルダーへのコピー**で実行してください。`run.py` は既にある `outputs/memory-run.json` を上書きせず、あれば止まります。

```bash
# Linux / macOS（記録だけ除いてコピー）
test ! -e ../mem0-rerun && rsync -a --exclude outputs/memory-run.json --exclude .venv --exclude __pycache__ --exclude node_modules --exclude .git ./ ../mem0-rerun/
# Windows PowerShell
if (Test-Path -LiteralPath ..\mem0-rerun) { throw 'コピー先は新しいフォルダーにしてください' }
robocopy . ..\mem0-rerun /E /XF memory-run.json /XD .venv __pycache__ node_modules .git

cd ../mem0-rerun
python run.py --model-dir ../mem0-model --artifact-dir ../mem0-artifacts
```

`--artifact-dir` は空か存在しないフォルダーで、公開フォルダーの外に置きます。ここに Qdrant のフォルダー・`history.db`・Mem0 の設定（`MEM0_DIR`）・別プロセスの記録とログが入ります。どれも公開しません。

`run.py` が行うこと：

1. 入力3ファイル・`vendor-lock.json`・原典156ファイルの SHA-256 と、モデル11ファイルを照合する。
2. Python の監査フック（`sys.addaudithook`）で `socket.connect`・`socket.getaddrinfo` などを拒否して数える。依存を読み込む前に入れる。続いて `MEM0_TELEMETRY=false`、`MEM0_DIR`、`HF_HUB_OFFLINE=1`、`TRANSFORMERS_OFFLINE=1` などを設定し、CPU 4スレッド・seed 2201 にする。
3. M01〜M06 を実行し、A01 の埋め込み（384次元・有限値）と保存されたベクトルの一致を確かめる。
4. SQLite と Qdrant のクライアントを閉じ、保存ファイルのサイズと SHA-256 を記録してから、同じファイルを新しいプロセス（`--reopen-worker`）で起動して M07・M08 を実行する。
5. すべての確認が通ったときだけ `outputs/memory-run.json` を1回書く。通信の試みが1件でもあれば、結果を書かずに失敗する。

公開する記録には API の入力と戻り値・確認の結果・版・ファイルのハッシュだけを書き、手元の絶対パスは `<MODEL_DIR>`・`<ARTIFACT_DIR>` に置き換えます。

### 通信について

- 通信するのは、上の「準備」での依存の導入とモデルの取得だけです。
- `run.py` の実行中は、Python の `socket` を通る接続と名前解決を拒否して記録します。C 拡張が Python を通らずに開く接続は、この仕組みでは記録できません。
- Mem0 の利用状況の送信（PostHog）は `MEM0_TELEMETRY=false` で止めています。

### 再実行で変わるもの

seed・スレッド数・CPU を固定しても、UUID（Mem0 が `uuid4` で付ける）・時刻・スコアの小数の末尾は実行ごとに変わることがあります。保存・検索・更新・削除・読み直しの手順と確認は同じように繰り返せます。

## このフォルダー

| ファイル | 内容 |
| --- | --- |
| `index.html`・`style.css`・`app.js` | 保存した記録を読むページ。ブラウザーでは Mem0・Python・推論は動かない |
| `run.py` | 実行スクリプト（親プロセスと別プロセスの両方） |
| `requirements.txt` | 依存。版は実行後に記録の `environment` で確かめられる |
| `input/` | 架空の好み7件・8場面・モデルの固定版（実行前に固定） |
| `outputs/memory-run.json` | 制作側が `run.py` を実行して書く記録（ページはこれを読む） |
| `outputs/method.md` | 手順と読み方 |
| `brief.json`・`request.txt` | 制作ブリーフと、同じ確認を頼む依頼文 |
| `vendor/mem0/` | 原典の固定版（改変なし、Apache-2.0 の LICENSE を同梱） |

公開しないもの：モデルの重み、Qdrant と SQLite のファイル、`MEM0_DIR`、別プロセスの完全なログ、制作に使ったモデルの実行履歴や認証情報。

## 制作の状態

- 実行コード・ページ・説明は Claude Opus 5.5 が制作しました。架空の入力7件と8場面は制作担当が実行前に固定しました。ベクトルを計算するのは埋め込みモデル、記録の追加・検索・更新・削除は Mem0 の API で、文章を書いた AI とは別です。
- 原典の実APIで8操作を実行し、Qdrantの生ベクトル6件・5検索の順位/スコア・SQLite履歴9行を別に照合しました。全8場面の入力/出力、JSON保存、依頼文コピー、エラー復帰、スマホ/PCの6幅も確認しました。32秒の無音動画は実記録と実画面から制作しました。
- 物理的な iPhone の Safari・VoiceOver・人による内容や見た目の承認は確認していません。

## ライセンス

作例のコード・文章・架空の入力は MIT License（Copyright (c) 2026 Studio Yebisu、`LICENSE`）。`vendor/mem0/` は mem0ai/mem0 のファイルを改変せずに置いたもので、Apache License 2.0（Copyright [2023] [Taranjeet Singh]、`vendor/mem0/LICENSE`）です。埋め込みモデルは Apache-2.0 で、モデルカードと利用条件は Hugging Face の固定版を参照してください。


公開版の動画は32秒・1280×720・30fps・840フレーム・無音です。8つの実素材のハッシュ、代表/連続フレーム・360px表示・別順/新ページPNG一致・全デコード・実MP4終端を制作担当が確認しました。自動検査とエージェントによる視覚確認で、実機iOS確認や人による承認ではありません。最終範囲はverification.jsonを参照してください。


## 図中心の改修（2026-10-17）


架空の2人の好みを保存し、同じ問いでも利用者の条件に合わせて記録を取り出します。同じ記憶を20秒から30秒へ更新し、仮の予定を有効な一覧から外し、別のPythonプロセスでも更新が残った実結果を、一つの大きな図で見られます。

32秒の縦横動画は無音です。図形の移動と短いラベルで説明し、ナレーションは付けていません。ページは保存済みの結果を表示します。クリックでMem0やモデルを新しく実行するものではありません。

元の実入力・実出力・CPU埋め込み・QdrantとSQLiteの記録は変更していません。追加はinfer=False、更新と削除は明示的なAPI呼び出しです。利用者の条件は認証の保証ではなく、削除後も履歴は残ります。元の8件の全文はcomparison.htmlから確認できます。

今回の図と映像のコードはClaude Opus5.5が執筆し、制作側が検証・書き出し・掲載を行いました。自動検査とエージェントによる画面確認は、人の審美的な承認や実機iOSでの確認とは別です。

縦動画は ../../media/mem0-example.mp4、横動画は ../../media/mem0-example-wide.mp4、編集ソースはvideo/index.htmlです。詳細はvideo/README.mdを参照してください。
