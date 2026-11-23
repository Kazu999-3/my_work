# KTM Portal（04_PORTAL）構造メモ

- 対象: リポジトリ `Kazu999-3/my_work` の `04_PORTAL/`（ローカルクローン `~/workspace/review-my_work/04_PORTAL/`）
- 調査日: 2026-11-23（コミット 0783150 時点）
- 方法: ソースコードの静的解析のみ。本番DB・Vercel設定画面は見ていないため、コードから確認できないものは **要確認** と明記する。
- 本番URL: https://my-work-8jbd.vercel.app（`supabase/migrations/93_pg_cron_pollers.sql` 等のコード内URLおよび `src/app/api/logs/error/route.ts` の許可オリジンから確認）

---

## 1. 目的と利用者

League of Legends（LoL）コミュニティ「KTM」の運営ポータル。主な役割は次の4つ（画面・ロジックの実在から確認）。

| 役割 | 根拠 |
|---|---|
| 大会・定期カスタム運営（募集連携、試合結果登録、戦績） | `src/app/balancer/`、`src/app/history/`、`src/lib/periodicCustomCard.ts` |
| MMRバランサー（独自MMR算出とチーム分け） | `src/lib/mmr.ts`、`src/lib/balancer.ts`、`src/lib/balancer/` |
| コミュニティハブ（プロフィール、ランキング、ガイド、通知、Web Push） | `src/app/mypage/`、`src/app/leaderboard/`、`src/app/guide/`、`src/app/api/push/` |
| 付随機能（カジノ＝コイン消費ゲーム、メンタリング、先輩/後輩マッチング、お祭り） | `src/app/casino/`、`src/app/mentorship/`、`src/app/festival/` |

- 利用者: KTMコミュニティのメンバー（プレイヤー）と管理者（運営）。トップページ `/` は未ログインでも閲覧可、それ以外はログイン前提の作り（`src/app/login/`、認証は後述）。
- 管理者向け画面は `/ktm-admin`（`src/app/ktm-admin/`）。管理API群は `/api/admin/*` に集約され、Cookie認証ゲートが `src/proxy.ts`（Next.js 16 の Middleware 相当）で `/admin`・`/api/admin` にかけられている。
- 通貨は「コイン」（`src/lib/constants/rewards.ts` の `COIN_UNIT`）。新規登録の初期コイン 1,000、メンタリング初回プロフィール登録ボーナス 500 も同ファイルが単一の出所。

## 2. 技術構成

根拠: `04_PORTAL/package.json`

| 項目 | 内容 |
|---|---|
| フレームワーク | Next.js 16.4.6（App Router）+ React 19.2.8 + TypeScript 5 |
| スタイル | Tailwind CSS 4（`@tailwindcss/postcss`）、framer-motion、lucide-react（アイコン） |
| グラフ | recharts 3 |
| DB/バックエンド | Supabase（PostgreSQL + PostgREST）。`@supabase/supabase-js` 2.111 |
| 通知 | web-push 3（VAPID。`src/app/api/push/`、`VAPID_*` 環境変数） |
| バリデーション | zod 4 |
| テスト | `npm run test` = `tsx --test src/lib/__tests__/*.test.ts` |
| ホスティング | Vercel（`vercel.json`: リージョン `hnd1`（東京）、`crons: []`＝Vercel Cron は未使用） |

### 認証方式

- **メンバー認証 = Discord OAuth2**:
  - 開始: `src/app/api/auth/discord/route.ts`（`https://discord.com/oauth2/authorize` へ誘導）
  - コールバック: `src/app/api/auth/discord/callback/route.ts`（`https://discord.com/api/oauth2/token` でトークン交換）
  - セッション: 署名付きCookie（`src/lib/userSession.ts`。旧来の無署名base64 Cookieから署名方式に移行した経緯がコメントに残る）
  - その他: `src/app/api/auth/login`、`logout`、`me`、`verify`（`src/app/api/auth/` 配下）
  - OAuth state の扱いは `src/lib/oauthState.ts`
- **管理者認証**: パスワード + 署名付き `admin_session` Cookie（`src/lib/adminAuth.ts`、`src/lib/adminSession.ts`、ゲートは `src/proxy.ts`）。環境変数 `ADMIN_PASSWORD`、`ADMIN_SESSION_SECRET`、`ADMIN_DISCORD_IDS` を使用。
- **Bot→Portal API 認証**: 共有シークレット `PORTAL_BOT_SECRET`（ヘッダ `x-bot-secret`、`src/lib/botAuth.ts` の `verifyBotSecret`）。未設定時は fail-open になる設計である旨が同ファイルに明記されている（現在の本番設定状態は **要確認**）。
- Supabase クライアントは2種: ブラウザ/一般用 anon キー（`src/lib/supabaseClient.ts`、`NEXT_PUBLIC_SUPABASE_*`）と、サーバー用 service_role（`src/lib/supabaseAdmin.ts`、`SUPABASE_SERVICE_ROLE_KEY`。未設定時は anon にフォールバックし警告を出す実装）。

### 注意（バージョン固有）

- `04_PORTAL/AGENTS.md` に「この Next.js は既知のものと異なり破壊的変更を含む。コードを書く前に `node_modules/next/dist/docs/` のガイドを読むこと」と明記されている（Middleware が `src/proxy.ts` になっているのもその一例）。

## 3. ルート/画面の一覧と役割

`src/app/` 配下のページ（App Router）。トップは `src/app/page.tsx`。

| パス | 役割 |
|---|---|
| `/` | トップページ（未ログインでも閲覧可。KTM紹介・導線） |
| `/login` | ログイン（Discord OAuth への入口） |
| `/balancer` | バランサー（参加者選択・チーム分け・勝敗予想）。配下にコンポーネント群（`src/app/balancer/_parts/`、`components/`、`AramRotationPanel.tsx`） |
| `/balancer/record` | 試合結果登録 |
| `/history` | 試合履歴 |
| `/mypage` | マイページ（プロフィール・希望設定・総合カルテ・戦績タブ等） |
| `/player`、`/player/[id]` | プレイヤー詳細（`PlayerSettingsPanel.tsx`、`MentorshipProgressCard.tsx` を含む） |
| `/leaderboard` | ランキング（コイン、名簿、相性、勝率マトリクス等のパネル群: `src/app/leaderboard/*Panel.tsx`） |
| `/casino`、`/casino/rules` | カジノ（勝敗予想とコインゲーム群。実装は `src/app/casino/_casino/`、`components/`） |
| `/festival/pick` | 日曜お祭りのテーマ投票（`src/app/festival/pick/`） |
| `/mentorship` | メンタリング掲示板（先輩/後輩プロフィール、依頼、マッチメーカー。`src/app/mentorship/*Modal.tsx` 群） |
| `/analyzer` | プレイヤー比較・分析（`PlayerCompareView.tsx`、`_analyzer/`） |
| `/guide` | ガイド（タブ構成: `src/app/guide/tabs/`） |
| `/replay-paths` | リプレイ解析パス管理（管理系。閲覧キー `REPLAY_PATHS_VIEW_KEY` を使用） |
| `/ktm-admin` | 管理ダッシュボード（プレイヤー管理、試合履歴修正、オンボーディングチャンネル管理、ロール同期、運営サマリ等のパネル群） |

### API ルート（`src/app/api/`、グループ別）

| グループ | 主なエンドポイント |
|---|---|
| auth | `auth/discord`、`auth/discord/callback`、`auth/login`、`auth/logout`、`auth/me`、`auth/verify` |
| balancer | `balancer/clash`、`balancer/pending`、`balancer/today-stats`（本日のカスタム戦績） |
| player/players | `player/stats`、`player/profile`、`player/preferences`、`player/update-lane`、`player/update-puuid`、`player/sync-soloq`、`player/lookup`、`player/chemistry`、`player/playstyle`、`players/list`、`players/save` |
| match | `match/record`、`match/history`、`match/simulate`、`match/analyze-image`（結果画像のOCR解析と推定） |
| mmr | `mmr/rebuild`、`mmr/check-integrity` |
| bet/casino | `bet`（勝敗予想）、`bet/slot`、`bet/baccarat`、`bet/mines`、`bet/plinko`、`bet/scratch`、`bet/shop`、`bet/tip`、`bet/recruit-reward`、`casino/profit-ranking` |
| mentorship | `mentorship/profiles`、`mentorship/matchmaker`、`mentorship/matches`、`mentorship/reviews`、`mentorship/checkin`、`mentorship/sync-discord` |
| festival | `festival/theme` |
| onboarding | `onboarding/channels`、`onboarding/channels/poll`、`onboarding/process-intro`（自己紹介の処理） |
| push | `push/subscribe`、`push/send`、`push/notify-recruit`、`push/notify-admin` |
| discord | `discord/members`、`discord/announce-stats`、`discord/proposals`、`discord/role-sync`、`discord/vc-status` |
| riot | `riot/sync-ranks`、`riot/champions` |
| soloq/stats | `soloq/history-sync`、`stats/winrates`、`leaderboard`、`leaderboard/coins`、`leaderboard/meta`、`synergy`、`analyzer/compare`、`analyzer/deep-intel` |
| coach | `coach/custom`（カスタムコーチ。Pilot のコーチとは別物） |
| bot | `bot/member-channel-message`（Bot からの個別案内チャンネル投稿用） |
| admin | `admin/players/list`、`admin/players/save`、`admin/adjust-mmr`、`admin/init-mmr`、`admin/fix-match`、`admin/match/[id]`、`admin/riot-sync`、`admin/dashboard-stats`、`admin/ops-summary`、`admin/health`、`admin/notifications`(+read/delete)、`admin/onboarding-channels`(+broadcast/cleanup-departed/read)、`admin/replay-paths`(+queue)、`admin/mentors`、`admin/festival/attendance`、`admin/champions`(+trend)、`admin/ocr-aliases`、`admin/party-rules`、`admin/tasks`(+retry/retry-all) |
| cron | `cron/bot-backup`、`cron/freshness-check`、`cron/lottery`、`cron/soloq-coach`、`cron/soloq-trends`、`cron/sync-matches`（§7参照） |
| その他 | `health`、`logs/error`（Portal/Pilot 両方からのエラーログ受付。許可オリジンに両ドメインを明記）、`tasks/status`、`champions`(+dictionary-overview/favorite/primary-roles)、`lol/sync-match-feedback` |

## 4. 主要ドメインロジックの所在

すべて `src/lib/` 配下。

| 領域 | ファイル |
|---|---|
| MMR 算出 | `src/lib/mmr.ts`（ランク→基準値 `RANKS`、初期MMR、対戦結果からの更新。旧GAS実装のTS移植と明記）、`src/lib/balancer/mmrImprovement.ts`（平滑化勝率、サレンダー緩和） |
| チーム分け（バランサー） | `src/lib/balancer.ts`（レーン影響重み `ROLE_IMPACT_WEIGHTS` 等の基本アルゴリズム）、`src/lib/balancer/teams.ts`、`playerSelection.ts`、`playerList.ts`、`diagnosis.ts` |
| 帯分け（SPEC 10） | `src/lib/balancer/tierBand.ts`（2帯制、境界 Portal MMR 1450、格上許可 `tier_promotion_pref` の3値、格下サポートのオフレーン規則） |
| 次世代バランサー（未採用/検証用） | `src/lib/balancer/nextGenBalancer.ts`（採用可否は SPEC 08 の未決事項。現行バランサーとの関係は **要確認**） |
| 本日のカスタム戦績 | `src/lib/balancer/todayStats.ts`、`src/app/api/balancer/today-stats/` |
| 試合結果の計算・精算 | `src/lib/matchRecord/`（`calculator.ts`、`settlement.ts`、`validator.ts`、`notifier.ts`、`types.ts`）、`src/lib/matchSettlement.ts`、`src/lib/matchType.ts` |
| カジノ/コイン | `src/lib/coinLedger.ts`、`playerCoins.ts`（残高更新は RPC `apply_player_coin_delta` 経由）、`betOdds.ts`、`betValidation.ts`、`betDeadline.ts`、`jackpot.ts`、`lotteryEngine.ts`、`luckyDay.ts`、`minesMath.ts`、`plinkoMath.ts`、`shopItems.ts`、`src/app/api/bet/*` |
| メンタリング | `src/lib/mentorshipMatchmaker.ts`、`mentorshipRewards.ts`、`mentorshipConstants.ts`、`discordMentorship.ts` |
| 定期カスタム/オンボーディング | `src/lib/periodicCustomCard.ts`（次回定期カスタムの参加者を DB（`recruitments`/`recruitment_participants`）から取得。指示文37で Discord 走査から DB 読みに移行）、`onboardingProcessor.ts`、`onboardingChannels.ts`、`sundayFestivalTheme.ts` |
| プレイヤー分析 | `src/lib/playerTier.ts`、`playerStyleProfile.ts`、`playstyle.ts`、`sessionAnalyticsCalculator.ts`、`rankBenchmarks.ts`、`nemesisClash.ts`（天敵/相性） |
| チャンピオン知識 | `src/lib/championKnowledge.ts`、`championMetadata.ts`、`championNames.ts`、`championConstants.ts`、`championFactClaims.ts`、`dictFactCheck.ts`、`knowledgeRevisions.ts`、`knowledgeFreshness.ts`、`laneMeta.ts`、`data/lolalyticsLaneMeta.ts` |
| コーチ（Portal内） | `src/lib/customCoach.ts`、`coachPostGame.ts`、`coachTrends.ts`、`coachSettings.ts`、`tacticalBriefingRAG.ts` |
| Discord 連携部品 | `src/lib/discordFetch.ts`、`discordNotify.ts`（チャンネル投稿・DM・VCステータス）、`discordRoleSync.ts`、`discordName.ts`、`discordMentorship.ts` |
| 基盤 | `supabaseClient.ts` / `supabaseAdmin.ts`、`apiHandler.ts`、`apiCache.ts`、`authGuard.ts`、`adminAuth.ts`、`adminSession.ts`、`botAuth.ts`、`edgeTask.ts`（`edge_tasks` への投入）、`fetchAll.ts`、`geminiClient.ts`、`riot.ts`、`ddragonClient.ts` / `dataDragonMaster.ts`、`notify.ts`、`constants/rewards.ts` |
| 共有データ | `src/shared/ktm_tiers.json`（ティア定義。Bot からも import される） |

## 5. データ（Supabase）

- マイグレーション置き場: `04_PORTAL/supabase/migrations/`（147ファイル、番号 01〜142 ほか）。**Pilot を含む全プロジェクト分のマイグレーションがここに集約**されている（例: 03〜07 は YouTube キュー、10 は coach_analyses）。適用は GitHub Actions の `migrate.yml`（リポジトリ直下 `.github/workflows/`）が master への push 時に行う構成（ワークフロー名からの推定を含むため **要確認**）。
- Portal のコードが `.from()` で参照するテーブル（出現回数順、読み書きの内訳は個別確認が必要なため「参照」と表記）:
  - 中核: `ktm_players`（100）、`ktm_matches`（42）、`ktm_match_participants`（38）、`ktm_settings`（25）
  - メンタリング: `mentorship_matches`（47）、`mentorship_profiles`（30）
  - 基盤/タスク: `edge_tasks`（46）、`bot_cron_runs`（3）
  - 分析: `matchup_sentinel`（16）、`balancer_predictions`（13）
  - オンボーディング: `onboarding_channel_state`（13）
  - 通知: `admin_notifications`（10）、`push_subscriptions`（6）
  - カジノ: `mines_sessions`（8）、`coin_transactions`（5）
  - 募集: `recruitments`（1）、`recruitment_participants`（1）、`recruitment_activity_logs`（1）※ 参照回数は少ないが台帳DB化（指示文35/37）の中核
  - リプレイ: `replay_paths`（7）
  - 知識系（Pilot と共用）: `personal_knowledge`（7）、`champion_facts`（7）、`champion_power_spikes`（3）、`champion_notes`（3）、`dict_fact_check_queue`（11）、`dict_known_corrections`（2）、`knowledge_revisions`（1）、`champion_fact_claims`（1）、`lane_guides`（2）、`coach_analyses`（2）
  - その他: `youtube_queue`（2）、`youtube_playlists`（2）、`youtube_channels`（2）、`soloq_match_history`（2）、`matchup_log`（2）、`gemini_response_cache`（2）、`champion_lane_roles`（2）、`api_usage_logs`（2）、`champion_jungle_timing_agg`（1）
- RPC（Postgres 関数）呼び出し: `apply_player_coin_delta`、`claim_player_once`、`consume_player_items`、`increment_ktm_spectator_pity`、`patch_player_prefs`、`rank_benchmark_averages`、`save_ktm_players_batch`、`update_match_participants_batch`
- テーブルごとの読み/書きの厳密な切り分けと、RLS ポリシーの現行状態は **要確認**（マイグレーション履歴からの追跡が必要）。

## 6. 外部連携

### Discord API（Bot トークン / Webhook）

- `src/lib/discordFetch.ts` を経由して Discord REST API v10 を使用: チャンネル投稿、DM 作成・送信、VC ステータス（`src/lib/discordNotify.ts`）、ギルドメンバーのロール付け外し（`src/lib/discordRoleSync.ts`、`/guilds/{id}/members/{user}/roles/{role}`）
- Webhook 送信先は用途別に環境変数で分離（`DISCORD_WEBHOOK_URL`、`DISCORD_KTM_WEBHOOK_URL`、`DISCORD_RECRUIT_WEBHOOK_URL`、`DISCORD_RESULTS_WEBHOOK_URL`、`DISCORD_SHOP_WEBHOOK_URL`、`DISCORD_ERROR_LOG_WEBHOOK_URL`）
- OAuth ログインも Discord（§2）

### KTM Bot（03_SYSTEMS/ktm_bot、Cloudflare Workers）との接続点

- Bot→Portal: 共有シークレット認証（`src/lib/botAuth.ts`）を使うルート群が接続点。`verifyBotSecret` を参照するルート:
  `player/update-puuid`、`player/update-lane`、`riot/sync-ranks`、`match/record`、`bot/member-channel-message`、`push/notify-recruit`、`push/notify-admin`、`mentorship/profiles`、`mentorship/matches`、`mentorship/matchmaker`、`mentorship/sync-discord`、`onboarding/process-intro`、`discord/role-sync`、`bet`、`bet/tip`、`bet/recruit-reward`、`admin/adjust-mmr`、`admin/fix-match`、`admin/init-mmr`、`admin/riot-sync`
- Portal→Bot: `/api/cron/bot-backup` が Bot の `/trigger-scheduled` を叩く（Bot の Cloudflare Cron が発火しなかった場合の保険。§7）。Bot の Worker URL は環境変数 `BOT_WORKER_URL`、起動キーは `BOT_TRIGGER_KEY`
- Bot の実行記録テーブル `bot_cron_runs` を Portal が参照し、未実行を検知する

### Tactical Pilot（05_PILOT）との接続点

- 直接の API 連携は薄く、主にリンクと共用 DB:
  - 管理画面から Pilot 管理ダッシュボードへのリンク（`src/app/ktm-admin/page.tsx` → `https://ktm-pilot.vercel.app/admin/dashboard`）
  - 通知ベル内の Pilot への導線（`src/components/NotificationBell.tsx`、`NEXT_PUBLIC_PILOT_URL`）
  - エラーログ受付 `/api/logs/error` が Portal/Pilot 両ドメインを許可オリジンにしている
  - Supabase を共用し、知識系テーブル（`personal_knowledge` 等）を Portal も参照する（§5）

### Riot Games API / Data Dragon

- `src/lib/riot.ts`: `https://asia.api.riotgames.com`（アカウント・マッチ系）と `https://jp1.api.riotgames.com`（ランク系）を使用。キーは `RIOT_API_KEY`
- `src/lib/ddragonClient.ts` / `dataDragonMaster.ts`: Data Dragon（`ddragon.leagueoflegends.com`）からバージョン、チャンピオン、アイテム、アイコン画像を取得
- 同期の入口: `src/app/api/riot/sync-ranks`、`admin/riot-sync`、`player/sync-soloq`、`soloq/history-sync`、`cron/sync-matches`

### その他

- Gemini API: `src/lib/geminiClient.ts`（`generativelanguage.googleapis.com`、キー `GEMINI_API_KEY` / `GEMINI_API_KEY_BATCH`）。用途はコーチ・知識系と推定されるが、呼び出し箇所ごとの用途切り分けは **要確認**
- FastAPI（ローカル/別サービス）: `src/app/api/discord/members/route.ts` が `FASTAPI_API_URL`（デフォルト `http://localhost:8000/api/v1/players/sync`）へプレイヤー同期を委譲する経路を持つ。`SKIP_FASTAPI_PROXY` で無効化可。本番で有効かどうかは **要確認**
- エッジワーカー: `edge_tasks` テーブル経由で処理を委譲（`src/lib/edgeTask.ts`）。実体（GitHub Actions の `edge-cloud-worker.yml` 等）の対応関係は **要確認**
- Web Push: VAPID（`web-push`）

## 7. 定期実行・バッチ

- Vercel Cron は未使用（`vercel.json` の `crons: []`）。
- 主な定期実行は **Supabase pg_cron**（マイグレーション 93/96/107/115/116 等）→ Portal の `/api/cron/*` や DB 関数を起動:
  - `poll-soloq-coach`（15分おき等）→ `/api/cron/soloq-coach`（ソロQ振り返り検知）
  - `poll-onboarding-intros`（5分/時1回）→ `/api/onboarding/process-intro`
  - `poll-onboarding-channels`（5分おき/時1回）→ オンボーディングチャンネル監視（DB関数 `cron_poll_onboarding_channels`）
  - `dispatch-edge-cloud-worker`（5分おき）→ `edge_tasks` のディスパッチ
  - `bot-backup-*`（水曜 12:15 相当・金曜/土日）→ `/api/cron/bot-backup` 経由で Bot の定期処理の未実行を補完。`bot-watch-*` は保険後も未実行なら管理者へ通知
  - `purge-old-edge-tasks`（週1）、`legacy-article-reanalysis`（日次、Pilot 側の再解析キュー投入と推定）
  - ※ pg_cron の式は UTC 表記。実際に有効なジョブの一覧は DB 側の状態に依存するため **要確認**（過去に `94_unschedule_legacy_edge_jobs.sql` で旧ジョブの停止も行われている）
- Portal の cron エンドポイント（`src/app/api/cron/`）: `bot-backup`、`freshness-check`（知識の鮮度チェック）、`lottery`（抽選）、`soloq-coach`、`soloq-trends`、`sync-matches`。いずれも `CRON_SECRET`（Bearer）で保護（`bot-backup` で確認。他も同形式かは **要確認**）
- GitHub Actions（リポジトリ直下 `.github/workflows/`）にも Portal 関連と見られるものがある: `migrate.yml`、`portal-weekly-crons.yml`、`soloq-coach-poll.yml`、`soloq-history-sync.yml`、`ktm-bot-cron-backup.yml`、`health-report.yml`、`smoke-test.yml`、`ci.yml`、`db-backup.yml`、`rank-benchmark-update.yml`、`lane-role-update.yml`、`champ-dict-update.yml`、`riot-jungle-timing-update.yml`、`tactics-db-sync.yml`、`sentinel.yml`、`patch-watchdog.yml` 等。どれが現行有効かは **要確認**。

## 8. 既存ドキュメントの所在

| 場所 | 内容 |
|---|---|
| `04_PORTAL/docs/specs/` | SPEC・指示文の置き場。01〜29 の番号付き文書（欠番あり）: 01 数値と表記、02 ローディング、04 MMR説明、05 長いページ、06 フォローアップ、07 調査報告、08 次世代バランサー（SPEC＋監査報告）、09 CI hooks 修正、10 帯分けカスタム、11 本日のカスタム戦績、12 バランサー/プロフィール見直し、13 格下サポートフラグ修正、14 用語統一、15 導線・命名、16 ページ使い勝手、17 レスポンシブ、18 マイページ設定設計、19 残件修正、20 リーダーボード狭幅修正、25 格上カード単純化、26 マイページ整理、27 MMR根拠と推定MMRランク表記、29 空ブロックと報告 |
| `04_PORTAL/docs/specs/reports/` | `SPEC06-investigations.md` |
| `04_PORTAL/docs/reports/` | `26-investigations-report.md`（指示文26の調査報告: 相性表示の不一致、初回表示の差異等） |
| `04_PORTAL/supabase/migrations/README.md` | マイグレーション運用メモ（内容の精査は **要確認**） |
| `04_PORTAL/README.md` | create-next-app の初期テンプレートのまま（プロジェクト固有の説明はない） |
| `04_PORTAL/AGENTS.md` / `CLAUDE.md` | エージェント向け作業ルール（Next.js 16 の注意点） |
| リポジトリ直下 | `02_FACTORY/DAILY_LOG.md` に Portal 含む全プロジェクトの作業記録が蓄積されている |

## 9. 要確認リスト（今回の調査で確定できなかったもの）

1. `PORTAL_BOT_SECRET` が本番（Vercel / Cloudflare Workers 双方）に設定済みか（未設定だと Bot→Portal API が fail-open）
2. pg_cron で現在有効なジョブの実一覧と、GitHub Actions ワークフローの現行有効分
3. `nextGenBalancer.ts` の現行バランサーに対する位置づけ（影検証のみか、一部採用済みか）
4. `FASTAPI_API_URL` への委譲が本番で有効か
5. 各 Supabase テーブルの読み/書きの切り分けと RLS の現行状態
6. Gemini API の呼び出し箇所ごとの用途
7. `edge_tasks` を処理するワーカーの実体と Portal との対応関係
