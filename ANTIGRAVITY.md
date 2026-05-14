# Sovereign OS: プロジェクト憲法 (Constitution)

## 👑 プロジェクト概要
League of Legends のリサーチ、記事生成、ソロキュー監視を統合し、自分だけの「勝利の方程式」を構築・Webサービス化するプロジェクト。

## 🏛️ 技術スタック
- **Core Engine**: Python (threading, requests)
- **Database/Cloud**: Supabase (PostgreSQL)
- **Web Portal**: Vite + React + Framer Motion
- **Monitoring**: Riot API (Spectator v5), YouTube Data API

## 🛰️ 主要モジュール
1.  **Pulse**: システムの死活監視。
2.  **Autonomous Kingdom**: YouTube監視 ➔ リサーチ ➔ 記事生成 ➔ クラウド同期の自動ループ。
3.  **Riot Observer**: ソロキューのリアルタイム監視と即時対策メモ生成。
4.  **Sovereign Sync**: ローカル資産をクラウドへ自動同期。

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
    file_path text
);

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

### 2. 成果物の確認場所
- **攻略バイブル**: `d:\my_work\03_FACTORY\PRODUCTS\ARTICLES\`
- **マッチアップメモ**: `d:\my_work\01_INTEL\matchup_memo\index.html`
- **Webポータル**: デプロイ後のURL、またはローカル開発環境 (`npm run dev`)

---

## 📈 現在のステップ: MVP 第2段階
- [x] 全エンジンの統合（Orchestrator）
- [x] ソロキュー自動監視の実装
- [x] クラウド同期エンジンの実装
- [ ] Supabase 連携完了 ➔ Webポータル正式稼働
