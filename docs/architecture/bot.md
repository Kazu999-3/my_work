# KTM Discord Bot 構造メモ（全体設計書の材料）

- 対象: リポジトリ `Kazu999-3/my_work` の `03_SYSTEMS/ktm_bot/`（Discord Bot 本体）と `03_SYSTEMS/TOOLS/`（運用スクリプト群）
- 時点: 2026-11-23、コミット `0783150` 時点のコードに対する静的解析
- 土台資料: Bot 振る舞い棚卸し `~/workspace/goals/ktm/files/ktm-bot-inventory-2026-11-23.md`（指示文30 実施直前の状態）。本メモはその後の指示文30〜37（案A一本化／帯ロビー集計／台帳DB化フェーズ1・2／残件整理）を反映した最新状態に更新したもので、棚卸しと食い違う箇所は本メモが新しい
- 表記: コードから確認できないものは **要確認** と明記する。根拠ファイルパスを各所に併記する

---

## 1. Bot の目的と動作基盤

### 目的

KTM（LoL カスタムゲームコミュニティ、約90名）の Discord サーバー運営 Bot。担う仕事は大きく4つ。

1. **週末定期カスタムの募集運営**（水曜の募集開始→リマインド→土日20:00の開催判定までを自動化）
2. **都度募集**（メンバーが任意に立てるカスタム募集カードの管理）
3. **Portal（04_PORTAL）への玄関口**（IGN・レーン登録、戦績表示、カジノ/コイン、師弟マッチングの入口を Discord 内に置く）
4. **管理者操作**（試合結果修正・MMR調整・ランク同期など、オーナー専用操作の実行口）

### 動作基盤

| 項目 | 内容 | 根拠 |
|---|---|---|
| 実行基盤 | Cloudflare Workers（サーバーレス、常駐プロセスなし） | `03_SYSTEMS/ktm_bot/wrangler.toml` |
| ワーカー名 | `ktm-os-worker`（`wrangler.toml` の `name`）。ただし `package.json` の name は `ktm-sovereign-worker` v3.0.0 で、表記が揃っていない | `wrangler.toml`、`package.json` |
| 受け口 | Discord Interactions の HTTP エンドポイント方式（Gateway の WebSocket 接続は持たない）。Ed25519 署名検証付き | `src/index.js` |
| インタラクション種別 | type 2 = スラッシュコマンド、type 3 = ボタン/セレクト、type 5 = モーダル送信 | `src/index.js` |
| 外部 HTTP エンドポイント | `/trigger-scheduled`（定時処理の手動起動、秘密キー必須）、`/sync-periodic-content`（既存定期カード本文の最新テンプレートへの書き換え、ヘッダ秘密キー必須） | `src/index.js` |
| ストレージ | Supabase（PostgreSQL、REST 直叩き）のみ。KV / D1 / R2 / Queues / Durable Objects のバインディングは無い | `wrangler.toml`、`src/utils/supabase.js` |
| 他システムとの接続 | Portal API（`src/utils/api.js` の `fetchPortalAPI`）と Discord API（`/api/v10/...`、メッセージ投稿・編集、ロール付け外し） | `src/utils/api.js`、各ハンドラ |
| 検証用スクリプト | `npm run dryrun:recruitment`（`scripts/dry_run_recruitment_status.mjs`）が募集集計・判定のドライランで、指示文30以降の完了条件に使われている | `package.json` |

入口の振り分け構造:

- ボタンは `src/handlers/components.js` が順に試す（registrationMentorship → portalBasics → notifySubstitute → periodicRecruit → adminQuickActions → recruitCard）。先に一致したハンドラが勝つ
- ベット系（`bet_team:` ボタン、`bet_modal:` モーダル）だけは `src/index.js` が先に横取りして `src/handlers/bet.js` に渡す

認証・認可は2層（`src/config.js`、`src/utils/recruitPermission.js`）:

- **オーナーのみ**（`CONFIG.ADMIN_ID`）: 試合結果修正・MMR調整・ランク同期・MMR初期化の実行
- **管理者IDs**（`env.ADMIN_DISCORD_IDS` ＋ オーナー）: 募集カード管理操作のフォールバック等

主要チャンネル・ID は `src/config.js` に集約されている（募集チャンネル、定期募集チャンネル＝試合チャンネル、成績チャンネル、エラーログチャンネル、募集通知ロール、Guild、オーナー）。

---

## 2. 定時ジョブ（cron 5本）の最新状態

根拠: `wrangler.toml`、`src/handlers/scheduled.js`、`src/handlers/jobs/*.js`。曜日は Cloudflare 独自体系（1=日曜〜7=土曜）。過去に Unix 式と混同して全5本が1日早く発火した事故があり、`wrangler.toml` に経緯コメントが残っている。

| # | cron式 | JST日時 | 処理 | 状態 |
|---|---|---|---|---|
| ① | `0 3 * * 4` | 水曜 12:00 | 週末定期カスタム募集の開始（前週カード削除、土曜・日曜カード投稿） | 稼働 |
| ② | `0 10 * * 6` | 金曜 19:00 | リマインド（土日両日分） | 稼働 |
| ③ | `0 8 * * 7,1` | 土・日曜 17:00 | リマインド（当日分） | 稼働 |
| ④ | `0 11 * * 7,1` | 土・日曜 20:00 | 開催判定（§4.2） | 稼働 |
| ⑤ | `0 0 * * 2` | 月曜 09:00 | 前週末カードの終了処理＋放置募集の掃除。週間レポートは**停止中**（呼び出しがコメントアウト。`wrangler.toml` のコメントも指示文36で「停止中」に修正済み） | 部分稼働 |

共通の仕組み（`src/handlers/scheduled.js`）:

- すべての実行は Supabase `bot_cron_runs` に記録される（開始時 POST、終了時 status を PATCH）。これは「Cloudflare cron が発火しなかった場合に Supabase の pg_cron ウォッチドッグが Portal 経由で `/trigger-scheduled` を叩いて再起動する」二重化のための記録
- バックアップ経路で定期募集が投稿された場合は、その旨が管理者アラートで通知される
- `scheduled()` 全体が try/catch で包まれ、例外時は管理者アラートが飛ぶ
- 手動モード（`/trigger-scheduled?mode=...`）: `weekly_recruit` / `weekly_recruit_reset`（カード再構築）/ `weekly_recruit_migrate`（旧1枚カード→土日2枚への移行）/ `weekly_report`（停止中レポートの手動実行経路のみ残存）/ `check_2000` / `event_notify` / `selftest_alert`（アラート配送テスト）

放置募集の自動クローズ（`src/handlers/jobs/maintenance.js` の `cleanupStaleAdhocRecruitments`）は水曜・月曜ジョブの中で実行され、投稿から6時間以上経過した未終了の都度募集カードを通知なしで終了状態にする。

---

## 3. スラッシュコマンドと主要なボタン/モーダル

### 3.1 スラッシュコマンド 9件

定義の単一の出所は `src/commandDefinitions.js`、振り分けは `src/index.js`。両者は9件で一致している（指示文36で、実態と食い違っていた `src/index.js` 内の古いコメント（「/portal に集約・/welcome 廃止」という誤記）を実態に修正済み。`/portal` コマンドは存在せず、`/welcome` は現役）。管理者専用コマンドは無く、全コマンドともギルドメンバーが実行できる。登録自体はリポジトリ外で行われる（§7 の登録系スクリプト参照）。

| コマンド | 振る舞い（要点） | 主な接続先 |
|---|---|---|
| `/welcome` | 新メンバー向け案内を公開投稿（最初にやること・土日の違い・お約束＋ボタン群） | Discord 内完結 |
| `/ign` | Riot ID の登録・変更（未登録ならプレイヤー自動作成＋ランク同期） | Portal `/api/player/update-puuid` |
| `/lane` | 希望レーン設定。オプション付きなら直接保存、無しならレーンモーダルを開く | Portal `/api/player/update-lane` |
| `/recruit` | 都度募集カードを募集チャンネルへ公開投稿（初期参加者を最大5名まで指定可） | Supabase `recruitments`、Portal Push |
| `/stats` | 自分の戦績を表示。結果 Embed は成績チャンネルへ**公開投稿**される | Portal `/api/player/stats` |
| `/ranking` | 最多勝・勝率・最多試合のランキングを公開投稿 | Supabase 直接集計 |
| `/coins` | コイン残高と貯め方をエフェメラル表示 | Portal `/api/bet` |
| `/casino` | コイン長者番付 TOP10 を公開表示 | Portal `/api/bet` |
| `/tip` | 他メンバーへコインを送る（自分宛ては拒否） | Portal `/api/bet/tip` |

### 3.2 主要なボタン系統（`src/handlers/components.js`、`src/handlers/buttons/*.js`）

| 系統 | ファイル | 役割 |
|---|---|---|
| `join_periodic_auto:<style>` / `join_periodic_sunday:<style>` | `buttons/periodicRecruit.js` | 定期カードの参加ボタン。style は full（フル参加）/ single（1戦のみ）/ late（途中参加）/ spectator（観戦）/ leave（辞退）。指示文35以降は DB 駆動（§4.3） |
| `spectator_accept:<day>:<lobby>` | `buttons/periodicRecruit.js` | 20:00判定で観戦者へ出した「出場する」承諾ボタン（指示文31で新設）。21:00 前にロビーが10名に到達すると自動で開催確定アナウンスを出す |
| `proxy_add_init:<owner>` / `proxy_add_submit:...` | `buttons/periodicRecruit.js` | 代理追加。ユーザーセレクト方式に一本化済み（指示文31で、到達不能だった名前入力モーダル方式の残骸を撤去） |
| `join_any:<owner>` / `join_role:<role>:<owner>` / `toggle_spectate:<owner>` / `leave_recruit:<owner>` / `upgrade_to_10` / `close` 系 / `delete_recruit` | `buttons/recruitCard.js` | 都度募集カードの参加・観戦・離脱・管理操作。指示文37で DB 駆動化 |
| `recruit_manage:<owner>`（セレクト） | `buttons/recruitCard.js` | 募集主/管理者向け管理セレクト（edit / upgrade / proxy / close / close_silent / delete へ読み替え） |
| `portal_register` / `portal_ign` / `portal_lane` / `portal_stats` / `portal_recruit` / `portal_playstyle` | `buttons/portalBasics.js` | Portal 連携の入口ボタン群（各モーダルを開く、またはコマンド処理へ委譲） |
| `playstyle_role:<...>` | `buttons/portalBasics.js` | プレイスタイルに応じた Discord ロールの付け外し（ロールIDは Supabase `ktm_settings` から取得） |
| `toggle_recruit_notification` | `buttons/notifySubstitute.js` | 募集通知ロールの付け外し |
| `mentorship_apply_pupil` / `mentorship_apply_mentor` / `mentorship_claim_pupil:<id>` / `secret_match_accept:` / `secret_match_decline:` 等 | `buttons/registrationMentorship.js` | 師弟（メンタリング）登録・引き受け・シークレットマッチ応答。Portal `/api/mentorship/*` に接続 |
| `admin_fix_match` / `admin_adjust_mmr` / `admin_sync_ranks` / `admin_init_mmr` / `exec_init_mmr:<...>` | `buttons/adminQuickActions.js` | オーナー専用の管理操作（結果修正・MMR調整・ランク同期・MMR初期化） |
| `quick_recruit:<mode>:<max>` | `buttons/adminQuickActions.js` | 都度募集カードの即時投稿（実行者自身は参加者に入らない） |
| `bet_team:BLUE` / `bet_team:RED` | `handlers/bet.js` | 試合カードの勝敗ベット入口（金額入力モーダルを開く）。現役機能。ボタンを含むメッセージの生成箇所は Bot 内に無い（**要確認**: Portal 側から投稿される試合カードとみられる） |

指示文33で撤去済みの系統（現行コードに存在しない）: `opgg_scout`（未配線スタブ）、`approve_knowledge:`（生成側なし。Bot が Supabase `personal_knowledge` を直接書く経路もあわせて消滅）、`quick_substitute_*`（2026-10-03 に生成側廃止済みの残骸）。調査の詳細は `docs/reports/31-unknown-buttons-investigation.md`。

### 3.3 モーダル（`src/handlers/modals.js`、`src/handlers/bet.js`）

現行で送信ハンドラが存在するもの:

| custom_id | 処理 |
|---|---|
| `portal_recruit_modal` | 都度募集の作成（モード正規化・上限デフォルト、カード投稿＋`recruitments` 記録＋Portal Push） |
| `portal_register_modal` | 初期登録（IGN＋レーン一括）→ Portal `/api/player/update-puuid` |
| `portal_ign_modal` | IGN 変更 → 同上 |
| `portal_lane_modal` | レーン設定 → Portal `/api/player/update-lane`（`allowHigher` は送らない。`/lane` コマンドのオプション経路とは非対称） |
| `admin_fix_match_modal` / `admin_adjust_mmr_modal` | オーナーのみ → Portal `/api/admin/fix-match` / `/api/admin/adjust-mmr` |
| `mentorship_claim_modal:<profileId>` | 弟子の引き受け → Portal `/api/mentorship/matches` |
| `mentorship_pupil_modal` / `mentorship_mentor_modal` | 師弟プロフィール登録 → Portal `/api/mentorship/profiles` |
| `edit_recruit_modal:<owner>` | 都度募集カードの内容編集（カード再描画） |
| `bet_modal:<BLUE\|RED>` | ベット実行 → Portal `/api/bet` へ POST |

残骸: `mentorship_checkin_pupil_modal:` / `mentorship_checkin_mentor_modal:` のハンドラは残っているが、対応ボタンはモーダルを開かず「この機能は終了しました」を返すため到達不能（実害なし）。

---

## 4. 募集フローの最新仕様

### 4.1 定期カスタム（週末）

前提（ユーザー決定 2026-11-23）: **上位帯と中初級帯は基本的に完全に分けて、それぞれ10人集める**（独立した2ロビー）。繰り上げ・格下サポートは不足時の穴埋めで、Portal バランサー側の処理であり、Bot の集計には入れない。

| 項目 | 土曜（本戦） | 日曜（お祭り） |
|---|---|---|
| カード | 曜日ごとに1枚（土曜・日曜で別カード） | 同左 |
| 集計単位 | **2ロビー制**（指示文32）: 上位帯ロビー／中初級帯ロビー、各定員10名 | **単一プール** 定員10名（指示文33でロビー分けを外し従来形に復帰。「ランク不問」が前提のため） |
| 帯の境界 | 推定MMR 1450（`BAND_BOUNDARY_MMR`、`src/utils/recruitmentLedger.js` / `src/utils/recruitmentStatus.js`）。推定MMR未設定の参加者は中初級帯ロビーに入る（ユーザー承認済みの扱い） | 帯を分けない |
| 表示 | ロビー見出しは帯名（上位帯ロビー／中初級帯ロビー）。参加者一人ひとりの行の表示形式は従来どおり（名前＋推定MMR＋参加形態） | 従来どおりの一括表示 |
| 参加形態 | フル参加 / 1戦のみ / 途中参加（2戦目〜）/ 観戦 / 辞退 | 同左 |

週の流れ:

1. **水曜 12:00**（cron ①）: 前週カードを削除し、土曜・日曜カードを投稿。あわせて Portal 経由で Web Push（`/api/push/notify-recruit`）
2. **参加**: ボタン押下で DB に記録し、カードは DB の内容から再描画（§4.3）。残り枠がちょうど1になった瞬間に「あと1名」促進投稿（ロビー単位で、不足している帯を名指し）
3. **金曜 19:00 / 土日 17:00**（cron ②③）: リマインド。ロビーごとの残り枠を併記。両ロビー満員なら送らない。旧リマインドは送信前に削除され、チャンネルには最新の1通だけが残る
4. **土日 20:00**（cron ④）: 開催判定（§4.2）
5. **月曜 09:00**（cron ⑤）: カードを受付終了状態にし、放置募集を掃除

参加フロー（案A、指示文30で実施済み）:

- かつて土曜参加直後に Discord 上で出ていた「格上サポート3択」（`higher_risk:` 一式。MMR差200を条件に発火し、`accept_challenge` は DB に何も書かない等、帯境界1450とは無関係の仕組みだった）は**全廃済み**。参加ボタンは参加・辞退・参加形態の変更だけを行い、対面保護・繰り上げ・格下サポートの希望は Portal のプロフィール設定からバランサーが自動で読む
- 参加が成立したとき、その人の Portal プロフィールで希望レーンまたは格上対面設定が未設定なら、参加完了応答に設定ページへの案内を1回だけ添える（指示文31。判定は `role_preferences` / `allow_higher` の有無、辞退・変更時には出さない）

### 4.2 20:00 開催判定（`src/handlers/jobs/eventNotify.js` の `checkCustomStatusAt2000`）

実行ウィンドウは 19:50〜21:00 JST。判定は**ロビーごとに独立**して適用され（土曜）、片方だけ開催確定・もう片方は助っ人募集や中止という結果があり得る。日曜は単一プールに対して同じ分岐を適用する。

| 分岐 | 条件と動作 |
|---|---|
| (A) 開催確定 | 第1戦の人数（フル参加＋1戦のみ）が10名以上 → 参加者全員をメンションして開催確定 |
| (A-2) 第2戦から開催確定 | 第2戦の顔ぶれが揃った場合 → 第2戦参加者をメンション |
| (A-3) 観戦者への参加お願い | 参加者＋第1戦の観戦希望者で10名に達する場合 → 観戦希望者をメンションし、「出場する」ボタン（`spectator_accept:`）で意思確認。**21:00 前にボタン応答で10名に到達すると自動で開催確定アナウンス**（指示文31。従来は主催者の手判断だった部分の自動化）。21:00 を過ぎたら自動確定しない |
| (B) ピンポイント助っ人募集 | 参加者8名以上かつ遅刻参加希望者が1名以上 → 募集通知ロールをメンションし、当日参加ボタン付きで投稿。不足している帯を指定する |
| (C) 中止 | 上記いずれでもない場合 → 参加者のみメンションして中止を告知し、カードを終了状態にする。「通常募集を立てる」ボタン付き |

送信先チャンネルは `src/config.js` の定期募集チャンネルが正（指示文36で、どこにも定義されていない環境変数 `DISCORD_KTM_CHANNEL_ID` の参照を削除済み。かつてこの未定義変数が原因で開催判定が無言で動かない事故があった）。チャンネルが解決できない場合はエラーログ＋管理者アラートを残す。

### 4.3 台帳 DB（`recruitments` / `recruitment_participants`）の役割

設計報告書: `docs/reports/34-recruitment-ledger-db-design.md`。実装: 指示文35（定期募集）・指示文37（都度募集・Portal 側）。

**なぜ DB 化したか（調査で判明した事実）**: 旧方式は参加者名簿の実体が Discord カード本文そのもので、Bot は本文をパースして集計していた。`recruitments` テーブルは募集のヘッダー情報（message_id、owner、mode、status 等）しか持たず、参加者名簿を入れるテーブルが最初から存在しなかった。過去に「書き込み実測0行」だった時期の主因は、Worker の Supabase キーが anon キーで RLS に弾かれていたこと（現在は service_role に切替済みで、ヘッダー行は書けている）。

現在の構造:

| テーブル | 役割 |
|---|---|
| `recruitments` | 募集のヘッダー。Bot が作成（POST）と status 更新（open → closed / deleted）を行う |
| `recruitment_participants` | **参加者台帳（正）**。migration 142（`04_PORTAL/supabase/migrations/142_recruitment_participants.sql`）で新設。1募集×1ユーザーで1レコード（UNIQUE 制約で UPSERT 可能）。持つ情報: 参加形態（style: full / single / late / spectator）、ロビー（lobby: high / low / all）、希望レーン、ランク帯、推定MMR、辞退フラグ（`is_cancelled`、論理削除で履歴を残す）。RLS 有効で、読み取りは公開、書き込みは Bot の service_role のみ（anon の INSERT が拒否されることを指示文36で実測確認済み） |

データフロー（`src/utils/recruitmentLedger.js` が中核）:

- 参加・変更・辞退: `recordParticipant`（UPSERT）/ `cancelParticipant`（論理削除）で DB に書き込み、カード Embed は `fetchActiveParticipants` ＋ `buildDisplayLinesFromDb` で **DB の内容から再描画**する。表示は DB の投影という位置づけ
- 集計: リマインド・あと1名・20:00判定は `src/handlers/jobs/periodicCards.js` の `loadDayRecruitmentSummary` 経由で DB から直接読む（定期・都度とも）
- DB 書き込み失敗時: 握りつぶさず管理者アラート（`notifyAdminError`）に通知し、カード表示と DB が黙って乖離しないようにしている
- 移行期の互換: `recruitments` の行が無い古いカードについては、従来の本文パース方式にフォールバックする（既存カードを壊さないための段階的移行）
- 過去データ: 移行時に7日より古い `open` のままのレコード3件を一括で `closed` に更新済み（migration 142 内のクリーンアップ）

切り替えは水曜12:00の新規カード投稿に合わせて行われ、最初の DB 駆動カードは **2026-11-25（水）12:00 投稿分**の予定。**要確認**: 本番で実際に DB 駆動カードが投稿され、ボタン押下で DB に記録されること（コードとドライランでは確認済みだが、実機 Discord での観戦者自動確定の挙動を含め、本番確認はこれから）。

Portal 側の連動（指示文37）: Portal のオンボーディング管理（`04_PORTAL/src/lib/periodicCustomCard.ts` の `loadNextPeriodicCustomEntries`）は、従来は Discord API 経由でチャンネルメッセージを走査・本文パースして参加者を取得していたが、`recruitments` / `recruitment_participants` への DB クエリに置き換え済み。DB レコードが無い場合やエラー時は従来の走査へフォールバックする。

### 4.4 都度募集

- 入口: `/recruit` コマンド、募集モーダル（`portal_recruit_modal`）、クイック募集ボタン（`quick_recruit:`）
- 参加形態: レーン指定参加（`join_role:`）/ 誰でも参加（`join_any:`）/ 観戦 / 離脱。帯ロビーの概念はなく、台帳上の lobby は `all`
- 指示文37で定期募集と同じ DB 駆動方式に移行済み（古いカードは本文パースにフォールバック）
- 満員時: 募集主＋参加者をメンションした「メンバー確定」通知、カスタムの場合はレーン充足サマリー Embed、Portal `/api/bet/recruit-reward`（参加ボーナス）。ノーマル/ARAM はそのまま `recruitments` を closed にする
- 募集主/管理者の管理操作: 編集（モーダル）、上限を10へ拡張、代理追加、締切/解散、削除（墓標表示化）
- 放置された都度募集は6時間で自動クローズ（§2）

---

## 5. データ: Supabase テーブルと Portal API

### 5.1 Supabase テーブル（`src/utils/supabase.js` 経由で REST アクセス）

| テーブル | 読み | 書き | 用途 |
|---|---|---|---|
| `ktm_players` | ○ | △ | 参加バッジ（経験・ランク・希望レーン）、帯判定用の推定MMR・レーン別MMR、`role_preferences`、`allow_higher`、IGN 等の名簿マスタ。直接の書き込みは「開催確定済みカードからの離脱時の `pity` リセット」のみ |
| `recruitment_participants` | ○ | ○ | 参加者台帳（§4.3）。参加・変更・辞退の UPSERT と論理削除 |
| `recruitments` | ○ | ○ | 募集ヘッダー（作成と status 更新）。参加者取得の起点（message_id → 募集の特定） |
| `recruitment_activity_logs` | － | ○ | 参加・離脱・代理追加の監査ログ（種別: periodic_sat / periodic_sun / spontaneous、PROXY_ADD 等） |
| `bot_cron_runs` | － | ○ | cron 実行記録（ウォッチドッグ二重化用、§2） |
| `ktm_settings` | ○ | － | `discord_role_sync`（プレイスタイル用ロールID）、`sunday_festival_theme`（日曜お祭りのテーマ） |
| `ktm_matches` / `ktm_match_participants` | ○ | － | `/ranking` の集計。週間レポート（停止中）の集計にも使われていた |

注: かつて Bot が直接書いていた `personal_knowledge.review_status`（知識記事の承認）は、承認ボタン自体の撤去（指示文33）により現行コードから消えている。

### 5.2 Portal API エンドポイント（`src/utils/api.js` の `fetchPortalAPI`）

ベースURLは `env.PORTAL_API_URL` → `env.LOCAL_API_URL` → `CONFIG.PORTAL_URL` の順で解決される。

| エンドポイント | 使う機能 |
|---|---|
| `/api/player/update-puuid` | `/ign`、登録モーダル、IGNモーダル |
| `/api/player/update-lane` | `/lane`、レーンモーダル |
| `/api/player/stats` | `/stats`、`portal_stats` ボタン |
| `/api/push/notify-recruit` | 定期・都度すべての募集作成時（Web Push。宛先の決定は Portal 側で、Bot からは見えない） |
| `/api/bet`（GET / POST） | `/coins`、`/casino`、ベットモーダル |
| `/api/bet/tip` | `/tip` |
| `/api/bet/recruit-reward` | 都度募集が満員になった時 |
| `/api/mentorship/matches` | 弟子の引き受け（`X-Bot-Secret` ヘッダ＝`env.PORTAL_BOT_SECRET` 付き） |
| `/api/mentorship/profiles` | 師弟プロフィールの登録 |
| `/api/mentorship/matchmaker` | シークレットマッチの承諾／辞退 |
| `/api/bot/member-channel-message` | 個人宛て通知の配送（§6） |
| `/api/admin/fix-match` | 勝敗修正モーダル（オーナーのみ） |
| `/api/admin/adjust-mmr` | MMR調整モーダル（オーナーのみ） |
| `/api/admin/init-mmr` | MMR初期化の実行（オーナーのみ） |
| `/api/riot/sync-ranks` | ランク同期ボタン（オーナーのみ） |
| `/api/admin/knowledge/add` | 知識追加系の処理から呼ばれる（**要確認**: 呼び出し箇所の現行用途は本メモでは深追いしていない） |

### 5.3 Portal のプロフィール設定と Bot の関係

| Portal 設定 | Bot での使われ方 |
|---|---|
| `role_preferences.primary / secondary`（希望レーン） | 参加行のレーン表記、都度募集の満員時レーン充足サマリー、未設定者への案内（指示文31）の判定 |
| `ng_lane_1 / ng_lane_2` | 都度募集の満員時レーン充足サマリー |
| `allow_higher`（格上対面の可否） | 未設定者への案内の判定に使うのみ。かつての主用途（3択フローの発火ゲート）は指示文30で消滅 |
| `tier_promotion_pref`（繰り上げ希望）/ `allow_lower_support`（格下サポート） | **Bot 内に参照が一切無い**。帯の穴埋め判断は Portal／バランサー側で完結する |
| 推定MMR（Portal MMR） | 帯ロビーの振り分け（1450境界）と参加行の表示に使う。Bot が表示するランク帯バッジとは別物 |

### 5.4 環境変数（コードから参照を確認したもの）

`DISCORD_TOKEN`、`DISCORD_PUBLIC_KEY`、`SUPABASE_URL`、`SUPABASE_KEY`、`PORTAL_API_URL`、`LOCAL_API_URL`、`PORTAL_BOT_SECRET`、`INTERNAL_GAS_SECRET`、`BOT_TRIGGER_KEY`、`ADMIN_DISCORD_IDS`、`ADMIN_WEBHOOK_URL`、`ADMIN_LOG_CHANNEL_ID`、`DISCORD_GUILD_ID`。（指示文36で `DISCORD_KTM_CHANNEL_ID` の参照は削除済み）

---

## 6. 通知の経路

大原則: **Bot は Discord の DM を一切送らない**（コード全体で確認済み）。「個人宛て」の通知はすべて Portal の `/api/bot/member-channel-message` 経由で、その人の**個別案内チャンネル**へ投稿される（2026-10-20 のユーザー判断で DM 方式から変更された経緯がコード内コメントにある）。個別チャンネルが無いメンバーへの配送時の振る舞いは Portal 側の実装依存で、Bot コードからは **要確認**。

主な通知経路:

| 種類 | トリガー | 宛先・メンション |
|---|---|---|
| 定期募集カード | 水曜12:00 cron / 手動モード | 定期募集チャンネル。土曜のみ本文に募集通知ロールメンション |
| リマインド | 金曜19:00・土日17:00 cron | 定期募集チャンネル。募集通知ロールメンション |
| 開催確定 / 第2戦から開催 / 観戦者へのお願い / 助っ人募集 / 中止 | 土日20:00 判定 | カードへの返信形式。分岐ごとにメンション先が異なる（§4.2） |
| あと1名促進 | 定期・都度どちらのカードでも残り枠が1になった瞬間 | カードへの返信。メンションなし |
| メンバー確定 / 締切・解散・削除通知 | 都度募集の満員・管理操作 | カードへの返信。募集主＋参加者メンション |
| オンボーディング案内 | 未登録・レーン未設定の人が募集に参加 | 本人の個別案内チャンネル（Portal API 経由） |
| プロフィール設定のお願い | 定期募集への参加時、希望設定が未設定の場合 | 参加した本人へのエフェメラル応答内（指示文31） |
| 代理追加の完了 / ベット完了 | 各操作の完了時 | 公開フォローアップ |
| Portal Web Push | 募集作成時 | Portal `/api/push/notify-recruit`（宛先決定は Portal 側） |
| 管理者エラーアラート | 各所の例外・失敗 | `env.ADMIN_WEBHOOK_URL` があれば Webhook 優先、無ければエラーログチャンネル（`src/utils/alert.js`）。配送確認は手動モード `selftest_alert` |
| 週間個人レポート | **停止中** | （各プレイヤーの個別案内チャンネル宛ての実装が残っているが cron からは呼ばれていない） |
| 自動削除・終了の類 | 各ジョブ・ボタンの副作用 | 前週定期カードの削除、旧リマインドの削除、放置都度募集の無言クローズ、月曜の定期カード終了処理 |

失敗の検知がアラート一点に依存するフローが多い点は運用上の注意点（アラート経路自体が死ぬと無言になる）。

---

## 7. `03_SYSTEMS/TOOLS` のスクリプト類

Bot 本体とは別の、運用・保守用スクリプト置き場。Discord トークンは環境変数または `03_SYSTEMS/ktm_bot/.dev.vars` から読むものが多い。

| ファイル | 役割 |
|---|---|
| `register_portal_commands.js` | スラッシュコマンドを Discord に登録する。定義は `ktm_bot/src/commandDefinitions.js` を単一の出所として読む（2026-10-19 に「処理はあるのに未登録で使えないコマンドがある」問題を受けて整備された経緯がヘッダにある） |
| `unregister_discord_commands.mjs` | 登録済みコマンドの一覧表示（`--list`）と不要分の削除（`--apply`）。Discord 側の実際の登録状態を確認する唯一の手段（2026-09-29 新設） |
| `list_discord_commands.js` | Discord に登録されているコマンドの一覧取得 |
| `check_discord_commands.py` | 同上（Python 版。`.env` から認証情報を読む） |
| `list_channels.js` | チャンネル一覧の取得 |
| `post_welcome_panel.js` | ウェルカムパネルを投稿する |
| `post_ktm_announcement.py` | 水曜21時の KTM イベント告知を Discord Webhook へ投稿する（**要確認**: 現在も定期運用されているかはコードからは分からない） |
| `fix_yt_titles.py` | 知識ベース（kirei_bible）内の「# YouTube Video」仮タイトルを yt-dlp で実タイトルに置換する。Bot 本体ではなく Pilot/知識系の保守用 |
| `retrofit_multi_champions.py` | kirei_bible の既存記事に複数チャンピオン対応のメタ情報を遡及付与する。知識系の保守用 |
| `rewrite_articles.py` | 記事の書き換え用スクリプト（用途の詳細は **要確認**） |
| `test_herald.py` | Herald（告知系）のテスト用スクリプト（詳細は **要確認**） |

参考: `03_SYSTEMS/ktm_bot/scripts/` には Bot 自身の保守スクリプトがある（`dry_run_recruitment_status.mjs`＝検証用ドライラン、`check_balancer_pending.mjs`、`resort_active_cards.mjs`、`migration_puuid.sql`、`setup_ktm.sql`）。

`03_SYSTEMS/` 直下には Bot 以外にも `APPS/`、`v2_CORE/`（edge_daemon 等）、`INFRA/`、`DAEMONS_GUIDE.md`、`RUNBOOK.md` 等があるが、本メモの対象外（Bot と TOOLS のみ）。

---

## 8. 既存ドキュメントの所在

### Bot の仕様・指示文（`03_SYSTEMS/ktm_bot/docs/specs/`）

| ファイル | 内容 |
|---|---|
| `28-recruit-button-alignment-instruction.md` | 募集ボタンの文面・表記を Portal 現行仕様に合わせる指示 |
| `29-recruit-flow-inventory-report-instruction.md` | 参加フローの洗い出し報告を求める指示 |
| `30-recruit-flow-unify-plan-a-instruction.md` | 格上サポート3択の廃止と Portal プロフィール設定への一本化（案A） |
| `31-usability-improvements-instruction.md` | 棚卸しからの使い勝手改善（代理追加一本化、文言統一、観戦者自動化、未設定者への案内、不明ボタン調査） |
| `32-band-aware-recruitment-instruction.md` | 定期募集をロビー単位の集計・判定にする |
| `33-sunday-single-lobby-and-dead-buttons-instruction.md` | ロビー分けは土曜のみに戻す＋眠っているハンドラ3系統の撤去 |
| `34-recruitment-ledger-db-investigation.md` | 台帳DB化に向けた調査・設計案の提出を求める指示 |
| `35-recruitment-ledger-db-implementation.md` | 台帳DB化の実装（フェーズ1: 定期カスタム） |
| `36-small-cleanups-and-migration-verify-instruction.md` | 小さい残件整理（古いコメント、未定義環境変数）とマイグレーション適用確認 |
| `37-ledger-phase2-adhoc-and-portal-instruction.md` | 台帳DB化フェーズ2（都度募集のDB化、Portal 側の参加者取得のDB化） |

### Bot の調査報告（`03_SYSTEMS/ktm_bot/docs/reports/`）

| ファイル | 内容 |
|---|---|
| `28-recruit-flow-inventory.md` | 参加フロー（3択時代）の詳細棚卸し。発火条件や DB に書かない問題等の原典 |
| `31-unknown-buttons-investigation.md` | 出所不明ボタン4系統の調査（bet_team は現役、他3系統は撤去判断の根拠） |
| `34-recruitment-ledger-db-design.md` | 台帳DB化の調査結果と設計案（書き込み0行の原因特定、テーブル設計、移行手順、未決事項4点） |

### その他のドキュメント

| ファイル | 内容 |
|---|---|
| `~/workspace/goals/ktm/files/ktm-bot-inventory-2026-11-23.md` | Bot 全体の振る舞い棚卸し（本メモの土台。指示文30 実施直前の状態を記録） |
| `03_SYSTEMS/ktm_bot/KTM_USER_GUIDE.md` | 利用者向けガイド |
| `03_SYSTEMS/ktm_bot/ANTIGRAVITY.md` | 実装担当（Antigravity）向けの指示・前提メモ |
| `04_PORTAL/supabase/migrations/142_recruitment_participants.sql` | 台帳テーブルのマイグレーション本体（Portal 側の migrations 置き場に集約されている） |
| `02_FACTORY/DAILY_LOG.md` | 実装担当の日次ログ。各指示文の実施記録はここに残る（ただしユーザー指示・合意の主張は鵜呑みにせず都度確認する運用） |

---

## 付録: 残っている既知の論点（2026-11-23 時点）

- 本番確認待ち: 2026-11-25（水）12:00 の DB 駆動カード初投稿、今週末の観戦者自動確定（`spectator_accept:`）の実機挙動
- Discord 側の実際のコマンド登録状態は `TOOLS/unregister_discord_commands.mjs --list` でしか確認できず、最終確認は **要確認**
- 師弟チェックインの到達不能なモーダルハンドラ、`handleRolesCommand`（`src/handlers/commands.js` に export されているが振り分けに無く未使用）等の小さな残骸が残っている
- `/ranking` の勝率集計条件について、コード内コメント（5戦以上）と実装（3戦以上）の不一致が棚卸しで指摘されている（本メモでは再検証していない）
