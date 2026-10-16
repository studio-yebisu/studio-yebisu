# 編集動画：コードを索引して、関数と呼び出しを探す（28秒・無音）

Codebase Memory MCP を初めて見る人に向けて、次の5つを順に見せる短い説明動画です。

1. **目的**：Codebase Memory MCP はコードの関数と呼び出し関係を索引して探すツール。この作例は公式 CLI の実行結果を保存して確かめる
2. **探す**：`search_graph` が返した `submit_order` の定義は `fixture/service.py` の8行目。実ソースの def 行も8行目で、`get_code_snippet` の本文12行も同じ
3. **たどる**：`query_graph` の CALLS の組で、`main` → `submit_order` → `validate_order`・`calculate_total`・`save_receipt`。ソースから読んだ静的な関係で、実行時の記録ではない
4. **変える**：`storage.py` を差し替えた直後の索引には `save_receipt → audit_receipt` がなく（組6件）、手で `index_repository` をやり直すと現れる（組7件）
5. **確かめる**：索引とは別に、架空の注文 `WS-0001` を実際に Python で実行した領収（2,400円）と照合（`consistent: true`）。最後に、確かめたこと・試していない範囲・版とソース固定コミット・実際のビューア画面

映像の値は、公式 Windows amd64 版 v0.12.0 のネイティブ CLI を `workflow.py` が呼んで保存した応答から取り出しています。この動画の画面で CLI・Python・AI が動くことはなく、端末の画面や進行表示も再現していません。

| 項目 | 値 |
|---|---|
| 尺・サイズ | 28.0秒、1280×720、30fps（840フレーム） |
| 音 | なし（`audioEvents: []`） |
| ポスター | 13.5秒（「たどる」：3つの呼び出し先が出そろった場面） |
| 最後の一枚 | 26.0–28.0秒に止めたまま終わる（ポスターにも使える構成） |
| 編集ソース | `index.html`（プレビュー）、`video.js`（描画）、`video.css`、`storyboard.json`（ブリーフ・場面・値の出どころ・素材・未確認の点） |

## 素材

連続した画面録画ではなく、保存済みの実行結果と実際の画面を素材に編集した動画です。使うのは次のローカルファイルだけで、外部のフォント・画像・ライブラリ・通信はありません。

| ファイル | 使い方 |
|---|---|
| [../outputs/runs.json](../outputs/runs.json) | 全ての文字・数値・関数名・ファイル名。ソースの行番号は、この中のソースの写しから数える |
| [../outputs/result.md](../outputs/result.md) | 映像には描かない。持ち帰るファイルとして名前を示すため、実在と一致だけを確かめる |
| [../fixture/](../fixture/) の `service.py`・`app.py`・`storage.py`・`storage_revised.py` | 映像には描かない。`runs.json` のソースの写しと同じ文字列であることを確かめる |
| [../assets/screen-find.png](../assets/screen-find.png) | 「探す」：索引の値と実ソースの照合（2か所を切り抜く） |
| [../assets/screen-update.png](../assets/screen-update.png) | 「変える」：「変更後・再索引の前」と「手で再索引した後」のカード |
| [../assets/screen-phone.png](../assets/screen-phone.png) | 最後の一枚：スマートフォン幅の最初の画面（「保存済みの結果 / ライブ検索なし」） |

- 読み込み時に `runs.json`・`result.md`・3枚の画像の SHA-256 と画像の寸法を公開時の記録と照合し、`runs.json` の中でも、行番号・前後の組・領収の合計などが互いに合うかを確かめます。一致しない・読めない・見つからないときは、エラーを Canvas と状態欄に表示して再生ボタンを無効にし、`window.motionReady` を拒否します。代わりの画面や値は出しません。
- スクリーンショットは Studio Yebisu が撮影した作例ビューアの実際の画面で、Codebase Memory MCP 本体や CBM Lens の画面ではありません。画像ファイルは改変せず、切り抜きは描画時にだけ行います。画面内の小さな文字に主な情報を任せず、同じ値を横に大きく組版しています。
- `assets/screen-trace.png` は使っていません。「たどる」は保存データから組版した図で示します。

## 編集する（例：ポスターの場面の見出しを変える）

1. `video.js` の `sceneTrace` にある `heading('呼び出し関係を、索引からたどる')` の文字を書き換えて保存します。見出しは52px（入りきらないときは44pxまで縮む）です。
2. 下の「プレビュー」の手順でページを開き直し、状態の欄に「準備完了」と出るのを待ちます。
3. ブラウザーの開発者ツールのコンソールで `window.seek(13.5)` を実行すると、その時刻の完成した画面が描かれます。`window.seek(10.3)`（札の移動の終わり）や `window.seek(15.8)`（場面の消え際）で前後も確かめます。
4. 「再生」とスライダーで通して見て、読む時間と重なりを確かめます。
5. 場面の時刻を変えたときは、`video.js` の `SCENES` と各場面の関数の秒、`storyboard.json` の `scenes` の `start`・`end`・`enter`・`hold`・`exit` を同じ値にそろえます。
6. 映像に出す値を増やすときは、`video.js` の `select()` で `runs.json` の該当フィールドから取り出し、`storyboard.json` の `facts` に出どころを書き足します。値を直接打ち込まないでください。

## プレビュー

作例フォルダ（`workflow.py` がある階層）で次を実行し、ブラウザーで開きます。

```bash
python -m http.server 8000
# http://127.0.0.1:8000/video/
```

- 準備ができると状態の欄に「準備完了」と出て、再生ボタンとスライダーが使えるようになります。
- 「再生」で再生・一時停止、スライダー（0–28秒、0.01秒刻み）で任意の秒へ移動できます。スライダーはキーボード（矢印、Home、End、PageUp、PageDown）でも動かせます。どの操作も同じ `window.seek(秒)` で描きます。28秒に達すると止まり、もう一度「再生」を押すと0秒から始まります。
- SHA-256 の照合にブラウザーの暗号機能を使うため、`file://` や localhost 以外の HTTP では開けません。
- 作例ページへ戻る：[../index.html#find](../index.html#find)

## 任意の時刻を描く約束

- `window.seek(秒)` は、その時刻の完成した画面を、前に呼んだ時刻や経過時間に関係なく描きます。呼ぶたびに Canvas の幅・高さを設定し直して内容と状態を初期化し、コンテキスト（`willReadFrequently: true`）を取り直してから、全レイヤーを時刻だけから描き直します。タイマー・乱数・CSSアニメーション・前フレームの積み重ねには依存しません。準備前に呼ばれたときは、準備後に描く Promise を返します。
- `window.motionConfig` は `{duration: 28, fps: 30, width: 1280, height: 720, posterTime: 13.5, audioEvents: []}`。`window.renderConfig` の幅・高さ・fps を初期化時に反映し、配置は実際の Canvas の寸法から縮小率を計算します。配置は横長16:9用で、ほかの比率では余白つきの縮小表示になります（比率ごとの再配置はしていません）。
- `window.motionReady` は、データ・画像のデコード・フォントの準備と最初の1枚の描画が終わると解決し、素材に問題があれば拒否されます。状態は `window.motionState`（`loading`・`ready`・`error`）、`<html data-motion>`、エラー文は `window.motionError` でも読めます。
- `window.__MOTION_RENDER__` が真のときは、プレビュー用の再生を止め、操作部を隠して、画面いっぱいに Canvas だけを置きます。
- フォントは OS の日本語フォント（ヒラギノ、游明朝・游ゴシック、メイリオなど）を使います。別の OS やフォントでは文字の形と幅が変わることがあります。

## 書き出し（再現手順）

必要なもの：Node.js 20以上、Python 3、Google Chrome、FFmpeg と ffprobe。作例フォルダ（`render.py` がある階層）で実行します。

```bash
npm ci --ignore-scripts --no-audit --no-fund --prefix tools/motion-reel
python render.py --out ../codebase-memory-mcp-renders/first
```

- `npm ci` はレンダラーの依存（Playwright）を `tools/motion-reel/node_modules/` に入れます。この `node_modules/` は公開する作例ソースには含めません。
- `render.py` は作例フォルダを一時フォルダへ複製し（`node_modules` などは除く）、`video/index.html` を入口にして（`<base href="video/">` を加えて）同梱の Motion Reel レンダラーを動かします。そのため `index.html` には `<base>` を書かず、素材は `video.js` の場所から `../outputs/…`・`../assets/…` の相対パスで読みます。
- 出力先は作例フォルダの外の空フォルダにしてください。`render.py` は作例フォルダの中（例：`renders/first`）や空でないフォルダを拒否し、既存の出力を上書きしません。上の例は作例フォルダと同じ階層に `codebase-memory-mcp-renders/first` を作ります。
- 出力には代表時刻の静止画（2秒ごと）、全体シート、ポスター（13.5秒）、8.1秒前後の連続フレーム、`video.mp4`（音なし）、`capture.json`、`review.html` が入ります。静止画だけを出すときは `--stills-only` を付けます。
- リポジトリのルートから実行するときは、`tools/motion-reel` と `render.py` の前に作例フォルダへのパスを付けます。

## 確認の状態

この編集ソースを納品した時点では、ブラウザーでの読み込み、実際の描画、切り抜き位置とフレームの目視確認、MP4 の書き出しと再生、同じ時刻の再描画一致、プレビュー操作の確認は、いずれも**未実施**です（一覧は `storyboard.json` の `pendingChecks`）。書き出しとレビューはこの後の工程で行います。人による承認ではありません。

## この動画が示さないこと

- MCP クライアントからの接続、MCP プロトコル経由の動作。ツールは公式のネイティブ CLI から1回ずつ呼びました。
- 実行時の呼び出しの記録。矢印は索引に記録された静的な関係です。動的な呼び出しは出ないことがあり、矢印がないことは呼ばれないことの証明ではありません。3つの呼び出し先の並びは返った順で、実行の順番ではありません。
- 自動の索引の更新。CLI で作った索引は監視されず（`watch: false`）、変更後は手で `index_repository` をやり直しました。
- 実際の取引。注文・金額・ワークショップ名は作例用の架空データで、決済・予約・通知はしていません。
- CBM Lens、ブラウザAI、意味検索、大きなリポジトリ、速さ・トークン量・回答品質。原典 README の数値は作者の測定で、この作例では測っていません。

## 出典とライセンス

- この動画の構成・文字・コード、スクリーンショットに写る作例ビューア、作例のコードとデータ：MIT License、Copyright (c) 2026 Studio Yebisu（[../LICENSE](../LICENSE)）。編集ソースは Claude Opus 5.5（`claude-opus-5-5`）が作成しました。
- 書き出しに使う Motion Reel レンダラー（`../tools/motion-reel/`）：MIT License、Copyright (c) 2026 Studio Yebisu（[../tools/motion-reel/LICENSE](../tools/motion-reel/LICENSE)）。
- Codebase Memory MCP：MIT License、Copyright (c) 2025 DeusData（[../vendor/codebase-memory-mcp/LICENSE](../vendor/codebase-memory-mcp/LICENSE)）。原典：[DeusData/codebase-memory-mcp @ ec6427c38176efcd37b28682e82f2491afda94be](https://github.com/DeusData/codebase-memory-mcp/tree/ec6427c38176efcd37b28682e82f2491afda94be)（v0.12.0 のソース固定コミット）
