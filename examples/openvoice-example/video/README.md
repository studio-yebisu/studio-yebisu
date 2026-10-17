# OpenVoice 作例・解説動画の編集ソース

元の音声と声色の見本が OpenVoice で重なり、変換後の音声になる関係を、1枚の図のまま36秒で動かす映像です。音は制作時に保存した実際の3つの合成音声だけで、ナレーションや音楽はありません。

- 縦 720×1280（本編・iOS向け）と横 1280×720（別版）を、それぞれの画面に合わせて組んでいます。
- 30fps・1080フレーム。ポスターは19.5秒（変換後の音が流れている場面）。
- 場面・音のキュー・素材・確かめていないことは [storyboard.json](storyboard.json) にあります。

## ファイル

| ファイル | 役割 |
|---|---|
| `index.html` | 編集画面（プレビュー・時刻・場面・素材の照合） |
| `video.js` | 映像の本体。時刻 t から1枚の canvas に描く |
| `video.css` | 編集画面の見た目と、書き出し時に canvas だけを出す指定 |
| `storyboard.json` | 場面・音・素材・レイアウト・確かめていないこと |
| `assets/` | 固定した素材8件と `manifest.json`（変更しない） |

## 開く

素材を `fetch` で読み、SHA-256 を Web Crypto で計算するため、作例のフォルダー（`index.html` のある場所）で HTTP サーバーを起動して開きます。

```text
python -m http.server 8000 --bind 127.0.0.1
```

`http://127.0.0.1:8000/video/` が縦版、`http://127.0.0.1:8000/video/?layout=wide` が横版のプレビューです。

## 素材の照合

`assets/manifest.json` の SHA-256 を `video.js` に固定しています。manifest と、そこに並ぶ8件すべての SHA-256・バイト数が合い、さらに次の突き合わせが通ってから `window.motionReady` が完了します。

- 記録（`voice-runs.json`）の原典・モデル・透かしの固定版が、`vendor-lock.json`・`model-lock.json`・`watermark-lock.json` と一致する
- 入力4本と変換3件が `voice-requests.json` と一致し、7本の WAV が `independent-checks.json` の照合と一致する
- `audio-cues.json` の3つのキューが、記録の WAV のハッシュと長さに一致する
- `comparison.wav` の3つのキューの位置を0.1秒ごとの RMS で測り直すと、記録の実測波形と一致する

どれかが合わなければ、映像は描かず、理由と「もう一度読み込む」を出します。編集画面の上に `0 / 8素材` から `8 / 8素材` までの状態が出ます。映像の中にデータの予備や作り置きの波形はありません。

## プレビューの音

「再生」を押したときだけ、照合済みの `comparison.wav` を鳴らし、その再生位置に映像を合わせます。時刻のスライダー・場面のボタン・「先頭へ」は再生を止め、音は自動では始まりません。「消音」で音だけを消せます。

書き出し（`window.__MOTION_RENDER__` が真）のときは、プレビューの時計も音も動かしません。

## 任意時刻の描画

`window.seek(t)` は時刻 t の完成した画を描き、Promise を返します。前のフレームの状態・乱数・壁時計・CSS アニメーションを使わず、同じ t なら呼び出しの順番やページの新旧に関係なく同じ画になるように書いています。フォントは `document.fonts` で読み込みを待ってから描きます。`window.renderConfig` の幅・高さ・fps を初期化時に使い、縦長なら縦版、横長なら横版の配置を拡大・縮小して中央に置きます。

`window.motionConfig` の既定は `{duration: 36, fps: 30, width: 720, height: 1280, posterTime: 19.5, audioEvents: []}` です。

## 書き出す

作例のフォルダーにある `render.py` が、作例を使い捨てのフォルダーへ写し、同梱の `tools/motion-reel/render.mjs`（Motion Reel・Node.js 20 以上・Chrome・FFmpeg が必要）で描きます。出力先はこのフォルダーの外の、空の新しいフォルダーにします。既存の書き出しは上書きしません。

```text
python render.py --out OUTSIDE_EMPTY_DIR_TALL --width 720 --height 1280 --audio video/assets/comparison.wav
python render.py --out OUTSIDE_EMPTY_DIR_WIDE --width 1280 --height 720 --audio video/assets/comparison.wav
```

`--width`・`--height`・`--audio` は `render.py` が Motion Reel へ渡す指定です。音は同じ `comparison.wav` を使い、Motion Reel が音量を整えて AAC にします。元の WAV は変わりません。

レンダラーは同じ時刻を別の順番と新しいページで描き、PNG の一致を記録します。これは同じ実行環境の中での再現性で、別の OS やフォントで同じ画になる保証ではありません。

## 確かめていないこと

- 書き出し・フレーム・MP4再生は完成後に確認しました。音声の聴取、人による承認、実機iOSは未確認です。公開URLは配信後に別途照合します。
- 透かし（WavMark・目印 SYEBISU!）は保存した WAV から読み出せましたが、動画の AAC 音声に残るかは確かめていません。
- 実機の iPhone の Safari・VoiceOver での確認はしていません。

## 利用条件

映像のコードと文章は Claude Opus 5.5 が書いたもので、MIT License（Copyright (c) 2026 Studio Yebisu）です。図の構成案は Studio Yebisu の制作側によるものです。声色の変換は OpenVoice（MIT）、元の音声と見本は Irodori-TTSです。Motion Reel のレンダラーは MIT License です。


元音声のTTSは Aratako/Irodori-TTS-v4.1-Small 2b28324dc263ed5e6638b3cf3dd94c82ead07b4b、MITです。コードの固定版・重みのハッシュはtts-lock.json、利用条件と倫理制約はvendor/irodori-metadata/MODEL_CARD.mdに残しています。参照なしのオリジナル合成声で、実在者の声を模していません。内部IDとファイル名ichiro/sayakaは初稿からの識別子で、Windows音声を使用している意味ではありません。制作側がTTS素材・実変換・波形・ハッシュ・短い声色ラベルを差し替え、Opus5.5が制作した図の動きは保持しています。動画の小さい選択チップは「穏やか」「明るい」と短く表示します。


## 書き出し後の確認

36秒の縦版・横版を30fpsで書き出し、代表フレーム・連続フレーム・360px表示・終端、任意時刻の別順と新ページのPNG一致、全デコードとブラウザーでのMP4再生終了を確認しました。合成音声の聴感、人による最終映像承認、実機iOS/Safari/VoiceOverは未確認です。

公開後のURL・全ファイル一致は、限定したcommitのPages配信後に別途確認します。新TTS版の実入力WAVと変換後WAVは、その実行後から無変更。編集音声は実音声3区間の非重複配置、見本のみ末尾20msフェード、書き出し時に音量調整・AAC圧縮を行っています。AAC後の透かし検出は未確認です。
