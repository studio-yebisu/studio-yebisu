# 編集動画：申請を止めて、テスト回答で続きを動かす（28秒・無音）

LangGraph を初めて見る人に向けて、次の5つを順に見せる短い説明動画です。

1. **渡す**：架空の機材貸出申請（カメラ1・三脚2）を、`workflow.py` の StateGraph に渡す
2. **止める**：入力確認 → 見積 → 確認待ち と進み、`review` ノードの `interrupt` で処理が止まる（`next: ["review"]`、見積合計 8,000円）
3. **再開する**：テスト回答 `approved: true` を `Command(resume=…)` で渡すと、止まっていた同じ位置から続きが動き、`approved` で終わる
4. **分ける**：返却日のない申請は止まらずに `needs_input`。高額の申請（36,000円）は止まり、テスト回答 `approved: false` で `rejected`
5. **確かめる**：保存結果ビューアの実際の画面と、持ち帰るファイル `outputs/runs.json`・`outputs/result.md`

LangGraph は Python のオーケストレーション用ライブラリです。この作例の各ノードは決まった規則で動く Python 関数で、LLM は使っていません。`workflow.py` のコードはモデルが書き、データの処理はそのノードが行いました。停止と再開は同じ Python プロセスの中で、`InMemorySaver` のメモリ上のチェックポイントを使って行いました。承認・差し戻しはスクリプトが渡したテスト値で、人の承認ではありません。名前・催し・単価はすべて架空です。

| 項目 | 値 |
|---|---|
| 尺・サイズ | 28.0秒、1280×720、30fps（840フレーム） |
| 音 | なし（`audioEvents: []`） |
| ポスター | 13.5秒（テスト回答で再開し、approved・8,000円で終わった場面） |
| 編集ソース | `index.html`（プレビュー）、`video.js`（描画）、`video.css`、`storyboard.json`（場面・字幕と値の出どころ・素材・未確認の点） |

## 素材

連続した画面録画ではなく、保存済みの実行結果と実際の画面を素材に編集した動画です。使うのは次のローカルファイルだけで、外部のフォント・画像・通信はありません。

| ファイル | 使い方 |
|---|---|
| [../outputs/movie-materials.json](../outputs/movie-materials.json) | 素材一覧。下のファイルのパス・SHA-256・寸法 |
| [../outputs/runs.json](../outputs/runs.json) | 3件の入力・経路（チェックポイントの `next`）・停止時の `get_state` と `interrupt`・テスト回答・再開後と最終状態 |
| [../inputs/requests.json](../inputs/requests.json) | 入力とテスト回答が `runs.json` と一致することの確認 |
| [../outputs/result.md](../outputs/result.md) | 映像には描かない。持ち帰るファイルとして示すため、実在と一致だけを確かめる |
| [../workflow.py](../workflow.py) | 映像には描かない。`interrupt(payload`・`Command(resume=`・`checkpointer=InMemorySaver()` の記述があることだけを確かめる |
| [../assets/desk-pause.png](../assets/desk-pause.png) | 保存結果ビューアの実際のスクリーンショット（通常の申請の「通った経路」と「確認待ちで止まる」）。Canvas 上で切り抜く |

- 映像の値は、保存データの該当フィールドから読み込み時に取り出します。打ち直した値は使いません。どの文字をどのフィールドから取ったかは `storyboard.json` の `fromData` に記録しています。
- 読み込み時に、各ファイルの SHA-256 とスクリーンショットの寸法を素材一覧と照合し、経路・停止位置・回答と結果の対応も確かめます。一致しない・読めない・見つからないときは、エラーを Canvas に表示して再生ボタンを無効にします。代わりの画面は出しません。
- 画像ファイルは改変していません。切り抜きは描画時にだけ行います。画面内の小さな文字に主な情報を任せず、同じ値を横に大きく組版しています。

## プレビュー

作例フォルダ（`workflow.py` がある階層）で次を実行し、ブラウザーで開きます。

```bash
python -m http.server 8000
# http://127.0.0.1:8000/video/
```

- 準備ができると状態の欄に「準備完了」と出て、再生ボタンとスライダーが使えるようになります。
- 「再生」で再生・一時停止、スライダー（0–28秒、0.1秒刻み）で任意の秒へ移動できます。スライダーはキーボード（矢印、Home、End、PageUp、PageDown）でも動かせます。どの操作も同じ `window.seek(秒)` で描きます。
- SHA-256 の照合にブラウザーの暗号機能を使うため、`file://` や localhost 以外の HTTP では開けません。
- 作例ページへ戻る：[../index.html#approved](../index.html#approved)

## 任意の時刻を描く約束

- `window.seek(秒)` は、その時刻の完成した画面を、前に呼んだ時刻や経過時間に関係なく描きます。呼ぶたびに Canvas の幅・高さを設定し直して内容と状態を初期化し、コンテキストを取り直してから、全レイヤーを時刻だけから描き直します。タイマー・乱数・CSSアニメーション・前フレームの積み重ねには依存しません。準備前に呼ばれたときは、準備後に描く Promise を返します。
- `window.motionConfig` は `{duration: 28, fps: 30, width: 1280, height: 720, posterTime: 13.5, audioEvents: []}`。`window.renderConfig` の幅・高さ・fps を初期化時に反映し、配置は実際の Canvas の寸法から計算します。配置は横長16:9用で、ほかの比率では余白つきの縮小表示になります（各比率での配置の作り直しはしていません）。
- `window.motionReady` は、データ・画像のデコード・フォントの準備と最初の1枚の描画が終わると解決し、素材に問題があれば拒否されます。
- `window.__MOTION_RENDER__` が真のときは、プレビュー用の再生を止め、操作部を隠して、画面いっぱいに Canvas だけを置きます。
- フォントは OS の日本語フォント（ヒラギノ、游明朝・游ゴシック、メイリオなど）を使います。別の OS やフォントでは文字の形と幅が変わることがあります。

## 書き出し（再現手順）

必要なもの：Node.js 20以上、Python 3、Google Chrome、FFmpeg と ffprobe。作例フォルダ（`render.py` がある階層）で実行します。

```bash
npm ci --ignore-scripts --no-audit --no-fund --prefix tools/motion-reel
python render.py --out <作例フォルダの外にある空のフォルダの絶対パス>
```

- `render.py` は作例フォルダを一時フォルダへ複製し、`video/index.html` を入口にして（`<base href="video/">` を加えて）同梱の Motion Reel レンダラーを動かします。そのため `index.html` には `<base>` を書かず、素材は `../outputs/…`・`../assets/…` の相対パスで読みます。
- 出力先は作例フォルダの外の空フォルダにしてください。フォルダの中や、空でないフォルダは拒否します。既存の出力は上書きしません。
- 静止画だけを出すときは `--stills-only` を付けます。
- リポジトリのルートから実行するときは、`tools/motion-reel` と `render.py` の前に作例フォルダへのパスを付けます。

## 確認の状態

この編集ソースを納品した時点では、ブラウザーでの読み込み、実際の描画、フレームの目視確認、MP4 の書き出しと再生、同じ時刻の再描画一致、プレビュー操作の確認は、いずれも**未実施**です（一覧は `storyboard.json` の `pendingChecks`）。この後の工程で実施した確認の現在の記録は [../verification.json](../verification.json) を見てください。そこにない確認は行われていません。人による承認ではありません。

## この動画が示さないこと

- 人による確認・承認。承認・差し戻しは `inputs/requests.json` の `test_resume` をスクリプトが渡したテスト値です。
- 金額による自動の差し戻し。高額の申請が差し戻しになったのはテスト回答が `false` だったためで、30,000円以上は `budget_flag` の目印が付くだけです。
- プロセス再起動後の再開。`InMemorySaver` はメモリ上だけに状態を置き、プロセスを終えると消えます。
- 予約・在庫確保・通知・決済などの外部処理、処理速度・品質の数値。

## 出典とライセンス

- この動画の構成・文字・コード、スクリーンショットに写る保存結果ビューア、作例のコードとデータ：MIT License、Copyright (c) 2026 Studio Yebisu（[../LICENSE](../LICENSE)）。
- 書き出しに使う Motion Reel レンダラー（`../tools/motion-reel/`）：MIT License、Copyright (c) 2026 Studio Yebisu（[../tools/motion-reel/LICENSE](../tools/motion-reel/LICENSE)）。
- LangGraph：MIT License、Copyright (c) 2024 LangChain, Inc.。固定版（コミット `d4149cc`）を書き換えずに同梱し、ライセンスは [../vendor/langgraph/LICENSE](../vendor/langgraph/LICENSE) と `libs/` 以下の各パッケージに残しています。原典：[langchain-ai/langgraph @ d4149cc](https://github.com/langchain-ai/langgraph/tree/d4149cc1f5384364d1a21092b4c2f582a6e7af8f)
