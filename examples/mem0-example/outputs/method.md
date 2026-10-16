# 手順と読み方（Mem0 作例）

この文書は、`run.py` が何を入力し、どの API を呼び、何を確かめて `outputs/memory-run.json` に書くかを説明します。数値や ID は記録そのものを見てください。ここには結果の値を書いていません。

## 1. 入力（実行の前に固定）

| ファイル | 内容 | SHA-256 |
| --- | --- | --- |
| `input/memories.json` | 架空の好み7件。`aya` 4件（layout・video・workflow・temporary）、`ken` 3件（layout・video・workflow）。各行に `metadata.topic` と `metadata.source_key` | `ef9f585026e5cb4e5c0f32fa02af0117ede2dd2d7b0b5d9a4fb6fe87386c161c` |
| `input/scenarios.json` | 8場面 M01〜M08 の操作・問い・絞り込み・`top_k`・`threshold`・更新後の本文・誤った呼び出しの種類 | `ec089d59c70d1442313fe797349acbbbb9999e7ec6ba2c04131df02bf8a2acdb` |
| `input/model-source.json` | 埋め込みモデルのリポジトリ・コミット・384次元・11ファイルのサイズとハッシュ | `4e51d6fc32c2b93c5c5dfdad32bc870ebeb379548ea87e90cd50bd10f5fcd9af` |

3ファイルのハッシュは `run.py` とページ（`app.js`）の両方に書いてあり、どちらも実行・表示の前に計算し直して照合します。結果を見てから入力を変えることはしません。

## 2. 構成

- **Mem0**：mem0ai/mem0 固定コミット `0724291`（SDK 2.2.1）。`vendor/mem0/` の156ファイルを `vendor-lock.json` の SHA-256 で照合し、`sys.path` から読み込みます。`mem0/__init__.py` が `mem0ai` の配布メタデータから版を読むため、pip が書くのと同じ最小の `METADATA`（名前と、同梱の `pyproject.toml` にある版 2.2.1）を非公開の作業フォルダーに置きます。原典のファイルは変更しません。
- **Memory の設定**：`Memory.from_config` に、`huggingface` の埋め込み（`model` は手元のモデルフォルダー、`embedding_dims: 384`、`model_kwargs: {device: cpu, local_files_only: true, trust_remote_code: false}`）、`qdrant` の埋め込みモード（`collection_name: studio_yebisu_mem0`、`embedding_model_dims: 384`、`path`、`on_disk: true`）、`history_db_path`、使わない `ollama`（`model: unused-in-infer-false`、`ollama_base_url: http://127.0.0.1:9`）を渡します。記録の `config.memory_config` に、パスを `<MODEL_DIR>`・`<ARTIFACT_DIR>` に置き換えた同じ設定があります。
- **LLM を呼ばない理由**：追加はすべて `infer=False` です。原典の `_add_to_vector_store` は `infer=False` のとき、メッセージごとに埋め込みを計算して保存するだけで、LLM を呼びません。`search`・`get`・`get_all`・`update`・`delete`・`history` も LLM を使いません。Ollama のクライアントは `Memory.__init__` が必ず作るため置いてありますが、サーバーは起動せず、呼び出しもありません。
- **任意の部品を入れない**：spaCy（固有表現の抽出と加点）と fastembed（Qdrant の BM25）は入れません。どちらも初回に別のモデルを取得しようとするためです。原典はこのとき、要点の見出し語化を元の文のまま使い、固有表現の加点と BM25 を使わない「埋め込みの近さだけ」の検索になります。`run.py` は、どちらかが入っていれば実行前に止まります。
- **乱数とスレッド**：`random`・NumPy・PyTorch の seed を 2201、PyTorch の CPU スレッドを4にします。ID は Mem0 が `uuid4` で付けるため、実行ごとに変わります。

## 3. 通信の拒否

`run.py` は標準ライブラリの読み込みの直後、PyTorch・sentence-transformers・qdrant-client・Mem0 を読み込む前に `sys.addaudithook` を入れます。`socket.connect`・`socket.getaddrinfo`・`socket.gethostbyname`・`socket.gethostbyaddr`・`socket.sendto`・`socket.sendmsg` の監査イベントが起きると、その試みを記録してから例外で止めます。ライブラリが例外を受け止めて続けても、記録が1件でもあれば実行全体を失敗にします。別プロセスでも同じファイルが同じフックを入れ、試みの一覧を親へ返します。

記録の `network` には、拒否するイベントの一覧、親と別プロセスの試み（成功した記録では空）、合計（0）が入ります。Python を通らずに C 拡張が直接開く接続は、この仕組みでは記録できません。

依存の導入とモデルの取得（README の「準備」）は、この実行より前の別の作業で、そこでは通信します。

## 4. 8つの場面と確認

すべて原典の公開 API を呼び、戻り値は形を変えずに JSON に変換して記録します（日時は ISO 形式の文字列。ID・本文・スコア・メタデータは落としません）。どれかの確認が外れたら、その場で止まり、記録は書きません。

**M01 保存**　7行を入力の順に1件ずつ `m.add(text, user_id=..., metadata=..., infer=False)`。各応答が1件の `ADD` で、本文が入力と同じことを確かめ、返った UUID を入力のキー（A01〜K03）に対応づけます。続けて `get_all(filters={"user_id": u}, top_k=20)` を2人分呼び、件数（aya 4・ken 3）、ID の集合、本文、`user_id`、`metadata` が入力と完全に一致することを確かめます。

あわせて A01 の本文を `m.embedding_model.embed(text, "add")` で埋め込み、384要素ですべて有限の数であることと、Qdrant に保存された同じ点のベクトルとのコサインが 0.9999 を超えることを確かめます。記録には次元・L2ノルム・先頭8つの値・ベクトル全体の SHA-256 が入ります。

**M02〜M04 検索**　場面の `query`・`filters`・`top_k`・`threshold`・`explain` をそのまま `m.search` に渡します。返った全件を記録し、スコアが有限の数で降順であること、全件が絞り込んだ利用者の記録で、もう一人の ID と重ならないことを確かめます。件数は M02・M03 が `top_k`（3）、M04 は A02 の1件だけであることを確かめます。どの記録が何位に来るかは確認の条件にしていません。

**M05 更新**　A02 を `get` → `update(id, text=新しい本文)` → `get` → `history`。ID が同じ、本文が置き換わった、`created_at` が同じで `updated_at` が変わった、`metadata` が同じ、履歴が `ADD` と `UPDATE` の2件で `UPDATE` の行に前後の本文がある、ことを確かめます。続けて M04 と同じ条件で検索し、更新後の本文の A02 だけが返ることを確かめます。

**M06 削除**　A04 を `get` → `delete(id)` → `get`（None）→ `get_all` → `history`。aya の有効な記録が3件で A04 を含まないこと、ken の一覧が削除の前と同じこと、履歴に `is_deleted` が真の `DELETE` 行があることを確かめます。履歴が削除前の本文を持つかどうかは、確認の条件ではなく、記録された値（`history_retains_deleted_text`）として残します。物理的な消去は確かめていません。

**閉じて別プロセスへ**　`Memory.close()` で SQLite を、`m.vector_store.client.close()` で埋め込み型 Qdrant とそのフォルダーのロックを閉じます。SQLite の `-wal`・`-shm`・`-journal` が残っていないことを確かめ、Qdrant のフォルダーと `history.db` の各ファイルのサイズと SHA-256 を記録します（`storage.before_reopen`）。続けて `sys.executable` で `run.py --reopen-worker <ARTIFACT_DIR> --model-dir <MODEL_DIR>` を引数リストで起動します（120秒で打ち切り、標準出力と標準エラーは非公開のログへ）。

**M07 読み直し**　新しいプロセスが入力・原典・モデルを照合し直し、同じ設定で `Memory.from_config` を呼び、M07 の検索、2人分の `get_all`、A02 と A04 の `get` と `history` を実行します。検索が更新後の本文の A02 だけを返す、aya 3件・ken 3件で ID が最初のプロセスと同じ、A02 の本文が更新後のまま、A04 の `get` が None、履歴がそれぞれ `ADD`・`UPDATE` と `ADD`・`DELETE`、を確かめます。親は、別プロセスの終了コードが0、プロセス番号が自分と違う、パッケージの版・入力のハッシュ・原典・モデルファイル・Memory の構成が同じ、通信の試みが0件、を確かめます。記録にはプロセス番号そのものは書きません。

**M08 拒否**　同じ別プロセスで、`user_id: "nobody"` の検索が0件であることを確かめます。続けて誤った呼び出しを3つ実行し、それぞれ例外が起きて `ValueError` であることを確かめ、例外のクラスと文面をそのまま記録します。

1. `filters` を渡さない `m.search(query, top_k=..., threshold=..., explain=...)`
2. `user_id` を `filters` の外に渡す `m.search(query, user_id="nobody", ...)`
3. `threshold=1.1` の `m.search(query, filters=..., ...)`

**最後に**　閉じた後の `history.db` を読み取り専用で開き、履歴の行が `ADD` 7・`UPDATE` 1・`DELETE` 1、会話メッセージの行が0（`infer=False` は会話を保存しない）であることを確かめます。保存ファイルのハッシュをもう一度記録し（`storage.after_worker`）、入力と原典が実行の間に変わっていないことを確かめ、記録に手元のパスが入っていないことを確かめてから、`outputs/memory-run.json` を一時ファイル経由で1回だけ書きます。

## 5. 記録の読み方

- **Mem0スコア**：原典の `score_and_rank` が、意味の近さ（Qdrant のコサイン類似度）に BM25 と固有表現の加点を足し、使った信号の最大値で割った値です。この構成では BM25 と固有表現の加点が入らない作りなので、`score_details` の `bm25_score`・`entity_boost` と、`score` が `semantic_score` と同じかどうかを、記録で確かめてください。確率・確信度・正解率ではありません。
- **分離**：`filters` の `user_id` で検索範囲が分かれるのは、アプリが渡した条件によるものです。認証や権限の保証ではありません。
- **削除と履歴**：`delete` は有効な取得・一覧・検索から外します。履歴の SQLite には行が残ります。
- **保存ファイル**：Qdrant と SQLite のファイルそのものは公開しません。記録にはサイズと SHA-256 だけを書きます（`storage.public: false`）。
- **作者の区別**：実行コード・ページ・説明は Claude Opus 5.5 が制作しました。架空の入力7件と8場面は制作担当が実行前に固定しました。ベクトルは埋め込みモデルが CPU で計算し、記録の操作は Mem0 の API が行いました。記録の `authorship` にも同じことを書いています。

## 6. 限界

- 7件・2人・8場面の小さな確認です。検索の質や、大量の記録での速さ・精度の評価ではありません。
- `infer=True`（LLM による抽出と更新の判断）、ホスト型 Platform、リランカー、固有表現の加点、BM25、グラフは使っていません。
- 実在の個人の記録や会話は使っていません。自律的なエージェントや個人のアカウントにつないだ記憶ではありません。
- 通信の拒否は Python の `socket` を通るものが対象です。
- UUID・時刻・小数の末尾は再実行で変わることがあります。
