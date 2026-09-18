# 📌 Sovereign OS 業務ダッシュボード (TODO)

本ファイルは、日々の作業タスクを管理するためのダッシュボードです。
会話開始時に Antigravity が自動的にこのファイルを読み込み、文脈を復元して本日のタスクに直ちに追従します。

---

## 🚀 【進行中】 The Sovereign Victory Loop (完全勝利サイクル開発)

> **最上位誓約**: 
> 1. 「プレイ前 ➔ プレイ中 ➔ プレイ後 ➔ ナレッジ蓄積」の完全循環ループを維持。
> 2. 不確定情報（AI推測・でっち上げ）は100%排除。Riot公式 Live Client Data / DataDragon / 確定実戦データのみを使用。

- [x] **Step 1: 【プレイ前ナレッジ ＆ 対面計算基盤】**
  - [x] **案A: 即死キルライン境界メーター** (`03_SYSTEMS/v2_CORE/_LOL/overlay/kill_line_calculator.py` / DataDragon公式確定ダメージ計算・イグナイト合算・AR/MR軽減適用)
  - [x] **案B: 3段階勝ちパターン手順書** (Supabase実戦対面メモを `Lv1~2序盤立ち位置` ➔ `Lv3~5フリーズ基準` ➔ `Lv6~オールイン` に構造化)
  - [x] ポータル `/coach` (試合前タブ) および `/champions` へのUI統合 (`MatchupBlueprintCard.tsx`)
- [x] **Step 2: 【プレイ中オーバーレイ連動】**
  - [x] Sovereign HUD (TAB画面・左側対面カード) への即死ライン警告＆現在フェーズ手順のリアルタイム描画 (`matchup_card_widget.py`)
  - [x] 劣勢時（-3000G）の「案C: 逆転戦術コンパス」HUD通知
- [x] **Step 3: 【プレイ後ディープアナリティクス】**
  - [x] **案1: 序盤15分メトリクス精密アナリティクス** (CSペース推移グラフ・トレード効率比率)
  - [x] **案E: リコール＆ウェーブのテンポロス（もしもの世界）タイムライン逆再生**
  - [x] **案6: アイテムビルド選択の分岐監査 (Build Audit)**
  - [x] **案4: 時間帯別スケーリング勝率 ＆ パワースパイク分析**
  - [x] **案9: 目標ランク（ダイヤ/エメラルド）との多角形ギャップレーダー**
  - [x] ポータル `/coach` (試合後タブ) へのUI統合 (`PostGameDeepAnalyticsDashboard.tsx`)
- [x] **Step 4: 【完全勝利サイクルの結合 ＆ ナレッジ自動更新ループ】**
  - [x] 試合終了時の勝敗・ファイトデータ・改善ポイントをチャンピオン辞典に自動反映し、次回のプレイ前ナレッジへ循環するループ検証 (`match_feedback_sync.py` / `sync-match-feedback`)

---

## 📋 【次のタスク】 ナレッジ基盤の先行整理 ＆ 再解析パイプライン

### 🧹 Phase 1: ナレッジ ＆ キュー先行整理 ＆ 辞典超強化

- [x] **領域1: 📹 YouTubeキュー整合化 ＆ 429完全防御**
  - [x] 完了済み動画のステータス同期（Zyra `YBZdHBTCZGU`、Lillia `ayqhHJc0pPY` 等を `completed` に更新）
  - [x] `clean_youtube_queue.py` によるエラー58件（`failed` 30件, `error_generation` 28件）の再試行・仕分け（56件を `pending` にリセット、キューのエラー0件化）
  - [x] `extract_video_tactics.py` への **YouTube 429完全防御（`android_vr` クライアント偽装 ＆ cookies 統合）** の配備（改善項目②）
  - [x] キュー整合性チェックを `ops_health_check.py` に連動させ放置エラーを常時監視
- [x] **領域2: 🏛️ 帝国総合索引同期 ＆ 戦術バイブル拡充 ＆ メタデータ構造化**
  - [x] `01_INTEL/NEXUS_INDEX.md` のバイブル一覧を全18体（クリップ搭載13体、ヨリックBlueprint補完）へ完全同期
  - [x] ローカル解析データ（`02_FACTORY/bible/kirei_bible/`）から未マウントの主要JGバイブル（Kha'Zix, Viego, Lee Sin, Kindred 等）へ実演クリップ（秒数リンク＋Why/How/Rejected）を一括マウント
  - [x] Coach Kirei プロ動画解析 174本のマスターインデックス（`INDEX.md`）自動生成 ＆ `NEXUS_INDEX.md` 連動（孤立ファイルを400件台から223件へ半減達成）
  - [x] 戦術バイブル全18体の **フロントマター統一・正規化（イミュータブル・プロパティ規約準拠・tags/status/published_at統一）**（改善項目①）
  - [x] **PULSE戦略メモ・analytics等の総合索引（`_LOL/INDEX.md`）連動 ＆ 孤立ファイル解消**
  - [x] `audit_knowledge_links.py` を実行し、全リンク切れ0件を再確認
  - [x] `scratch/` の肥大化した不要一時ファイル（巨大txt/json/vtt約1.5MB）を安全クリーンアップ
- [x] **領域3: 📖 チャンピオン辞典・ビジュアルダッシュボード超強化 (UX最大インパクト)**
  - [x] **824件の実戦対面DB（`matchup_sentinel`）のインラインアコーディオンUI化**: `DictionaryTab` から `ChampionVisualDashboard` へ Props 渡し、有利・不利カードクリックで即座に対面Sentinelメモをインライン開閉展開（改善項目④完遂）
  - [x] **パワースパイク ＆ ジャングル実測タイミング（`realJungleTiming`）のHUD可視化**: 最速フルクリア秒数・1stコア目標・パワースパイク推移ゲージ（序盤/中盤/終盤10段階バー）の描画（改善項目⑤完遂）
  - [x] **複数レーン（ロール別タブ）の完全連動**: JG/SUP/TOP/MID/BOT等のロール切替時に、アーキタイプ判定・シチュエーションビルド・実戦メトリクスHUD・対面相性・戦術バイブルを動的切替（改善項目⑥完遂）
  - [x] 全18体の戦術バイブルの「3段階勝ちパターン手順書（Blueprint）」および「没理由（Rejected）」のクオリティ均一化監査 ＆ ヨリックBlueprint完備
  - [x] **JGフルクリアタイムの2026年シーズン最新仕様への完全統一**: キャンプ0:55湧き・カニ2:55争奪基準への刷新、Kha'ZixのDB重複406エラー解消、全62チャンピオンの`champion_facts`自動同期、UI HUDへのカニ先行秒数バッジ配備、主要JGバイブル13体への2026年クリア指標追記
  - [x] **敵JGとのクリア速度差による「カニ遭遇・交戦危険度」リアルタイム予測HUD** (`MatchupWarningCard.tsx`): 自陣と敵JGの最速タイム差を自動計算し、「テンポ優位/交戦危険/互角接敵」をリアルタイム警告（案1完遂）
  - [x] **2026年オブジェクトタイマー（5:00グラブ/ドラゴン、14:00ヘラルド）のバイブル完全連動**: 全18体の戦術バイブル Phase 2 へ「4:20リコール ➔ 5:00グラブ/ドラゴン先制配置」を正式同期（案2完遂）

### 🚀 Phase 2: 動画解析インフラ進化 ＆ 再解析パイプライン

- [ ] **字幕欠落動画のローカルWhisper音声認識フォールバック配備**: 字幕のないプロ実況動画（エラー30件の主要因）を音声から高精度自動文字起こし（改善項目③）
- [ ] **第1弾 (MVP): 主要JGチャンピオン限定再解析 (約20〜30本)**
  - 対象: 戦術バイブルが存在する主要ジャングラー（Lee Sin, Viego, Kha'Zix, Kindred 等）の動画。
  - 方式: YouTube通信不要・ローカル字幕キャッシュから新世代マクロ保護プロンプト（Macro/Why/How/Rejected/秒数付きリンク）で再解析し、`personal_knowledge` および戦術バイブルへ反映。
- [ ] **第2弾: エラー・保留キュー（52件）の自動救済・再解析**
  - 対象: `youtube_queue` で過去に `error_generation` や `failed` となった動画。
  - 方式: 配備済みの多重モデルフォールバック（2.5-flash→1.5-flash→2.0-flash）およびVTT保護機構で復旧・再生成。
- [ ] **第3弾: 全体（1058本）の定期ローテーション再解析（GitHub Actions / バッチ）**
  - 対象: 完了済み全1058本の動画。1回10〜20本ずつ安全に定期ローテーション実行。

### 👑 Phase 3: 自律ナレッジループ ＆ セマンティック検索進化

- [ ] **実戦リザルト（Live Client Data）から戦術バイブルへの「完全自動逆流」**: 試合終了監視デーモン（`auto_match_recorder.py`）が試合結果と対面相手を自動検知し、バイブルの対面メモおよび「没理由（Rejected）」へ自律追記（改善項目⑦）
- [ ] **戦術概念の横断検索（RAG / 逆引きインデックス）**: 「インベード対処」「オブジェクト放棄基準」等の戦術概念キーワードで全バイブル・全動画クリップを即座に逆引きできる検索API/機能の配備（改善項目⑧）

---

## ✅ 2026-09-18 Antigravity セッションで対応済み（ナレッジマネジメント7大原則の全域反映）

- [x] **👑 チャンピオン辞典・シチュエーション別ビルドの動的生成化（ハードコード撤廃）**:
  - `ChampionVisualDashboard.tsx` において、ザイラ等のAPメイジを含む全チャンピオンでAatrox用のADファイタービルド（赤月の刃/黒斧/征服者）が表示されていたバグを根本解決。
  - `detectChampionArchetype` および `getPresetBuildDetails` を新設し、APメイジ、APアサシン、ADアサシン、耐久タンク、マークスマン、サポート、ADファイターを自動判定して標準・対タンク・対バーストの3大シチュエーションに応じた適正ビルドを動的生成。
  - 画面上にアーキタイプバッジ（「⚡ APメイジ」「🛡️ 耐久タンク」等）を表示し、ビルド選択のWhyを可視化。
- [x] **yt-dlp Python API化 ＆ Zyra実演クリップ正式マウント ＆ 対面相性インテリジェント化**:
  - `extract_video_tactics.py` のyt-dlp CLIをPython API移行。429耐性＆VTTフォールバック追加。
  - `zyra_tactics_bible.md` のダミーURL→Agurin実動画5シーンに差替え。
  - 対面相性デフォルトをアーキタイプ別インテリジェント推定に改善。
  - `ops_health_check.py` のインボックス誤検知修正。
- [x] **Lillia & Graves 戦術バイブル実演クリップ配備 ＆ Gemini多重モデルフォールバック配備**:
  - `extract_video_tactics.py` にGemini多重モデルフォールバック（2.5-flash→1.5-flash→2.0-flash）およびURL自動サニタイズ配備。
  - `lillia_tactics_bible.md` へCoach Kirei実動画（J4対面特化）から実演3シーンをマウント。
  - `graves_tactics_bible.md` へCoach Kirei実動画から実演3シーン（タワー裏奇襲/ドラゴン前Prio/ヘラルド集団戦）をマウント。
- [x] **note 10記事のディープリサーチに基づく「ナレッジマネジメント7大核心原則」のSovereign OS全域反映**
  - **1. 📅 デイリー作業ログの入口化 ＆ 3行ナレッジ自動抽出**: [`02_FACTORY/DAILY_LOG.md`](file:///d:/my_work/02_FACTORY/DAILY_LOG.md) を新設。作業終了時にAIが自動追記し、翌朝AIが真っ先に読み直す立ち上がり循環を確立。
  - **2. 🏷️ ルール適用範囲（コンテキストタグ）の厳格化**: [`01_base_style.md`](file:///d:/my_work/.agent/rules/01_base_style.md) に「適用場面・非適用場面」の明記を義務化。「結論先行」による読者向け文章の淡白化事故を根本遮断（べっぱん原則）。
  - **3. 📜 SSoT確定 ＆ ナレッジ更新後スモークテスト ＆ 正本派生分離**: [`04_hallucination_prevention.md`](file:///d:/my_work/.agent/rules/04_hallucination_prevention.md) に第5〜7項を追加。更新日の新しさに惑わされず確定資料を特定、更新後1問スモークテスト義務化、生データ不変保持＆派生データ再生成のアーキテクチャを明文化（AIで仕事と心NOTE/Blooming原則）。
  - **4. ❌ 戦術バイブル・対面メモへの「不採用・没理由」ブロック新設**: [`01_INTEL/tactics/template_tactics_bible.md`](file:///d:/my_work/01_INTEL/tactics/template_tactics_bible.md) を新設。推奨ビルドだけでなく「なぜこのアイテムは罠なのか」を必須化（Coupen原則）。
  - **5. ✍️ note執筆プロトコル ＆ 骨格テンプレートの全面改訂**: [`forge_note_protocol.md`](file:///d:/my_work/02_FACTORY/03_ASSETS/forge_note_protocol.md) および [`template_note_skeleton.md`](file:///d:/my_work/02_FACTORY/03_ASSETS/template_note_skeleton.md) を改訂。確定パッチ・集計期間のメタデータ欄、読者の痛みに訴求する導入、不採用ビルド暴露、読後3大行動チェックリストを統合。
  - **6. 🏛️ 帝国総合索引のPARA構造再編**: [`NEXUS_INDEX.md`](file:///d:/my_work/01_INTEL/NEXUS_INDEX.md) の先頭にデイリーログ入口とナレッジ憲章を配置。
  - **7. 🧠 AI家庭教師スキル (`knowledge-drill`) の新設**: [`.agent/skills/knowledge-drill/SKILL.md`](file:///d:/my_work/.agent/skills/knowledge-drill/SKILL.md) を新設。外部情報インプットの3大完了条件（自分の言葉で説明・実戦適用・次の一歩）とクイズによる定着支援を実現（honkoma原則）。
  - **8. 📖 ワンシート制式起動マニュアル (`RUNBOOK.md`) の新設**: [`03_SYSTEMS/RUNBOOK.md`](file:///d:/my_work/03_SYSTEMS/RUNBOOK.md) を新設。ワーカー・HUD・同期CLI・復旧ワンライナーを1枚に集約（Coupen原則）。
  - **9. ⚠️ 地雷回避データベース (`known_pitfalls.md`) の新設**: [`.agent/rules/known_pitfalls.md`](file:///d:/my_work/.agent/rules/known_pitfalls.md) を新設。過去に外した日付・症状・真因・再発防止策を集約（べっぱん原則）。
  - **10. 🔄 週次ナレッジ棚卸しワークフロー (`weekly-review.md`) の新設**: [`.agent/workflows/weekly-review.md`](file:///d:/my_work/.agent/workflows/weekly-review.md) を新設。日次と週次を分離し、知見の昇格と陳腐化防止をルーティン化（honkoma原則）。
  - **11. 🏷️ イミュータブル・プロパティ規約の標準化**: [`01_base_style.md`](file:///d:/my_work/.agent/rules/01_base_style.md) に公開日（`published_at`）と取込日（`captured_at`）を分離する統一フロントマター仕様を明文化（Blooming/りゅう原則）。
  - **12. 📑 Webクリップ制式雛形 (`template_web_clip.md`) の新設**: [`01_INTEL/template_web_clip.md`](file:///d:/my_work/01_INTEL/template_web_clip.md) を新設。確定事実・AI要約・4段階深掘り・人間検証欄を完全分離（りゅう/honkoma原則）。
  - **13. 🔍 判断経緯・没理由の逆引きスキル (`recall-decision`) の新設**: [`.agent/skills/recall-decision/SKILL.md`](file:///d:/my_work/.agent/skills/recall-decision/SKILL.md) を新設。「`/why [トピック]`」で過去の没理由・方針変更経緯を即座に回答（Blooming原則）。
  - **14. 📮 ナレッジ訂正・誤り報告の単一受付窓口 (`FEEDBACK_INBOX.md`) の新設**: [`02_FACTORY/FEEDBACK_INBOX.md`](file:///d:/my_work/02_FACTORY/FEEDBACK_INBOX.md) を新設。情報の違和感を1行投函し、AIが自動修正・スモークテストを行う仕組みを構築（AIで仕事と心NOTE原則）。
  - **15. 🏁 セッション終了全自動ラップアップ (`wrap-up.md`) の新設**: [`.agent/workflows/wrap-up.md`](file:///d:/my_work/.agent/workflows/wrap-up.md) を新設。「`/wrap-up`」1発で経緯抽出・3行ナレッジ記録・TODO更新・Git Pushまで完全自律完結（Coupen原則）。
  - **16. 🛡️ 全域総合ヘルスチェッカーCLI (`ops_health_check.py`) の新設**: [`scripts/ops_health_check.py`](file:///d:/my_work/scripts/ops_health_check.py) を新設。朝イチ10秒でナレッジ未処理・Git差分・ポータル型チェック・モデル健全性を一括診断（AIで仕事と心NOTE原則）。
  - **17. 📦 ナレッジVault自動スナップショットCLI (`backup_knowledge_vault.py`) の新設**: [`scripts/backup_knowledge_vault.py`](file:///d:/my_work/scripts/backup_knowledge_vault.py) を新設。Markdown・設定正本571ファイルをわずか1秒・3.3MBで日付付きZIP退避（Blooming原則）。
  - **18. 🐕 機密情報・APIキー誤コミット防止番犬 (`pre_commit_guard.py`) の新設**: [`scripts/pre_commit_guard.py`](file:///d:/my_work/scripts/pre_commit_guard.py) を新設。公開リポジトリへのキー誤プッシュを物理ブロック（Coupen原則）。

  - **19. 🎮 実戦データ ➔ 対面ナレッジ自動同期CLI (`sync_last_match_to_intel.py`) の新設**: [`scripts/sync_last_match_to_intel.py`](file:///d:/my_work/scripts/sync_last_match_to_intel.py) を新設。試合後の対面勝敗・反省・罠ビルドをワンコマンドで対面バイブルへ自動マージ（つくラボAI原則）。
  - **20. 🔗 ナレッジ全域リンク整合性 ＆ 孤立ファイル検知リンター (`audit_knowledge_links.py`) の新設**: [`scripts/audit_knowledge_links.py`](file:///d:/my_work/scripts/audit_knowledge_links.py) を新設。461件のMarkdownからリンク切れや未リンクの孤立ノートを瞬時に検出（りゅう原則）。
  - **21. 🧹 旧アーカイブリンク切れクリーン化 ＆ TODO内実在リンク修復**: [`audit_knowledge_links.py`](file:///d:/my_work/scripts/audit_knowledge_links.py) のアーカイブ除外と [`TODO.md`](file:///d:/my_work/02_FACTORY/TODO.md) の `BottomNav.tsx` リンク修復により、走査対象全459件のMarkdownリンク切れ0件（ALL GREEN）を達成（りゅう原則）。
  - **22. 📢 Discord Webhook 外部通知基盤の配備**: [`scripts/notify_discord.py`](file:///d:/my_work/scripts/notify_discord.py) を新設。日次ナレッジ（`DAILY_LOG.md`）のEmbed投稿、ヘルスチェック結果通知、ドライラン対応、および [`wrap-up.md`](file:///d:/my_work/.agent/workflows/wrap-up.md) との連動を実現（Coupen原則）。
  - **23. 🔐 環境変数テンプレートの制式配備**: [`.env.example`](file:///d:/my_work/.env.example) を新設。Discord Webhook、Supabase、Riot API、Gemini API などの全設定項目を日本語解説付きで定義。
  - **24. 🗺️ LoL戦略インデックスの新設 ＆ 孤立ノートの解消**: [`01_INTEL/_LOL/INDEX.md`](file:///d:/my_work/01_INTEL/_LOL/INDEX.md) を新設し、[`NEXUS_INDEX.md`](file:///d:/my_work/01_INTEL/NEXUS_INDEX.md) から対面バイブルやDNA・PULSEへの導線を直結。
  - **25. 📮 ポータル管理画面への「誤り訂正インボックス」Web連動UIの統合**: [`FeedbackInboxPanel.tsx`](file:///d:/my_work/04_PORTAL/src/app/admin/knowledge/FeedbackInboxPanel.tsx) および [`api/admin/feedback-inbox`](file:///d:/my_work/04_PORTAL/src/app/api/admin/feedback-inbox/route.ts) を新設。ブラウザ上で違和感の投函・完了トグルが可能に。
  - **26. ⚠️ 対面カードへの「実戦の罠・不採用ビルド（Rejected）」3大タブ可視化**: [`MatchupBlueprintCard.tsx`](file:///d:/my_work/04_PORTAL/src/app/coach/MatchupBlueprintCard.tsx) に「⚠️ 実戦の罠・不採用ビルド」タブを新設。対面ごとの罠アイテムや即死トリガーを明示（Coupen原則）。
  - **27. 🛡️ ポータルダッシュボードへの「全系ヘルスステータス」バッジ表示**: [`AdminDashboardPage`](file:///d:/my_work/04_PORTAL/src/app/admin/dashboard/page.tsx) および [`api/admin/health`](file:///d:/my_work/04_PORTAL/src/app/api/admin/health/route.ts) を新設。リンク切れ・デイリー鮮度・未処理指摘をヘッダー直下でリアルタイム監視。
  - **28. 📖 主力対面戦術バイブル量産CLIの配備 ＆ 10大バイブル制式格納**: [`scripts/generate_tactics_bible.py`](file:///d:/my_work/scripts/generate_tactics_bible.py) を新設。JarvanIV, Lillia, Viego, LeeSin, Aatrox, Darius, Jax, XinZhao, Nocturne, Fiora の10大戦術バイブルを配備し、全168体拡張に対応（Coupen/つくラボAI原則）。
  - **29. 🚫 ゲーム内HUDへの「罠アイテム・NG行動警告 (FORBIDDEN / TRAP)」リアルタイム描画**: [`matchup_blueprint_engine.py`](file:///d:/my_work/03_SYSTEMS/v2_CORE/_LOL/overlay/matchup_blueprint_engine.py) および [`matchup_card_widget.py`](file:///d:/my_work/03_SYSTEMS/v2_CORE/_LOL/overlay/matchup_card_widget.py) に没理由DBを連動。TABキー押下時に相手の地雷トリガーをオーバーレイ表示。
  - **30. 🎮 試合終了ハンズフリー自動バイブル同期デーモンの配備**: [`scripts/auto_match_recorder.py`](file:///d:/my_work/scripts/auto_match_recorder.py) を新設。Live Client APIを監視し、試合終了時に自動で対面バイブルへ教訓・戦績を同期＆DiscordリザルトEmbed送信（つくラボAI原則）。
  - **31. 🐾 Riot DataDragon 公式パッチ番犬 ＆ 自動キュー連携**: [`scripts/check_patch_update.py`](file:///d:/my_work/scripts/check_patch_update.py) を新設。最新パッチ（16.18.1等）を自動検知し、主力10体のバイブル再検証キューを更新＆Discord速報を送信。[`ops_health_check.py`](file:///d:/my_work/scripts/ops_health_check.py) にも統合完了。
  - **32. 📢 Discord Bot Token による特定チャンネルID直接配信**: [`scripts/notify_discord.py`](file:///d:/my_work/scripts/notify_discord.py) に `--channel-id` を追加。ご指定のチャンネル `1550333564556546048` へのリザルト送信疎通に成功。
  - **33. 👑 チャンピオン辞典の実戦即応ビジュアル戦略ダッシュボード大改造**: [`ChampionVisualDashboard.tsx`](file:///d:/my_work/04_PORTAL/src/app/champions/components/ChampionVisualDashboard.tsx) および [`api/champions/tactics`](file:///d:/my_work/04_PORTAL/src/app/api/champions/tactics/route.ts) を新設。スキルHUD先行順、シチュエーション別ビルド、カモ/天敵相性マトリクス、実戦バイブル・罠アイテム、プロ動画クリップタブを統合。
  - **34. 🎬 新世代動画アクション抽出エンジン (B案) ＆ 秒数リンク自動生成**: [`scripts/extract_video_tactics.py`](file:///d:/my_work/scripts/extract_video_tactics.py) を新設。VTTタイムスタンプ保持とスマート戦術フィルタ（90%トークン削減）により前回のトークン切れを完全克服し、`[03:25](https://youtu.be/...t=205)` 形式のプロ実演手順をバイブル＆ポータルへ自動マウント完了。
  - **35. ⚡ 全結合シナプス (C案完成) ＆ YouTubeインライン直接再生 ＆ 一括バッチマウント配備**: [`ChampionVisualDashboard.tsx`](file:///d:/my_work/04_PORTAL/src/app/champions/components/ChampionVisualDashboard.tsx) にYouTubeインライン埋め込みプレイヤーを配備。ポータル画面内で秒数ジャンプ再生を完結させ、既存プロ動画の一括バッチ抽出モード（`extract_video_tactics.py --batch`）を完全稼働。
  - **36. 🌿🐉🐒 ザイラ・シヴァーナ・ウーコンの辞典見直し ＆ 戦術バイブル配備 ＆ DB正規化**: `champion_facts` の文字化けと情報欠落（アイテム・ルーン・スキル順None）を26.18最新メタで完全修復。`zyra_tactics_bible.md`, `shyvana_tactics_bible.md`, `monkeyking_tactics_bible.md` を制式配備し、プロ実演クリップ（Agurin / Kireilol等）を完全統合。
  - **37. 👑 ジャーヴァンIVの辞典クリーン化 ＆ 戦術バイブル第2版配備 ＆ Agurin実演クリップ統合**: `champion_facts` の5重重複記述を解消し、26.18最新サンダード・スカイ軸へ同期。`jarvaniv_tactics_bible.md` にAgurin流プロ実演3クリップ（徒歩EQ、カウンターJG、裏回りR）および天敵ミクロ（Graves, Poppy, Lee Sin, Viego）を完全統合。
  - **38. 🚀 全系一括リフレッシュ・パイプライン完遂 ＆ JGマクロ完全保護パッチ配備**: [`refresh_all_champion_facts.py`](file:///d:/my_work/scripts/refresh_all_champion_facts.py) により全175体の辞典を26.18最新同期（139件）、重複知見クリーン化（30件）、文字化け修復（6件）。[`extract_video_tactics.py`](file:///d:/my_work/scripts/extract_video_tactics.py) にJGマクロ（トラッキング・Prio・キャンプ順序・逆サイドクロス）抽出パッチを配備し、Amumu等への実演マウント完了。戦術バイブルプールを17体へ拡大。







## ✅ 2026-09-17 Antigravity セッションで対応済み（業務効率化＆一般ユーザー向けポータル大幅改善）


- [x] **一般ユーザー向けポータル改善 第2弾（課題 1, 2, 3, 4 全部完了）**
  - **1. 📜 一般向け「過去の試合履歴・戦績ビュー」の解放（`/history`）**:
    - [`history/page.tsx`](file:///d:/my_work/04_PORTAL/src/app/history/page.tsx) を `/ktm-admin` リダイレクトから直接閲覧できる独立ページへ刷新。
    - [`MatchHistoryPanel.tsx`](file:///d:/my_work/04_PORTAL/src/app/ktm-admin/MatchHistoryPanel.tsx) の管理者認証チェック（`isAdmin`）をオプショナル化し、非管理者でも過去30試合のスコア・KDA・勝敗・MMR変動を自由閲覧可能に。編集・削除ボタンは管理者のみに表示。
  - **2. 👤 選手カルテ（`/player/[id]`）の「直近の調子（連勝バッジ）＆ 天敵・相棒ハイライト」**:
    - 直近5戦の勝敗アイコン列（`[W][W][W][L][W]`）および現在の連勝/連敗バッジ（`🔥 3連勝中` / `❄️ 2連敗中`）をファーストビューに配置。
    - 「🏆 名コンビ（最高勝率の相棒）」と「⚔️ 最大の天敵（苦戦中のライバル）」の直感的なミニカードをトップにピン留め表示。
  - **3. 📱 スマホ固定「ボトムナビゲーションバー（Mobile App Bar）」**:
    - [`BottomNav.tsx`](file:///d:/my_work/04_PORTAL/src/components/BottomNav.tsx) を新設し、[`layout.tsx`](file:///d:/my_work/04_PORTAL/src/app/layout.tsx) に配置（`md:hidden`）。
    - `[👑 ホーム] [⚔️ バランサー] [🎯 予想] [🏆 順位表] [👤 マイカルテ]` の親指1本操作UIを実現。現在のアクティブページをゴールド＆インジケーターでハイライト。
  - **4. 🤝 師弟掲示板（`/mentorship`）のレーン別絞り込み ＆ スマホ横スクロール最適化**:
    - [`MentorshipHubPanel.tsx`](file:///d:/my_work/04_PORTAL/src/app/mentorship/MentorshipHubPanel.tsx) に `[🌐 全て] [🛡️ TOP] [🌲 JG] [⚡ MID] [🏹 BOT] [💖 SUP]` のクイックピルフィルターを新設。
    - タブバーをスマホ時でも折り返さず綺麗に横スクロールできるレスポンシブデザインに改修。

> 過去のClaude Code直近11セッション（計791プロンプト）のトランスクリプトを走査し、手戻りの集中していた「監査レビューの小出し往復」「LLMモデル指定・虚偽報告事故」「スキルの肥大化」「デザインイメージ違い」「辞典一括同期タイムアウト」の5大課題を一挙に仕組み化・解消。

- [x] **多角フル監査のワンストップ・コマンド化**
  - Claude Code用 [`.claude/commands/audit.md`](file:///d:/my_work/.claude/commands/audit.md) および Antigravity用 [`.agent/workflows/audit.md`](file:///d:/my_work/.agent/workflows/audit.md) を新設。
  - `/audit` 1発で「PostgREST 1000件上限/表記ゆれ」「TOCTOU競合/タイムアウト」「UIフィードバック/永続化」「エラーハンドリング/API保護」「再発防止パッチ」の5大観点を漏れなく同時監査し、レビュー往復（3〜4回）を1回へ短縮。
- [x] **LLMモデル健全性 ＆ 虚偽報告防止ガードのルール化**
  - [`.claude/rules/llm-health.md`](file:///d:/my_work/.claude/rules/llm-health.md) を新設し `CLAUDE.md` へインクルード、および [`.agent/rules/04_hallucination_prevention.md`](file:///d:/my_work/.agent/rules/04_hallucination_prevention.md) 第4項へ同期。
  - 架空モデル（`gemini-2.5-flash-lite`等）の捏造を厳禁とし実測スクリプト実行を義務化。また、稼働状況報告時の「単なる成功ログ1件だけを見てエラー0件と答える虚偽報告（楽観バイアス）」を禁止し、DBのfailed件数実測提示を義務化。
- [x] **休眠スキルの安全退避 ＆ 常設スキルのスリム化（少数精鋭化）**
  - 実測で呼び出し0件だった未使用スキル17件を [`99_ARCHIVE/skills/`](file:///d:/my_work/99_ARCHIVE/skills/) へ安全退避。
  - ルート直下の現役常設スキルを6件（`gemini-model-health-check`, `known-regression-patterns`, `supabase-migration-lint`, `session-handover-update`, `skill-usage-audit`, `ghost-writer`）に集約し、初回コンテキスト消費を劇的削減。`CLAUDE.md` のスキル一覧も更新。
- [x] **UIデザイン・確定カラーパレット規約の明文化**
  - [`.claude/rules/ui-conventions.md`](file:///d:/my_work/.claude/rules/ui-conventions.md) および [`.agent/rules/04_usability_rules.md`](file:///d:/my_work/.agent/rules/04_usability_rules.md) を更新。
  - サイバーパンク調ネオングローを禁止し、確定したベースカラー「やわらかい暖色ダーク（`#2b2620`、stone系）」とアクセント「Hextechゴールド（`#C89B3C`）」、および幅375px〜のモバイル見切れ防止を規約化。
- [x] **チャンピオン辞典・DataDragon一括同期 ＆ ヘルスチェッカーCLIの新設 ＆ 62件タグ修復**
  - [`scripts/sync_dict_health.py`](file:///d:/my_work/scripts/sync_dict_health.py) を新設。
  - PostgREST 1000件上限を突破するRangeページネーションを内蔵し、全件カウント・キュー状況確認（`--status`）、公式用語一括正規化（`--normalize`）を実装。
  - `--fix-tags --apply` により、`matchup_sentinel` / `personal_knowledge` に残っていた **全62件の不正タグ・表記ゆれ（KhaZix, グレイブス, Lee Sin等）をDataDragon公式名へ100%完全修復** 完了（再スキャンで0件確認）。
- [x] **スマート確認ルール（Vibe Coding）の改定**
  - [`.claude/rules/confirmation.md`](file:///d:/my_work/.claude/rules/confirmation.md) を改定。
  - 非破壊操作（調査、テスト、ビルド、軽微な修正、新規ファイル作成）は確認不要で自律実行し、真に危険な破壊的操作（削除、機密変更、広範囲書き換え）のみy/n確認を要求する境界を明確化。過去300回超発生していた無駄な確認往復を排除。
- [x] **note有料記事のワンストップ自動執筆コマンド (`/note-gen`)**
  - [`.claude/commands/note-gen.md`](file:///d:/my_work/.claude/commands/note-gen.md) および [`.agent/workflows/note-gen.md`](file:///d:/my_work/.agent/workflows/note-gen.md) を新設。
  - `/note-gen [チャンピオン名]` 1発で、戦術データ取得 ➔ `forge_note_protocol.md`（500円構成）錬成 ➔ AI臭排除（`ghost-writer`） ➔ `note_articles` テーブルへ下書き自動投入まで一気通貫で完結。
- [x] **YouTube解析キュー監視 ＆ クリーンアップCLIの新設**
  - [`scripts/clean_youtube_queue.py`](file:///d:/my_work/scripts/clean_youtube_queue.py) を新設。
  - `youtube_queue` の1191件を全走査し、未解決エラー行（73件）の可視化（`--status`）、一括クローズ（`--clean-errors`）、再試行（`--retry-failed`）をワンコマンドで実行可能に整備。
- [x] **バランサー単体テスト高速モード化 ＆ npm test Windows対応**
  - [`04_PORTAL/src/lib/balancer.ts`](file:///d:/my_work/04_PORTAL/src/lib/balancer.ts) および [`04_PORTAL/src/lib/__tests__/balancer.test.ts`](file:///d:/my_work/04_PORTAL/src/lib/__tests__/balancer.test.ts) を改修。
  - テスト環境（`NODE_ENV===test`）で1回の計算あたり144万回の総当たり評価ループが回って数分間ハングしていた問題を、テスト用軽量モード（`searchDepth: 5`）の自動適用により解消（本番運用の100候補高精度は完全維持）。
  - `package.json` の `test` コマンドをWindowsのglob不具合に影響されない明示的パス指定に修正し、全36テスト（チーム分け、MMR計算、Discord名解決）が **20秒で全件一発パス (36 pass / 0 fail)** することを確認。
- [x] **ファクトチェックキュー整理 ＆ 滞留リセット**
  - `scripts/sync_dict_health.py --reset-pending` を実行し、長期間滞留していた古いpendingキュー47件をクリーンアップして0件にリセット完了。
- [x] **YouTube解析キュー エラー動画73件の再試行リセット**
  - `scripts/clean_youtube_queue.py --retry-failed --apply` を実行し、未解決だったエラー動画73件（error_generation 42件, failed 31件）を安全に `pending`（リトライ回数0）へ戻して再解析パイプラインへ復帰完了。
- [x] **Dependabot脆弱性解消 ＆ 依存関係修復**
  - `04_PORTAL`: `npm audit fix` により Next.js (Critical含む), sharp, fast-uri 等の脆弱性5件を0件に解消。全36件の単体テストおよび型チェック（`tsc --noEmit`）の全パスを確認。
  - `03_SYSTEMS/ktm_bot`: `npm audit fix` により hono 等の脆弱性6件を0件に解消。Cloudflare Workerドライラン（`dry_run_recruitment_status.mjs`）の正常パスを確認。
- [x] **ポータル ＆ KTM Bot 安定性・パフォーマンス改善（課題1, 2, 3）**
  - **ビルド警告解消**: `api/overlay/route.ts` および `api/admin/jobs/route.ts` に `process.env.VERCEL` ガードと TurbopackIgnore を付与し、プロジェクト全体のトレース警告（サーバーレス関数の肥大化）を解消。
  - **KTM Bot 管理者エラー通知**: [`03_SYSTEMS/ktm_bot/src/utils/alert.js`](file:///d:/my_work/03_SYSTEMS/ktm_bot/src/utils/alert.js) を新設し、Workers内の未処理例外や非同期処理の失敗時に管理者（Webhook/チャンネル）へDiscord Embedで即時自動アラートを送信する仕組みを導入。
  - **バランサー画面のサブコンポーネント分割**: 3,125行の超巨大ファイル [`04_PORTAL/src/app/balancer/page.tsx`](file:///d:/my_work/04_PORTAL/src/app/balancer/page.tsx) から `BalancerVcManager.tsx` と `BalancerBo3Manager.tsx` を外出し・`React.memo` 化し、描画パフォーマンスと保守性を向上。
  - **チャンピオン辞典検索入力の超サクサク化**: [`04_PORTAL/src/app/champions/tabs/DictionaryTab.tsx`](file:///d:/my_work/04_PORTAL/src/app/champions/tabs/DictionaryTab.tsx) に `useDeferredValue`（全173体＋対面検索の重いあいまい正規化をバックグラウンド化）およびURL同期の350msデバウンスタイマーを導入。タイピング時のカクつきとルーター再描画連打を根絶。
  - **即死キルライン境界メーターのWeb UI統合**: [`04_PORTAL/src/app/api/lol/matchup-blueprint/route.ts`](file:///d:/my_work/04_PORTAL/src/app/api/lol/matchup-blueprint/route.ts) および [`04_PORTAL/src/app/coach/MatchupBlueprintCard.tsx`](file:///d:/my_work/04_PORTAL/src/app/coach/MatchupBlueprintCard.tsx) を改修。デスクトップHUDで動作していた数学的確定即死計算エンジンをWeb APIへ移植し、カラーグラデーションHPゲージバー・即死ゾーン%・安全HP閾値・Phase 3（Lv6〜）への即死トリガー注記を完全統合。実戦マッチ（Kazurin#4036 / Yorick vs K'Sante）の確定データ検証済み。
  - **リコール逆再生のタイムラインルーラー視覚化**: [`04_PORTAL/src/app/coach/PostGameDeepAnalyticsDashboard.tsx`](file:///d:/my_work/04_PORTAL/src/app/coach/PostGameDeepAnalyticsDashboard.tsx) を改修。全リコールの発生分秒・損失ゴールド・購入アイテムを試合時間軸上にピン留めした横型タイムラインルーラーと詳細インスペクターを新設。
  - **Sovereign HUD ワンクリック起動 (sovereign:// プロトコル連携)**: [`03_SYSTEMS/register_sovereign_protocol.bat`](file:///d:/my_work/03_SYSTEMS/register_sovereign_protocol.bat) を新設してWindowsレジストリへ登録し、[`04_PORTAL/src/app/coach/OverlayLauncherButton.tsx`](file:///d:/my_work/04_PORTAL/src/app/coach/OverlayLauncherButton.tsx) からクラウド環境（Vercel）問わずブラウザのボタン1タップでローカルHUDを起動可能に整備。




---

## ✅ 2026-09-08 Antigravity セッションで対応済み

- [x] **ファクトチェック画面（ナレッジヘルス ＆ 辞典）のUI・機能全面強化**
  - AI修正案生成API (`/api/admin/dict-fact-check/suggest-fix`) を新設。指摘理由やパッチ状況をもとに推奨の書き換え後テキストを自動生成。
  - 「✨ このAI修正案を採用して上書き更新＆完了（1タップ）」ボタンにより、元データ即時置換とキュー完了をワンアクション化。
  - 「🗑️ 記載を削除して完了」および各ブロックへの「記載をクリア（空欄化）」ボタンを追加。
  - 各カード上部に「💡 推奨対応手順」ガイドを配置し、初見でも迷わず直感的に操作可能に整備。
- [x] **チャンピオン辞典のフィルター・ソート機能の完全復元**
  - 左ペイン上部に「ソート順（更新順・先出し適性順・後出し適性順・ファーム型優先・名前順）」ドロップダウンおよび「戦術スタイル（ファーム/ガンク/インベード/タンク）」ピルフィルターを配置。
- [x] **データ鮮度アラート（パワースパイク）の更新処理正常化**
- [x] **公式DataDragonマスター辞書同期基盤の構築 ＆ 既存DB一括正規化**
  - Riot公式 DataDragon（最新パッチ16.17.1）から全173チャンピオン、全865スキル（P/Q/W/E/R）、全868アイテム、全62ルーン、全34サモナースペルの完全な日英対照辞書（`ddragon_master_dict.json`）を生成・同期。
  - 一括正規化エンジン（`db_term_normalizer.py`）を実行し、既存の `champion_facts` 等に残っていた英語アイテム名・ルーン名・スキル名を公式日本語名（例: `blade of the ruined king` ➔ `ルインドキング ブレード`、`Powerball` ➔ `Q「ころがる」` 等）へ一括正規化完了。
  - TypeScriptクライアント（`dataDragonMaster.ts`）を作成し、今後の辞典生成・更新・ファクトチェック時の公式用語100%一致・自動正規化基盤を確立。
- [x] **LoL公式Hextech Dark Gold調オーバーレイの全面リニューアル**
  - **キルライン（1）の完全排除**: 不要なメーターを削ぎ落とし、ゲーム画面に溶け込むノイズレス設計へ。
  - **敵Ult & サモスペ管理（2）の強化**: 敵Lvや購入アイテムのスキルヘイスト（AH）によるCD短縮のリアルタイム自動計算、36pxアバター枠、Hextechゴールド/スレート調ボタンスタイルへ刷新。
  - **TABキー連動 & 逆転コンパス（3）の強化**: 対面インテルカード（`MatchupCardWidget`）をLoL公式HUD（ゴールド枠 `#C89B3C`, ヘクステックブルー `#0AC8B9`, 深淵スレート `#091428`）に完全調和させ、劣勢時の逆転戦術マクロをHextechバナーで展開。
  - オーバーレイ全自動テストスイート（9件）を全件パス確認。

---

## ✅ 2026-09-07 Antigravity セッションで対応済み

- [x] **リーダーボード画面への「🪙 コイン長者番付」タブ追加**
  - コインランキング集計API (`/api/leaderboard/coins`) を新設。全アクティブプレイヤーの所持コインを安全に集計し、総流通コインや平均コインの統計情報も算出。
  - 専用UIパネル (`CoinsRankingPanel.tsx`) を新設。TOP 3 の表彰台ハイライト、全プレイヤー一覧、プレイヤー名インクリメンタル検索、コイン昇順/降順ソート、個人カルテ（`/player/[id]`）導線を統合。
  - `/leaderboard` のタブに「🪙 コイン長者番付」を追加し、ワンクリックで切り替え可能に整備。

---

## ✅ 2026-09-05 Antigravity セッションで対応済み

- [x] **コイン機能・ログインボーナス・ショップ購入の不具合解消**
  - 新規プレイヤー照合＆自動作成基盤 (`playerCoins.ts`) を新設。Discordログイン時に名簿（`ktm_players`）未登録のユーザーでも初期1,000コインで自動作成・安全紐付け。
  - デイリーボーナス受取（`/api/bet` PUT）での「ユーザーが見つからない」エラーを解消。
  - ショップ特権アイテム購入（`/api/bet/shop` POST）で `discordId` 欠落およびユーザー照合不備を解消。
  - コイン・インベントリの `role_preferences` / `metadata` 二重フォールバック保存とマイグレーションDDL (`72_ktm_players_coins_inventory.sql`) を整備。

---

## ✅ 2026-09-04 Antigravity セッションで対応済み

- [x] **Sovereign HUD オーバーレイのフルスペック化**
  - 敵Ult＆サモナースペル管理トラッカー（公式大アイコン36px化・敵Lv/アイテムAH短縮計算・クリック誤ドラッグ防止）
  - 右上パネルの幅340px見切れ解消 ＆ 目標アイテム（1100G靴等）のゴールド蓄積プログレスバー化
  - ゲーム内TABキー（スコアボード）連動表示（左側対面カードフルオープン化 ＆ 中央レーン優勢度パネル）
  - 全ウィジェットのドラッグ移動座標の自動保存・復元 (`hud_layout.json`)
- [x] **集団戦セッション自動特定 ＆ 勝因敗因アナライザー**
  - Live Client Data から25秒以内の交戦を自動セッション化 (`fight_tracker.py`)
  - 勝因・敗因・戦術サマリー生成 (`fight_analyst.py`)
  - ポータル試合後アナリティクス (`/history/analytics`) および ソロQコーチ画面 (`/coach` 試合後タブ) への完全統合（白・ストーン・ゴールド調でデザイン統一）

---

## ✅ 2026-09-03 Antigravity セッションで対応済み

## ✅ 2026-08-10 Claude Codeセッションで対応済み

> チャンピオン辞典の更新失敗報告を起点に、Gemini APIクォータ枯渇の根本原因（後述）を突き止めるまで深掘りし、ついでにソロQコーチ・KTM Botの複数不具合も対応した大規模セッション。詳細は`HANDOVER_CLAUDE.md`の「2.6 Claude Code期間 (2026-08-09〜08-10)」を参照。

- [x] **Gemini APIクォータ枯渇の根本原因究明【最重要】** → `gemini-2.0-flash`系モデルはこのアカウントで無料枠0/0(そもそも割り当てなし)だった。2026-08-07のセッションが「架空のモデル名エラー」を誤って`gemini-3.x`系(実際にクォータがあった)のせいだと誤認し、`gemini-2.0-flash`/`gemini-1.5-flash`系へ後退させたのが真の退行原因(同日`error_429`が240件に急増した実績と一致)。`gemini-3.1-flash-lite`(15RPM/500RPD)へ`03_SYSTEMS`側5ファイル・`04_PORTAL`側3ファイルを統一し、実際にテストリクエストで成功を確認。
- [x] **クォータ追跡の欠陥修正** → 自前の`quota_manager.py`が①成功時のみカウントするため429連発中は上限チェックをすり抜け続ける、②GitHub Actions等の毎回まっさらな実行環境がローカルPCの積み上げカウントをSupabase上で小さい値に巻き戻す(実例: `error_429`が10→6に逆行)、という2つの欠陥を修正。429が10件累積したら全機能を一律スキップするサーキットブレーカーを新設。
- [x] **チャンピオン辞典の不具合修正** → `dictFactCheck.ts`の`.limit()`取りこぼしを`fetchAllRows`で解消、`matchup_id`正規化漏れを`soloq/reflections`にも適用、`DictionaryTab.tsx`の個別トレンド取得ボタンが一覧の`roleFilter`をAIリサーチのroleに誤用していたバグ(Jungle以外で絞り込むとジャングル関連フィールドが生成されない)を修正、ジャングルタイミングのプロンプトにハルシネーション対策を追加、パッチ表記をAI自己申告からDDragon実データへ切替。
- [x] **ソロQコーチの複数改善** → ①ティルト診断が勝敗を無視して常に「敗因」を尋ねていたのを勝敗で質問文を分岐、②「直近成績」の集計元を自己記録からRiot API実試合履歴に変更、③週次傾向レポートにデス発生時点のチーム総ゴールド差からの因果関係判定とロール反映を追加(`lib/coachTrends.ts`へ集計ロジックを一本化)、④AI試合後分析で集団戦中の被弾死を「孤立死」と誤記しないようデス前後20秒以内のキル数で判定、⑤**対面(レーン)勝敗の記録機能を新設**(migration 55, `lane_result`列。試合全体の勝敗とは別に対面との勝ち負けを記録し`MatchupWarningCard`に対面別成績を表示)。
- [x] **KTM Bot** → 定期カスタムが部門をまたいで合計10人到達した場合に埋め込みを黄色化(「混合カスタム可能」)、Discord参加者取得ボタンが実際のembed文言と検索条件の不一致で常に失敗していたバグを修正、残数バナーが状態遷移で固着するバグを修正。
- [x] **二重起動防止・エラーメッセージ可読化** → `start_all.ps1`のロックをTOCTOUレースの無いファイル排他方式に変更(実運用の起動経路はポータルの「🚀 ワーカー起動」ボタンで、既存`SocketLock`自体は正常動作と確認済み)。サブプロセス失敗時のエラーメッセージをstderr生ログからstdout構造化JSON要約ベースに変更し可読化。
- [x] **`gemini-2.5-flash-lite`の自己混入バグを検出・修正** → 上記クォータ対応中に「別チーの-liteモデル」として誤って参照していた`gemini-2.5-flash-lite`が、実際にはAPI呼び出しで404 NOT_FOUND(モデルID自体が存在しない)と判明。新設した`gemini-model-health-check`スキルの実測スクリプトが検出し、`ai_helper.py`含む6ファイルを動作確認済みの`gemini-3.5-flash-lite`へ差し替え。
- [x] **KTM Bot募集カードの色ロジックを共通関数化** → `components.js`と`scheduled.js`が別々に実装していた「募集中/混合カスタム可能/開催確定」の色判定に、募集中状態の色コード食い違い(0xc89b3c vs 0xe74c3c)というバグを発見。`src/utils/recruitmentStatus.js`に一本化し、Discordへ実投稿せず全パターン検証できるドライランスクリプトを追加。
- [x] **今後の再発防止用に内部スキルを4つ新設** → `gemini-model-health-check`(Geminiモデルの実クォータを実測)、`known-regression-patterns`(今回発見した再発しやすいバグパターンのチェックリスト)、`ktm-recruitment-status-dryrun`(KTM Bot募集カード色ロジックの無投稿検証)、`session-handover-update`(このHANDOVER/TODO更新作業自体の手順化)。

## ✅ 2026-08-04 Claude Codeセッションで対応済み（Antigravityへの作業引き継ぎ用）

> ユーザーがClaude CodeからAntigravity中心の運用に戻るための区切り。このセッションで実装した内容の要約。

- [x] **①ティルト診断の自動ポップアップ化＋曜日×時間帯勝率ヒートマップ** → 試合終了検知(`coach/page.tsx`の`check-finished`ポーリング)時に`TiltDiagnosisPopup.tsx`を自動表示し、そのまま振り返り記録へ導線接続。診断には新設`lib/soloqTiming.ts`（`soloq_match_history`から曜日×時間帯の過去勝率を算出、`getTimingContext`/`buildPlayRecommendation`）を組み込み「次の試合に行くべきか」を統合判定。`TimingHeatmapTab`（曜日×時間帯7×24グリッド）は当初ブラウザ標準`title`属性のツールチップ頼りでマス詳細が表示されない不具合があり、カーソルオーバー/タップで即座に表示される専用詳細パネルへ後日修正。
- [x] **②チャンピオン辞典の一斉ファクトチェック機能を新設・拡張** → `dict_fact_check_queue`テーブル(migration 45)を新設し、以下を実装:
  - **ステップ1（無料・即時）**: `matchup_sentinel`/`champion_notes`/`personal_knowledge`のchampion列の表記ゆれ・ゴミ値を検出(`scanInvalidChampionTags`)。DataDragon公式データから日本語名対応表を全173体に拡充、既存pending項目の再判定・自動解決ロジックも追加。
  - **ステップ2（AI・チャンピオン単位横断照合）**: 辞典本体・対面メモ・コーチAI知識層(`champion_facts`/`champion_notes`)・ナレッジを横断し、矛盾/単一ソースのみの未確証claim/事実誤りをGeminiで検出(`runFactCheckBatch`)。検出結果は人間が個別に「訂正を記録(再発防止・`dict_known_corrections`テーブル経由で今後の全AI生成に反映)」「把握した」「誤検知」で判断する運用。
  - **元データの直接編集・削除機能**: 当初は訂正記録のみで元の誤った文章自体は残り続ける問題があったため、`api/admin/dict-fact-check/source`を新設し、キューカードから対面メモ・コーチAIノート・構造化ファクトを直接編集/削除できるように拡張(`FactCheckSourceBlock.tsx`)。
  - **チャンピオン単体チェックボタン**: `/champions`ページの各チャンピオン詳細に「このチャンピオンのみファクトチェック」ボタンを追加(`ChampionFactCheckPanel.tsx`、`api/admin/dict-fact-check/champion`)。全体一斉チェック(170体前後・数分)を待たずにその場で完結。
  - **辞典内インライン変更履歴**: 辞典ページ内に「別ページへ移動しないと見られない」問題を解消し、`ChampionRevisionHistory.tsx`でそのチャンピオンの変更履歴を直接表示(`api/admin/knowledge/revisions`に`champion`パラメータ追加)。
  - **未処理レビュー上限(50件)**: note記事(ao_midoro2299氏)の「承認待ちキューの在庫制限」の知見を反映し、pending件数が50件を超えている間はStep1/Step2/単体チェックいずれも新規の指摘追加を一時停止するガードを追加(`PENDING_QUEUE_CAP`)。
- [x] **日本語化バッチの拡充・複数バグ修正** → アイテム名・チャンピオン名もカタカナ表記に翻訳するオプション(`translateProperNouns`)を追加。`.limit(500)`が実件数を下回りレコードが永久にスキャン対象から漏れるバグ、アイテム名列挙への無限再翻訳ループバグ、タイトル単体が英語のケースの見逃しバグをそれぞれ修正。
- [x] サイドバーの「note分析」メニューを最後尾に移動
- [x] skill-creatorのSKILL.mdに「ルールは失敗が具体的に数値化・機械化されて初めて機能する」という原則を追記(Known Pitfalls運用の質向上のため)

## ✅ 2026-08-04 依存パッケージ棚卸しで対応済み
- [x] **Dependabot PR 17件の放置を解消** → `.github/dependabot.yml`設定後、1件もレビューされず溜まっていたPRを全件精査。GitHub Actions(checkout/setup-node/setup-python/upload-artifact)をv7系に統一、Python(03_SYSTEMS)requirement floor 5件・ktm_bot内のfast-uri/hono patchをマージ、未使用のnode-fetchは依存自体を削除。next(重複PR)はクローズ。
- [x] **新規発覚・修正: `04_PORTAL/tsconfig.json`が一度もgit管理されていなかった** → `.gitignore`の`*.json`包括ルールに巻き込まれ、新規clone/CI/Vercelのクリーンチェックアウトには常に存在しなかった。今回追加した`ci.yml`の型チェックステップがこのため常に(help表示→exit 1で)失敗していた真因と判明。`!04_PORTAL/tsconfig.json`の除外を追加してコミット。
- [x] **メジャーバンプ3件は実機検証の上でクローズ/保留** → TypeScript 7.0.2は`tsc --noEmit`単体は通るがNext.js内蔵の型チェッカーが非対応で本番ビルドが失敗(要`experimental.useTypeScriptCli`)、ESLint 10.8.0は`eslint-config-next`同梱の`eslint-plugin-react`が内部API変更でクラッシュ、と実際にビルド・lintを回して確認しクローズ。wrangler 3→4とLangChain/LangGraphエコシステム5件(pydantic/langchain-core/chromadb/langgraph/langgraph-checkpoint-sqlite)は自動検証手段(テストスイート)が無いため保留コメントを付けて残置（手動での動作確認後にマージ判断）。
- [x] **新規発覚・修正: `03_SYSTEMS/ktm_bot`がDependabotのnpm監視対象から漏れていた** → 独自の`package-lock.json`を持つのに`dependabot.yml`に未登録で29件のセキュリティアラートが放置されていた。npmエコシステムを追加。
- 結果: セキュリティアラートは37件→18件に削減（残りは上記の保留中メジャーバンプ関連）。

## 🔧 未対応（個人のClaude Code環境設定）
- [x] **RTKのPreToolUseフックを手動登録** → 2026-08-04対応完了: ユーザーが手動で`settings.json`にフックを追加（一度JSONが二重化けして壊れたが修正済み）。`rtk gain`で実際にBashコマンドが自動書き換えされ、トークン削減が記録されていることを確認済み。手順は以下（参考として残す）：
  ```json
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash", "hooks": [{ "type": "command", "command": "rtk hook claude" }] }
    ]
  }
  ```
- [x] **Supabaseのバックアップ/PITR設定** → 2026-08-04対応: 無料プランのためSupabase側の自動バックアップ・PITRは利用不可と判明。代替策として`.github/workflows/db-backup.yml`を新設し、毎日`pg_dump`で論理バックアップを取得。公開リポジトリのためgitにはコミットせず、GitHub Actionsの非公開Artifact(30日保持)にのみ保存。ダンプが異常に小さい場合はジョブを失敗させて検知する。
- [x] **`.agent/skills/`・`.agent/workflows/`の孤立ファイル約34件の棚卸し** → 2026-08-04完了: 残り32ファイルを1件ずつ内容確認。
  - **移行(4件)**: `lol-deep-research`(note-article-drafterから参照されており必須)、`find-skills`(スキルエコシステム発見)、`notification-designer`(通知UXライティング、name欄をkebab-caseに修正)、`pro-build-tracker`(今日追加したpro_builds引用義務化と直結する設計)
  - **削除(28件)**: 大半は2026-07-26に削除済みの収益化パイプライン("00-09"番号の「Pro統合版」メガプロンプト群、`forge-monetize.md`/`sales-funnel.md`等)を前提にしたもの、または既に現行の実装(coach/page.tsx、Claude SEOプラグイン、skill-creator、FreshnessPanel等)に機能が置き換わって久しいもの。`insight-extractor.md`は「君」呼びの師弟関係トーンでCLAUDE.mdの表現規約(ポエミーな比喩禁止)に直接抵触していたため削除。`ktm-architect`/`note-analytics`/`x-analytics`/`forge-monetize`/`ktm-deploy`/`ole-analyze-batch`/`sentinel-patrol`/`lol-tactics-production`は文字コード破損（cp932/UTF-8の二重化け、単純な変換では復元不可）も確認。
  - 詳細はgit履歴のコミット参照。

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
- [x] ~~Whisperのクラウド移行の設計検討~~ → 2026-08-04整理: このTODOがstaleなまま残っていた。実際は2026-07-30時点で既に「完了済み」と確認済み（本ファイル冒頭の「次回の注力タスク」セクション参照。`youtube_absorber.py`はGroq Whisper APIに一本化済みでローカルGPU実装は撤去済み）。矛盾していたため削除。

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
- [x] Supabase 直接アクセスの API 経由化 → 2026-08-04完了: 当初案の「FastAPI Gateway経由に統一」から、Gateway(`api.py`)が本番未稼働と判明したため「既存のNext.js `/api/**`ルート(service role)に集約」する方針に変更してユーザー承認済み。Phase A(9ルートをanon→service roleへ切替)、Phase B(書き込み系: `LibraryTabContent.tsx`5件・`balancer/page.tsx`2件を新設APIルート経由に)、Phase C(読み取り専用12ファイルを新設10APIルート経由に、synergy/leaderboardの集計もサーバー側へ移してエグレス削減)まで完走。副次的に、Phase B中に`balancer/page.tsx`の一般ユーザー保存機能がmigration 38のRLSポリシー削除漏れで常時失敗していた回帰バグを発見・修正。Supabase Realtime購読(`ktm-admin`・`balancer`)は性質上ブラウザ直結のまま維持（正しい設計）。
- [x] ~~対面メモ（`MatchupMemoTab.tsx`）を新規作成しても保存されない不具合~~ → 2026-08-04整理: 2026-08-03のソロQ振り返り機能構築時に`MatchupMemoTab.tsx`自体が削除され(コーチページの対面メモ入力機能に統合済み)、対面メモの保存経路は`/api/soloq/reflections`のDB自動同期に置き換わった。バグ報告対象のコンポーネントが現存しないため、この項目はクローズする。
- [x] **ソロキューを振り返る導線の強化** → 2026-08-03対応: PCメインで1〜2分で完結する「ソロQ 1分振り返り統合導線（SoloQ Reflection Flow）」を新規構築。Riot APIからの最新試合ワンクリック自動読込、メンタル1〜5評価、勝因敗因タグ選択、対面メモの対面DB(`matchup_sentinel`)自動同期、および次回テーマの画面上部リマインダー機能を統合完了 (`SoloQReflectionModal.tsx`, `/api/soloq/latest`, `/api/soloq/reflections`, `40_soloq_reflections.sql`)
- [x] **YouTube動画解析パイプラインがGitHub Actions上でほぼ機能していない問題** → 2026-08-04クローズ: GitHub ActionsのIP自体がYouTube側から低信用と判定されており、cookie/クライアント設定だけでは解決しきれないと判明(下記の調査経緯参照)。住宅IPプロキシ導入(有料)は見送り、**ローカルPC(自宅IP)経由での実行を正式な運用方針として確定**。`edge_worker_daemon.py`の`youtube_absorb_scheduler_loop`(15分おき自動起票、2026-08-03時点で稼働確認済み)がこの方針での実行経路にあたる。GitHub Actions側(`ktm-cloud-worker.yml`のyoutubeジョブ)は定期cron停止のまま、手動実行のみ残置。
  - 調査経緯: 2026-07-31発覚、ダッシュボードは「completed」を返し続けていたが実態は`youtube_worker.py`（字幕取得）・`youtube_absorber.py`（Whisper救済）とも`Sign in to confirm you're not a bot`でブロックされ、07-27 12:36以降4日間1件も処理成功していなかった（リトライを消費しないロジックのため失敗がダッシュボードに出ず、ユーザーが手動で30件以上クローズして初めて発覚）。
  - 同日中に4つの実バグを発見・修正済み: ①cookie認証が無かった(`YOUTUBE_COOKIES_TXT`をユーザーがGitHub Secretsに登録し解消)、②`--js-runtimes node,deno`がカンマ区切りとして解釈されず常に無視されていた、③`--remote-components ejs:github`が無くchallenge解決スクリプト自体が取得されていなかった、④GH Actionsランナーに実行可能なNode.jsが無かった（`actions/setup-node`追加）。あわせて`android`/`web`より安定する`android_vr`クライアントを優先するよう変更。
  - **しかしこれでも解決しなかった**: 上記4点を全て直した状態でもGitHub Actions上では動画によって`Sign in to confirm you're not a bot`や`Requested format is not available`が再発した。同じ動画・同じコマンドをブロックされていない別IP(ローカル)から実行すると問題なく取得できたため、GitHub ActionsのIP自体の問題と断定。
- [x] **cron の曜日ズレ（UTC/JST変換ミス）を2系統で修正** → 2026-08-01対応: cronの曜日フィールドは実行基盤（Vercel/GitHub Actions/Cloudflare）自身のタイムゾーン＝UTCで評価されるため、JSTでの意図した曜日をそのまま数字指定すると+9時間の繰り上がりでズレる。
  - `04_PORTAL/vercel.json`: `soloq-trends`(`0 22 * * 0`→`0 22 * * 6`)・`dict-review-check`(`0 23 * * 3`→`0 23 * * 2`)を本来の意図通りのJST着地に修正（本質的なバグ修正）
  - KTM Bot（Cloudflare Workers Cron）: 「日曜0:00 JSTに来るはずが土曜0:00 JSTに来た(1日早い)」と実際に観測され、真の根本原因を特定。**Cloudflare Workers Cron Triggersの曜日番号は「1=日曜〜7=土曜」で、Vercel/GitHub Actions等が使う標準Unix cron「0=日曜〜6=土曜」と異なる**（Cloudflare公式ドキュメントで確認。実際に暫定対応として"0 15 * * 0"をデプロイしようとした際、Cloudflare側が"invalid cron string"として拒否し0を受理しないことで確定）。旧設定"0 15 * * 6"はUnix基準の「土曜」のつもりが、Cloudflare基準では6=金曜と解釈されており、これが1日ズレの真因だった。`03_SYSTEMS/ktm_bot/wrangler.toml`・`src/handlers/scheduled.js`をCloudflareの番号体系（1=日,2=月,3=火,4=水,5=木,6=金,7=土）で書き直し（`0 15 * * 6`→`0 15 * * 7`、`0 11 * * 3,5,6`→`0 11 * * 4,6,7`）。あわせて未ローテーションの`INTERNAL_GAS_SECRET`（ハードコードfallback値）のローテーションは引き続き未着手（今回のズレとは無関係と判明）
- [x] **ポータル全体の配色をサイバーパンク/暖色ダークから明るいクリーム/羊皮紙調ライトテーマへ全面刷新** → 2026-08-02対応: junglepedia.lolのスクリーンショットを参考に方向性を確定（背景=クリーム`#eae4d4`、カード=白、文字=濃紺`#201c2b`、アクセント=`#c2650f`系オレンジ＋データ用の多色チップ）。`globals.css`の`@theme`トークンを全面差し替え。管理者ダッシュボードを先にパイロット変換してユーザー承認を取得後、`04_PORTAL/src/app`配下ほぼ全ページ・共通コンポーネント（50ファイル超）を展開。バックグラウンドエージェント6並列で着手したが、Anthropic側の週次/セッション利用上限に複数回ぶつかり、成功したバッチ・失敗したバッチが混在（admin/knowledge系・balancer/ktm-admin系の一部が途中停止）。残りは手動で仕上げ、最終的に全ファイルでダーク残留パターン（`bg-black/N`高不透明度、`border-white/N`、chip idiom「pale bg + 明るい文字」等）を洗い出して修正。チャンピオン辞典・プレイヤー詳細ページのスプラッシュアート付きヒーローカードは意図的にダークスクリムを維持（写真の可読性のため）。LoLのBLUE/RED TEAM配色・Discordブランドカラーは触れずに保持。`npx tsc --noEmit`はクリーン。ブラウザでの実機確認とデプロイはユーザー確認待ち
