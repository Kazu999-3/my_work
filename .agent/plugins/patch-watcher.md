---
name: patch-watcher
description: 公式のLeague of Legendsパッチノートサイトを定期的に監視し、新パッチリリースをトリガーとして軍師エージェントを自動起動するプラグイン。
---

# 🔔 Patch Watcher プラグイン

## 目的
人間がパッチのリリース日を気にすることなく、最新パッチが投下された瞬間に自動で戦術分析プロセス（Strategist パイプライン）を開始させる。

## 仕様とトリガー

### 監視対象URL
- `https://www.leagueoflegends.com/en-us/news/game-updates/`
- またはRIOT公式APIのパッチバージョンエンドポイント

### 実行間隔（Cron）
- 毎週水曜日（パッチリリース日）の **AM 3:00 〜 AM 6:00**（JST）にかけて、30分間隔でチェックを実行。

### 動作フロー
1. 対象URLをスクレイピング/APIコールし、最新のパッチ番号を取得。
2. `ANTIGRAVITY.md` または `Sovereign_Core/core_db.json` に記録されている `current_patch` と比較。
3. **新規パッチを検知した場合**:
   - `current_patch` を更新。
   - SlackまたはDiscord（王の通知環境）へアラート送信：「新しいパッチ {X} がリリースされました。戦術分析を開始します。」
   - 軍師エージェントにパッチ番号を渡し、`/lol-tactics-production` ワークフローを自動起動させる。

## 依存関係
- `node-cron` または GASのトリガー機能を用いた定期実行基盤が必要。
