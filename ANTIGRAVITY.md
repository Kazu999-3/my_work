# Sovereign OS: プロジェクト憲法 (Constitution)

## 👑 プロジェクト概要
League of Legends のリサーチ、記事生成、ソロキュー監視を統合し、自分だけの「勝利の方程式」を構築・Webサービス化するプロジェクト。

## 🏛️ 技術スタック
- **Core Engine**: Python (Playwright, requests, google-genai)
- **Database/Cloud**: Supabase (PostgreSQL), ChromaDB (Vector DB)
- **Web Portal**: Next.js (App Router, TailwindCSS/Vanilla CSS)
- **Monitoring**: Riot API (Spectator v5), YouTube Data API, Playwright note Scraping

## 🛰️ 主要モジュール (Diet Mode / MVP)
システム全体の軽量化とAPIコスト削減のため、以下のコアモジュールを稼働させます。
1. **Pulse**: システムの死活監視と、外部パッチ情報のスマート検知。
2. **Match Importer**: 定期的なソロキュー戦績の自動取り込み（重複DB送信防止機能付き）。
3. **Sovereign ADO Engine (自己進化マルチエージェント)** [NEW]:
   - **Researcher**: 入力情報から客観的なファクト（JSON構造）のみを抽出。
   - **Creator**: 辛口読者（ペルソナAI）との自己壁打ち・自己修正校正フローにより、AI臭さを徹底排除したnote記事（Markdown）およびX（Twitter）スレッドを生成。
   - **Analyst**: note.com のアクセス統計をPlaywright経由で自動収集し、Geminiで読者の関心要因を分析。
   - **Evolution**: 分析結果に基づき、ライター（Creator）用の共通ルールを自己更新・保存。
4. **AI Agent Gateway** [UPGRADE]:
   - FastAPI (Port: 8000) に同居する LLM 呼び出しの共通窓口。
   - プロンプトの Supabase DB 集中管理、Gemini/Ollama 間の自動ルーティング、および同時接続レートリミッター（429競合防止）を統合。
5. **Sovereign Mind (ティルト防止メンタルチェッカー) [NEW]**:
   - Python + pywebview によるデスクトップアプリ。Riot APIと連動し、試合終了時に自動ポップアップして感情アンケートと最新戦績からティルト状態を判定・リセットを促す。

---

## ⚔️ [重要] セットアップ・保守手順

### 1. Supabase 初期設定
Webサービス（ポータル）を稼働させるために必須の作業です。

#### A. SQL Editor でのテーブル作成
Supabase の SQL Editor で以下を実行：
```sql
CREATE TABLE bible_articles (
    id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    created_at timestamptz DEFAULT now(),
    title text UNIQUE,
    content text,
    champion text,
    keywords text[],
    file_path text
);

ALTER TABLE bible_articles ADD COLUMN IF NOT EXISTS keywords text[];

CREATE TABLE matchup_sentinel (
    id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    created_at timestamptz DEFAULT now(),
    matchup_id text UNIQUE,
    title text,
    champion text,
    enemy text,
    strategy text,
    raw_data jsonb
);

CREATE TABLE collab_tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    title text,
    description text,
    owner text,
    status text,
    priority text
);

ALTER TABLE bible_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE matchup_sentinel ENABLE ROW LEVEL SECURITY;
ALTER TABLE collab_tasks ENABLE ROW LEVEL SECURITY;

-- 読み取り許可 (全ユーザー)
CREATE POLICY "Allow read" ON bible_articles FOR SELECT USING (true);
CREATE POLICY "Allow read" ON matchup_sentinel FOR SELECT USING (true);
CREATE POLICY "Allow read" ON collab_tasks FOR SELECT USING (true);

-- 【重要】書き込み・更新許可 (認証済み管理者のみに制限)
CREATE POLICY "Allow insert" ON bible_articles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update" ON bible_articles FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow insert" ON matchup_sentinel FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update" ON matchup_sentinel FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow insert" ON collab_tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update" ON collab_tasks FOR UPDATE TO authenticated USING (true);
```

#### B. APIキーの紐付け
- **システム同期用 (.env)**: `SUPABASE_URL`, `SUPABASE_KEY` (service_role)
- **Webポータル用 (.env)**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 📂 ドメイン物理分離（物理整理）ルール

AIのコンテキスト理解効率とファイル探索のノイズを低減するため、LoL（ゲーム）とMONETIZE（アフィリエイト）のドメインを完全に分離して管理します。

### 📁 フォルダ構成
```text
my_work/
├── 01_INTEL/                  # [知識・プロンプト層]
│   ├── _LOL/                  # LoL関連の戦術、マッチアップメモ、パッチデータ
│   └── _MONETIZE/             # アフィリエイト関連のプロンプト、進化ルール
│       └── prompts/
│           └── evolution_rules.md # Evolutionが自動更新する執筆ルール
│
├── 02_FACTORY/                # [成果物・キャッシュ層]
│   ├── _LOL/                  # LoL記事ドラフト、戦績、動画
│   └── _MONETIZE/             # アフィリエイトドラフト、アフィリエイトリンクJSON
│
├── 03_SYSTEMS/                # [実行・プログラム層]
│   ├── v2_CORE/
│   │   ├── _LOL/              # LoLエンジン (riot_observer, dict_synthesizerなど)
│   │   ├── _MONETIZE/         # アフィリエイトエンジン (tool_scout, tool_forge, note_analytics, evolution)
│   │   ├── agents/            # 共通エージェント状態管理 (state)
│   │   ├── monetization_batch.py # 一気通貫バッチ (エントリポイント)
│   │   └── pulse.py           # 死活監視・LoL脈動 (エントリポイント)
│   └── ktm_bot/               # 大会運営用Discord Bot
│
└── 04_PORTAL/                 # [フロントエンド・表示層]
    └── src/
```

---

## 📈 現在のステップ: 全自動化・システム化計画（ロードマップ）
- [x] 全エンジンの統合と直列化（Orchestrator）
- [x] API浪費と自動スパムバグの完全排除（Bounty Hunter / Darwin停止）
- [x] スクレイピング処理のボトルネック破壊とデータベース無駄撃ちの停止
- [x] デッドコード（フロントエンド・バックエンドの死蔵ファイル）の物理消去
- [x] ブラウザゾンビプロセスの撲滅とデータベース全件削除バグの修正
- [x] システム全域の完全なDiet Mode（スマート化）大掃除
- [x] 有料APIキーの登録検証およびSREデーモン復旧
- [x] ポータルからYouTube動画の追加指示（URLキュー登録）およびキュー監視画面の実装
- [x] Reddit等の海外コミュニティからメタ（アイテム/ルーン）のトレンド情報を安全に自動抽出・ライブラリ化する機能の実装
- [x] 設計書のさらなる詳細化（詳細設計書へのアップデート）
- [x] **[フェーズ1]** KTM管理ダッシュボードの改善（オートセーブ完全化、検索、Autoボタン） ＆ MMR再計算バグ修正（名前同期、独自基準巻き戻し）
- [x] **[フェーズ1]** YouTube自動要約＆マクロ統合エージェント (B-2) の完全自律化
- [x] **[フェーズ2]** ハイブリッド自動収益化 (MVP v3.0) ＆ AIアフィリエイト連携（tool_scout.py / tool_forge.py）
- [x] **[フェーズ2]** Playwrightによるnote自動投稿＆Xプロモ連携スキル (B-3) のライブラリ化
- [x] **[フェーズ3]** API Gateway ＆ レートリミッター（共有DB版）の構築（API競合の根本解決）
- [x] **[フェーズ3]** SRE自己修復オートヒーラーエージェント (C-3) の構築（サンドボックス実行化）
- [x] **[フェーズ3]** 4つの自律型エージェント連携 ＆ 共同タスクボード（collab_tasks）自律連動同期の実装
- [x] **[フェーズ3]** noteアクセス統計の自律分析（Analyst） ➔ プロンプト・ナレッジのメタ自動更新（Evolution）ループの構築
- [x] **[フェーズ4]** ドメイン完全分離（_LOL / _MONETIZE）による物理整理 ＆ インポートパス自動置換の完了
- [x] **[フェーズ4]** 最高・最低MMRプレイヤー同チーム化システム (ソフト制限) の実装
- [x] **[フェーズ4]** note マガジン自動ナレッジインポート（SRE Daemon自動巡回）機能の実装
- [x] **[フェーズ5]** AI Agent Gateway（FastAPI同居・ルーティング＆リミッター・プロンプトDB化）の構築
- [x] **[フェーズ5]** YouTube Absorber の AI Agent Gateway 経由への段階的移行と動作検証
- [x] **[フェーズ6]** Sovereign OS v6.0（AI自律稼働OS＆プロンプト管理UI）の構築
  - [x] **[プランA]** ポータル管理画面への「プロンプト管理エディタ（一覧・編集・保存）」UIの追加
  - [x] **[プランB]** SRE DaemonおよびCreator（アフィリエイト記事自動生成）のゲートウェイ移行
  - [x] **[プランC]** データベース連携型の自律対話型マルチエージェント（Agent Swarm）の基礎構築
- [x] **[フェーズ7]** LoLティルト防止メンタルチェッカー (Sovereign Mind) の構築
  - [x] pywebviewベースのデスクトップアプリの基盤構築
  - [x] Riot API連携による最新戦績と連敗数の取得API実装
  - [x] バックグラウンド試合監視と終了時の自動ポップアップ機能実装
  - [x] 有料パスコードロックゲートとマインドフルネス呼吸タイマーの実装
  - [x] アプリの起動検証とユーザーフィードバックの適用
  - [x] PyInstallerによる単一 .exe ファイルへのビルドと配布パッケージ化
- [x] **[フェーズ8]** チャンピオン辞典のメタ自動アップデート ＆ プロビルド追跡統合
  - [x] lol_trend_collector.py 等から得られる現パッチの勝率急上昇・強アイテムデータの自動抽出
  - [x] pro-build-tracker (Oner/Canyon等のop.gg追跡) と連動したプロの最先端ビルドの自動抽出
  - [x] dict_synthesizer.py を拡張し、パッチメタ情報とプロビルド情報を辞典（matchup_sentinel）へ自動でアペンド・マージするロジックの実装
  - [x] ポータルUIでの「最新トレンド ＆ プロ推奨ルーン・ビルド」の視覚的表示対応
- [x] **[フェーズ9]** YouTube自動チャンネル監視 ＆ 新着動画の自動解析インポート
  - [x] 登録チャンネル管理テーブル `youtube_channels` の Supabase での設定
  - [x] チャンネルURL（@ハンドル等）からチャンネルID/名前を解決して登録する機能の実装
  - [x] ポータル上のチャンネル登録・監視リスト表示UIの開発
  - [x] RSSフィードを用いたAPI無料での新着動画巡回検知＆自動キューイングバッチ `youtube_monitor.py` の実装
  - [x] SREデーモンへの巡回タスク（3時間おき）の統合と自律実行の検証
- [ ] **[フェーズ10]** 単一コア・イベント駆動型アーキテクチャ（Sovereign OS v8.0）への段階的移行
  - [ ] **[ステップ1]** FastAPI（api.py / gateway）を中央APIとし、Next.jsから直接DBを直接更新するのを禁止してAPI経由に統一（APIファースト化）
  - [ ] **[ステップ2]** SQLite＋Pythonによる軽量な内蔵ジョブキューを自作し、YouTube解析等の非同期処理を新タスクキューへ移行
  - [ ] **[ステップ3]** LLMプロキシ（クォータ・冷却）を中央API内部に完全に統合し、各タスクスクリプトから429回避コードを排除



---

## 💰 拡張機能: ハイブリッド自動収益化ロードマップ (MVP v3.0)

### 🌟 目的とベネフィット
「ゲーム（有料販売）」と「IT・AIツール（アフィリエイト）」のハイブリッド戦略により、AIが自律的に収益の最大化を狙います。
特に「IT・AIツール」記事は、アフィリエイトリンクへの誘導を主軸とし、無料のノウハウ記事として公開することで、検索流入とXの拡散力で爆発的なアクセス（クリック数）を生み出します。

### 🚀 AIアフィリエイトの始め方・セットアップ手順
初めてアフィリエイトを導入し、自動化プロセスと連携させるための手順です。

#### 1. ASP（アフィリエイト・サービス・プロバイダ）および個別プログラムへの登録
紹介したいIT・AIツールのアフィリエイトリンクを取得します。
- **主要ASP**: [A8.net](https://www.a8.net/) や [もしもアフィリエイト](https://af.moshimo.com/) に登録します。
- **個別ツール**: 紹介したいAIツール（例: Notion, Canva, ChatGPTなど）の公式サイト最下部にある「Affiliate」や「Partner Program」リンクから直接プログラムに申請し、紹介用URLを発行します。

#### 2. システムへのアフィリエイトリンクの紐付け
システムが自動生成した記事の中にアフィリエイトリンクを自動で挿入できるよう、マスターデータを設定します。
- **保存先ファイル**: `d:\my_work\02_FACTORY\_MONETIZE\affiliate_links.json`
- **記述例 (JSON形式)**:
  ```json
  {
    "Canva": "https://px.a8.net/svt/ejd?a8mat=XXXXX",
    "Notion": "https://notion.grsm.io/XXXXX",
    "ChatGPT": "https://openai.com/..."
  }
  ```

#### 3. 自動化スクリプトの実行と運用
アフィリエイトリンクの設定完了後、以下のサイクルを自動で回します。
- **トレンド収集と記事生成**: `tool_scout.py` でトレンドツールを自動収集し、`tool_forge.py` で広告リンク入りのレビュー記事を生成します。
- **無料 note 配信**: `NotePublisher` を用いて「無料」で下書き保存します。
- **Xでのアクセス誘導**: 生成されたX用スレッド原稿を元に、X（Twitter）からnote記事へのアクセス流入を誘導します。

---

## 🛡️ 拡張機能: 自律成長・ソーシャル分析 ＆ 相性分析 (MVP v4.0)

### 🌟 目的とベネフィット
収益化プロセスを一連の無人バッチとして統合し、公開したnote記事のパフォーマンス（PV数）を自動的に学習して次の記事構成に活かすことで、コンテンツの自律的な品質向上とアクセス最大化を図ります。また、KTMポータル内での選手間の相性・ライバル関係（勝率マトリクス）を可視化することで、コミュニティの活発化を促します。

### 1. Monetization Batch (一気通貫バッチ)
- `tool_scout.py`、`tool_forge.py`、`publisher.py` を順次実行する `monetization_batch.py` を作成。
- ポータル上の管理画面（💰 アフィリエイト管理タブ内）に「一括生成＆下書き保存」ボタンを追加し、バッチの実行状況やログを確認できるようにする。
- 毎週3回程度、SREデーモン等のタイマー等と連動して自動実行可能とする。

### 2. note PVアクセス統計 ＆ 自己進化
- note.com のアクセス状況ページから各記事のPV数を自動取得（Playwright）する機能。
- 取得したPVデータを `note_pv_history` テーブル等に蓄積。
- AnalystエージェントでPV統計から読者の興味関心を分析し、Evolutionエージェントでその分析結果を `evolution_rules.md` に蓄積。
- 次回以降の執筆時に、進化したルールをプロンプトに動的注入して自律的に改善を重ねる。

### 3. 相性・ライバル勝率マトリクス
- 選手Aと選手Bが「同じチームになった時の勝率 (相性)」および「敵同士になった時の勝率 (ライバル)」を過去の全対戦履歴から算出するAPI `/api/player/chemistry` を実装。
- `/player/[id]`（マイページ）および `/leaderboard` 等に、相性の良い選手・好敵手となる選手をグラフィカルに表示するUIを追加。

---

## ⚖️ 憲法 (Constitutions)

### 1. トーン＆マナー（AI臭さの排除）
- ユーザーに提示する文章、あるいはnote記事やSNS投稿を生成する際は、**「王」「王国」「～の舞」「～の調べ」といったAI特有のポエミーな比喩表現を一切禁止**します。
- 語尾や文面はフラットで、自然な日本語（人間らしい表現）を徹底してください。
- チャンピオン辞典などのデータは、不要に詳細すぎる情報（長すぎるジャングルクリア解説など）を避け、簡潔な要点のみを記述してください。

### 2. コスト・リソース管理（APIの死守）
- 無料API（Gemini等）のクォータを絶対に超過させないでください。
- リクエスト前に必ず Quota Manager を参照し、枯渇の恐れがある場合は処理を待機（またはスキップ）させてください。
- 外部APIへの無駄撃ちを避けるため、ローカルのキャッシュ（SQLite / Json）やDBのベクトル記憶を最優先で使用してください。

### 3. デプロイとパスの安全原則
- Discord通知のリンクURLは、必ず環境変数または設定ファイルから取得した「絶対URL（フルパス）」を使用し、リンク切れ（デッドリンク）を防いでください。
- スクリプトの起動パスは、実行環境の差異を吸収できるよう、必ず絶対パスまたは基準ディレクトリからの確実な相対解決を行ってください（ハードコードの禁止）。
- **Next.jsプロジェクトにおいて絶対パスエイリアス（@/）は一切使用しないこと。常に相対パスを使用すること。**

### 4. パーソナル・ナレッジベース方針 (Personal Knowledge Base)
- 日々の活動でユーザーから提供された知識、メモ、外部URLの概要、またエージェントが自動巡回で収集したトレンド情報を `personal_knowledge` DBテーブルに体系的に蓄積します。
- 蓄積されたナレッジは、コンテンツの生成（記事執筆や分析）やシステム管理の意思決定時に優先的に参照され、文脈（コンテキスト）の補強とAIの自己学習に用いられます。
- データの冗長登録を防ぐため、挿入時には重複チェック（URLやタイトルによるユニーク制限）を実施してください。

### 5. エラー自動修復方針 (Auto Healer & Self-Repair)
- システムエラー（API制限、Playwrightのタイムアウト、デーモンの起動失敗など）が発生した際は、SREデーモンおよび自己修復ワークフロー（Auto Healer）が自律的にログをパースし、コード修正やプロセスの再起動を試みます。
- 自律的な自己修復（再起動とコード修正）の実行は、無限ループやトークン無駄遣いを防ぐため、**最大3回まで**とします。
- 3回試行しても解決しない場合、または破壊的・セキュリティ上高リスクな操作（機密ファイルの操作や管理者権限コマンド）が必要な場合は、即座に自律稼働を停止し、ユーザーに明示的に報告して指示を仰いでください。

### 6. 自己進化・システム拡張の4象限分類 (Sovereign Architecture 4-Quadrant Mapping)
Sovereign OS の機能拡張および自動化の設計時には、以下の4象限の定義に従って適切なレイヤーを選択し、役割を完全に整理して実装してください。

| 分類 | 役割・適性 | Sovereign OS における主要実装 | 自動化・システム化のメリット |
| :--- | :--- | :--- | :--- |
| **Antigravity.md**<br>*(プロジェクト憲法)* | プロジェクト全体の目的、技術スタック、物理整理ルール、長期ロードマップを定義する最高法規。 | ・ドメイン完全分離ルール（`_LOL` と `_MONETIZE`）の境界維持<br>・長期開発ステップの管理 | AI（Gemini）の文脈崩壊を防ぎ、ゲームとアフィリエイトという全く異なるコンテキストの競合を完全に排除する。 |
| **スキル (Skill)**<br>*(AIができる手段の拡張)* | AIアシスタントがチャット中に自律的に発見・呼び出し、特定の成果物を生成・操作するためのツールパッケージ。 | ・`lol-data-collector`（統計データ自動収集）<br>・`note-publisher`（Playwrightによるnote自動投稿・X宣伝）<br>・`ghost-tactics`（YouTube動画からの戦術自動抽出・辞典マージ） | ユーザーがチャットで指示するだけで、Playwright等のブラウザ操作やスクレイピングをAIがバックグラウンドで即時全自動実行する。 |
| **エージェント (Agent)**<br>*(自律バッチループ)* | 人間の手を介さず、バックグラウンドで24時間365日、自律的に観測・判断・実行・進化し続ける独立プロセス。 | ・`healer.py` / `sre_daemon.py`（オートヒーラー自己修復）<br>・`note_analytics_daemon`（アクセス解析） ➔ `evolution.py`（執筆ルールの自己進化自動上書き）ループ | エラー時の自動自己修復による運用保守の「完全不労化」、およびPV数の変動に合わせた note 共通プロンプトの自動最適化。 |
| **プラグイン (Plugin)**<br>*(本体機能・共有I/O)* | Next.jsポータルやAPI Gateway等、システム本体の機能自体を拡張し、人間や他のサービス（Discord等）とデータをやり取りする共有I/O。 | ・`api.py` / `api_gateway.py`（LLM呼び出し集約、SupabaseプロンプトDBルーティング、リミッター）<br>・`/design`（設計書プレビュー・エディタ）<br>・`ktm_bot`（大会運営用Discord Bot） | Supabase DBを介したプロンプトの一元管理と429エラー防止、およびWebブラウザやDiscordを通じた人間とのシームレスな対話とデータの可視化。 |

---

## 🏛️ バランサー（チーム分け）仕様 ＆ コーディング・デプロイ憲法

これまでの会話履歴とバグ解析に基づき、システムのバランサー設計および開発時の絶対的な技術的規約をここに定めます。

### 1. バランサー（チーム分け）アルゴリズム仕様
- **チーム分けプリセット（3タイプ）**:
  - **A: バランス**: 各レーン（TOP, JG, MID, ADC, SUP）ごとの実力（MMR差）を考慮し、チーム全体のMMRバランスが最も均等になるように自動配置します（ポータルでの初期表示は必ずこの「バランス」をデフォルトとします）。
  - **B: 戦力均等**: チーム全体の合計MMRのみを均等にするように配置します（レーン適性を無視した純粋な実力均等）。
  - **C: 希望優先**: プレイヤーが Discord 等で設定した希望メインレーンに可能な限り配置されるように最適化します。
- **見学者（待機枠）とPityのルール**:
  - **観戦Pity (`spectator_pity`)**: 試合に参加せず見学（待機枠）に回ったプレイヤーに対し、1回につき `+10` ポイントを累積付与します。次回のチーム分け時に、このポイントが高いプレイヤーが優先的に対戦メンバーに選ばれます（不公平感の排除）。
  - **OffPity (`off_pity`)**: 希望メインレーンでプレイできなかった連続回数を記録・累積し、次回優先的に希望レーンに配置されるように考慮します。
  - **サブレーン強制設定**: 希望メインレーンが `ALL` (または `fill`) であるプレイヤーのサブレーンは、画面上で強制的に `-`（ハイフン）として扱います。

### 2. Next.js / Supabase 開発の絶対ルール
- **Next.jsのインポートパス制限**:
  - Vercel 等のサーバーレス環境でのビルドエラーや `module-not-found` を完全に防ぐため、Next.js プロジェクト内では絶対パスエイリアス（`@/`）の使用を一切禁止し、**常に相対パス（`../../` など）でインポートを記述してください。**
- **Supabase の Identity 列に対する操作ルール**:
  - プレイヤーテーブル（`ktm_players`）の主キー `id` のように、PostgreSQL の Identity 列（`GENERATED ALWAYS AS IDENTITY`）に値を挿入しようとすると `cannot insert a non-DEFAULT value into column "id"` エラーが発生します。そのため、IDを指定した一括 Upsert は行わず、**更新時は ID を指定した個別 `update` を並列（`Promise.all` 等）で実行してください。**
- **メッセージ色分けルール**:
  - 画像解析の成功など、正常終了した際のメッセージは琥珀色（警告色）ではなく、目に優しくプレミアムな **エメラルドグリーン（`bg-emerald-950/30 text-emerald-400 border-emerald-800/60`）** で表示してください。

