# Pretty Mermaid の構造紹介を描画する

今回の32秒紹介は、保存した原制作の構造を説明する新しい無音動画です。元の3つのMermaid記述と12実出力、元1Opus受領とCLI記録を保ち、原モデル/12描画/インストールは再実行していません。親の事実整理・補正・描画・QA・包装・公開を新しいOpusの8原本と分けています。

Node.js20以上、Python3、Chrome、FFmpeg/ffprobeが必要です。初回はtools/motion-reelでnpm install --ignore-scriptsを行います。公開された5ファイルのレンダラーを使います。出力・作業用フォルダーは展開した作例の外へ置きます。

```text
python render-visual.py --out ../renders/portrait --width 720 --height 1280 --strip-at 14.4
python render-visual.py --out ../renders/wide --width 1280 --height 720 --strip-at 14.4
```

--stills-onlyは代表/連続/contactの出力です。既存出力を上書きしない新しい空のフォルダーを指定します。作例を一時コピーしvideo/index.htmlを入口にして、フォントと28素材の全bytes/SHA照合・画像decodeを待ち、seek(秒)で描きます。720×1280/1280×720は別配置で、30fps/32秒/無音です。同一環境のPNG一致を別OS/フォントや人の承認へ一般化しません。

元の読み比べ画面はdesk.html#flow/sequence/state、旧28秒無音編集はvideo/legacy.htmlと元scene.js、旧MP4はvideo/legacy.mp4です。新しい32秒の入口はvideo/index.htmlとrender-visual.pyです。保存ボタンは元ファイルをブラウザーへ渡すだけで、新しくCLI描画しません。

原典imxv/Pretty-mermaid-skills@e234ab73c2992f03c36db04fd55ebb90abca9c45、MIT2026Beautiful-Mermaid Contributors。元7資料はCRLFのまま保全し、公式LFとのrawbytesの違いとCRLFだけ正規化したGitblob一致を区別します。追加のscripts/render.mjs/png.mjs/package.json/package-lock.jsonは公式rawbytes一致です。依存のbeautiful-mermaid/Resvgは配布しません。原典CLIを使うには固定checkout全体とnpm依存が必要です。

SVGはbeautiful-mermaid、PNGは同じSVGをCSS整理しResvgで幅1200にしたもの、文字図は別のrenderMermaidASCIIによるUnicode罫線です。純ASCIIの--use-asciiは未使用。日本語文字図の罫線ずれと単独SVGのGoogle Fonts参照を保持します。原図のSVG/PNGを変更していません。6図種中3/15テーマ中2だけを適用し、架空題材のAPI/申込/保存/ジョブは実行していません。新図の6部品は説明用整理です。

新しい操作/描画/再生の確認はvisual-verification.jsonへ記録します。実機iOS/Safari/VoiceOver/200%ズーム、人の審美的承認、全入力/意味/性能、クリップボード再取得は未確認です。
