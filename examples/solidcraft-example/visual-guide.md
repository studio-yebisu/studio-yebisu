# SolidCraftの構造図と無音32秒を描く

SolidCraftはRustのパラメトリック3D CADアプリ/CLI/MCPと、AIが読むmodeling/editing/checkingの3手順書です。手順書と架空依頼を同じ作者へ、作者が書いたコマンドと独立解析予測を別々の道へ、制作担当の実行からCADの値→式→履歴→ボディ→照合→実ファイルへつなぐ説明図です。模式図は説明用、実PNGは元のCAD出力です。ブラウザーでCADやAIを呼びません。

## 新しい32秒を再描画

Python3、Node.js20以上、Chrome、FFmpeg/ffprobeが必要です。初回はtools/motion-reelでnpm install --ignore-scriptsを行います。依存/cacheは配布していません。出力は作例の外の新しい空ディレクトリへ指定します。

```text
python render-visual.py --out ../renders/portrait --width 720 --height 1280 --strip-at 14.4
python render-visual.py --out ../renders/wide --width 1280 --height 720 --strip-at 14.4
```

--stills-onlyは代表/連続/contactだけを描きます。同梱5ファイルのMotion Reelランタイムが31固定素材のbytes/SHA-256と4PNGの展開を待ち、seek(秒)で描画。32秒/30fps/縦720×1280と横1280×720、両方音声トラックなしです。同じ環境の62PNG一致は別OS/フォントや人の承認を保証しません。

## 元の実出力

desk.html#tray-defaultと#tray-resizedに元の保存結果ビューアを残しました。2状態・等角/上面4PNGと実測値、6実ファイルを使えます。JSONは6値/式/3履歴を保つ正本、STEPは基礎ソリッド、STLは三角形メッシュで、STEP/STLに式は残りません。画像は個別自動フィットで共通のピクセル縮尺ではありません。新図の保存は元ArrayBufferのブラウザーへの受け渡しです。ディスク保存完了とは区別します。元ビューアのSTEP1件は取得した12850Bが原本と一致しました。

元のCAD/CLI/MCP/チェッカーの再現はREADME.mdの元制作手順を参照します。必要な実行ファイルは別途公式リリース0.11.1を使います。この構造紹介の再描画にはCAD実行ファイルは不要で、今回も元CAD/25MCP/CLI/モデル/検査スイートを再実行していません。原28秒紹介はvideo/legacy.html、MP4はvideo/legacy.mp4へ保持しました。元44追跡ファイルと元2モデル受領、新8原本受領、制作担当の事実整理/補正/描画/QA/包装を分けています。

## 固定版・条件・確認範囲

参照bherbruck/solidcraft@16c49c3e860a954e9f27309927d6848bcba9c607と元の公式実行0.11.1@b01b9689c8999a4415b4a6daaa2f8aae8a1a2f25は別固定です。参照からビルドした実行ではありません。18元配布CRLFは公式LFとrawbytesが異なり、CRLFだけ正規化した内容/Gitblobが一致。MIT OR Apache-2.0のApache配布として両LICENSE/NOTICEを保持し、実行ファイルや巨大cacheは配布しません。

4値だけ変更し壁/底3mmは固定。同じ3feature履歴、11端点順序/6種類の形/6開き直しが元の確認範囲です。途中値/全組合せ/壁底変更、製造/強度/実印刷/水はけ/人の承認は未確認。上面画像だけで底厚を保証しません。

新しい図/編集/実映像の確認はvisual-verification.json。実機iOS/Safari/VoiceOver/200%zoom、意味/全入力/性能、クリップボード再取得、人の審美的承認は未確認です。自動検査・制作担当の視覚確認・人の承認を区別します。
