# 📌 Sovereign OS 業務ダッシュボード (TODO)

本ファイルは、日々の作業タスクを管理するためのダッシュボードです。
会話開始時に Antigravity が自動的にこのファイルを読み込み、文脈を復元して本日のタスクに直ちに追従します。

---

## 📅 次回の注力タスク（2026-07-28 実行予定）
> 2026-07-27 のクリーンアップセッション（収益化パイプライン削除、孤立ファイル整理、CS/ファーストブラッドのフェイクデータ削除等）で洗い出したまま未着手の項目。SNS素材フォルダの統合（231ファイル・5箇所）のみ、規模が大きいため対象外。

- [ ] **収益化パイプライン再実装の周辺整備**
  - [ ] `PORTAL_BOT_SECRET` の有効化（Vercel と Cloudflare 双方に設定してから bot⇔ポータル認証を有効化。コード自体は実装済み）
  - [ ] Whisper のクラウド移行の設計検討（無料・高精度が条件、実装自体は保留のまま設計だけ詰める）
- [ ] **バランサー／コーチ機能の技術的負債**
  - [ ] `balancer/pending` のインメモリキャッシュが Vercel のマルチインスタンス構成で不整合を起こす可能性の調査・対策
  - [ ] `admin/init-mmr` の逐次 await（直列処理）によるパフォーマンス改善
  - [ ] `admin/champion-research` がスクレイピング失敗を握りつぶしている問題の修正
- [ ] **リポジトリ運用の意思決定**
  - [ ] `02_FACTORY/PRODUCTS/` を Git 管理するかどうかの方針決定（セッション最初期から未決定のまま）
- [ ] **ドキュメント整合性**
  - [ ] `ANTIGRAVITY.md`・`SYSTEM_DESIGN_BY_FUNCTION.md`・`02_FACTORY/03_ASSETS/affiliate_knowledge.md` に残る旧収益化パイプラインの記述を更新（`HANDOVER_CLAUDE.md` は対応済み）

## ✅ 完了済み（アーカイブ）
- [x] **Sovereign OS v7.0 移行計画の推進**
  - [x] フェーズ1: バランサーIdentityエラー解決 & キーローテーション基本実装
  - [x] フェーズ2: Webhook式ハイブリッドイベント駆動キュー
  - [x] フェーズ3: YouTubeAbsorber の Gateway ＆ 自律スキルへの完全統合
  - [x] フェーズ4: Riot ＆ Discord 連携の改名自己修復・安全停止
- [x] **ポータル導線整理 ＆ チャンピオン辞典ハブ化**
  - [x] Phase 1: サイドバー導線の整理（メニュー10→6項目、セクション分け）
  - [x] Phase 2: チャンピオン辞典のタブ統合ハブ化（辞典/対面/AI更新）
  - [x] Phase 3: 自動化パイプラインの可視化ダッシュボード
  - [x] Phase 4: 辞典 → note記事生成の直結導線（※導線自体は2026-07-26に収益化パイプラインごと削除。再実装時に要再設計）
- [x] **2026-07-26〜27 大規模クリーンアップ**
  - [x] 収益化パイプライン全体を削除（`_MONETIZE/`, `agents/`, `monetization_batch.py` 等。`promoter.py`のみ pulse.py の現役cronのため残置）
  - [x] `youtube_absorber.py` / `match_importer.py` の回帰バグ修正
  - [x] 孤立ファイル・壊れた導線・重複ロジック（DDragon取得等）の整理
  - [x] `sovereign_tasks` キューの死んだ読み出し経路を削除（`edge_tasks` に一本化）
  - [x] KTMカスタム戦のCS・ファーストブラッドのフェイクデータ生成ロジックを削除

## 📊 運用目標 ＆ 前提ルール
- **note配信**: 週2回（水・土） / 500円モデル有料記事 of 自動生成
- **SNS（X）宣伝**: パッチメタに応じたチャンピオン紹介スレッドの配信
- **主要アセット**: 
  - [NEXUS_INDEX.md (総合索引)](file:///d:/my_work/01_INTEL/NEXUS_INDEX.md)
  - [アフィリエイト知識](file:///d:/my_work/02_FACTORY/03_ASSETS/affiliate_knowledge.md)
  - [note執筆プロトコル](file:///d:/my_work/02_FACTORY/03_ASSETS/forge_note_protocol.md)

## 🚧 技術的負債バックログ（継続追跡）
- [x] タスクキュー2系統の統合（SQLite時代の sovereign_tasks 読み出し経路を削除し、edge_tasks に一本化。2026-07-27対応済み）
- [ ] edge_worker の Gateway バイパス解消 → QuotaShaper 経由に統一
- [ ] エージェントスキル出力の DB 自動投入パイプライン設計（ローカルMD → Supabase）
- [ ] `04_PORTAL/scripts/` 重複スクリプトの整理（smart_backfill に統一、旧スクリプト削除）
- [ ] Supabase 直接アクセスの API 経由化 → v8.0 APIファースト化として推進
