# TODO: 期限の絞り込み

> 計画は `tasks/plan.md`。チェックは親が実際に実行・確認した後だけ付ける。

## Task 1: 期限の絞り込みを既存の画面まで通す

**Description:** `selectTasks` の `cutoff` を有効にし、期限が指定日以前（当日を含む）のTODOだけを入力順で返す。期限なしは絞り込み中だけ除く。既存の絞り込み欄に「期限（この日まで）」の日付入力を1つ足し、`app.mjs` から `cutoff` を渡す。

**Acceptance criteria:**
- [ ] RED1 テスト（status `open`、cutoff `2026-10-15` → `['proposal','sample']`）が実装前に失敗し、実装後に成功する（F1）
- [ ] 既存の3テストが無変更で成功する（R1）
- [ ] 画面で UI-1〜UI-3 が成り立つ（初期6件、未完了＋2026-10-15で `2件 / 全6件`、空に戻すと状態の絞り込みだけ）

**Verification:**
- [ ] RED: `npm test` で RED1 だけが失敗し、既存3件は成功（親が実行）
- [ ] GREEN: `npm test` が全件成功（親が実行）
- [ ] Check: `npm run check`（構文確認。ビルド工程は存在しない）
- [ ] Manual: ブラウザーで UI-1〜UI-3（親が実行）

**Dependencies:** None

**Files likely touched:**
- `tasks.test.mjs`（RED1 を追加済み）
- `tasks.mjs`
- `app.mjs`
- `index.html`

**Estimated scope:** Medium（4ファイル。各数行）

## Checkpoint: Task 1 後
- [ ] `npm test` / `npm run check` 成功
- [ ] UI-1〜UI-3 を実操作で確認
- [ ] commit
- [ ] 制作担当（親）の検証で Task 2 へ。人の承認ではない

## Task 2: 実在しない暦日を `INVALID_CUTOFF` で拒む

**Description:** `cutoff` が `null`・`''`・省略以外のとき、`YYYY-MM-DD` 形式・年1000〜9999・閏年を含む実在日かを `Date` なしで確かめ、外れたら `RangeError('INVALID_CUTOFF')` を投げる。画面は例外を受けたら絞り込み欄の近くに日本語の案内を出し、状態の絞り込みだけで一覧を出す。

**Acceptance criteria:**
- [ ] 不正な暦日（代表 `2026-02-30`）のテストが実装前に失敗し、実装後に `RangeError` / `INVALID_CUTOFF` で成功する（V1）
- [ ] Task 1 までの全テストが成功したまま（F1・R1）
- [ ] 画面で UI-4 が成り立つ、または U2 により画面から到達できないことを記録する

**Verification:**
- [ ] RED: `npm test` で新しいテストだけが失敗（親が実行）
- [ ] GREEN: `npm test` が全件成功（親が実行）
- [ ] Check: `npm run check`
- [ ] Manual: ブラウザーで UI-4 / U2（親が実行）

**Dependencies:** Task 1

**Files likely touched:**
- `tasks.test.mjs`
- `tasks.mjs`
- `app.mjs`
- `index.html`（案内の表示先）

**Estimated scope:** Medium（4ファイル）

## Checkpoint: Task 2 後
- [ ] `npm test` / `npm run check` 成功
- [ ] UI-4 または U2 の結果を記録
- [ ] commit

## この計画の外（親が後の段階で行う）
- 境界・回帰: SPEC §8 の F2〜F10、V2〜V8 と受け付ける境界、R2/R3、UI-5〜UI-7、U3
- コードレビュー
