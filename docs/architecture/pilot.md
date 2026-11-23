# Tactical Pilot（戦術パイロット）＋ 常駐ワーカー群 構造メモ

- 対象: リポジトリ `Kazu999-3/my_work` の `05_PILOT/` と リポジトリ直下 `scripts/`
- 方法: ソースコードの静的解析のみ（2026-11-23時点のローカルクローン）。コードから確認できないものは **要確認** と明記する。
- 本番: https://ktm-pilot.vercel.app

---

## 1. 目的と利用者

League of Legends（LoL）の上達支援Webアプリ。主な機能は4つ。

1. **チャンピオン図鑑**: 全チャンピオンの攻略情報（ビルド、レーン別ガイド、対面相性など）を集約した辞典。データの実体は `05_PILOT/src/data/champions_summary.json`（実測173チャンピオン）等のJSONと、Supabase の `champion_facts` 等。
2. **動画解析**: YouTube の LoL 解説動画を自動で取り込み、字幕から攻略記事（ナレッジ）を生成して図鑑へ蓄積する仕組み（§4）。
3. **AIコーチ**: 対面分析、習慣ラダー、目標・ミッション管理、自由質問など（`/coach`、`src/app/api/coach/*`、`src/app/api/lol/*`）。
4. **カスタムHUD（オーバーレイ）**: ゲーム中に重ねて表示する支援表示（`/overlay`。LoL の Live Client Data API と接続する API 群 `src/app/api/overlay/*`）。

利用者は KTM コミュニティのメンバーおよび管理者（末吉）。一般公開ではなく、合言葉ログインの内側でのみ使える（§2）。管理画面（`/admin/*`）で記事承認やキュー管理を行う。

## 2. 技術構成

| 項目 | 内容 | 根拠 |
|---|---|---|
| フレームワーク | Next.js 16.4.6 / React 19.2.8 / Tailwind CSS 4 | `05_PILOT/package.json` |
| 開発・起動ポート | 3005（`next dev -p 3005` / `next start -p 3005`） | 同上 |
| ホスティング | Vercel（リージョン hnd1） | `05_PILOT/vercel.json` |
| DB | Supabase（PostgreSQL）。Portal・Bot と同一プロジェクトを共有（§6・§7） | `05_PILOT/src/lib/supabaseClient.ts` |
| 認証 | 合言葉（パスフレーズ）＋ 署名付きセッション Cookie | `05_PILOT/src/lib/tokenAuth.ts`、`src/app/api/auth/login/route.ts`、`src/proxy.ts` |
| LLM | Gemini API（主）＋ ローカル Ollama（補助・フォールバック） | `src/lib/geminiClient.ts`、`src/lib/ollamaClient.ts`、`scripts/llm_fallback_adapter.py` |

認証の詳細（`src/lib/tokenAuth.ts`、`src/app/api/auth/login/route.ts`）:

- 合言葉は環境変数 `PILOT_SECRET_TOKEN` と照合する。未設定、または過去に公開された開発用合言葉のハッシュ（ブロックリスト）と一致する場合は全リクエストを拒否する（fail-closed）。
- ログイン成功時に、合言葉そのものではなくランダムなセッションIDを HMAC 署名した Cookie `pilot_session` を発行する。署名鍵は `PILOT_SESSION_SECRET`（未設定時は合言葉へフォールバックし、本番では警告ログを出す）。
- セッション有効期限は30日、残り15日未満で自動延長（スライディング）。失効は `/api/auth/revoke`（本人のセッションのみ）で可能で、DB＋インメモリキャッシュで管理する。
- ログイン試行はレート制限あり（15分間に10回、`src/lib/loginRateLimit.ts`）。制限基盤に障害がある場合は通さず 503 を返す。
- 画面側のゲートは `src/proxy.ts`（Next.js のプロキシ層）。

LLM の役割分担:

- **Gemini**（`src/lib/geminiClient.ts`）: 記事生成、知識分解（§4）、AIコーチの応答など生成系の主担当。モデルはフォールバック列（gemini-3.5-flash-lite → gemini-flash-lite-latest → …）を上から試す。キーは `GEMINI_API_KEY`（無料枠プロジェクトキー。モデルごとに1日の上限がある）と `GEMINI_API_KEY_FREE` を参照。
- **Ollama**（ローカルPC上の qwen2.5:7b）: ワーカー側では「事実抽出」工程のフォールバック（Gemini が 429/503 のとき、`scripts/llm_fallback_adapter.py`）。Web 側にも `src/lib/ollamaClient.ts` があり、到達可能ならローカル優先・不可なら Gemini へフォールバックする。ただし本番 Vercel からは自宅PCの Ollama（127.0.0.1）に到達できないため、本番Web側の実効は Gemini。知識分解は品質理由で Gemini 固定（`src/lib/knowledgeDecompose.ts` は `callGemini` のみ使用。経緯は `docs/specs/13-ollama-gemini-comparison-SPEC.md` と `14-decompose-gemini-only-instruction.md`）。

## 3. ルート／画面の一覧

ページは13（`src/app/**/page.tsx`）。API ルートは59（`src/app/api/**/route.ts`）。

### ページ

| ルート | 役割 |
|---|---|
| `/`（`?c=` でチャンピオン指定、`?t=` でタブ） | チャンピオン図鑑トップ。チャンピオン詳細・攻略表示 |
| `/login` | 合言葉ログイン画面（未認証時はここへ誘導） |
| `/coach` | AIコーチ。試合の流れ（前→中→後→振り返り）に沿った分析・目標・ミッション |
| `/overlay` | カスタムHUD表示用ページ。対面の癖（habit-radar）等をゲーム中に重ねる想定 |
| `/library` | 攻略ライブラリ。蓄積されたナレッジ記事の閲覧 |
| `/lane-guides` | レーン別ガイド |
| `/note` | note 投稿用の下書き・記事管理（種別: all / profile / free_guide / paid_master） |
| `/share-target` | Web Share Target の受け口 |
| `/admin/review` | 生成記事の承認画面。`personal_knowledge` の `review_status='pending'` を承認／却下し、承認時に知識分解・統合が走る |
| `/admin/youtube` | YouTube 解析キューの管理（登録・状態確認） |
| `/admin/dashboard` | 運用ダッシュボード（旧ポータル /admin/dashboard の移転先とコメントあり） |
| `/admin/dict-health` | 辞典ヘルスチェック。チャンピオン辞典の鮮度・異常の確認 |
| `/admin/dict-maintenance` | 辞典メンテナンス（データ修正系） |

### API ルートの系統（59件、`src/app/api/`）

- `auth/`（login / logout / revoke / link）: §2 の認証
- `champions/`（roles / primary-roles / optimize）: チャンピオンのロール情報
- `coach/`（ask＝自由質問、goal、mission、reviews、play-recommendation、rank-benchmark、target-tier）
- `lol/`（habit-radar＝対面の癖、jg-predict＝敵JG予測、lane-diff、matchup-blueprint、postgame-deep-analytics、tactic-verify）
- `knowledge/`（ingest＝取り込み、integrate＝辞典への統合、review＝承認処理）
- `youtube/`（queue＝キュー操作、watch、playlist/add、scout-champion、worker-status）
- `overlay/`（heartbeat、live-client-data＝LoL Live Client Data 取得）
- `match/`（history、simulate、simulation）、`soloq/`（heatmap、history-sync、recent-matches、reflections）
- `admin/`（dict-health、dict-maintenance、revisions＝編集履歴、tasks、notifications、ops-dashboard、live-match、video-analysis/deep-dive）
- `analyzer/deep-intel`、`items/dictionary`、`lane-guides/`、`library/`、`note/`、`pilot/settings`、`system/status`、`tasks/status`、`lolalytics/champion`

## 4. 動画解析パイプラインの流れ

全体像: **発掘・巡回 → キュー投入（`youtube_queue`）→ 字幕取得 →（なければ）Whisper 文字起こし → 事実抽出 → 記事生成 → `personal_knowledge` 保存（pending）→ 管理者が承認 → 知識分解・辞典統合 → 図鑑に公開**。

### 4.1 キュー投入（入口は3つ）

1. **自動発掘**: `scripts/prospector.py` が、辞典情報が古いチャンピオンについて YouTube を検索し、良さそうな解説動画を `youtube_queue` に `pending` で登録する（重複登録防止あり）。選別には `scripts/video_filter.py`（戦術的有用性の判定フィルタ）を共用。
2. **チャンネル巡回**: `scripts/cloud_youtube_monitor.py` が Supabase の `youtube_channels`（active=true）の RSS フィードを巡回し、新着動画だけを起票する。GitHub Actions `.github/workflows/youtube-monitor.yml`（1日3回）で実行。
3. **手動登録**: Pilot の `/admin/youtube` 画面および `/api/youtube/queue` からURLを登録。チャンピオン指定のスカウトは `/api/youtube/scout-champion`。

### 4.2 解析（`scripts/youtube_worker.py`、1,084行）

- `youtube_queue` の `pending` を優先度（high→medium→low）→登録古い順に処理する。Gemini の上限に達している間は処理を見送る仕組み（クォータ一時停止）がある。
- 字幕取得は yt-dlp。字幕が無い動画は、長さ等の条件を満たす場合に **Whisper フォールバック**（`scripts/whisper_transcriber.py`、faster-whisper で音声から文字起こし）を使う。
- 記事生成は `scripts/article_pipeline.py` の2段階方式（2026-10-19新設）:
  1. **事実抽出**: 字幕から「主張・理由・条件・時刻」を JSON で抽出する。ここだけ `scripts/llm_fallback_adapter.py` のハイブリッド呼び出し（Gemini 主、429/503 時はローカル Ollama へ切替）が使われる。抽出件数は `analysis_meta.fact_count` として「中身の量」の指標になる。
  2. **記事化**: 抽出した事実だけから Gemini が記事を書く（字幕に無いことを書かせない方針）。
- 生成結果は `personal_knowledge` に保存され、キューは `completed` に更新される。失敗時は `error_generation`（生成失敗）/ `error_no_transcript`（字幕なし）/ `failed` 等のステータスになる。鮮度判定（60日以上前・旧シーズンの動画は旧パッチ扱い）もワーカー内にある。
- 実行環境: GitHub Actions `.github/workflows/ktm-cloud-worker.yml` の `youtube` ジョブ。ただし同ファイルのコメントによれば、**2026-07-31に定期実行は停止済み**（GitHub Actions の共有IPが YouTube 側に低信用と判定され取得失敗が続いたため）で、現在は手動実行（workflow_dispatch）のみ。ローカルPCでの実行も可能な作り（1回実行でキューを処理し切る main 構造）。**ローカル常駐の具体的な起動方式（誰が・何で定期起動しているか）はコードからは確定できないため要確認**（`sovereign_supervisor.py` 等の常駐管理は存在するが、youtube_worker 自体はその管理対象に明記されていない）。

### 4.3 承認と公開

- 管理者が `/admin/review` で `personal_knowledge` の pending 記事を承認する（`/api/knowledge/review`、`review_status` を `approved` へ）。
- 承認済みナレッジは **知識分解**（`src/lib/knowledgeDecompose.ts`、Gemini 固定）でチャンピオン別・レーン別の知見に分解され、**統合**（`src/lib/knowledgeIntegrate.ts`、`src/lib/matchupMemo.ts`）で辞典データ（`champion_facts` 等）へ反映される。
- 統合の定期実行は GitHub Actions `ktm-cloud-worker.yml` の `dict-sync` ジョブ（3時間おき）が Pilot の `/api/knowledge/integrate` を叩く。
- 編集・統合の履歴は `knowledge_revisions` に残り、`/admin/review` の履歴表示（F-2）から参照できる。

### 4.4 解析不可動画の後始末

- `scripts/auto_close_terminal_errors.py`（SPEC 08）: 終端エラー（error_generation / error_no_transcript / failed）の動画を、YouTube の「手動確認用プレイリスト」へ退避できたものだけ `manually_closed` に更新する。スイッチ `AUTO_CLOSE_UNANALYZABLE`（既定OFF）で有効化し、`--dry-run` 対応。プレイリスト操作には YouTube OAuth（§7）を使う。
- `scripts/clean_youtube_queue.py`: エラー動画の可視化・一括クローズ（`--clean-errors`）・再試行（`--retry-failed`）を行う手動メンテナンスツール。`manually_closed` は再キュー対象外。

## 5. `scripts/` 配下のスクリプト一覧

リポジトリ直下 `scripts/` には約90ファイルがある。Pilot の動画パイプラインに直接関わるものを個別に挙げ、その他は系統別にまとめる。

### 5.1 動画パイプライン系（Pilot と一体）

| ファイル | 役割 |
|---|---|
| `youtube_worker.py` | 解析ワーカー本体。キュー処理→字幕→記事生成→保存（§4.2） |
| `article_pipeline.py` | 字幕→記事の2段階生成（事実抽出＋記事化、§4.2） |
| `llm_fallback_adapter.py` | 事実抽出用 LLM アダプタ。Gemini 主、429/503 時にローカル Ollama（qwen2.5:7b）へ切替 |
| `whisper_transcriber.py` | 字幕なし動画向けのローカル Whisper 文字起こし（faster-whisper） |
| `prospector.py` | 辞典が古いチャンピオンの解説動画を自動発掘しキューへ登録 |
| `cloud_youtube_monitor.py` | 登録チャンネルの RSS 巡回→新着を起票（Actions で定期実行） |
| `video_filter.py` | 動画の戦術的有用性の選別フィルタ（prospector／monitor 共用） |
| `auto_close_terminal_errors.py` | 解析不可動画の自動退避＆クローズ（SPEC 08、§4.4） |
| `clean_youtube_queue.py` | キューのエラー可視化・クローズ・再試行の手動ツール（§4.4） |
| `setup_youtube_oauth.py` | YouTube OAuth リフレッシュトークン取得ヘルパー（SPEC 08 用、ローカル実行） |
| `check_youtube_queue.mjs` | キューの状態確認 |
| `compare_ollama_gemini_spec13.py` | SPEC 13 の比較検証用（知識分解と事実抽出で Ollama と Gemini の品質・量を比較）。検証完了後は通常運用では使わない |
| `seed_reference_items.py` | 参考資料ライブラリ（`reference_items`、全164件）の投入・照会・管理 CLI（指示文15〜18） |
| `extract_video_tactics.py` | 動画から秒数リンク付き戦術アクションを抽出し `01_INTEL/tactics/` と Portal へ連携する別系統の抽出エンジン（既存ワーカーとは独立） |
| `yt_dlp_cookies.py` | yt-dlp 用 Cookie の補助（詳細は要確認） |

### 5.2 知識・辞典の生成／保守系

`champion_researcher.py`（チャンピオン調査）、`refresh_all_champion_facts.py`（事実データ一括更新）、`generate_tactics_bible.py` / `generate_tactics_index.py` / `generate_concept_pages.py` / `generate_kirei_bible_index.py` / `generate_note_stocks_index.py` / `build_kr_challenger_textbook.py`（戦術バイブル・索引・教科書の生成）、`sync_db_to_git_tactics.mjs`（DB→Git への戦術データ同期）、`sync_dict_health.py`（辞典ヘルス同期）、`knowledge_linter.py`（ナレッジの検査）、`audit_knowledge_links.py` / `audit_tactics_bibles.py`（リンク・バイブルの監査）、`backup_knowledge_vault.py`（ナレッジ保管庫のバックアップ）、`fix_personal_knowledge_champions.py`、`clean_defective_pending.py` / `check_pending_quality.py`（承認待ちの品質チェック・不良品除去）、`reanalyze_article.py`（記事の再解析）、`auto_wire_orphans.py`（孤立データの自動接続）、`inbox_worker.py`（`01_INTEL/00_INBOX/` のメモを構造化して自動配置するワーカー）。

### 5.3 常駐・基盤系

| ファイル | 役割 |
|---|---|
| `sovereign_supervisor.py` | ローカル常駐サービスの統合管理（Edge Worker、Match Watcher、HUD を死活監視し自動再起動） |
| `edge_cloud_worker.py` | `edge_tasks` テーブルからオンデマンドタスク（トレンド取得、チャンネル監視、辞典シンセサイザー等）を拾って実行するクラウド版ワーカー。GitHub Actions から数分おきに起動される想定 |
| `ktm_match_watcher.mjs` | LoL カスタム試合のリザルト自動記録ワーカー |
| `replay_worker.py` / `replay_paths.py` | リプレイ解析（ミニマップから10人の移動経路を読み取る等） |
| `check_daemons.py` | デーモン類の死活確認 |
| `lib/safe_runner.mjs` | スクリプト実行の共通ラッパ（詳細は要確認） |

### 5.4 Portal／Bot／コミュニティ支援系（Pilot とは別系統だが同じ scripts/ に同居）

試合・コイン・MMR の監査と補正（`audit_balancer_mmr.py`、`audit_coin_ledger.py`、`analyze_coin_circulation.ts`、`analyze_mmr_health.mjs`、`analyze_custom_participants.mjs`、`apply_backfill_match.cjs`、`grant_maintenance_compensation.mjs`、`refund_deprecated_tickets.mjs`）、Discord 運用（`announce_mentorship_threads.js`、`update_mentorship_threads_announce.js`、`update_welcome_message.mjs`、`update_otsumaru_message.mjs`、`send_kenchi_dm.mjs`、`get_discord_channels.mjs`、`check_discord_env.js`、`notify.py`、`notify_discord.py`）、コミュニティ確認（`check_community.mjs`、`check_channel_activity.mjs`）。

### 5.5 運用・ヘルス・その他

環境／接続確認（`check_env.py`、`check_db_connection.mjs`）、ヘルスレポート（`ops_health_check.py`、`production_health_report.py`、`monitor_supabase_usage.py`）、パッチ監視（`check_patch_update.py`）、Vercel 掃除（`clean_vercel_deployments.mjs`）、移行・復旧（`migrate.mjs`、`run_recovery_sequence.mjs`）、note 連携（`export_note_vending_pack.mjs`）、LoLalytics 取得（`lolalytics.mjs`）、テスト（`smoke_test.mjs`、`scripts/tests/` に Python テスト5件：auto_close、hybrid_extract、priority_order、prospector、video_filter）。個別の詳細がコード冒頭から読み取れなかったもの（`simulate_news.cjs`、`unify_05_palette.py` 等）は **要確認**。

### 5.6 Pilot 専用スクリプト（`05_PILOT/scripts/`）

`compile_champions.mjs`（ビルド／起動前にチャンピオンデータをコンパイル。`package.json` の dev/prebuild から呼ばれる）、`compile_note_drafts.mjs`、`sync_to_markdown.mjs`、`cleanup_anomaly_records.ts`（異常レコード掃除）、`execute_safe_autopass.mjs`、`integrate_pending_reviews.mjs`、`run_decompose_test.mjs`、`run_triage_scan.mjs`、各種 `check_*.mjs`（テーブル・試合・承認待ちの確認用）。

## 6. データ（Supabase テーブル）

Pilot のコード（`05_PILOT/src`）から `.from('...')` で辿れる主要テーブル。参照回数はコード内の出現数（目安）。

| テーブル | 用途 | 備考 |
|---|---|---|
| `personal_knowledge` | 生成記事・ナレッジの本体。`review_status`（pending / approved 等）で承認管理 | 参照37件。パイプラインの中心 |
| `youtube_queue` | 動画解析キュー。status: pending / completed / error_generation / error_no_transcript / failed / manually_closed、priority（high/medium/low） | 参照28件 |
| `youtube_channels` | 巡回対象チャンネル（active フラグ） | `cloud_youtube_monitor.py` が使用 |
| `edge_tasks` | オンデマンドタスクのキュー（Edge Worker が処理） | 参照37件 |
| `champion_facts` / `champion_fact_claims` | チャンピオン辞典の事実データとその主張単位 | 統合の反映先 |
| `champion_lane_roles` | チャンピオンのレーン適性 | |
| `matchup_sentinel` | 対面相性の監視・検証データ | 参照26件 |
| `knowledge_revisions` | 知識の編集・統合履歴 | /admin/review の履歴表示の元 |
| `reference_items` | 参考資料ライブラリ（全164件）。Pilot に UI はなく、投入は `seed_reference_items.py` | 参照1件（検索 `src/lib/referenceSearch.ts`） |
| `coach_missions` / `coach_analyses` | AIコーチのミッションと分析結果 | |
| `lane_guides` | レーン別ガイド | |
| `soloq_match_history` / `soloq_reflections` / `soloq_lp_history` | ソロキューの試合履歴・振り返り・LP履歴 | |
| `saved_simulations` | 試合シミュレーションの保存 | |
| `admin_notifications` | 管理者向け通知（画面の通知ベルと連動） | |
| `ktm_settings` | 共通設定（Portal と共有） | |
| Portal と共有 | `ktm_matches`、`ktm_players`、`recruitments`、`recruitment_activity_logs`、`balancer_predictions`、`champion_notes`、`champion_jungle_timing_agg` | 同一 Supabase プロジェクトのため Pilot からも参照される（主に運用ダッシュボードと試合履歴） |

マイグレーションの置き場: Pilot 専用の置き場は無く、Portal 側 `04_PORTAL/supabase/migrations/` に集約されている（reference_items 用の 128〜130 等もここ）。リポジトリ直下にも `supabase/`（`20260712_unified_schema.sql`、`config.toml`）がある。どちらが現在の正かは **要確認**。

静的データ（リポジトリ内 JSON、`05_PILOT/src/data/`）: `champions_summary.json`（173件）、`champions_detail_map.json`、`champions_index.json`、`ddragon_master_dict.json`、`item_dictionary.json`、`custom_roles.json`、`lolalytics_lane_meta.json`、`opgg_lane_meta.json`、`note_drafts.json`、`note_threads.json`。ビルド時に `compile_champions.mjs` がコンパイルする。

## 7. 外部連携

| 連携先 | 内容 | 根拠 |
|---|---|---|
| YouTube（yt-dlp） | 字幕取得、動画検索（prospector）、音声取得（Whisper 用） | `scripts/youtube_worker.py`、`prospector.py`、`whisper_transcriber.py` |
| YouTube RSS | チャンネル新着の軽量巡回（APIキー不要） | `scripts/cloud_youtube_monitor.py` |
| YouTube Data API（OAuth） | 解析不可動画のプレイリスト退避。環境変数 `YOUTUBE_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN`、`YOUTUBE_TARGET_PLAYLIST_ID`、`YOUTUBE_MANUAL_REVIEW_PLAYLIST_ID` | `scripts/auto_close_terminal_errors.py`、`setup_youtube_oauth.py`、Pilot の env 参照 |
| Gemini API | 記事生成・知識分解・コーチ応答（§2） | `src/lib/geminiClient.ts` |
| Ollama（ローカル） | 事実抽出のフォールバック（§2） | `scripts/llm_fallback_adapter.py`、`src/lib/ollamaClient.ts` |
| Riot API | 試合履歴・プレイヤー情報。`RIOT_API_KEY`、`src/lib/riot.ts` | |
| Data Dragon | チャンピオン／アイテムの公式データ。`src/lib/ddragonClient.ts` と辞典 JSON | |
| LoL Live Client Data API | ゲーム中のライブデータ（HUD 用） | `src/app/api/overlay/live-client-data/route.ts` |
| LoLalytics | レーン別メタデータ取得 | `05_PILOT/scripts/fetch_lolalytics_lane_meta.mjs`、`src/data/lolalytics_lane_meta.json` |
| KTM Portal | 同一 Supabase プロジェクト経由でデータ共有（§6）。Pilot の運用ダッシュボードが Portal の試合・募集データを参照する。HTTP API での直接連携はコードからは確認できなかった（**要確認**） | `src/app/api/admin/ops-dashboard/route.ts` |
| KTM Bot（Discord） | 直接の API 連携は確認できず。接続点は共有 DB（Bot が承認した知識が `personal_knowledge` に反映される運用）と、Discord 通知スクリプト群（`scripts/notify_discord.py` 等）。詳細は **要確認** | |
| GitHub Actions | パイプラインの実行基盤。`.github/workflows/ktm-cloud-worker.yml`（prospect / youtube / dict-sync）、`youtube-monitor.yml`（巡回）、`sentinel.yml`（リポジトリ監査）、`migrate.yml`（DBマイグレーション）ほか多数 | `.github/workflows/` |

## 8. 既存ドキュメントの所在

| 場所 | 内容 |
|---|---|
| `05_PILOT/docs/specs/` | SPEC・指示文 01〜24（セキュリティ、承認画面、コーチ、自動クローズ、優先度、Whisper 検証、Ollama/Gemini 比較、参考資料ライブラリ等）と配下の `reports/` |
| `05_PILOT/docs/reports/` | F2-revision-history-options-report、B11-single-approval-risk-report |
| `05_PILOT/docs/specs/reference-materials-*.md` | 参考資料の原典テキストと評価（AI・副業、開発ツール、LoL） |
| `05_PILOT/AGENTS.md` / `05_PILOT/CLAUDE.md` | 開発エージェント向けの注意書き（Next.js の新仕様に関する注意等） |
| リポジトリ直下 | `SYSTEM_DESIGN_BY_FUNCTION.md`（機能別設計）、`AI_HANDOFF.md`、`HANDOVER_CLAUDE.md`、`ANTIGRAVITY.md`、`GEMINI.md`、`KTM_実装検討メモ.md`、`KTM_改善バックログ.md`、`CLEANUP_AUDIT.md` |
| `04_PORTAL/supabase/migrations/README.md` | マイグレーション運用の説明 |
| 本メモ | `~/workspace/architecture-survey/pilot.md`（全体設計書の材料） |
