# earshot — SHAPE / SOUND

earshot v0.4.0の音バンクから実生成した9音と、その音に合わせた30秒のモーショングラフィックスです。
POP / WHOOSH / HIT / SHUTTER / PITCH / FINALE の6章を、同じ20の合図で描画・再生します。

## 試す

このフォルダーで `python -m http.server 8326 --bind 127.0.0.1` を実行し、`http://127.0.0.1:8326/` を開きます。
再生ボタンで映像と実音を同時再生。下の9音は個別に再生・WAV保存できます。
ブラウザー内でearshotやAIモデルを実行するものではありません。

## 再現

1. [earshot固定版](https://github.com/Leonxlnx/earshot/tree/591fa3e028032e6dce56620a20e932e35667e8d8)をCPU向けPython環境に導入します。
2. 新しい作業フォルダーへ `input/sound-design.json` と `render_audio.py` をコピーします。
3. `EARSHOT_OFFLINE=1` を設定し、その専用Pythonで `render_audio.py` を実行します。既存のassetsがある場合は上書きせず停止します。
4. [Motion Reel](https://github.com/studio-yebisu/motion-reel)のレンダラーで `video/` を描画し、`--audio assets/soundtrack.wav` を渡します。

```text
node <motion-reel>/scripts/render.mjs --project video --out <new-output> --width 1280 --height 720 --fps 30 --video --audio assets/soundtrack.wav
```

縦版は `--width 720 --height 1280`。映像は `window.seek(seconds)` で任意順に描けます。

## 分担と確認範囲

- Opus 5.5: 図形と動きのコード `video/art.js`、カタログ紹介文。
- Codex: 実音の生成、音の配置、プレーヤーと試聴画面、書き出し、検証、掲載。
- 実音: 48kHz・24bit WAV。9音の非無音・形式・DSP監査、E5/G5/B5の音程、whooshの0.8秒とピーク位置0.32秒を確認。
- `assets/render-report.json` は実音の生成記録、`input/sound-design.json` は入力、`video/timeline.json` は共有する合図です。
- 映像の描画・MP4・画面操作の確認は掲載側の制作記録を参照。人による聴感評価や本番採用を示すものではありません。252音全体とfit機能は未検証です。

## 出典と条件

earshot v0.4.0 / commit `591fa3e028032e6dce56620a20e932e35667e8d8`。
コードはMIT、Copyright (c) 2026 Leon Lin。`third-party/earshot-LICENSE` を保持しています。
この作例の音はコードの音バンクから作り、外部録音、BGM、ナレーションは使っていません。
映像・試聴画面の編集コードは同梱LICENSE、完成した掲載動画はサイトの動画利用条件に従います。
