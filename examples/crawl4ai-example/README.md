# Crawl4AI 作例：3ページを、読む形へ。

Crawl4AI の `AsyncWebCrawler` で、**指定した3ページだけ**を取得し、CSS セレクターで見出しと要点を取り出して JSON と Markdown に保存する作例です。

取得するのは、作例用に書いた架空の木工ワークショップ運営チームの手順書3ページ（`fixture/docs/`）です。`workflow.py` がそれを 127.0.0.1 の一時サーバーで配り、そのサーバーだけに `crawler.arun()` を呼びます。`index.html` は、その保存済みの実行結果を読むだけのビューアです。ブラウザでは Crawl4AI も AI も動きません。

This project uses Crawl4AI (https://github.com/unclecode/crawl4ai) for web data extraction.

## 見方

1. 下の「実行し直す」の最後の手順で `python -m http.server 8000` を起動し、`http://127.0.0.1:8000/` を開きます。冒頭に、保存済みの結果から数えた「HTTP 200 で受理したページ数・取り出した節の数・取得エラー」が出ます。
2. 「3ページと取得エラーを切り替える」で、準備・当日の確認・書き出しの3ページを選びます。`index.html#start`・`#review`・`#export` で各ページを直接開けます。
3. 各ページで、取り出した節（見出しと要点）と、`raw_markdown` を見比べます。「元のHTML」を開くと、取得に使ったソースそのものを読めます。「元のページを開く」で `fixture/docs/` のページ自体も開けます。
4. 「書き出し」では、最後の節が元の `export.html` に無く、`dynamic-export.js` が読み込み後に足した節であることを確かめられます。
5. 4つ目の「取得エラー」（`#missing`）で、存在しない `/docs/missing.html` への診断結果を見ます。ライブラリの `success` フラグと HTTP ステータスを分けて表示し、成功には数えていません。
6. 「workflow.py が照合したこと」で照合の一覧と、サーバーに届いたリクエストの記録を見ます。
7. 「ファイルを持ち帰る」から `outputs/runs.json`・`outputs/result.md`・`samples.json`・`workflow.py` を保存できます。各ページの Markdown も個別に保存できます。
8. 手元で作り直すときは「実行し直す」の手順で、実際の Crawl4AI の API を使って取得し直します。

## 入力（架空の手順書）

| パス | 中身 | 取得 |
| --- | --- | --- |
| `fixture/docs/start.html` | 準備を始める（2節） | する |
| `fixture/docs/review.html` | 当日の確認（2節） | する |
| `fixture/docs/export.html` | 記録の書き出し（HTMLに1節、`dynamic-export.js` が1節を追加） | する |
| `fixture/docs/dynamic-export.js` | 書き出しページの最後の節を約0.4秒後に追加し、`main#guide` の `data-ready` を `true` にする | ページの一部として読み込まれる |
| `fixture/robots.txt` | `/docs/` を許可、`/not-selected.html` を不許可 | `check_robots_txt=True` で参照 |
| `fixture/not-selected.html` | `UNSELECTED_SENTINEL` を含む、取得しない別ページ | しない |
| `fixture/style.css` | 3ページで共有する短いスタイル | ページの一部として読み込まれる |

各ページの `nav` には `NAV_ONLY_SENTINEL`、`footer` には `FOOTER_ONLY_SENTINEL` という目印と、`not-selected.html` や `example.invalid` へのリンクを置いています。出力にこれらの目印が出ないこと、リンク先へのアクセスが起きないことを確かめるためです。文章はすべて作例用に書いたもので、実在の文書の写しではありません。

## 取得の設定

3ページとも、同じ設定で1ページずつ `arun` します。

```python
BrowserConfig(headless=True, channel="chrome", chrome_channel="chrome",
              ignore_https_errors=False, verbose=False, use_persistent_context=False)

CrawlerRunConfig(
    cache_mode=CacheMode.BYPASS,
    check_robots_txt=True,
    css_selector="main#guide",
    excluded_tags=["nav", "footer"],
    word_count_threshold=0,
    wait_for='css:#guide[data-ready="true"]',
    page_timeout=20000,
    extraction_strategy=JsonCssExtractionStrategy(schema),
    markdown_generator=DefaultMarkdownGenerator(options={"ignore_links": True, "body_width": 0}),
    verbose=False,
)
```

`schema` は `name="Guide sections"`、`baseSelector="article.doc-section"`、`heading`（`h2` の text）と `keypoint`（`p.keypoint` の text）です。`generate_schema` や LLM は使っていません。固定版のソースでは、`css_selector` は Markdown の元になる本文を絞り、`JsonCssExtractionStrategy` は JavaScript 実行後のページ全体の HTML から `baseSelector` の節を探します。

診断用の `/docs/missing.html` には、`wait_for`・`css_selector`・`extraction_strategy` を付けずに `arun` します。HTTP ステータスをそのまま記録するためです。

`workflow.py` は、`success` が `True` かつ `status_code` が `200` のときだけ「受理」とします。Crawl4AI の `success` は HTTP の成否とは別に決まるため（固定版のソースでは、本文を受け取れたかや、ボット対策の判定で決まります）、404 でも `success` の値はそのまま記録し、受理しません。

## 実行し直す

Python 3.10 以上と、インストール済みの Google Chrome を使います。APIキー・アカウント・クラウドは使いません（パッケージの取得を除く）。この作例のフォルダ（`workflow.py` がある場所）で実行します。

```
python -m venv .venv-crawl4ai
```

仮想環境を有効にします。

- Windows（PowerShell）：`.venv-crawl4ai\Scripts\Activate.ps1`
- macOS・Linux：`source .venv-crawl4ai/bin/activate`

有効にしたシェルで続けます。

```
python -m pip install https://github.com/unclecode/crawl4ai/archive/6192d5e5b59cb21f9ca418fd6b798de47c0741d3.zip
python workflow.py --work ../crawl4ai-run-1 --channel chrome
```

- `--work` には、**この作例のフォルダの外にある、まだ無いか空のフォルダ**を指定します。中に `cache/`（Crawl4AI のキャッシュ・robots.txt の記録・ログ）、`raw/`（各 `arun` の `result.model_dump(mode="json")`・リクエストと設定・サーバーのアクセス記録）、`private/`（照合結果、失敗時の詳細）ができます。これらは手元の証跡で、公開用ではありません。
- すべての照合が通ったときだけ、`publish/outputs/runs.json`・`publish/outputs/result.md`・`publish/samples.json` を書きます。一つでも外れたら公開用の出力を書かずに終了コード1で止まります。標準出力には短い要約だけを出します。
- ビューアで見るには、`publish/outputs/` の2つをこのフォルダの `outputs/` へ、`publish/samples.json` をこのフォルダへ写してから、次を実行します。

```
python -m http.server 8000
```

ブラウザで `http://127.0.0.1:8000/` を開きます。`file://` で直接開くと JSON を読み込めません。

補足：

- インストール済みの Chrome を `channel="chrome"` で使うので、`crawl4ai-setup` やグローバルなブラウザープロファイルは要りません（`use_persistent_context=False`）。Chrome が無い場合は、ブラウザーの導入方法を別に選んでください。たとえば Playwright の Chromium を入れて `--channel chromium` で実行する方法がありますが、この組み合わせはこの作例では確かめていません。
- `workflow.py` は Crawl4AI を読み込む前に `CRAWL4_AI_BASE_DIRECTORY` を `--work` の `cache/` に向け、`CRAWL4AI_NO_CLOUD_NOTICE=1` でクラウド版の案内表示を止めます。ホームフォルダの `.crawl4ai` は使いません。
- 依存パッケージ（Playwright など）とブラウザーは同梱していません。実際に使った95依存パッケージの版は requirements-tested.txt に記録しました。固定ソースのURLも同梱しています。
- Windows の Python 3.13.7、既存Chrome、固定版Crawl4AI0.9.5で実行しました。インストールしたライブラリの86個のPython/JavaScriptファイルが固定原典と同じ内容であることも照合しました。
- 保存済みの URL は `http://127.0.0.1:<ポート>/docs/...` です。ポートは実行のたびに OS が割り当てる一時ポートで、今そのアドレスにサーバーはありません。
- 公開用の `error_message` に、作業フォルダ・作例フォルダ・Python の場所・ホームフォルダの絶対パスが含まれていたら、それぞれ `<WORK>`・`<EXAMPLE>`・`<PYTHON>`・`<HOME>` に置き換えます（大文字・小文字を区別せず、`/` と `\` の両方の書き方）。そのうえで、公開用の JSON 全体にこれらのパスが残っていないことを照合します。`raw/` の記録は置き換えません。完全なトレースバックは `private/` にだけ残します。

## workflow.py が照合すること

取得の前に、期待する6節の見出しと要点が `fixture/` のソースにそのまま書かれていること、書き出しページの最後の節が `export.html` に無く `dynamic-export.js` だけにあることを確かめます。取得の後は、実際の結果だけを使って次を照合します。`extracted_content` は Crawl4AI が返した文字列を `json.loads` するだけで、別の解析器で作り直しません。

- インストール済みの `crawl4ai.__version__` が 0.9.5 であること
- 3ページとも `success` が `True` かつ HTTP 200 であること
- 取り出した節が合計6つで、各ページの見出し・要点が元のソースと順番も含めて一致すること
- `raw_markdown` に6節すべての見出しと要点の文があること
- `NAV_ONLY_SENTINEL`・`FOOTER_ONLY_SENTINEL`・`UNSELECTED_SENTINEL` が、どの Markdown・`extracted_content` にも無いこと
- JavaScript が追加した節が取り出せていること
- `/docs/missing.html` が HTTP 404 で、受理していないこと（`success` の値は問わずに記録）
- サーバーに届いたのが許したパスだけで、`/not-selected.html` へのアクセスが0回、`robots.txt` が参照されたこと
- 公開用の出力に手元の絶対パスが無いこと

外部ホスト（`example.invalid`）への通信は、fixture のサーバーの記録には現れないため、この照合では確かめていません。これらは実装と実行結果の照合で、品質の評価ではありません。

## 自分のページに使うとき

- **スキーマはこの fixture に合わせたもの**：`main#guide`・`article.doc-section`・`h2`・`p.keypoint` は、この作例のために書いた HTML の構造です。ほかのサイトにはそのまま使えません。ページの DOM が変わったら、セレクターを見直してください。`css_selector` が何にも一致しないと、固定版のソースではページ全体が本文として扱われます。
- **JavaScript で中身が増えるページは、正しい印を待つ**：`wait_for` には、必要な内容がそろったことを確かに示す要素や属性を指定します。印が早すぎると、足りないまま取り出します。
- **success は HTTP 200 の意味ではない**：受理の条件は `success` と `status_code` の両方で決めてください。
- **取得先の許可・利用条件・robots.txt を守る**：実在のサイトに向けるときは、取得してよいか、利用条件、robots.txt、アクセスの頻度を自分で確かめてください。この作例は、それについての法的な判断や保証をしません。

## この作例の範囲

- **通信は手元の4件だけ**：許可した3ページと、診断用の存在しない1ページだけに `arun` しました。リンクの巡回（deep crawl）、外部サイトの取得、取得の深さは試していません。公開Webでの取得のしやすさや網羅性を示すものではありません。
- **クラウド・LLM・有料APIは使っていない**：Crawl4AI Cloud、LLM による抽出・要約、プロキシ、ステルス、ボット対策の回避は使っていません。実在の利用者のデータも扱っていません。
- **要点はAIの要約ではない**：元の段落を CSS セレクターでそのまま取り出したものです。
- **時刻と速さは記録していない**：公開用の出力に時刻・所要時間は含めていません。速さの比較はしていません。
- **閲覧ページは保存済みの結果を読むだけ**：ページから取得し直すことはできません。

## ファイル

- `workflow.py`：この作例の実装（ThreadingHTTPServer・AsyncWebCrawler・CrawlerRunConfig・JsonCssExtractionStrategy・DefaultMarkdownGenerator）
- `fixture/`：架空の手順書3ページ・`dynamic-export.js`・`style.css`・`robots.txt`・`not-selected.html`
- `outputs/runs.json`・`outputs/result.md`・`samples.json`：`workflow.py` が書き出す実行結果（実APIで取得した結果を同梱しています）
- `index.html`・`style.css`・`app.mjs`：保存済みの結果を読むビューア
- `request.txt`：同じ作りを依頼するための日本語の依頼文
- `brief.json`：brief-to-demo の形で書いた、この作例の制作ブリーフ

## ライセンスと帰属

- 作例のコード・文章・架空の手順書（`fixture/`）：MIT License（Copyright (c) 2026 Studio Yebisu）
- Crawl4AI：Apache License 2.0。原典の README と LICENSE が求める帰属表示を、ビューアのフッターとこの README に載せています。
  - This project uses Crawl4AI (https://github.com/unclecode/crawl4ai) for web data extraction.
  - This product includes software developed by UncleCode (https://x.com/unclecode) as part of the Crawl4AI project (https://github.com/unclecode/crawl4ai).
- Crawl4AI の依存パッケージとブラウザーは同梱していません。

原典（固定コミット）：

- https://github.com/unclecode/crawl4ai/tree/6192d5e5b59cb21f9ca418fd6b798de47c0741d3
- https://github.com/unclecode/crawl4ai/blob/6192d5e5b59cb21f9ca418fd6b798de47c0741d3/LICENSE
- https://github.com/unclecode/crawl4ai/blob/6192d5e5b59cb21f9ca418fd6b798de47c0741d3/docs/md_v2/core/markdown-generation.md
- https://github.com/unclecode/crawl4ai/blob/6192d5e5b59cb21f9ca418fd6b798de47c0741d3/docs/md_v2/extraction/no-llm-strategies.md

制作ブリーフは公開している brief-to-demo の手順（サイトのリポジトリでは `../../skills/brief-to-demo/SKILL.md`）で、目的・実入力・成果物・完了条件を決めてから作りました（`brief.json`）。

## 制作担当による確認範囲

4回の実arun（文書3件、存在しないURL1件）のmodel_dumpから、公開の23個の表示用ペイロードとサンプル4件まで照合しました。元の静的HTMLは2節・2節・1節で、JavaScriptの定数から追加節を別に読み取り、実ブラウザーが返したHTML、JSON抽出、Markdownの6節と照合。入力fixture7ファイルはOpus5.5受領時のままです。追加読み込みのある元ページもIABで開き、実際の2節を照合しました。

診断は実際にHTTP404・success:trueで返り、accepted:falseとして文書成功件数に含めていません。アクセス記録はrobots.txt、文書3ページ、CSS、JavaScript、faviconの404、診断404で計8件。選ばないページの要求は0件です。外部ホストへの通信をローカルサーバーの記録で保証してはいません。

320/375/390/430px、横向き844px、1280pxの4タブ計24状態で、ページのはみ出しなし、44px以上の主操作、16px入力を確認。キー操作、初期hash、503からの再読み込みも確認しました。コピーはブラウザーのAPI成功表示までで、読み戻しAPIは依頼文と一致しなかったため実際のクリップボード内容は未確認です。物理iPhone/Safari/VoiceOverは未確認です。自動検査と制作担当の確認は人による審美的な承認ではありません。

## 動画とソース一式

動画は28秒・1280×720・30fps・840フレーム・無音。実APIで得たJSON/Markdownと実画面から作る編集動画で、連続操作の録画ではありません。代表フレーム・コンタクトシート・連続フレーム、同時刻を別順と新ページで描いた一致、全MP4デコード、実際のMP4の終端を制作担当が確認しました。物理iOS、他の縦横比、人による審美的承認は未確認です。現在の確認はverification.json、storyboard.jsonは制作時の設計です。

ソースZIPは examples/crawl4ai-example/、media/、公開brief-to-demoの本文とMIT表記を含みます。ライブラリ・依存・ブラウザー・モデル・認証・キャッシュ・完全なモデル履歴は含みません。展開先ルートでHTTP配信し、/examples/crawl4ai-example/を開けます。動画の再出力にはNode20以上、Python、既存Chrome、FFmpeg/ffprobeが必要です。出力先はソースの外にある空フォルダにしてください。

```text
npm ci --ignore-scripts --no-audit --no-fund --prefix examples/crawl4ai-example/tools/motion-reel
python examples/crawl4ai-example/render.py --out renders/crawl4ai-first
```
