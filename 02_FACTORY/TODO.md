# 📌 Sovereign OS 業務ダッシュボード (TODO)

本ファイルは、日々の作業タスクを管理するためのダッシュボードです。
会話開始時に Antigravity が自動的にこのファイルを読み込み、文脈を復元して本日のタスクに直ちに追従します。

---

## 📅 本日の注力タスク (今日やること)
- [/] **Sovereign OS v7.0 移行計画の推進**
  - [x] フェーズ1: バランサーIdentityエラー解決 & キーローテーション基本実装
  - [x] フェーズ2: Webhook式ハイブリッドイベント駆動キュー
  - [x] フェーズ3: YouTubeAbsorber の Gateway ＆ 自律スキルへの完全統合
  - [x] フェーズ4: Riot ＆ Discord 連携の改名自己修復・安全停止
- [x] **ポータル導線整理 ＆ チャンピオン辞典ハブ化**
  - [x] Phase 1: サイドバー導線の整理（メニュー10→6項目、セクション分け）
  - [x] Phase 2: チャンピオン辞典のタブ統合ハブ化（辞典/対面/AI更新）
  - [x] Phase 3: 自動化パイプラインの可視化ダッシュボード
  - [x] Phase 4: 辞典 → note記事生成の直結導線
- [ ] **コンテンツ収益化の運用**
  - [ ] 新規アフィリエイト記事の構成案作成 ➜ @Antigravity 記事ネタ提案よろしく
  - [ ] YouTube動画解析ジョブの監視と辞典整理状況の確認

## 📊 運用目標 ＆ 前提ルール
- **note配信**: 週2回（水・土） / 500円モデル有料記事 of 自動生成
- **SNS（X）宣伝**: パッチメタに応じたチャンピオン紹介スレッドの配信
- **主要アセット**: 
  - [NEXUS_INDEX.md (総合索引)](file:///d:/my_work/01_INTEL/NEXUS_INDEX.md)
  - [アフィリエイト知識](file:///d:/my_work/02_FACTORY/03_ASSETS/affiliate_knowledge.md)
  - [note執筆プロトコル](file:///d:/my_work/02_FACTORY/03_ASSETS/forge_note_protocol.md)

## 🚧 技術的負債バックログ（継続追跡）
- [ ] タスクキュー2系統の統合（SQLite SovereignQueue vs Supabase edge_tasks）→ v8.0計画書作成
- [ ] edge_worker の Gateway バイパス解消 → QuotaShaper 経由に統一
- [ ] エージェントスキル出力の DB 自動投入パイプライン設計（ローカルMD → Supabase）
- [ ] `04_PORTAL/scripts/` 重複スクリプトの整理（smart_backfill に統一、旧スクリプト削除）
- [ ] Supabase 直接アクセスの API 経由化 → v8.0 APIファースト化として推進
