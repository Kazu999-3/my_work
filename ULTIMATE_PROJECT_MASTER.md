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
    📁 skills/ (AIの思考ロジック・専門知識)
    📁 workflows/ (定型業務の手順書)
    📁 tools/ (自動化バッチ・スクリプト)
    📁 knowledge/ (Notion同期メモ・RAG用データ)
    📁 outputs/ (生成された記事・成果物)
```

---

## ⚔️ 3. AIスキル百科事典 (Skills)

アンちゃんが特定の専門家として振る舞うための「頭脳」の全容です。全てのスキルは **「Proシリーズ」** へ統合され、内部で「3名のエージェントによる議論（生成、批判、統合）」を行う高度な内省ロジックが組み込まれています。

### 👑 司令塔 (The Commander)
- **[00_monetization_commander.md](./skills/00_monetization_commander.md)**
  - 全スキルの最高執行責任者（COO）。テーマから戦略、実行指示までを統括。

### ✍️ コンテンツ制作 (Content Production)
- **[01_ContentFactory_Pro.md](./skills/01_content_generation/01_ContentFactory_Pro.md)**
  - 企画、執筆、校正、収益化記事作成を一括で行う究極の執筆エンジン。

### 🎯 マーケティング (Marketing & Copy)
- **[02_MarketingOptimizer_Pro.md](./skills/02_marketing_copywriting/02_MarketingOptimizer_Pro.md)**
  - 競合分析、SEO分析、フック生成、セールスコピー最適化を統合したグロースエンジン。

### 🚀 プロモーション (Promotion & Automation)
- **[03_PromotionEngine_Pro.md](./skills/03_promotion_automation/03_PromotionEngine_Pro.md)**
  - SNS拡散カレンダー、画像プロンプト、動画台本、自動化スクリプトを一括錬成。

### 🎮 専門・コーチング (Specialized Coaching)
- **[04_UltimateLoLCoach_Pro.md](./skills/04_lol_coach/04_UltimateLoLCoach_Pro.md)**
  - LoLの勝率を最大化する軍師（分析、対策、リスク管理、メンタル）。
- **[MBTIPositiveMentalCoach.md](./skills/06_personal_coach/MBTIPositiveMentalCoach.md)**
  - MBTIに基づいたパーソナライズ・メンタルコーチ。

### 🏗️ システム設計 (System & Engineering)
- **[05_UltimateAIArchitect_Pro.md](./skills/05_system_architect/05_UltimateAIArchitect_Pro.md)**
  - 最強のプロンプト作成とエージェント・ワークフローの設計。
- **[09_UltimateAIEngineer_Pro.md](./skills/09_agent_engineering/09_UltimateAIEngineer_Pro.md)**
  - メモリ管理、ツール構築、コード監査、セキュリティの統合基盤。

### � 分析・リサーチ (Strategy & Data)
- **[07_UltimateSEOSpecialist_Pro.md](./skills/07_seo_specialist/07_UltimateSEOSpecialist_Pro.md)**
  - 検索1位と成約を両立するSEOの全技術。
- **[08_UltimateStrategyAnalyst_Pro.md](./skills/08_research_strategy/08_UltimateStrategyAnalyst_Pro.md)**
  - トレンド分析、PDP（自己反応分析）、市場調査を統合した戦略決定エンジン。

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
- **`tools\RUN_YT_CLEAN.bat`**: YouTube整理ロボットの単体実行。
- **`tools\AUTO_RUN_BOT.bat`**: Discord Botの自動起動設定。

### メンテナンス・同期スクリプト
- `notion_to_local.py`: NotionのメモをローカルにMarkdownとして同期。
- `sync_tasks_to_notion.py`: ローカルのタスク状況をNotionに反映。

---

**最終更新日**: 2026年3月10日
**作成・管理**: アンちゃん (AI Assistant)
