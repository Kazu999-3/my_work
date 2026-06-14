# Sovereign OS & KTM Bot 詳細設計仕様書 (Detailed System Design Specification)

Sovereign OS プロジェクトにおける、Webポータル、大会運営Bot (KTM Bot)、コア自動化エンジン、およびデータベース (Supabase) の全体像、機能、データ連携、およびロジックの設計仕様を詳細に定義します。本ドキュメントは、今後の機能追加やシステム改修時の「単一真実源 (Source of Truth)」として機能します。

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

### 1-2. データフローシーケンス

#### A. YouTube動画攻略ライブラリ化 & 辞典マージのライフサイクル
ポータルから動画URLが登録され、自動マージ、そして不要ファイルが一掃されるまでの全フローです。

```mermaid
sequenceDiagram
    autonumber
    actor Admin as 管理者
    participant Portal as ポータル (Next.js)
    participant Queue as kirei_queue.json
    participant SRE as SRE Daemon (Python)
    participant YTA as YouTube Absorber
    participant Gemini as Gemini API (Paid/Free)
    participant DB as Supabase DB (bible_articles)
    participant DS as Dict Synthesizer

    Admin->>Portal: 動画URLを登録
    Portal->>Portal: yt-dlp でタイトル自動取得 (ローカル環境)
    Portal->>Queue: 状態を 'pending' で登録
    Note over SRE, YTA: SRE Daemon が15分毎に Absorber を起動
    SRE->>YTA: run_cycle() 起動
    YTA->>Queue: 'pending' の動画をロード
    YTA->>YTA: yt-dlp で英語字幕 (VTT) をダウンロード
    YTA->>Gemini: 字幕を渡し、日本語攻略バイブル生成を依頼
    Gemini-->>YTA: 攻略バイブル (Markdown) の返却
    YTA->>DB: 新規記事登録 (champion="Unknown", title="[YouTube] ...")
    YTA->>Queue: 状態を 'completed' に更新
    Note over SRE, DS: SRE Daemon が3時間毎に Synthesizer を起動
    SRE->>DS: process_library_genres() 起動
    DS->>DB: 汎用記事 (Unknown/GLOBAL) をロード
    DS->>Gemini: マクロ等のジャンル別に統合要約を依頼
    Gemini-->>DS: 統合された「総合バイブル」の返却
    DS->>DB: 「総合バイブル」記事を更新保存
    DS->>DB: マージ元の個別記事の keywords を ["__DELETED__"] に更新
    Note over SRE: SRE Daemon が15秒毎にクリーンアップ起動
    SRE->>DB: keywords が "__DELETED__" の記事を検知
    SRE->>SRE: ローカルの該当 Markdown ファイルを物理削除
    SRE->>DB: DBからレコードを完全抹消 (DELETE)
```

#### B. Redditトレンド自律検出 ＆ 総合バイブル自動マージのフロー
海外のRedditからLoLのメタ情報を自律検知し、自動的に攻略ライブラリへ蓄積するフローです。

```mermaid
sequenceDiagram
    autonumber
    participant SRE as SRE Daemon
    participant RS as Reddit Scout
    participant Reddit as Reddit API (json)
    participant Gemini as Gemini API
    participant DB as Supabase DB
    participant DS as Dict Synthesizer

    Note over SRE, RS: SRE Daemon が12時間毎に Scout を起動
    SRE->>RS: run_scout() 起動
    RS->>Reddit: r/summonerschool, r/leagueoflegends から hot.json を取得
    RS->>RS: LoLメタ/ビルドに関連するホットスレッドを抽出 (上位5件)
    RS->>Gemini: スレッド議論テキストを渡し、パッチトレンド要約を依頼
    Gemini-->>RS: 日本語のトレンド分析記事 (Markdown) の返却
    RS->>DB: 新規記事を登録 (title="[Redditトレンド]...", keywords=["Reddit","トレンド","マクロ"])
    Note over SRE, DS: SRE Daemon が3時間毎に Synthesizer を起動
    SRE->>DS: process_library_genres() 起動
    DS->>DB: キーワードに "マクロ" を含む記事 (Redditトレンド等) をロード
    DS->>Gemini: 既存のマクロ総合バイブルとマージ要約を依頼
    Gemini-->>DS: アップデートされた「総合バイブル [マクロ]」の返却
    DS->>DB: 「総合バイブル [マクロ]」を更新保存
    DS->>DB: 元の [Redditトレンド] 記事の keywords を ["__DELETED__"] に更新
    Note over SRE: SRE Daemon が15秒後にDB及びローカルファイルを完全抹消
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
| `enemy` | text | - | 对面チャンピオン名 (基本対策は `GLOBAL`) |
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

---

## 3. Webポータル APIインターフェース仕様 (Web Portal API)

Next.js (App Router) 側の管理者専用APIエンドポイントの仕様です。インポート解決時のビルドエラーを避けるため、絶対パスエイリアス (`@/`) は使用せず、相対パスを厳守しています。

### 3-1. `/api/admin/design` (設計書編集・自動デプロイ)
ポータルからシステム設計書（`SYSTEM_DESIGN.md`）を上書きし、自動で Git Commit/Push をトリガーします。

* **メソッド**: `POST`
* **認証**: Basic認証必須
* **リクエストボディ**:
  ```json
  {
    "content": "# 新しい設計書本文 (Markdown)"
  }
  ```
* **レスポンス (200 OK)**:
  ```json
  {
    "success": true,
    "message": "設計書を保存しました。バックグラウンドで自動デプロイを開始しました。"
  }
  ```
* **非同期挙動**:
  APIはファイル書き込み後、ただちにレスポンスを返却し、バックグラウンドで以下のシェルコマンドを非同期に `exec` します：
  ```bash
  git add ../SYSTEM_DESIGN.md src/app/design/SYSTEM_DESIGN.md && git commit -m "docs: update system design via portal dashboard" && git push origin master
  ```

### 3-2. `/api/admin/youtube` (YouTubeキュー管理)
ポータル上のYouTubeキュー管理UIからの指示をハンドリングします。

* **メソッド / 挙動**:
  - **`GET`**: `kirei_queue.json` の全リストを返却。
    - **レスポンス (200 OK)**:
      ```json
      [
        {
          "id": "1MZbnoN064o",
          "title": "Master Yi Guide",
          "url": "https://www.youtube.com/watch?v=1MZbnoN064o",
          "status": "completed",
          "retry_count": 0
        }
      ]
      ```
  - **`POST`**: 新規動画をキューに登録。
    - **リクエストボディ**: `{"url": "https://www.youtube.com/..."}`
    - **処理フロー**: `yt-dlp` が利用可能なローカル環境の場合は自動で動画の `title` を取得。無ければ `YouTube Video` として登録。IDの重複があれば `400 Bad Request`。
  - **`PUT`**: 特定動画のステータス書き換え（再試行指示など）。
    - **リクエストボディ**: `{"id": "1MZbnoN064o", "status": "pending"}`
    - **挙動**: 指定ステータスに上書きし、`retry_count` を `0` にリセット。
  - **`DELETE`**: キューから該当動画を削除。
    - **リクエストボディ**: `{"id": "1MZbnoN064o"}`

### 3-3. `/api/mmr/rebuild` (MMR再計算)
過去の全試合結果から、全プレイヤーの各レーンMMRおよび総合MMRを時系列に沿って一括再計算・更新します。

* **メソッド**: `POST`
* **認証**: 管理者キー `SUPABASE_KEY` / `SUPABASE_SERVICE_ROLE_KEY` を内部解決して RLS ポリシーをバイパス。
* **処理フロー**:
  1. 全プレイヤー of MMRを初期値（最高ランクと希望ロールに基づく値）でリセット。
  2. `ktm_matches` を `created_at` 昇順で取得し、1試合ごとに全参加者のMMR変動値（`delta`）を動的に対面MMRを参照して再計算（A方式）。
  3. 各試合の参加者の `mmr_delta` と、プレイヤーの最終MMRを Supabase に一括保存。更新対象行数 0 行時の安全ガード例外を搭載。
* **レスポンス (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Rebuild completed for 55 players over 70 matches."
  }
  ```

### 3-4. `/api/mmr/check-integrity` (MMR整合性検証)
メモリ上の累積シミュレーション値と、データベース（`ktm_players`）に保存されている最終MMR値の整合性を検証します。

* **メソッド**: `GET`
* **処理仕様**:
  - **ロール名の表記揺れ吸収**: 参加者データからキー名を生成する際、ロール名を `toUpperCase()` に変換して `expectedJg` / `expectedSup` などのキャメルケースで正しく期待値を読み込む。
  - **極小誤差の許容（しきい値）**: 浮動小数点演算や丸め処理に伴う 1～2 程度の極小誤差（IEEE 754丸め誤差）による偽陽性を防ぐため、各レーンの差が **`2` 以内** であれば整合（不整合なし）と判定する。
* **レスポンス (200 OK - 不整合なし時)**:
  ```json
  {
    "success": true,
    "hasDiscrepancy": false,
    "discrepancyCount": 0,
    "discrepancies": []
  }
  ```

---

## 4. コア自動化エンジン詳細設計 (Sovereign OS Core)

Python バックエンドモジュールにおけるクラスとロジックの設計です。

### 4-1. 常駐監視デーモン (`sre_daemon.py`)
システムエラーを自律的に監視しつつ、各種軽量化タスク・メトリクス連携を別スレッドで並行実行する常駐型デーモンです。

* **主要メソッド**:
  - `run()`: メインスレッドで `sovereign_os.log` のサイズ変更と例外検知を1秒おきにポーリング監視。同時に、4つの並列デーモンスレッド（`DictSynthesizer` ループ、`YouTubeAbsorber` ループ、`RedditScout` ループ、`Cleanup` ループ、`Metrics` ループ）を起動。
  - `_process_error_buffer(error_buffer)`: エラー文字列からMD5ハッシュで指紋を生成。1時間以内の同一エラーは通知を抑制。新規エラーは `analyze_error_with_ai()` を実行して Discord へ通知。
  - `analyze_error_with_ai(error_text)`: Gemini API を使用し、エラー原因と「次にユーザーがとるべき解決アクション」を要約。

* **スレッド並行タスク仕様**:
  1. **DictSynthesizer (3時間おき)**: `dict_synthesizer.py` を外部プロセスとして `subprocess.run` 実行。
  2. **YouTubeAbsorber (15分おき)**: `youtube_absorber.py` を外部プロセスとして実行。API制限回避のため、1回の起動で最大3本のみ処理。
  3. **RedditScout (12時間おき) [New]**: `reddit_scout.py` を外部プロセスとして実行。
  4. **Cleanup (15秒おき)**: Supabaseで `__DELETED__` キーワードを持つ記事レコードをスキャンし、対応するローカル Markdown ファイルを削除後、Supabaseから物理 `DELETE`。
  5. **Metrics (15秒おき)**: YouTubeのキュー残数やログ末尾20行を集計し、Supabaseの `SYSTEM_METRICS` レコードに `UPSERT` 送信。

### 4-2. Redditトレンド自律収集 (`reddit_scout.py`) [New]
Redditからメタ情報・ビルドの流行を検知し、自動的に攻略ライブラリ（`bible_articles`）へ流し込む自律スカウトエンジン。

* **主要メソッド**:
  - `fetch_reddit_trends(subreddit, limit)`: RedditのパブリックJSON（例: `r/summonerschool/hot.json`）へ、カスタム User-Agent ヘッダーを付与して GET リクエストを送信。タイトルや本文に LoL 関連キーワード（`build`, `meta`, `patch` 等）が含まれるスレッドを最大5件抽出。
  - `analyze_trends(posts)`: 抽出したスレッドの議論テキストを結合し、Gemini API (`gemini-2.5-pro` / Paid) に送信。日本語でトレンド分析ドキュメント（要約・ルーン・ビルド評価・対策）を生成。
  - `run_scout()`: 上記を実行し、取得データを Supabase の `bible_articles` テーブルに登録。同時にローカルの `02_FACTORY/bible/kirei_bible/` 配下に `{日付}.md` 形式で保存。

### 4-3. API頻度制限・キー制御モジュール (`ai_helper.py`)
クォータ制限 (429) やサーバー一時エラー (503) からシステムを死守する、高耐久なAPIラッパー。

* **主要ロジック (generate_content_safe)**:
  - **頻度制御**: `api_throttle.lock` によるファイルロック制御と強制スリープにより、全プロセス合計でのリクエスト間隔を最低 **20.0秒** 空ける。
  - **フォールバック**: 無料キー（`GEMINI_API_KEY_FREE`）で最大3回試行し、429制限を検知した場合は即座に処理を打ち切って有料キー（`GEMINI_API_KEY`）に切り替え。有料キーでは最大15回の指数バックオフ（Exponential Backoff）リトライを実行。
  - **モデル自動遷移**: 404エラー（非推奨モデル `gemini-1.5` などの指定）を検知した場合は、キー切り替えをスキップして次の優先モデル（`gemini-2.5-pro` ➔ `gemini-2.5-flash` ➔ `gemini-2.0-flash`）へ移行。

---

## 5. KTM Discord Bot 設計 (`ktm_bot`)

KTM Bot は、LoLカスタムマッチのメンバー募集、レーン決定、チーム分け、戦績管理を Discord 上で完結させるDiscord Botです。

### 5-1. 実行環境とデータ連携
* **Cloudflare Workers (Edge)**: Discordからのスラッシュコマンドやボタンインタラクションの Webhook を超高速かつ低遅延でレシーブ。暗号署名検証（`discord-interactions`）を行い、バックエンドの GAS へ HTTPS 経由でデータをリレー。
* **Google Apps Script (GAS)**: 全てのマッチング、チーム分け、MMRの計算を実行するコアバックエンド。
* **Google Sheets (データベース)**: `対戦入力`, `メンバーデータ`, `対戦履歴` などのシートをデータベースとして活用。

### 5-2. KTM Balancer チーム分けロジック仕様
バランサーは、単なるランダム分けではなく、プレイヤー全員が納得しつつ、ゲームが最も均衡する組み合わせを以下のアルゴリズムで決定します。

* **状態変数**:
  1.  **MMR (内部レート)**: 各プレイヤーはロール（TOP, JG, MID, ADC, SUP）ごとに独立したMMRを保有（初期値: 1200）。勝敗結果と対面とのMMR差に基づいてEloレーティング式（K=32）で増減。
  2.  **Pity (不運度 / 調整弁)**: 希望レーンに配置されなかった不満度を累積するカウンター。
      - メインレーンに配置: `0` にリセット
      - サブレーン（第2希望）に配置: `+2`
      - NGまたは希望外レーンに配置: `+5`
      - 定員オーバーで試合に出られず観戦/待機: `+10`
      *※Pity値が高いプレイヤーほど、次回のチーム分けで優先的にメインレーンに選出されます。*

* **配置ペナルティ評価アルゴリズム**:
  全プレイヤーのロール割り当ての全パターンに対し、以下のペナルティ加算処理を行い、**総合ペナルティが最小となる組み合わせ**を選出します。
  1.  **NGレーン配置ペナルティ**: `2,000,000 pt` (絶対回避)
  2.  **希望外（メイン・サブ以外）配置**: `500,000 pt` + (Pityによる割引補正)
  3.  **サブレーン配置**: `20,000 pt` + (Pityによる割引補正)
  4.  **こだわり度 (Weight) 補正**:
      - weight=1 (絶対): サブ/希望外配置時のペナルティを 50倍 に増幅
      - weight=3 (柔軟): サブ/希望外配置時のペナルティを 1/4 に軽減
  5.  **専門職（JG/SUP/ADC専）の希望外配置**: 追加ペナルティ (×2〜×3)
  6.  **初心者（試合数極少）の JG/MID 配置**: `1,000,000 pt` (大破滅ペナルティ)

* **チーム戦力均衡化処理**:
  ロール配置確定後、以下の項目を評価値として算出し、BlueチームとRedチームの戦力が最も近くなるようシャッフルします。
  1.  **対面MMR差の平準化**: 各レーン（例: Team A TOP vs Team B TOP）のMMR差の2乗和を最小化。
  2.  **総合MMR差の極小化**: チーム合計MMRの差を最小化。
  3.  **直近勝率の平準化**: 勝率が極端に高い人と低い人が同一チームに入りやすくなる補正。
  4.  **格上対面の保護**: MMR差が600以上開いている場合、メインレーン以外の対面配置に大ペナルティを設定。

## 6. Webポータル UI/UX 設計 (Web Portal UI/UX Design)

Sovereign OS Webポータルは、管理者および一般ユーザーの利用シーンに合わせて最適化された、高レスポンスで視認性の高いUI/UXを提供します。

### 6-1. PC用サイドバーの最小化（Collapse / Expand）仕様
PC大画面での作業領域を最大化するため、サイドバーを最小化する機能を備えています。
- **状態管理と永続化**:
  サイドバーの開閉状態（`isCollapsed`）は `localStorage` (`sovereign_sidebar_collapsed`) で保持され、画面の再読み込みや遷移後も設定が維持されます。
- **動的レイアウト**:
  - **展開時 (`w-64`, `p-8`)**: 通常のフルテキスト＆ロゴ表示。
  - **最小化時 (`w-20`, `px-3 py-6`)**:
    - ロゴ: アイコン (`Shield`) のみを表示し、文字 (`SOVEREIGN`) は非表示。
    - メニュー項目: ラベルテキストを非表示にし、アイコンを中央寄せで縦に整列して配置（ホバーでメニュー名がツールチップ視認可能）。
    - フッター: ステータスの緑点滅ドットのみを表示し、テキストを非表示。
  - **お気に入りパネルの変形**:
    最小化時はお気に入りチャンピオンの丸型アイコンのみを縦一列でコンパクトに表示し、記事一覧やラベルは非表示とします。

### 6-2. 管理者ログイン時のメニュー構成の整理とタブ化
管理者エリア（`/ktm-admin` 等）へのログイン時は、豊富な管理機能をすっきりと整理するため、メニューのグループ切り替えを導入しています。
- **「過去の試合履歴」の除外**:
  管理者の日常運用において不要な「過去の試合履歴」は、管理者メニューから除外されています。
- **メニュー表示切り替えタブ (PC版)**:
  サイドバー上部に「管理者機能」と「一般機能」を切り替えるタブUI（最小化時はアイコン付きトグル）を設置し、目的の機能にワンクリックで切り替え可能です。
- **スマホ版ボトムナビゲーション同期**:
  スマホ画面でメニューが横に溢れるのを防ぐため、ボトムナビの最後の項目に「一般へ」/「管理へ」の動的トグル切り替えボタンを配置し、表示項目をスマートに制御します。

---

🛡️ **Sovereign OS & KTM Bot Detailed System Design Specification - Documented by Antigravity**

