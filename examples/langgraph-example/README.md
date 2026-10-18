# LangGraph 作例：止める。確かめる。続きを動かす。

架空の機材貸出申請3件を、LangGraph の `StateGraph` で実際に処理する作例です。

入力確認 → 条件付きエッジによる分岐 → 見積 → `interrupt` で確認待ちに停止 → `Command(resume=...)` にテスト値を渡して同じ thread を再開 → 結果を保存、までを `workflow.py` が行います。`index.html` は、その保存済みの実行結果を読むだけのビューアです。ブラウザでは Python も AI も動きません。

## 見方

1. 下の「実行し直す」の手順で `python -m http.server 8000` を起動し、`http://127.0.0.1:8000/` を開きます。
2. 「3件の申請を切り替える」のボタンで、通常の申請・返却日のない申請・高額の申請を選びます。`index.html#approved`・`#missing`・`#rejected` で各申請を直接開けます。
3. 「申請内容（入力）」で、申請者・催し・日付・品目を確かめます。
4. 「通った経路」で、保存されたチェックポイントの `next` から並べた経路を見ます。チェックポイントの件数は速さや品質の指標ではありません。
5. 通常と高額の申請では「確認待ちで止まる」に、止まった時点の `interrupt` の payload と id、`get_state` の `next`（`review`）が出ます。「テスト回答で再開」に、`Command(resume=...)` へ渡した値が出ます。返却日のない申請は止まらずに `needs_input` で終わります。
6. 「技術的な詳細」を開くと、再開前後の `get_state` と `get_state_history` の全チェックポイントを JSON のまま読めます。
7. 「ファイルを持ち帰る」から `inputs/requests.json`・`outputs/runs.json`・`outputs/result.md`・`workflow.py` を保存できます。

## 3件の入力と期待する結果

| id | 入力 | 期待する結果 |
| --- | --- | --- |
| `approved` | カメラ1・三脚2 | 8,000円、確認待ちで停止、テスト値 `approved: true` で再開 → `approved` |
| `missing` | 返却日（`end_date`）が空 | `missing_fields: ["end_date"]`、interrupt なし → `needs_input` |
| `rejected` | カメラ4・照明3 | 36,000円（`budget_flag: true`）、確認待ちで停止、テスト値 `approved: false` で再開 → `rejected` |

単価は一申請あたりの架空の値で、日数は掛けません。金額にかかわらず、完全な申請はすべて確認待ちで止まります。`workflow.py` はこの期待値と interrupt の件数を実行結果と照合し、一つでも違えば出力を書かずに終了コード1で止まります。これは実装と実行結果の照合で、品質の評価ではありません。

## 実行し直す

Python 3.10 以上で、この作例のフォルダ（`workflow.py` がある場所）から実行します。APIキー・アカウント・ネットワーク上のサービスは使いません（パッケージの取得を除く）。

```
python -m venv .venv
```

仮想環境を有効にします。

- Windows（PowerShell）：`.venv\Scripts\Activate.ps1`
- macOS・Linux：`source .venv/bin/activate`

有効にしたシェルで続けます。

```
python -m pip install -r requirements.lock.txt ./vendor/langgraph/libs/checkpoint ./vendor/langgraph/libs/prebuilt ./vendor/langgraph/libs/sdk-py ./vendor/langgraph/libs/langgraph
python workflow.py
python -m http.server 8000
```

ブラウザで `http://127.0.0.1:8000/` を開きます。`file://` で直接開くと JSON を読み込めません。`app.mjs` を JavaScript（`text/javascript`）として返すHTTPサーバーが必要です。

- LangGraph の4パッケージ（langgraph 1.2.15・langgraph-checkpoint 4.3.0・langgraph-prebuilt 1.1.0・langgraph-sdk 0.4.7）は、`vendor/langgraph/` に同梱した固定コミットのソースから入れます。
- それ以外の依存（pydantic など）は `requirements.lock.txt` に版を固定して記載しています。
- `workflow.py` は、インストール済みの4パッケージの版が上と違えば止まります。
- `python workflow.py` が書き出すのは `outputs/runs.json`・`outputs/result.md`・`samples.json` です。標準出力には、各申請の status・合計・interrupt 件数と使用した版を短いJSONで出します。

## 実装の要点

- `StateGraph(RequestState)` に `validate`・`needs_input`・`estimate`・`review`・`finalize` の5ノードを置き、`add_conditional_edges("validate", ...)` で `needs_input` か `estimate` へ分けます。
- `review` ノードは `interrupt(payload, response_schema=ReviewDecision)` を呼びます。`ReviewDecision` は `approved`（真偽値）と `comment`（文字列）だけを受け付ける Pydantic モデルです。再開値の検証は LangGraph が行います。
- `compile(checkpointer=InMemorySaver())` したグラフを、申請ごとに固定の `thread_id` で `invoke` します。最初の `invoke` の戻り値に入った `__interrupt__` を数え、同じグラフ・同じ config に `Command(resume=...)` を渡して再開します。
- 再開前後の `get_state` と、`get_state_history` の全チェックポイント（古い順の `values`・`next`・`created_at` など）を JSON に保存します。

## この作例の範囲

- **メモリ上のチェックポイントだけ**：`InMemorySaver` はプロセスのメモリに状態を置きます。停止と再開は同じ Python プロセスの中で行いました。プロセスを終えると消えるため、再起動後の再開はできません。実際の運用では、Postgres などの永続的なチェックポインターが別に必要です。
- **止まったノードは先頭からやり直される**：LangGraph は再開時に `interrupt` を呼んだノードを最初から実行し直します。そのため `review` では、`interrupt` より前に記録・送信などの副作用を置いていません。
- **規則で動く処理で、LLM は使っていない**：各ノードは決まった規則で動く Python 関数です。モデルの推論・判断ではありません。LangGraph はモデルを組み込んだ処理にも使えますが、その接続や費用はこの作例の範囲外です。
- **テスト値は人の承認ではない**：承認・差し戻しは `inputs/requests.json` の `test_resume` をスクリプトが渡した値です。人が確認して押したものではありません。人が実際に確認するには、回答する画面と永続的な保存先が要ります。
- **外部の処理はしていない**：機材の予約・在庫の確保・通知・決済は行っていません。トレース用の外部サービスにも送っていません。
- **時刻は速さの測定ではない**：チェックポイントの `created_at` はライブラリが記録した値で、処理速度の測定ではありません。

## ファイル

- `workflow.py`：この作例の実装（StateGraph・InMemorySaver・interrupt・Command）
- `inputs/requests.json`：架空の申請3件・単価表・期待値
- `outputs/runs.json`・`outputs/result.md`・`samples.json`：`workflow.py` が書き出す実行結果
- `index.html`・`style.css`・`app.mjs`：保存済みの結果を読むビューア
- `request.txt`：同じ作りを依頼するための日本語の依頼文
- `vendor/langgraph/`：langchain-ai/langgraph 固定コミット `d4149cc1f5384364d1a21092b4c2f582a6e7af8f` の4パッケージ（変更なし）

## ライセンス

- 作例のコード・文章・データ：MIT License（Copyright (c) 2026 Studio Yebisu）
- 同梱した LangGraph：MIT License（Copyright (c) 2024 LangChain, Inc.）。`vendor/langgraph/LICENSE` と、`libs/` 以下の各パッケージの `LICENSE` をそのまま残しています。

原典：https://github.com/langchain-ai/langgraph/tree/d4149cc1f5384364d1a21092b4c2f582a6e7af8f

制作ブリーフは公開している brief-to-demo の手順（サイトのリポジトリでは `../../skills/brief-to-demo/SKILL.md`）で、目的・実入力・成果物・完了条件を決めてから作りました。

## 現在の実行・動画確認

固定原典の四Pythonパッケージを実際に導入し、インストール済み157ファイルが固定ソースと一致することを確認しました。通常8000円は1回停止してテスト値trueで承認、返却日不足は停止せずneeds_input、高額36000円は1回停止してテスト値falseで差し戻し。チェックポイント6/4/6件と全最終状態を保存し、ビューアの生データと照合しました。実行は外向きsocket接続を拒否し、トレーシング設定を除いた環境です。モデル推論・人の承認・実予約・再起動後の永続化は行っていません。

動画は28秒・1280×720・30fps・840フレーム・無音。実出力と実画面を使う編集動画で、連続操作の録画ではありません。同梱Motion Reelで書き出し、代表・連続フレーム、同時刻の描画一致、全デコード、実MP4の終端を制作担当が確認しました。人の審美的承認ではありません。現在の記録は verification.json、storyboard.json は制作時の設計記録です。

ソースZIPは examples/langgraph-example/ と media/、公開済みbrief-to-demoの本文・MIT表記を含みます。展開先ルートでHTTP配信し、/examples/langgraph-example/ を開けます。Pythonの再実行はその作例ディレクトリのREADME手順を使ってください。動画を作り直す場合はNode.js20以上・Python・Chrome・FFmpeg/ffprobeが必要です。

```text
npm ci --ignore-scripts --no-audit --no-fund --prefix examples/langgraph-example/tools/motion-reel
python examples/langgraph-example/render.py --out renders/video-first
```

依存本体、仮想環境、認証、モデル履歴は配布していません。物理iPhone/Safariでの実機確認は未実施です。


## 概念構造版 visual-r1

上の28秒動画と実行確認は元制作時の記録です。現在のindex.html/video/index.htmlは、API部品・共有状態・分岐・メモリ・中断/再開をつなぐ新しい図と32秒縦横無音動画です。原制作の3グラフ/2Opus受領/157installed確認は保全して再実行していません。全文ビューアはdesk.html、旧28秒の編集ソースはvideo/legacy.html、上のrender.pyはその旧入口へ向けました。新32秒はrender-visual.pyを使い、手順と確認範囲はvisual-guide.mdとvisual-verification.jsonへ分けます。実JSON3件は元jobsの包装で新推論ではありません。元source.zipと旧MP4は私的履歴へ保全し、現在のZIPは同じ展開ルート形式で新しい編集ソース/縦横MP4を包んだものです。
