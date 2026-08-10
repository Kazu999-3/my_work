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

## 🛠️ 1. 自律スキル (Skills)

`.claude/skills/`（プロジェクト直下）と `04_PORTAL/.claude/skills/`（ポータル固有）配下のスキルはネイティブのSkill機構で自動検出されるため、ここで手動リストアップする必要はありません。タスク内容に応じて自発的に該当スキルを読み込み、その手順・制約に従ってください。

現存する主なスキル: `ghost-writer`（AI臭さ排除の校正）、`ghost-tactics`（YouTube動画からの戦術自動抽出）、`lol-data-collector`（統計収集）、`lol-deep-research`（チャンピオン深掘りリサーチ）、`pro-build-tracker`（プロビルド追跡）、`sovereign-factory`（戦術バイブル/SNS/画像プロンプト量産）、`lexicon-editor`（辞典編纂）、`style-auditor`（文章のAI臭さ監査）、`article-review`（note記事の6観点レビュー＆改善ループ）、`note-article-drafter`（note記事ドラフト生成）、`note-production`（note量産の一気通貫フロー、Worker/Reviewerループ内蔵）、`notification-designer`（Discord/Web通知のUXライティング）、`find-skills`（外部スキルエコシステムの発見）、`ktm-admin`（KTM大会運営・MMR計算・チーム分け）、`skill-creator`（スキルの新規作成・検証）、`canvas-design`（画像/ポスター生成）、`supabase-table-security`（04_PORTAL固有、新規テーブル/APIルートのセキュリティチェックリスト）、`gemini-model-health-check`（Geminiモデルの実クォータ実測）、`known-regression-patterns`（既知の再発バグパターン・チェックリスト）、`ktm-recruitment-status-dryrun`（KTM Bot募集カード色ロジックの無投稿検証）、`session-handover-update`（HANDOVER/TODOへのセッション記録更新）、`supabase-migration-lint`（Supabaseマイグレーションの既知の罠スキャン）、`handover-staleness-check`（HANDOVER/TODO記録漏れの検知）、`skill-usage-audit`（スキル使用実績の棚卸し）。

`d:/my_work/.agent/skills/`・`.agent/workflows/` の旧スキル・ワークフローは2026-08-04に棚卸し完了。実際に使われている/価値のあるものは全て`.claude/skills/`へ移行済みで、残りは削除済み（`.agent/agents`・`.agent/rules`等の他ディレクトリは対象外・未調査）。

**スキルの継続的な改善**: あるスキルの実行中に実害のある失敗（依存先の削除、規約違反、誤ったデータ書き込み等）を発見・修正した場合は、そのスキル自身のSKILL.md末尾に「## 既知の落とし穴 (Known Pitfalls)」として日付付きで記録すること（`sovereign-factory/SKILL.md`参照）。次にそのスキルを使う際に同じ轍を踏まないための経験メモとして機能する。新しいスキルを作る/大きく直す際は`skill-creator`スキル（`.claude/skills/skill-creator/scripts/quick_validate.py`でフォーマット検証可能）を使うこと。

**スキル数の規律**: 外部事例（複数のnote記事、2026-08-10調査）で「常設スキルは少数に絞るべき」「実運用は結局1桁〜十数個に収束する」という指摘が繰り返し見られた。新しいスキルを追加する際は、追加するだけで終わらせず、①似た役割の既存スキルと統合できないか検討し、②`skill-usage-audit`スキルで全体の使用実績を確認し、長期間呼ばれていない・明らかに陳腐化したスキルがあれば削除をユーザーに提案すること。ただし機械的な「0件だから削除」は禁止で、`skill-usage-audit`自身が明記する限界（トランスクリプトのローテーション、直接参照は検出不可等）を踏まえ、最終判断は必ずユーザーに委ねる。

---

## 🎯 2. プロジェクト概要 ＆ アーキテクチャ

`Sovereign OS` は、League of Legends (LoL) の戦術リサーチ・メタ解析と、note / アフィリエイトによる自動収益化、および大会運営 (KTM) ポータルを統合した自律型システムです。AIのコンテキスト混濁を防ぐため、ドメインは4層に物理分離されています：`01_INTEL/`（知識・プロンプト層）／ `02_FACTORY/`（成果物・執筆層、TODO.md含む）／ `03_SYSTEMS/`（実行エンジン層）／ `04_PORTAL/`（Next.js Web層）。

**⚠️ 上記は設計上の理想形です。** どのモジュールが実際に本番稼働している（クラウド常時稼働／ローカルPC起動時のみ／停止済み）かは、必ず `HANDOVER_CLAUDE.md` の「稼働実態の補足」セクションで最新状況を確認してください。この節は乖離が起きやすいため、ここでは詳細を重複記載しません。

---

## 🚨 3. 絶対遵守ルール (Strict Rules & Conventions)

全ての作業において、以下の規約を**例外なく厳守**してください。

### ① コミュニケーション ＆ 言語
- 原則として**すべて日本語**で応答・思考・コメント・タスク表示を行ってください。
- ユーザーに報告・提案する際は、親しみやすく論理的な説明を心がけてください。

### ② 作業前の確認 (y/n 原則)
- ファイルの作成・変更・削除、管理者権限コマンドや破壊的操作を行う前には、**必ず作業計画を報告し「y/n」でユーザー確認を取ってください**。
- ※`ls`, `cat`, `grep` などの非破壊的な読み取り・調査操作は即時実行して構いません。

### ③ トーン＆マナー（AI臭さの排除）
- note 記事や SNS 投稿、ユーザー向け文章では**「王」「王国」「～の舞」「～の調べ」などのポエミーな比喩表現を一切禁止**します。
- 語尾や文面はフラットで自然な人間らしい文章を作成してください。

### ④ データベース (Supabase) 操作ルール
- `ktm_players` などの PostgreSQL Identity 列（`GENERATED ALWAYS AS IDENTITY`）に主キー ID を指定して insert/upsert しないでください（`cannot insert a non-DEFAULT value into column "id"` エラー防止）。更新時は ID を指定した個別 `update` を使用してください。
- 新しいテーブルをAPIルート経由で公開する際は、RLSを`USING (true)`のまま放置しない（`04_PORTAL/CLAUDE.md`のセキュリティチェックリスト参照）。

### ⑤ UI メッセージ表現規約
- 正常終了時や成功メッセージの通知は、琥珀色（警告色）ではなく、**エメラルドグリーン（`bg-emerald-950/30 text-emerald-400 border-emerald-800/60`）** を使用してください。

**`04_PORTAL` (Next.js) 固有のルール（インポートパス制限等）は `04_PORTAL/CLAUDE.md` を参照してください。** 04_PORTAL内で作業する際は自動的に読み込まれます。

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

残タスク・技術的負債バックログは `02_FACTORY/TODO.md`（§0で自動読込済み）を参照してください。詳細な引継ぎ履歴およびシステムマップは `HANDOVER_CLAUDE.md` を参照してください。
