# 📌 Sovereign OS 業務ダッシュボード (TODO)

本ファイルは、日々の作業タスクを管理するためのダッシュボードです。
会話開始時に AI が自動的にこのファイルを読み込み、文脈を復元して本日のタスクに直ちに追従します。

> 📦 **完了済みの記録・調査経緯は [`TODO_ARCHIVE.md`](file:///d:/my_work/02_FACTORY/TODO_ARCHIVE.md) に全文退避済み**（2026-09-21・2026-10-04実施）。
> 本ファイルには**未完了の項目だけ**を置く。完了したら `[x]` にしてその日のうちにアーカイブへ移すこと（2026-10-04には2,911行まで膨らみ、自動読込の上限を超えた）。
> 各項目の詳しい経緯は、アーカイブ内を見出しのキーワードで検索すれば見つかる。

---

## 🚀 進行中: The Sovereign Victory Loop

> 「プレイ前 ➔ プレイ中 ➔ プレイ後 ➔ ナレッジ蓄積」の循環を維持する。不確定情報（AI推測）は使わず、Riot公式 / DataDragon / 実戦データのみを使う。

- [ ] **【候補3】note記事・戦術発信パイプライン（Sovereign ADO Engine）の再起動**（保留中: ストック224本あり、執筆タイミング待ち）

---

## 🚚 進行中: 個人用機能の 04 → 05 移植（2026-10-04 ユーザーと仕分け決定）

方針: 内戦・カジノ・師弟など会員向けは04に残し、個人用は05へ。画面約5,000行＋API約15本のため複数セッションで進める。

**05へ移す**（上から順に着手を推奨。小さく独立したものから）
- [ ] **コーチ「試合後」**: `PostGameDeepAnalyticsDashboard`(857) `MatchFightsAnalyticsCard`(294) `CoachReviewPanel`(202) `MySoloQDashboard`(384)。試合メモ含む。API: `lol/postgame-deep-analytics` `lol/match-memo` `lol/sync-match-feedback` `lol/match-fights` `coach/analyze` 等。
  05は `tab=postgame` を暫定でテンポ解析タブへ寄せている（`e39376a4`）ので、移植後はこちらへ向け直す
- [ ] **コーチ「試合中」**: `ScoutTab`(715) `FiveVFiveSimTab`(589)。API: `admin/live-match` `match/simulate` `match/simulation` `riot/live-game`。
  `riot/live-game` のオーナー決め打ち（`KAZURIN_PUUID`/`name='かずき'`）は移植時に解消する

**04に残す**: プレイヤー外部分析 `/analyzer`、仕様ガイド `/admin/guide`（ユーザー判断）
✅ 戦術取り込みハブ（2026-10-04 判断）: Discord取り込み→05知見取込のメモ欄、保留中の知見→05 `/admin/review` で代替できるため移さず。代替の無い動画深掘り依頼だけ05 `/admin/youtube` へ移植。
✅ `04 /admin/soloq` 削除、`04 /admin/dict-health` は05への転送ページに置換（2026-10-04）
- [ ] **コーチ「試合前」の残り部品**（2026-10-04 移す決定）: `PlayRecommendationCard`(153) `TimingHeatmapCard`(311) `RankGoalCard`(220) `OverlayLauncherButton`(150)。API: `coach/play-recommendation` `soloq/heatmap` `coach/target-tier` `overlay`

✅ 運用ダッシュボードは移植済み（05 `/admin/dashboard`、2026-10-04）。旧版の常時「稼働中」カード・固定値ヘルスは移さず実測値のみ。04側の削除は他の移植と合わせて判断

**04の役目終了前に05へ移す裏方**（今は04上で動いており05はデータを読むだけ）:
`soloq-coach-poll.yml`→04 `/api/cron/soloq-coach`、`soloq-history-sync.yml`→04、04のVercel Cron `soloq-trends` `freshness-check` `dict-review-check`、ワーカー通知の送り先 04 `/api/push/notify-admin`（`edge-cloud-worker.yml` `absorber.yml` の `PORTAL_URL`）

---

## ⏳ 次のイベント待ちの確認（コードでは判断できないもの）

- [ ] **【次の内戦の後に実施】`pending_match_sync` が書き込まれるか確認**（2026-10-04 実測: 0行のまま。ユーザーが「pending_match_sync 確認して」と声をかける約束）
  - 鍵は直っている（RLSポリシーが同じく無い `recruitments` には書けている）ので、構造上は書けるはず。
  - 9/26の4試合はいずれも `riot_match_id` 空・`game_duration=0` で、match-sync が一度も走っていない。KDAが入っていたので Bot の終了ボタン以外の経路で記録されたとみられる。
  - **次に Bot の終了ボタンで試合を記録したら** `SELECT * FROM pending_match_sync ORDER BY id DESC LIMIT 3;` を確認。0行なら管理者チャンネルに `pending_match_sync の予約に失敗` の通知が出ているはず。
- [ ] **Cloudflare本命cronが空振りした理由**（2026-09-23 発見）: 水曜12:00 JST前後をエラー集約チャンネル(1550118540038774865)か `wrangler tail` で観測する。バックアップ経路が投稿した場合は管理者チャンネルに通知が飛ぶようにしてある。
- [ ] **`__INTEGRATED__` の効果確認**（2026-10-04 修正 `e46914e9`）: 次の `dict-sync`（毎時7分・3時間おき）の後、
  `champion_notes` の `created_at` が実行のたびに187件まとめて作り直されていないこと、`personal_knowledge` の統合済み記事に `__INTEGRATED__` が付いたことを確認。
- [ ] **PCデーモンのタイムアウト延長の効果**（2026-10-04 に 900s→2400s）: 延長後の失敗は0件・完了35件（同日実測）。数日分たまったら `edge_tasks` の `youtube_queue_process` の failed 件数を再確認して閉じる。

---

## 🙋 ユーザー判断・ユーザー作業待ち


- [ ] **手動の振り返りフォーム（`SoloQReflectionModal.tsx`・997行）を畳むか**: 手動記録は直近30日0件、自動振り返りは14件。自動側を使ってから判断する。
- [ ] **実画面での目視確認**: 色統一後のライト表示、「🤖 自動振り返りの履歴」の読みやすさ、「🚦 次の試合に行くべきか」の判定しきい値、ライブ検知バッジが実際の検知時だけ出るか。
- [ ] **予測的中率アラートの指標が妥当か**: バランサーは50/50を狙うので的中率は50%付近が自然。キャリブレーション（Brierスコア等）か「0.5から十分離れた予測だけの的中率」に変えるか。
- [ ] **Preview環境で管理用Supabaseクライアントがanonキーに落ちる**: ①Vercelに `SUPABASE_SERVICE_ROLE_KEY` を preview 含めて登録 ②`SUPABASE_KEY` の target に preview 追加 ③現状維持を明文化、のどれにするか。
- [ ] **`scripts/ops_health_check.py` に実行者がいない**（パッチ番犬 `patch-watchdog.yml` は1日2回稼働中。点検側だけ未自動化）。自動化すると Discord 通知が定期的に飛ぶので可否を決める。
- [ ] **コイン供給全体の見直し**（低優先）: おみくじ期待値1人1日165コイン、試合精算1回約2,550コイン、`findOrCreatePlayer` の新規作成で1000コイン。総供給は約15,000枚。
- [ ] **ダークモードを撤去するか完遂するか**: 既定は `light` に変更済み。テーマ選択が localStorage のみで「ダークを選ぶ人がいるか」が観測できない。撤去なら `dark:` 725箇所＋519行、完遂なら残3,130箇所。急ぎではない。

---

## 🧹 データ掃除（次の作業候補）

- [ ] **辞典の【記事】節の重複統合を掃除**（2026-10-04 発見）: 同じ動画の記事がタイトル表記違い（英語名→日本語名の翻訳前後。例「アンベッサ Advanced…」と「AMBESSA Advanced…」）で2回統合され、20体分・余分316行が `matchup_sentinel` に残っている。統合処理がタイトルで重複判定しているのが原因なので、記事ID（または動画ID）で判定する形に直してから掃除する。字幕取得失敗の「[エラー: …]」記事も統合されている
- [ ] **承認待ちの Wild Rift 記事（id 37501）を05承認画面で却下**（統合済み2件はSQLで除去済み・`knowledge_revisions` に履歴あり）
- [ ] **長尺動画が入力トークン上限超えで解析失敗**（2026-10-04、KHA SHYVANA TO RANK 1）: 字幕を分割・要約してから渡す等の対策が必要

## 🛠️ 新規機能（未着手）

- [ ] **カジノ新ゲーム「チャンピオン・ハイロー」**（2026-09-23 起票）: DDragon基礎ステータスで「次のチャンピオンは上か下か」を連続で当てる。ブッシュ・スカウトの `mines_sessions` 方式・2回記録・`STATE` 復帰をそのまま流用できる。設計メモはアーカイブ参照。
- [ ] **05未移植の旧YouTube機能**: 確認用プレイリストへの送信（OAuth要）、動画深掘りリクエスト、記事へのリンク表示、承認時の辞典反映プレビュー（Gemini）。必要になったら移す。

---

## 🚧 技術的負債バックログ

- [ ] **Python側の沈黙失敗の洗い出し**: `print`/`log` のみで通知なしが153件、`except: pass` が65件。全部が悪いわけではないので「バッチが丸ごと失敗しても誰も気づかない経路」「失敗するとデータが残らない経路」に絞る。
- [ ] **Python の未監査分**（`03_SYSTEMS/v2_CORE` 19,141行の大部分）。
- [ ] **`recruitmentStatus.js` の `RANK_LINE_PATTERN` と配列が同じランク語彙をハードコード**: 対応表のティア名を変えると正規表現がマッチしなくなる。
- [ ] **`cloud_youtube_monitor.py` の `last_fetched_at` に読み手がいない**: 管理画面に出すか列を整理するか。
- [ ] **ダークモードのトークン移行の残り**（完遂する場合のみ）: Phase 6 任意値HEX（`bg-[#...]` 165箇所）、`html.dark` 332行の内訳精査、Phase完了ごとの中和ルール削除。
- [ ] **`__DELETED__` の旧データ173件は「削除」か「レーンガイド統合」か区別できない**（2026-10-04 調査）: 旧実装がタグを `['__DELETED__']` で丸ごと置き換えていたため。470件は `champion_notes` があり統合済みと判別できる。旧ポータル退役と合わせて扱いを決める（05のライブラリは現状これらも表示している）。
- [ ] **JGレーンガイドの膨張を見守る**（2026-10-04 ユーザー判断で追記継続）: `bible_dispatcher.py` 修正で動画1本ごとに約1,400字が「第8章」へ追記されるようになった（修正前は本番の見出し形式を読めず空だった）。待ち47本で約7,700字→約7万字の見込み。読みにくくなったら要約・間引きを検討。

### 意図的に放置しているもの（再調査不要）
- `wrangler` 由来の moderate 3件（`undici`）: npm の提案は破壊的ダウングレード。本番Workerには含まれない。上流が `undici` を上げたら `npm update wrangler` で解消。`npm audit fix --force` は実行しないこと。
- Cloudflare無料プランのcron上限（5本）に到達済み: 新しい定期処理が必要になったら有料プラン移行か既存cronへの相乗りを判断する。
- `/api/riot/live-game` 等のオーナー決め打ち（`KAZURIN_PUUID` / `name='かずき'`）: 旧ポータル(04)にのみ残存。05には無いため、旧ポータルの役目終了と一緒に消える。
- DDragonバージョンの決め打ち: `ddragon_resolver.py` に集約済み。残るのは取得失敗時の予備値だけ。

---

## 📊 運用目標 ＆ 前提ルール

- 「正常稼働」と報告する時は、直近の成功ログ1件ではなく `edge_tasks` 等の failed件数・未処理件数・最新エラーを実測して示す（`.claude/rules/llm-health.md`）。
- 完了した項目はその日のうちに `TODO_ARCHIVE.md` へ移し、本ファイルは未完了のみに保つ。
