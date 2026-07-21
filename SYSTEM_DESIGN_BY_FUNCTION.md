# Sovereign OS & KTM 大会運営 システム完全機能技術仕様書 (UI/UXデザインシステム融合版)

Sovereign OS（大会運営KTM Bot、レートバランサー、AI偵察ポータル、自律自動化エンジン群）に組み込まれているすべての機能、内部アルゴリズム、プログラムコードパス、データベース構造、および連携API、そしてUI/UXデザイン仕様について詳細に定義した完全仕様書です。

---

# 1. システム構成 ＆ 3層アーキテクチャ

本システムは、Discord、Webブラウザ、および常駐型ローカル実行環境（Windows/Linux）を横断する**3層構造**で設計されています。

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

# 2. 大会運営 ＆ レートバランサー機能 (KTM Bot & Balancer)

LoL カスタムマッチ（内戦）の運営、メンバー管理、プレイヤーのMMR（内部レート）算出、レーン希望の調停、および戦力の均衡化を行う中核モジュール群。

## 2-1. メンバー募集機能 (`/recruit` コマンド)
* **役割**: Discord上でカスタムマッチの募集パネルを投稿し、参加者を自動集計・管理する。
* **主要コード・ファイルパス**:
  - `03_SYSTEMS/ktm_bot/src/handlers/commands.js`
* **詳細仕様**:
  - **募集コマンド**: `/recruit [mode] [time] [max] [memo] [player1...5]`
  - **ゲームモード**: `カスタム` (デフォルト10人)、`ノーマル` (デフォルト5人)、`ARAM` (デフォルト5人) に対応。
  - **ボタンインタラクション**:
    - ✋ **どこでも参加**: プレイヤーを参加者リストに追加。
    - ⏳ **カスタム待機** / 👁️ **観戦希望**: 待機枠・観戦枠に入る。
    - 🏃 **離脱**: 参加または観戦枠から名前を外す。
    - 👥 **代理追加** (募集主専用): Discordのアカウントを持たないゲストを選択して募集リストに直接挿入。
    - 📢 **一括連絡** (募集主専用): 参加者全員に対してDiscordメンション通知を送信。
    - 🚩 **募集終了** (募集主専用): 募集を手動で締め切る。
  - **自動締め切り**: 定員に達した瞬間、自動的にパネルのステータスが「⚔️ メンバー確定」に切り替わり、参加メンバーに一斉メンションで確定を通知。同時に、管理者向けの「🏆 チーム分け実行」ボタンを動的に表示。

## 2-2. 希望レーン設定機能 (`/lane` コマンド)
* **役割**: チーム分け時に、各プレイヤーの得意ポジションや配置制限を登録・記録する。
* **主要コード・ファイルパス**:
  - `03_SYSTEMS/ktm_bot/src/handlers/commands.js` (および `modals.js` での入力値受け取り)
  - データベース: Supabase テーブル `ktm_players`
* **詳細仕様**:
  - **設定値一覧**:
    - `main` (メインレーン): `TOP`, `JG`, `MID`, `ADC`, `SUP`, `ALL` (どこでも) から選択。
    - `sub` (サブレーン): 2番目に希望するレーン。
    - `ng1` / `ng2` (NGレーン): 行きたくないレーン。
    - `weight` (こだわり度 / 1〜3):
      - **1 (絶対)**: メインレーン配置を最優先。
      - **2 (通常)**: デフォルトの優先度。
      - **3 (柔軟)**: 他のプレイヤーの希望を優先し、メイン以外への配置を許容。
    - `allow_higher` (格上対面許容 / boolean): 自分よりMMRが著しく高いプレイヤーとのレーン対面マッチングを許可するかどうか。
  - **実行UI**: オプションなしで `/lane` を実行すると、Discordのモーダルフォームが出現し、設定可能。

## 2-3. チーム分け最適化機能 (`/balance` / Web `/balancer` ページ)
* **役割**: プレイヤーの希望レーン、NG、こだわり度、MMR、Pity（不運度）を総括計算し、最も不満が少なく、実力が均衡したチーム組み合わせを選出する。
* **主要コード・ファイルパス**:
  - Discord Bot: `03_SYSTEMS/ktm_bot/src/handlers/commands.js`
  - Web UI: `04_PORTAL/src/app/balancer/page.tsx`
  - チーム分けAPI: `04_PORTAL/src/app/api/balancer/route.ts`
  - アルゴリズムライブラリ: `04_PORTAL/src/lib/mmr.ts`
* **詳細仕様 ＆ 各種ロジック**:
  - **VC自動取得**: ボイスチャンネルに接続している10名を自動認識してプレイヤーリストを構築する。

  ### ① レーン配置ペナルティ算出アルゴリズム (Lane Optimization)
  10名のプレイヤーをBlueチーム5名、Redチーム5名の全レーン組み合わせに配置した際、以下のペナルティ合計値が最小になる組み合わせを採用する。
  
  $$\text{Total Penalty} = \sum_{p \in \text{Players}} (\text{Role Penalty}(p) + \text{Pity Penalty}(p) + \text{NG Penalty}(p) + \text{Job Penalty}(p))$$

  * **NG配置ペナルティ (NG Penalty)**:
    - プレイヤー $p$ が登録した `ng_lane_1` または `ng_lane_2` に配置された場合、**2,000,000 ポイント**のペナルティが加算され、配置が回避される。
  * **希望レーン外ペナルティ (Role Penalty & Pity Penalty)**:
    - **メインレーン配置**: 0 ポイント。
    - **サブレーン配置**: $20,000 \times \text{weight\_factor} - (\text{Pity値} \times 10,000)$ ポイント。
      - `weight` が 1 (絶対) の場合、ペナルティ係数は **50倍** ($1,000,000$ ポイント) に跳ね上がり、サブ配置を強力に阻止。
      - `weight` が 3 (柔軟) の場合、ペナルティ係数は **0.25倍** ($5,000$ ポイント) に減衰。
    - **希望外レーン（メイン・サブ以外）配置**: $500,000 \times \text{weight\_factor} - (\text{Pity値} \times 50,000)$ ポイント。
  * **専門職保護ペナルティ (Job Penalty)**:
    - メイン希望が `JG`, `SUP`, `ADC` であるプレイヤーを他のレーンに配置する場合、ペナルティが **2倍〜3倍** にブーストされる。
  * **初心者保護ペナルティ**:
    - 大会参加数が3戦未満の新規プレイヤーを `JG` または `MID` に配置する場合、**1,000,000 ポイント**の追加ペナルティを科す。

  ### ② Pity（不運度）システム
  「何試合も連続で希望外のレーンに回される」という不満を防ぐための優先順位調整ロジック。
  * **Pity加算・減算ルール**:
    - **試合終了時のPity更新**:
      - メインレーンに配置された場合 ➔ **0 にリセット**。
      - サブレーンに配置された場合 ➔ **+2**。
      - 希望外レーンに配置された場合 ➔ **+5**。
      - 試合に参加できず待機枠に入った場合 ➔ **+10**。

  ### ③ チーム戦力平準化アルゴリズム (Team Balance)
  * **評価式**:
    
    $$\text{Balance Score} = w_1 \cdot (\text{MMR}_{\text{TeamA}} - \text{MMR}_{\text{TeamB}})^2 + w_2 \cdot \sum_{\text{lane}} (\text{MMR}_{\text{A,lane}} - \text{MMR}_{\text{B,lane}})^2$$
    
  * **その他の補正要因**:
    - **初心者の分散**: 新規プレイヤーが片方のチームに偏らないように配置ペナルティを科す。
    - **対戦履歴の回避**: 直近5試合で同じレーンで直接対面したペアに対して、対面回避ペナルティ（10,000ポイント）を加算。

## 2-4. 勝敗報告 ＆ レート自動更新機能 (`BLUE勝利` / `RED勝利` ボタン)
* **役割**: 大会の勝敗を記録し、プレイヤーの「ロール別MMR」と「Pity」を自動更新し、戦績を共有する。
* **主要コード・ファイルパス**:
  - Discord Bot: `03_SYSTEMS/ktm_bot/src/handlers/components.js` (ボタンハンドラー)
  - バックエンド: `04_PORTAL/src/app/api/match/record/route.ts` (戦績書き込み・MMR計算API)
* **詳細仕様 ＆ レーティング計算式**:
  - **BLUE 勝利** / **RED 勝利** ボタンがクリックされると、以下の式で各プレイヤーの配置されたレーンのMMRを再計算する。

  ### MMR計算式（改良型 Elo レーティング）
  
  $$\text{MMR}_{\text{new}} = \text{MMR}_{\text{old}} + K \cdot (\text{Actual} - \text{Expected}) + \text{KDA Bonus} + \text{Placement Gravity}$$
  
  - $K$: 変動係数（デフォルト: 48）。
  - $\text{Actual}$: 勝利チーム = 1、敗北チーム = 0。
  - $\text{Expected}$ (期待勝率): 自分のロールMMRと対面相手のロールMMRの差から算出。
    
    $$\text{Expected} = \frac{1}{1 + 10^{\frac{\text{MMR}_{\text{opponent}} - \text{MMR}_{\text{self}}}{400}}}$$
    
  - $\text{KDA Bonus}$ (個人パフォーマンス補正):
    - 試合終了時の個人の KDA （キル・デス・アシスト）から最大 $\pm 20$ の補正値を加減算。
  - $\text{Placement Gravity}$ (初期ランク収束補正):
    - 大会参加数が10試合未満のプレイヤーに対して、公式最高ランク（Highest Rank）に対応する基礎MMRに引き寄せる補正を加算する。
  - **ブースト倍率**:
    - **プレースメント（新規参入）**: 5試合未満は変動量が **3倍**、10試合未満は **2倍** に跳ね上がる。
    - **対戦回数補正**: 直接対戦回数が少ない相手との試合では、変動量が最大 **1.5倍** となる。

## 2-5. 大会管理・MMR再構築機能 (`/ktm-admin`)
* **役割**: 管理者が、プレイヤー一覧の調整、MMRのマニュアル補正、および全過去ログからのMMR一括再計算を行う。
* **主要コード・ファイルパス**:
  - 管理ポータル画面: `04_PORTAL/src/app/ktm-admin/page.tsx`
  - MMR再計算API: `04_PORTAL/src/app/api/mmr/rebuild/route.ts`（実体は `src/lib/mmr.ts` の `performFullMmrRebuild`）
  - MMR整合性チェックAPI: `04_PORTAL/src/app/api/mmr/rebuild/route.ts` (または `check-integrity` API)

---

# 3. リアルタイム偵察 ＆ プレイヤー分析機能 (Soloq Scout & Junglepedia)

ソロキューで戦うプレイヤーを支援するため、Riot Games API や Gemini AI と連携し、敵ジャングラーのルート・癖の看破と、対面用の攻略アドバイスを提示する機能群。

## 3-1. ソロキュー対戦相手偵察 (Live Lookup)
* **役割**: プレイヤーがマッチに入った瞬間（または検索時）に稼働し、敵ジャングラーを特定、過去戦績とDB内の攻略マニュアル、過去の敗因メモを融合してAIが戦術対策を3箇条で生成する。
* **主要コード・ファイルパス**:
  - 偵察画面UI: `04_PORTAL/src/app/admin/soloq/page.tsx`
  - 偵察API: `04_PORTAL/src/app/api/admin/live-match/route.ts`
* **詳細仕様**:
  - PUUID取得、Spectator API経由の進行中の試合データ取得、Smite装備の敵を「敵ジャングラー」として自動特定。
  - 敵ジャングラーの直近10試合のソロキュー履歴・Timelineからクリアルートやアグレッシブ度を分析。
  - データベース内の `matchup_sentinel` (GLOBALマニュアル) ＆ `personal_knowledge` (自分の敗因反省) をマージし、AIリアルタイム指示3箇条を生成。
  - **過去の教訓警告バナー**: 過去に同じ対面チャンピオンで負けた「教訓」がある場合、画面最上部で赤いバナーが点滅。

## 3-2. Junglepedia レプリカ ＆ AI戦術アドバイザー
* **役割**: Junglepedia.lol で公開されているプレイヤー統計をオフラインで再現し、プレイスタイルに合わせたAI攻略アドバイスを提示する。
* **主要コード・ファイルパス**:
  - 表示画面UI: `04_PORTAL/src/app/player/[id]/junglepedia/page.tsx`
  - アドバイスAPI: `04_PORTAL/src/app/api/player/junglepedia/advice/route.ts`
* **詳細仕様**:
  - 6大プレイスタイルスライダー（ルート固定率、開始サイド、赤青選択、オブジェクト vs 戦闘、アグレッシブ度、クリア速度）を再現。
  - ドラゴン（1st〜4th+）、ヴォイドグラブ、ヘラルド、バロンそれぞれの獲得率・関与率・平均獲得時間のテーブル可視化。
  - **AI戦術アドバイス**: スライダー数値を分析し、本人向けの勝率UPアドバイスと、敵視点での対策をトグル表示。APIキー未設定時はモックを表示せず、赤色警告バナーを描画。

## 3-3. 対戦履歴 (`/history`)
* **主要コード・ファイルパス**:
  - `04_PORTAL/src/app/history/page.tsx`
* **詳細仕様**:
  - 過去に行われたカスタム大会（内戦）の全試合ログの一覧表。勝敗、実施日時、チーム構成員、プレイヤー別の使用チャンピオンとKDAスタッツをアコーディオン形式で展開表示。

## 3-4. リーダーボード ＆ 勝率マトリクス (`/leaderboard`)
* **主要コード・ファイルパス**:
  - `04_PORTAL/src/app/leaderboard/page.tsx`
  - `04_PORTAL/src/app/leaderboard/WinrateMatrixPanel.tsx`
* **詳細仕様**:
  - プレイヤー別のMMRランキング、総合勝率、KDA順位の表示。
  - **WinrateMatrixPanel**: プレイヤー間の「同時出場時勝率（シナジー）」と「直接対面時勝率（相性）」をグリッド状の総当たりマトリクスで可視化するデータパネル。

## 3-5. デュオシナジー分析 (`/synergy`)
* **主要コード・ファイルパス**:
  - `04_PORTAL/src/app/synergy/page.tsx`
* **詳細仕様**:
  - プレイヤー2名を選択し、味方としての同時勝率、敵として対面した際の勝率、合計対戦数、相性評価を抽出。

## 3-6. チャンピオンマッチアップ詳細 (`/matchups`)
* **主要コード・ファイルパス**:
  - `04_PORTAL/src/app/matchups/page.tsx`
* **詳細仕様**:
  - チャンピオン2体を選択し、対面統計データ、レーンごとのキル関与度やパワースパイクの違いをグラフィカルに比較表示する90KBの超巨大スタッツ画面。

---

# 4. 自律AI自動化 ＆ 収益化バッチ (v2_CORE)

Pythonで記述され、ローカル環境で常時または定期起動されるバックグラウンド自律処理スクリプト群。
* **ソースパス**: `03_SYSTEMS/v2_CORE`

### 4-1. AI Healer / SRE 常駐デーモン (`sre_daemon.py` / `healer.py`)
* **概要**: システムのエラーログやビルド失敗を検知すると、AIが自動でコード（TypeScript等）を修復し、Git Commit & Push で本番サーバーへ自動リリースする。

### 4-2. YouTube攻略動画要約エンジン (`youtube_absorber.py` / `dict_synthesizer.py`)
* **概要**: 指定したLoL攻略YouTubeチャンネルの新規動画を巡回し、`yt-dlp` で字幕抽出 ➔ Geminiで戦術要約 ➔ チャンピオン事前マニュアル（`matchup_sentinel`）にマージ。

### 4-3. note自動執筆・投稿バッチ (`monetization_batch.py` / `publisher.py`)
* **概要**: メタ情報や副業トレンドからアフィリエイト記事をAIが自動執筆。Playwrightで note.com の下書きへ保存し、X(Twitter)への連続宣伝スレッドを自動投稿。

### 4-4. Notion同期バッチ (`sovereign_sync.py`)
* **概要**: Notionの「LoL反省ノート」や「大会メモ」を Supabase の `personal_knowledge` テーブルへ自動同期。

### 4-5. noteアクセス推移収集デーモン (`note_analytics_daemon.py`)
* **概要**: 投稿したnote記事のPV数、購入数を定期的にスクレイピング取得し、Supabase の `note_pv_history` に保存。

---

# 5. データベーステーブル定義一覧 (Supabase)

| テーブル名 | 用途 | 主要なキーカラム |
|:---|:---|:---|
| `ktm_players` | メンバー情報、希望レーン、MMR、Pity | `discord_id`, `name`, `mmr`, `pity` |
| `ktm_matches` | 内戦 of 試合勝敗、実施日時ログ | `id`, `match_date`, `winning_team` |
| `ktm_match_participants` | 各試合の個人成績（KDA、使用チャンプ、勝敗） | `id`, `match_id`, `player_name`, `role`, `win` |
| `matchup_sentinel` | チャンピオンごとのGLOBALマニュアル、統計 | `matchup_id`, `champion`, `raw_data` (JSONB) |
| `personal_knowledge` | 過去の敗因反省・教訓、Notion同期データ | `id`, `champion`, `content`, `tags` |
| `note_pv_history` | note記事のPV、スキ、購入推移 | `id`, `note_id`, `raw_data` |
| `agent_prompts` | 管理画面から動的変更可能なAIプロンプト | `id`, `agent_name`, `system_prompt` |

---

# 6. 環境変数 ＆ 外部API連携設定 (System Keys)

* **`RIOT_API_KEY`**: ソロキュー偵察のPUUID、Spectator API、Match Timeline-V5の取得に必須。
* **`GEMINI_API_KEY`**: ソロキュー指示3箇条、Junglepedia AIアドバイス、YouTube要約、SRE自動コード修復に必須。
* **`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`**: ポータルからデータベースへの読取接続。
* **`SUPABASE_SERVICE_ROLE_KEY`**: 特権書き込み・RLSバイパス用。
* **`DISCORD_BOT_TOKEN`**: Discord Botのイベント受信・起動。

---

# 7. ポータル UI/UX ＆ デザインシステム仕様

ポータル内の視覚的統一感、未来的なネオン演出、および使いやすさを両立するために適用されているデザイン仕様。
* **主要コード・ファイルパス**:
  - グローバルCSS: `04_PORTAL/src/app/globals.css`
  - 共通サイドバー: `04_PORTAL/src/components/Sidebar.tsx`
  - デザインプレビュー画面: `04_PORTAL/src/app/design/DesignEditor.tsx`

### 7-1. カラーパレット (Sovereign Cyberpunk Colorway)
ポータルはダークモードを標準とし、以下の厳選されたHSL/HEXネオンカラーで構成されています。
* **背景色 (Background)**: `#0f1115` / `#06070a` (深い宇宙のような黒)
* **核・アクセントゴールド (Core Gold)**: `#c89b3c` (SOVEREIGNシステムのテーマシンボル。ロゴ、ヘッダーに適用)
* **サイバーブルー (Cyber Blue)**: `#3b82f6` (メインのプライマリカラー。ボタン、選択枠に適用) ＆ 発光色 `rgba(59, 130, 246, 0.5)`
* **ネオンバイオレット (Neon Violet)**: `#8b5cf6` (サブアクセント。グラデーションの切り返し、高負荷エリアに適用)
* **エメラルドグリーン (Emerald Green)**: `#10b981` (成功、BLUEチーム、高勝率、正常ステータス)
* **ネオンローズ/レッド (Neon Red)**: `#ef4444` / `#f43f5e` (危険、警告、REDチーム、NGレーン、未設定エラー)

### 7-2. グラスモルフィズム (Glassmorphism) & ホバーアクション
ポータルのすべてのカードやパネルには、SFのUI端末のようなガラス質感が適用されています。
* **グラスパネルクラス (\`.glass-panel\`)**:
  - `background`: `rgba(255, 255, 255, 0.03)` (わずかに白濁した半透明)
  - `backdrop-filter`: `blur(12px)` (背後のオブジェクトを美しくぼかす)
  - `border`: `1px solid rgba(255, 255, 255, 0.1)` (極薄の白い枠線でエッジを強調)
  - `box-shadow`: `0 4px 30px rgba(0, 0, 0, 0.1)`
* **ホバーマイクロアニメーション (\`.glass-panel-hover\`)**:
  - ホバー時に `background` を `rgba(255, 255, 255, 0.08)` に明るくし、枠線透過度を緩和。
  - `box-shadow: 0 0 20px rgba(59, 130, 246, 0.5)` (ブルーネオンのバックグロー発光)。
  - `transform: translateY(-2px)` (上方向に2px浮かび上がらせる) ことで、極めて滑らかな立体操作感を提供。

### 7-3. サイドバー ＆ ナビゲーション UI 仕様
* **折りたたみ (Collapse) 機能**:
  - PCサイドバーは幅64（通常表示）から幅20（アイコンのみの最小表示）へと滑らかにスライド変形。
  - 折りたたみ状態は `localStorage` の `sovereign_sidebar_collapsed` に保存され、リロード後も状態を自動維持。
* **管理者機能 / 一般機能 スライドスイッチ**:
  - 管理者エリア（`/design` や `/admin/` など）にいる場合、サイドバー上部にゴールドのタブ切り替えスライダーが出現。ワンクリックで「管理者機能（偵察、辞典、バランサー再構築、プロンプト管理など）」と「一般機能（チーム分け、勝率リーダーボード、シナジーマトリクス）」のメニューリストを滑らかに切り替える。
* **モバイルレスポンシブ**:
  - 768px以下のモバイル環境ではサイドバーを非表示化。画面最下部に固定されるボトムフローティングナビゲーションバーへと自動レイアウト変換。
  - モバイルの処理負荷（`backdrop-filter` のぼかし演算の重さ）を考慮し、モバイル用グラスパネルでは自動的に背景を非透過の濃色グラデーション（`linear-gradient(135deg, rgba(20,20,35,0.95), rgba(15,15,25,0.98))`）に切り替える「フォールバック描画」を適用。

### 7-4. 各種UI演出・ローディング規則
* **テキスト発光 (\`.text-glow\`)**: `text-shadow: 0 0 10px rgba(59, 130, 246, 0.5)` によるネオン調の発光。
* **ローディングスケルトン**: データの遅延ロード時、無機質なLoading文字を避け、明滅するアンバー（ゴールド）の回転インジケーター（`<RefreshCw className="animate-spin text-[#c89b3c]" />`）や、スケルトンパネルをフェードイン表示。
* **エラーバナーの統一**: Riot/Geminiキー切れ等のエラー時は、背景を `bg-red-900/20`、境界線を `border-red-800/50` とした赤色の半透明警告バナーを描画し、バグ情報を明示する。
