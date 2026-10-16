# 手順と読み方

この作例で行う操作は次の1つです。

> 問い合わせ1件を書く → 担当を1つ選ぶ → 日本語の引き継ぎメモを作る → 結果を JSON と DSL で読む

その流れを Dify 形式のワークフロー `workflow.yml` に書き、Dify 1.17.1 が依存に指定する graphon 0.7.0 で、架空の8件を実行します。この文書は、何を実行し、何を確かめ、記録をどう読むかの説明です。実行の結果そのものは `outputs/workflow-runs.json` にあり、制作側が `run.py` を実行したときにだけ作られます。

## 1. 何が「判断」しているか

担当を決めるのは if-else ノードの値の比較です。

1. `start.urgency` が `至急`（`is`）、または `start.affected_users` が `100` 以上（`≥`）→ `urgent`（優先対応）
2. `start.issue` が `請求`（`is`）→ `billing`（請求窓口）
3. どちらでもない → `false`（通常窓口）

graphon の IfElseNode は cases を上から順に評価し、最初に当てはまった case で止まります。そのため、請求で至急の D06 は 1 で止まり、請求窓口へは進みません。99人の D04 は 1 にも 2 にも当てはまらず通常窓口、100人の D05 は `≥` で 1 に当てはまります。

メモは template-transform ノードが Jinja2 で作ります。入力の6項目を変数として差し込み、それ以外は固定の文です。Graphon の既定のレンダラーは autoescape を使わないので、`<script>` は `&lt;` に変わらず文字のまま残ります。差し込んだ値はテンプレートとして読み直されないので、件名の `{{ 7 * 7 }}` は `49` になりません。ページは値を `textContent` で書くため、`<script>` は実行されず、そのまま文字として見えます。

どの段階にも AI（LLM）はいません。文章の意味から担当を推定する分類や、本文の要約は行いません。決めた値で分ける作業の自動化と、その記録の読み方を示す作例です。

## 2. run.py が行うこと（順番どおり）

1. Python の版と OS を記録し、Python の通信・子プロセスの API 6つ（`socket.socket.connect`・`connect_ex`・`socket.create_connection`・`socket.getaddrinfo`・`subprocess.Popen`・`os.system`）を、試みを数えて拒否する関数へ差し替えます。OS 全体の遮断ではありません。
2. `vendor-lock.json` の SHA-256、原典292ファイルの SHA-256 とサイズ、`vendor/` にロック外のファイルがないこと、graphon の各ファイルが wheel 自身の `RECORD` と一致すること、Dify の `api/pyproject.toml` が `graphon==0.7.0` を宣言していること、入力2ファイルの SHA-256 を照合します。
3. `requirements-runtime.txt` の28件の版が入っている版と一致すること、文書処理・モデル系の依存が入っていないことを確かめ、`vendor/graphon-wheel` を `sys.path` の先頭に置いて graphon を読み込みます。Jinja2 が読み込めることも確かめます（読めないと graphon は簡易の置き換えに切り替わるため）。
4. `graphon.dsl.inspect` で DSL を読み、loadable・依存0件・7ノード・8エッジを確かめます。Dify 本体の `WorkflowGraphTopology`（`vendor/dify/api/core/workflow/graph_topology.py` を改変せずに読み込む）で、同じグラフのつながりを確かめます。
5. 8件を1件ずつ、`graphon.dsl.loads(workflow, credentials=None, start_inputs=問い合わせ, config=GraphEngineConfig(min_workers=1, max_workers=1))` で読み込み、`list(engine.run())` で実行します。全イベントを型の名前と `model_dump(mode="json")` のまま残します。
6. 壊れた DSL を2つ渡し、graphon が返す実際の `DslError` を記録します。
7. すべての確認が通ったときだけ、`outputs/workflow-runs.json` を1回書き、同じバイト列を非公開フォルダーの `result-copy.json` にも書きます。

## 3. 1件ごとの確認

エンジンが返した値を、実行前に固定した `input/expected.json` と照らします。期待値から出力を作ることはしません。

- イベントが `GraphRunStartedEvent` で始まり、`GraphRunSucceededEvent` 1つで終わる。失敗・例外・中断のイベントがない。
- 動いたノードの種類が開始・if-else・template-transform・variable-aggregator・終了だけ（LLM のノードがない）。
- `NodeRunSucceededEvent` の順が `start → route → 担当のメモ → merge → end`。開始したメモのノードは1つだけ。
- route の `selected_case_id` と分岐のハンドルが期待値と一致する。
- メモのノードに渡った6項目が入力と完全に一致し、そのノードの出力、merge の出力、end の出力、最終の `text` が同じ文字列になる。
- メモの1行目が担当名で、番号・件名・種類・緊急度・人数がそのまま入り、本文が「本文：」の次の行から改変されずに入っている。
- D07：`{{ 7 * 7 }}` が文字のまま残って `49` がなく、`<script>alert("demo")</script>` がエスケープされずに残る。
- D08：影響0人・空の本文でも成功し、本文の行が空で、`None` と表示されない。
- 実行の後も、入力のオブジェクトが変わっていない。

全体では、D06 が請求窓口を通らないこと、D04 と D05 で 99人と100人の境目が分かれること、3つの分岐がすべて1回以上実際に通ったことを確かめます。

## 4. DSL の確認2件

入力の検証ではなく、graphon の DSL の読み込みが壊れた DSL をどう止めるかの記録です。

- P01：角かっこを閉じていない YAML を `graphon.dsl.inspect` に渡す。`parse.invalid_yaml` の `DslError` になることを確かめる。
- P02：`workflow.yml` の開始ノードを複製して2つにした DSL。`inspect` は loadable と判定し、`loads` が実行の起点を1つに決められず `graph.root_ambiguous` の `DslError` で止めることを確かめる。

## 5. 記録の読み方（outputs/workflow-runs.json）

| 項目 | 内容 |
| --- | --- |
| `source`・`runtime_dependency`・`source_lock_sha256` | Dify の固定コミットと版、graphon の版と公式 wheel の SHA-256、ロックの SHA-256 |
| `input_sha256` | 入力2ファイルと `workflow.yml` の SHA-256 |
| `runtime` | Python と OS、呼んだ API とそのファイルの置き場所、依存28件の版、通信・子プロセスの試みの件数（どちらも0でなければ記録は書かれない） |
| `cases[].input` | 固定した入力そのもの |
| `cases[].output` | 最終出力の `text`・`selected_case_id` と、成功したノードの順 `node_path` |
| `cases[].events` | `GraphEngine.run()` のイベント全件（型の名前と `model_dump(mode="json")`）。ID と時刻は実行ごとに変わる |
| `cases[].checks` | その1件で通った確認 |
| `dsl_probes` | P01・P02 の実際の例外（名前・コード・文面・詳細） |
| `topology` | Dify の `WorkflowGraphTopology` が返したつながり |
| `checks` | 全体の確認の一覧と件数 |

## 6. 限界

- 架空の8件の小さな確認です。大量の問い合わせ、速さ、実際の運用での振り分けの良し悪しは評価しません。
- Dify のサーバー・管理画面・API・Docker での起動・difyctl・Dify の画面への DSL の取り込みは試していません。`workflow.yml` は Dify の DSL の形に合わせて書きましたが、Dify の画面に取り込めるかは未確認です。
- 入力フォームでの選択肢・必須・文字数の検証は、この DSL ランタイムの実行には含まれず、試していません。
- モデル（LLM）・ナレッジ検索・ツール・プラグインのノードは使っていません。graphon の文書処理・モデル関係の依存も入れていません。
- 通信と子プロセスの拒否は Python の API の差し替えで、OS の隔離ではありません。
- ページでの確認、実機の iPhone Safari・VoiceOver・表示速度の測定、人による内容と見た目の承認、解説動画は、制作側の実行の後の工程です。
