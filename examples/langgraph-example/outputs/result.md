# LangGraph 作例：機材貸出申請の実行結果

`python workflow.py` が LangGraph の StateGraph を実際に呼び出して保存した結果から、このファイルを自動で書き出しています。

- 使用した版：langgraph 1.2.15／checkpoint 4.3.0／prebuilt 1.1.0／sdk 0.4.7（langchain-ai/langgraph `d4149cc`）
- 単価：カメラ（camera）6,000円、三脚（tripod）1,000円、照明（light）4,000円。各品目の一申請あたり架空単価。日数掛けは行わない。
- 予算確認の目印：合計 30,000円 以上で budget_flag = true
- 完全な申請は金額にかかわらず review ノードの interrupt で一度止まります。

## 通常の申請（`approved`）

- 入力：広報係・青木（架空）／はじめての撮影会／2026-11-08〜2026-11-08／camera×1、tripod×2
- 見積：8,000円（budget_flag = false）
- 経路（チェックポイントの next から）：validate → estimate → review → finalize → END
- 停止：interrupt 1 件。停止時の get_state の next は `review`。payload の合計 8,000円
- 再開：`Command(resume=...)` に test_resume（approved = true）を渡し、同じ thread_id で続きを実行
- 最終状態：**承認（テスト値）**。コメント「テスト入力：内容を確認し、貸出可とする。」
- 保存したチェックポイント：6 件（get_state_history の件数。速さや品質の指標ではありません）
- 要約（finalize／needs_input ノードの出力）：見積合計 8,000円（予算確認の基準 30,000円 未満）。確認待ちで一時停止し、同じ thread に渡されたテスト回答（approved=true）で再開して「承認」で終了しました。コメント：テスト入力：内容を確認し、貸出可とする。

## 返却日のない申請（`missing`）

- 入力：企画係・木村（架空）／展示記録／2026-11-10〜（空）／camera×1
- 不足項目：end_date
- 経路（チェックポイントの next から）：validate → needs_input → END
- 停止：interrupt なし。見積・確認待ちには進んでいません。
- 最終状態：**追加入力が必要**
- 保存したチェックポイント：4 件（get_state_history の件数。速さや品質の指標ではありません）
- 要約（finalize／needs_input ノードの出力）：返却日（end_date）が空です。見積と確認待ちには進まず、追加入力を求めて終了しました。

## 高額の申請（`rejected`）

- 入力：制作係・佐藤（架空）／発表会の配信／2026-11-15〜2026-11-15／camera×4、light×3
- 見積：36,000円（budget_flag = true）
- 経路（チェックポイントの next から）：validate → estimate → review → finalize → END
- 停止：interrupt 1 件。停止時の get_state の next は `review`。payload の合計 36,000円
- 再開：`Command(resume=...)` に test_resume（approved = false）を渡し、同じ thread_id で続きを実行
- 最終状態：**差し戻し（テスト値）**。コメント「テスト入力：機材数と予算を見直すため差し戻す。」
- 保存したチェックポイント：6 件（get_state_history の件数。速さや品質の指標ではありません）
- 要約（finalize／needs_input ノードの出力）：見積合計 36,000円（予算確認の基準 30,000円 以上）。確認待ちで一時停止し、同じ thread に渡されたテスト回答（approved=false）で再開して「差し戻し」で終了しました。コメント：テスト入力：機材数と予算を見直すため差し戻す。

## この結果の範囲

- 申請者名・催し・単価・基準額はすべて架空です。
- 承認・差し戻しは inputs/requests.json の test_resume をスクリプトが渡したテスト値です。人が確認・承認したものではありません。
- 機材の予約・通知・決済などの外部処理は行っていません。
- チェックポイントは InMemorySaver のメモリ上だけにあり、プロセス終了で消えます。再起動後の再開や永続化は試していません。
- 各ノードは決まった規則の Python 関数です。LLM の推論・API 呼び出し・ネットワークは使っていません。
- 数値の照合は workflow.py 内の assert 相当の確認で、品質評価ではありません。

## ファイル

- 入力：[../inputs/requests.json](../inputs/requests.json)
- 実行結果：[runs.json](runs.json)
- 入出力の対：[../samples.json](../samples.json)
- ソース：[../workflow.py](../workflow.py)
