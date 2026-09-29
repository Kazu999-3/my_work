# 🗺️ Sovereign OS バックグラウンド自動化マップ (AUTOMATION_MAP)

本ファイルは、Sovereign OS でバックグラウンド稼働している全スクリプト・デーモン・Cron ジョブの「実行契機・対象・環境変数・停止手順」を一覧化した可視化マップです。
「知らないところで勝手に動画がキューに積まれる」「止まっているのに気づかない」というブラックボックス化を恒久的に防ぎます。

> **2026-09-30 全面改訂**: 旧版は7ジョブしか載っておらず、実態と合っていませんでした。
> 具体的には ①存在しないワークフロー名を2件記載（`prospector.yml` / `youtube-worker.yml`）、
> ②YouTube巡回の頻度が「毎時」と書かれていたが実際は1日3回、
> ③`check_patch_update.py` を「GitHub Actions 1日2回」と書いていたが**どのワークフローにも登録されていない**、
> ④GitHub Actions 11本・Vercel Cron 7本・Cloudflare Cron 5本が未記載、という状態でした。
> 「止まっているのに気づかない」を防ぐための表自体が最大の盲点になっていたため、実ファイルから機械的に再作成しています。

**この表を再検証する手順**（乖離を疑ったら必ずこれで確認する）:
```bash
# GitHub Actions の実スケジュール
grep -A3 "schedule:" .github/workflows/*.yml | grep "cron:"
# Vercel Cron
cat 04_PORTAL/vercel.json
# Cloudflare Workers Cron
grep -A12 "\[triggers\]" 03_SYSTEMS/ktm_bot/wrangler.toml
```

---

## 📊 GitHub Actions（定期実行あり）

時刻はJST。cron式はUTCで書かれているため、下表のJSTと式の数字はズレます。

| ジョブ名 / ワークフロー | 頻度 (JST) | cron式 (UTC) | 主な役割 | 実行対象 |
|---|---|---|---|---|
| **Edge Cloud Worker**<br>(`edge-cloud-worker.yml`) | 5分おき | `*/5 * * * *` | ポータルのボタン操作で `edge_tasks` に積まれたタスク（個別トレンド取得・構成シミュ・YouTube登録・Redditスカウト・辞典シンセ等）をクラウド側で処理 | `scripts/edge_cloud_worker.py` |
| **SoloQ Coach Poll**<br>(`soloq-coach-poll.yml`) | 15分おき | `*/15 * * * *` | 試合終了を早めに検知して振り返りを生成。Vercel HobbyのCronが1日1回制限のため、高頻度呼び出しをこちらで代替 | `/api/cron/soloq-coach` を叩く |
| **Antigravity Sovereign Pulse**<br>(`pulse.yml`) | 6時間おき | `0 */6 * * *` | パッチ更新検知・LoLalytics統計取得・Discordメンバー同期 | `03_SYSTEMS/v2_CORE/run_pulse_once.py` |
| **KTM Cloud Worker / dict-sync**<br>(`ktm-cloud-worker.yml`) | 3時間おき | `7 */3 * * *` | ナレッジ → チャンピオン辞典（`matchup_sentinel`）の同期をチャンクで実行 | `/api/admin/knowledge/sync` |
| **KTM Cloud Worker / prospect**<br>(`ktm-cloud-worker.yml`) | 1日3回<br>03:30 / 11:30 / 19:30 | `30 18,2,10 * * *` | 辞典が古いチャンピオンの解説動画をYouTube全体から発掘し `youtube_queue` へ起票 | `scripts/prospector.py` |
| **YouTube Channel Monitor**<br>(`youtube-monitor.yml`) | 1日3回<br>08:00 / 14:00 / 20:00 | `0 23,5,11 * * *` | 登録チャンネルの新着をAtom RSSで巡回し `youtube_queue` へ起票 | `scripts/cloud_youtube_monitor.py` |
| **Sovereign Sentinel**<br>(`sentinel.yml`) | 毎日 12:00 | `0 3 * * *` | APIキー・Botトークン・秘密鍵のハードコード検知、基幹ディレクトリ構成チェック | `03_SYSTEMS/INFRA/sentinel.py` |
| **Sovereign DB Sync**<br>(`sync.yml`) | 毎日 13:00 | `0 4 * * *` | ローカル資産とSupabaseの同期 | `03_SYSTEMS/v2_CORE/sovereign_sync.py` |
| **Database Backup**<br>(`db-backup.yml`) | 毎日 03:00 | `0 18 * * *` | `pg_dump` による論理バックアップ（Supabase無料プランはPITRが使えないため） | Supabase → Artifact |
| **KTM Bot Cron Backup**<br>(`ktm-bot-cron-backup.yml`) | 毎週水 12:07 | `7 3 * * 3` | Cloudflare Cronの発火漏れ（best-effort）に対する保険。`/trigger-scheduled` を冗長キック | ktm-os-worker |
| **Champion Dictionary Bulk Update**<br>(`champ-dict-update.yml`) | 毎週月 03:00 | `0 18 * * 0` | チャンピオン辞典の一括更新 | `champ_db_bulk_updater.py` |
| **Champion Lane Role Update**<br>(`lane-role-update.yml`) | 毎週水 03:00 | `0 18 * * 2` | チャンピオンのレーン適性データ更新 | `lane_role_collector.py` |
| **Riot Jungle Timing Update**<br>(`riot-jungle-timing-update.yml`) | 毎週金 03:00 | `0 18 * * 4` | ジャングル周回タイミングの実測データ更新 | `junglepedia_clear_collector.py`<br>`riot_jungle_timing_collector.py` |

### 手動実行のみ（定期実行なし）

| ジョブ名 | 契機 | 備考 |
|---|---|---|
| **KTM Cloud Worker / youtube**<br>(`ktm-cloud-worker.yml`) | `workflow_dispatch` のみ | ⚠️ **2026-07-31に定期実行を停止**。GitHub Actionsの共有IPがYouTube側から低信用と判定され、動画によって字幕取得が失敗し続けるため。字幕なし動画はローカルの `edge_worker_daemon.py` 経由（下記）で処理する |
| **YouTube Absorber (Whisper Rescue)**<br>(`absorber.yml`) | `workflow_dispatch` のみ | `status=error_no_transcript` の動画を Groq Whisper API で救済 |
| **Supabase Migrations**<br>(`migrate.yml`) | `workflow_dispatch` のみ | マイグレーション適用 |
| **CI**<br>(`ci.yml`) | push / PR | 04_PORTAL / ktm_bot の型チェック・ビルド・テスト |
| **KTM Bot Deploy**<br>(`ktm-bot-deploy.yml`) | push (`03_SYSTEMS/ktm_bot/**`) | Cloudflare Workers へデプロイ |

---

## ☁️ Vercel Cron（`04_PORTAL/vercel.json`）

旧版では完全に未記載でした。Vercel Hobbyプランは「1ジョブ1日1回」制限があるため、高頻度が必要なものはGitHub Actions側に逃がしています（上記 SoloQ Coach Poll）。

| パス | 頻度 (JST) | cron式 (UTC) |
|---|---|---|
| `/api/cron` | 毎日 21:00 | `0 12 * * *` |
| `/api/cron/soloq-coach` | 毎日 07:00 | `0 22 * * *` |
| `/api/cron/sync-matches` | 毎日 09:00 | `0 0 * * *` |
| `/api/cron/freshness-check` | 毎日 00:00 | `0 15 * * *` |
| `/api/cron/soloq-trends` | 毎週日 07:00 | `0 22 * * 6` |
| `/api/cron/dict-review-check` | 毎週水 08:00 | `0 23 * * 2` |
| `/api/cron/lottery` | 毎週日 22:00 | `0 13 * * 0` |

---

## 🤖 Cloudflare Workers Cron（`03_SYSTEMS/ktm_bot/wrangler.toml`）

⚠️ **Cloudflare の曜日フィールドは「1=日曜〜7=土曜」** で、標準Unix cron（0=日曜）と1つズレます。
2026-09-21に「全5本が意図より1日早く発火、日曜20:00の開催判定は一度も発火していなかった」という障害が発生した箇所なので、編集時は必ず `wrangler.toml` 冒頭のコメントを読むこと。

| # | 頻度 (JST) | cron式 | 役割 |
|---|---|---|---|
| ① | 毎週水 12:00 | `0 3 * * 4` | 週末定期カスタム募集の開始（土曜カード・日曜カードの2枚を独立投稿） |
| ② | 毎週金 19:00 | `0 10 * * 6` | 中間アナウンス・リマインド通知 |
| ③ | 毎週土日 17:00 | `0 8 * * 7,1` | 中間アナウンス・リマインド通知 |
| ④ | 毎週土日 20:00 | `0 11 * * 7,1` | 開催判定（開催1時間前・不足時の代替募集） |
| ⑤ | 毎週月 09:00 | `0 0 * * 2` | 週間レポート配信 |

---

## 💻 ローカル常駐（PC起動時のみ稼働）

| プロセス | 頻度 | 役割 | 停止方法 |
|---|---|---|---|
| **試合終了監視デーモン**<br>(`auto_match_recorder.py`) | 10秒ポーリング | LoLクライアント起動中の試合終了を検知し、戦術バイブルへ試合結果を同期 | `Ctrl+C` / タスクマネージャー |
| **エッジワーカーデモン**<br>(`edge_worker_daemon.py`) | タスクポーリング<br>＋15分おきに起票 | `edge_tasks` のローカル実行タスクを処理。15分おきに `youtube_absorb` を自動起票し、`youtube_absorber.py` が Whisper(GPU) で字幕なし動画を文字起こし | `Ctrl+C` / タスクマネージャー |

---

## ❗ 登録されていないスクリプト（実行者がいない）

| スクリプト | 本来の役割 | 現状 |
|---|---|---|
| `scripts/check_patch_update.py` | DataDragon最新パッチの巡回検知、差分チャンピオン抽出、検証キュー更新、Discord速報 | ⚠️ **どのワークフロー・Cronにも登録されていない**。旧版のこのファイルには「GitHub Actions 1日2回」と書かれていたが事実ではなかった。<br>実害: `01_INTEL/_LOL/current_patch.json` の記録が **16.18.1（最終確認 2026-09-18）** のまま止まり、公式最新 16.19.1 との差分検知・キュー更新・Discord速報が自動では一度も走っていない。手動実行（`py scripts/check_patch_update.py`）で追いつく必要がある。 |
| `scripts/ops_health_check.py` | 上記の記録パッチと公式最新の乖離を含む、運用状態の点検 | ⚠️ 同様にどのワークフローにも登録されていない。パッチ番犬の停止を検知できるはずの点検自体も自動実行されていない。 |

---

## 🛠️ 各パイプラインの安全設計・制御フラグ

### 1. YouTube 解析パイプライン
- **登録チャンネル限定 vs 全体発掘の分離**:
  - `cloud_youtube_monitor.py`（登録チャンネル巡回）: 信頼できる解説者のみ。ShortsはTipsとして許可。
  - `prospector.py`（全体発掘）: 必須キーワード（解説・ガイド等）および尺8〜40分の多重フィルターでMontageやミームを完全遮断。
- **レート制限 (429) の安全弁**:
  - レート制限検知時は `retry_count` を消費せず `pending` のまま据え置き、その回の実行を即時打ち切る。
- **字幕が取れない動画の救済**（3段構え）:
  1. `youtube_worker.py` 内の Whisper 文字起こし（`ENABLE_WHISPER=1`、CPUのため1本数分）。
  2. Gemini の映像直接解析（`gemini_analyze_video`）。低解像度メディア指定でトークン消費を抑制。
  3. `status=error_no_transcript` まで落ちたものは `absorber.yml`（Groq Whisper API）またはローカルGPU Whisperで救済。
- **解析ジョブの定期実行は止まっている**: 上記のとおり `youtube` ジョブは手動実行のみ。キューが溜まっていても自動では減らない。

### 2. Discord Bot 募集パイプライン
- **土日カード完全分離**: 土曜カード・日曜カードが独立したメッセージおよびDBレコードとして管理される。
- **通知の自浄（自己削除）**: 新しいリマインド投稿時に古い「残り枠お知らせ」メッセージを自動DELETEし、チャンネルの散らかりを防止。
- **サイレント消灯**: 投稿から6時間以上経過した突発募集は、通知なしでタイトルを `[受付終了]` へ更新しボタンを完全撤去。
- **Cron発火漏れの保険**: `ktm-bot-cron-backup.yml` が `/trigger-scheduled` を冗長キック。BOT側に二重投稿防止（`recruitments.start_at` チェック・直近同一通知チェック）がある。

---

## 🔍 トラブルシューティング ＆ 緊急停止

1. **予期しない動画が大量にキューへ積まれた場合**:
   - `scripts/clean_youtube_queue.py --dry-run` で状況確認。
   - `python scripts/clean_youtube_queue.py --close-unwanted` で不要動画を一括クローズ。
2. **GitHub Actions の実行を止めたい場合**:
   - GitHub リポジトリ ➔ `Actions` タブ ➔ 対象のワークフロー ➔ `...` ➔ `Disable workflow`。
3. **Vercel Cron を止めたい場合**:
   - `04_PORTAL/vercel.json` の `crons` から該当エントリを削除してデプロイ。
4. **Cloudflare Cron を止めたい場合**:
   - `03_SYSTEMS/ktm_bot/wrangler.toml` の `crons` を編集して再デプロイ（曜日のズレに注意）。
5. **ローカル常駐プロセスの確認**:
   - PowerShell: `Get-Process python*` で起動中スクリプトを確認し、不要な場合は `Stop-Process`。
