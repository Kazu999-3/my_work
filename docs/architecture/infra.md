# 構造メモ：共有インフラと横断事項（リポジトリ Kazu999-3/my_work）

- 調査日: 2026-11-23
- 対象: ローカルクローン `~/workspace/review-my_work`（GitHub `Kazu999-3/my_work`、デフォルトブランチ `master`）の静的解析
- 本書の範囲: フォルダ構成の意味、共有 Supabase、CI/CD、ホスティング、ルート直下ドキュメント、起動バッチ、AI 間役割分担の所在。各アプリ内部の詳細は別メモ（Portal / Pilot / Bot）の担当範囲とし、ここでは横断事項に限る。
- 表記: 確認できないものは **要確認** と明記した。根拠ファイルパスを各所に併記する。

---

## 1. リポジトリ全体のフォルダ構成

モノレポ構成であることは `AI_HANDOFF.md` 冒頭（§0）にも明記されている。番号付きフォルダが大分類で、意味は中身から確認した。

| フォルダ | 役割（中身から確認） | 根拠 |
|---|---|---|
| `01_INTEL/` | 知識・設計資料の置き場。LoL 戦術の概念ノート（`concepts/`：ジャングルマクロ、ワード、ガンク優先度など）、ガイド（`guides/`）、戦術（`tactics/`）、知識ボールト（`vault/`）、未整理の受け箱（`00_INBOX/`）、LoL 資料群（`_LOL/`）。全体索引 `NEXUS_INDEX.md`、依存関係図 `SYSTEM_DEPENDENCY_GRAPH.md`、設計指針（`feature_driven_architecture_guidelines.md` 等）もここにある | `01_INTEL/` 配下の実ファイル一覧 |
| `02_FACTORY/` | コンテンツ生産と運用記録の置き場。下書き（`01_DRAFTS/`）、素材（`03_ASSETS/`、`assets/`、`STRATEGY_ASSETS/`、`PROMO/`）、メンバー向け告知文（`MEMBER_ANNOUNCEMENTS/`）、日次ログ `DAILY_LOG.md`、タスク管理 `TODO.md` / 完了分 `TODO_ARCHIVE.md`、フィードバック受け箱 `FEEDBACK_INBOX.md`、自動化マップ `AUTOMATION_MAP.md`。初期セットアップ用 SQL `supabase_setup.sql` も残る（§2.3） | `02_FACTORY/` 配下の実ファイル一覧 |
| `03_SYSTEMS/` | 実行系システムの置き場。Discord Bot 本体 `ktm_bot/`（§4）、旧 Python バックエンド `v2_CORE/`（§1.1）、補助ツール群 `TOOLS/`（Discord コマンド登録/解除スクリプト等：`unregister_discord_commands.mjs`、`register_portal_commands.js` など）、デーモン運用ガイド `DAEMONS_GUIDE.md` / `RUNBOOK.md`、Windows 用起動・ショートカット系バッチ、Heroku 系 `Procfile`。`APPS/` には Unity 系とみられる `AssetBundles` と `src` がある（詳細は **要確認**） | `03_SYSTEMS/` 配下の実ファイル一覧 |
| `04_PORTAL/` | KTM Portal（Next.js アプリ本体、`src/`）。加えて **共有 Supabase のマイグレーション置き場 `supabase/migrations/`** を内包する（§2.1）。仕様・指示文は `docs/`、公開アセットは `public/` | `04_PORTAL/` |
| `05_PILOT/` | Tactical Pilot（Next.js アプリ本体、`src/`）。仕様・指示文は `docs/`。自前の `supabase/` フォルダは持たず、DB は 04_PORTAL 側マイグレーションで管理される（§2.1） | `05_PILOT/` |
| `99_ARCHIVE/` | 退役物の保管。旧 HUD オーバーレイ（`legacy_overlay/hud_window.py`）、未使用化した v2_CORE 資産（`v2_CORE_unused/`）、旧 Render デプロイ定義 `render.yaml`（FastAPI を Render に出す旧構成の名残） | `99_ARCHIVE/` |
| `scripts/`（ルート） | GitHub Actions から走るクラウドワーカーと運用スクリプト群（全92ファイル）。代表例：YouTube 解析ワーカー `youtube_worker.py`、動画発掘 `prospector.py`、文字起こし `whisper_transcriber.py`、LLM 切替アダプタ `llm_fallback_adapter.py`、本番ヘルスレポート `production_health_report.py`、マイグレーション適用 `migrate.mjs`（§3）、参考資料投入 `seed_reference_items.py`、テストは `scripts/tests/`、共通部品は `scripts/lib/` | `scripts/` 一覧、`AI_HANDOFF.md` §1 |
| `supabase/`（ルート直下） | Supabase CLI 用の設定（`config.toml`、`project_id = "my_work"`）と、初期統合スキーマ `20260712_unified_schema.sql`（59行。「Sovereign OS v9.0: Unified Database Schema Migration」と題し、`ktm_players` 拡張・`youtube_tasks`・`sovereign_tasks`・pgvector の `evolved_insights` 等を定義）。`README.md` は Edge Functions の現状説明（§2.2）。**現行のマイグレーション管理はこちらではなく `04_PORTAL/supabase/migrations/`**（§2.1） | `supabase/config.toml`、`supabase/20260712_unified_schema.sql`、`supabase/README.md` |

### 1.1 旧バックエンド `03_SYSTEMS/v2_CORE/`

Python 製の旧「Sovereign OS」バックエンド群（API ゲートウェイ `api_gateway.py`、DB 層 `database.py`、タスクキュー `task_queue.py`、Edge デーモン `edge_worker_daemon.py` / `edge_daemon/`、知識検索 `knowledge_retriever.py` 等）。`AI_HANDOFF.md` §0 は「多くは未使用化・クラウド移行済み」と明記する。ただし Edge Worker デーモン（字幕なし動画の文字起こし等、PC でしかできない処理）は現役で、ルートの起動バッチから起動される（§6）。

### 1.2 その他のルート直下物

- `.agent/`（`rules/`、`skills/`、`workflows/`、`resources/`）: Antigravity（Gemini）側のルール・スキル置き場。`GEMINI.md` が参照する（§7）。
- `.claude/`（`commands/`、`rules/`、`skills/`）と `04_PORTAL/.claude/`: Claude 側のスキル・ルール置き場。`CLAUDE.md` §1 に常設スキルの棚卸しがある。
- `.env.example`: 必要環境変数の一覧（値ではなくキー名のみ確認）。`DISCORD_WEBHOOK_URL`、`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、`GEMINI_API_KEY`、`RIOT_API_KEY`、`YOUTUBE_API_KEY`、`ADMIN_SECRET`、`NEXTAUTH_SECRET`、`NEXTAUTH_URL` など。
- `コピー～ LOLの教科書圧縮済み.pdf`（約17MB）: LoL 教科書の PDF がルート直下に置かれている（用途は **要確認**）。

---

## 2. Supabase（共有プロジェクト）

Portal・Pilot・Bot・ルート `scripts/` のワーカーが **1つの Supabase プロジェクトを共有** する。根拠: 両アプリのコードが同一テーブル群を参照していること（§2.4）、マイグレーションが1か所に集約されていること（§2.1）、`AI_HANDOFF.md` §0 の「DB: Supabase（無料枠）。RLS有効。書き込みはサービスロールキー経由」の記述。

- 接続情報の持ち方: Web アプリは `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`（`.env.example`）。Bot は `SUPABASE_URL` / `SUPABASE_KEY` を環境変数で受け、REST API（`/rest/v1/...`）を直接叩く（`03_SYSTEMS/ktm_bot/src/utils/supabase.js` の `fetchSupabase`）。
- AI 呼び出しのキャッシュ等も同じ DB にある（`gemini_response_cache` テーブル、§2.4）。
- DB から外部を定期的に呼ぶ処理は pg_cron + pg_net で実装され、鍵は Vault に置く（`supabase/README.md`、`04_PORTAL/supabase/migrations/93_pg_cron_pollers.sql`）。pg_cron 関連マイグレーション: `93_pg_cron_pollers.sql`、`96_pg_cron_onboarding.sql`、`107_pg_cron_hourly.sql`、`115_bot_cron_runs.sql`、`116_bot_cron_watch.sql`。Bot の定時ジョブが発火しなかった場合のウォッチドッグ（Portal 経由の再起動）もこの仕組みに乗る。

### 2.1 マイグレーションの置き場と関係

- **正の置き場は `04_PORTAL/supabase/migrations/`**（番号付き SQL、全147ファイル。`01_phase2_matches.sql` から `142_recruitment_participants.sql` まで）。Pilot のテーブル（`reference_items` は 128–130、`personal_knowledge` 関連など）も含め、**全アプリ分のマイグレーションがここに集約**されている。
- 適用経路: master への push で `.github/workflows/migrate.yml`（名称「Supabase Migrations」）が `scripts/migrate.mjs` を実行し、番号順に未適用分を適用する。適用済みは DB 内の `_migrations` テーブルに記録され、「already exists」系エラーは適用済みとみなして続行する設計（`scripts/migrate.mjs` 冒頭コメント、`supabase/README.md`）。
- ルート直下 `supabase/` は CLI 設定と初期統合スキーマ（`20260712_unified_schema.sql`）の置き場で、継続的なマイグレーション置き場ではない。`supabase/README.md` 自身が「マイグレーションは `04_PORTAL/supabase/migrations/` にあり、push 時に `migrate.yml` が自動適用する」と明記している。
- その他の SQL 断片: `02_FACTORY/supabase_setup.sql`（`personal_knowledge` 等の初期作成 SQL）、`02_FACTORY/INFRA/*.sql`（`agent_prompts_schema.sql`、`edge_tasks_schema.sql` 等）、`03_SYSTEMS/ktm_bot/scripts/setup_ktm.sql`（`ktm_players` の作成を含む）が残っている。これらが現行 DB に対して今も実行対象なのか、初期構築時の残置なのかは **要確認**。

### 2.2 Edge Functions

現行なし。`supabase/README.md`（2026-10-07 時点の記述）によれば、2026-06 に作った4本（`pulse-patches` / `match-importer` / `stats-collector` / `memory-encoder`）はすべて削除済みで、定期実行は pg_cron + pg_net に寄せている。

### 2.3 主要テーブル一覧

マイグレーション内の `CREATE TABLE` と、各アプリのコード内テーブル参照（`.from('...')`、Bot は REST のテーブル名引数）から追えた範囲。作成マイグレーションが特定できないもの（初期セットアップ SQL 由来など）も含む。

**プレイヤー・試合（Portal / Pilot / Bot 共通の核）**
- `ktm_players` — プレイヤー名簿。レーン別 MMR（`mmr_top/jg/mid/adc/sup`）、pity 等。作成は `03_SYSTEMS/ktm_bot/scripts/setup_ktm.sql` とルート `supabase/20260712_unified_schema.sql` の ALTER 群に分散（正の定義の所在は **要確認**）。3アプリすべてが参照
- `ktm_matches` / `ktm_match_participants` — 試合と参加者。3アプリが参照
- `ktm_settings` — 共有設定（日曜お祭りテーマ等）。3アプリが参照
- `balancer_predictions` — バランサー予測（Portal / Pilot）
- `soloq_match_history` / `soloq_lp_history` / `soloq_reflections` — ソロQ履歴・LP・振り返り（Portal / Pilot、同期は Actions §3）
- `pending_match_sync`、`matchup_log`、`matchup_sentinel`、`saved_simulations`（Pilot）、`replay_paths`

**コミュニティ運営（主に Portal、Bot が一部）**
- `recruitments` — 募集ヘッダー（`09_recruitments.sql`）
- `recruitment_participants` — 参加者台帳（`142_recruitment_participants.sql`、2026-11-23 追加。書き込みは Bot の service_role のみ）
- `recruitment_activity_logs`、`onboarding_channel_state`（`100_onboarding_channel_watch.sql` 等）
- `mentorship_profiles` / `mentorship_matches` / `mentorship_profile_comments` / `mentorship_reviews` / `player_reputations`
- `coin_transactions`、`mines_sessions`、`crash_sessions`、`push_subscriptions`、`admin_notifications`
- `collab_tasks`（`02_collab_tasks.sql`）、`bot_cron_runs`（`115_bot_cron_runs.sql`、Bot 定時ジョブの実行記録とウォッチドッグ用）

**知識・辞典・動画（主に Pilot、Portal も参照）**
- `personal_knowledge` — LoL 知識テーブル。作成は `02_FACTORY/supabase_setup.sql`。Portal / Pilot が参照し、Bot は承認処理で書き込む
- `knowledge_revisions` / `knowledge_usage_log`
- `reference_items` — 参考資料ライブラリ（128–130 のマイグレーション、Pilot が参照）
- `champion_facts` / `champion_fact_claims` / `dict_fact_check_queue` / `dict_known_corrections` — 辞典ファクトチェック系
- `champion_lane_roles` / `champion_jungle_timing_agg` / `champion_jungle_timing_samples` / `champion_build_samples` / `champion_notes` / `champion_power_spikes`（`08_champion_power_spikes.sql`）
- `lane_guides`
- `youtube_queue`（`03_youtube_queue.sql` 以降複数）/ `youtube_playlists`（`06_youtube_playlists.sql`）/ `youtube_channels`
- `coach_analyses`（`10_coach_analyses.sql`）/ `coach_missions`（`116_coach_missions.sql`）
- `note_articles`
- `gemini_response_cache`（`07_gemini_response_cache.sql`）、`api_usage_logs`、`edge_tasks`、`agent_prompts`

注: 上記は静的解析で追えた範囲の一覧であり、DB 実体の全テーブルと完全一致するかは **要確認**（実 DB への接続確認は本調査の範囲外）。

### 2.4 アプリ別の利用状況（コード参照ベース）

- Portal（`04_PORTAL/src`）: 上記のほぼ全域（プレイヤー・試合・募集・メンターシップ・コイン・知識・動画キュー）を参照する最大の利用者。
- Pilot（`05_PILOT/src`）: `ktm_players`、`ktm_matches`、`personal_knowledge`、`reference_items`、辞典系、コーチ系、YouTube キュー等を Portal と共有参照する。
- Bot（`03_SYSTEMS/ktm_bot/src`）: REST 経由で `ktm_players`、`ktm_matches`、`ktm_match_participants`、`ktm_settings`、`recruitments`、`recruitment_participants`、`recruitment_activity_logs`、`bot_cron_runs` を読み書きする（`src/utils/supabase.js`、`src/utils/recruitmentLedger.js`）。

---

## 3. CI/CD（`.github/workflows/`、全21ファイル）

| ファイル | 名称 | トリガー | 役割 |
|---|---|---|---|
| `migrate.yml` | Supabase Migrations | push（master、`04_PORTAL/supabase/migrations/**` 変更時）＋手動 | `scripts/migrate.mjs` で未適用マイグレーションを番号順に適用（§2.1） |
| `ci.yml` | CI (04_PORTAL / 05_PILOT / ktm_bot) | push / PR（対象パス変更時） | 3ジョブ: `portal-test`、`pilot-test`、`bot-syntax`（全 JS 構文チェック＋ wrangler dry-run のバンドル検証） |
| `ktm-bot-deploy.yml` | KTM Bot Deploy (Cloudflare Workers) | push（master、`03_SYSTEMS/ktm_bot/**` 変更時）＋手動 | Bot を Cloudflare Workers へデプロイ |
| `ktm-bot-cron-backup.yml` | KTM Bot Cron Backup | schedule はコメントアウト済み | Bot 定時ジョブのバックアップ起動用。現在は定期実行なし（中身の現行運用は **要確認**） |
| `sentinel.yml` | Sovereign Sentinel | 毎日 03:00 UTC（=12:00 JST）の schedule ＋ master への push | 健全性監視系（実行ステップの詳細は YAML 内スクリプト参照。本メモでは未精査のため **要確認**） |
| `health-report.yml` | Daily Health Report | 毎日 UTC 21:30（=JST 06:30）＋手動（dry_run 入力あり） | 本番ヘルスレポート（`scripts/production_health_report.py` 系）。バックアップ・戦績同期の後に走る |
| `db-backup.yml` | Database Backup | 毎週日曜 18:00 UTC（=月曜 03:00 JST）＋手動 | DB バックアップ。無料枠の Egress 超過対策で毎日→週1に変更された経緯がコメントにある |
| `smoke-test.yml` | Production Smoke Test | 定期実行は休止中（手動のみ） | 本番スモークテスト（`scripts/smoke_test.mjs`）。Vercel の CPU 枠対策で 2026-11-15 から定期休止とコメントにある |
| `edge-cloud-worker.yml` | Edge Cloud Worker | 毎時（`0 * * * *`） | クラウド側 Edge タスク処理。pg_cron（migration 93）から `workflow_dispatch` で即時発火も可能 |
| `ktm-cloud-worker.yml` | KTM Cloud Worker | dict-sync 3時間おき、prospect 1日3回（18:30/02:30/10:30 UTC）ほか | YouTube 解析（`scripts/youtube_worker.py`）・辞典同期・動画発掘（`scripts/prospector.py`）のクラウド実行 |
| `portal-weekly-crons.yml` | Portal Scheduled Crons (Vercel Offload) | 毎日 20:00 JST（オンボーディング自己紹介＆新着チェック）、毎週月曜 09:00 JST（sync-matches）、毎週火曜 00:00 JST（freshness-check） | Vercel 側 cron の肩代わり実行 |
| `soloq-history-sync.yml` | SoloQ History Sync | 毎日 05:40 JST | 前日夜のソロQ履歴取り込み |
| `soloq-coach-poll.yml` | SoloQ Coach Poll | 手動のみ | pg_cron 側と二重化したため定期実行を外した（コメントに経緯あり） |
| `youtube-monitor.yml` | YouTube Channel Monitor & Auto-Enqueue | 1日3回（08:00 / 14:00 / 20:00 JST） | チャンネル新着監視と解析キューへの自動投入 |
| `absorber.yml` | YouTube Absorber (Whisper Rescue) | 手動のみ（定期 cron は 2026-07-31 停止） | 参照・検証用。成果物（バイブル）をコミットするため `contents: write` 権限を持つ |
| `champ-dict-update.yml` | Champion Dictionary Bulk Update | 毎週月曜 03:00 JST ＋手動 | チャンピオン辞典の一括更新（進捗をコミットで永続化） |
| `lane-role-update.yml` | Champion Lane Role Update | 毎週水曜 03:00 JST ＋手動 | チャンピオンのレーン適性更新 |
| `rank-benchmark-update.yml` | Rank Benchmark Update | 毎日 04:30 JST | ランクベンチマーク収集 |
| `riot-jungle-timing-update.yml` | Riot Jungle Timing Update | 毎週金曜 03:00 JST ＋手動 | ジャングルタイミングデータ更新 |
| `patch-watchdog.yml` | Riot Patch Watchdog | 1日2回（JST 07:20 / 15:20）＋手動（mode 入力あり） | Riot パッチ監視 |
| `tactics-db-sync.yml` | Tactics DB → Git Sync | 毎日 JST 03:30 | 戦術 DB の内容を Git へ同期 |

デプロイ全体の流れは `AI_HANDOFF.md` §0 に集約されている: ユーザーがローカルで `deploy.bat`（§6）を実行して push すると、① Vercel が Portal を再ビルド・デプロイ、② Bot が CI（`ktm-bot-deploy.yml`）でデプロイ、③ `migrate.yml` がマイグレーションを自動適用する。

---

## 4. ホスティング対応関係

| 対象 | ホスティング | 根拠 |
|---|---|---|
| KTM Portal（`04_PORTAL/`） | Vercel。プロジェクト名 `my-work-8jbd`、本番 URL `https://my-work-8jbd.vercel.app`。`vercel.json` でリージョン `hnd1`（東京）、`crons` は空（定期実行は GitHub Actions 側へ寄せている、§3 の `portal-weekly-crons.yml`） | `AI_HANDOFF.md` §0、`04_PORTAL/vercel.json` |
| Tactical Pilot（`05_PILOT/`） | Vercel。`vercel.json` でリージョン `hnd1`。本番 URL はリポジトリ内ドキュメントからは特定できなかった（**要確認**。運用上は `https://ktm-pilot.vercel.app` と別途把握されている） | `05_PILOT/vercel.json` |
| KTM Bot（`03_SYSTEMS/ktm_bot/`） | Cloudflare Workers。ワーカー名 `ktm-os-worker`（`wrangler.toml` の `name`。package.json 側の表記は `ktm-sovereign-worker` で、名称が一致していない点は棚卸し済みの既知事項）。デプロイは `ktm-bot-deploy.yml`（§3）。ストレージは Supabase のみで、KV / D1 / R2 のバインディングはない | `03_SYSTEMS/ktm_bot/wrangler.toml`、`ktm-bot-deploy.yml` |
| クラウドワーカー群（`scripts/`） | GitHub Actions の定期実行（§3）。YouTube 解析・発掘・辞典同期・ヘルスレポート等 | `.github/workflows/`、`AI_HANDOFF.md` §1 |
| ローカル PC 常駐 | Edge Worker デーモン（`03_SYSTEMS/v2_CORE/edge_worker_daemon.py`）のみ。字幕なし動画の Whisper 文字起こし等、PC でしかできない処理を担当。Portal / Bot はクラウド常時稼働でローカル起動は不要 | `start_all.bat` / `start_all.ps1` の冒頭コメント、`AI_HANDOFF.md` §1 |
| 旧構成 | Render（`99_ARCHIVE/render.yaml`、FastAPI の `antigravity-api`）は退役済みのアーカイブ | `99_ARCHIVE/render.yaml` |

DB から外部を呼ぶ定期処理（pg_cron + pg_net、§2）も含め、定期実行の担い手は「GitHub Actions」「Supabase pg_cron」「Cloudflare Workers の cron（Bot 本体）」「ローカル PC」の4系統に分散している。

---

## 5. ルート直下の既存ドキュメント類

| ファイル | 役割（冒頭からの要約） |
|---|---|
| `AI_HANDOFF.md`（約12KB） | AI エージェント向け引き継ぎ資料。直近セッションの実装・調査・意思決定をまとめ、次の AI が同じ調査を繰り返さないことを目的とする。モノレポ構成、デプロイの流れ、サンドボックス制約、アーキテクチャ現状（ローカル常駐→クラウド移行後の役割分担表と cron 一覧）が §0–§1 に集約されており、横断情報の入口として最も新しい |
| `ANTIGRAVITY.md`（約71KB） | 「Sovereign OS: プロジェクト憲法」。プロジェクト概要、7大コアプロダクト（バランサー / MMR / 動画解析 / 記事作成 / オーバーレイ / note 収益化 / AI コーチ）の最優先方針、技術スタック・機能マップを定める最上位ドキュメント。Antigravity（Gemini）が自動参照する前提の文書で、`GEMINI.md` から SSoT として参照される。冒頭に 2026-07-26 削除済みの収益化パイプラインに関する注意書きがある |
| `CLAUDE.md`（約7KB） | Claude（Claude Code 等）向けの最上位開発ルール・環境指示書。セッション開始時の自動初期化手順（`HANDOVER_CLAUDE.md`、`02_FACTORY/TODO.md`、`01_INTEL/NEXUS_INDEX.md` の自動読み込み）、常設スキル一覧、作業ルールを定める |
| `GEMINI.md`（約2KB） | Gemini 3 / Antigravity のエントリポイント。対話開始時に自動ロードされ、憲法 `ANTIGRAVITY.md` と `.agent/rules/`（基本スタイル、実装ワークフロー、セキュリティ、ハルシネーション防止、完成の定義）への参照を束ねる薄い入口文書 |
| `HANDOVER_CLAUDE.md`（約123KB） | 開発引き継ぎマニュアル。システム構造・稼働実態・絶対ルールと実装履歴サマリーを収める最大の文書。Antigravity → Claude、Claude → Antigravity どちらの切り替えでも本書と `02_FACTORY/TODO.md`、`01_INTEL/NEXUS_INDEX.md` で文脈を復元する運用が冒頭に明記されている。詳細履歴は `02_FACTORY/TODO_ARCHIVE.md` と git log に集約済み |
| `SYSTEM_DESIGN_BY_FUNCTION.md`（約24KB） | 「システム完全機能技術仕様書」。全機能・内部アルゴリズム・コードパス・DB 構造・連携 API・UI/UX デザイン仕様を定義する仕様書。冒頭の構成図は Discord / Portal / Bot（Workers）/ GAS / Google Sheets / Supabase の3層構造を示す。ただし GAS・Sheets を DB とする図は旧構成の名残を含む可能性があり、現行（Supabase 一本化後）と図が一致するかは **要確認** |
| `KTM_実装検討メモ.md`（約25KB） | KTM 改善の設計フェーズメモ。選定済み項目ごとに「目的 / 方針（触るファイル・API・テーブル）/ データ変更 / 注意・リスク / 規模」を固めるための文書で、実装はまだ行わない前提で書かれている。共通前提として Portal / Bot の所在と、DB 変更はマイグレーション追加→自動適用の流れが冒頭に明記されている |
| `KTM_改善バックログ.md`（約9KB） | Portal / Bot の改善候補一覧。画面・機能ごとに番号付き（P-01 プレイヤーページのページング等）で規模感（小=数十分 / 中=数時間 / 大=設計含む）付き。「これやって」と番号で指示すれば着手する運用が冒頭に書かれている |
| `CLEANUP_AUDIT.md`（約18KB） | ファイル構造・コード棚卸しレポート（2026-09-24、全1,438ファイルを対象）。参照ゼロファイルの機械抽出と裏取り結果で、実害が出ているもの（削除済みスクリプトを呼ぶワークフロー等）、git 管理に入れるべきでない生成物、といった分類で整理されている |

このほか横断ドキュメントとして、`01_INTEL/SYSTEM_DEPENDENCY_GRAPH.md`（依存関係図）、`01_INTEL/NEXUS_INDEX.md`（全アセット索引）、`02_FACTORY/AUTOMATION_MAP.md`（自動化マップ）、`03_SYSTEMS/DAEMONS_GUIDE.md` / `03_SYSTEMS/RUNBOOK.md`（デーモン・運用手順）がある。

---

## 6. 起動用バッチ / スクリプト（ルート直下、Windows）

| ファイル | 役割 |
|---|---|
| `deploy.bat` | デプロイの正規入口。`04_PORTAL` の `npm run build` → リポジトリ全体を commit → `git push`。push 後は Vercel 再デプロイ、Bot の CI デプロイ、マイグレーション自動適用が連鎖する（§3）。ビルド失敗時は「赤いエラーを Claude に送る」旨が画面に出る作り |
| `start_all.bat` / `start_all.ps1` | ローカル起動の入口。現在は **Edge Worker デーモンの起動のみ**を行う（Portal / Bot はクラウド常時稼働のため）。旧「全サービス起動モード」はクラウドと二重稼働になるため廃止され、字幕なし動画の自動巡回起票はデーモン自身に統合済み。二重起動防止の排他ロック処理も ps1 側にある |
| `Sovereign_Launcher.bat` | 統合コントロールランチャー（対話メニュー）。全システム一括起動/停止、リプレイ道筋の取り込み・待機ワーカー、HUD オーバーレイ起動/停止、Edge Worker 起動/停止、稼働状況確認を番号選択で行う |
| `start_edge_worker.bat` / `.ps1`、`stop_edge_worker.bat` / `.ps1` | Edge Worker デーモン単体の起動・停止 |
| `start_match_watcher.bat` / `stop_match_watcher.bat` | 試合監視（`scripts/ktm_match_watcher.mjs`）の起動・停止 |
| `start_supervisor.bat` / `stop_supervisor.bat` | スーパーバイザー（`scripts/sovereign_supervisor.py` 系）の起動・停止 |
| `status.bat` | デーモン稼働状況・PID・ログの確認 |

`03_SYSTEMS/` 側にも起動系が残る（`start_overlay.bat`、`start_edge_worker.vbs`、自動起動登録用 `install_*_autostart.bat`、ショートカット作成 `create_desktop_shortcuts.bat` 等）。ルート側と `03_SYSTEMS/` 側のどちらが現行の正なのかは **要確認**（`start_all.ps1` はルート側が現行の前提で書かれている）。

---

## 7. AI 間の役割分担に関する記述の所在

リポジトリ内で確認できた記述は以下のとおり。

- **Antigravity 中心の運用体制**: `HANDOVER_CLAUDE.md` §1 に「運用体制は Antigravity 中心（2026-08-04〜）だが、大規模な不具合修正セッションは Claude Code で実施することが多い」と明記されている。引き継ぎは双方向で、`HANDOVER_CLAUDE.md` + `02_FACTORY/TODO.md` + `01_INTEL/NEXUS_INDEX.md` の3ファイルを作業した AI 側が都度更新する運用（同書冒頭、`CLAUDE.md` §0）。
- **Antigravity（Gemini）側の入口と憲法**: `GEMINI.md`（自動ロードされるエントリポイント）→ `ANTIGRAVITY.md`（プロジェクト憲法）→ `.agent/rules/`（行動指針・実装ワークフロー・セキュリティ・ハルシネーション防止・完成の定義）。実装と自動デプロイの担い手としての位置づけがここに定義されている。
- **Claude 側の入口**: `CLAUDE.md`（最上位開発ルール、セッション開始時の文脈復元手順、スキル運用）。`deploy.bat` のエラーメッセージが「Claude に送る」前提で書かれている点も、Claude が調査・修正の受け手である運用を示す。
- **AI 同士の引き継ぎ専用文書**: `AI_HANDOFF.md`（§5）。「次に担当する AI が同じ調査を繰り返さずに続きを進められること」を目的としており、GitHub リポジトリ自体が AI 間の受け渡し媒体になっている。
- **AI のモデル利用**: 実行系の AI 呼び出しは Google Gemini に統一されている（`AI_HANDOFF.md` §0: モデルは `gemini-3.1-flash-lite` に統一、15 RPM / 500 RPD）。ローカル LLM（Ollama）を先行事実抽出に使う構成が 7大コアプロダクトの「動画解析」に記載されている（`ANTIGRAVITY.md`）。切替部品として `scripts/llm_fallback_adapter.py` がある。
- **自律委任の一般論**: `01_INTEL/autonomous_task_delegation_protocol.md` は AI エージェントへのゴール委任・非同期自律稼働・Human-in-the-Loop の境界設計を規定する行動規範（外部記事を一次情報源とする知識ノートで、本プロジェクト固有の分担表ではない）。

**要確認**: ユーザーの運用として把握されている「Muse = 調整・記憶、Gemini = 深掘り調査、Antigravity = 実装、受け渡しは GitHub 経由」という3分担そのものを明記した文書は、リポジトリ内では特定できなかった。上記のとおり「Antigravity = 実装中心」「Claude = 大規模修正・調査の受け手」「引き継ぎはリポジトリ経由」は文書化されているが、「Gemini = 調査専任」の明記は `GEMINI.md` / `ANTIGRAVITY.md` の範囲では確認できていない（Gemini は Antigravity の基盤モデルとして実装側に位置づけられている）。

---

## 付記: 本メモの確認範囲と限界

- 本メモはリポジトリの静的解析のみに基づく。実 DB のテーブル実在、Vercel / Cloudflare の実プロジェクト設定、各ワークフローの直近実行成否は確認していない（該当箇所は要確認と明記した）。
- ワークフロー21本のうち `sentinel.yml` の実行ステップ詳細と `ktm-bot-cron-backup.yml` の現行運用は未精査。
- 数値（マイグレーション147ファイル、scripts 92ファイル、ワークフロー21本）は 2026-11-23 時点のクローン実測。
