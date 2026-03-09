# 🌍 Antigravity 究極プロジェクトマスターガイド (ULTIMATE_PROJECT_MASTER.md)

このドキュメントは、プロジェクト「Antigravity」の全情報（マニュアル、構成、スキル、ワークフロー）を一箇所に集約した「究極の参照ガイド」です。

---

## 📑 クイックアクセス目次
1. [🏗️ プロジェクト概要 & マニュアル](#1-プロジェクト概要--マニュアル)
2. [📂 最新ディレクトリ構成](#2-最新ディレクトリ構成)
3. [⚔️ AIスキル百科事典 (Skills)](#3-aiスキル百科事典-skills)
4. [🔄 ワークフロー・作業手順 (Workflows)](#4-ワークフロー作業手順-workflows)
5. [🛠️ 自動化ツール・バッチ一覧 (Tools)](#5-自動化ツールバッチ一覧-tools)

---

## 🏗️ 1. プロジェクト概要 & マニュアル

### 概要
本プロジェクト（`d:\my_work`）は、AIアシスタント「アンちゃん」が管理する、自動化ツールと知識の集積地です。

### 主要アプリケーション
- **Hybrid Bot (Discord x Notion)**: タスク管理、アイデア要約、RAG対話。
- **Note Generator**: トレンド分析から記事作成・画像生成・収益化レビューまでの自動化。
- **YouTube Manager**: YouTubeプレイリストの自動整理とNotionでの一元管理。

---

## 📂 2. 最新ディレクトリ構成

```text
📁 my_work/
    📄 ANTIGRAVITY.md (プロジェクト憲法)
    📄 ULTIMATE_PROJECT_MASTER.md (本ドキュメント)
    📁 apps/ (実装プログラム本体)
        📁 x_automator/ (NEW: X自動投稿エンジン)
    📁 skills/ (AIの思考ロジック・専門知識)
    📁 workflows/ (定型業務の手順書)
    📁 tools/ (自動化バッチ・スクリプト)
    📁 knowledge/ (Notion同期メモ・RAG用データ)
    📁 outputs/ (生成された記事・成果物)
```

---

## ⚔️ 3. AIスキル百科事典 (Skills)

アンちゃんが特定の専門家として振る舞うための「頭脳」の全容です。

### 👑 司令塔 (Commander)
- **00_monetization_commander.md**: 全収益化スキルの最高執行責任者。テーマから拡散までを統括。

### ✍️ コンテンツ制作 & マーケティング (01-03)
- **ArticleWriter.md**: 人間味のある親しみやすい記事本文を執筆。
- **HighConvertingNoteGenerator.md**: 課金したくなる高品質なnote記事を3名体制で構築。
- **MonetizationReviewer.md**: 収益化の観点から記事を厳格にレビュー。
- **HookGenerator.md**: 読者の指を止める強力なフックを量産。
- **SalesCopyOptimizer.md**: 売れるセールスコピーへの書き換え。

### 🎮 League of Legends コーチング (04)
- **LoLCoach.md**: チャレンジャー帯の視点でのソロキュー分析。
- **LoLRiskManager.md**: ランク戦を回すべきか論理的に判定。
- **LoLMatchupMasterCoach.md**: 対面チャンピオンの完全封殺戦略。

### 🏗️ システム設計 & 品質 (05, 09, 10)
- **AgentOrchestratorDesign.md**: 複数エージェントによる自動ワークフロー設計。
- **PromptOptimizer.md**: 高精度な構造化プロンプトへの変換。
- **VibeCodeAuditor.md**: コードの品質とセキュリティを監査。

### 🚀 最適化 & SEO (07, 13)
- **seo-content-writer.md**: 検索上位と収益化を両立する記事作成。
- **x_post_optimization.md**: 140文字の極限でクリック率を最大化。
- **article_review.md**: 5つの黄金観点による記事の極限ブラッシュアップ。

---

## 🔄 4. ワークフロー・作業手順 (Workflows)

| コマンド | ファイル | 役割 |
| :--- | :--- | :--- |
| `/monetization-flow` | `monetization-flow.md` | 執筆〜レビュー〜SNS拡散までを一気通貫で実行。 |
| `/daily-report` | `daily-report.md` | 一日の作業内容を抽出し、日報を自動生成。 |
| `/youtube-organize` | `youtube-organize.md` | YouTubeプレイリストを指定ルールで自動整理。 |
| `/note-production` | `note-production.md` | トレンドお題から記事完成までの標準プロセス。 |

---

## 🛠️ 5. 自動化ツール・バッチ一覧 (Tools)

### 常用バッチファイル
- **`tools\SYNC_ALL.bat`**: 【最重要】タスク、ドキュメント、メモ、YouTubeの全同期メニュー。
- **`tools\X_SETUP.bat`**: 【NEW】X自動投稿ツールの初期ログイン設定。
- **`tools\RUN_YT_CLEAN.bat`**: YouTube整理ロボットの単体実行。
- **`tools\AUTO_RUN_BOT.bat`**: Discord Botの自動起動設定。

### メンテナンス・同期スクリプト
- `notion_to_local.py`: NotionのメモをローカルにMarkdownとして同期。
- `sync_tasks_to_notion.py`: ローカルのタスク状況をNotionに反映。

---

**最終更新日**: 2026年3月10日
**作成・管理**: アンちゃん (AI Assistant)
