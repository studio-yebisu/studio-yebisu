# 第三者の表示

LiveTalking選択27原典: lipku/LiveTalking@eaa2b91559a5c2ed6127e17728efd52b7c407a0d、Apache-2.0。vendor/livetalking/LICENSEと各原ファイルの通知を保持。原process_framesのLiveTalking透かしを残す。

MuseTalk V1.5: TMElyralab/MuseTalk@2bcb936e2fddb4d86db4c62fd45b387d0c061571、MIT、Copyright(c)2024 Tencent Music Entertainment Group。vendor/model-cards/musetalk-LICENSE.txtに原MITと第三者通知を保持。
SD VAE ft-mse: stabilityai/sd-vae-ft-mse@31f26fdeee1355a5c34592e401dd41e45d25a493、MITモデルカード。HF変換Whisper tiny: openai/whisper-tiny@169d4a4341b33bc18d8881c4b69c2e104e1cc0af、Apache-2.0モデルカード。原OpenAI WhisperのMIT通知はMuseTalk LICENSE内に記載。モデルカードは原bytesのまま同梱、重みは同梱しない。

入力画像は以前のLivePortrait作例のportrait-crop.pngと同じbytes。元はKlingAIResearch/LivePortrait@9b294b3d0536135442ea73cb01e6cb3ca7029dd3/assets/examples/source/s9.jpg、レオナルド・ダ・ヴィンチ《モナ・リザ》の複製画。原絵画パブリックドメイン、原リポジトリMIT。新しい人物写真/録画/AI肖像ではない。
入力音声は以前のChatterbox作例のdefault/second WAVと同じbytes。原典resemble-ai/chatterbox@5de7a54aa4e5e2baadb0182dde554908b48b85c2、MIT2025ResembleAI。既存合成の機能出力で、今回の新規TTSや録音ではない。組込みの条件/学習に人由来の声がないとは主張しない。

Python/PyTorch/Torchvision/Transformers/Diffusers/Accelerate/NumPy/OpenCV/Pillow/SoundFile/resampy/PyAV/edge-tts/FFmpegは別途導入した依存で、配布物に含めない。新しいTTS/LLM要求は行っていない。
Motion Reelの再利用5runtimefilesはStudio Yebisu、MIT（tools/motion-reel/LICENSE）。図/UI/記事/映像の新しい執筆と、制作担当の事実整理/実行/包装/検証は制作記録で区別する。統括スキル本文・重み・環境・ログ・認証は非配布。
