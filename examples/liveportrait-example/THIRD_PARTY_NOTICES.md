# 第三者の表示

LivePortrait: KlingAIResearch/LivePortrait, 固定9b294b3d0536135442ea73cb01e6cb3ca7029dd3。Copyright (c) 2024 Kuaishou Visual Generation and Interaction Center / MIT。選択22原典ファイルをrawbytesのままvendor/liveportraitへ同梱し、元LICENSE全文を保持する。元LICENSEにあるInsightFaceの検出モデルは非商用研究限定だが、この作例では取得/ロード/実行していない。原典LivePortraitWrapperのコアAPIのみを別工程で実行した。

選択5コア重み: KlingTeam/LivePortrait@82a4fa6735ca58432b6ce39301b4b9ee066dea47 / 公式モデルカードMIT。公開ungatedのファイルを公式SHAで確認した。重み、環境、全checkout、cacheは配布しない。モデルカード https://huggingface.co/KlingTeam/LivePortrait/blob/82a4fa6735ca58432b6ce39301b4b9ee066dea47/README.md

入力: Leonardo da Vinci「Mona Lisa（モナ・リザ）」の絵画複製。原典のassets/examples/source/s9.jpgを同じバイトで使用した。原作品はパブリックドメインの歴史的絵画。新しい人物写真/録音/AI肖像生成ではない。手動cropとモデルによる派生画像を、元絵/原典ファイルと区別する。固定入力 https://github.com/KlingAIResearch/LivePortrait/blob/9b294b3d0536135442ea73cb01e6cb3ca7029dd3/assets/examples/source/s9.jpg

別途インストールした依存（バイナリを配布しない）: Python3.11.15/PSF, PyTorch2.6.0+cpu/BSD-3-Clause, NumPy1.26.4/BSD系および同梱依存, SciPy1.13.1/BSD系および同梱依存, Pillow11.3.0/MIT-CMU, OpenCV4.10.0.84/Apache-2.0, PyYAML6.0.1/MIT, rich13.7.1/MIT, FFmpeg/libx264（実行版と別工程の圧縮を記録）。元LivePortraitのMIT通知は、これら別依存やInsightFace重みの条件を置き換えない。

制作コード/ページ/文章/図/説明動画: Studio Yebisu / MIT。Claude Opus5.5が指示に沿い執筆し、制作担当が別に環境/原典/実行/事実包装/描画/確認/公開を担当する。Motion Reelの固定MITレンダラーと通知は後工程で同梱する。自動検査は人の審美的承認ではない。
