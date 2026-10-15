# Implementation Plan: 工房のTODO — 期限の絞り込み

> 合成データの作例。元は `lab/SPEC.md`。この計画は人のレビュー・承認を経ていない。ユーザーが事前に可逆な内部判断と順次掲載を任せているため、制作担当（親）の検証で次へ進む。これを人の承認とは呼ばない。

## Overview

既存の `selectTasks(tasks, {status, cutoff})` の未使用の `cutoff` を有効にし、既存の画面の絞り込み欄から「期限（この日まで）」で選べるようにする。2つの小さな増分に分ける。1つ目で有効な暦日による絞り込みを画面まで通し、2つ目で実在しない暦日を `RangeError('INVALID_CUTOFF')` で拒む。

## Architecture Decisions

- 新しい関数・モジュールは作らない。`selectTasks` の既存の `cutoff` 引数を有効にする（SPEC §1「許可する振る舞い」）。
- 暦日は `YYYY-MM-DD` の文字列のまま比較する。`Date` へ変換しない（SPEC §5, V8）。
- 判定は `tasks.mjs` の純粋関数だけが持つ。`app.mjs` は入力値を渡し、`RangeError` を日本語の案内へ置き換えるだけ（SPEC §4）。
- 増分の順は依存に従う。検証は絞り込みの入力契約なので、絞り込みが先にあることが前提。1つ目の終了時点でも、画面の日付入力は有効な日付か空しか渡さないため、動く状態を保てる。
- 既存の3テスト（`runtime/baseline.json` で3件成功を親が実行済み）は変えない。新しいテストは末尾へ追加する。

## Dependency Graph

```
selectTasks の cutoff（tasks.mjs）
    ├── 画面の日付入力と配線（index.html / app.mjs）   … Task 1
    └── 暦日の検証と画面の案内（tasks.mjs / app.mjs）  … Task 2
```

## Task List

詳細と完了の印は `tasks/todo.md`。

### Phase 1: 有効な暦日の絞り込み
- [ ] Task 1: 期限の絞り込みを既存の画面まで通す

### Checkpoint: Task 1 後
- [ ] `npm test` と `npm run check` が成功（親が実行）
- [ ] ブラウザーで UI-1〜UI-3 を実操作で確認（親が実行）
- [ ] commit
- [ ] 制作担当（親）の検証で次へ。人の承認ではない

### Phase 2: 不正な暦日の拒否
- [ ] Task 2: 実在しない暦日を `INVALID_CUTOFF` で拒む

### Checkpoint: Task 2 後
- [ ] `npm test` と `npm run check` が成功（親が実行）
- [ ] ブラウザーで UI-4 を確認、または U2 の結果により画面から到達できないことを記録（親が実行）
- [ ] commit

この2つの後に、親が境界・回帰の確認（SPEC §8 の残りの F/V/R、UI-5〜UI-7、U3）とコードレビューを別の段階で行う。この計画のタスクには含めない。

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| 最小実装で `cutoff` 省略・`null`・`''` の全件表示が壊れる | High | 既存テスト1（cutoff省略）が守る。`null`/`''` は後の境界の段階で F4/F5 として足す |
| 期限なし（`null`）の扱いを誤り、`idea` が残る | Med | RED1 のテストが `idea` を除いた期待値を持つ |
| Task 1 の間は不正な cutoff が文字列比較で素通りする | Low | 画面の日付入力からは来ない。Task 2 で塞ぐまでの一時的な状態として明記 |
| `Date` 変換でタイムゾーンにより日付がずれる | Med | 文字列比較の方針。U3 を親が別のTZで実行して確かめる |

## Open Questions

人の判断を待つ問いはない。SPEC §9 の U1〜U5 は親が実行して確かめる。
