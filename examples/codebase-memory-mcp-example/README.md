# Codebase Memory MCP 作例：入口から、保存先へ。

Codebase Memory MCP は、コードの関数と呼び出し関係を索引（知識グラフ）にして検索するツールです。この作例では、架空のワークショップ注文を受け付ける小さな Python リポジトリ（`fixture/`）を、公式 v0.12.0 の実行ファイルの CLI モードで索引し、次の3つを行います。

1. **探す**：`search_graph` で `submit_order` の定義を探し、返ったパス・行を実ソースと照合して、`get_code_snippet` の本文を読む
2. **たどる**：`query_graph` と `trace_path` で、`submit_order` から `validate_order`・`calculate_total`・`save_receipt` への呼び出しを確かめる
3. **変える**：実行用コピーの `storage.py` を差し替えて `audit_receipt` を加え、再索引前の結果を保存してから手で `index_repository` をやり直し、`save_receipt → audit_receipt` が現れるかを確かめる

これを行うのは `workflow.py` です。`index.html` は、その保存済みの結果を読むだけのビューアです。ブラウザではツールも Python も AI も動きません。

## 見方

1. 下の「実行し直す」の最後の手順で `python -m http.server 8000` を起動し、`http://127.0.0.1:8000/` を開きます。
2. 冒頭に、保存結果から読んだ要点（定義の場所、呼び出し先、再索引後の新しい呼び出し、`--version` の出力）が出ます。
3. 「3つの操作を切り替える」のタブで、探す・たどる・変えるを選びます。`index.html#find`・`#trace`・`#update` で直接開けます。
4. 各タブでは、ツールに渡した引数、返った値、実ソースの行を並べています。青い「索引」の印はツールの応答、黒い「実行」の印は架空の注文を実際に動かして書かれた JSON です。
5. 「ツールへの要求と実際の応答」を開くと、CLI に渡した引数と返った JSON をそのまま読めます。

## 3つの操作の根拠

| 操作 | 使うツール | 照合する実ソース |
| --- | --- | --- |
| 探す | `search_graph`（`name_pattern` `^submit_order$`、`label` Function）→ `get_code_snippet` | `fixture/service.py` の `def submit_order` の行と、本文の呼び出し式 |
| たどる | `query_graph`（`MATCH (f:Function)-[:CALLS]->(g) RETURN f.name AS caller, g.name AS callee LIMIT 100`）→ `trace_path`（outbound・深さ4） | `service.py` の `validate_order(order)`・`calculate_total(...)`・`save_receipt(receipt, out_dir)` |
| 変える | `index_status`・`query_graph`（再索引の前）→ `index_repository`（手で再索引）→ `get_graph_schema`・`index_status`・`query_graph`・`trace_path`・`search_graph`・`get_code_snippet` | 差し替え後の `storage.py` の `audit_receipt(receipt, folder)` と `def audit_receipt` |

最初に `index_repository`（`mode` full、`name` yebisu-workshop-proof）→ `list_projects`（実際に返った名前を使う）→ `get_graph_schema` → `index_status` を行ってから、3つの操作に進みます。

`workflow.py` は応答を作ったり補ったりしません。応答の形は版によって変わりうるため、返った JSON を再帰的に調べて名前・パス・行・caller と callee の組を読み取ります。読み取れない、ツールが失敗した、実ソースと合わない、のどれかなら、出力を書かずに終了コード1で止まります。

## 保存される領収

索引とは別に、架空の注文（`fixture/sample_order.json`：`WS-0001`、2席×1,200円）を実際に実行します。

- 変更前のコピー：`app.py` が `receipt-WS-0001.json`（`total_jpy` 2400）を書く
- 変更後のコピー：同じ領収に加えて、`audit_receipt` が `audit-WS-0001.json`（再計算した合計と保存した合計、`consistent`）を書く

書き込み先は `workflow.py` が `--work` の中に作ったディレクトリだけです。ネットワーク・決済・予約・通知・乱数のID・時刻・個人のデータは使いません。

## ファイルを持ち帰る

- `outputs/runs.json`：要求・応答・照合した行・再索引の前後の組・ソースの写し・領収 JSON
- `outputs/result.md`：実行結果から書き出した日本語のまとめ
- `samples.json`：3つの操作の要求（input）と応答（output）
- `workflow.py`：この結果を作る実行用ソース（Python 3.10 以上・標準ライブラリだけ）
- `fixture/`：架空のリポジトリ（`app.py`・`service.py`・`validation.py`・`pricing.py`・`storage.py`・`sample_order.json`）と変更用の `storage_revised.py`
- `request.txt`：同じ確かめ方を依頼するための日本語の依頼文

公開する JSON では、実行用コピーのパスを `fixture/`、キャッシュを `<private-cache>` に置き換えています。それ以外のマシン上のパスが残っていれば、`workflow.py` は書き出さずに止まります。標準出力・標準エラーの全文は `--work/private/logs/` に残り、公開しません。

## 実行し直す

実行ファイル・モデル・索引キャッシュはこの作例に含めていません。公式リリースを自分で取得し、確かめてから使います。`install`・インストールスクリプト・フック・`config set`・`daemon stop` は使いません。

### 1. 公式リリースを取得して確かめる（Windows・PowerShell）

作例フォルダの外に新しいフォルダを作り、そこで行います。

```powershell
New-Item -ItemType Directory $env:TEMP\cbm-v0.12.0
Set-Location $env:TEMP\cbm-v0.12.0
Invoke-WebRequest https://github.com/DeusData/codebase-memory-mcp/releases/download/v0.12.0/codebase-memory-mcp-windows-amd64.zip -OutFile codebase-memory-mcp-windows-amd64.zip
Invoke-WebRequest https://github.com/DeusData/codebase-memory-mcp/releases/download/v0.12.0/checksums.txt -OutFile checksums.txt
(Get-FileHash .\codebase-memory-mcp-windows-amd64.zip -Algorithm SHA256).Hash.ToLower()
Select-String codebase-memory-mcp-windows-amd64.zip .\checksums.txt
```

2つの SHA-256 が同じであることを確かめます。GitHub CLI がすでにあれば、原典の SECURITY.md の Verification にあるとおりビルド証明も確かめられます。

```powershell
gh attestation verify .\codebase-memory-mcp-windows-amd64.zip --repo DeusData/codebase-memory-mcp --signer-workflow DeusData/codebase-memory-mcp/.github/workflows/_build.yml
```

確かめてから展開します。zip に入っている `install.ps1` は実行しません。

```powershell
Expand-Archive .\codebase-memory-mcp-windows-amd64.zip -DestinationPath .
```

ファイル名や構成はリリースページ（https://github.com/DeusData/codebase-memory-mcp/releases/tag/v0.12.0 ）で確かめてください。この作例では公式Windows amd64版0.12.0のチェックサムと公式_build.ymlのビルド証明、固定ソースコミットの一致を確認して実行しました。

### 2. ほかの CBM が動いていないことを確かめる

Codebase Memory MCP は、同じアカウントで動く全てのプロセスに、同じ版・同じキャッシュの場所を求めます。エディタの MCP セッションなど、ほかの CBM が動いている間は、別のキャッシュ（`--cache`）を使うこのスクリプトは拒否されます。そのときは自分で作業を終えてから実行してください。このスクリプトは、ほかのセッションやデーモンを止めません。

### 3. workflow.py を実行する

展開したフォルダから、相対パスで実行ファイルを渡します。`--work` は新しい空のディレクトリ、`--cache` はこの作例専用の場所にし、どちらも作例フォルダの外に置きます。

```powershell
$cbmProof = Join-Path $env:USERPROFILE (".cbm-proof-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path (Join-Path $cbmProof "rendezvous") -Force | Out-Null
$env:CBM_RUNTIME_DIR = Join-Path $cbmProof "rendezvous"
python <作例フォルダ>\workflow.py --binary .\codebase-memory-mcp.exe --work (Join-Path $cbmProof "work") --cache (Join-Path $cbmProof "cache")
```

- 子プロセスには `CBM_CACHE_DIR`（`--cache`）・`CBM_ALLOWED_ROOT`（実行用コピー）・`CBM_WORKERS=2`・`CBM_MEM_BUDGET_MB=512` を渡します。シェルや全体の設定は変えません。
- ツールは `codebase-memory-mcp cli --quiet --json <tool>` で1回ずつ呼びます。引数JSONに `format: json` を含めて標準入力で渡します（index_repositoryにはformatを付けません）。引数のないlist_projectsだけは `--format json` を使います。`--args-via file` はargs-fileへ切り替える実装です。この掲載の実行は既定のstdin方式です。
- CLI のコマンドは、必要なら一時的なデーモンを自分で起動し、終わると片づけます。タイムアウトしたときに止めるのは、このスクリプトが起動した子プロセスだけです。
- 成功すると `outputs/runs.json`・`outputs/result.md`・`samples.json` を書き、短い要約を標準出力に出します。

Windowsではキャッシュとランデブーの祖先フォルダーにも第三者の変更権限がないことを原典が検査します。この実機では共有権限を継承したドライブのキャッシュが拒否されたため、ユーザープロファイル内の専用フォルダーを使いました。既存フォルダーのアクセス権を緩めたり、他のCBMを停止したりしていません。上の環境変数は現在のPowerShellだけに適用されます。作業後はシェルを閉じるか設定前の値に戻してください。原典のdocs/CONFIGURATION.mdも参照できます。

原典READMEの写しには以前のリリースへの記述も残っています。実行版の根拠はこの作例の公式v0.12.0配布物・ビルド証明・実際の --version です。

### 4. ビューアを開く

作例フォルダで次を実行し、`http://127.0.0.1:8000/` を開きます。`file://` で直接開くと JSON を読み込めません。

```
python -m http.server 8000
```

## この作例の範囲

- **CLI で呼んだ**：ツールは公式のネイティブ CLI から1回ずつ呼びました。MCP クライアントからの接続、MCP プロトコル経由の動作は確かめていません。
- **静的な呼び出し関係**：索引の辺は、ソースから読み取った「呼びうる」関係です。実行時に記録したトレースではありません。`getattr`・辞書に入れた関数・プラグインのような動的な呼び出しは出ないことがあり、辺がないことは呼ばれないことの証明ではありません。
- **手で再索引する**：`cli index_repository` で作った索引は監視されません。ファイルを変えたら、`index_repository` をやり直す必要があります。この作例はその前後を保存して比べます。
- **試していないこと**：CBM Lens、ブラウザAI（ローカルモデル）、意味検索、大きなリポジトリ、速さ・トークン量・回答品質。原典 README の数値は作者の測定で、この作例では測っていません。
- **架空の入力**：注文・金額・ワークショップ名は作例用ですが、実際のファイルとして実行しています。
- **実行の確認**：公式Windows版の実CLI18呼び出し、索引の変更前・変更後、ソースの行、実領収JSONと照合JSONを確認しました。画面と動画の確認範囲は後述の公開時の記録を参照してください。

## ライセンス

- 作例のコード・文章・架空データ：MIT License（Copyright (c) 2026 Studio Yebisu）。`LICENSE` を参照。
- Codebase Memory MCP：MIT License（Copyright (c) 2025 DeusData）。原典の LICENSE：https://github.com/DeusData/codebase-memory-mcp/blob/ec6427c38176efcd37b28682e82f2491afda94be/LICENSE
- リリースの実行ファイルに含まれる第三者コンポーネント（tree-sitter、SQLite、nomic-embed-code 由来のデータなど）は、それぞれのライセンスに従います。一覧は `vendor/codebase-memory-mcp/THIRD_PARTY.md`（原典の写し）にあります。帰属表示は消さずに残してください。

原典：https://github.com/DeusData/codebase-memory-mcp/tree/ec6427c38176efcd37b28682e82f2491afda94be （v0.12.0 のソース固定コミット）

制作ブリーフは公開している brief-to-demo の手順（サイトのリポジトリでは `../../skills/brief-to-demo/SKILL.md`）で、目的・実入力・成果物・完了条件を決めてから作りました。

## 公開時の確認記録

公式Windows amd64版0.12.0の配布ZIP・実行ファイルのSHA-256、公式_build.ymlのGitHubビルド証明と固定コミットec6427c38176efcd37b28682e82f2491afda94beの一致を確認しました。実CLI18呼び出しの応答を保存データと照合し、独立したPython ASTの読み取りで内部呼び出し4本→5本、service.pyの定義8行目を照合。query_graphの返却行数は6→変更後かつ再索引前6→手動再索引後7で、save_receipt→audit_receiptは最後だけにあります。実プログラムが保存した領収は前後とも2400円、追加した監査JSONはconsistent:trueです。元のfixtureファイルは受領時のハッシュと同じです。

320/375/390/430px、横向き844px、1280pxで3つの結果の切替、初期hash、キー操作、44px以上の主操作、503時の表示と再読み込みをIAB Chromiumで確認。画面の14ツール応答が保存JSONと一致しました。コピーはUI成功表示まで確認できましたが、クリップボードAPIでの読み戻しは一致せず、実際のコピー内容は未確認です。物理iPhone/Safari/VoiceOverは未確認です。

動画は28秒・1280×720・30fps・840フレーム・無音。実出力と実画面を使う編集動画で、連続操作の録画ではありません。代表・連続フレーム、同時刻描画一致、全デコード、実MP4の終端を制作担当が確認しました。人による審美的承認ではありません。現在の確認はverification.json、storyboard.jsonは制作時の設計です。

ソースZIPはexamples/codebase-memory-mcp-example/、media/、公開済みbrief-to-demoの本文とMIT表記を含みます。展開先ルートでHTTP配信し、/examples/codebase-memory-mcp-example/を開けます。実行ファイル、モデル、索引キャッシュ、認証、モデル履歴は含みません。動画の再出力は展開先ルートから次を実行します（Node.js20以上・Python・Chrome・FFmpeg/ffprobeが必要）。

```text
npm ci --ignore-scripts --no-audit --no-fund --prefix examples/codebase-memory-mcp-example/tools/motion-reel
python examples/codebase-memory-mcp-example/render.py --out renders/codebase-memory-first
```
