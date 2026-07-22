# AIエージェント向け 引き継ぎ資料

このリポジトリ（LoLコミュニティポータル `my_work`）で、直近のセッションで行った実装・調査・意思決定をまとめる。次に担当するAIが、同じ調査を繰り返さずに続きを進められることを目的とする。

---

## 0. まず把握すべきこと

- **リポジトリ**: `github.com/Kazu999-3/my_work`（ブランチ `master`）
- **モノレポ構成**:
  - `04_PORTAL/` — Next.js 16.2.7 (Turbopack) 製の会員ポータル。Vercelにデプロイ（プロジェクト `my-work-8jbd`、本番URL `https://my-work-8jbd.vercel.app`）
  - `03_SYSTEMS/ktm_bot/` — Cloudflare Workers 上のDiscord Bot（`ktm-os-worker`）
  - `03_SYSTEMS/v2_CORE/` — Python製のバックエンド群（旧「Sovereign OS」。多くは未使用化・クラウド移行済み）
  - `scripts/` — GitHub Actionsから走るクラウドワーカー（Python）
  - `.github/workflows/` — 定期実行のcron群
- **DB**: Supabase（無料枠）。RLS有効。書き込みはサービスロールキー経由。
- **AI**: Google Gemini（モデルは `gemini-3.1-flash-lite` に統一。15 RPM / 500 RPD）

### デプロイの流れ（重要）
開発者（かずき）のPC上で `deploy.bat` を実行 → git push → 以下が自動で走る:
1. Vercel（ポータル）が再ビルド・デプロイ
2. Cloudflare Workers（Bot）がCIでデプロイ
3. `migrate.yml`（GitHub Actions）が `04_PORTAL/supabase/migrations/*.sql` を順に適用

**AIはサンドボックスでコミットするだけ。実際のデプロイはユーザーが `deploy.bat` を叩く。** マイグレーションもこの流れで自動適用される。

### サンドボックスの制約
- `npm test` は動かない → `tsc` で `/tmp` に出してから `node --test` で実行する
- 型チェック: `node_modules/.bin/tsc --noEmit -p tsconfig.json | grep 'error TS' | grep -v '.next/'`
- ネットワークは限定的。実APIには繋がらないので、外部接続を要する検証はユーザーに依頼する
- `.next` の古いキャッシュでビルドが壊れることがある → `rm -rf .next/dev .next/types`

---

## 1. アーキテクチャの現状（移行の結果）

**このセッションで「ローカルPC常駐 → クラウド」への移行を大きく進めた。** 現在の役割分担:

| コンポーネント | 実行場所 | 状態 |
|---|---|---|
| ポータル（Next.js） | Vercel | 常時稼働 |
| Discord Bot（KTM） | Cloudflare Workers | 常時稼働 |
| YouTube解析 | GitHub Actions (`scripts/youtube_worker.py`) | 30分おき |
| 動画の自動発掘 | GitHub Actions (`scripts/prospector.py`) | 1日3回 |
| ナレッジ→辞典 同期 | GitHub Actions (Vercel APIをcurlで叩く) | 3時間おき |
| 海外情報スカウト | GitHub Actions (`_LOL/overseas_scout.py`) | 1日3回 |
| Sovereign Pulse | GitHub Actions (`v2_CORE/run_pulse_once.py`) | 6時間おき |
| Edge Worker / whisper文字起こし | ローカルPC (`start_all.bat`) | 必要時のみ |

**ローカルPCが必要なのは、字幕なし動画のwhisper文字起こしだけ。** それ以外はPCを閉じていても動く。`start_all.bat` は既定でEdge Workerのみ起動する（フル起動は `start_all.ps1 -Mode all`）。

### cron一覧（`.github/workflows/`）
- `ktm-cloud-worker.yml`: youtube(`*/30 * * * *`) / dict-sync(`7 */3 * * *`) / prospect(`30 18,2,10 * * *`)
- `scout.yml`: `0 19,3,11 * * *`（1日3回）
- `pulse.yml`: `0 */6 * * *`
- `migrate.yml`: push時にマイグレーション適用
- **停止中（手動のみ）**: `absorber.yml`（youtube解析と重複）, `monetization.yml`（参照先スクリプトが存在しない）

---

## 2. このセッションで実装したこと（新しい順）

コミットハッシュは `git log` で辿れる。

### クラウドワーカー整備
- **`scripts/notify.py`（新規）**: クラウドワーカーの結果をDiscord Webhookで通知する共通ヘルパー。`DISCORD_WEBHOOK` 未設定なら静かに何もしない。
- **`scripts/youtube_worker.py`**: 実行結果（完了N本／失敗N本＋理由）をDiscord通知。yt-dlpのstderrを握りつぶすのをやめ、字幕取得失敗の理由をログに残すようにした。`Sign in to confirm...` / 429 を検知したら「IP制限の疑い」と明示。
- **`scripts/prospector.py`（新規、旧`v2_CORE/prospector.py`の後継）**: 辞典の更新が古いチャンピオンの解説動画をyt-dlp検索で見つけ、`youtube_queue` に積む。重複除外・尺フィルタ(4〜60分)・解析待ちが20本超なら見送るバックログガードあり。テストは `scripts/tests/test_prospector.py`（9件）。
- **`scripts/youtube_worker.py`**: モデルを `gemini-2.5-flash`（日次上限超過の実績あり）から `gemini-3.1-flash-lite` に変更。

### Discord Bot（`03_SYSTEMS/ktm_bot/`）
- **`src/utils/ktmRank.js`（新規）**: MMR→KTMランク変換。閾値は `04_PORTAL/src/lib/mmr.ts` の `KTM_TIERS` と**必ず同期**すること。募集通知に参加者ごとのMMR＋ランク（`1450（ゴールド相当）`）とランク内訳を表示。旧「しきい値の上下に何人」表示を `scheduled.js` と `components.js`（2箇所）で置換。

### ポータル（`04_PORTAL/`）— パーソナルコーチ
- **`src/lib/riot.ts`**: `fetchRankedSoloMatchIds`（新規）を追加。ランクソロ(queue=420)のみ、失敗時は空を返す。従来は「420で失敗→キュー無指定で再取得」のフォールバックがあり、ノーマル/ARAMが分析に紛れていた。`coach/analyze`（4モード）と `cron/soloq-coach` を全てこれに統一。

### ポータル — 知識ベース／攻略ライブラリ
- **レーン別ガイド**: 記事統合の`upsert`エラーを握りつぶして元記事だけ`__DELETED__`にする不具合を修正。特定記事を任意のレーンへ送る「ガイドへ送る」機能を追加（`action: 'merge_one'`）。
- **更新履歴・差分**（`migration 30_knowledge_revisions.sql`, `src/lib/knowledgeRevisions.ts`, `RevisionsPanel.tsx`）: 辞典・ガイドのAI統合時に前の本文をスナップショットし、行差分表示とロールバックを可能にした。LCSベースの差分、単体テストあり。
- **攻略ライブラリの削除**: 移動済みページの「削除」が`__DELETED__`タグを付け直すだけで実際は消えていなかった。サービスロールAPI（`api/admin/knowledge/delete`）経由の物理削除に修正。
- **YouTube動画キュー**: 生成記事との紐づけ（`source_url`/本文の動画IDで突合）、チャンネルフィルタ、タイトルコピー検索を追加。

### ポータル — ダッシュボード（システムコクピット）
- サービス監視を実アーキテクチャに合わせて刷新。全カードが`SYSTEM_METRICS`（`sre_daemon.py`のみが書く）依存だったため、ローカルデーモンが止まるとクラウドのポータル/Botまで「停止中」に見えていた。クラウド常時稼働／ローカル必要時起動を分離。未使用の状態変数・countクエリを削除。

### 全体リファクタ（コミット `dcd5ae6`〜`8c7b865`）
`CLEANUP_AUDIT.md` に詳細。要点:
- **削除**: 古いMMRリビルドAPI `api/admin/rebuild-mmr`（discord_id対応前の危険な実装）、`RadarChart.tsx`、`lib/recruitPermission.ts`、Bot側`balancer.js`、`api/collab-tasks`、`api/discord/join`
- **Supabaseクライアント集約**: 個別`createClient()`が21ファイル→0。全て`lib/supabaseAdmin`経由に。サービスロールキー未設定の警告が全経路で効くように。
- **Gemini呼び出し集約**: `knowledge/add`と`match/analyze-image`を`callGeminiWithRetry`経由に。ついでに共通クライアントへ**複数APIキーのローテーション**と**画像入力対応**を追加（全AI機能が恩恵を受ける）。
- **Discord表示名**: `nick||global_name||username`の3箇所重複を`lib/discordName.ts`に集約（空文字nickの扱いをテストで固定）。

---

## 3. 重要な「落とし穴」（次のAIが踏みやすい地雷）

1. **マイグレーションのリネーム禁止**: `_migrations`テーブルはファイル名で適用済みを判定する。リネームすると再実行される。特に`24_add_participant_mmr.sql`は先頭が`DROP COLUMN`なので、再実行でデータが消える。番号24が重複しているが**そのまま残すこと**。詳細は `04_PORTAL/supabase/migrations/README.md`。
2. **`CREATE POLICY IF NOT EXISTS`は存在しない**（Postgres仕様）。ポリシーは`DROP POLICY IF EXISTS`→`CREATE POLICY`で書く。`migrate.mjs`は`42P07/42710/42701`だけ「既存」として続行する。
3. **RLSでanon書き込みは弾かれる**（migration 12以降）。サーバー書き込みは必ず`supabaseAdmin`（サービスロール）経由。
4. **KTMランクの閾値が2箇所にある**: `04_PORTAL/src/lib/mmr.ts`（TS）と`03_SYSTEMS/ktm_bot/src/utils/ktmRank.js`（JS）。片方だけ変えると募集通知とサイトが食い違う。
5. **YouTube解析の失敗＝まずSupabaseキーを疑う**: 実行ログで判明した停滞原因は、YouTubeのIP制限ではなく **Supabase 401 Unauthorized**（最初のDB取得でこけ、yt-dlpに到達すらしていなかった）。GitHubシークレット名の不一致が濃厚（Vercelは`SUPABASE_SERVICE_ROLE_KEY`、ワークフローは`SUPABASE_SERVICE_KEY`/`SUPABASE_KEY`を参照していた）。対策として、スクリプトのキー解決を3候補（`SUPABASE_SERVICE_ROLE_KEY`→`SUPABASE_SERVICE_KEY`→`SUPABASE_KEY`）に広げ、401時に原因を明示して終了するようにした。**それでも401なら、GitHubのSecretに正しいサービスロールキーが登録されているかを最初に確認すること。** IP制限の診断ログ（`Sign in to confirm`/429検知）も残してあるが、順序としてはキー→IPの順で疑う。
6. **管理者API呼び出しは`credentials: 'include'`必須**（Cookie認証）。過去に30箇所超の抜けで401が多発した。
7. **admin配下のfetchはJP_GUARD/リトライのため`callGeminiWithRetry`経由に**。直叩きすると英語で返る・429で即死する。

---

## 4. 未解決・保留事項

- **① YouTube解析が進まない**: 診断ログと通知は実装済み。**実行ログの確認待ち**（IP制限か字幕なしかの切り分け）。
- **`highest_rank`のリストア**: 一部がUNRANKEDに飛んでいる。ユーザーが手動で復元→Rebuildする必要あり（AI作業外）。
- **Supabase Egress確認**: 未実施（usageページが404だった）。
- **note収益化系・X分析系のPythonスクリプト7本**: 未使用だが「将来復活」方針で残置。冒頭に「【現在未使用】」の注記あり。`prospector.py`のみクラウドで復活済み。
- **`test_*.py`**: `03_SYSTEMS/v2_CORE/manual_tests/`へ隔離済み（本番接続する結合テストのため）。

---

## 5. 参照すべきドキュメント

- `CLEANUP_AUDIT.md` — 不要コード・重複の調査と対応の全記録
- `04_PORTAL/supabase/migrations/README.md` — マイグレーションの取り扱い注意
- `SYSTEM_DESIGN_BY_FUNCTION.md` — 機能別の設計（一部古い可能性あり）
- `03_SYSTEMS/v2_CORE/manual_tests/README.md` — 手動テストの前提

---

## 6. 作業スタイルの申し送り

- 変更後は必ず `tsc --noEmit` を通し、純関数には `node --test` のユニットテストを添える
- 破壊的操作（MMR一括更新、記事削除、マイグレーション）は特に慎重に。過去に「保存失敗を握りつぶして元データだけ消す」系の事故が複数あった
- 推測で断定せず、実データ・実ログで裏を取る（このセッションでは診断ボタンやdebugモードを一時的に足して確認し、確定後に削除する運用をした）
- コミットは論理単位で分け、なぜその変更が必要かをコミット本文に書く
