# 📌 Sovereign OS 業務ダッシュボード (TODO)

本ファイルは、日々の作業タスクを管理するためのダッシュボードです。
会話開始時に Antigravity が自動的にこのファイルを読み込み、文脈を復元して本日のタスクに直ちに追従します。

---

## 📅 次回の注力タスク（2026-07-29 実行予定）
> 2026-07-28 のポータル不具合修正セッションでほぼ解消。残るのは外部ダッシュボード操作や意思決定が必要なものだけ。SNS素材フォルダの統合（231ファイル・5箇所）のみ、規模が大きいため引き続き対象外。

- [ ] Whisper のクラウド移行の設計検討（無料・高精度が条件、実装自体は保留のまま設計だけ詰める）
- [x] **`champion_trend`タスクのクラウド移行検討** → 2026-07-29確認: 既に`edge-cloud-worker.yml`/`scripts/edge_cloud_worker.py`の`TASK_MAP`に`champion_trend`が組み込まれ、クラウド実行済みだった（この項目自体が古い記述のまま残っていたstaleなTODO）。ダッシュボードが実行元(ローカル/クラウド)を区別できていなかった点は今回の`pipeline-status` API改修で表示に対応済み。
- [x] **リポジトリ運用の意思決定** → `02_FACTORY/PRODUCTS/`を`.gitignore`対象に決定（`note_drafts`等と同じ扱い。公開リポジトリのため下書き/生成物は非公開のまま。既存84ファイルは`git rm --cached`で追跡解除、ローカルには残置）
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
- [ ] edge_worker の Gateway バイパス解消 → QuotaShaper 経由に統一
- [ ] エージェントスキル出力の DB 自動投入パイプライン設計（ローカルMD → Supabase）
- [x] `04_PORTAL/scripts/` 重複スクリプトの整理（2026-07-28: 参照ゼロを確認しsmart_backfillに統一。archive/の物理削除のみ権限ブロックで保留、上記タスク参照）
- [ ] Supabase 直接アクセスの API 経由化 → v8.0 APIファースト化として推進
