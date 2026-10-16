# Session Progress Log

> 最新の状態は末尾の「再開セッション（状態の更新のみ）」節。下の実装セッションの記録は当時のまま残す。

## Current State

**Last Updated:** 2026-10-17（実装セッション）
**Session ID:** implementation
**Active Feature:** feat-001 - メモの索引と検索（in-progress・未検証）

## Status

### What's Done

- [x] `src/notes.mjs` を書いた（`build` と `search`。Node 組み込みモジュールだけ）
- [x] `scripts/verify.mjs` を書いた（CLI を子プロセスで実行する検証。8問と意図的な失敗11件）
- [x] `AGENTS.md`・`feature_list.json`・`progress.md`・`session-handoff.md` を、生成された雛形からこのプロジェクト用に書き換えた
- [x] `docs/project.md` に CLI の入出力・確認の範囲を書いた

上の「済み」はファイルを書いたという意味で、実行して確かめたという意味ではない。

### What's In Progress

- [ ] feat-001 の検証
  - Details: 制作担当が `./init.sh`（= `node scripts/verify.mjs`）と、`node src/notes.mjs build --input input/notes --out outputs/index.json`・`search` を実際に実行し、標準出力を `outputs/verification.json` などに保存する
  - Blockers: このセッションはファイルの読み書きしかできず、シェル・Node を実行できない。CLI も検証もまだ一度も実行していない

### What's Next

1. 次のセッションは `session-handoff.md` の手順で `outputs/verification.json` を読む
2. 記録が全条件を満たしていれば feat-001 を `done` にし、証拠の場所を書く。満たしていなければ `done` にしない
3. feat-002（引用付き回答）はこの練習の範囲外。始めない

## Blockers / Risks

- [ ] 未実行: 書いたコードは構文も動作もまだ確かめていない。最初の実行で失敗する可能性がある
- [ ] 改行コード: 入力が CRLF で取り出された場合も読めるようにしたが、実ファイルでの確認は未実行
- [ ] 実行環境: `./init.sh` は bash で動く。Windows では Git Bash が要る。`node` が PATH にあることが前提
- [ ] 一時フォルダ: `verify.mjs` は OS の一時フォルダに `studio-yebisu-notes-verify-` で始まるフォルダを作り、最後に場所を確かめてから消す。削除に失敗した場合は `failures` に記録して失敗扱いにする

## Decisions Made

- **出力は上書きしない**: `--out` が既にあれば止まる。書き込みは `wx` で新しく作ったファイルだけに行い、途中で失敗したら自分で作ったそのファイルだけを消す
  - Context: 既にある記録を壊さないため。Harness Creator の「上書きは明示の承認がいる」に合わせた
  - Alternatives considered: 一時ファイルからの rename（Windows で既存ファイルを置き換えうるため採らなかった）
- **source は相対パス**: `input/notes/<ファイル名>`。手元の絶対パスを記録に入れない
  - Context: 公開する索引に作業環境の情報を残さないため
- **検索は文字の一致だけ**: NFKC・小文字・前後の空白除去のあと、Unicode の空白で区切った語をすべて含むメモを入力の順に残す。点数・あいまい検索・LLM はない
  - Context: 8問の期待IDを、仕組みが説明できる形で確かめるため
- **意図的な失敗を分けて記録**: `negative_controls` の終了コード1は CLI が正しく断った確認で、作業の失敗ではない

## Files Modified This Session

- `src/notes.mjs` - 新規。build・search の CLI
- `scripts/verify.mjs` - 新規。子プロセスで CLI を実行する検証
- `docs/project.md` - 新規。CLI の入出力と確認の範囲
- `AGENTS.md`・`feature_list.json`・`progress.md`・`session-handoff.md` - 雛形からこのプロジェクト用に書き換え

変えていない: `input/`・`init.sh`・`package.json`

## Evidence of Completion

- [ ] Tests pass: `./init.sh` → 未実行（制作担当の実行待ち。記録先 `outputs/verification.json`）
- [ ] CLI build: `node src/notes.mjs build --input input/notes --out outputs/index.json` → 未実行
- [ ] CLI search: `node src/notes.mjs search --index outputs/index.json --query "読書会 土曜" --tag ""` → 未実行
- [ ] Type check: 対象外（型検査のない素の JavaScript。構文の確認は Node での実行に含まれる）

## Notes for Next Session

次のセッションはコードを直さず、実際の検証記録を読んで状態ファイルだけを更新する。`outputs/verification.json` が無い・読めない・条件を満たさない場合は feat-001 を `done` にしない。

---

## 再開セッション（状態の更新のみ）

**Last Updated:** 2026-10-17（再開セッション）
**Session ID:** resume
**Active Feature:** なし（feat-001 は `done`。feat-002 は `not-started`）

このセッションは新しく始めた再開で、使えたのはファイルの読み書き（Read・Write・Edit・Glob・Grep）だけ。シェル・Node は実行していない。下の実行結果は、親（制作担当）が実際に実行して保存したファイルを読んだもの。

### 読んだ保存ファイル

- 手順: `AGENTS.md` → `feature_list.json` → `progress.md` → `session-handoff.md` → `docs/project.md` → `outputs/verification.json`
- 親の実行記録: `../outputs/init.stdout.txt`、`../../runtime/execution-data.json`、`../../runtime/receipts.json`（実装セッションの納品記録）
- CLI の出力: `outputs/index.json`、`outputs/queries/Q03.json`、`outputs/queries/Q06.json`
- 元の条件: `input/queries.json`
- 実装セッションの状態ファイル3つの写し: `../outputs/sessions/implementation/`

### 確かめた検証の証拠

| 確認 | 保存ファイルの内容 | 判定 |
|---|---|---|
| `./init.sh` の終了コード | `execution-data.json` の `init_exit_code: 0` | 条件どおり |
| 検証の形式と状態 | `verification.json`：`format` `studio-yebisu-note-verification-v1`・`status` `passed`・`note_count` 8・`query_count` 8・`source_integrity` true | 条件どおり |
| 8問 | `verification.json` の Q01〜Q08 すべて `passed`。各 `expected_ids` は `input/queries.json` の期待IDと一致し、`actual_ids` も同じ | 条件どおり |
| 意図的な失敗 | `negative_controls` 11件（NC01〜NC11）すべて `passed`・`exit_code` 1・`success_artifact_created` false | 条件どおり |
| 標準出力の一致 | `init.stdout.txt` の JSON 部分と `verification.json`、`execution-data.json` の `verification` が同じ内容 | 一致 |
| CLI build | `outputs/index.json`：`studio-yebisu-note-index-v1`・8件・`source` は `input/notes/<ファイル名>`・`inputs_sha256` と各 `source_sha256` が一致 | 確認 |
| CLI search | `outputs/queries/Q03.json`：語は「読書会」「土曜」、`result_ids` は N02 のみ。`Q06.json`：`result_ids` は空（0件） | 期待どおり |
| 検証したコード | `execution-data.json` の `code_sha256`（`src/notes.mjs`・`scripts/verify.mjs`）が、`receipts.json` の実装セッション納品時の値と同じ | 一致 |

### このセッションで変えたもの

- `feature_list.json`：feat-001 を `in-progress` → `done`、`evidence` に上の記録の場所と件数を書いた。feat-002 は `not-started`・`evidence` 空のまま
- `progress.md`：この節と冒頭の案内1行を追加。実装セッションの記録は消していない
- `session-handoff.md`：feat-001 の完了と、次の候補・始め方・制約に書き換えた

変えていない: `src/`・`scripts/`・`input/`・`docs/`・`init.sh`・`package.json`・`outputs/`

### 残る不確かさ

- このセッションでは `./init.sh` を再実行していない。現在のファイルが親の実行時と同じかは、SHA-256 を計算する手段がなく確かめていない（記録上の一致は親の実行時点のもの）
- `build` と `search` の個別の終了コードは、保存ファイルに単独の記録がない。確認したのは、出力ファイルの中身と、`verify.mjs` が子プロセスで CLI を実行した結果
- 実行環境（Node の版、Git Bash）は、このセッションでは確かめていない
- この再開で試せたのは、保存ファイルから状態をつなぐことだけ。時間の計測、比較実験（P01/P02 の対照）、効果の評価、人による確認は行っていない
