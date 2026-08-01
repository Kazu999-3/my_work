# 📌 Sovereign OS 業務ダッシュボード (TODO)

本ファイルは、日々の作業タスクを管理するためのダッシュボードです。
会話開始時に Antigravity が自動的にこのファイルを読み込み、文脈を復元して本日のタスクに直ちに追従します。

---

## 📅 次回の注力タスク（2026-07-29 実行予定）
> 2026-07-28 のポータル不具合修正セッションでほぼ解消。残るのは外部ダッシュボード操作や意思決定が必要なものだけ。SNS素材フォルダの統合（231ファイル・5箇所）のみ、規模が大きいため引き続き対象外。

- [x] **Whisperのクラウド移行** → 2026-07-30確認: 既に完了済みだった（`youtube_absorber.py`のコメントに「ローカルGPU(faster-whisper/CUDA)は撤去し、Groq Whisper APIに一本化した」と明記。`03_SYSTEMS`全体でfaster-whisperの実利用箇所はゼロ。これも`champion_trend`と同じ、対応済みなのにTODOに残っていたstale項目）
- [x] **`champion_trend`タスクのクラウド移行検討** → 2026-07-29確認: 既に`edge-cloud-worker.yml`/`scripts/edge_cloud_worker.py`の`TASK_MAP`に`champion_trend`が組み込まれ、クラウド実行済みだった（この項目自体が古い記述のまま残っていたstaleなTODO）。ダッシュボードが実行元(ローカル/クラウド)を区別できていなかった点は今回の`pipeline-status` API改修で表示に対応済み。
- [x] **リポジトリ運用の意思決定** → `02_FACTORY/PRODUCTS/`を`.gitignore`対象に決定（`note_drafts`等と同じ扱い。公開リポジトリのため下書き/生成物は非公開のまま。既存84ファイルは`git rm --cached`で追跡解除、ローカルには残置）

## ✅ 2026-07-31 追加セッションで対応済み
- [x] AI生成全体のハルシネーション対策 → 個別プロンプトごとに書き分けると漏れが出るため、全AI生成が通る共通クライアント2箇所（`geminiClient.ts`のJP_GUARD隣、`ai_helper.py`の日付コンテキスト注入部分）に「与えられていない事実を創作しない」「情報不足なら断定しない」という条件を追加。既存の日本語強制と同じ仕組みで一括適用
- [x] ソロQ振り返りのDiscord DM通知を廃止（`soloq-coach/route.ts`）。ポータル通知(ベル+プッシュ)のみに一本化。DMは不要とのユーザー判断
- [x] チャンピオン辞典の一括日本語化(`translate-jp`)でJSON解析エラー → 原因はVercel関数のタイムアウト(60秒)。CHUNK=2件×最大8項目×4秒クールダウンで超過しうるため、タイムアウト時のプレーンテキスト応答を`res.json()`しようとして「Unexpected token 'A'...」で落ちていた。`maxDuration`を280秒に延長し、クライアント側も`res.ok`確認をJSONパースより先に行うよう修正
- [x] クラウドでのYouTube動画解析を停止 → `absorber.yml`/`ktm-cloud-worker.yml`(youtubeジョブ)の定期cronを削除し`workflow_dispatch`の手動実行のみに変更。cookie認証・yt-dlpクライアント周りを直してもGitHub ActionsのIP自体がYouTube側から低信用と判定され安定しないと判断（詳細は下記の技術的負債バックログ参照）
- [x] 辞典の鮮度レビューを週次で自動検知するように → 反映(keep/archive/regenerate)は辞典本体を直接書き換えるため引き続き手動承認制のままだが、「そもそも見に行かない」問題を解消するため`/api/cron/dict-review-check`(毎週水23:00 UTC)を新設。要対応(update/archive判定)が1件でもあればポータル通知で知らせる。ロジックは`/api/admin/dict-review`と共通化(`lib/dictReview.ts`)
- [x] ダッシュボードの3点改善 → ①YouTube動画解析を「クラウド完結機能」欄から「PC起動が今も意味を持つ場面」欄へ移動（クラウド定期実行停止に合わせて実態と一致させる）、②「要対応」パネルに辞典鮮度レビューの検知結果も集約表示、③エッジワーカーの機能比較表を折りたたみ表示にしてバナーの既定の高さを縮小
- [x] **新規発覚・修正**: `/api/cron`(日次)が「ナレッジ自動整備」「レーンガイド自動マージ」を自動発火している“はず”だったが、呼び出し時にAuthorizationヘッダーを一切付けておらず、呼び出し先の認証チェックで毎回401で握りつぶされ10日以上何も実行されていなかった（`lane_guides`の更新日時が単一セッション内の数分間に固まっていたことから発覚）。`lane-guides`・`translate-jp`の両ルートにCRON_SECRET Bearer認証を追加し、`/api/cron`側も正しくヘッダーを付けて呼ぶよう修正。あわせて`translate-jp`(辞典・ライブラリ・対面メモの英語→日本語一括変換)も同じ日次cronに組み込み、これまで手動ボタン頼みだった一括処理3つ（日本語化・辞典同期・レーンガイド統合）が実際に毎日自動実行されるようになった
- [x] note記事の「公開管理」機能を新設(課題#54・note収益化まわりの拡充) → 調査の結果、noteには公式APIが無く、過去の自動スクレイピング(`note_analytics_daemon.py`)も構造変化に弱く既に廃止済みと判明。公開状態(URL/公開日)と成績(閲覧数/スキ/販売数/売上)は手入力方式で記録することにした。`note_articles`に列追加(`note_url`/`published_at`/`views`/`likes`/`sales_count`/`sales_amount`/`metrics_updated_at`)、`/api/admin/note-articles/[id]`(PATCH)を新設、`/admin/analytics`の下書きプレビューに「公開済みにする」フォームと成績入力欄を追加
- [x] note分析ページの拡充・投稿スケジュール・反応データ活用 → `note_articles`に`scheduled_at`列を追加し、下書きに配信予定日を設定できるように（`/admin/analytics`に「📅配信スケジュール」一覧を追加）。分析タブは6週間前の静的ファイル1本を表示し続ける死んだ経路(`note_analytics_daemon.py`由来)から、手入力の実データ集計(合計PV/スキ/売上/公開済み記事数)を主指標にする方式へ全面的に置き換え。「🏆反応の良い記事TOP5」を新設し、閲覧数の多い記事を一覧表示（旧レポートは参考程度に残置）
- [x] **「みんなのランクがアンランクになる」バグの再発を修正** → 原因はデータ破損ではなくUI表示バグだった。`ktm-admin/page.tsx`の「最高Rank」セレクトボックス3箇所が`["UNRANKED","IRON",...,"CHALLENGER"]`とディビジョン無しのティア名だけの選択肢しか持っておらず、Riot同期が実際に書き込む"GOLD II"のようなディビジョン付きの値とどのoptionのvalueも一致しないため、controlled selectが一致無し時に先頭の"UNRANKED"を表示してしまい、ディビジョン付きの選手が管理画面上で軒並みアンランクに見えていた。`lib/mmr.ts`に`HIGHEST_RANK_OPTIONS`（ディビジョン込み全選択肢）を追加し3箇所とも差し替え。**注意**: 過去にこの表示バグを見て「直そう」とドロップダウンから選び直した結果、実際にディビジョン無しの値(素の"GOLD"等)やUNRANKEDでDB側が本当に上書きされてしまった選手がいる可能性がある。Riot同期(`/ktm-admin`の同期ボタン)は`higherRank()`で安全に上書きするので、心当たりがあれば再同期で復旧できる
- [x] **上記修正が不完全だったのを追加修正** → デプロイ後も一部（かずき含む）がアンランク表示のままだった。原因は`HIGHEST_RANK_OPTIONS`をディビジョン付き形式("GOLD II"等)だけで組み立てていたため、DBに現に33人分残っているディビジョン無しの値(素の"GOLD"等)がまた同じ理由で一致せずアンランク表示になっていた。素のティア名も選択肢に追加して両方の形式に対応。なお、かずきの値が素の"GOLD"のままなのが元々そうだったのか過去のバグで欠落したディビジョンなのかは不明なため、本人に確認の上ドロップダウンから選び直してもらうのが確実
- [x] **最高Rankのディビジョン(I/II/III/IV)表示を完全廃止** → ユーザー判断で「GOLD4」等の細分化が不要とのことで、ティア名のみの運用に統一。`calculateInitialMmr()`は元々ティア部分しか見ておらずディビジョンはMMR計算に一切使われていなかった（表示上の情報でしかなかった）ため実害なし。`HIGHEST_RANK_OPTIONS`をティア名のみに簡素化、Riot同期2箇所(`admin/riot-sync`・`riot/sync-ranks`)も`soloQ.tier`のみ保存するよう変更、既存23人分のディビジョン付きデータもDB側で"PLATINUM III"→"PLATINUM"のように一括変換済み
- [x] ダッシュボードのヘッダーボタン整理 → 「ナレッジ/データ整備」「名簿/試合管理」の2つは既にサイドバーの管理者メニュー（`/admin/knowledge`・`/ktm-admin`）と完全に重複していたため削除。「最新情報を取得（手動同期）」もブラウザ更新で同じ結果になるため削除し、最終更新時刻の表示だけ残した（AIプロンプト設定ボタンのみ維持）
- [x] ダッシュボードの「募集アクティビティ」パネルを削除 → 機能していないとのユーザー判断。`recruitments`テーブルへのクエリ・`dashboard-stats`のレスポンスからも関連コードを削除
- [x] youtube_absorbスケジューラが永久に起票スキップし続けるバグを修正 → `edge_tasks`に2026-07-27から4日間`running`のまま更新が止まったゴースト行が残っており、`youtube_absorb_scheduler_loop`の重複起票防止チェックが「pending/runningが1件でもあれば無条件スキップ」だったため、クラウド動画解析を止めた今、ローカルのエッジワーカーが動画解析の唯一の実行経路であるにも関わらず永久にタスクが積まれない状態だった。該当ゴースト行を`failed`にクローズし、チェック側にも「2時間以上更新が無いpending/runningは無視する」という鮮度フィルタを追加して再発を防止
- [x] デザイン方向転換「サイバーパンク→やわらかいダーク」を`/admin/dashboard`でパイロット実施 → `globals.css`の共通テーマは変更せず、このページ単体のTailwindクラス・rgba値のみを置換（寒色系のblue/indigo/purple/cyanをamber/orange系に、gray/slateをstone系に統一、背景の黒を暖色寄りに、ネオングローの発光強度を大幅減）。emerald(成功)・rose(警告)の意味的な色は維持。ユーザー確認待ちで、OKなら他ページへ展開
- [x] note記事のSEO/検索流入強化 → `07_seo_specialist`スキルは記事生成フローに未接続の使われていないプロンプトだったため、`note_article_drafter.md`/`sovereign-factory/SKILL.md`の両方に「Step 2.5/3.5: 検索流入を意識したタイトル調整＆過去の反応データ参照」を追加。タイトルに検索されやすい語を含めることと、執筆前に過去の反応の良い記事(TOP5)の傾向を参考にすることを明文化
- [x] デザイン方向転換「サイバーパンク→やわらかいダーク」を全ページへ展開 → `globals.css`共通テーマ＋`login`・`coach`・`ktm-admin`(本体/ProfileModal/MatchHistoryPanel)・`balancer`・`history`・`synergy`・`leaderboard`・`champions`(元々ゴールド基調で変更不要)まで完了。LoLの実際のBLUE/REDチーム色（`balancer`のチーム分け表示・`history`や`MatchHistoryPanel`の試合結果表示）とDiscord公式ブランドカラー(`#5865F2`)は意味を持つため維持し、周辺の装飾色だけ暖色化。ユーザーフィードバックを受け背景の暗さを`#1c1917`系→`#2b2620`系（より明るい暖色ダーク）に再調整。残る`admin/analytics`等の管理系サブページは未着手

## ✅ 2026-07-30 追加セッションで対応済み
- [x] Web Push配信が届かない問題を解消。原因は鍵の不一致ではなく`VAPID_SUBJECT`未設定時のフォールバック値`mailto:admin@ktm.local`（実在しないドメイン）で、Appleの配信サーバーだけがこれを`BadJwtToken`として拒否していた。`VAPID_SUBJECT`に実在のメールアドレスを設定して解消（鍵ペア自体は複数回再生成したが原因ではなかった）
- [x] `deliverToSubscriptions`が410/404以外の配信失敗を握りつぶしていたのを修正し、失敗理由が見えるようにした（`04_PORTAL/src/app/api/push/send/route.ts`, `04_PORTAL/src/lib/notify.ts`）
- [x] `PORTAL_BOT_SECRET`をVercel・Cloudflare双方に設定し有効化。以前は`/api/player/update-puuid`・`update-lane`・`/api/riot/match-sync`等がdiscordIdさえ分かれば誰でも叩ける状態だった（fail-open設計）が、bot⇔ポータル間の認証が必須になった
- [x] 動画キューの「クローズ」をDiscord DM送信からYouTubeプレイリスト追加に変更。Google Cloud ConsoleでOAuthクライアント作成・`04_PORTAL/src/app/api/admin/youtube/oauth/`に一度だけ使う認可ルートを新設し、`YOUTUBE_OAUTH_CLIENT_ID`/`_SECRET`/`_REFRESH_TOKEN`/`YOUTUBE_MANUAL_REVIEW_PLAYLIST_ID`をVercelに設定して有効化・実機確認済み（初回のみGoogle側の権限反映が遅れて動画が届くまで数分かかった）

## ✅ 2026-07-29 追加セッションで対応済み
- [x] カスタム募集（都度募集）のロール選択ボタン(Top/Jg/Mid/Adc/Sup 5個)をセレクトメニュー1つに統合（`embeds.js`/`components.js`）。定期募集側は変更なし
- [x] チャンピオントレンド更新失敗の通知から再実行できるように改善: 通知URLに`champion`/`role`/`failed_task`を付与し、辞典AI更新タブに失敗タスク一覧＋再実行ボタン＋実行元(ローカル/クラウド)表示を追加（`edge_cloud_worker.py`, `pipeline-status/route.ts`, `AiUpdateTab.tsx`）。`edge_tasks`に`executor`列を追加
- [x] 動画キュー一覧にチェックボックス複数選択を追加。字幕なし動画(`error_no_transcript`)を「手動対応要」と明示し、選択分をまとめてDiscordへ送信してキューからクローズする機能を追加（`YoutubeQueueManager.tsx`, `api/admin/youtube/route.ts`）
- [x] 辞典の「対面」タブを削除し、手動での対面メモ入力機能をコーチページの「🔍試合後」グループへ移設（`MatchupMemoTab.tsx`）。5v5シミュレータも独立ページ(`/matchups`)からコーチページの「⚡試合前」グループへ移動（`FiveVFiveSimTab.tsx`）。**注意: `/matchups`は元々一般公開ページだったが、コーチページ自体が管理者ログイン必須のため、この移動で5v5シミュレータが管理者限定機能になった**
- [x] スマホ通知(champion_trend等)クリック時の遷移先デフォルトを`/coach`から`/admin/dashboard`に変更（個別の遷移先指定は必要な箇所のみ据え置き）
- [x] PCサイドバーの管理者「一般機能」タブに辞典が抜けていたメニュー不整合を修正。一般公開メニューから管理者専用の`/admin/knowledge`リンクを削除（`Sidebar.tsx`）

## ✅ 2026-07-28 追加セッションで対応済み
- [x] `04_PORTAL/scripts/archive/` の削除（`rm -rf`で完了。git上は未コミットの削除状態）
- [x] `PORTAL_BOT_SECRET`: 安全な値を生成し、Vercel/Cloudflare両ダッシュボードへの設定手順を案内済み。実際の入力はユーザー側で対応待ち
- [x] **新規発覚・修正: `youtube_absorber.py`のAI要約生成が64%失敗していた問題**
  - 直近188件の`youtube_absorb`タスクを調査 → 120件（64%）が「AI Agent Gateway (localhost:8000) に接続拒否」で要約生成に失敗（字幕/Whisperでの文字起こし自体は成功していた）
  - 原因: 2026-07-26の`start_all.ps1`簡素化でGateway(`api.py`)が起動されなくなったが、`youtube_absorber.py`だけがGateway直呼び出し(フォールバックなし)のままだった。他の全スクリプト(`champ_db_updater.py`等)は`ai_helper.generate_content_safe()`経由でGateway不通時も自動で直接Gemini呼び出しにフォールバックする設計になっており、ここだけ取り残されていた
  - 修正: `generate_bible()`をGateway直叩きから、`agent_prompts`テーブルからプロンプトテンプレートを取得→`generate_content_safe()`を直接呼ぶ方式に変更（Gatewayの内部処理をそのまま踏襲、他スクリプトと同じパターンに統一）
  - 未検証: コード上は他スクリプトと同一パターンで健全だが、実際のAPIキー・DBを使った動作確認は次回のedge_worker_daemon実行時に確認が必要
- [ ] Whisperのクラウド移行の設計検討は上記調査により実処理量が判明（週45件≒月190件）。Gateway修正の効果を見てから再開

## ✅ 2026-07-28 ポータル不具合修正セッションで対応済み
- [x] チャンピオン辞典の更新ボタンがスマホで見えない問題（ヒーロー領域のレイアウト崩れ）
- [x] スマホでナレッジを開くと管理者専用に飛ばされる認証バグ（下部ナビのprefetchが認証ゲートと衝突）
- [x] 伸びしろパートナーの集計バグ（存在しないフィールド参照、`/api/player/chemistry`の実装に統一）
- [x] メタ統計のスマホ表示でチャンピオン名が見切れる問題
- [x] パーソナルコーチの6タブを3グループに再編（試合前+マッチアップ+偵察／試合後+傾向／目標+ティルト）。孤立していたScoutTab（偵察機能）を復活統合
- [x] 辞典からWin Rate/Matches/KDA表示を削除
- [x] 更新ボタンのトレンド取得タイムアウト（フロント待機180秒→900秒に延長）
- [x] 辞典データ(`matchup_sentinel`)への更新に履歴記録機能を後付け（TS7経路+Python9経路、全16実経路）。更新履歴パネルと辞典本文の不整合を解消
- [x] **新規発覚**: `matchup_id`の命名規則が書き込み経路ごとにバラバラで、同じチャンピオンが別レコードとして重複しうるバグを発見・修正（`champion-research/route.ts`, `lol_trend_collector.py`）。本番DBで実際にズレていた`Talon`の1件も修正済み（Supabase MCP経由で確認・修正）
- [x] `admin/champion-research` がスクレイピング失敗を握りつぶしている問題の修正（`championStats.ts`に失敗理由を追加し`DeepResearchPanel.tsx`に表示）
- [x] `balancer/pending` のインメモリキャッシュ不整合を解消（`edge_tasks`テーブルを使った永続ストアに切り替え）
- [x] `admin/init-mmr` の逐次awaitパフォーマンス改善（N+1往復→2往復に削減）
- [x] `04_PORTAL/scripts/` 重複スクリプトの整理（archive/内の参照ゼロを確認、削除コマンドのみ権限ブロックで保留）
- [x] `ANTIGRAVITY.md`・`SYSTEM_DESIGN_BY_FUNCTION.md`・`affiliate_knowledge.md` に残る旧収益化パイプラインの記述を更新

## ✅ 完了済み（アーカイブ）
- [x] **Sovereign OS v7.0 移行計画の推進**
  - [x] フェーズ1: バランサーIdentityエラー解決 & キーローテーション基本実装
  - [x] フェーズ2: Webhook式ハイブリッドイベント駆動キュー
  - [x] フェーズ3: YouTubeAbsorber の Gateway ＆ 自律スキルへの完全統合
  - [x] フェーズ4: Riot ＆ Discord 連携の改名自己修復・安全停止
- [x] **ポータル導線整理 ＆ チャンピオン辞典ハブ化**
  - [x] Phase 1: サイドバー導線の整理（メニュー10→6項目、セクション分け）
  - [x] Phase 2: チャンピオン辞典のタブ統合ハブ化（辞典/対面/AI更新）
  - [x] Phase 3: 自動化パイプラインの可視化ダッシュボード
  - [x] Phase 4: 辞典 → note記事生成の直結導線（※導線自体は2026-07-26に収益化パイプラインごと削除。再実装時に要再設計）
- [x] **2026-07-26〜27 大規模クリーンアップ**
  - [x] 収益化パイプライン全体を削除（`_MONETIZE/`, `agents/`, `monetization_batch.py` 等。`promoter.py`のみ pulse.py の現役cronのため残置）
  - [x] `youtube_absorber.py` / `match_importer.py` の回帰バグ修正
  - [x] 孤立ファイル・壊れた導線・重複ロジック（DDragon取得等）の整理
  - [x] `sovereign_tasks` キューの死んだ読み出し経路を削除（`edge_tasks` に一本化）
  - [x] KTMカスタム戦のCS・ファーストブラッドのフェイクデータ生成ロジックを削除

## 📊 運用目標 ＆ 前提ルール
- **note配信**: 週2回（水・土） / 500円モデル有料記事 of 自動生成
- **SNS（X）宣伝**: パッチメタに応じたチャンピオン紹介スレッドの配信
- **主要アセット**: 
  - [NEXUS_INDEX.md (総合索引)](file:///d:/my_work/01_INTEL/NEXUS_INDEX.md)
  - [アフィリエイト知識](file:///d:/my_work/02_FACTORY/03_ASSETS/affiliate_knowledge.md)
  - [note執筆プロトコル](file:///d:/my_work/02_FACTORY/03_ASSETS/forge_note_protocol.md)

## 🚧 技術的負債バックログ（継続追跡）
- [x] タスクキュー2系統の統合（SQLite時代の sovereign_tasks 読み出し経路を削除し、edge_tasks に一本化。2026-07-27対応済み）
- [x] edge_worker の Gateway バイパス解消 → 2026-07-30対応: 想定と実態が違っていた。Gateway(`api.py`)は2026-07-26以降ずっと未起動で、フォールバック側には既にGatewayの`QuotaShaper`(インメモリ・プロセス限定)より堅牢な`quota_manager`(日次上限・永続)と`APIGateway.wait_if_needed()`(Redis/SQLite・プロセス横断)が揃っていた。`ai_helper.generate_content_safe()`から無駄になっていたGatewayヘルスチェック(毎呼び出し1.5秒)を削除し、直接生成に一本化（`api.py`自体は手動起動用に残置）
- [x] エージェントスキル出力の DB 自動投入パイプライン → 2026-07-30実装: 新規`note_articles`テーブルを作成し、`sovereign-factory`/`note_article_drafter`のSKILL.mdに執筆完了時のupsertステップを追加。`/admin/analytics`「記事下書きプレビュー」タブは元々`02_FACTORY/note_drafts`をファイルシステム経由で読む設計だったが、同ディレクトリは`.gitignore`対象でVercel本番には一切デプロイされず常に空になる作りだったと判明、DBから読む方式に差し替え。今日書いたZyra記事を実データとして投入・表示確認済み。あわせて`sovereign-factory`等の複数スキルファイルに残っていた「軍師」「王」呼称・比喩表現をCLAUDE.md表現規約に合わせて削除
- [x] `04_PORTAL/scripts/` 重複スクリプトの整理（2026-07-28: 参照ゼロを確認しsmart_backfillに統一。archive/の物理削除のみ権限ブロックで保留、上記タスク参照）
- [x] Supabase RLSセキュリティ監査（実施中）→ 2026-07-30/31対応: `get_advisors`で発覚した「常時許可(qual/with_check=true)」ポリシーをリスクの高い順に修正。① `ktm_players`/`ktm_matches`/`ktm_match_participants`: 誰でもMMR書き換え・偽の試合結果INSERTが可能だった書き込みポリシーを削除（読み取りは公開のまま維持、書き込みはservice role経由のAPIルートに限定。クライアント側17ファイルを確認し直接書き込みが無いことを確認済み）。② `agent_prompts`: ポリシーは`authenticated`ロール限定で、このポータルはSupabase Authを使わない(anonキーのみ)ため実害はゼロと判明したが、`/admin/prompts`の保存機能自体が同じanonキー直叩きに依存しており実は保存が失敗する状態だったため、`/api/admin/prompts`（service role経由）を新設しRLSごと完全に閉じて保存機能も併せて修復。今回から`04_PORTAL/supabase/migrations/`の番号付きファイル（37〜39）として記録する運用に統一（それまでの2件はMCP経由の直接適用のみでファイル化されていなかったため遡って追加）。残る対象: `edge_tasks`(4件)、`matchup_sentinel`(3件)、`youtube_channels`/`youtube_playlists`/`youtube_queue`(各3件)、他多数
- [ ] Supabase 直接アクセスの API 経由化 → v8.0 APIファースト化として推進
- [ ] 対面メモ（`MatchupMemoTab.tsx`）を新規作成しても保存されない不具合の調査・修正 → 2026-07-30調査: DB/RLS側の問題ではないと確認済み（`matchup_sentinel`は書き込みポリシーが公開のままで、同じupsertペイロードをcurlで直接叩くと201で成功する）。フロント側（`saveMemo()`関数、`ChampSelect`の値反映、または保存後の状態遷移）に原因があるはず。次回はブラウザの実機で再現し、コンソールのエラー・Networkタブのレスポンスを確認するところから着手
- [ ] ソロキューを振り返る導線の強化 → 対面メモ・試合後振り返り・傾向分析がバラバラなタブに散らばっており、1試合ごとの振り返りサイクルとして繋がっていない。上記の保存不具合修正とあわせて、ソロQ1試合を終えた後に「振り返り→対面メモ記録」がスムーズに回る導線を設計し直す
- [ ] **未解決・継続調査**: YouTube動画解析パイプラインがGitHub Actions上でほぼ機能していない問題 → 2026-07-31発覚: ダッシュボードは「completed」を返し続けていたが実態は`youtube_worker.py`（字幕取得）・`youtube_absorber.py`（Whisper救済）とも`Sign in to confirm you're not a bot`でブロックされ、07-27 12:36以降4日間1件も処理成功していなかった（リトライを消費しないロジックのため失敗がダッシュボードに出ず、ユーザーが手動で30件以上クローズして初めて発覚）。
  - 同日中に4つの実バグを発見・修正済み: ①cookie認証が無かった(`YOUTUBE_COOKIES_TXT`をユーザーがGitHub Secretsに登録し解消)、②`--js-runtimes node,deno`がカンマ区切りとして解釈されず常に無視されていた、③`--remote-components ejs:github`が無くchallenge解決スクリプト自体が取得されていなかった、④GH Actionsランナーに実行可能なNode.jsが無かった（`actions/setup-node`追加）。あわせて`android`/`web`より安定する`android_vr`クライアントを優先するよう変更。
  - **しかしこれでも解決しなかった**: 上記4点を全て直した状態でもGitHub Actions上では動画によって`Sign in to confirm you're not a bot`や`Requested format is not available`が再発する。同じ動画・同じコマンドをブロックされていない別IP(ローカル)から実行すると問題なく取得できるため、**GitHub ActionsのIP自体がYouTube側から低信用と判定されており、クライアント/cookieの組み合わせだけでは解決しきれない**可能性が高い。
  - 次にやるなら: `edge_worker_daemon.py`に既にある`youtube_absorb_scheduler_loop`（ローカルPCから自宅IPで実行する経路）を使って、自宅IPなら安定するか検証するところから。もしくは住宅IPプロキシサービスの導入（有料）。cookie自体は無駄にはなっていない（GH Actions側の成功率は多少上がったので残しておく）
- [x] **cron の曜日ズレ（UTC/JST変換ミス）を2系統で修正** → 2026-08-01対応: cronの曜日フィールドは実行基盤（Vercel/GitHub Actions/Cloudflare）自身のタイムゾーン＝UTCで評価されるため、JSTでの意図した曜日をそのまま数字指定すると+9時間の繰り上がりでズレる。
  - `04_PORTAL/vercel.json`: `soloq-trends`(`0 22 * * 0`→`0 22 * * 6`)・`dict-review-check`(`0 23 * * 3`→`0 23 * * 2`)を本来の意図通りのJST着地に修正（本質的なバグ修正）
  - KTM Bot（Cloudflare Workers Cron）: 「日曜0:00 JSTに来るはずが土曜0:00 JSTに来た(1日早い)」と実際に観測され、真の根本原因を特定。**Cloudflare Workers Cron Triggersの曜日番号は「1=日曜〜7=土曜」で、Vercel/GitHub Actions等が使う標準Unix cron「0=日曜〜6=土曜」と異なる**（Cloudflare公式ドキュメントで確認。実際に暫定対応として"0 15 * * 0"をデプロイしようとした際、Cloudflare側が"invalid cron string"として拒否し0を受理しないことで確定）。旧設定"0 15 * * 6"はUnix基準の「土曜」のつもりが、Cloudflare基準では6=金曜と解釈されており、これが1日ズレの真因だった。`03_SYSTEMS/ktm_bot/wrangler.toml`・`src/handlers/scheduled.js`をCloudflareの番号体系（1=日,2=月,3=火,4=水,5=木,6=金,7=土）で書き直し（`0 15 * * 6`→`0 15 * * 7`、`0 11 * * 3,5,6`→`0 11 * * 4,6,7`）。あわせて未ローテーションの`INTERNAL_GAS_SECRET`（ハードコードfallback値）のローテーションは引き続き未着手（今回のズレとは無関係と判明）
