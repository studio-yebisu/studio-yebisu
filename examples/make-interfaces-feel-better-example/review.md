# Make Interfaces Feel Better — quick review：納品メモ画面

作例用に Studio Yebisu が作った既存画面（`before/`）へ、固定版スキル（`jakubkrehel/make-interfaces-feel-better` @ `35545ea1512ad59fa463e6b1f95ca9c052981fe6`）の `SKILL.md` と5参照を当てた quick レビューです。意図的に範囲を絞った作例で、スキルの効果を独立に測る研究ではありません。

## Scope and Coverage

- **Mode**：`quick`（主な操作経路と、頻度の高い状態だけ。HIGH/MEDIUM のみ。この依頼では上限を3群に絞る）
- **Exact scope**：`before/index.html`、`before/before.css`、`before/before.mjs` の主経路「カットを選ぶ → 制作メモの有無 → JSONを書き出す」と、その空・読み込み失敗・書き出し後の状態
- **Framework**：なし。HTML + plain CSS（`before/before.css` は1行にまとめた単一ファイル）+ vanilla ES module
- **Styling conventions**：plain CSS。配色 `#f1f0e9` / `#fffefa` / `#375846`、`system-ui, "Yu Gothic"`。修正もこの方式のまま `style.css` に書き、別のスタイル方式・依存は足さない
- **Review boundary**：`export.mjs`（入力→出力の契約）と `clips.json` は対象外で、変更していない。文言・配色・書体・ページ構成は保つ
- **Evidence type**：ソースを読んだだけ。ブラウザー表示、実寸、10%速度の動きは、この段階では見ていない（下の Verification を参照）

| Category | Evidence inspected | Result |
| --- | --- | --- |
| Typography | `before/before.css:1` の `h1`・`.clip-title`・`#totals`・`.clip-time`・`button` の文字指定。`before/before.mjs:9,13` が書き換える数値 | 1群（Tabular numbers）。text-wrap と font smoothing は却下候補へ |
| Surfaces | `before/before.css:1` の `.clip input,.option input`・`input:focus,button:focus`・`.panel`・`button` の寸法と角丸。`before/before.mjs:5-10` の行構造。`before/index.html:6-7` | 1群（Minimum hit area とフォーカス）。角丸は `.panel` の padding 28px が24pxを超えるため別面として扱い、問題なし |
| Animations | `before/before.css:1` の `transition:all .5s`・`button:active{transform:scale(.86)}`・`button.done`。`before/before.mjs:13,15` の `done` クラス操作。keyframes なし | 1群（書き出しボタン）に含める |
| Icons | `before/index.html:7` のダウンロード SVG（`stroke="currentColor"`、`stroke-width="2"`、600の文字の隣） | 太さと `currentColor` は原典どおりで問題なし。状態の手がかりが色だけな点は3群目に含める |
| Performance | `before/before.css:1` の `transition:all .5s`。`will-change` の有無 | 3群目に含める。`will-change` は使われておらず、追加もしない |

依頼側の土台として、所見とは別に足したもの：スキップリンク、見本リンク（`#all` / `#two` / `#one`。実際のチェックを切り替えて計算し直す）、フォームより下の解説欄、修正前後の相互リンク。見た目を磨く目的の追加ではありません。

## Findings

同じ仕組みに関わる指摘を1行へ統合し、全変更を3行にまとめています。個々の修正内容・場所・理由は省略していません。

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| HIGH | `before/before.mjs:5-6`, `before/before.mjs:10`, `before/before.css:1`（`.clip input,.option input{width:16px;height:16px}`）<br><br>`before/index.html:6`, `before/before.css:1`（`.option`）<br><br>`before/before.css:1`（`input:focus,button:focus{outline:none}`、`button{padding:9px 12px}`） | `div.clip` の中の16×16pxのチェックボックスだけが押せる。題名・メモ・時間を押しても切り替わらない。名前は `aria-label` だけ<br><br>`<div class="option"><input id="notes"><span>制作メモを含める</span></div>`。文字と入力が関連付いておらず、文字は14px<br><br>フォーカス表示をすべて消している。書き出しボタンは高さ約38px | 行全体を `<label class="clip">` にしてネイティブの `input type="checkbox"`（20px）を内包。行は縦に積むだけで重ならず、高さは56px以上。名前は `aria-labelledby`＝題名、メモと時間は `aria-describedby`（`app.mjs`・`style.css`）<br><br>`<label class="option">` でネイティブ入力を内包し、高さ48px以上・16px（`index.html`・`style.css`）<br><br>`:focus-visible` に `2px solid #375846`・`outline-offset:3px` を共通で指定。書き出しボタンは `min-height:48px`、「すべて選ぶ」「もう一度読み込む」も44px以上 | **Minimum hit area とフォーカス表示**<br><br>Minimum Hit Area：16pxは44px未満。見えている文字を押しても反応せず、主な操作の的が小さすぎる<br><br>Minimum Hit Area：名前のない入力で、文字を押しても切り替わらない<br><br>SKILL のレビュー手順（focus を含む全状態）と Minimum Hit Area：キーボードで今どこにいるか分からない |
| MEDIUM | `before/index.html:5`, `before/before.mjs:13`, `before/before.css:1`（`#totals{font-size:13px}`、520px以下で `#totals{max-width:100px}`）<br><br>`before/before.mjs:13`<br><br>`before/before.mjs:2` | `"3件 / 06:10"` を1つの文字列で更新。比例数字・13px。狭い幅では100pxで折り返す<br><br>0件のときはボタンを `disabled` にするだけ。理由も戻す操作もない<br><br>`fetch('../clips.json').then(r=>r.json())` を top-level await。失敗すると行は空のまま、ボタンは押せるのに何も起きない | 件数と時間を別の `span` にして `textContent` で更新。`font-variant-numeric: tabular-nums` と `min-width`（ch単位）で幅を予約、15px、折り返さない。各行の時間の列にも `tabular-nums`。チェック操作では動きを付けない<br><br>`role="status"` の欄に「0件のため書き出せません」と理由を文字で出し、その隣にネイティブの「すべて選ぶ」ボタン（44px以上）。押したあとはフォーカスを書き出しボタンへ移す（ボタンが隠れてフォーカスを失わないため）<br><br>`response.ok` を確かめ、失敗したら理由と復旧手順（ローカルサーバーで開く）を文字で出し、「もう一度読み込む」で実際に再取得。仮の行は作らず、書き出しは無効のまま | **Tabular numbers と、空・読み込み失敗の静的な合図**<br><br>Tabular Numbers：変わる数字の幅が揺れ、狭い幅では読みにくい<br><br>SKILL のレビュー手順（empty 状態）と Motion Restraint の「静的な手がかり」：薄くなったボタンだけでは理由が分からない<br><br>SKILL のレビュー手順（loading 状態）：失敗が見えず、押せるボタンが誤解を生む |
| HIGH | `before/before.css:1`（`button:active{transform:scale(.86)}`）<br><br>`before/before.css:1`（`button{transition:all .5s}`）, `before/before.mjs:13`（`classList.remove('done')`）<br><br>`before/before.mjs:15`, `before/index.html:7`（`<span id="status"></span>`）<br><br>`before/index.html:7`（ダウンロード SVG 1つ） | 押すと0.86まで縮む<br><br>すべてのプロパティを0.5秒で補間。書き出し後にチェックを触ると、そのたびに背景が金色から緑へ0.5秒で戻る<br><br>成功の合図は `.done` の色だけで文言なし。失敗時の処理がない。`#status` は常に空<br><br>状態の違いは背景色だけ | `.export:active:enabled{scale:.96}`、`transition-property: scale, background-color`・150ms・`ease-out`。無効中は縮めない<br><br>補間するのは押下の `scale` と hover の `background-color` だけ（150ms）。無効化は `opacity` を補間しないので、チェック操作では動かない。`will-change` は付けない<br><br>状態を `ready / busy / done / error` に分け、`role="status"`・`aria-live="polite"` の欄（高さを予約）に文言を出す。準備中は `aria-busy="true"` と「JSONを準備中」を表示し、`requestAnimationFrame` を1回だけ待ってから、ブラウザー内で Blob と URL を作り、実際のダウンロードを呼ぶ（待ち時間や送信の演出はなし）。成功は「ブラウザーへ渡しました」で、ディスクへの保存完了とは書かない。例外は「書き出せませんでした：理由」。ボタン幅は3つのラベルを同じ grid の升に重ねて固定し、フォーカスは移さない。成功後に選択や設定を変えたら、前のファイルが今の内容と違うことを静的に知らせる<br><br>ダウンロードとチェックの2つの SVG を常に DOM に置き、チェックは `position:absolute`。`scale .25→1`・`opacity 0→1`・`blur(4px)→blur(0px)`・300ms・`cubic-bezier(0.2, 0, 0, 1)` で cross-fade。`stroke="currentColor"`・`stroke-width="2"`（600の文字の隣）。初回表示では補間しない。`prefers-reduced-motion: reduce` では補間と押下の縮みを外し、文言とアイコンの切り替えだけ残す | **書き出しボタン：Scale on press・Transition specificity・状態の合図**<br><br>Scale on Press：0.95未満は大げさ。常に0.96<br><br>Never Use `transition: all` と Motion Restraint：頻度の高い操作のたびに意図しない動きが出る<br><br>Motion Restraint：色の変化だけが合図だと、何が起きたか分からず、保存まで済んだと誤解させうる<br><br>Contextual Icon Animations（motion ライブラリーなしの CSS 方式）と Match Icon Stroke：成功を色以外でも示す |

制作担当の技術調整：高頻度の選択変更で完了アイコンが戻る場面は即時切り替えにしました。書き出し成功時の0.25→1・0→1・blur4→0・300msの補間は保持しています。原典の Motion Restraint を優先した範囲調整です。

## Considered but Rejected

| Location | Candidate | Rejected because |
| --- | --- | --- |
| `before/before.css:1`（`.panel{border:1px solid #d7d9ce}`） | 枠線を layered `box-shadow` に置き換える | 明るい単色の面で、構造を示す区切りとして効いている。直しても LOW 止まりで、quick の範囲外 |
| `before/index.html:3`（`h1`） | `text-wrap: balance` | 見出しはすでに `<br>` で2行に分けており、balance で変わる箇所がない |
| `before/before.css:1`（`:root`） | `-webkit-font-smoothing: antialiased` | macOS だけに効く LOW の調整で、この工程では確かめられない。quick の範囲外 |

## Verification

制作担当が `node verify.mjs` の8条件を実行し、原典を適用した実装を実ブラウザーで確認しました。

- 見本の3/2/1件と06:10/04:35/03:10。数値欄の幅は79pxで一致。
- 修正前と修正後の実JSON4種類を取得し、同じ参照ファイルとバイト一致。制御試験も含め12取得を確認。
- 行の文字を押す操作、Tab・Space・Enterだけの選択、メモOFF、0件の理由と「すべて選ぶ」、書き出しへのフォーカス復帰。
- 320/375/768/1280pxでページ横はみ出しなし。行の高さ82px以上（狭幅では一部104px）、メモ48px、ボタン48px。隣のラベルと重ならない。
- 実色のコントラストは確認記録に値を保存。フォーカスは緑2px・間隔3px。
- 成功時のアイコンの途中と着地、押下0.96を観察。ブラウザーのAnimationsパネルは利用できず、公開版と同じコードに遷移時間だけ10倍の指定を足した専用コピー（10%速度相当）と押下保持クラスを使用。直接のAnimationsパネル再生を実施したという意味ではありません。
- 準備・成功・失敗のボタン幅203px。準備は1か所のawaitを専用コピーで一時停止して確認し、その後は実際にJSONを渡しました。例外は専用コピーでobject URL作成失敗を注入。HTTP503は確認用ルートで返し、仮の行なし・再取得で3件に復旧。通常の画面に待ち時間や故障演出は加えていません。
- 動きを減らす設定では補間0秒。実ダウンロード、文言、静的な成功アイコンは残る。

詳細と実出力のハッシュは [verification.json](verification.json)。確認資料は実装の受領後に制作担当が追記しています。スクリーンリーダー、macOS、全環境、人による承認は **Not verified**。通常の短い準備状態が何ms見えたかは測っていません。

## Verdict

**Approve（このquick範囲のエージェントによる技術・視覚確認）**。上の修正済み3群に、確認範囲内で対応が残る所見はありません。Animationsパネルを使った再生は未実施で、方法を明記した代替観察です。スクリーンリーダー・macOS・全環境・人の承認は未実施。この判定を人による承認や、アクセシビリティ全体への適合と扱いません。
