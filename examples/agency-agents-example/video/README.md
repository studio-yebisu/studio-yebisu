# 解説動画の元ページ：2役を渡し、動く案内へ。

Agency Agents 作例（架空イベント「こもれび つくる日」の企画ガイド）の、28秒・無音・1280×720・30fps（840フレーム）の解説動画を描く編集用のページです。`index.html` を開くと canvas に映像が出ます。

この映像は、実画面の**静止キャプチャ**と、実際に保存されたファイルを編集して組み直したものです。続けて録画したものではありません。ページでも映像でも、AIは動きません。音はありません（`audioEvents` は空）。

## 伝えること

- 元の依頼「地域イベントを、スマホで案内したい。」に、固定版の UX Architect と Frontend Developer の役割ファイル（msitarzewski/agency-agents `bd956db`）を、同じ Claude Opus 5.5 が**別々の実行で順に**当てた。独立した2エージェント・自動の受け渡し・インストールしたエージェント・MCP ではありません。
- UX Architect の成果（`outputs/ux-handoff.json`・`foundation.css`）を Frontend Developer が読み、動く企画ガイド（`index.html`・`app.js` など）を作った。
- 重なる企画の追加は止まり、予定は変わらない。引き継ぎ書の「入れ替える」案（A09）は採用していません。
- 終わりと始まりが同時刻（14:00）なら両方選べる。実際に保存したJSONは4件・合計1,000円・`fictional: true`・`reserved: false`。

場面ごとの時刻・入り方・出方・素材は `storyboard.json` にあります。

## 読み込むファイル（12件、すべて SHA-256 で照合）

`video.js` は、まず `assets/data-hashes.json` を読み、そのバイト列の SHA-256 が `runtime/frozen-reviewed-source.json` に記録された値（`9a433954…a546210`）と一致するかを確かめます。次に、照合表にある12ファイルを読み、それぞれの SHA-256 が照合表と一致するかを確かめます。1つでも読めない・違う場合は、代わりのデータや仮の映像を出さず、canvas とページに理由を出し、`window.motionReady` を失敗にします。

| ファイル | 映像での使い道 |
|---|---|
| `input/event.json` | 6企画のID・題名・時刻・費用・対象。重なり（S01×S02、S04×S05）と接する時刻（S05→S06）をここから計算する |
| `outputs/ux-handoff.json` | 2役の名前・役割ファイル・入力・成果・確認項目の数、A09 の提案。Frontend の確認項目は「提案」として扱う（`frontend-developer.applied_instructions` は空のまま） |
| `outputs/implementation.md` | A09 を採用しなかった記録・モデル名・`ai/agents/architect.md` がないことの確認 |
| `outputs/browser-itinerary.json` | 実際に保存したJSON。selected_ids・入力と同じ企画オブジェクト4件・count・total_price_yen・fictional・reserved |
| `outputs/browser-record.json` | 実操作の記録。保存JSONの SHA-256、`conflict-S02`（selected [S01]、「1件のまま」）、`touching-S06`、要求したファイル名 |
| `video/assets/screen-manifest.json` | 実画面6枚の大きさと SHA-256、DOM の範囲（切り抜きが範囲を含むかの確認） |
| `video/assets/desktop-all.png` ほか PNG 6枚 | 実画面の静止キャプチャ。`desktop-plan.png` は照合して読み込むが、文字が小さくなるため映像には出さない |

パスは作例フォルダーからの相対で、`new URL('../' + path, import.meta.url)` で解決します。書き出し時に `render.py` が `<base href="video/">` を入れても同じ場所を指します。外部の通信はありません。

## 実画面の切り抜き（画像の画素座標）

画素の大きさを正とし、DOM の記録は全体撮影後の近似値として扱います。縦横同じ倍率で置き、画素を伸ばしたり、画面の中の文字を書き換えたり、アプリの部品に見える枠を重ねたりしていません。

| 名前 | ファイル | x, y, w, h | 倍率 | 中身 |
|---|---|---|---|---|
| phoneTop | phone-initial.png | 0, 0, 375, 594 | 0.79 / 0.66 | 見出し〜「企画を探す」（「キーワードで探す」の手前で切る） |
| darkTop | phone-dark.png | 0, 0, 375, 594 | 0.66 | 同じ範囲のダーク |
| cards | desktop-all.png | 64, 880, 752, 422 | 0.8 | 何も選ぶ前の S01・S02 のカード上部（`#session-1-title`・`#session-2-title` を含む） |
| conflictNote | desktop-conflict.png | 452, 1358, 353, 197 | 1.4 | S01 を選んだ後の S02 の注記と、その下の実際のボタン（`#session-2-conflict` を含む） |
| planLower | phone-plan.png | 0, 20, 375, 540 | 0.86 | 回る予定の下部：最後の S06・件数・予定の時間・合計・予約の注意・保存ボタン（4件すべての一覧ではない） |

区間の図、役割の札、JSONの値の一覧は、読み込んだデータから描いた**説明の図**で、実画面ではありません。映像の中でもそう書いています。

## 時間の契約

- `window.motionConfig = {duration: 28, fps: 30, width: 1280, height: 720, posterTime: 13.5, audioEvents: []}`。`window.renderConfig` の幅・高さ・FPS があれば最初に反映します。16:9 以外の大きさでは、1280×720 の画を等倍率で収め、余りを紙の色で埋めます（その大きさでのレビューはしていません）。
- `window.seek(seconds)` は、その秒の完成した画面を描きます。毎回 canvas をリセットし、変換・クリップ・透明度を戻してから描くので、呼んだ順番・壁時計・乱数・前のフレームに依存しません。
- `window.motionReady` は、フォントの準備と12ファイルの照合・画像の復元が終わったときに成功します。
- ポスターは13.5秒（重なりを止めた場面が完成した状態）。最後の場面は24.6秒までに止まり、28秒まで3秒以上そのまま読めます。

## 編集用のプレビュー

- 最初は停止しています。自動では再生しません（動きを減らす設定でも同じ）。「再生」を押したときだけ `requestAnimationFrame` で進み、ボタンの `aria-pressed` が実際の再生状態を示します。書き出し時（`window.__MOTION_RENDER__ === true`）はプレビューの仕組みを動かしません。
- 再生位置のスライダーは0〜28秒・0.1秒刻み。← → で0.1秒、PageUp・PageDown で2秒、Home・End で先頭・末尾（Home のあと PageUp を7回で14秒）。
- 操作部品は44px以上・文字16px。320・375・390px 幅で横スクロールが出ないように、`100vw` を使わず、セーフエリアの余白を取っています（実機での確認はしていません）。

## 書き出し

作例フォルダー（このフォルダーの1つ上）で、Node.js 20以上・Chrome・FFmpeg/ffprobe・Python を用意して実行します。出力先は元のフォルダーの外の、空のフォルダーにします。

```
npm ci --ignore-scripts --no-audit --no-fund --prefix tools/motion-reel
python render.py --out ../agency-render-first
```

`render.py` は作例フォルダーを一時フォルダーへ写し、この `video/index.html` を入口にして `tools/motion-reel/render.mjs` で静止画・連続フレーム・ポスター・MP4 を作ります。既存の出力は上書きしません。

## 確認の状態

この README と映像のソースを書いた時点では、書き出し・フレームのレビュー・MP4 の通し再生を**していません**。親の工程が実際のレンダラーと目視で確かめます。MP4 はまだないため、ページからは動画ファイルへリンクしていません。人によるレビューや承認は受けていません。

作例の企画ガイドについての確認の範囲（実ブラウザーでの操作・画面幅・保存）は、作例の `README.md` と `outputs/implementation.md` を参照してください。物理的な iOS・Safari・VoiceOver、性能の値は確かめていません。

## ライセンス

- 映像のコードと文章：MIT License, Copyright (c) 2026 Studio Yebisu（制作：Claude Opus 5.5）。
- 役割ファイルの原典 msitarzewski/agency-agents（`bd956db032d907387e6b9ddebff3e18f1de8c679`）：MIT License, Copyright (c) 2025 AgentLand Contributors。コミュニティ作成のもので、Anthropic 公式ではありません。
