# 図解動画「AIに、小さな開発手順を渡す」の元ページ

Addy Osmani Agent Skills 作例の、32秒・無音の図解動画を描く編集できるソースです。作例ページ（`../index.html`）と同じ概念図を `../concept.js` から読み込み、同じ形（選び方の地図と3つの束・依頼と旧TODOの紙・AIが書く机・SPEC.md の6領域・人の承認なしの札・2枚の増分カード・制作担当のNode・テストと変更の紙・境界の反転の箱・6枚のTODOの紙・selectTasks の口・返った紙・保存したJSON・元のTODO）を時刻に合わせて動かします。

## Agent Skills とは

[addyosmani/agent-skills](https://github.com/addyosmani/agent-skills/tree/aeac41d4d005999432bb7312f7ff06383a91d59d) は、AIエージェントが読む、工程別の開発手順のMarkdown集です。モデルやAPI、自動の流れ作業ではなく、7つのAIが自動で動く仕組みでもありません。using-agent-skills は工程に合う手順を選ぶための地図です。この作例では、地図と6つの手順（仕様・計画・増分・テスト・点検・画面）の合わせて7つを選び、架空のTODOに「指定日までの期限の絞り込み」を1つ足す作業に、手順の一部として使いました。

図の「決める・進める・確かめる」の3つの束は、この作例の説明のための分け方で、原典の分類ではありません。

## 映像の要点

- 縦 720×1280（主）と、配置を作り直した横 1280×720。30fps・960フレーム。横は縦を縮めたものではなく、横長の図の配置（3段×4列）で描きます。
- 7場面：0・4・8・13・18・23・29秒。最後の動きは28.9秒で終わり、29〜32秒は静止。ポスターは31秒。点滅するカーソルなどはありません。
- 例は「未完了」（`due-open`）。状態 open・期限 2026-10-15 で、元の関数が返した2枚と、旧関数の4枚を描きます。
- 音はありません。`audioEvents` は空で、ナレーション・音声ガイド・読み上げ・原稿・音源・WebSpeech・WebAudio はありません。

## 何が実際の結果で、何が保存記録か

| 図の中のもの | 由来 |
|---|---|
| 返った紙（紫紺の日付印）と「旧関数 4枚」 | 読み込み時に `../tasks.mjs` と `../baseline/tasks.mjs` を実際に import し、`../seed.json` の6件と保存済みの3つの入力で `selectTasks` を1回ずつ呼んだ戻り値。返ったオブジェクトは入力の6件と同じ参照で、その紙をそのまま動かします。3件すべてで順序が `../results.json` と一致しなければ描きません。新しいNodeテストの記録ではありません |
| RED・GREEN の数（3→4→5件、各増分の失敗1件） | 元の制作で制作担当が Node v24.18.0 で実行した5回の記録（`../tdd-history.json`）。ここでは再実行しません |
| 境界の反転（1件失敗→戻して5件成功） | 元の制作担当の記録（`../mutation.json`）。18〜23秒の動きはこの記録を絵にしたもので、新しく反転を実行してはいません。テストした境界を見抜けることを示すだけで、品質全般の保証ではありません |
| 5軸点検 必須0 | 元の制作で、著者とは別の Codex の親が1回行った点検の記録（`../core-review.json`）。5人の点検者や並列の子AIではありません。この映像・新しい図の点検でも、人の承認でもありません |
| 仕様の6領域・前提11個・計画の空のチェック欄 | `../SPEC.md`・`../plan/plan.md`・`../plan/todo.md` から読んだ値 |
| 「人の承認なし」の札 | 原典にある人の確認の段を、この作例では行っていないことの印。通過の印ではありません |
| 「AIが書く」 | 元の Opus 5.5 の別々の実行をまとめて表す1つの机。受領記録は6件（仕様・RED1・GREEN1・RED2・GREEN2・画面）で、計画だけの受領記録はありません。AIがNodeを動かしたことを示すものではありません |

フレームごとに関数を呼んだり、推論やテストを走らせたりはしません。

## ファイル

| ファイル | 役割 |
|---|---|
| `index.html` | 元ページ。キャンバス `#film`、準備の状態 `#asset-status`、操作（再生・先頭へ・最初から再生・末尾へ・0〜32秒のスライダー `#time` と `#clock`・7場面へ移るボタン・縦／横の `button[data-orient]`） |
| `video.js` | 時刻 t の画面を描く。`window.motionConfig`・`window.renderConfig`・`window.motionReady`・`window.seek` |
| `video.css` | 元ページの見た目と、書き出し時にキャンバスだけを出す表示 |
| `storyboard.json` | 場面ごとの「伝わること・入る状態・出る状態・時刻」、使う素材、縦横の配置、範囲と限界 |
| `scene.js`・`scene.css`・`legacy.html` | 以前の28秒の映像ソース。参照用に残しています |

## 時間の契約（Motion Reel）

- `window.motionConfig = {duration: 32, fps: 30, width, height, posterTime: 31, audioEvents: []}`。
- `window.renderConfig` の `width`・`height`・`fps` を初期化時に反映します。幅が高さより大きければ横の配置で描きます。大きさが渡されたときは、縦／横の切り替えボタンを使えなくします。
- `window.motionReady` は、フォントの準備、32件の素材の照合（大きさ・SHA-256・中身の対応）、元の関数の実際の呼び出しと保存記録との一致がすべて済むと解決します。どれかが失敗すると拒否され、描画と操作を止めます。「もう一度読み込む」で32件をすべて取り直します。
- `window.seek(seconds)` は、指定時刻を最も近いフレームにそろえ、その時刻の完成した画面を描いてから解決するPromiseを返します。呼んだ順番や壁時計、前のフレームには依存しません。乱数は使いません。
- `window.__MOTION_RENDER__` が真なら、プレビューのタイマーと操作を使わず、キャンバスだけを表示します。

## 開き方と書き出し

素材を `fetch` し、元の関数をES modulesとして読み込むため、作例のフォルダ（`index.html` があるフォルダ）をローカルのHTTPサーバーで配信して開きます。`.mjs` を JavaScript の種類で返すサーバーを使ってください。ファイルを直接開くと読み込みが止まり、図は描かれず、もう一度読み込むボタンが出ます。

```bash
python -m http.server 8000 --bind 127.0.0.1   # http://127.0.0.1:8000/video/index.html
```

書き出しの手順と必要な環境は、梱包時に制作担当が付ける `../visual-guide.md` に記します。作例ページの動画は、縦が `../../media/addy-engineering-skills-example.mp4`（ポスター `../../media/addy-engineering-skills-example.webp`）、横が `../../media/addy-engineering-skills-example-wide.mp4` を参照します。

## 確認の状態

このソースは claude-opus-5-5 が執筆した時点で、次のどれも行っていません。

- ブラウザでの表示（作例ページ・この元ページとも）
- 32件の照合と、元の関数の呼び出しが実ファイルで通るかの確認
- フレームの書き出し、MP4の作成、映像の目視確認
- 375×812・320×812・横長での配置、キーボード操作、読み上げ、ライト／ダークの確認

実際の確認記録は、梱包時に制作担当が `../visual-verification.json` へ残します。これは技術的な確認で、人の承認ではありません。原本の執筆と、後の描画・QAを分けて扱います。

## 元の作例の保全

- 元の作例のファイル、以前の表示の2件（`../desk.html`・`legacy.html`）、`../app.mjs`・`../guide.mjs`・`../style.css`、以前の `scene.js`・`scene.css`、原典、計画、記録、32件の固定素材は、この改修で変更しません。`../tasks.mjs`・`../baseline/tasks.mjs` も元のバイトのままです。
- 計画のチェック欄は原本のまま空です。完了の印を後から付けていません。

## 出典と利用条件

- 原典：[addyosmani/agent-skills](https://github.com/addyosmani/agent-skills/tree/aeac41d4d005999432bb7312f7ff06383a91d59d)、コミット `aeac41d4d005999432bb7312f7ff06383a91d59d`。MIT License、Copyright (c) 2025 Addy Osmani（`../vendor/addy-agent-skills/LICENSE`）。
- この元ページ・図・文言：MIT License、Copyright (c) 2026 Studio Yebisu（`../LICENSE`）。

制作側の再現入口は作例ルートのrender-visual.py。`python render-visual.py --out ../addy-review-portrait --width 720 --height 1280 --strip-at 10.2`、横は1280×720。空の出力先を使います。詳しくは../visual-guide.md、実際のQAは../visual-verification.json。執筆時点の未検査と後の制作側QAを区別します。
