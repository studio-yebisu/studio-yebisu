# Session Progress Log

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
