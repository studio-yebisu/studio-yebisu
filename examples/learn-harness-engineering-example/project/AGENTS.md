# AGENTS.md

架空の書店メモ8件（`input/notes/N01.md`〜`N08.md`）を索引にして、語とタグで探す Node.js 20+ の CLI（`src/notes.mjs`）の練習プロジェクト。Harness Creator（walkinglabs/learn-harness-engineering `38ddcd2`）の `create-harness.mjs` が作った5ファイルを、このプロジェクト用に書き換えた。生成時の原本は `../outputs/scaffold/` に残してある。

## Startup Workflow

Before writing code（作業前に、この順で読む）:

1. `pwd` で作業先がこのフォルダ（`project/`）か確かめる
2. このファイルを最後まで読む
3. `feature_list.json` → `progress.md` → `session-handoff.md` を読む
4. `docs/project.md`（CLIの入出力・8問の確認・意図的な失敗）を読む
5. `outputs/verification.json` があれば読む。無ければ検証は未実行として扱う
6. シェルが使えるなら `./init.sh` を実行する（Windows は Git Bash）

検証が失敗していたら、新しい範囲へ進まず先に直す。

## Working Rules

- **One feature at a time**: `in-progress` は常に1件だけ。今の対象は `feat-001` のみ
- **Stay in scope**: 触るのは `src/notes.mjs`・`scripts/verify.mjs`・状態ファイル・`docs/project.md`。`input/`（固定入力と期待ID）・`init.sh`・`package.json` は変えない
- **No API / no install**: Node の組み込みモジュールだけを使う。外部API・キー・アカウント・通信・`npm install` を使わない
- **Evidence before done**: 実際に実行した検証の記録がない限り `done` にしない
- **Delegated verification**: シェルを使えないセッションでは、検証を自分で実行したと書かない。実行は制作担当に任せ、その標準出力が `outputs/verification.json` に保存されてから判断する

## Definition of Done

A feature is done only when ALL of the following are true:

- [ ] 対象の動作が `src/notes.mjs` にある
- [ ] `./init.sh`（中身は `node scripts/verify.mjs`）が実際に終了コード0で終わった
- [ ] その出力が `outputs/verification.json` にあり、`status: "passed"`・`note_count: 8`・`query_count: 8`・`source_integrity: true`、全 `queries` と全 `negative_controls` が `passed`
- [ ] 証拠の場所を `feature_list.json` の `evidence` と `progress.md` に書いた
- [ ] 次のセッションが `./init.sh` からすぐ始められる

## Verification Commands

```bash
# 標準の検証（Windows は Git Bash から）
./init.sh
# 中身と同じもの
node scripts/verify.mjs
```

`verify.mjs` は CLI を子プロセスで実行し、JSON を1つだけ標準出力へ書く。意図的な失敗（`negative_controls`）の終了コード1は、CLI が正しく断ったことの確認で、作業の失敗ではない。

## End of Session

Before ending a session:

1. `progress.md` を今の状態に更新する
2. `feature_list.json` の状態と証拠を更新する（実行していない検証は書かない）
3. 未解決のリスクを `progress.md` と `session-handoff.md` に書く
4. 次のセッションが `./init.sh` からすぐ始められる状態にして終える

## Escalation

- **仕様の迷い**: `docs/project.md` と `input/queries.json` を正とし、期待IDは変えない
- **検証が繰り返し失敗する**: `progress.md` に失敗した確認名を書き、人に判断を求める
- **範囲の迷い**: `feature_list.json` の依存関係を読み直す。`feat-002` は `feat-001` が `done` になるまで始めない
