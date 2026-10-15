# Agent Reach 調査メモ：紹介投稿・固定原典・今回実際に読めた範囲

- 作成日：2026-10-16（実行は 2026-10-15 22:06 UTC）
- 作成：Studio Yebisu
- 機械可読の比較：[comparison.json](comparison.json)／実行記録：[collection.json](collection.json)

## 入力

| 種類 | URL |
|---|---|
| 公開リポジトリ（固定版） | [Panniantong/Agent-Reach @ 94f06c1](https://github.com/Panniantong/Agent-Reach/tree/94f06c1969dfc1834001269d79d3ad0972d9dee6) |
| 紹介投稿（第三者） | [x.com/BentoBoiNFT/status/2110111219172712922](https://x.com/BentoBoiNFT/status/2110111219172712922) |

## 固定版と実行環境

- 固定コミット：`94f06c1969dfc1834001269d79d3ad0972d9dee6`
- ライセンス：MIT License、Copyright (c) 2025 Agent Eyes（[LICENSE](../vendor/agent-reach/LICENSE)）
- 実行環境：既存の Python 3.13.7、gh 2.96.0、twitter-cli 0.8.5。doctor と `twitter_cli_child_env` は上記コミットの原典を使用

## 紹介投稿が言っていること（要約）

Hermes Agent 向けに 10 件の道具を並べた投稿で、その 1 件目として Agent Reach を「YouTube・X・Reddit・GitHub・Web の調査に使うもの」と紹介している。このメモでは第三者による用途の説明として扱い、機能や条件の根拠には使わない。本文は転載していない。

## 原典で確認したこと

1. **読み取りの本体ではなく、経路の案内役。** README の設計方針では、Agent Reach は接続方法の選定・インストール・状態確認・経路の案内を受け持ち、読み取りは gh や twitter-cli などの上流ツールが直接行う。（[README L197-L201](https://github.com/Panniantong/Agent-Reach/blob/94f06c1969dfc1834001269d79d3ad0972d9dee6/README.md#L197-L201)、[SKILL.md 経路表 L46-L56](https://github.com/Panniantong/Agent-Reach/blob/94f06c1969dfc1834001269d79d3ad0972d9dee6/agent_reach/skill/SKILL.md#L46-L56)）
2. **X は README の表だけで「設定不要」と判断しない。** 対応表では X の単一投稿が「入れればすぐ使える」列にあるが、同じ README の注記・SKILL.md・social.md は、`twitter` 実行前に `TWITTER_AUTH_TOKEN` と `TWITTER_CT0` を子プロセスへ明示的に渡すことを求めている。（[README L113](https://github.com/Panniantong/Agent-Reach/blob/94f06c1969dfc1834001269d79d3ad0972d9dee6/README.md#L113)、[README L127-L129](https://github.com/Panniantong/Agent-Reach/blob/94f06c1969dfc1834001269d79d3ad0972d9dee6/README.md#L127-L129)、[social.md L81-L91](https://github.com/Panniantong/Agent-Reach/blob/94f06c1969dfc1834001269d79d3ad0972d9dee6/agent_reach/skill/references/social.md#L81-L91)、[twitter.py L12-L31](https://github.com/Panniantong/Agent-Reach/blob/94f06c1969dfc1834001269d79d3ad0972d9dee6/agent_reach/channels/twitter.py#L12-L31)）
3. **XのCookieは手作業で書き出したものに限る。** ブラウザーからの自動読み取りに頼らない。Cookie はログイン権限そのものなので、README は専用アカウントを勧めている。（[README L261-L267](https://github.com/Panniantong/Agent-Reach/blob/94f06c1969dfc1834001269d79d3ad0972d9dee6/README.md#L261-L267)）
4. **doctor の warn と `active_backend: null` は「未検証」の意味。** バックエンドが無いという意味ではない。（[SKILL.md L32-L36](https://github.com/Panniantong/Agent-Reach/blob/94f06c1969dfc1834001269d79d3ad0972d9dee6/agent_reach/skill/SKILL.md#L32-L36)、[github.py L137-L141](https://github.com/Panniantong/Agent-Reach/blob/94f06c1969dfc1834001269d79d3ad0972d9dee6/agent_reach/channels/github.py#L137-L141)、[twitter.py L67-L71](https://github.com/Panniantong/Agent-Reach/blob/94f06c1969dfc1834001269d79d3ad0972d9dee6/agent_reach/channels/twitter.py#L67-L71)）
5. **MIT の範囲は Agent Reach まで。** 接続先サービスの規約、別の CLI のライセンス、第三者の投稿の権利には及ばない。

## 実際の結果：doctor の判定と、その後の実取得

| 対象 | doctor（最初に実行） | 実際の読み取り（その後に別途） |
|---|---|---|
| GitHub | `warn`／`active_backend: null` | gh api を 8 回（リポジトリ・コミット情報と原典 6 ファイル）、すべて終了コード 0。6 ファイルの本文は Git 上の同じファイルと SHA-256 一致 |
| X | `warn`／`active_backend: null` | 公開投稿 1 件。終了コード 0、`ok: true`、ID 一致、本文あり。ClientTransaction 初期化の警告あり |

- doctor の warn は後の成功で書き換えていない。warn は「読めない」でも「読める保証」でもない。
- 警告は受け取ったが、終了コード・`ok: true`・ID 一致・非空の本文の 4 点でこの 1 回の成功と判断した。警告がいつでも無害だとは判断していない。
- 各実行の終了コードと出力の SHA-256 は [collection.json](collection.json) にある。記録の時刻は速度の測定ではない。

## 最小の実行手順（2段階）

```bash
# 1. 接続確認（判定はそのまま記録する）
agent-reach doctor --json

# 2. 実際に読む（読み取り専用）
gh api "repos/Panniantong/Agent-Reach/contents/README.md?ref=94f06c1969dfc1834001269d79d3ad0972d9dee6"

# X：既存の設定から TWITTER_AUTH_TOKEN と TWITTER_CT0 を
#     この子プロセスにだけ渡す（値はここにもログにも書かない）
twitter tweet 2110111219172712922 -n 1 --json
```

- 今回は原典の `twitter_cli_child_env` で子プロセス用の環境を組み、ブラウザー Cookie の自動読み取りだけを呼び出し側で無効にして、本物の twitter-cli を起動した。認証の検証処理と出力は変えていない。
- 認証がない・期限切れのときは、そのプラットフォームで止める。新しいログインやサービス設定はしない。
- 成功の判定：終了コード 0、返ってきた ID が対象と一致、本文が空でない。

## まだ確かめていないこと

- YouTube・Reddit・Web の実際の読み取り（Reddit は原典でもログイン必須とされている。[social.md L219-L221](https://github.com/Panniantong/Agent-Reach/blob/94f06c1969dfc1834001269d79d3ad0972d9dee6/agent_reach/skill/references/social.md#L219-L221)）
- Hermes Agent の中での実行
- 全プラットフォームの無料利用・認証不要
- 取得の速さ、常に使えること
- 投稿の返信・引用投稿・動画・リンク先の記事
- gh の未ログイン時の挙動、Issue・PR・コード検索
- 初回インストール、自動設定、複数プラットフォーム横断の検索

## 出典とライセンス

- 原典：[Panniantong/Agent-Reach @ 94f06c1](https://github.com/Panniantong/Agent-Reach/tree/94f06c1969dfc1834001269d79d3ad0972d9dee6)、MIT License、Copyright (c) 2025 Agent Eyes。同梱版：[../vendor/agent-reach/](../vendor/agent-reach/README.md)
- このメモ・比較データ・ビューア：MIT License、Copyright (c) 2026 Studio Yebisu（[LICENSE](../LICENSE)）
- 紹介投稿：第三者の著作物。本文・引用・返信・動画・画像・数値は同梱していない。
- X・GitHub・各 CLI の利用条件は、それぞれの提供元に従う。
