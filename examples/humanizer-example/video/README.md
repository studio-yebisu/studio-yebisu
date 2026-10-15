# 編集動画：原文と、残す条件を渡す（28秒・無音）

Humanizerを初めて使う人に向けて、次の5つを順に見せる短い説明動画です。

1. **渡す**：原文・読み手・残す条件の3つを渡す
2. **削る**：具体的な事実がない一文を、行ごと削る
3. **残す**：対象と除外の2文は、否定も含めてそのまま残す
4. **答えを先に**：英語のサポート返信で、答えを最初の文にし、できないこと・範囲・不確実さ（Large・may）を残す
5. **読み比べる**：保存結果ビューアで初稿・点検・最終稿を比べ、`revisions.md` と `revisions.json` を持ち帰る

HumanizerはAIエージェント（モデル）が読んで従うMarkdownのスキルです。この動画も作例ページも文章を書き直しません。映像に出る推敲結果は、Claude Opus 5.5 が制作時に固定版SKILL.mdを読んで書き、保存したものです。文章はすべて架空の製品「Mado Notes」のもので、人による校閲・承認は受けていません。

| 項目 | 値 |
|---|---|
| 尺・サイズ | 28.0秒、1280×720、30fps（840フレーム） |
| 音 | なし（`audioEvents: []`） |
| ポスター | 13.5秒（対象と除外の2文を残した場面） |
| 編集ソース | `index.html`（プレビュー）、`video.js`（描画）、`video.css`、`storyboard.json`（場面・字幕と引用元・素材・未確認の点） |

## 素材

連続した画面録画ではなく、保存データと実際の画面を素材に編集した動画です。使うのは次のローカルファイルだけで、外部のフォント・画像・通信はありません。

| ファイル | 使い方 |
|---|---|
| [../outputs/movie-materials.json](../outputs/movie-materials.json) | 素材一覧。下のファイルのパス・SHA-256・寸法 |
| [../inputs/jobs.json](../inputs/jobs.json) | 日本語の例の原文第1段落・読み手・残す条件の項目名、英語の返信の質問 |
| [../outputs/revisions.json](../outputs/revisions.json) | 削った一文と変更理由、残した条件の引用と説明、返信の最終稿の文 |
| [../outputs/revisions.md](../outputs/revisions.md) | 映像には描かない。持ち帰るファイルとして示すため、実在と一致だけを確かめる |
| [../assets/desk-japanese.png](../assets/desk-japanese.png) | 保存結果ビューアの実際のスクリーンショット（日本語の例）。Canvas上で切り抜く |
| [../assets/desk-top.png](../assets/desk-top.png) | 同じく、ダウンロードボタンの部分を切り抜く |

- 映像の引用は、保存データの該当フィールドから読み込み時に取り出します。打ち直した文や言い換えは使いません。どの文をどのフィールドから取ったかは `storyboard.json` の `fromData` に記録しています。
- 読み込み時に、各ファイルのSHA-256とスクリーンショットの寸法を素材一覧と照合し、引用が原文・最終稿の中にあることも確かめます。一致しない・読めない・見つからないときは、エラーを表示して再生ボタンを無効にします。代わりの画面は出しません。
- 画像ファイルは改変していません。切り抜きは描画時にだけ行います。
- 残す条件17項目すべては映像に出しません。本文を引用するのは3項目（日本語の「対象と除外」、英語の「再開できない」「時間の限定と不確実性」）です。

## プレビュー

ソースバンドルのルート（`examples/` がある階層）で次を実行し、ブラウザーで開きます。

```bash
python -m http.server 8000
# http://localhost:8000/examples/humanizer-example/video/
```

- 準備ができると状態の欄に「準備完了」と出て、再生ボタンとスライダーが使えるようになります。
- 「再生」で再生・一時停止、スライダー（0–28秒、0.1秒刻み）で任意の秒へ移動できます。スライダーはキーボード（矢印、Home、End、PageUp、PageDown）でも動かせます。どの操作も同じ `window.seek(秒)` で描きます。
- SHA-256の照合にブラウザーの暗号機能を使うため、`file://` やlocalhost以外のHTTPでは開けません。
- 作例ページへ戻る：[../index.html#japanese](../index.html#japanese)

## 任意の時刻を描く約束

- `window.seek(秒)` は、その時刻の完成した画面を、前に呼んだ時刻や経過時間に関係なく描きます。呼ぶたびにCanvasの幅・高さを設定し直して内容と状態を初期化し、全レイヤーを時刻だけから描き直します。タイマー・乱数・CSSアニメーション・前フレームの積み重ねには依存しません。準備前に呼ばれたときは、準備後に描くPromiseを返します。
- `window.motionConfig` は `{duration: 28, fps: 30, width: 1280, height: 720, posterTime: 13.5, audioEvents: []}`。`window.renderConfig` の幅・高さ・fpsを初期化時に反映します。配置は16:9用で、ほかの比率では余白つきの縮小表示になります（各比率での配置の作り直しはしていません）。
- `window.motionReady` は、データ・画像のデコード・フォントの準備と最初の1枚の描画が終わると解決し、素材に問題があれば拒否されます。
- `window.__MOTION_RENDER__` が真のときは、プレビュー用の再生を止め、操作部を隠して、画面いっぱいにCanvasだけを置きます。
- フォントはOSの日本語フォント（ヒラギノ、游明朝・游ゴシック、メイリオなど）を使います。別のOSやフォントでは文字の形と幅が変わることがあります。

## 書き出し（再現手順）

必要なもの：Node.js 20以上、Python 3、Google Chrome、FFmpegとffprobe。ソースバンドルのルートで実行します。

```bash
npm ci --ignore-scripts --no-audit --no-fund --prefix examples/humanizer-example/tools/motion-reel
python examples/humanizer-example/render.py --out renders/video-first
```

- `render.py` は作例フォルダを一時フォルダへ複製し、`video/index.html` を入口にして（`<base href="video/">` を加えて）同梱のMotion Reelレンダラーを動かします。出力先は作例フォルダの外の空フォルダにしてください。既存の出力は上書きしません。
- 静止画だけを出すときは `--stills-only` を付けます。

## 確認の状態

この編集ソースを納品した時点では、実際の描画、フレームの目視確認、MP4の書き出しと再生、同じ時刻の再描画一致、プレビュー操作の確認は、いずれも**未実施**です（一覧は `storyboard.json` の `pendingChecks`）。この後の工程で実施した確認の現在の記録は [../verification.json](../verification.json) を見てください。そこにない確認は行われていません。人による承認ではありません。

## この動画が示さないこと

- AI検出の結果や点数、品質の点数、意味が同じであることの保証は示しません。
- 英語2件・日本語1件の結果です。日本語全般、ほかの文体、長い文書での効果は確かめていません。
- 映像内にダウンロードの実行・進行・完了の表示はありません。ファイルは制作時に保存済みのものです。

## 出典とライセンス

- この動画の構成・文字・コード、スクリーンショットに写る保存結果ビューア、推敲結果のデータ：MIT License、Copyright (c) 2026 Studio Yebisu（[../LICENSE](../LICENSE)）。
- 書き出しに使うMotion Reelレンダラー（`../tools/motion-reel/`）：MIT License、Copyright (c) 2026 Studio Yebisu。
- Humanizer：MIT License、Copyright (c) 2025 Siqi Chen。固定版（コミット `225a6f3`）を書き換えずに同梱し、ライセンスは [../vendor/humanizer/LICENSE](../vendor/humanizer/LICENSE) に残しています。原典：[blader/humanizer @ 225a6f3](https://github.com/blader/humanizer/tree/225a6f39ac85f76ee48dbad772ea4abe4ed6c9d8)
