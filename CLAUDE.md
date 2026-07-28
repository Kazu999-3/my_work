# 👑 CLAUDE.md - Sovereign OS (my_work) 開発・運用ガイド

本ファイルは、Claude (Claude Code CLI, VS Code 拡張機能, Claude Desktop 等) が本プロジェクト (`d:/my_work`) で作業を行う際の**最上位開発ルール・環境指示書**です。

---

## ⚡ 0. セッション開始時の完全自動初期化 (Auto-Context Recovery - MANDATORY)

**【最重要自律命令】**
あなたがこのプロジェクト (`d:/my_work`) でセッション（チャット対話）を開始した際、**ユーザーからの明示的な指示やリロード命令がなくとも、最初の返答時に自発的に以下のファイルを読み込み（バックグラウンドインスペクション）、文脈と本日のタスクを即座に復元してください。**

### 🔍 自動参照ファイル
1. **`HANDOVER_CLAUDE.md`** : Antigravityでの全実装・修正履歴およびシステム構造マニュアル
2. **`02_FACTORY/TODO.md`** : 業務ダッシュボード（本日の注力タスク ＆ 技術的負債バックログ）
3. **`01_INTEL/NEXUS_INDEX.md`** : 帝国総合索引（全アセット・ドキュメントへのリンクハブ）

### 💬 初回返答のフォーマット規約
ユーザーが最初のメッセージ（例: 「あ」「お疲れ」「開発開始」等）を送信した際、必ず**以下の構成で自発的に返答を開始**してください：

> 「`HANDOVER_CLAUDE.md` および `TODO.md` を自動読み込みし、文脈とプロジェクト状態を完全復元しました。  
> 
> 📌 **本日の注力タスク (TODO.md より)**:
> - [タスク1]
> - [タスク2]
> 
> 本日はどの作業から進めますか？」

---

## 🛠️ 1. 自律スキル ＆ ワークフロー参照インデックス (Skills & Workflows)

タスクの内容に応じて、以下のスキル定義（`SKILL.md`）およびワークフロー指示書を自発的に読み込み、その手順・制約に従って実行してください。

### 🎨 自律スキル (`d:/my_work/.agent/skills/`)
- **[Ghost Writer (ゴースト・ライター)](file:///d:/my_work/.agent/skills/ghost-writer/SKILL.md)** : AI臭さを徹底排除し、人間味のある生きた言葉に変換する校正スキル。
- **[Ghost Tactics (戦術自動抽出)](file:///d:/my_work/.agent/skills/ghost-tactics/SKILL.md)** : YouTube動画URLから戦術を自動抽出しチャンピオン辞典へマージするスキル。
- **[LoL Data Collector (統計収集)](file:///d:/my_work/.agent/skills/lol-data-collector/SKILL.md)** : 最新パッチの勝率・ピック率・ルーンデータを収集するスキル。
- **[Sovereign Factory (資産量産)](file:///d:/my_work/.agent/skills/sovereign-factory/SKILL.md)** : パッチ毎の戦術バイブル、SNSスレッド、画像プロンプトを量産するスキル。
- **[Lexicon Editor (辞典編纂)](file:///d:/my_work/.agent/skills/lexicon-editor/SKILL.md)** : チャンピオン辞典の不要情報を削ぎ落とし要点整理するスキル。

### 🔄 自動化ワークフロー (`d:/my_work/.agent/workflows/`)
- **[note-production](file:///d:/my_work/.agent/workflows/note-production.md)** : トレンド収集から note 500円モデル記事を自動生成するフロー。
- **[monetization-flow](file:///d:/my_work/.agent/workflows/monetization-flow.md)** : 記事生成・極限レビュー・SNS拡散計画の一気通貫フロー。
- **[auto-healer](file:///d:/my_work/.agent/workflows/auto-healer.md)** : システムエラー発生時のログ解析と自律修正・再実行フロー。
- **[ktm-admin](file:///d:/my_work/.agent/workflows/ktm-admin.md)** : KTM大会運営・MMR計算・チーム分け管理の自律フロー。

---

## 🎯 2. プロジェクト概要 ＆ アーキテクチャ

`Sovereign OS` は、League of Legends (LoL) の戦術リサーチ・メタ解析と、note / アフィリエイトによる自動収益化、および大会運営 (KTM) ポータルを統合した自律型システムです。

### 📁 ドメイン物理分離ルール
AIのコンテキスト混濁を防ぐため、ドメインは完全に分離されています。

- **`01_INTEL/`** : ナレッジ・プロンプト層（LoL戦術メモ、文字起こしバイブル、アフィリエイトプロンプト）
- **`02_FACTORY/`** : 成果物・執筆層（noteドラフト、SNSスレッド、定常アセット、TODO.md）
- **`03_SYSTEMS/`** : 実行エンジン層（FastAPI Gateway, EdgeWorkerDaemon, KTM Bot, 各種バッチ）
- **`04_PORTAL/`** : Web表示層（Next.js ポータル、MMRバランサー、チャンピオン辞典ハブ、管理画面）

---

## 🚨 3. 絶対遵守ルール (Strict Rules & Conventions)

全ての作業において、以下の規約を**例外なく厳守**してください。

### ① コミュニケーション ＆ 言語
- 原則として**すべて日本語**で応答・思考・コメント・タスク表示を行ってください。
- ユーザーに報告・提案する際は、親しみやすく論理的な説明を心がけてください。

### ② 作業前の確認 (y/n 原則)
- ファイルの作成・変更・削除、管理者権限コマンドや破壊的操作を行う前には、**必ず作業計画を報告し「y/n」でユーザー確認を取ってください**。
- ※`ls`, `cat`, `grep` などの非破壊的な読み取り・調査操作は即時実行して構いません。

### ③ Next.js のインポートパス制限【最重要】
- **`04_PORTAL` (Next.js) 内において、絶対パスエイリアス（`@/`）は使用を一切禁止します。**
- Vercel 等のデプロイ環境での `module-not-found` エラーを完全に防ぐため、**常に相対パス（`../../` など）でインポートを記述してください**。

### ④ トーン＆マナー（AI臭さの排除）
- note 記事や SNS 投稿、ユーザー向け文章では**「王」「王国」「～の舞」「～の調べ」などのポエミーな比喩表現を一切禁止**します。
- 語尾や文面はフラットで自然な人間らしい文章を作成してください。

### ⑤ データベース (Supabase) 操作ルール
- `ktm_players` などの PostgreSQL Identity 列（`GENERATED ALWAYS AS IDENTITY`）に主キー ID を指定して insert/upsert しないでください（`cannot insert a non-DEFAULT value into column "id"` エラー防止）。更新時は ID を指定した個別 `update` を使用してください。

### ⑥ UI メッセージ表現規約
- 正常終了時や成功メッセージの通知は、琥珀色（警告色）ではなく、**エメラルドグリーン（`bg-emerald-950/30 text-emerald-400 border-emerald-800/60`）** を使用してください。

---

## 💻 4. コマンドリファレンス (Command Reference)

### 🌐 ポータル (Next.js Web Portal)
```bash
# ポータルの開発サーバー起動 (Port: 3000)
cd 04_PORTAL
npm run dev
```

### ⚙️ コアエンジン ＆ API Gateway
```bash
# FastAPI Agent Gateway の起動 (Port: 8000)
python 03_SYSTEMS/v2_CORE/api.py

# エッジワーカーデモンの起動
python 03_SYSTEMS/v2_CORE/edge_worker_daemon.py
```

---

## 📌 5. 今後の主要開発ロードマップ (Sovereign OS v8.0)

- **APIファースト化**: Next.js ポータルから Supabase DB への直接アクセスを廃止し、FastAPI Gateway (`api.py`) 経由に統一。
- **ジョブキューの一元化**: SQLite ベースの `SovereignQueue` へ処理を非同期集約。
- **コード大掃除**: `04_PORTAL/scripts/` 内の重複スクリプト整理。

詳細な引継ぎ履歴およびシステムマップは `HANDOVER_CLAUDE.md` を参照してください。
