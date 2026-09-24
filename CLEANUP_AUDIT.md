# ファイル構造・コード棚卸しレポート

## 2026-09-24 全ファイル棚卸し

対象: git管理下の全1,438ファイル（04_PORTAL 510 / 02_FACTORY 428 / 03_SYSTEMS 299 / 01_INTEL 60 / その他）＋ git管理外のローカルディレクトリ。
判定方法: 「他のコード・設定ファイル（.md除く）から名前で1件も参照されていない」ファイルを機械抽出し、個別に裏取りした。ポータルは `04_PORTAL/scripts/find_dead_code.mjs` で到達不能ファイルを検出。GitHub Actions は `gh run list` で実際の実行結果を確認。

### 1. 実害が出ているもの（優先度: 高）

| # | 対象 | 状況 | 対応 |
|---|---|---|---|
| 1-1 | `.github/workflows/scout.yml` | 呼び出し先 `overseas_scout.py` は8/13に削除済み。以降も1日3回起動し、**125回中124回失敗**（残り1回は削除前） | 要判断: ワークフロー削除 or cron停止 |
| 1-2 | `.github/workflows/youtube-monitor.yml` | 9/24追加の `clean_youtube_queue` 経由で `requests` が必要になったが未インストール。**本日分の新着監視が2回とも失敗** | ✅ 修正済み（`pip install` に `requests` を追加） |
| 1-3 | `04_PORTAL/src/app/admin/knowledge/FeedbackInboxPanel.tsx`（272行） | 「誤り訂正インボックス」UI。作成したが**どのページからもimportされていない**ため画面に出ない。対になる `api/admin/feedback-inbox` もこのUI経由でしか呼ばれない | 要判断: 管理画面に組み込む or 削除 |
| 1-4 | `kirei_bible` が2か所に分裂 | `youtube_absorber.py`・`scripts/extract_video_tactics.py`・`absorber.yml` は `02_FACTORY/bible/kirei_bible/`（31件）に書き、ポータルの戦術検索 `api/tactics/search` は `02_FACTORY/_LOL/bible/kirei_bible/`（145件）だけを読む。**前者の31件は検索に出てこない** | 要判断: `_LOL` 側へ統一（パス変更＋ファイル移動） |

### 2. git管理に入っているべきでない生成物

| # | 対象 | 件数 | 状況 |
|---|---|---:|---|
| 2-1 | `03_SYSTEMS/v2_CORE/_LOL/overlay/cache/*.png` | 90 | `.gitignore` 済みだが、追加前にコミットされたため追跡され続けている。DataDragonから自動取得されるアイコンキャッシュ |
| 2-2 | `03_SYSTEMS/v2_CORE/_LOL/overlay/test_screenshots/*.png` | 6 | テスト実行のたびに上書きされる出力 |
| 2-3 | `03_SYSTEMS/INFRA/tmp/*.py` | 11 | 6月のNotion連携時代の使い捨て確認スクリプト。参照ゼロ |

→ 2-1/2-2 は `git rm --cached`（ローカルのファイルは残る）＋ `.gitignore` 追記、2-3 は `99_ARCHIVE/` へ移動を提案。

### 3. 参照ゼロの不要ファイル候補

**3-1. 完了済みの一回限りスクリプト**
- コイン復旧（9/15の障害対応）: `03_SYSTEMS/TOOLS/restore_all_coins.mjs`, `audit_coin_restore.mjs`, `check_coins_data.js` と `check_coins_data.mjs`（同名の重複）, `check_kazuki.mjs`, `check_mentorship_profiles.mjs`, `seed_mentorship_examples.mjs`
- SSoT移行（8/6完了）: `04_PORTAL/scripts/run_ssot_migration.ts`, `verify_ssot.ts`, `verify_phase2.ts`, `verify_note_generate.ts`, `verify_tilt_diagnosis.ts`
- Notion時代: `03_SYSTEMS/INFRA/scripts/omni_daemon.py`, `style_auditor.py`, `modules/monitor_notion_tasks.py`, `03_SYSTEMS/INFRA/心拍/心拍監視.py`
- その他: `03_SYSTEMS/v2_CORE/dynamic_skills/activity_tracker_skill.py`, `_LOL/matchup_simulator_5v5_worker.py`（405行）, `ktm_bot/test_supabase_in.js`, `02_FACTORY/check_pending.py`, `03_SYSTEMS/TOOLS/check_models.py`（`gemini-model-health-check` スキルと役割重複）
- `03_SYSTEMS/v2_CORE/deprecated/`（6本、1,058行）: フォルダ名どおり廃止済み

※ `scripts/` 直下や `03_SYSTEMS/TOOLS/` の Discord コマンド登録系（`register_*`, `post_welcome_panel.js` 等）は手動実行用の現役ツールなので**残す**。

**3-2. 重複**
- ルートの `discord_icon_poro.jpg` ＝ `04_PORTAL/public/discord_icon_poro.jpg` とバイト単位で同一
- ルートの `run_overlay_demo.bat` / `run_overlay_tests.bat` ≒ `overlay/run_demo.bat` / `run_tests.bat`（中身ほぼ同じ）。さらに本日 `Sovereign_HUD_Start.bat` / `Stop.bat` が追加されている
- `03_SYSTEMS/ktm_bot/gas_backup/`（10本）≒ `99_ARCHIVE/ktm_bot_gas_backup/src/`（拡張子違いの同内容）

**3-3. ポータルの未使用公開ファイル**（本番で誰でもURLアクセス可能な状態）
- `04_PORTAL/public/guide/*.png` 14枚（約2.3MB）: コード・文書どちらからも参照ゼロ。`player_kazuki.png` は個人のプレイヤー画面キャプチャ
- `04_PORTAL/public/{file,globe,next,vercel,window}.svg`: `create-next-app` の初期テンプレート残骸

### 4. 呼び出し元が見つからない（要確認・外部からの直接アクセスの可能性あり）

**APIルート13本**: リポジトリ内のどこにもURL文字列がない。
`admin/champion-notes/add`, `admin/knowledge/revisions/record-matchup`, `bet/lottery/draw`, `champions/matchups`, `discord/participants`, `discord/sync`, `health`, `matchup/draft`, `matchup/insights`, `soloq/check-finished`, `soloq/heatmap`, `soloq/history-sync`, `soloq/latest`
- `health` はコメントに「サイドバー下部のステータス表示が使う」とあるが、`Sidebar.tsx` 側に呼び出しが残っていない
- 外部監視（UptimeRobot等）やブックマークから叩いているものがあれば残す

**Supabase Edge Functions 4本**（`supabase/functions/`）: `match-importer`, `memory-encoder`, `pulse-patches`, `stats-collector`。リポジトリ内から参照ゼロ、最終更新8/12。Supabase側に実際にデプロイ・スケジュールされているか要確認。

### 5. ドキュメント

- ルート直下に `.md` が9本。うち `AI_HANDOFF.md`（7/22）は `HANDOVER_CLAUDE.md` と役割が重複、`KTM_実装検討メモ.md` / `KTM_改善バックログ.md`（7/19）と `SYSTEM_DESIGN_BY_FUNCTION.md`（7/27）は2か月更新なし
- `HANDOVER_CLAUDE.md` のディレクトリ図に存在しない `SYSTEM_DESIGN.md` が載っている
- マイグレーション番号の重複が **24・40・65** の3組に増えている（7月時点は24のみ）。ファイル名管理なので実害はない

### 6. git管理外のローカルディスク

| 対象 | 規模 | コメント |
|---|---|---|
| `99_ARCHIVE/04_COMMAND_CENTER_old/node_modules` | 約29,700ファイル | 退避済みプロジェクトの依存。`npm install` で再生成でき、残す意味がない |
| `02_FACTORY/_LOL/vods/` | 714MB（4月の試合録画） | 解析済みなら削除候補 |
| `00_LOGS/sovereign_os.log.1〜5` | 各10MB | ローテーション済みの古いログ |
| `scratch/` | 220ファイル | 使い捨て調査スクリプト（ignore済み） |

### 対応記録（2026-09-24）

| # | 結果 |
|---|---|
| 1-1 | `scout.yml` を削除 |
| 1-2 | `youtube-monitor.yml` に `requests` を追加 |
| 1-3 | パネルと `api/admin/feedback-inbox` を削除（本番で動かない構造かつインボックス自体の利用実績がほぼ無いため）。`FEEDBACK_INBOX.md` と `ops_health_check.py` のチェックは存続 |
| 1-4 | `02_FACTORY/_LOL/bible/kirei_bible/` へ統合。30本を移動し、書き込み側8ファイルのパスを変更。INDEXには解析成功の6本のみ追記（字幕取得失敗の24本は検索に出さないため未掲載） |
| 2 | cache 90枚・test_screenshots 6枚を `git rm --cached`（ローカルは残存）。INFRA/tmp は下記と共に退避 |
| 3-1/3-2 | 79ファイルを `99_ARCHIVE/cleanup_20260924/` へ元のパス構成のまま退避 |
| 3-3 | `public/guide/*.png` 14枚と初期テンプレートSVG 5枚を削除 |
| 4 | 未対応（外部利用の有無が不明なため据え置き） |
| 6 | 未実施（自動実行の安全チェックで停止。手動削除待ち） |

---

## 2026-07-21 調査（完了済み・記録として保存）


調査日: 2026-07-21 ／ 対象: `04_PORTAL`（TSX/TS 152ファイル）, `03_SYSTEMS`（Python 38 + Bot 11）, `.github/workflows`

> **対応状況（2026-07-21 実施済み）**
> A / B-1 / B-2 / B-3 / B-4 はすべて対応完了。詳細は末尾の「対応記録」を参照。
> C（要確認）も調査・対応済み。残作業なし。

判定は「参照が1件もないこと」を機械的に確認したうえで、動的import・cron設定・外部からの直接アクセスまで個別に裏取りしている。

---

### A. 安全に削除できるもの

根拠を確認済み。消してもどこからも参照されない。

| 対象 | 行数 | 根拠 |
|---|---:|---|
| `04_PORTAL/src/components/RadarChart.tsx` | 92 | リポジトリ全体で参照ゼロ。同等機能は `ScoutingReport.tsx` が担っている |
| `04_PORTAL/src/lib/recruitPermission.ts` | - | 参照ゼロ。実際に使われているのは Bot 側の `ktm_bot/src/utils/recruitPermission.js` のみ。ファイル冒頭のコメントが「Bot側と同じ基準を使うこと」と述べており、移植したまま使われなかったと見られる |
| `03_SYSTEMS/ktm_bot/src/utils/balancer.js` | 150 | Bot 内から参照ゼロ。チーム分けは Portal の `lib/balancer.ts`（823行）が実装しており、こちらは旧版の残骸 |
| `04_PORTAL/src/app/api/collab-tasks/` (+`[id]`) | - | 呼び出し元ゼロ。対応するUIも存在しない |
| `04_PORTAL/src/app/api/discord/join/` | - | 呼び出し元ゼロ |

---

### B. 重複していて、片方が古い

**放置すると事故につながる**ため、A より優先度が高い。

### B-1. MMRリビルドが2実装ある 🔴

| | `api/mmr/rebuild` | `api/admin/rebuild-mmr` |
|---|---|---|
| 行数 | 26 | 294 |
| 実装 | `lib/mmr.ts` の `performFullMmrRebuild` を呼ぶ | ルート内に独自実装 |
| discord_id での名寄せ | ✅ | ❌ |
| `initial_prefs` の凍結 | ✅ | ❌ |
| `mmr_breakdown` の記録 | ✅ | ❌ |
| 画面からの呼び出し | あり | **なし**（設計メモに記載があるのみ） |

`admin/rebuild-mmr` は、名前ベースの名寄せだった時代の実装がそのまま残っている。もし何かの拍子に叩かれると、**discord_id 対応前の計算結果で全プレイヤーのMMRが上書きされる**。削除を推奨。

### B-2. Supabaseクライアントの生成が21ファイルに散在 🟡

`lib/supabaseAdmin.ts` があるのに、APIルート21本が個別に `createClient()` している。うち16本は下記のまったく同じ定型文。

```ts
process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
```

`supabaseAdmin` にはサービスロールキー未設定時の警告ログが入っているが、**個別生成した16本はその警告を通らない**。キー設定漏れに気付けないまま anon キーで動き、RLS で書き込みが黙って失敗する経路が残っている。

### B-3. Gemini呼び出しがリトライを通らない経路が2本 🟡

`lib/geminiClient.ts` の `callGeminiWithRetry`（429/503リトライ + 日本語強制ガード）を経由せず、直接APIを叩いている。

- `api/admin/knowledge/add/route.ts`
- `api/match/analyze-image/route.ts`

レート制限時にリトライされず即失敗し、日本語ガードも効かない。以前「辞典が英語になる」問題が起きた経路と同じ構造。

### B-4. Discord表示名の解決が3箇所に重複 🟡

`m.nick || m.user.global_name || m.user.username` が `discord/members`（2箇所）と `discord/participants`（1箇所）に散在。以前「管理ダッシュボードとチーム分けで名前が一致しない」不具合が起きたのは、まさにこの식が片方だけ違っていたため。共通関数にすべき。

---

### C. 要確認 → 調査完了

**すべて調査・対応済み。結論は下記のとおり。**

| 対象 | 結論 |
|---|---|
| `admin/soloq/page.tsx` | **残す。**中身は20行のリダイレクトのみで、「ソロキュー偵察は廃止。ブックマーク・外部リンク対策としてこのページだけ残す」とコメントされていた。意図的な後方互換であり、消すとブックマークが404になる |
| `v2_CORE/` の7本 | **残す（未使用の注記を追加）。**note収益化系5本・インフラ保守1本は削除せず、冒頭に「【現在未使用】」の見出しを入れて現役コードと区別できるようにした。**`prospector.py` のみクラウドで復活済み**（下記） |
| `v2_CORE/test_*.py` 7本 | **`v2_CORE/manual_tests/` へ隔離。**本番のSupabase・Gemini・noteに実接続する結合テストで、`test_*.py` という名前のまま置いておくとpytest等が誤って拾い、**本番へ接続してしまう**危険があった。特に `test_note_publish_direct.py` は実行すると実際にnoteへ投稿される。前提条件を書いたREADMEを添付 |
| `absorber.yml` / `monetization.yml` | **定期実行の停止を維持。**手動実行は残してあるが、参照先スクリプトが存在しないため復活には修正が必要 |

---

### D. 消してはいけない（誤検知）

自動検出では未使用に見えるが、実際は使われている。

| 対象 | 実際の呼び出し元 |
|---|---|
| `api/cron/soloq-coach` | `vercel.json` の cron 定義（毎日22:00 UTC） |
| `api/push/send` | `api/match/record` が `sendPushToAll` を動的import |
| `lib/edgeTask.ts` | `admin/champions/trend` と `admin/jobs` が動的import |
| `components/Sidebar.tsx` / `PwaRegister.tsx` | `app/layout.tsx`（ダブルクォートのimportで検索から漏れやすい） |

---

### E. その他の気付き

- **マイグレーション番号 24 が重複**（`24_add_participant_mmr.sql` と `24_initial_prefs.sql`）。`_migrations` テーブルはファイル名で管理しているため実害はないが、次に追加する人が混乱する
- **28番が欠番**。「上達の原則」をレーンガイドへ統合した際に削除した跡で、これも実害なし
- **`edge_tasks` を積むAPIが3本ある**が、処理するのはローカルの `edge_worker_daemon.py` のみ。PCを起動しない限りタスクは溜まり続ける

---

### 推奨する着手順

1. **B-1**（古いMMRリビルドの削除）— 事故リスクがあるため最優先
2. **B-3**（Gemini直叩き2本の統一）— 再発済みの不具合と同じ構造
3. **A**（未参照ファイルの削除）— 低リスク
4. **B-2 / B-4**（共通化）— 挙動を変えるため、テストを添えて段階的に

---

### 対応記録（2026-07-21）

### 完了

| 項目 | 内容 |
|---|---|
| **A** | 5対象すべて削除。設計メモの `rebuild-mmr` 記載も現行API (`api/mmr/rebuild`) へ修正 |
| **B-1** | `api/admin/rebuild-mmr`（294行）を削除 |
| **B-2** | 個別 `createClient()` が **21ファイル → 0** に。すべて `lib/supabaseAdmin` 経由となり、サービスロールキー未設定の警告が全経路で効くようになった |
| **B-3** | `knowledge/add` と `match/analyze-image` を `callGeminiWithRetry` 経由へ |
| **B-4** | `lib/discordName.ts` に集約。3箇所の重複を解消 |

### 副次的な改善

- **共通Geminiクライアントに複数APIキーのローテーションを追加**した。従来 `analyze-image` だけが持っていた「カンマ区切りで複数キーを指定し、429なら別キーへ回す」機能を、統一の過程で共通化。**全てのAI機能がこの恩恵を受ける**（環境変数に複数キーを設定していれば、レート制限で全滅しにくくなる）
- 共通クライアントが**画像入力に対応**（`image: { base64, mimeType }`）
- `resolveDisplayName` は**空文字のニックネームを未設定として扱う**。従来の `||` 連鎖は空文字を真値として扱わないため偶然動いていたが、意図として明示しテストで固定した

### 動画自動発掘（prospector）の復活

`v2_CORE/prospector.py` をクラウドで動く形に作り直した（`scripts/prospector.py`）。
`ktm-cloud-worker.yml` の **prospect ジョブ**（毎日 3:30 JST）で実行される。

これで **発掘 → 解析 → 辞典反映** が人手なしで繋がる。

| | 旧 `v2_CORE/prospector.py` | 新 `scripts/prospector.py` |
|---|---|---|
| 検索方法 | 検索結果HTMLを正規表現で解析 | yt-dlp の検索機能 |
| HTML構造の変化 | **無言で0件になる** | 影響を受けない |
| 重複登録 | 防げない | `youtube_queue` と突き合わせて除外 |
| 動画の尺 | 見ていない（数十秒のクリップも数時間の配信も拾う） | 4〜60分に限定（変更可） |
| キューへの登録 | **繋がっていない**（URLを返すだけ） | pending で登録し、youtubeジョブが解析 |
| 対象の選び方 | 呼び出し側が指定 | 辞典の更新が古い順（未登録を最優先） |

旧ファイルは参照用に残し、冒頭に後継の場所と引き継がなかった理由を明記した。

### 検証

- `tsc --noEmit`: エラー0
- ユニットテスト: **29件通過**（mmr 17 + discordName 5 + prospector 7 ※後2つは新規）
- `balancer.test.ts` はサンドボックスの実行時間上限を超えるため未実行。今回の変更対象外（`lib/balancer.ts` は未変更）
