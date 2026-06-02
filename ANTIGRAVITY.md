# Sovereign OS: プロジェクト憲法 (Constitution)

## 👑 プロジェクト概要
League of Legends のリサーチ、記事生成、ソロキュー監視を統合し、自分だけの「勝利の方程式」を構築・Webサービス化するプロジェクト。

## 🏛️ 技術スタック
- **Core Engine**: Python (threading, requests)
- **Database/Cloud**: Supabase (PostgreSQL)
- **Web Portal**: Vite + React + Framer Motion
- **Monitoring**: Riot API (Spectator v5), YouTube Data API

## 🛰️ 主要モジュール (Diet Mode / MVP)
システム全体の軽量化とAPIコスト削減のため、以下の3つのコアエンジンのみを稼働させます。
1.  **Pulse**: システムの死活監視と、外部パッチ情報のスマート検知。
2.  **Match Importer**: 定期的なソロキュー戦績の自動取り込み（重複DB送信防止機能付き）。
3.  **Monetization Loop**: 流行のアイテムやルーンを起点とした、コスト効率の高いnote記事の自動生成とパブリッシュ。

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
   `champ_db_updater.py` が最新トレンド記事をマージする際、**既存の `note_draft` をベースに最新の統計・パッチトレンドを上書き・マージし、日々ブラッシュアップされた最新ドラフト記事へ更新**する。
2. **反省会フィードバック受信時**:
   マスターが敗北から得た「鬼コーチの教訓」を `matchup_sentinel` の `strategy` に追記する際、同時に **`note_draft` 内の該当セクション（例: 『実戦からの戒め・弱点克服対策』）へ教訓を追記マージ**する。

---

## 📈 現在のステップ: MVP 第2段階 (Diet Mode 完全大掃除完了)
- [x] 全エンジンの統合と直列化（Orchestrator）
- [x] API浪費と自動スパムバグの完全排除（Bounty Hunter / Darwin停止）
- [x] スクレイピング処理のボトルネック破壊とデータベース無駄撃ちの停止
- [x] デッドコード（フロントエンド・バックエンドの死蔵ファイル）の物理消去
- [x] ブラウザゾンビプロセスの撲滅とデータベース全件削除バグの修正
- [x] **[完了] システム全域の完全なDiet Mode（スマート化）大掃除**
- [ ] **[次のステップ]** このピカピカのシステムによる収益化ループ（記事生成）の動作テスト

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
