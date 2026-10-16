# Codebase Memory MCP 作例：結果メモ

workflow.py が [outputs/runs.json](runs.json) と同じ実行結果から書き出したメモです。架空の注文リポジトリ（[fixture/](../fixture/)）を、公式 CLI で索引・検索しました。

- ツール：codebase-memory-mcp（`--version` の出力：`codebase-memory-mcp 0.12.0`、v0.12.0、ソース固定コミット `ec6427c38176efcd37b28682e82f2491afda94be`）
- 呼び方：official native CLI; MCP protocol not exercised。MCP プロトコル経由の動作は確かめていません。
- プロジェクト名（list_projects が返した値）：`yebisu-workshop-proof`
- パスの `fixture/` は実行用コピーを指します。元の fixture/ は変えていません。

## 1. 探す：submit_order の定義

search_graph（`name_pattern` `^submit_order$`、`label` Function）が返した定義は1件です。

- qualified_name：`yebisu-workshop-proof.service.submit_order`
- 場所：[fixture/service.py](../fixture/service.py) の 8 行目（実ソースの `def submit_order` は 8 行目）
- get_code_snippet の本文：空行を除く 12 行のうち 12 行が、実ソースの行と同じ文字列でした。

## 2. たどる：submit_order からの呼び出し

query_graph（`MATCH (f:Function)-[:CALLS]->(g) RETURN f.name AS caller, g.name AS callee LIMIT 100`）は CALLS の組を 6 件返しました。
そのうち submit_order から出る組と、実ソースの呼び出し式：

- submit_order → validate_order：[fixture/service.py](../fixture/service.py) 9 行目 `validate_order(order)`
- submit_order → calculate_total：[fixture/service.py](../fixture/service.py) 10 行目 `total = calculate_total(order["seat_count"], order["seat_price_jpy"])`
- submit_order → save_receipt：[fixture/service.py](../fixture/service.py) 18 行目 `save_receipt(receipt, out_dir)`

trace_path（outbound、深さ 4）の応答に出た関数名：validate_order、calculate_total、save_receipt

これは索引に記録された静的な呼び出し関係です。実行時に記録したトレースではありません。

## 3. 変える：storage.py を差し替えて手で索引し直す

実行用コピーの storage.py だけを [fixture/storage_revised.py](../fixture/storage_revised.py) に差し替えました（追加 17 行）。save_receipt の 15 行目 `audit_receipt(receipt, folder)` が新しい呼び出しです。

| 時点 | CALLS の組 | save_receipt → audit_receipt |
| --- | ---: | --- |
| 初回の索引 | 6 | なし |
| ファイル変更後・再索引の前 | 6 | なし |
| 手で index_repository をやり直した後 | 7 | あり |

再索引後の search_graph は audit_receipt を fixture/storage.py の 19 行目（差し替え後の実ソースの def 行：19）として返しました。
CLI で作った索引は監視されないため、ファイルを変えただけでは索引は古いままです。変更後は index_repository を手でやり直します。

## 架空の注文を実際に実行した結果（索引とは別の確認）

- 変更前：`receipt-WS-0001.json` の total_jpy は 2400（2席 × 1200円）
- 変更後：`receipt-WS-0001.json` の total_jpy は 2400、`audit-WS-0001.json` の recomputed_total_jpy は 2400、consistent は true

領収と監査のJSONは、workflow.py が指定した作業ディレクトリの中にだけ書かれました。決済・予約・通知はしていません。

## 範囲と限界

- MCP クライアントからの接続、CBM Lens、ブラウザAI、意味検索、大きなリポジトリは試していません。
- 速さ・トークン量・回答品質は測っていません。原典の数値は作者の測定です。
- 静的な索引には、動的な呼び出し（getattr、辞書に入れた関数など）が出ないことがあります。辺がないことは、呼ばれないことの証明ではありません。
- 実行ファイル・モデル・索引キャッシュは配布していません。

## ファイル

- [runs.json](runs.json)：要求・応答・照合の全記録
- [samples.json](../samples.json)：3つの操作の入力と出力
- [workflow.py](../workflow.py)：この結果を作った実行用ソース
- [fixture/service.py](../fixture/service.py)・[fixture/storage.py](../fixture/storage.py)・[fixture/storage_revised.py](../fixture/storage_revised.py)：照合したソース
