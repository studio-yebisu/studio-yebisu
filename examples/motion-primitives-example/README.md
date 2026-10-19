# しおり工房 検索ヘルプ — Motion Primitives 作例

作例用の架空のアプリ「しおり工房」の手順書6件を、ブラウザーの中で検索し、[Motion Primitives](https://github.com/ibelick/motion-primitives/tree/120f64f6ca60348e251f929e9c81f11ccbe45eda) の Accordion で結果を1件ずつ開閉する静的な画面です。動きを抑えても、同じ文と操作が残ります。

- 検索と開閉は、このページの JavaScript だけで動きます。AI、サーバー検索、API、アカウントは使いません。
- 手順書は保存済みの `input/articles.json` ですが、検索・開閉・動きの切り替えは、開いたブラウザーでその場で動きます。録画や画像の再生ではありません。
- 手順書の文はこの作例のために書いたものです。実在の製品やサービスの操作ではありません。

## 試す順番

1. 開くと6件が並びます。検索欄に `書き出し` と入れて「検索」を押す（または「「書き出し」で検索」を押す）と、「PDFを書き出す」と「画像を書き出す」の2件になります。
2. 「PDFを書き出す」の見出しを押すと本文が開きます。「画像を書き出す」を押すと、PDF のほうが閉じて画像のほうが開きます。同じ見出しをもう一度押すと閉じます。開くのは一度に1件だけです。
3. 「動きを抑える」をオンにして、同じ操作をします。開閉は0秒で切り替わり、矢印も回りませんが、見出し・本文・タグと操作は同じです。OSの「視差効果を減らす／動きを減らす」設定がオンなら、ページのスイッチに関係なく抑えた表示になります（このページから OS の設定は解除できません）。
4. 「この表示をJSONで保存」を押すと、今の検索語、一致した手順書の id、開いている id、動きの設定（実際の状態・OS の設定・ページの設定）、表示中の手順書の中身が JSON ファイルとして保存されます。
5. 一致しない語で検索すると0件と表示され、「検索をリセットして全件を表示」で6件に戻ります。

入力中の語は、「検索」を押すまで結果に反映しません。打っている途中で一覧が並び替わらないようにするためです。検索の後は、それまで開いていた結果を閉じます。

## 入力データ（input/articles.json）

`{title, scope_note, records:[{id, title, category, summary, body:[段落2つ], tags}]}` の形です。

| id | 題名 | 分類 | 内容 |
| --- | --- | --- | --- |
| `export-pdf` | PDFを書き出す | 書き出し | ページ範囲と塗り足しを確かめて、印刷や配布用の PDF を作る |
| `export-images` | 画像を書き出す | 書き出し | PNG と JPEG の選び方と、長辺のピクセル数で大きさをそろえる方法 |
| `input-materials` | 素材を読み込む | 準備 | 原稿と写真をフォルダーごと取り込み、解像度の低い写真を組む前に見つける |
| `review-comment` | 確認のコメントを残す | 確認 | 付せんに直す人を付け、直し終えた印を残して見落としを確かめる |
| `name-files` | ファイル名をそろえる | 整理 | 「日付_冊子名_版」の順で、新しい版を迷わないようにする |
| `share-link` | 閲覧用のリンクを渡す | 共有 | 編集できない閲覧用リンクを作り、有効期限と停止で管理する |

「書き出し」という語は `export-pdf` と `export-images` の2件だけに含まれ、ほかの4件の題名・分類・要約・本文・タグには含まれません。

## 検索の決まり

- 検索語と、各手順書の題名・分類・要約・本文・タグを、Unicode の NFKC 正規化と小文字化でそろえます（全角英数と半角英数、大文字と小文字を区別しません）。
- 空白で区切った語は、すべてを含む手順書だけに絞ります（AND）。
- 空の検索では6件すべてを表示します。

## 原典の部品と、この作例での改変

原典は ibelick/motion-primitives の固定コミット `120f64f6ca60348e251f929e9c81f11ccbe45eda` です。Motion Primitives は npm パッケージや Agent Skill ではなく、部品のソースを自分のプロジェクトに写して読み込み先を直す部品集です（原典の説明 `app/docs/accordion/page.mdx` の Manual の手順）。原典の CLI での導入は使っていません。

- `vendor/motion-primitives/accordion.original.tsx` … 原典 `components/core/accordion.tsx` をそのまま保存したもの
- `vendor/motion-primitives/utils.ts` … 原典 `lib/utils.ts`（`cn` = `twMerge(clsx(...))`）をそのまま保存したもの
- `vendor/motion-primitives/LICENCE.md` … 原典のライセンス（最終行の `app/page.tsx` も原文のまま）
- `src/accordion.tsx` … 上の accordion を写し、次の点だけを変えたもの

`src/accordion.tsx` の改変点：

1. `import { cn } from '@/lib/utils'` を `import { cn } from '../vendor/motion-primitives/utils'` に変更。
2. `AccordionItem` が子に渡す `value` と `expanded` の型 `AccordionItemInjectedProps` を足し、`React.isValidElement(child)` を `React.isValidElement<AccordionItemInjectedProps>(child)` に変更（TypeScript の strict で型を付けるためで、`cloneElement` で渡す中身は同じ）。
3. `AccordionTriggerProps` に任意の `id`・`aria-controls`・`value` を追加し、`id` と `aria-controls` を `<button>` に渡す。`value` の読み方（`props` から読む）とクリックで `toggleItem` を呼ぶ動きは原典のまま。
4. `AccordionContentProps` に任意の `id`・`role`・`aria-labelledby` を追加し、`motion.div` に渡す。

`'use client'`、`AccordionProvider` の制御／非制御の切り替えと `toggleItem`、`Accordion` の `MotionConfig transition`、`AnimatePresence initial={false}`、`motion.div` の `collapsed`／`expanded`（`height: 0 / 'auto'`、`opacity: 0 / 1`）と `variants` の合成は変えていません。

## アプリ側での使い方（src/app.tsx）

- `<Accordion expandedValue={…} onValueChange={…} transition={…}>` の制御された形で使い、開いている id を React の状態として持ちます。検索、リセット、一覧から消えた結果のときは閉じます。
- `AccordionItem` は直接の子に `value` と `expanded` を差し込みます。見出しを `<h3>` で包むため、`ResultHeading` という包みが差し込まれた `value` を受け取り、中の実際の `AccordionTrigger` にそのまま渡します。`expanded` は、パネルがあるときだけ `aria-controls` を付けるために使います。
- ボタンの id は `guide-trigger-<id>`、パネルの id は `guide-panel-<id>` です。パネルは `role="region"` で、見出しのボタンを `aria-labelledby` で指します。パネルの中は文とタグだけで、閉じる途中にフォーカスできる要素は残りません。
- 開閉はボタンの標準の Enter・Space・クリックで動きます。見出しのボタンにフォーカスがあるときだけ、修飾キーなしの ↑↓・Home・End で表示中の見出しの間を移動します。検索欄のキー操作は変えません。
- 通常は `transition={{ duration: 0.18, ease: 'easeOut' }}`、動きを抑えるときは `{ duration: 0 }` を渡します。外側の `MotionConfig reducedMotion` も `always`／`never` で切り替えますが、高さと透明度の変化は reducedMotion だけでは止まらないため、0秒の transition を別に渡しています。0.18秒は見た目の設定で、測った応答時間ではありません。
- 動きを抑えるかどうかは「OS の `prefers-reduced-motion: reduce`」または「ページの『動きを抑える』」で決まります。OS の設定は `matchMedia` の change で開いている間も追従し、画面を閉じると監視を外します。
- 状態を確かめるため、画面に次の data 属性を出しています。実行の証明として作った値ではなく、そのときの画面の状態をそのまま出すものです：`.app[data-ready]`（読み込み成功で `true`）、`.results[data-query][data-expanded-id]`、`.mode-status[data-reduced][data-os-reduced][data-manual-reduced]`、`.result-row[data-record-id]`。
- CSS は Tailwind をビルドせず、`style.css` に自前で書いています。原典の部品が付ける `relative`・`overflow-hidden`・`group` は、その意味どおりの最小限の CSS を定義しています。見出しの矢印の回転は CSS だけで、マウスなどの細かいポインターがあり動きを抑えていないときにだけ短く動きます。

## 固定した依存

`package.json` と `package-lock.json` で版を固定し、esbuild で `assets/app.js` 1つにまとめます。ページは CDN・リモートのフォント・解析ツールを読み込みません。

| パッケージ | 版 |
| --- | --- |
| react / react-dom | 18.3.1 |
| motion | 11.12.0 |
| framer-motion | 11.12.0 |
| clsx | 2.1.1 |
| tailwind-merge | 2.6.0 |
| esbuild（ビルド用） | 0.25.12 |
| typescript（型確認用） | 5.6.3 |

## ビルドと表示

Node.js 20 以上と、いま入っているブラウザーを使います。

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run build
python -m http.server 8861 --bind 127.0.0.1
```

3行目はこのフォルダー（`index.html` がある場所）で実行し、`http://127.0.0.1:8861/` を開きます。`file://` で開くと `input/articles.json` を読み込めないため、画面に理由と手順を出します。

## 確認の状況

- Windows上で型検査・ビルド、実ブラウザー15操作状態、6幅×3状態、コピー実readback、JSON保存を照合しました。手動とCDPで模擬したOSのreduce設定でも本文は同じでした。28秒の無音動画も書き出し・フレーム確認・全デコード・実MP4終端まで確認しました。最新の範囲は verification.json を参照してください。
- 実機の iPhone Safari、VoiceOver などの読み上げソフト、ハードウェアの安全領域では確かめていません。
- 確かめるのは Accordion 1つだけです。Motion Primitives のほかの部品やライブラリ全体、原典の CLI での導入は対象にしていません。原典はベータとされているため、固定したコミットでの内容です。
- 実際の製品での採用や、利用者数・表示速度などの実績を示すものではありません。

## ライセンス

- この作例のコード・文章・架空の手順書：MIT License, Copyright (c) 2026 Studio Yebisu（`LICENSE`）
- Motion Primitives（`src/accordion.tsx` の元と `vendor/motion-primitives/`）：MIT License, Copyright (c) 2024 ibelick。著作権表示とライセンス文は `vendor/motion-primitives/LICENCE.md` に原文のまま残しています。
- 画面のスクリプトに含まれる React・Motion・clsx・tailwind-merge などの依存パッケージは、それぞれのライセンスに従います。ライセンス文は制作側が `vendor/dependency-licenses/` にまとめて同梱します。

## 出典（固定コミット 120f64f）

- リポジトリ：https://github.com/ibelick/motion-primitives/tree/120f64f6ca60348e251f929e9c81f11ccbe45eda
- README：https://github.com/ibelick/motion-primitives/blob/120f64f6ca60348e251f929e9c81f11ccbe45eda/README.md
- LICENCE.md：https://github.com/ibelick/motion-primitives/blob/120f64f6ca60348e251f929e9c81f11ccbe45eda/LICENCE.md
- components/core/accordion.tsx：https://github.com/ibelick/motion-primitives/blob/120f64f6ca60348e251f929e9c81f11ccbe45eda/components/core/accordion.tsx
- lib/utils.ts：https://github.com/ibelick/motion-primitives/blob/120f64f6ca60348e251f929e9c81f11ccbe45eda/lib/utils.ts
- Accordion の説明：https://github.com/ibelick/motion-primitives/blob/120f64f6ca60348e251f929e9c81f11ccbe45eda/app/docs/accordion/page.mdx
- accordion-basic.tsx：https://github.com/ibelick/motion-primitives/blob/120f64f6ca60348e251f929e9c81f11ccbe45eda/app/docs/accordion/accordion-basic.tsx
- accordion-variant.tsx：https://github.com/ibelick/motion-primitives/blob/120f64f6ca60348e251f929e9c81f11ccbe45eda/app/docs/accordion/accordion-variant.tsx

### 制作側の表示調整

スマホで検索と結果が先に見えるように、冒頭と操作説明を短くしました。原典の一般的なdivに付いていたaria-orientationは、この作例では外しています（対応するARIAロールがないため）。Accordionの状態・開閉処理は同じです。元のソースと変更差分はvendor/motion-primitives/に残しています。

## 結果・映像・ソース一式

実入力はinput/articles.json、実際の操作と結果はsamples.json（12対）・outputs/operations.json、実保存JSONはoutputs/downloaded-state.jsonです。検索と開閉はライブでブラウザー内だけで動きます。結果メモはoutputs/result.md。架空の冊子アプリそのものやPDF生成を実装した作例ではありません。

動画は28秒・1280×720・30fps・840フレーム・無音。実画面と操作結果を編集した説明で、連続操作や180msの性能計測録画ではありません。現在の映像検証はverification.json、video/storyboard.jsonは制作時の設計です。代表/連続フレーム・同時刻の別順/新ページ描画一致・全MP4デコード・実再生終端を制作担当が確認しました。実機iOS、VoiceOver、他の縦横比、人による審美的承認は未確認です。

ZIPはexamples/motion-primitives-example/、media/、公開brief-to-demoの本文とMIT表記を含みます。node_modules、nativebinary、認証、cache、private統括スキル、モデル実行履歴全文は含みません。展開先ルートをHTTP配信し、/examples/motion-primitives-example/を開けます。動画を再出力するときは空の出力先をソースの外に用意してください。

```text
npm ci --ignore-scripts --no-audit --no-fund --prefix examples/motion-primitives-example/tools/motion-reel
python examples/motion-primitives-example/render.py --out renders/motion-primitives-first
```


## 2026-10-19 構造図の追加

元のReact画面はdesk.htmlへ、元28秒編集はvideo/legacy.htmlへ保全しました。現在のindex.htmlとvideo/index.htmlは新しい概念構造版です。原典/元入力/元出力は保持し、図と32秒縦横無音動画の確認をvisual-verification.jsonへ別記します。再現はvisual-guide.mdとrender-visual.pyを参照してください。
