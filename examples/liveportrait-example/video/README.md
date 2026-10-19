# LivePortrait 作例：解説動画の編集用ソース

32秒・30fps・無音の解説動画のソースです。縦 720×1280 と横 1280×720 を、同じ時刻表から別々の配置で描きます。ナレーション・読み上げ・音声トラックはありません（`audioEvents: []`）。

作例ページと同じ `../app.js` を読み込み、同じ照合（`verifyAll`・`loadMedia`）と同じ構造図の描画（`drawMap`）を使います。照合が合わなければ描かずに止め、`window.motionReady` は失敗として終わります。ファイルを元に戻して「もう一度確かめる」を押すと、同じ照合からやり直します。

## ファイル

- `index.html`：プレビューと操作（再生・一時停止・最初から・最初へ・最後へ、0.1秒刻みのシーク、時刻の直接入力、縦横の切り替え、7場面、照合した素材の一覧）。
- `main.js`：Motion Reel の時刻の契約と操作。
- `draw.js`：時刻 t から1コマを描く。場面ごとの状態は場面内の進み p だけで決まります。
- `storyboard.json`：7場面それぞれの「伝わること・入る状態・出る状態・動き・使うデータ」と時刻。

## 時刻の契約（Motion Reel）

- `window.motionConfig = { duration: 32, fps: 30, width, height, posterTime: 31, audioEvents: [] }`。`window.renderConfig` に幅・高さ・fps があれば、それを初期化時に使い、幅が高さより大きければ横の配置で描きます。
- `window.motionReady`：絵コンテの確認、48ファイルの照合、画像のデコード、フォントの準備が終わると解決します。
- `window.seek(秒)`：任意の時刻の完成した画を描きます。乱数・タイマー・前のコマの積算は使わないので、呼ぶ順番に関係なく同じ画になります。
- `window.__MOTION_RENDER__` が真のときは自動再生せず、操作の画面を隠してキャンバスだけを全面に出します。
- 29秒以降は静止します（30秒と31秒は同じ画）。

## 7場面

| 秒 | 場面 | 内容 |
|---|---|---|
| 0–4 | 何か | 全体の図が最初から見える。README → 作者 AI 1体 → 制作担当（1回実行）。 |
| 4–8 | 入力 | 原画 s9.jpg の手動の枠 → 512 の切り出し → 元 API の 256。 |
| 8–12 | 分かれる | 同じ1枚から F（見た目の特徴）と M（21点と姿勢）が1回ずつ。 |
| 12–16.5 | 手動の値 | 作者の yaw の値が点線で入り、21点を変換して stitching で補正（±16度の実測36コマ）。 |
| 16.5–21 | 合流 | F の別線（再利用）と動いた21点が W で合流し、G が描いた実際の #9 が代表5枚へ。 |
| 21–26.5 | 実際の PNG | 入力の1枚と生成 #0 を並べ、±8度・±16度の代表5枚を広げる。 |
| 26.5–32 | 返る | MP4（512×512・36コマ・12fps・3秒・音声なし）から「再生・保存」へ。 |

使う画像は、照合した原画・手動の切り出し・各条件の代表5枚の生成 PNG だけです。中間のコマを補ったり、静止画を動画全体のように見せたりはしません。21点と角度は `concept/facts.json` の実測値です。立方体と動く印は説明のための形で、ネットワークの内部の値や実際の処理時間ではありません。

## プレビュー

リポジトリのルートで `python -m http.server 8000` を実行し、<http://localhost:8000/examples/liveportrait-example/video/index.html> を開きます。`?orient=wide` で横の配置から始まります。照合に `fetch` と SHA-256 を使うので、`file://` では開けません。

## 書き出し（制作担当の後の工程）

書き出しは、作者がこのソースを書いた後に、制作担当が Motion Reel の固定版のレンダラーで行います。この README の作成時点では、描画・コンタクトシート・MP4 の書き出し・再生の確認はどれもまだです。例（`<skill-dir>` は Motion Reel の SKILL.md のあるフォルダー、出力先は毎回新しい空のフォルダー）：

```text
npm ci --prefix examples/liveportrait-example/tools/motion-reel
python examples/liveportrait-example/render_visual.py --out <新しいフォルダー>/portrait --width 720 --height 1280 --strip-at 18.4
python examples/liveportrait-example/render_visual.py --out <新しいフォルダー>/wide --width 1280 --height 720 --strip-at 18.4
```

音の指定（`--synth`・`--audio`）は使いません。ページは素材を `fetch` で照合するので、レンダラーが http(s) か localhost からこのページを開けることを、書き出しのときに確かめてください。公開する MP4 は `media/liveportrait-example.mp4`（縦）と `media/liveportrait-example-wide.mp4`（横）、ポスターは `media/liveportrait-example.webp` です。

この解説動画（32秒）と、原典が返した3秒の MP4（`outputs/yaw08.mp4`・`outputs/yaw16.mp4`）は別のものです。

## ライセンス

このソースは Studio Yebisu の制作で MIT（`../LICENSE`）。作者 AI（Claude Opus 5.5）が書きました。描く画像の出所とライセンスは `../README.md` と `../THIRD_PARTY_NOTICES.md` を参照してください。


## 制作担当による後工程の追記

作者が書いた時点の未確認状態と、その後の制作担当による検査は別です。制作担当が12スマホ状態・6部品8引用・16表示条件・3破損停止と復旧、実3秒動画2本の自然終端、5保存要求と返却5ファイルの全バイト一致、編集48素材・7場面・任意7.2秒・通常32秒・ネイティブrange0.1秒、代表/連続/contactと縦横32秒960f無音MP4の全デコード/自然終端、出荷ソース62PNG一致を新しく確認。人の審美的承認・実機iOS/Safari/VoiceOver・200%拡大・全入力/品質/性能は未確認。 詳細は visual-verification.json（映像側からは ../visual-verification.json）にあります。紹介映像と編集は無音で、実出力2本にも音声トラックはありません。

制作担当による再現範囲の補足：実制作では固定版の全213ファイルのcheckoutを使いました。配布した22原典ファイルには、このrun_example.pyが照合する21パス（コード・設定・小さな補助リソース・LICENSE）がすべて含まれます。この限定されたコアAPI用ランナーのソース要件を満たす範囲で、LivePortraitのアプリ全体を同梱したものではありません。別途、固定した5重み、Python3.11と記載の依存、FFmpegが必要です。重みや環境は同梱していません。同梱ソースを起点とした別の推論実行はしておらず、この説明はファイル要件とimportの静的な確認に基づきます。原本のヘルプやUPSTREAM.jsonにある「full checkout required」は実制作時の配置とアプリ全体の導入の説明として残しています。限定コアの再現にも全アプリや検出モデルが必ず必要、という意味ではありません。

source.zip はリポジトリのルート配置（examples/liveportrait-example と media と LICENSE）です。空のフォルダーに展開し、その展開ルートで python -m http.server 8000 を起動し、http://127.0.0.1:8000/examples/liveportrait-example/index.html または video/index.html を開きます。file:// ではハッシュ検査・モジュール読込は動きません。共通の記事サイトは含まれません。

描画の再現は、必要な依存を npm ci --prefix examples/liveportrait-example/tools/motion-reel で別途用意し、展開ルートで python examples/liveportrait-example/render_visual.py --out ../fresh-portrait --width 720 --height 1280 --strip-at 18.4 を実行します。横は別の新規出力先と --width 1280 --height 720、代表/連続PNGだけなら --stills-only を指定します。既存出力を上書きしません。この利用者側の再現は、今回凍結した1回のモデル実行とは別です。
