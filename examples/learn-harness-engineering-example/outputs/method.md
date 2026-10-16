# 入力・処理・状態・出力・失敗の分け方

この作例は、架空の書店メモ8件を探す小さな Node CLI を、Harness Creator が作った状態ファイルで1機能だけ進め、次のセッションへ引き継ぐ練習です。何が固定の入力で、何が実行の結果で、何が状態なのかを、ファイルの場所で分けています。

## 入力（変えないもの）

| ファイル | 内容 |
| --- | --- |
| `project/input/notes/N01.md`〜`N08.md` | 架空の書店メモ8件。1行目が `id`・`title`・`tags` の JSON、空行、本文 |
| `project/input/queries.json` | 8問の語・タグ・期待ID。実装の前に固定した照合の条件 |
| `vendor/learn-harness-engineering/` | 固定コミット `38ddcd2` の Harness Creator スキルと LICENSE（改変なし） |

期待IDは照合にだけ使います。結果の記録は、CLI が実際に出した値です。期待IDから結果を作ることはしません。

## 処理

1. **5ファイルの生成**：固定版の `create-harness.mjs` を改変せずに `--target project --commands "node scripts/verify.mjs"` で実行。記録は `outputs/harness-created.json`、生成時の原本は `outputs/scaffold/`
2. **書き換えと実装（実装セッション）**：Claude Opus 5.5 が雛形の5ファイルのうち4つをこの練習用に書き換え、`project/src/notes.mjs`・`project/scripts/verify.mjs`・`project/docs/project.md` を書いた。`init.sh` は生成されたまま。このセッションはファイルの読み書きだけで、CLI も検証も実行していない
3. **実行（制作担当）**：`./init.sh`（中身は `node scripts/verify.mjs`）と、`build`・`search` を実際に実行し、標準出力を記録する
4. **再開セッション**：別の新しいセッションが、保存ファイルと検証の記録だけを読んで状態を更新する

## 状態（セッションをまたいで残すもの）

| ファイル | 役割 |
| --- | --- |
| `project/AGENTS.md` | 読む順番・1機能ずつ・範囲・完了の条件 |
| `project/feature_list.json` | 機能ごとの状態と証拠。作業中は常に1つ |
| `project/progress.md` | 何を書いたか、何が未実行か、リスク |
| `project/session-handoff.md` | 次のセッションの読む順番と、feat-001 を閉じてよい条件 |
| `outputs/sessions/implementation/`・`outputs/sessions/resume/` | 各セッションの終わりの状態の写し |

状態は会話の履歴ではなくファイルに置きます。モデルの会話履歴そのものは公開しません。

| 時点 | feat-001 メモの索引と検索 | feat-002 引用付き回答 |
| --- | --- | --- |
| 実装セッションの終わり | in-progress（実装済み・未検証） | not-started |
| 再開セッションの終わり | 検証の記録が条件を満たすときだけ done | not-started のまま |

## 出力（実行の結果）

| ファイル | 作るもの |
| --- | --- |
| `project/outputs/index.json` | `build` の出力。8件の全項目と入力の SHA-256 |
| `project/outputs/verification.json` | `verify.mjs` の標準出力。8問・意図的な失敗・入力の一致 |
| `outputs/exercise-run.json` | 実行のまとめ。入力9件の SHA-256、`./init.sh` の終了コード、2つのセッションの状態、8問の CLI 出力 |
| `outputs/harness-assessment.json` | 固定版 `validate-harness.mjs` の出力。構造の点検 |

`validate-harness.mjs` の点数は、状態ファイルに決まった見出しや項目があるかを数える構造の点検です。CLI のテストではなく、ハーネスの効果の測定でもありません。

## 失敗の分け方

- **意図的な失敗（`negative_controls`）**：壊れたメタデータ、IDの重複、知らない引数、必須の引数の欠落、既にある出力先、壊れた索引などを、一時フォルダに写した入力でわざと与え、CLI が終了コード1で断り、成功の出力を作らないことを確かめます。ここでの終了コード1は正しい結果で、作業やモデルの失敗ではありません
- **検証の失敗**：8問の結果・全項目・入力の一致のどれかが外れた場合。`verification.json` の `status` が `failed` になり、`failures` に理由が入り、`./init.sh` は終了コード0以外で終わります。この場合 feat-001 は done にしません
- **閲覧ページの読み込みの失敗**：記録が取得できない・JSON として読めない・固定コミットや SHA-256 が合わない場合。ページは理由と「もう一度読み込む」を出し、代わりのデータは使いません

## この作例で確かめないこと

- 講座の Project 01・02（ハーネスなしとの比較、Electron アプリ、模擬Q&A）
- ハーネスの効果や信頼性の向上。制作環境に別の指示ファイルがあり、ハーネスなしの公平な比較ができないため
- 引用付き回答や LLM による検索・回答


## 制作担当による実行後の記録

生成時のままのinit.shをGit Bashで実行し、Node24.18.0でメモ8件・検索8条件・負例11件を実行しました。期待IDに結果を置き換えず、CLIの標準出力と索引の全項目を元のメモと照合し、入力9件のSHA-256も変わらないことを確認しました。別の新しいOpus5.5セッションが、その実行根拠と引き継ぎファイルを読んで状態の3ファイルだけを更新し、feat-001done/feat-002not-startedを残しています。原典の構造点検は別に実行し、静的な見出し・語句の点検と実テストを区別します。条件をそろえた比較実験や、記憶・信頼性・速度の改善の実証ではありません。
