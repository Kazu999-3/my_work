# Sovereign OS & KTM Bot 全体概要・アーキテクチャ設計

Sovereign OS プロジェクトにおける、Webポータル、大会運営Bot (KTM Bot)、コア自動化エンジン、およびデータベース (Supabase) の全体像、機能、データ連携、およびロジックの設計仕様を詳細に定義します。

---

## 1. システム全体アーキテクチャ (System Architecture)

Sovereign OS は、Supabase データベースおよび Google Sheets を中心とし、フロントエンド（Next.js / Discord）とバックエンド自動化エンジン（Python Core / Cloudflare Workers / GAS）が連携する分散イベント駆動型アーキテクチャです。

### 1-1. システム関連図

```mermaid
graph TD
    %% ユーザーおよびインターフェース
    User[ユーザー / プレイヤー] <--> |Discord Slash Cmd / UI| Discord[Discord Server]
    User <--> |Webブラウザ| Portal[Web Portal (Next.js)]

    %% Discord Bot 連携
    Discord <--> |Interactivity Webhook| Workers[KTM Bot (Cloudflare Workers)]
    Workers <--> |HTTPS API Call| GAS[Google Apps Script (GAS)]
    GAS <--> |Read/Write| Sheets[Google Sheets (DB/MMR)]
    GAS <--> |HTTP Trigger| PortalAPI[Portal API (Next.js)]

    %% Webポータル 連携
    Portal <--> |Read/Write| Supabase[(Supabase DB)]
    PortalAPI <--> |Read/Write| Supabase

    %% Sovereign OS コア (Python)
    subgraph Sovereign_OS_Core [Sovereign OS Core Engine]
        SREDaemon[SRE Daemon]
        DictSynthesizer[Dict Synthesizer]
        YTAbsorber[YouTube Absorber]
        RedditScout[Reddit Scout]
        Pulse[Sovereign Pulse]
    end

    SREDaemon --> |Watch Log / Cleanup| Supabase
    SREDaemon --> |Metrics Save| Supabase
    DictSynthesizer <--> |Fetch / Merge / Mark deleted| Supabase
    YTAbsorber <--> |Read Queue / Write Video Data| Supabase
    RedditScout <--> |Scrape Trends / Write Articles| Supabase
    Pulse --> |Observer SoloQ / Scraping| Supabase
    Sovereign_OS_Core <--> |AI Request| Gemini[Gemini API (ai_helper)]
```

---

## 2. データベース設計 (Database Schema & Security)

### 2-1. Supabase テーブル定義

#### A. `bible_articles` (攻略ライブラリ記事)
マクロ判断や、各チャンピオンごとの攻略バイブル記事、および一時的なトレンド記事をMarkdown形式で保存します。

| カラム名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- |
| `id` | int8 | PRIMARY KEY (Identity) | 記事の一意ID |
| `created_at` | timestamptz | DEFAULT `now()` | 作成日時 |
| `title` | text | UNIQUE | 記事タイトル (例: `[総合バイブル] マクロ`) |
| `content` | text | - | 記事本文 (Markdown形式) |
| `champion` | text | - | 対象チャンピオン名 (指定なしは `Unknown`, `GLOBAL` 等) |
| `keywords` | text[] | - | 検索タグ・ジャンル名 (例: `["マクロ", "総合バイブル"]` / 削除用タグは `["__DELETED__"]`) |
| `file_path` | text | - | ローカルのMarkdownファイルの保存先絶対パス |

#### B. `matchup_sentinel` (チャンピオン辞典 & 戦術データ)
各チャンピオンごとの対策やGLOBALなマクロ、さらにダッシュボード用システムメトリクス（ID: `SYSTEM_METRICS`）を保持します。

| カラム名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- |
| `id` | int8 | PRIMARY KEY (Identity) | レコードの一意ID |
| `created_at` | timestamptz | DEFAULT `now()` | 作成日時 |
| `matchup_id` | text | UNIQUE | 識別キー (例: `GLOBAL`, `SYSTEM_METRICS`, `{ChampName}_GLOBAL`) |
| `title` | text | - | チャンピオン名やタイトル |
| `champion` | text | - | チャンピオン名 |
| `enemy` | text | - | 対面チャンピオン名 (基本対策は `GLOBAL`) |
| `strategy` | text | - | 対面戦術・反省会から得られた鬼コーチの教訓 |
| `raw_data` | jsonb | - | 拡張用JSONデータ。`note_draft` (noteドラフト原稿) や `logs` (最新ログ)、`queue` (YouTubeキュー件数) を内包 |

#### C. `api_usage_logs` (API使用量ログ)
1日あたりのAPI（Gemini等）の消費トークン・リクエスト数を蓄積し、クォータオーバーを防止します。

| カラム名 | date | PRIMARY KEY | 利用日 (日付) |
| :--- | :--- | :--- | :--- |
| `calls` | jsonb | - | 機能ごとのAPI呼び出し回数・エラーカウント履歴 |

---

### 2-2. Row Level Security (RLS) ポリシー

全世界に安全に公開するため、Supabase上の各テーブルに以下のRLSを適用しています。

```sql
-- 読み取り許可 (未認証の一般ユーザーを含め、全員に許可)
CREATE POLICY "Allow read for all" ON bible_articles FOR SELECT USING (true);
CREATE POLICY "Allow read for all" ON matchup_sentinel FOR SELECT USING (true);

-- 書き込み・更新許可 (認証済み管理者アカウントのみに制限)
CREATE POLICY "Allow insert for admin" ON bible_articles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update for admin" ON bible_articles FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow delete for admin" ON bible_articles FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow insert for admin" ON matchup_sentinel FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update for admin" ON matchup_sentinel FOR UPDATE TO authenticated USING (true);
```
*※ローカルまたはVPSで動作する Python Core モジュールは、認証をバイパスする `service_role` キーを使用して書き込みを行います。*
