# Whisper：音声から文と推定時刻、字幕へ

Whisperは音声認識のencoder-decoderモデルとPythonツールです。SKILL.md、TTS、ホスト型APIではありません。元のOpusがrun_transcribe.pyを書き、制作担当がbase/CPU・4スレッドで1回転記しました。入力は作例用の架空原稿をMicrosoft Haruka Desktopで合成した21.014063秒、16kHzモノラルPCM16のWAVです。原稿はinitial_promptに渡していません。今回、音声合成やASRを再実行していません。

図は実音声の波形→実log-Mel特徴→encoder/decoderの構造→5区間の文と推定時刻→SRTをつなぎます。後の原稿参照と手動編集は別の経路です。原出力の誤りを残し、id0/1/4の文だけを原稿に合わせた例を別のSRTへ保存しています。5区間の時刻と数は同じです。原出力SRT441Bと修正例SRT420Bは別の実ファイルです。聴取校正・自動修正・時刻精度の確認とは扱いません。元の編集画面はdesk.html/desk.css/desk.jsに残しています。

波形は実WAVの1600標本/0.1秒RMSで全211窓を再照合しました。色面だけは今回、固定Whisper.audio.log_mel_spectrogramを元WAVに追加適用した前処理です。30秒分のゼロパディング後80×5101から音声の内容80×2101を取り、時間方向を96列に平均し、全体min-maxを表示色へ使います。モデルの読み込み・推論・decodeは行っていません。元ASR内部の活性、attention、信頼度、単語時刻ではありません。モデルの箱は原典model.pyとtranscribe.pyに基づく構造図です。

## 再現

この作例フォルダをHTTPで配信してindex.htmlを開きます。図と編集画面video/index.htmlは26素材のバイト数とSHA-256、区間・修正・原典の引用を照合して描きます。ブラウザー内でWhisperを実行しません。字幕デスクでは元の音声へ移動し、文を編集し、SRT・TXTを保存できます。編集はメモリー内だけで、再読み込みすると消えます。

```powershell
python -m http.server 8080
npm ci --ignore-scripts --no-audit --no-fund --prefix tools/motion-reel
python render-visual.py --out ../whisper-review-portrait --width 720 --height 1280 --strip-at 22.3
python render-visual.py --out ../whisper-review-wide --width 1280 --height 720 --strip-at 22.3
```

Python、Node20以上、Chrome、FFmpegと同梱Motion Reelの依存が必要です。依存は未導入の場合だけ用意します。出力は空の専用フォルダへ。--stills-onlyは代表・連続フレームだけを描きます。新動画は32秒・30fps・無音。機能入力の元WAVは独立したプレイヤーに保ち、音声ガイドを追加していません。原制作のREADME.md/render.py/verification.jsonと旧28秒フレームは履歴として保全し、今回の再現入口はrender-visual.py、確認範囲はvisual-verification.jsonです。

特徴だけを再計算する場合は、固定Whisperとtorch/numpyがある既存環境で次を使えます。これはモデル推論ではなく、保存済みASR出力を変更しません。出力先は存在しないファイルを指定してください。

```powershell
python derive-features.py --audio input/review-ja.wav --waveform video/assets/waveform.json --out features-new.json
```

## 出典と確認の範囲

openai/whisper @86098128c0b4f24f0e2aa2994de830614b474227、20250625。MIT License、Copyright(c)2022 OpenAI。固定READMEはコードとモデル重みの双方をMITとしています。元8原典ファイルと既存14Pythonファイルを公式Gitblob照合し、構造を示す未改変model.py/decoding.pyを追加しています。既存base重みのSHAを再確認しましたが、重み・cache・環境・音声エンジンは同梱していません。独自作例・原稿・コード・図・映像はMIT、Copyright(c)2026 Studio Yebisu。音声素材の扱いはWhisperのライセンスと区別します。

新しいOpusの8執筆原本と、制作側の事実データ・特徴前処理・可読性・編集操作・失敗表示・説明・描画・確認・包装は区別しています。自動照合やエージェントの画面確認は、人による審美的承認ではありません。実機iOS/Safari/VoiceOver、200%ズーム、音声聴取・読みの正確さ・意味的な字幕時刻精度、クリップボード内容の再取得は未確認です。
