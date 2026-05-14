# ワークフロー: `/sentinel-patrol` (インフラ監査 ＆ 競合監視)

このワークフローは、システムの安全性（セキュリティ）と市場での優位性（競合監視）を同時にパトロールします。

## ステップ 1: インフラ・セキュリティ監査
// turbo
`py d:\my_work\02_ENGINE\v2_CORE\sentinel.py`

## ステップ 2: 競合監視センチネルの起動
// turbo
`py d:\my_work\02_ENGINE\v2_CORE\sentinel_competitor.py`

## ステップ 3: パトロール報告
- [ ] 脆弱性やファイル欠損が検知された場合、自動修復の結果を確認。
- [ ] 競合のバズが検知された場合、即座に `/forge-monetize` を検討する。
