# Humanizer作例：製品文3件の推敲メモ

> この文書の製品「Mado Notes」、日付、機能、料金の扱いはすべてこの作例のための架空の設定です。実在の製品・顧客・調査結果ではありません。

- 使ったスキル：Humanizer 3.1.0（blader/humanizer、コミット `225a6f39ac85f76ee48dbad772ea4abe4ed6c9d8`）の [SKILL.md](../vendor/humanizer/SKILL.md)。改変していません。
- 入力：[../inputs/jobs.json](../inputs/jobs.json)（文章3件と、残す条件17項目）
- 出力データ：[revisions.json](revisions.json)
- 制作：Claude Opus 5.5 がSKILL.mdを読み、その手順（印付け→初稿→点検→最終稿）で制作時に書いた結果です。人による校閲・承認は受けていません。点検は読み返しによるもので、音読はしていません。
- これはAI検出器ではありません。検出率、品質点数、意味が同じであることの保証は含みません。日本語は1件だけの適用例です。

## 使い方

1. **原文・読み手・残す条件**を用意する（読み手がすでに知っている背景は、具体的に書く）。
2. 固定版の **HumanizerのSKILL.mdをAIエージェントに読ませ**、[依頼文](../request.txt)に3つを貼って渡す。
3. **初稿／点検／最終稿**を受け取る。点検で残った定型表現が「なし」でもかまいません。
4. 残す条件ごとに、原文と最終稿の**事実を読み比べる**。このメモの「残した条件」の表と同じ形で、引用どうしを並べると確かめやすくなります。

---

## 1. 英語のお知らせ（release）

読み手：新機能を初めて読むTeamプランの利用者。条件や制限は省かない。

### 原文

```text
Here's the thing: exporting your notes is not just a button, it's a new chapter for your workflow.

Starting October 20, 2026, workspace owners can export a Markdown ZIP from Settings > Export on the Team plan. The download link expires after 24 hours. Exports include notes and attachments, but not comments. Existing sharing permissions do not change.

This is the real win.
```

### 印を付けた箇所（強いものから）

| 節 | パターン | 原文の引用 | 理由 |
|---|---|---|---|
| §1 | Not X but Y | "exporting your notes is not just a button, it's a new chapter for your workflow" | 「ただのボタン」と言った人はいない。否定側は後半を大きく見せるためだけにある。 |
| §2 | One-line closers | "This is the real win." | 前の段落を言い直すだけの締め。新しい事実がない。 |
| §4 | Staged run-up | "Here's the thing:" | 本題の前の前置き。 |
| §13 | Inflated significance | "a new chapter for your workflow" | 通常の機能を転機のように見せている。裏付けがない。 |

### 初稿

```text
Starting October 20, 2026, workspace owners can export a Markdown ZIP from Settings > Export on the Team plan. The download link expires after 24 hours. Exports include notes and attachments, but not comments. Existing sharing permissions do not change.
```

### 点検で残った定型表現

なし。§1の対比、§2の締め、§6の三つ組、§8のダッシュ、§19の太字を探し直しました。"but not comments" は含むものと除外の両方を伝える対比なので、§1には当たらないと判断しています。

### 最終稿（初稿と同じ）

```text
Starting October 20, 2026, workspace owners can export a Markdown ZIP from Settings > Export on the Team plan. The download link expires after 24 hours. Exports include notes and attachments, but not comments. Existing sharing permissions do not change.
```

### 変更点

1. "Here's the thing: exporting your notes is not just a button, it's a new chapter for your workflow." → 削除（§1・§4・§13）。中身は次の文と "Exports include notes" が伝えている。
2. "This is the real win." → 削除（§2）。最後の具体的な事実で終える。

### 残した条件

| ID | 条件 | 原文 | 最終稿 |
|---|---|---|---|
| release-1 | 開始日 | "Starting October 20, 2026" | "Starting October 20, 2026" |
| release-2 | 対象ロール | "workspace owners" | "workspace owners" |
| release-3 | 対象プラン | "on the Team plan" | "on the Team plan" |
| release-4 | 操作場所と形式 | "export a Markdown ZIP from Settings > Export" | "export a Markdown ZIP from Settings > Export" |
| release-5 | リンクの期限 | "expires after 24 hours" | "The download link expires after 24 hours." |
| release-6 | 含むものと除外 | "include notes and attachments, but not comments" | "Exports include notes and attachments, but not comments." |
| release-7 | 既存の共有権限 | "Existing sharing permissions do not change." | "Existing sharing permissions do not change." |

---

## 2. 英語のサポート返信（reply）

読み手：Teamプランのworkspace owner。Settings > ExportでのZIP出力と期限切れをすでに理解し、"The link expired while I was in a meeting. Can support reopen the same download?" と尋ねている。

### 原文

```text
Great question! To give you some context, Team workspace owners can export a Markdown ZIP from Settings > Export. As you mentioned, your download link has expired. I'm not saying that exporting is complicated, but the real question is what happens next.

Support cannot reopen an expired download link. A workspace owner can create a new export from Settings > Export. Creating another export has no additional charge. Large workspaces may take a few minutes to prepare.

I hope this helps!
```

### 印を付けた箇所（強いものから）

| 節 | パターン | 原文の引用 | 理由 |
|---|---|---|---|
| §3 | Sayings that sound deep | "the real question is what happens next" | 構えるだけで中身がない。 |
| §5 | Arguing with no one | "I'm not saying that exporting is complicated" | 誰も出していない反論に答えている。 |
| §22 | Chatbot residue | "Great question!" | チャットの決まり文句。 |
| §22 | Chatbot residue | "I hope this helps!" | チャットの締め。 |
| §26 | Re-explaining what the reader knows | "To give you some context, Team workspace owners can export a Markdown ZIP from Settings > Export. As you mentioned, your download link has expired." | 既知の背景を組み立て直し、答えが2段落目まで出ない。 |

### 初稿

```text
Support cannot reopen an expired download link. A workspace owner can create a new export from Settings > Export. Creating another export has no additional charge. Large workspaces may take a few minutes to prepare.
```

### 点検で残った定型表現

- §26（F節：読み手の取り違え）"A workspace owner can create a new export from Settings > Export." 相手がworkspace owner本人なのに、一般の読み手向けの三人称で次の操作を書いている。

### 最終稿

```text
Support cannot reopen an expired download link. As a workspace owner, you can create a new export from Settings > Export. Creating another export has no additional charge. Large workspaces may take a few minutes to prepare.
```

### 変更点

1. "Great question!" → 削除（§22）。
2. "To give you some context, Team workspace owners can export a Markdown ZIP from Settings > Export." → 削除（§26）。既知の背景。Settings > Exportは次の操作の文に残っている。
3. "As you mentioned, your download link has expired." → 削除（§26）。相手自身が書いたこと。
4. "I'm not saying that exporting is complicated, but the real question is what happens next." → 削除（§5・§3）。
5. "A workspace owner can create a new export from Settings > Export." → "As a workspace owner, you can create a new export from Settings > Export."（§26）。相手本人に向けた形にし、ownerという条件と場所は残した。
6. "I hope this helps!" → 削除（§22）。

### 読み手が知っている背景として省いた箇所

- "Team workspace owners can export a Markdown ZIP from Settings > Export." reader_contextに「Settings > ExportでのZIP出力と期限切れをすでに理解し」と明記されているため。
- "your download link has expired" 相手自身が "The link expired while I was in a meeting." と書いているため。

### 残した条件

| ID | 条件 | 原文 | 最終稿 |
|---|---|---|---|
| reply-1 | 再開できない | "Support cannot reopen an expired download link." | "Support cannot reopen an expired download link." |
| reply-2 | 新規出力と担当者・場所 | "A workspace owner can create a new export from Settings > Export." | "As a workspace owner, you can create a new export from Settings > Export." |
| reply-3 | 追加料金 | "Creating another export has no additional charge." | "Creating another export has no additional charge." |
| reply-4 | 時間の限定と不確実性 | "Large workspaces may take a few minutes to prepare." | "Large workspaces may take a few minutes to prepare." |

---

## 3. 日本語への適用例（japanese）

読み手：新機能を初めて読む利用者。誇張は削り、日時・対象・例外・否定を保つ。

### 原文

```text
本質的に、探す体験の未来が変わります。これは単なる検索の追加ではなく、知識との新しい対話です。

2026年10月22日から、Mado Notesの全プランで、Ctrl+K（MacはCommand+K）でノートを検索できます。検索の対象はノート本文だけです。添付ファイルとアーカイブ済みのノートは対象に含まれません。ベータ版は11月5日までで、検索履歴は保存しません。

それが、本当の価値です。
```

### 印を付けた箇所（強いものから）

| 節 | パターン | 原文の引用 | 理由 |
|---|---|---|---|
| §1 | Not X but Y | 「これは単なる検索の追加ではなく、知識との新しい対話です。」 | 誰も主張していない否定。後半も具体的な機能を述べていない。 |
| §2 | One-line closers | 「それが、本当の価値です。」 | 価値を宣言するだけの締め。 |
| §3 | Sayings that sound deep | 「本質的に」 | 普通の告知を隠れた真実のように見せる前置き。 |
| §13 | Inflated significance | 「探す体験の未来が変わります」 | 期限付きのベータ版を未来の変化として誇張している。 |

### 初稿

```text
2026年10月22日から、Mado Notesの全プランで、Ctrl+K（MacはCommand+K）でノートを検索できます。検索の対象はノート本文だけです。添付ファイルとアーカイブ済みのノートは対象に含まれません。ベータ版は11月5日までで、検索履歴は保存しません。
```

### 点検で残った定型表現

なし。「本文だけです。〜含まれません。」は対象と除外の両方を伝えるので§1には当たらないと判断しました。

### 最終稿（初稿と同じ）

```text
2026年10月22日から、Mado Notesの全プランで、Ctrl+K（MacはCommand+K）でノートを検索できます。検索の対象はノート本文だけです。添付ファイルとアーカイブ済みのノートは対象に含まれません。ベータ版は11月5日までで、検索履歴は保存しません。
```

### 変更点

1. 「本質的に、探す体験の未来が変わります。」→ 削除（§3・§13）。
2. 「これは単なる検索の追加ではなく、知識との新しい対話です。」→ 削除（§1）。
3. 「それが、本当の価値です。」→ 削除（§2）。最後の具体的な事実で終える。

「ベータ版は11月5日までで、検索履歴は保存しません。」は2文に分けると、履歴を保存しないのがベータ期間中だけかどうかの読み方が変わりうるため、原文の形のまま残しました。

### 残した条件

| ID | 条件 | 原文 | 最終稿 |
|---|---|---|---|
| japanese-1 | 開始日 | 「2026年10月22日から」 | 「2026年10月22日から」 |
| japanese-2 | 対象プラン | 「Mado Notesの全プラン」 | 「Mado Notesの全プラン」 |
| japanese-3 | ショートカット | 「Ctrl+K（MacはCommand+K）」 | 「Ctrl+K（MacはCommand+K）」 |
| japanese-4 | 対象と除外 | 「検索の対象はノート本文だけです。添付ファイルとアーカイブ済みのノートは対象に含まれません。」 | 同じ2文 |
| japanese-5 | ベータ期間 | 「ベータ版は11月5日まで」 | 「ベータ版は11月5日まで」 |
| japanese-6 | 履歴の扱い | 「検索履歴は保存しません。」 | 「検索履歴は保存しません。」 |

---

## この結果から言えないこと

- 3件とも、あらかじめ用意した架空の短文です。長い文書や、実在の製品の文章で同じ結果になるとは限りません。
- 「残した条件」の表は、原文と最終稿の文字列の対応を示すものです。意味が完全に同じであることを保証するものではありません。
- AI検出器に通したり、読み手に試してもらったりはしていません。
- 日本語は1件だけの適用例です。Humanizerの説明と例は主に英語で書かれています。

## ライセンス

- この作例の文章・データ・コード：MIT License、Copyright (c) 2026 Studio Yebisu（[../LICENSE](../LICENSE)）
- Humanizer：MIT License、Copyright (c) 2025 Siqi Chen（[../vendor/humanizer/LICENSE](../vendor/humanizer/LICENSE)）。パターンの出典はHumanizerのSKILL.mdが示すWikipediaの "Signs of AI writing" です。この作例はWikipediaの本文を転載していません。
