# Session Handoff

## Current Objective

- Goal: feat-001「メモの索引と検索」を、実際の検証記録に基づいて閉じるかどうか決める
- Current status: 実装セッションでコードと検証スクリプトを書いた。CLI・検証は未実行（このセッションはシェルを使えない）
- Branch / commit: この練習では Git の履歴に頼らず、状態はこのファイル群に残す

## Completed This Session

- [x] `src/notes.mjs`（build・search）を書いた
- [x] `scripts/verify.mjs`（8問の照合と意図的な失敗11件）を書いた
- [x] 状態ファイルと `docs/project.md` を書いた
- [ ] 実行して確かめること（制作担当に任せた。まだ行われていない）

## Verification Evidence

| Check | Command | Result | Notes |
|---|---|---|---|
| 標準の検証 | `./init.sh` | 未実行 | 中身は `node scripts/verify.mjs`。記録先 `outputs/verification.json` |
| 索引を作る | `node src/notes.mjs build --input input/notes --out outputs/index.json` | 未実行 | 既に `outputs/index.json` があれば止まる（上書きしない） |
| 検索 | `node src/notes.mjs search --index outputs/index.json --query "読書会 土曜" --tag ""` | 未実行 | 期待は N02 だけ |

## Files Changed

- `src/notes.mjs`・`scripts/verify.mjs`・`docs/project.md`（新規）
- `AGENTS.md`・`feature_list.json`・`progress.md`・`session-handoff.md`（雛形から書き換え）

## Decisions Made

- 出力は上書きせず、source は `input/notes/<ファイル名>` の相対パスにする
- 検索は NFKC・小文字・空白区切りの全語AND とタグの完全一致だけ。点数や LLM はない
- feat-002（引用付き回答）は今回の範囲外として `not-started` のまま残す

## Blockers / Risks

- コードは一度も実行していない。最初の検証で失敗する可能性がある
- `./init.sh` は bash が要る（Windows は Git Bash）

## Next Session Startup

1. `AGENTS.md` を読む
2. `feature_list.json`・`progress.md`・このファイルを読む
3. `outputs/verification.json` を読む（制作担当が `./init.sh` の実際の出力から作る）
4. シェルが使えるなら `./init.sh` を実行して同じ結果になるか確かめる。使えないなら、実行したとは書かない

## Recommended Next Step

- `outputs/verification.json` が次をすべて満たすときだけ、feat-001 を `done` にし、`evidence` に記録の場所と件数（8件・8問・意図的な失敗の件数）を書く：`format` が `studio-yebisu-note-verification-v1`、`status` が `passed`、`note_count` 8、`query_count` 8、`source_integrity` が `true`、全 `queries` と全 `negative_controls` が `passed`
- 1つでも満たさない・ファイルが無い場合は `done` にしない。満たさなかった項目を `progress.md` に書いて止まる
- 再開セッションの作業は状態の更新だけ。コードを直さない。feat-002 を始めない
