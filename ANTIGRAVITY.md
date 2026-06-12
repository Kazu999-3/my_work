# Sovereign OS: プロジェクト憲法 (Constitution)

## 👑 プロジェクト概要
League of Legends のリサーチ、記事生成、ソロキュー監視を統合し、自分だけの「勝利の方程式」を構築・Webサービス化するプロジェクト。

## 🏛️ 技術スタック
- **Core Engine**: Python (threading, requests)
- **Database/Cloud**: Supabase (PostgreSQL)
- **Web Portal**: Next.js (App Router)
- **Monitoring**: Riot API (Spectator v5), YouTube Data API

## 🛰️ 主要モジュール (Diet Mode / MVP)
システム全体の軽量化とAPIコスト削減のため、以下の3つのコアエンジンのみを稼働させます。
1.  **Pulse**: システムの死活監視と、外部パッチ情報のスマート検知。
2.  **Match Importer**: 定期的なソロキュー戦績の自動取り込み（重複DB送信防止機能付き）。
3.  **Monetization Loop**: 流行 of アイテムやルーンを起点とした、コスト効率の高いnote記事の自動生成とパブリッシュ。

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

-- 既存のテーブルがある場合は、以下を実行してカラムを追加してください：
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

ALTER TABLE bible_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE matchup_sentinel ENABLE ROW LEVEL SECURITY;

-- 読み取り許可 (全ユーザー)
CREATE POLICY "Allow read" ON bible_articles FOR SELECT USING (true);
CREATE POLICY "Allow read" ON matchup_sentinel FOR SELECT USING (true);

-- 【重要】書き込み・更新許可 (認証済み管理者のみに制限)
-- セキュリティ防壁 (RLS): 全世界に公開するため、誰でも書き込める設定は廃止しました。
CREATE POLICY "Allow insert" ON bible_articles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update" ON bible_articles FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow insert" ON matchup_sentinel FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update" ON matchup_sentinel FOR UPDATE TO authenticated USING (true);
```

#### B. APIキーの紐付け
- **システム同期用 (.env)**: `SUPABASE_URL`, `SUPABASE_KEY` (service_role)
- **Webポータル用 (99_ARCHIVE/04_COMMAND_CENTER_old/.env)**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

---

## 📚 拡張機能: noteドラフト記事の自動同期とブラッシュアップ (MVP v2.4)

### 🌟 目的とベネフィット
ポータル内の「チャンピオン辞典 (GLOBAL)」の中で、AIが自動生成した `noteドラフト記事（Markdownテキスト）` を直接閲覧・コピー・編集できるようにし、日々のデータ更新や実戦の教訓によって、その記事が自律的かつ有機的にブラッシュアップされるエコシステムを確立する。

### 💾 データ構造 (Database Schema)
`matchup_sentinel` テーブルの `enemy="GLOBAL"` レコードの `raw_data` フィールド内に `note_draft` キーを追加し、Markdownテキストを直接埋め込む。

```json
// matchup_sentinel.raw_data の定義
{
  "source": "champ_db",
  "role": "GLOBAL",
  "strengths": "強み",
  "weaknesses": "弱み",
  "powerSpikes": "パワースパイク",
  "buildRunes": "ビルド/ルーン",
  "fullClearTime": "JG周回時間",
  "note_draft": "# 究極のリリア攻略バイブル...\n(自動ブラッシュアップされるMarkdown原稿)"
}
```

### 🔄 自律的ブラッシュアップ（マージ）フロー
1. **パッチ検知・最新統計更新時**:
   `champ_db_updater.py` が最新トレンド記事をマージする際、**既存 of `note_draft` をベースに最新の統計・パッチトレンドを上書き・マージし、日々ブラッシュアップされた最新ドラフト記事へ更新**する。
2. **反省会フィードバック受信時**:
   マスターが敗北から得た「鬼コーチの教訓」を `matchup_sentinel` の `strategy` に追記する際、同時に **`note_draft` 内の該当セクション（例: 『実戦からの戒め・弱点克服対策』）へ教訓を追記マージ**する。

---

## 📈 現在のステップ: ポータル機能拡張 ＆ トレンド情報（Reddit等）の自動ライブラリ化
- [x] 全エンジンの統合と直列化（Orchestrator）
- [x] API浪費と自動スパムバグの完全排除（Bounty Hunter / Darwin停止）
- [x] スクレイピング処理のボトルネック破壊とデータベース無駄撃ちの停止
- [x] デッドコード（フロントエンド・バックエンドの死蔵ファイル）の物理消去
- [x] ブラウザゾンビプロセスの撲滅とデータベース全件削除バグの修正
- [x] システム全域の完全なDiet Mode（スマート化）大掃除
- [x] 有料APIキーの登録検証およびSREデーモン復旧
- [x] ポータルからYouTube動画の追加指示（URLキュー登録）およびキュー監視画面の実装
- [x] Reddit等の海外コミュニティからメタ（アイテム/ルーン）のトレンド情報を安全に自動抽出・ライブラリ化する機能の実装 (※個別保存化 ＆ 元リンク追加完了)
- [x] 設計書のさらなる詳細化（詳細設計書へのアップデート）
- [/] **[進行中]** ハイブリッド自動収益化 (MVP v3.0) ＆ AIアフィリエイト連携

## 💰 拡張機能: ハイブリッド自動収益化ロードマップ (MVP v3.0)

### 🌟 目的とベネフィット
「ゲーム（有料販売）」と「IT・AIツール（アフィリエイト）」のハイブリッド戦略により、AIが自律的に収益の最大化を狙います。
特に「IT・AIツール」記事は、アフィリエイトリンクへの誘導を主軸とし、無料のノウハウ記事として公開することで、検索流入とXの拡散力で爆発的なアクセス（クリック数）を生み出します。

### 🚀 AIアフィリエイトの始め方・セットアップ手順
初めてアフィリエイトを導入し、自動化プロセスと連携させるための手順です。

#### 1. ASP（アフィリエイト・サービス・プロバイダ）および個別プログラムへの登録
紹介したいIT・AIツールのアフィリエイトリンクを取得します。
- **主要ASP**: [A8.net](https://www.a8.net/) や [もしもアフィリエイト](https://af.moshimo.com/) に登録します（Canvaやレンタルサーバー、ITサービスなどの案件が多数あります）。
- **個別ツール**: 紹介したいAIツール（例: Notion, Canva, AI画像・動画生成ツール）の公式サイト最下部にある「Affiliate」や「Partner Program」リンクから直接プログラムに申請し、専用 of 紹介用URLを発行します。

#### 2. システムへのアフィリエイトリンクの紐付け
システムが自動生成した記事の中にアフィリエイトリンクを自動で挿入できるよう、マスターデータを新規作成して設定します。
- **保存先ファイル**: `d:\my_work\02_FACTORY\affiliate_links.json` (新規作成)
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
- **トレンド収集と記事生成**: `tool_scout.py` [NEW] でトレンドツールを自動収集し、`tool_forge.py` [NEW] で広告リンク入りのレビュー記事を生成します。
- **無料 note 配信**: `NotePublisher` を用いて「無料」で下書き保存/公開します。
- **Xでのアクセス誘導**: 生成されたX用スレッド原稿を元に、X（Twitter）からnote記事へのアクセス流入を誘導します。

## ⚖️ 憲法 (Constitutions)
システム全体とAIエージェントに課せられる絶対的なルールです。

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
