# ワークフロー: `/forge-monetize` (一気通貫・収益化アセット生成)

このワークフローは、ターゲットとなるテーマ（チャンピオン名等）を指定するだけで、リサーチから動画生成までの全工程を自動で完結させます。

## ステップ 1: パラメータの確認
- [ ] ターゲット（例：Jarvan IV）を特定する。
- [ ] 既存のリサーチレポートがあるか `01_INTEL/analytics` を確認する。

## ステップ 2: マスター・パイプラインの起動
// turbo
`$env:PYTHONPATH="d:\my_work\02_ENGINE"; py d:\my_work\02_ENGINE\v2_CORE\main_pipeline.py`

## ステップ 3: 成果物の最終確認
- [ ] `03_FACTORY/note_drafts/` に「自己進化した」記事があるか確認。
- [ ] `03_FACTORY/videos/` に shorts動画と運用メタデータがあるか確認。

## ステップ 4: 投稿・配信準備
- [ ] noteの下書きにコピペする。
- [ ] YouTube Shortsを予約投稿する。
