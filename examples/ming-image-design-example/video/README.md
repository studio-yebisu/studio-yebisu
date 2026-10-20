# 解説動画の編集用ソース（32秒・30fps・無音）

`video/index.html` は、Ming Image 0.1 Design の作例の構造図を動かす、32秒・無音の解説動画の編集用ソースです。音声トラック・ナレーション・読み上げ・効果音はありません（`audioEvents` は空）。

## 何を見せるか

最初から最後まで同じ1枚の図が残り、強調と動く印だけが変わります。7つの場面の「伝えること・入る状態・出る状態・時刻・動き・使うデータ」は `storyboard.json` にあります。

1. 何か（0〜4.5秒）：文字入りの絵を描く画像生成モデル。SKILL.mdでも編集レイヤーでもない
2. 渡す（4.5〜9秒）：作者AI 1体がpromptとclientを書き、制作担当が公開デモへ匿名で1回送る
3. 読む（9〜13.5秒）：promptの後ろに256個のqueryの枠を足し、thinkerが1回読む
4. 分ける（13.5〜18秒）：queryの道（connector）と直接の道（3層・文言を運ぶ）の2本の条件
5. 描く（18〜23秒）：seed固定のノイズを12回更新（CFG 1でも正と負の差を使う）、4チャンネルのVAEへ
6. 返る（23〜27.5秒）：実際のPNG 1枚
7. 使う（27.5〜32秒）：会場の字形は要確認、透明画素は0で半透明が残る。29.6秒で動きを終え、30秒・31秒は同じ静止画

画像は、照合した実際のPNG 1枚（`outputs/reading-club.png`）だけです。最初から図の中に「実PNG」として映っています。トークンの粒・256の枠・3本の線・ノイズの粒・12の目盛り・四角は**説明の形**で、測った内部の値・途中の画像・処理時間ではありません。新しい生成物は作りません。

## 編集画面の使い方

https か localhost で `video/index.html` を開きます（作例のREADMEの開き方と同じ）。保存済みの20ファイルを照合してから描画と操作が使えるようになります。合わないときは描画と操作を止め、理由と「もう一度確かめる」を出します。

- 再生・一時停止、最初から再生、先頭へ、末尾へ
- 0.1秒刻みのつまみ、秒の数字を入れて Enter
- 7つの場面のボタン
- 縦 720×1280 と横 1280×720（向きを変えても時刻は保たれます。縦と横はそれぞれの配置で描き直します）
- 照合した20ファイルの一覧

## 時刻の契約（Motion Reel）

- `window.motionConfig = { duration: 32, fps: 30, width: 720, height: 1280, posterTime: 31, audioEvents: [] }`。初期化の前に `window.renderConfig` の幅・高さ・fpsを読み、反映します。幅が高さより大きければ横の配置で描きます。
- `window.motionReady` は20ファイルの照合・絵コンテの確認・PNGの読み込み・フォントの準備が終わると解決し、失敗すると拒否されます。
- `await window.seek(秒)` は、その時刻の完成した1コマを描きます。前に描いた時刻・呼んだ順番・壁時計・乱数には依存しません。
- `window.__MOTION_RENDER__` が真のときは、プレビューの再生・タイマーを使わず、操作の部品を出しません。

## 書き出し

作例のフォルダの直下にある `render_visual.py` が、このフォルダを一時的な場所へ写し、同梱の `tools/motion-reel/render.mjs` で描画します。Node.js 20以上・Chrome・FFmpeg/ffprobe が必要で、初回だけ `tools/motion-reel/` で `npm install --ignore-scripts` を行います（npmの依存は同梱していません）。出力先は毎回、新しい空のフォルダを使います。

```bash
python render_visual.py --out <空の出力先>/portrait
python render_visual.py --out <空の出力先>/landscape --width 1280 --height 720
```

## まだ確かめていないこと

制作担当が320/375pxの1例×3段階6状態（全図と44px主操作）、6部品と原典6引用、16表示条件、字形の注意・背景/拡大/リセット、3破損条件での両画面の停止と復旧、3保存要求と返却3ファイルの全バイト一致、編集20素材/7場面/縦横14状態/任意7.2秒/向き保持/ネイティブrange0.1秒/通常32秒、代表/連続/contactと実MP4の移動、縦横32秒960f無音MP4の全デコードと自然終端、最終ソース62PNG一致と30/31秒静止を新しく確認しました。実機iOS/Safari/VoiceOver・200%拡大、人の審美的承認、字形完全一致・印刷適性・全入力・性能は未確認です。人の審美的な承認、実機のiOS・Safari、すべての環境での同じ絵の再現も未確認です。


## 配布と後工程の確認

確認範囲は visual-verification.json（映像側からは ../visual-verification.json）。作者の11原本を私的に保全した後、制作担当が狭い図の字形ラベル、ノイズの説明用タイルがseed表示と重なる部分、検証失敗時の図の非表示を補正し、新しく表示/描画/再生を確認した。元のMing生成PNG/入力/実行記録は不変。

source.zipはリポジトリのルート配置（examples/ming-image-design-example、mediaの3ファイル、MIT LICENSE）。空の場所へ展開し、そのルートで python -m http.server 8000 を実行して http://localhost:8000/examples/ming-image-design-example/index.html または video/index.html を開く。共通記事サイトは含まない。

紹介図の描画は、展開ルートで npm ci --prefix examples/ming-image-design-example/tools/motion-reel を行い、Chrome/FFmpegを別に用意して python examples/ming-image-design-example/render_visual.py --out ../fresh-portrait --width 720 --height 1280 --strip-at 14.4 を実行する。横は別の空の出力先と --width 1280 --height 720、PNGのみは --stills-only。今回、この公開wrapperへ同じ固定rendererと既存依存を明示指定し縦横62PNG（代表/連続/ポスター/集約画像を含む）を最終動画の正本と照合した。別OS/フォントの同一性は保証しない。Ming画像の再生成とは別の工程。
