# Ryoshuの紹介映像ソース

主版は16:9・1920×1080、32秒・30fps・無音です。サイトの小画面用に、同じ時刻を720×1280へ別配置した版も用意します。

`scene.js`の図形・描画・タイムラインはClaude Opus5.5の出力です。HTML、再生・時刻操作のラッパー、素材と事実データの整理、書き出し・確認・公開は制作担当が担当します。Ryoshu本体や元の100件の推論を今回再生成したものではありません。

統合時に制作担当がCanvasの`willReadFrequently: true`を指定しました。Chromeで原本画像を異なるサイズで描いた後に縮小結果が変わる問題を避け、任意時刻の再描画を一致させるためです。図形の構成とタイムラインは保持しています。

描くのは、PC内のOCR・別のローカルAI・本人の確認・SQLite帳簿・4形式CSVへの流れです。保存済みの架空領収書と実画面を使った図解で、新しく記録した操作動画ではありません。初回のモデル取得にはネット接続が必要です。100件は修正にも使った架空の回帰データです。

## 描画と再生

`window.motionReady`が素材準備、`window.motionConfig`がサイズ・尺・FPS、`window.seek(seconds)`が任意時刻の完成したフレームを表します。プレビューの再生は`controls.js`だけが担当し、書き出し時は停止します。

再生成にはNode.js、Chrome、FFmpegとffprobe、[Motion Reel](https://github.com/studio-yebisu/motion-reel/tree/56198544e69201b1c202e0c00fb90b568a729824)を用意します。この`video`フォルダーを`--project`へ渡します。

```text
node <motion-reel>/scripts/render.mjs --project <video-folder> --out <new-empty-output> --width 1920 --height 1080 --fps 30 --video --step 2
```

縦版は`--width 720 --height 1280`を指定します。音声オプションは付けません。素材とフォントの準備後、任意の順序で同じ時刻を描けることと、実MP4の表示を別に確認してください。

## 出典・条件

- [Ryoshu固定版](https://github.com/studio-yebisu/ryoshu/tree/a163a295f5e87532ef592021cee207adc2a53f6d)
- [100件のテスト画像・検証結果](https://github.com/studio-yebisu/ryoshu/blob/main/docs/testing/README.md)
- コードは[MIT](../LICENSE)。映像はサイトの[クレジット条件](../../../MEDIA-LICENSE.md)に従います。単体フォント・モデルの重み・実在の領収書は同梱していません。

ソースの執筆だけでは描画・映像品質の確認済みとはしません。公開用MP4の検査範囲は記事の制作記録で確認してください。
