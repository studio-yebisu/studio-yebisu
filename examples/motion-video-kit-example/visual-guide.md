# Motion Video Kit の構造紹介を描画する

今回の32秒紹介は、保存した原制作の構造を示す新しい無音動画です。元の20秒作品film.mp4、2つの4秒部品、元の独立AIレビューとfrozen-time測定は再実行しません。元7受領と新しい紹介のOpus5.5受領は別です。親の事実整理/技術補正/描画/QA/包装も区別します。

Node.js20以上、Python3、Chrome、FFmpeg/ffprobeが必要です。初回はtools/motion-reelでnpm install --ignore-scriptsを行います。公開された5ファイルのレンダラーを使います。出力と作業用のフォルダーは、この展開ソースの外に指定してください。

```text
python render-visual.py --out ../renders/portrait --width 720 --height 1280 --strip-at 14.4
python render-visual.py --out ../renders/wide --width 1280 --height 720 --strip-at 14.4
```

--stills-onlyは代表/連続/contact用です。出力先は空の新しいフォルダーにします。video/index.htmlをルートに据えた一時コピーを作り、フォントと25固定素材の検証を待ってから、seek(秒)で各フレームを描画します。音は指定しません。横は同じ縦画像の縮小ではなく別の配置です。同一環境のPNG一致は別OS/フォントの完全一致や人の承認ではありません。

実作品はdesk.html#studio-intro、元の編集はfilm/index.html、元部品はlab/です。旧22秒紹介はvideo/legacy.htmlとvideo/legacy.mp4へ保全。元のrender.pyのexplanationも旧22秒入口を参照します。新32秒はrender-visual.pyを使います。原作品の元レビューSHIPは今回の図の採点ではなく、元の静止5.5秒/最長1.7秒は数値目安未達です。

原典:echris6/motion-video-kit@e4b1c0004080fe6a0deb883631bad5eba1e5f339、MIT2026echris6。18同梱資料の固定公式rawGitblob一致を確認。6部品は説明用整理。原典28参考映像は未視聴で文章分析のみ。音/AI生成素材/Three.jsは未適用。公開パッケージにモデルログ/認証/cache/依存本体を含めません。
