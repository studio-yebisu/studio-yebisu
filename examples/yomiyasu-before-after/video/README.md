# 図解動画「推敲の指示書と、点検の道具」の元ページ

yomiyasu 作例の32秒・無音の図解動画を描く、編集できるソースです。作例ページ（`../index.html`）と同じ概念図を `../concept.js` から読み込み、同じ形（本・原文の紙・用途の封筒・残す条件の札・1つのAI・別の工程のPython・候補の札・読み比べ・JSON）を時刻に合わせて動かします。

- 縦 720×1280（主）と、配置を作り直した横 1280×720。30fps・960フレーム。
- 7場面：0・4・8・13・18・23・29秒。29〜32秒は静止（ポスターは31秒）。黒への暗転はありません。
- 例は架空の保存操作の説明（`operation`）。紙の言い回し、lintとdiffの候補、読み比べの語句、`outputs/operation.json` の名前と大きさは、照合済みの素材から読み、保存済みの文字列の部分だけを使います。
- 音はありません。`audioEvents` は空で、ナレーション・音声ガイド・読み上げ・音源の読み込みはありません。
- ここではAIもPythonも実行しません。推敲は制作時に Opus 5.5 が保存した出力、lintとdiffは制作担当が各件1回ずつ実行した保存済みの出力（`../concept/checks.json`）です。

## ファイル

| ファイル | 役割 |
|---|---|
| `index.html` | 元ページ。キャンバス `#film`、場面の見出し、操作（再生・先頭へ・最初から再生・末尾へ・0〜32秒のスライダー・7場面へ移るボタン・縦／横） |
| `video.js` | 時刻 t の画面を描く。`window.motionConfig`・`window.renderConfig`・`window.motionReady`・`window.seek` |
| `video.css` | 元ページの見た目と、書き出し時にキャンバスだけを出す表示 |
| `storyboard.json` | 場面ごとの「伝わること・入る状態・出る状態・時刻」 |
| `scene.js`・`legacy.html` | 以前の28秒の映像ソース。参照用に残しています |

## 時間の契約（Motion Reel）

- `window.motionConfig = {duration: 32, fps: 30, width, height, posterTime: 31, audioEvents: []}`。
- `window.renderConfig` の `width`・`height`・`fps` を初期化時に反映します。幅が高さより大きければ横の配置で描きます。
- `window.motionReady` は、フォントの準備と19件の素材の照合（大きさ・SHA-256・中身の対応）が済むと解決します。照合に失敗すると拒否され、描画は止まります。
- `window.seek(seconds)` は、指定時刻を最も近いフレームにそろえ、その時刻の完成した画面を描いてから解決するPromiseを返します。呼んだ順番や壁時計、前のフレームには依存しません。描画のたびに状態を保存・復元します。
- `window.__MOTION_RENDER__` が真なら、プレビューのタイマーと操作の処理を使わず、キャンバスだけを表示します。乱数、外部通信、ネットワークのフォント、画面の撮影は使いません。

## 開き方と書き出し

素材を `fetch` で読むため、作例のフォルダ（`index.html` があるフォルダ）をローカルのHTTPサーバーで配信して開きます。

```bash
python -m http.server 8000   # http://127.0.0.1:8000/video/index.html
```

作例のルートに同梱した `render-visual.py` を使います。フォルダ全体を一時コピーし、素材を同じ配信範囲から読める形で編集ページを開きます。

```bash
python render-visual.py --out ../yomiyasu-portrait --width 720 --height 1280 --strip-at 10.2
python render-visual.py --out ../yomiyasu-wide --width 1280 --height 720 --strip-at 10.2
```

作例ルートで実行します。Python・Node20以上・Chrome・FFmpegと、tools/motion-reelの依存が必要です。空の出力フォルダを使い、代表フレームのみなら `--stills-only` を付けます。詳細は [現在の再現手順](../visual-guide.md) です。

作例ページの動画は、縦が `../../media/yomiyasu-before-after.mp4`（ポスター `../../media/yomiyasu-before-after.webp`）、横が `../../media/yomiyasu-before-after-wide.mp4` を参照します。

## 確認の状態

このソースは claude-opus-5-5 が執筆した時点で、ブラウザでの表示、フレームの書き出し、MP4の作成、映像の目視確認をいずれも行っていません。これは原本の執筆時点の状態です。その後の制作担当の実際の確認記録は [visual-verification.json](../visual-verification.json) に記録します。原本の執筆と後の描画・QAを分けて扱います。

## 出典と利用条件

- 原典：[nanaism/yomiyasu](https://github.com/nanaism/yomiyasu/tree/60bf877acebc86651e0b67d70112a66245f87758)、コミット `60bf877acebc86651e0b67d70112a66245f87758`。MIT License、Copyright (c) 2026 nanaism（`../vendor/yomiyasu/LICENSE`）。lintスクリプトのUnicode由来データには `../vendor/yomiyasu/UNICODE-LICENSE.txt`（Unicode License V3）の通知が付きます。
- この元ページ・図・文言：MIT License、Copyright (c) 2026 Studio Yebisu（`../LICENSE`）。
- 文章はすべて架空です。原作者による承認や推奨を示すものではありません。

制作側の補正：小画面の保存操作、hidden属性を付けた再試行ボタンの表示、diffの2→1が候補の個数ではなく「つなぎの出現数」である説明と、再現コマンドを補正しました。元の3件の推敲・CLI出力は変更していません。

制作側の描画補正：推敲の段階の終端で紙が空になっていた境界処理を直し、完了した言い回しが次の編集まで残るようにしました。最終映像はrenders-r2から描画し、執筆原本と区別しています。
