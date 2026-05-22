# Sovereign OS: プロジェクト憲法 (Constitution)

## 👑 プロジェクト概要
League of Legends のリサーチ、記事生成、ソロキュー監視を統合し、自分だけの「勝利の方程式」を構築・Webサービス化するプロジェクト。

## 🏛️ 技術スタック
- **Core Engine**: Python (threading, requests)
- **Database/Cloud**: Supabase (PostgreSQL)
- **Web Portal**: Vite + React + Framer Motion
- **Monitoring**: Riot API (Spectator v5), YouTube Data API

## 🛰️ 主要モジュール
1.  **Pulse**: システム의 死活監視、外部パッチ自動検知。
2.  **Autonomous Kingdom**: YouTube監視 ➔ リサーチ ➔ 記事生成 ➔ クラウド同期の自動ループ。
3.  **Riot Observer**: ソロキューのリアルタイム監視と即時対策メモ生成。
4.  **Sovereign Sync**: ローカル資産をクラウドへ自動同期。
5.  **Intelligence調合エンジン (Champ DB Updater)**: ユーザーメモとAIトレンドの黄金ブレンド。

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
CREATE POLICY "Allow read" ON bible_articles FOR SELECT USING (true);
CREATE POLICY "Allow read" ON matchup_sentinel FOR SELECT USING (true);
```

#### B. APIキーの紐付け
- **システム同期用 (.env)**: `SUPABASE_URL`, `SUPABASE_KEY` (service_role)
- **Webポータル用 (04_COMMAND_CENTER/.env)**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

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

## 📈 現在のステップ: MVP 第2段階 (拡張中)
- [x] 全エンジンの統合（Orchestrator）
- [x] ソロキュー自動監視の実装
- [x] クラウド同期エンジンの実装
- [x] インフラ＆Discord通知バグの治療
- [ ] **[進行中] noteドラフト記事の自動同期とブラッシュアップ機能の実装**
- [ ] Supabase 連携完了 ➔ Webポータル正式稼働
