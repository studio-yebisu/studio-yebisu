# 問い合わせを、3つの担当へ。— Dify ワークフローの作例

問い合わせ1件（番号・種類・緊急度・影響人数・件名・本文）を渡すと、決めたルールで担当を1つ選び、日本語の引き継ぎメモを返します。その流れを Dify 形式のワークフロー（`workflow.yml`）に書き、Dify 1.17.1 が依存に指定する graphon 0.7.0 の DSL ランタイムで、架空の8件を実行して記録を保存する作例です。

```text
問い合わせを書く → 担当を決める（if-else）→ 担当のメモを作る（template-transform）→ まとめる → 保存した JSON と DSL をページで読む
```

担当を決めるルールは上から順に判定し、最初に当てはまった分岐だけを通ります。

| 順 | 条件 | 分岐 ID | 担当 |
| --- | --- | --- | --- |
| 1 | 緊急度が「至急」、または影響人数が100以上 | `urgent` | 優先対応 |
| 2 | 種類が「請求」 | `billing` | 請求窓口 |
| 3 | どちらにも当てはまらない | `false` | 通常窓口 |

これは値の比較（`is` と `≥`）と Jinja2 テンプレートの差し込みです。AI が文章の意味を読んで分類したり、要約したりする処理ではありません。

## ファイル

| ファイル | 内容 |
| --- | --- |
| `workflow.yml` | 独自に書いた Dify DSL（kind: app・version 0.3.0・mode: workflow、7ノード・8エッジ）。モデル・ツール・プラグイン・認証・URL は書いていません |
| `input/tickets.json`・`input/expected.json` | 制作側が実行の前に作って固定した、架空の8件と期待する分岐。実行後に変えません |
| `run.py` | 照合 → 実行 → 確認 → 記録を行う CLI |
| `outputs/workflow-runs.json` | 実際に動かした8件の入力・出力と160件のイベント。196の自動確認がすべて通った記録です |
| `index.html`・`style.css`・`app.js` | 保存した記録を読むスマホ優先のページ |
| `outputs/method.md` | 手順・確認の中身・読み方・限界 |
| `vendor-lock.json`・`vendor/` | 改変していない原典292ファイルと、その SHA-256 |
| `requirements-runtime.txt` | この確認で使う範囲の依存28件（版を固定） |

## 再現の手順

公開されているこのフォルダーを直接使わず、コピーした別のフォルダーで実行してください。コピー内の `outputs/workflow-runs.json` は、同じコピー内で `workflow-runs.recorded.json` などへ名前を変えて保存してから実行します。既存の記録がある場所では run.py は上書きせずに止まります。公開済みの原本は変更しません。

```text
python -m venv <非公開の仮想環境>
<非公開の仮想環境>/bin/python -m pip install -r requirements-runtime.txt   # Windows は Scripts\python
<非公開の仮想環境>/bin/python run.py --artifact-dir <このフォルダーの外の、新しい空のフォルダー>
```

- Python は 3.12 以上 3.14 未満（graphon 0.7.0 の条件）。制作側の事前確認は Python 3.13.7 です。
- graphon は pip で入れません。`vendor/graphon-wheel/` は公式 wheel（SHA-256 `6f7608aa…0cf4404e`）の中身で、配布情報 `graphon-0.7.0.dist-info` も含むため、run.py が `sys.path` の先頭に置いて読み込みます。
- 依存28件は、この作例で使う開始・条件分岐・テンプレート・集約・終了のノードと DSL の読み込みに必要な範囲です。graphon 本来の依存にある文書処理やモデル関係（pandas・transformers・unstructured・pypdf など）は入れておらず、その機能は確かめていません。run.py はそれらが入っていないことも確かめます。
- 依存の導入には通信が要ります。run.py の実行中は通信も子プロセスも使いません。アカウント・API キー・課金は要りません。
- 失敗したときは終了コードが0以外になり、公開用の記録は書かれません。`--artifact-dir` には同じ内容の `result-copy.json` と短い `run-log.txt` が残ります（どちらも公開しません）。

ページは `fetch` と Web Crypto で記録とハッシュを確かめるため、`https` か `http://localhost` で開いてください（`file://` では照合できず、理由だけを表示します）。

## 確かめた範囲・確かめていない範囲

- 確かめる：Dify の公式依存 graphon 0.7.0 の `graphon.dsl.inspect`・`graphon.dsl.loads`・`GraphEngine.run()` で、この DSL が読み込まれて8件とも動くこと。Dify 本体の `api/core/workflow/graph_topology.py` の `WorkflowGraphTopology` を、改変せずに同じグラフへ使うこと。
- 確かめない：Dify のサーバー・管理画面（console）・API・Docker での起動、difyctl、Dify の画面への `workflow.yml` の取り込み、モデル（LLM）・ナレッジ検索・ツール・プラグイン、入力フォームでの選択肢や必須の検証、速さ・大量の問い合わせ。
- `vendor/dify/skills/difyctl/SKILL.md` は、Dify サーバーにつなぐ CLI の手順です。この作例ではサーバーを起動しないため、範囲の確認に読んだだけで、使っていません。
- 通信と子プロセスの拒否は、run.py が Python の API（`socket.socket.connect`・`connect_ex`・`socket.create_connection`・`socket.getaddrinfo`・`subprocess.Popen`・`os.system`）を差し替えて数える仕組みです。OS 全体の遮断ではありません。

## 利用条件

- 作例のコード・文章・架空の入力：MIT License（Copyright (c) 2026 Studio Yebisu）。
- `vendor/dify/`：langgenius/dify の固定コミット `f77facfe6520ed379d723288aed0b4806ad76143`（1.17.1）のファイルを改変せずに置いたもので、Dify Open Source License です。Apache License 2.0 を基に、マルチテナントの環境での運用と、フロントエンド（`web/`）のロゴ・著作権表示の変更について追加の条件があります。全文は `vendor/dify/LICENSE`。この作例は `web/` を使わず、コピーもしていません。Dify のロゴや画面も使っていません。
- `vendor/graphon-wheel/`：graphon 0.7.0 の公式 wheel の中身で、Apache License 2.0 です。全文は `vendor/graphon-wheel/graphon-0.7.0.dist-info/licenses/LICENSE`。
- 依存28件はそれぞれの利用条件に従います（仮想環境に入り、配布しません）。

## 作った人と動かしたもの

`workflow.yml`・`run.py`・ページ・この説明は Claude Opus 5.5 が書きました。架空の入力2ファイルは制作側が実行の前に作りました。ワークフローを実際に動かすのは graphon のエンジンで、実行は制作側が行います。AI はワークフローの中で動いていません。

## 制作側による実行と照合

Python3.13.7で8件を実行し、196の自動確認・通信/子プロセスの試行0件を確認しました。優先対応3件・請求窓口1件・通常窓口4件です。別のPythonで実入力・最終応答・実ノードとエッジを照合し、Difyの位相APIは独立した探索の49組と一致しました。`outputs/independent-checks.json` に要点があります。さらにコピーした別フォルダーで公開記録を保存してから同じCLIを実行し、8件の入力・最終メモ・経路・成功ノードの値が一致しました。Graphonが内部変数に付けるUUIDとイベントのID・時刻は毎回変わり、バイト単位の実行再現性の保証ではありません。`outputs/reproduction-checks.json` を参照してください。

元の公開版では、6幅・全8件の実入力と実出力、イベント、保存、コピー、失敗からの再読み込みと28秒の動画を確認しました。これは元の版の確認記録です。今回の図と32秒の無音動画の確認は、verification.jsonのvisual-r1に別途記録しています。元入力・API実行器・実出力は保持し、改修のための再実行はしていません。

固定したDifyの `api/uv.lock` のGit blobと照合し、Graphonの公式wheelのSHA-256が、今回実行した0.7.0と一致することも確認しました。`upstream-evidence.json` に最小の原典記録があります。独自コード・日本語・映像ソースはOpus 5.5、元入力・実行・独立照合・スマホの表示補正・検証と包装は制作側です。自動確認とエージェントの視覚確認は、人による内容や見た目の承認ではありません。


## 図中心の改修（2026-10-17）


架空の問い合わせ8件を実行した記録を、一つの大きな概念図で見ます。同じ封筒が、上から順に判定するスイッチを通り、優先対応・請求窓口・通常窓口のいずれかへ進んで、実際の引き継ぎメモに開きます。32秒の無音動画にも同じ関係を使っています。

「請求」と「請求＋至急」を切り替えると、請求でも至急なら先に優先対応へ進むことが分かります。「99人」と「100人」では、種類・緊急度・人数の3つの分岐項目のうち、人数の境目で通常から優先へ変わります。この2件は件名や本文も異なる保存済みの問い合わせで、全入力が人数だけ違う比較や、画面で人数を編集して実行する機能ではありません。

「入力文字」では、記号を含む件名や本文が文字のまま実メモに残ります。0人・本文が空のD08も元の記録に保持しています。これらの確認は、この限定した入力例の実結果であり、一般的な安全性やフォーム検証の保証ではありません。

原典292ファイル、実行器、独自DSL、原入力、8件160イベントの実出力と独立した照合を変更せずに引き継ぎました。値の比較とJinja2テンプレートの差し込みを実行したのは、固定版のGraphon DSLエンジンです。AIによる意味の分類や要約ではありません。図は保存済みの結果を読む独自画面で、Difyサーバー・管理画面・API・difyctlを起動したり、モデルを呼び出したりしません。

選んだ実記録のJSONと元のworkflow.ymlを保存できます。図と映像の新しいコードはClaude Opus5.5が執筆し、制作側が記録の条件表示と冒頭ラベルの補正、検証・書き出し・包装・掲載を担当しました。音声ガイドはありません。自動検査やエージェントの視覚確認は、人による内容や見た目の承認、実機iOSでの確認とは区別します。

縦動画は../../media/dify-example.mp4、横動画は../../media/dify-example-wide.mp4、編集ソースはvideo/index.htmlです。元の記録を読む画面はcomparison.htmlに保持しています。Dify Open Source Licenseの追加条件とGraphonのApache-2.0を区別し、Difyのweb/・公式画面・ロゴは使っていません。
