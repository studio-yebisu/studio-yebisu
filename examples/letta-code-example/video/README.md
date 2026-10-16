# 解説動画の編集ソース — 記憶の変更を、保存前に点検する

Letta Code 作例の、28秒・無音・1280×720・30fps の解説動画の編集ソースです。`video.js` が1枚の canvas に、時刻だけから各フレームを描きます。画面のパス・HEAD・stage・原典の診断・件数・L08 の値は、照合した素材の JSON から読みます。

```text
架空の記憶を編集 → 実際の Git の検査が案内の無い変更を止める（L02）
  → 案内を1つ戻した別の試行で、もう一度点検（L03）
  → 保護された設定の変更が止まる（L08）→ 理由を読み、1件を JSON で保存
```

## ファイル

| ファイル | 内容 |
| --- | --- |
| `index.html` | 編集画面（再生・時刻・場面・素材の照合・記録へのリンク）と canvas |
| `video.css` | 編集画面の見た目と、書き出し時に canvas だけを出す指定 |
| `video.js` | 素材の照合、6場面の描画、`window.seek`・`window.motionConfig`・`window.motionReady` |
| `storyboard.json` | 場面ごとの目的・時刻・入る／出る・使う記録の項目、素材8件のハッシュ、作者、確認の状態 |
| `assets/` | 制作側が固定した素材8件と `data-hashes.json`（このフォルダーの担当外。上書きしない） |

## 場面

| 秒 | 主な文 | 使う実記録 |
| --- | --- | --- |
| 0–4 | 記憶の変更を、／保存前に点検する | L02 の基準の commit のファイル、固定版 |
| 4–8 | 案内を消すと？ | L02 の `change.removed`・stage（説明図） |
| 8–12 | 案内がないと／commitは止まる | L02 の HEAD（a1dffad のまま）・stage の2件・原典の診断・スマホの実画面 |
| 12–18 | 1つ戻して、／もう一度点検 | L02 と L03 の入力の差（`bookclub/MEMORY.md` だけ）、L03 の HEAD（a1dffad → 3b8abc2）・パソコンの実画面 |
| 18–22 | APIが通っても／保存できるとは限らない | L08 の検査API（初期方針）エラー0件、`maxFileCharacters` 900 → 1100、原典の検査の終了コード1 |
| 22–28 | 理由を見て、／必要な箇所を直す | 8件のうち commit 2件・予定どおりの停止6件、Node v24.18.0、実行時の照合208件、両方の実画面 |

最後の場面は 23.45秒から28秒まで止まった画面で、約4.5秒読めます。ポスターは13.5秒（L02 と L03 の差と、L03 の成功が出そろった時点）。

L03 は、L02 と `bookclub/MEMORY.md` を戻した1ファイルだけが違う、実行前に固定した別の入力です。モデルや自動修復が直したのではありません。

## 開き方

`fetch` と Web Crypto で素材を照合するため、`file://` では開けません。作例のフォルダー（`render.py` のある場所。公開後は `examples/letta-code-example/`）で次を実行し、`http://localhost:8000/video/` を開きます。

```text
python -m http.server
```

照合が通るまで canvas は描かれず、操作部品は押せません。0秒で止まった状態で始まり、自動再生も音もありません。

## 素材の照合（失敗したら描かない）

`window.motionReady` は次がすべて通ったときだけ解決します。どれかが合わなければ拒否し、canvas を消して隠し、操作を止め、理由と「素材をもう一度読み込む」（実際に取得し直す）を出します。埋め込みの代替データはありません。

- `assets/data-hashes.json` 自体の SHA-256 `7b865fd49e59aa5cf0ecd0786aa05e4eee906fb7f77d2f4314e1e46d59a605e8`、形式、`source_commit`、8件のパス・SHA-256・バイト数が `video.js` の固定値と一致
- 8件それぞれを `response.ok` で取得し、全バイトの SHA-256 とバイト数が一致
- 固定版 letta-ai/letta-code `316e4c0545b549c453e0f85cc81d3540404eff74`・0.34.14・Apache-2.0 が記録とロックで一致、原典8ファイルの一覧が一致、検査スクリプトの SHA-256 `9b815cf928feecc4e830095325983a5ab83d7f284f915807e8de61bbbe075829`、Node v24.18.0・npm の導入0
- L01〜L08 の8件の入力が固定入力と一致し、各リポジトリの pre-commit が原典のスクリプト
- L01・L03 は終了コード0・HEAD が進み stage が空、残り6件は終了コード1・HEAD が変わらず stage が残り、実行前に決めた理由が原典の診断にある。集計2件と6件、期待との照合、208件の確認がすべて通過
- L02 と L03 の入力の差が `bookclub/MEMORY.md` の1ファイルだけで、別のリポジトリ。independent-checks の `repair_pair_diff` と一致
- L08 は検査API（初期方針）のエラー0件、設定の差が `maxFileCharacters` 900 → 1100 だけ、stage に設定の変更が残る
- independent-checks と reproduction-checks（記録全体のバイト一致・成功2件・停止6件）が実行記録と一致
- screens.json の出所と、2枚の元の JPEG の形式と読み込んだ大きさ（375×812・1265×889）が一致。RGB のハッシュは出所として持つだけで、ブラウザーでは計算し直しません

## 書き出し（別の依存）

書き出しは作例のフォルダーで、同梱の Motion Reel のレンダラーを使います。出力先は作例のフォルダーの外の、まだ無い（または空の）新しいフォルダーにしてください。既にある書き出しは上書きしません。

```text
python render.py --out <作例のフォルダーの外の、新しいフォルダー>
```

- 必要なもの：Python 3、Node.js 20 以上、Chrome、FFmpeg と ffprobe。レンダラーの依存は初回だけ `tools/motion-reel/` で `npm install --ignore-scripts` します（Playwright）。
- これは作例の実行（`node run.mjs`）とは別の道具です。`run.mjs` は Node 24 と Git だけで動き、npm の導入は要りません。
- `render.py` は作例のフォルダーを一時フォルダーへ写し、`video/index.html` を `<base href="video/">` 付きでルートに置いてから、`--step 2 --strip-at 8.1 --video` でレンダラーを呼びます。レンダラーは同じ時刻を別の順序と新しいページで描いて PNG の一致を確かめ、静止画・コンタクトシート・連続フレーム・MP4 を出します。
- この一致は同じ実行環境の中での再現性です。別の OS やフォントで同じ画になる保証ではありません。

## 時間の契約

- `window.motionConfig = { duration: 28, fps: 30, width: 1280, height: 720, posterTime: 13.5, audioEvents: [] }`。`window.renderConfig` の幅・高さ・fps を初期化時に使います。
- `window.seek(seconds)` は 0〜28 に収め、その時刻の完成した画面を描いてから解決する Promise を返します。位置と透明度はすべて時刻から計算し、前のフレーム・壁時計・乱数・CSS アニメーションを使いません。
- `window.__MOTION_RENDER__` が真のときは canvas だけを正確な大きさで出し、プレビューの `requestAnimationFrame` は動かしません。
- スマホでは 16:9 の canvas 全体を CSS で縮めます。縦長・正方形の構図は作っていません。

## 確認の状態

制作側が書き出しと確認を終えた現在の状態です。自動検査・エージェントの視覚確認・人の承認は区別します。

| 確認 | 状態 |
| --- | --- |
| レンダラーの実行（静止画・コンタクトシート・連続フレーム） | 制作側で確認済み（詳細はverification.json） |
| 同じ16.8秒を別の順序と新しいページで描いた一致 | 制作側で確認済み（詳細はverification.json） |
| フレームのレビュー（文字・読む時間・遷移） | 制作側で確認済み（詳細はverification.json） |
| MP4 の書き出しと最後までの再生 | 制作側で確認済み（詳細はverification.json） |
| 編集画面の操作（照合・再生／一時停止・時刻・場面・再読み込み） | 制作側で確認済み（詳細はverification.json） |
| 320・390px での横スクロールなし、360px での主な文・件数・流れの読みやすさ | 制作側で確認済み（詳細はverification.json） |
| 実機の iPhone Safari・VoiceOver | 未確認 |
| 人による承認 | 未取得 |

## 範囲

映像が示すのは、固定版 Letta Code の改変していない検査API（`parseMemoryConstraintsConfig`・`validateMemoryTreeConstraints`・`validateMemoryFileFrontmatter`・`detectMemoryFormat`・`isProjectedMemoryPath`）と、原典の `MEMORY_CONSTRAINTS_VALIDATOR_SCRIPT` を実際の Git の pre-commit にして、架空の記憶への8つの変更を8つの別々の新しいリポジトリで試した結果です。

- 初期方針（maxDepth 2・1ファイル900文字・ルートの合計1200文字・persona.md の保護）は、実行前に決めた架空の方針です。試したのは上限を超えた入力（L04 の901文字、L05 の3階層、L06 の合計1201文字）で、ちょうど900文字・1200文字の入力は試していません。
- 使っていないもの：エージェントとの会話、モデルの推論、記憶の自動抽出や想起、Letta Cloud・ログイン・同期、`/init`、実際の利用者やエージェントの記憶。ブラウザーの中で Git や Letta Code は動きません。
- initializing-memory の SKILL.md からは、Harness Constraints・ルートを案内にする構造・「9. Verify」の構造の確認だけを架空の記憶に当てはめています。
- 検査が通ったこと・エラーが無いことは、内容の正しさ、安全性、人の承認を意味しません。L08 の映像は、実際の利用者に承認を求めるものではありません。
- Letta のロゴ・画面・アニメーションは使っていません。図は Studio Yebisu の説明図、画面写真は Studio Yebisu の閲覧ページの実画面です。

## 作者

`index.html`・`video.css`・`video.js`・`storyboard.json`・この README は Claude Opus 5.5（`claude-opus-5-5`）が書きました。架空の入力と期待、実行・照合・素材の固定は制作側が行いました。記録の値はモデルではなく、原典の関数と Git が返したものです。映像の書き出しと確認はこれから制作側が行います。

## 利用条件

- Letta Code（letta-ai/letta-code 0.34.14・コミット `316e4c0545b549c453e0f85cc81d3540404eff74`）：Apache License 2.0（`../vendor/letta-code/LICENSE`）。
- この映像ソース・閲覧ページ・作例のコード・説明文・架空の入力：MIT License、Copyright (c) 2026 Studio Yebisu（`../LICENSE`）。
- `tools/motion-reel/` のレンダラー：MIT License、Copyright (c) 2026 StudioYebisu（`../tools/motion-reel/LICENSE`）。

## 制作側による完成後の確認

28秒・1280×720・30fps・840フレームの無音MP4を書き出しました。代表フレーム・5つの連続フレーム列・360pxの主要文字・終端、別順序と新しいページでの同時刻PNG一致・8素材の全ハッシュ・全デコード・MP4のネイティブ再生終了までを確認。編集画面の初期停止・14秒シーク・再生/停止、320/390pxの操作部も確認しました。これ以前の制作ブリーフ内のpending/未確認は制作時点の計画で、この段落とverification.jsonが完成後の記録です。人による承認と実機iOS/Safari/VoiceOverは未確認です。Pagesと実URLは対象を限定した公開の後に別途照合します。
