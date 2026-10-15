# Studio Yebisu

AIスキルを、用途・実作例・使い方から選ぶ日本語サイト。UI・UX、AIスライド、モーション、エージェント・便利スキルを一つの入口で扱います。

[統合サイト](https://studio-yebisu.github.io/studio-yebisu/) · [最初の作例](https://studio-yebisu.github.io/studio-yebisu/case.html?id=brief-to-demo)

## 一つのCodexプロジェクトから使う

このフォルダーを `Studio Yebisu` プロジェクトとして開きます。

```powershell
python scripts/workspace.py
```

`workspace/ui-ux`、`workspace/slides`、`workspace/motion` は、兄弟フォルダーの既存リポジトリへの接続です。元のファイル・Git履歴・未コミット変更を保持します。これらの接続とローカル実行記録は公開しません。

専門制作の正本：

- [UI・UX](https://github.com/studio-yebisu/awesome-claude-ui-ux-design-ja)
- [AIスライド](https://github.com/studio-yebisu/awesome-codex-ppt-skills-ja)
- [モーション](https://github.com/studio-yebisu/awesome-claude-motion-design-ja)

## 紹介内容を追加する

原典の確認、制作ブリーフ、実作例、短い説明動画を揃え、記事データをサイトへ反映します。制作の既定は **Claude Opus 5.5** です。

```powershell
python scripts/pipeline.py new example-id --source https://example.com/skill --category agents
python scripts/produce.py --prompt path/to/production-prompt.txt
python scripts/pipeline.py publish example-id
```

最後のコマンドは成果物を検査してローカルサイトを生成します。公開が依頼済みの場合は `--deploy` を付けると、このリポジトリの許可リストをcommit・pushし、GitHub Pagesへ反映します。依頼されていない公開先や課金へ拡張しません。

```powershell
python scripts/pipeline.py publish example-id --deploy
```

## サイトを開く

```powershell
python scripts/build.py
python scripts/check.py
python scripts/serve.py
```

ブラウザーで `http://127.0.0.1:8856/` を開きます。

カタログの更新は `python scripts/sync_catalog.py`。既存3プロジェクトの固定したコミットから取り込みます。取り込んだ版と範囲は [data/import-manifest.json](data/import-manifest.json) に記録します。

## 最初の一件

**ひと言を、作れる依頼に。** 短い依頼を制作ブリーフへ整理する独自スキル。Opus 5.5がUI・スライド・モーションの3件を制作し、選択・コピー・JSON取得ができる作例と、使い方を説明する28秒の動画にまとめます。

- [スキル本文](skills/brief-to-demo/SKILL.md)
- [操作できる作例](examples/brief-to-demo/index.html)
- [動画の編集ソース](examples/brief-to-demo/video/scene.js)
- [制作記録](docs/FIRST_CASE.md)

ブラウザー上の作例は制作済みの出力を見るものです。閲覧者の入力を外部AIへ送信しません。

## 出典・条件

統合サイトと独自スキルはMIT。紹介先のスキル・ツール・作例には、それぞれの条件が適用されます。ライセンスの表示を、別の作品への適用や実装全体の再許諾とみなしません。[出典と取り込み範囲](docs/SOURCES.md)を参照してください。
