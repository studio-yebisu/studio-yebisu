# 図解動画の元ページ（指示書と原文を、同じAIへ・Humanizer 作例）

Humanizer が「AIに文章の推敲手順を渡す Markdown のスキル」であることと、SKILL.md（6系統・26型と4手順）を原文・読み手・残す条件と一緒に同じ1つのAIへ渡し、印→初稿→点検→最終稿を経て、読み比べと推敲メモにつながるまでを、一つのつながった図で見せる **32秒・無音** の図解動画です。縦 720×1280 と横 1280×720 を、同じ時刻表のまま別々の配置で描きます。Canvas 2D で、指定した時刻の完成した画面を毎回最初から描きます。

- 映像に音はありません。`audioEvents` は空で、音声要素・音の再生・ナレーション・読み上げはありません。
- 例は、点検で1件が残ったサポート返信（`reply`）です。図の中の文の線・印・条件の札・最終稿の文は、すべて照合済みの保存結果から描きます。英語のお知らせと日本語の例は点検の残りがなく、追加の修正はありません（動画では扱わず、作例ページで選べます）。
- 点検で残った1件を §26（F系統）に当てたのは、元の制作AIの解釈です。原典がこの言い換えを例に挙げているわけではありません。
- 映像とコードは claude-opus-5-5 が書きました。推敲そのものは以前の制作で Claude Opus 5.5 が書いた保存結果で、今回やり直してはいません。このページでは AI は動きません。

## ファイル

| ファイル | 中身 |
| --- | --- |
| `index.html` | プレビュー（再生・一時停止・先頭へ・最初から再生・末尾へ、0〜32秒のスライダー、7場面への移動、縦横の切り替え、素材の照合状態） |
| `video.js` | 時刻ごとの値（`filmParams`）、段階の印・見出し・足元、`window.seek`・`window.motionConfig`・`window.motionReady` |
| `video.css` | プレビューの見た目。書き出し時は canvas だけを表示 |
| `storyboard.json` | ブリーフ、7場面の入り・出・時刻・見出し・出典、残り続ける図形 |
| `../app.js` | 作例ページと共通の照合（`loadValidatedAssets`）と概念図の描画（`diagramLayout`・`drawDiagram`） |

## 使う素材と照合

`../concept/manifest.json` を `cache: 'no-store'` で読み、SHA-256 が固定値 `eb2f56d0bb68eeaa28d4089cd79f1ea0f32be88ce323b1e9cd81d1adc25ee417` と一致することを確かめてから、記載の11件をすべて取り直して大きさと SHA-256 を照合します。続けて中身の対応を確かめます。

- 構造の記録：形式・固定版（225a6f39ac85f76ee48dbad772ea4abe4ed6c9d8・3.1.0）・6部分のID・各引用が出典の該当行にあること・6系統の見出しと §1〜§26 の見出しが SKILL.md の該当行と一致すること
- 件数：3件・17条件（7/4/6）・13印・11変更・点検の残り1件
- 3件：`structure.json`・`inputs/jobs.json`・`outputs/revisions.json`・`samples.json` の原文・読み手・条件・印・変更・初稿・点検・最終稿が一致
- 文の対応：初稿は原文から削った文を除いたもの、最終稿は初稿の文に書き換えを当てたもの。英語のお知らせと日本語の例は初稿＝最終稿で残りが空
- サポート返信：答え「Support cannot reopen …」が最初の文、省いた背景は読み手欄の2件だけ、点検の残りは「A workspace owner can …」の1文（§26）、最終稿は「As a workspace owner, you can …」、「Large workspaces may take a few minutes to prepare.」はそのまま
- 条件：原文の引用が原文に、最終稿の引用が最終稿にあり、図の札の語が両方に含まれ、削った文の中にないこと
- 推敲メモ・素材一覧・確認記録・依頼文・原典の固定版と LICENSE

どれか一つでも合わなければ図を描かず（空の紙だけ）、操作をすべて無効にし、見出しの説明も消し、`window.motionReady` は reject します。プレビューでは「もう一度読み込む」で11件をすべて取り直します。一件の取得が失敗した後に、ほかの取得の進み具合が失敗の表示を上書きしないようにしています。

ここに書いた照合は、ページを開くたびに `../app.js` が行う処理の説明です。この README を書いた時点で、ブラウザーでの実行・描画・フレームの確認はしていません。

## 時刻の約束

- `window.motionConfig = {duration: 32, fps: 30, width, height, posterTime: 31, audioEvents: []}`。`window.renderConfig` の幅・高さ・fps があれば初期化時に反映し、幅が高さより大きければ横の配置、それ以外は縦の配置で描きます。
- `window.motionReady` は11件の照合と `document.fonts.ready` を待ちます。
- `window.seek(秒)` は Promise を返し、その時刻の完成した画面を描きます。値はすべて絶対時刻からの閉形式で、前のフレームや呼び出し順・壁時計・乱数に依存しません。描画ごとに変換と状態を初期化し、`save`/`restore` で閉じます。
- 7場面：0〜4・4〜9・9〜14・14〜20・20〜25・25〜29・29〜32秒。最後の場面の入りは28.4〜28.85秒に終わり、29〜32秒は静止します。暗転はしません。
- `window.__MOTION_RENDER__` が真のときは、プレビューの再生・タイマー・イベントを登録しません。自動では再生しません。

場面ごとの入り・出・時刻・出典は `storyboard.json` にあります。

## プレビューを開く

作例のフォルダ（`video/` の一つ上）でローカルサーバーを立てます。SHA-256 の照合に `crypto.subtle` を使うので、`file://` では開けません。

```powershell
python -m http.server 8862 --bind 127.0.0.1
# → http://127.0.0.1:8862/video/index.html
```

## 書き出し（制作側が行う）

制作側が用意する `../render-visual.py`（作例のフォルダに置くラッパー）で、作例の外の空のフォルダへ書き出します。既存の出力は上書きしません。音の指定は付けません。

```powershell
python render-visual.py --out ../humanizer-visual-portrait --width 720 --height 1280
python render-visual.py --out ../humanizer-visual-wide --width 1280 --height 720
# 静止画だけ確かめるとき
python render-visual.py --out ../humanizer-visual-stills --width 720 --height 1280 --stills-only
```

原制作時の `render.py`・`README.md`・`verification.json` は履歴として保持しています。今回の再現には `render-visual.py` と `visual-guide.md` を使います。

## 確認の状態

- 描画・フレーム確認・同じ時刻の再描画の一致・MP4 の書き出しとデコード・再生：**未実施（制作側が後で行う）**
- 縦横それぞれでの文字の大きさ・はみ出し・重なり：**未確認**
- 映像は無音です。人の承認は受けていません。

## ライセンス

映像のコードと文章：MIT License（Copyright (c) 2026 Studio Yebisu）。作例の `LICENSE` を参照。Humanizer は MIT License（Copyright (c) 2025 Siqi Chen）で、原作者による承認や推奨を示すものではありません。型の出典は SKILL.md が示す Wikipedia の「Signs of AI writing」で、この作例は本文を転載していません。

制作側の補正：日本語の「対象と除外」の条件が続く2文にまたがるため、引用の終端まで札を対応付けるよう照合を補正しました。元の入力・結果・17条件は変更していません。執筆時点の未実施欄と、後の制作側の確認記録（../visual-verification.json）は区別します。
