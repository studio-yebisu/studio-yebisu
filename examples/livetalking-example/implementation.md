# LiveTalking 実装メモ（livetalking-example）

## 位置づけ

- **LiveTalking**（lipku/LiveTalking@eaa2b91、Apache-2.0）は、音声とテキストで数字人をリアルタイムに動かすストリーミングエンジン。モデルそのものではない。
- この例で動かすのは、その中の **MuseReal + WhisperASR + BaseAvatar** によるオフライン描画部分だけ。使うモデルは **MuseTalk V1.5 の U-Net**、**SD VAE ft-mse**、**Whisper tiny のエンコーダ**の 3 つ。
- 実行しないもの: app.py、HTTP サーバー、WebRTC 接続、RTMP、仮想カメラ、livechat、LLM。Wav2Lip / UltraLight / ernerf は選んでいないので、Wav2Lip の利用条件はここで実行するモデルには関係しない。
- 役割分担: 4 ファイル（`prepare_input.py`、`run_example.py`、`inputs/jobs.json`、本書）は actor（Claude Opus 5.5）が書いた。実行は operator が別に行う。書いた時点では一度も実行しておらず、測定値はまだない。

## 入力（既存の保護ファイルのみ）

- `inputs/portrait.png`: 以前の LivePortrait 例で使った 512×512 RGB のモナ・リザ切り抜きを、バイト単位でそのまま再利用。原画はパブリックドメイン。新しく作った肖像ではない。
- `inputs/default.wav` / `second.wav`: 以前の Chatterbox（MIT）の英語出力を再利用（24 kHz、モノラル、PCM16、4.64 秒 / 5.16 秒）。新しい TTS・録音・ASR は行わない。`jobs.json` にある文は、元の TTS に入力した文を記録したものにすぎない。
- この音声は口元を動かすための入力であって、ナレーションではない。2 本は発話も長さも違うので、効果や品質を比べる対照実験ではない。

## 手動準備（`prepare_input.py`）

- 手動で決めた顔の枠 `[100,40,420,360]`（320 px の正方形）を切り出し、OpenCV の INTER_LANCZOS4 で 256 px に縮小して `face256.png` にする。
- `mask320.png`: 0〜159 行目が黒、160〜171 行目が 0→255 の線形グラデーション、172〜319 行目が白の 3 チャンネル画像。手動で決めた下半分用の合成マスクであって、ニューラルな顔解析ではない。
- 顔検出・ランドマーク・genavatar は使わない。枠・マスク・処理手順・ハッシュ・寸法はすべて `preparation.json` に記録する。保護入力は書き換えない。出力の下地には 512 の原画全体を使う。

## 原本サブセットとデータの流れ

1. **モデル読み込み（2 ジョブで 1 回だけ）**: 原本の `load_all_model` に絶対パスと CPU を指定し、float32 のまま読み込む。全部を half にキャストする `load_model` は使わない。続いて `Audio2Feature`、返り値の `PositionalEncoding`、`timesteps=[0]` を用意する。拡散のサンプラーループはない。各モデルは eval にし、`requires_grad=False` にする。
2. **画像の経路**: 原本の `VAE.get_latents_for_unet` を seed 20261020 の下で 1 回だけ呼ぶ。上半分をマスクした画像と全体画像からそれぞれ事後分布をサンプルし、得た latent `[1,8,32,32]` を private に保存して 2 ジョブで共有する。
3. **音声の経路**: 原本の `put_audio_file` が 16 kHz に変換した音声を 320 サンプル（20 ms）ずつ区切る。320 に満たない末尾は捨てられ、その長さは測って記録する。パディングはしない。`WhisperASR.run_step` が 8 チャンクごとに Whisper エンコーダの特徴を作り、1 フレームあたり 50×384 にする。
4. 2 つの経路が合流して、原本の U-Net（timestep 0）→ VAE デコード → `paste_back_frame`（手動マスクでの合成）と進む。結果は `res_frame_queue` に「画像 1 枚 + 音声 2 チャンク」の組で入り、`process_frames`（原本の「LiveTalking」透かし付き）を経て `WebRTCOutput` に push される。
5. **オフライン捕捉**: 原本の `WebRTCOutput` オブジェクトの `_player` に `DiskCaptureAdapter` を差し込み、実際に出てきた 512 BGR フレームを PNG に、int16 音声を 16 kHz の WAV に保存する。これを FFmpeg（H.264 yuv420p、faststart、AAC）で MP4 にまとめる。
   - 偽の推論ではなく、WebRTC 配信を主張するものでもない。RTCPeerConnection もサーバーもネットワークも使わない。
   - `get_buffer_size()` は常に 0 を返すので、実時間に合わせたペース調整はかからない。

## ウォームアップ・無音・境界（推測ではなく測定する）

- `BaseASR.warm_up` の後、出力キューの先頭には r=10 チャンク（200 ms、5 フレーム分）の無音が残る。ジョブごとに作る `MuseReal` について、この状態を観測して記録する。
- `target_frames = ceil((r + floor(16kサンプル数/320)) / 8) * 4`。計算に使うサンプル数は、原本の変換関数そのもので測る。前後の無音もバッチの区切りも捕捉したまま残し、切り詰め・ずらし・選び直しはしない。
- 8 チャンクがすべて無音のバッチはニューラル推論を通らない。2 チャンクとも無音のフレームは、原本の無音ブランチがキャッシュした全体画像（+透かし）になる。0 番目のフレームはこの無音ブランチの出力で、ニューラル生成ではない。
- 各チャンクの由来（入力 / それ以外）は、原本の `datainfo` 引数で付けたタグで観測する。U-Net・VAE・Whisper への呼び出しは、値を変えない forward hook で数と時間だけを記録する。目標を過ぎてから処理中だった分も記録する。捕捉したフレーム数と推論したフレーム数は同じものとして扱わない。
- 停止は、目標の組（画像 1 枚 + 音声 2 チャンク）を捕捉した後、原本の `quit_event` で行う。ワーカースレッドの例外・タイムアウト・フレーム欠落を検出したら、途中までの結果を残して失敗として終了する。再試行はしない。
- `EdgeTTS` は原本のコンストラクタが作って待機させるだけで、メッセージは一度も送らない。
- アバターは毎回原本の `load_avatar` で読み直す。透かしがキャッシュ画像に直接書き込まれるので、それが次のジョブに持ち越されないようにするため。

## ライセンスと再配布

- LiveTalking 本体: Apache-2.0。MuseTalk: MIT。sd-vae-ft-mse: MIT。whisper-tiny: Apache-2.0（Hugging Face のモデルカード）。既存の音声: Chatterbox（MIT）の出力。絵画: パブリックドメイン。
- 原本の「LiveTalking」透かしは消さずに残す（README の声明に従う）。
- 重み、依存パッケージ、フルチェックアウト、private のログ・全フレーム・latent は再配布しない。
- 依存環境は operator が指定した専用環境を使う（Python 3.11.15、torch 2.6.0+cpu など）。upstream の `requirements.txt`（例: soundfile==0.12.1）とは一致しない。

## 再現（相対パス / プレースホルダー）

```
python prepare_input.py --input inputs/portrait.png --output inputs/prepared
python run_example.py --upstream <livetalking-source> --weights <models-root> \
  --jobs inputs/jobs.json --prepared inputs/prepared \
  --output <public-attempt-dir> --private <private-attempt-dir>
```

オフライン環境の用意と、4 コアへのプロセスアフィニティの設定は operator が行う。

## 未検証・主張しないこと

- 人による試聴、見た目の良さ、口の動きと音声の一致、自然さ、本人らしさ、実時間性能、ほかの入力での挙動。
- CPU で 1 回動かしただけなので、ベンチマークではない。MP4 として保存できても、同期が取れている証拠にはならない。
- 新しい UI、フィルム、記事、QA は後の工程で扱う。ここでは何も主張しない。
