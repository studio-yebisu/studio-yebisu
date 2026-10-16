# 書店メモの索引と検索

架空の書店で使う作業メモ8件を、1つの JSON 索引にまとめ、語とタグで探す練習用の CLI です。書店名・運用はすべて架空です。必要なのは Node.js 20 以上だけで、`npm install`・外部API・キー・通信は使いません。

## ファイル

| パス | 役割 |
| --- | --- |
| `input/notes/N01.md`〜`N08.md` | 固定の入力。変えない |
| `input/queries.json` | 固定の8問と期待ID。実装の前に決めたもので、変えない |
| `src/notes.mjs` | CLI（`build`・`search`） |
| `scripts/verify.mjs` | CLI を子プロセスで実行して確かめる検証 |
| `init.sh` | Harness Creator の `create-harness.mjs` が生成した標準の検証。中身は `node scripts/verify.mjs` |
| `outputs/index.json` | `build` で作る索引（制作担当が実行して作る） |
| `outputs/verification.json` | `verify.mjs` の標準出力の記録（制作担当が実行して作る） |

## メモの書き方

1行目は `id`・`title`・`tags` だけを持つ JSON、2行目は空行、3行目からが本文です。

```text
{"id": "N02", "title": "土曜の読書会", "tags": ["イベント", "読書会"]}

土曜の読書会は奥の丸机を使う。参加メモと筆記具を用意し、終了後に机を戻す。
```

- `id` は `N` と2桁の数字（`/^N\d{2}$/`）。フォルダの中で重複しない
- `title` と本文は空にしない。本文は前後の空白を除いて記録する
- `tags` は空でない文字列の配列で、同じ値を2回書かない
- フォルダ直下の `.md` だけをファイル名の順に読む。サブフォルダは読まない

## build

```bash
node src/notes.mjs build --input input/notes --out outputs/index.json
```

出力（ファイルと標準出力に同じ JSON、2スペースの字下げと末尾の改行）：

```json
{
  "format": "studio-yebisu-note-index-v1",
  "notes": [
    { "id": "N01", "title": "…", "tags": ["…"], "body": "…", "source": "input/notes/N01.md", "source_sha256": "<64桁>" }
  ],
  "inputs_sha256": { "input/notes/N01.md": "<64桁>" }
}
```

- `source_sha256` は入力ファイルのバイト列そのものの SHA-256（`node:crypto`）
- `source` は手元の場所によらず `input/notes/<ファイル名>`。絶対パスは書かない
- `--out` が既にあれば止まり、上書きしない。新しいファイルは `wx`（無ければ作る、あれば失敗）で書く
- 入力が1件でも不正なら、何も書かずに止まる

## search

```bash
node src/notes.mjs search --index outputs/index.json --query "読書会 土曜" --tag ""
```

```json
{
  "format": "studio-yebisu-note-search-v1",
  "query": "読書会 土曜",
  "tag": "",
  "tokens": ["読書会", "土曜"],
  "result_ids": ["N02"],
  "results": [{ "id": "N02", "title": "土曜の読書会", "…": "索引のメモの全項目" }]
}
```

- 先に索引の形を確かめる：形式名、空でない `notes`、ID の形と重複、各項目の型、`source` の形、`inputs_sha256` と各メモの `source_sha256` の一致
- 語：`query` を NFKC で正規化して小文字にし、前後の空白を除き、Unicode の空白（全角空白を含む）で区切る。すべての語が「ID・題名・タグ・本文」のどこかに含まれるメモを残す（AND）
- タグ：`tag` とメモのタグを同じく NFKC・小文字・前後の空白除去でそろえ、完全に一致するものだけを残す。語の条件と AND
- `query` も `tag` も空なら8件すべて。並びは索引（入力）の順のまま
- 点数・あいまい検索・LLM・引用の生成はない。`query` と `tag` は入力のまま記録する

## 失敗のとき

理由を標準エラーへ `notes: …` の形で書き、終了コード1で止まります。成功の出力（索引ファイル・検索結果の標準出力）は作りません。断る例：壊れたメタデータ、ID の重複、空の題名・本文・タグ、`.md` のないフォルダ、フォルダでない `--input`、知らないコマンド・引数、値のない引数、必須の引数の欠落、既にある `--out`、形の違う索引。

## 検証（scripts/verify.mjs）

```bash
./init.sh                 # Windows は Git Bash から
node scripts/verify.mjs   # 同じもの
```

`verify.mjs` は `process.execPath` と `execFileSync` で CLI を子プロセスとして実行します（シェルを通しません）。OS の一時フォルダに `mkdtemp` で自分専用のフォルダを作り、最後にその場所を確かめてから消します。`input/` には書き込みません。

1. 入力8件を CLI とは別に読み、メタデータ・本文・SHA-256 の期待値を作る
2. `build` で一時フォルダへ索引を作り、標準出力とファイルの一致、全8件の全項目、`inputs_sha256` を照合する。別の場所へ写した入力でも同じ索引になるかも確かめる
3. `input/queries.json` の8問を `search` で実行し、結果のIDと全項目を期待と照合する

| ID | 条件 | 期待ID |
| --- | --- | --- |
| Q01 | 語なし・タグなし | N01〜N08 |
| Q02 | 「読書会」 | N02・N07 |
| Q03 | 「　読書会　土曜　」（全角空白） | N02 |
| Q04 | タグ「展示」 | N01・N04 |
| Q05 | 「しおり」＋タグ「備品」 | N03 |
| Q06 | 「存在しない星の棚」 | なし（0件が正しい） |
| Q07 | 「ＦＡＩＲ」（全角英字） | N01 |
| Q08 | 「棚」＋タグ「展示」 | N01・N04 |

4. 意図的な失敗（`negative_controls`）を11件実行する。入力はすべて一時フォルダに写した固定入力から作る。合格の条件は、終了コード1・標準出力が空・標準エラーに理由・成功の出力なし（NC05 は既にあるファイルの中身がそのまま）

| ID | 内容 |
| --- | --- |
| NC01 | 1行目のメタデータが閉じていないメモ（N05 の写しを壊す） |
| NC02 | 同じ id（N02）のメモが2つ |
| NC03 | 知らない引数 `--force` |
| NC04 | 必須の `--input` がない |
| NC05 | 出力先が既にある（中身を保つ） |
| NC06 | 途中で切れた索引 JSON |
| NC07 | `inputs_sha256` と `source_sha256` が合わない索引 |
| NC08 | 知らないコマンド `publish` |
| NC09 | `--input` がファイル |
| NC10 | `.md` が1件もないフォルダ |
| NC11 | `--index` の値がない |

5. 前後で `input/` の SHA-256 が変わっていないことを確かめる

標準出力は JSON 1つだけです（時刻・手元のパスは書きません）。

```json
{
  "format": "studio-yebisu-note-verification-v1",
  "status": "passed",
  "note_count": 8,
  "query_count": 8,
  "queries": [{ "id": "Q01", "query": "", "tag": "", "actual_ids": ["…"], "expected_ids": ["…"], "status": "passed" }],
  "negative_controls": [{ "id": "NC01", "label": "…", "exit_code": 1, "success_artifact_created": false, "status": "passed" }],
  "source_integrity": true
}
```

1つでも外れたら `status` は `failed`、外れた理由を `failures` に入れ、終了コード1で終わります。意図的な失敗の終了コード1は、CLI が正しく断ったことの確認で、作業の失敗ではありません。
