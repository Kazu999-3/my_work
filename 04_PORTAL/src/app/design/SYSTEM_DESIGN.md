# Sovereign OS & KTM Bot 全体設計書 (System Design Specification)

Sovereign OS プロジェクトにおける、Webポータル、大会運営Bot (KTM Bot)、コア自動化エンジン、およびデータベース (Supabase) の全体像、機能、データ連携、およびロジックの設計仕様を定義します。本ドキュメントは、今後の機能追加やシステム改修時の「単一真実源 (Source of Truth)」として機能します。

---

## 1. システム全体アーキテクチャ (System Overview)

Sovereign OS は、Supabase データベースおよび Google Sheets を中心とし、フロントエンド（Next.js / Discord）とバックエンド自動化エンジン（Python Core / Cloudflare Workers / GAS）が連携する分散イベント駆動型アーキテクチャです。

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
        Pulse[Sovereign Pulse]
    end

    SREDaemon --> |Watch Log / Cleanup| Supabase
    SREDaemon --> |Metrics Save| Supabase
    DictSynthesizer <--> |Fetch / Merge / Mark deleted| Supabase
    YTAbsorber <--> |Read Queue / Write Video Data| Supabase
    Pulse --> |Observer SoloQ / Scraping| Supabase
    Sovereign_OS_Core <--> |AI Request| Gemini[Gemini API (ai_helper)]
```

---

## 2. データベース設計 (Database Schema & Security)

システムは **Supabase (PostgreSQL)** および **Google Sheets**（KTM Bot用）のハイブリッド構成を採用しています。

### 2-1. Supabase テーブル定義

#### A. `bible_articles` (攻略ライブラリ記事)
汎用的なマクロや、各チャンピオンごとの攻略記事を保存します。

| カラム名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- |
| `id` | int8 | PRIMARY KEY (Identity) | 記事の一意ID |
| `created_at` | timestamptz | DEFAULT `now()` | 作成日時 |
| `title` | text | UNIQUE | 記事タイトル (例: `[総合バイブル] マクロ`) |
| `content` | text | - | 記事本文 (Markdown形式) |
| `champion` | text | - | 対象チャンピオン名 (指定なしは `Unknown`, `GLOBAL` 等) |
| `keywords` | text[] | - | 検索タグ・ジャンル名 (例: `["マクロ", "総合バイブル"]`, 削除対象は `["__DELETED__"]`) |
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
| `raw_data` | jsonb | - | 拡張用JSONデータ。noteドラフト原稿 (`note_draft`) やシステムメトリクス (`logs`, `queue`) を内包 |

#### C. `api_usage_logs` (API使用量ログ)
1日あたりのAPI（Gemini等）の消費トークン・リクエスト数を蓄積し、クォータオーバーを防止します。

| カラム名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- |
| `date` | date | PRIMARY KEY | 利用日 (日付) |
| `calls` | jsonb | - | 機能ごとのAPI呼び出し回数・エラーカウント履歴 |

---

### 2-2. Row Level Security (RLS) ポリシー
Supabaseを全世界公開するため、不正書き込みを防ぐ二重の防壁を構築しています。

1.  **読み取りポリシー (SELECT)**
    - 全テーブルに対し、`USING (true)` ポリシーを設定。**未認証ユーザー（一般訪問者）を含め、全員が高速に読み取り可能**。
2.  **書き込み/変更ポリシー (INSERT / UPDATE / DELETE)**
    - 一般Webユーザーによる改ざんを防止するため、`authenticated` (認証済み管理者アカウント) のみに許可を制限。
    - システムの自動処理（Python Core / GAS）は、バックエンド用の `service_role` キー（バイパス権限）を使用することで、RLS制限を安全に迂回します。

---

## 3. Webポータル設計 (`04_PORTAL`)

Webポータルは **Next.js (App Router)** をベースに構築され、レスポンシブでプレミアムなデザイン（ダークモード、スムーズなトランジション）を提供します。

### 3-1. ディレクトリ構造と絶対パスの禁止原則
- **絶対パスエイリアスの禁止**: Vercelなどの本番ホスティング環境において、絶対パスエイリアス（`@/`）はインポート解決時のビルドエラー (`module-not-found`) を頻発させます。そのため、すべてのコンポーネントインポートには **相対パス (`../../components/...` 等)** を厳格に用います。

### 3-2. 主要ルーティングと機能

*   **`/` (トップページ / ダッシュボード)**
    - システムの稼働ステータス、YouTube 吸収キューの残数、最新のシステムログ（`SYSTEM_METRICS` から取得）を表示。
*   **`/matchups` (マッチアップ・チャンピオン辞典)**
    - `champion` と `enemy` のクエリパラメータとフォームが連携。選択されたチャンピオンの基本情報、ビルド、対面対策、およびAIが作成した `noteドラフト原稿` を閲覧・コピー可能。
*   **`/balancer` (Web版バランサー)**
    - Discordと連携し、現在カスタムに参加中の10名のレーン調整、MMRを考慮したチーム分けをWeb上でシミュレート・微調整可能。
*   **`/leaderboard` (リーダーボード)**
    - 大会参加者全員のロール別MMR、勝率、試合数をランキング表示。
*   **`/library` (攻略ライブラリ)**
    - 自動マージされた「総合バイブル」や、パッチ解説などの攻略情報を検索・閲覧。

---

## 4. KTM Discord Bot 設計 (`ktm_bot`)

KTM Bot は、LoLカスタムマッチのメンバー募集、レーン決定、チーム分け、戦績管理を Discord 上で完結させるDiscord Botです。

### 4-1. 実行環境とデータ連携
- **Cloudflare Workers (Edge)**
  - Discordからのスラッシュコマンドやボタンインタラクションの Webhook を超高速かつ低遅延でレシーブ。
  - 暗号署名検証（`discord-interactions`）を行い、バックエンドの GAS へ HTTPS 経由でデータをリレーします。
- **Google Apps Script (GAS)**
  - 全てのマッチング、チーム分け、MMRの計算を実行するコアバックエンド。
- **Google Sheets (データベース)**
  - `対戦入力`, `メンバーデータ`, `対戦履歴` などのシートをデータベースとして活用。

---

### 4-2. KTM Balancer チーム分けロジック仕様
バランサーは、単なるランダム分けではなく、プレイヤー全員が納得しつつ、ゲームが最も均衡する組み合わせを以下のアルゴリズムで決定します。

#### A. 状態変数
1.  **MMR (内部レート)**: 各プレイヤーはロール（TOP, JG, MID, ADC, SUP）ごとに独立したMMRを保有（初期値: 1200）。勝敗結果と対面とのMMR差に基づいてEloレーティング式（K=32）で増減。
2.  **Pity (不運度 / 調整弁)**: 希望レーンに配置されなかった不満度を蓄積するカウンター。
    - メインレーンに配置: `0` にリセット
    - サブレーン（第2希望）に配置: `+2`
    - NGまたは希望外レーンに配置: `+5`
    - 定員オーバーで試合に出られず観戦/待機: `+10`
    *※Pity値が高いプレイヤーほど、次回のチーム分けで優先的にメインレーンに選出されます。*

#### B. 配置ペナルティ評価アルゴリズム
全プレイヤーのロール割り当ての全パターンに対し、以下のペナルティ加算処理を行い、**総合ペナルティが最小となる組み合わせ**を選出します。

```
[ペナルティ計算項目]
1. NGレーン配置ペナルティ: 2,000,000 pt (絶対回避)
2. 希望外（メイン・サブ以外）配置: 500,000 pt + (Pityによる割引補正)
3. サブレーン配置: 20,000 pt + (Pityによる割引補正)
4. こだわり度 (Weight) 補正:
   - weight=1 (絶対): サブ/希望外配置時のペナルティを 50倍 に増幅
   - weight=3 (柔軟): サブ/希望外配置時のペナルティを 1/4 に軽減
5. 専門職（JG/SUP/ADC専）の希望外配置: 追加ペナルティ (×2〜×3)
6. 初心者（試合数極少）の JG/MID 配置: 1,000,000 pt (大破滅ペナルティ)
```

#### C. チーム戦力均衡化処理
ロール配置確定後、以下の項目を評価値として算出し、BlueチームとRedチームの戦力が最も近くなるようシャッフルします。
1.  **対面MMR差の平準化**: 各レーン（例: Team A TOP vs Team B TOP）のMMR差の2乗和を最小化。
2.  **総合MMR差の極小化**: チーム合計MMRの差を最小化。
3.  **直近勝率の平準化**: 勝率が極端に高い人と低い人が同一チームに入りやすくなる補正。
4.  **格上対面の保護**: MMR差が600以上開いている場合、メインレーン以外の対面配置に大ペナルティを設定。

---

## 5. Sovereign OS コアエンジン設計 (`v2_CORE`)

Pythonで構築された自動化エンジン群であり、SRE daemon を主軸として自律的なデータ更新・保守ループを実行します。

### 5-1. 常駐監視デーモン (`sre_daemon.py`)
システムエラーを自律的に監視しつつ、各種軽量化タスク・メトリクス連携を別スレッドで並行実行する常駐型デーモンです。

- **エラー検出 & AI解析ループ**:
  - `00_LOGS/sovereign_os.log` を1秒おきに監視。
  - `ERROR`, `Exception`, Playwrightの `TimeoutError` を検知すると、後続のスタックトレースを2秒間収集して一時バッファに保存。
  - 重複報告抑制フィルター（同じエラーは1時間サイレント化）を通したのち、Gemini API (`ai_helper`) でエラー原因と解決アクションを自律解析。
  - 解析結果を Discord に自動通知 (Auto-Healer プロトコル)。
- **SRE定期駆動タスク (サブスレッド)**:
  1.  `run_synthesizer_loop()`: 3時間ごとに `dict_synthesizer.py` を呼び出し、チャンピオン辞典・汎用記事をAIマージ。
  2.  `run_youtube_absorber_loop()`: 15分ごとに `youtube_absorber.py` を呼び出し、未処理の攻略動画を順番に解析。
  3.  `cleanup_deleted_files_loop()`: 15秒ごとに、Supabaseで `keywords` に `__DELETED__` が設定された攻略記事を検知し、**対応するローカルファイルを物理削除した上で、SupabaseのDBレコードからも完全抹消**する。
  4.  `publish_system_metrics_loop()`: 15秒ごとに、YouTubeのキュー件数、最新ログ20行を収集し、Supabaseの `SYSTEM_METRICS` レコードに送信（ポータルでの可視化用）。

---

### 5-2. AIマージエンジン (`dict_synthesizer.py`)
攻略ライブラリ内に散らばった記事を体系的な「総合バイブル」へと自動マージするモジュールです。

- **ジャンル別自動判定**:
  - チャンピオン名が未設定の汎用的な記事を、タイトル・本文・キーワードから「マクロ」「ジャングルルート」「集団戦」「ドラフト」の4ジャンルに分類。
- **バッチ制限による429回避設計**:
  - 対象ジャンルに2件以上の新規記事がある場合マージ対象とする。
  - **APIの429エラーを回避するため、一度にマージする記事数は最大5件までに制限**。
  - すでに既存の `[総合バイブル] {ジャンル名}` 記事が存在する場合は、その内容を「既存の総合バイブル」として先頭に結合した状態でAIに渡し、差分を追記マージさせる。
- **クリーンアップ連携フラグ**:
  - マージが正常に完了した直後、マージ元の個別記事の `keywords` を `["__DELETED__"]` に書き換える。これにより、SREデーモンのクリーンアップスレッドによってローカルファイルとDBレコードが安全に自動消滅します。

---

### 5-3. API頻度制限・キー制御モジュール (`ai_helper.py`)
クォータ制限 (429) やサーバー一時エラー (503) からシステムを死守する、高耐久なAPIラッパーです。

*   **クロスプロセスAPIロック & スロットリング**:
    - 複数のスクリプト（SRE, YouTube, Synthesizer等）が同時に起動しても、APIリクエストの衝突を防ぐため、`api_throttle.json` に対するファイルロック (`FileLock`) を実行。
    - リクエスト間隔を最低 **20.0秒 (MIN_REQUEST_INTERVAL)** 空けるように、プロセスを強制スリープ制御します。
*   **無料キー/有料キーの自動フォールバック**:
    1.  まず `settings.GEMINI_API_KEY_FREE` (無料キー) を使用して 3回 リクエストを試行。
    2.  無料キーで 429 エラー (枯渇) を検知した場合、即座に試行を打ち切り、`settings.GEMINI_API_KEY` (有料キー) に切り替える。
    3.  有料キーでは、最大 15回 の指数バックオフ（Exponential Backoff）リトライを実施。
*   **動作不可モデルの排除仕様**:
    - 利用可能なモデルリスト: `gemini-2.5-pro` (Pro推奨), `gemini-2.5-flash` (デフォルト), `gemini-2.0-flash`
    - ※以前の `gemini-1.5-xxx` 系は、APIエンドポイントの廃止により **404 Not Found** を返すため、`models_to_try` リストから完全に排除されています。
*   **予算キャップ (Spending Cap) 制限時の即時通知**:
    - 有料キーで `Your project has exceeded its monthly spending cap.` を検知した場合は、無駄なリトライ待機ループを回避するため、詳細メッセージをログに記録し、システム管理者へ警告を行います。

---
🛡️ **Sovereign OS & KTM Bot System Architecture - Documented by Antigravity**
