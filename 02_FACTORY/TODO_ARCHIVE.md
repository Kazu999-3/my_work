# 📦 Sovereign OS 業務ダッシュボード・過去ログアーカイブ (TODO_ARCHIVE)

本ファイルは `02_FACTORY/TODO.md` に溜まり続けていた完了済みセッションログを、AIエージェントのセッション開始時コンテキスト消費を抑えるために退避した保管庫です。`TODO.md` 本体は自動読込対象のため進行中タスクのみに絞り、完了済みの詳細経緯はこちらに残しています（2026-09-21実施）。

内容はTODO.mdからの単純な移動であり、情報は一切削除・要約していません。

---

## ✅ 2026-10-06 Claude Codeセッションで対応済み（試合後コーチ画面の見直し・データ消失経路の封鎖）

詳細は `HANDOVER_CLAUDE.md` §2.13。
- [x] 試合後の詳細分析・集団戦レビューから実データを見ていない固定値・定型文を削除し、対面との実測比較に作り直し（`981064a4`）
- [x] 「詳細分析」「テンポ」「振り返りノート」を「📈 試合後」1タブに統合（`ca38b558` `c963abdb`）
- [x] 目標との比較を目標ランクの実測平均に変更。migration 88・毎日収集ワークフロー追加、初回70件（`99ff6e54`）
- [x] 05振り返りの対面メモ同期が毎回失敗していた不具合を修正、追記処理を `lib/matchupMemo.ts` に共通化（`c963abdb`）
- [x] 04記事統合が対面メモを上書きしていた問題を追記方式に修正。`Shyvana_vs_Kayn` の消えたメモを復元（`5ae9f585`）
- [x] 05本番に `GEMINI_API_KEY` を登録・再デプロイ。AIマージ失敗をエラーとして表示（`58e14a53`）
- [x] 試合後タブの Riot API 消費削減（メモリキャッシュ）と429の理由表示、`/api/lol/match-fights` を統合して削除（`7fa357cf`）
- [x] レーンガイド統合でAI抽出失敗時に記事全文を貼り付けないよう修正。全9節を点検し5節を再抽出・見出し階層を統一（`5fab7763`）
- [x] 攻略ライブラリに削除（論理削除）と元に戻すを追加。削除済み643件が一覧に出ていた不具合を修正（`1a92acf1`）
- [x] 運用ダッシュボードの「要対応」に ?si= 付きURLのチャンネル登録失敗が残り続ける問題を修正（`4d2a153e`）
- [x] 選択試合のAI自動振り返りを試合後タブに表示（`c0f4cc60`）
- [x] 「エラーを全件再試行」から字幕・Whisperとも失敗した動画を除外。10/03に戻された16件はクローズ（`a688842f`）
- [x] チャンピオン辞典データ再生成（`a16fef27`）

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
  - **25. 📮 ポータル管理画面への「誤り訂正インボックス」Web連動UIの統合**: `FeedbackInboxPanel.tsx` および `api/admin/feedback-inbox` を新設。ブラウザ上で違和感の投函・完了トグルが可能に（※後続セッションで棚卸し・再編済み）。
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
    - `BottomNav.tsx` を新設し、[`layout.tsx`](file:///d:/my_work/04_PORTAL/src/app/layout.tsx) に配置（`md:hidden`）。
      ※ `BottomNav.tsx` は **2026-09-22 に削除済み**（どこからも import されておらず、同等のスマホ用
      ボトムナビが `Sidebar.tsx` に実装されていたため）。当時の記録として文面は残すが、
      ファイルが存在しないためリンクは外してある。
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

## ✅ 2026-09-07 Antigravity セッションで対応済み

- [x] **リーダーボード画面への「🪙 コイン長者番付」タブ追加**
  - コインランキング集計API (`/api/leaderboard/coins`) を新設。全アクティブプレイヤーの所持コインを安全に集計し、総流通コインや平均コインの統計情報も算出。
  - 専用UIパネル (`CoinsRankingPanel.tsx`) を新設。TOP 3 の表彰台ハイライト、全プレイヤー一覧、プレイヤー名インクリメンタル検索、コイン昇順/降順ソート、個人カルテ（`/player/[id]`）導線を統合。
  - `/leaderboard` のタブに「🪙 コイン長者番付」を追加し、ワンクリックで切り替え可能に整備。

## ✅ 2026-09-05 Antigravity セッションで対応済み

- [x] **コイン機能・ログインボーナス・ショップ購入の不具合解消**
  - 新規プレイヤー照合＆自動作成基盤 (`playerCoins.ts`) を新設。Discordログイン時に名簿（`ktm_players`）未登録のユーザーでも初期1,000コインで自動作成・安全紐付け。
  - デイリーボーナス受取（`/api/bet` PUT）での「ユーザーが見つからない」エラーを解消。
  - ショップ特権アイテム購入（`/api/bet/shop` POST）で `discordId` 欠落およびユーザー照合不備を解消。
  - コイン・インベントリの `role_preferences` / `metadata` 二重フォールバック保存とマイグレーションDDL (`72_ktm_players_coins_inventory.sql`) を整備。

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

## 🔧 個人のClaude Code環境設定（全て対応済み）
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
  - **注意（2026-09-21更新）**: この棚卸し後、2026-09-18セッションで`.agent/skills/knowledge-drill`・`.agent/skills/recall-decision`・`.agent/workflows/audit.md`・`note-gen.md`・`weekly-review.md`・`wrap-up.md`が新設され現存している。CLAUDE.mdの「.agent配下は削除済み」という記述はこの時点で更新済み。

## 📅 次回の注力タスク（2026-07-29 実行予定、全件対応済み）
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

## 🚧 技術的負債バックログ（全件対応済み・履歴として保存）
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


---

# 📦 2026-10-04 退避分（TODO.md 2,911行の全文をそのまま移動）

> 2026-10-04 のセッションで TODO.md が2,911行・257KBまで膨らみ、自動読込の上限を超えたため全文を退避した。
> 未完了の項目は新しい TODO.md に重複を統合して引き継ぎ済み。経緯の詳細はこの下の原文を参照。

## （旧TODO.md 原文ここから）

本ファイルは、日々の作業タスクを管理するためのダッシュボードです。
会話開始時に AI が自動的にこのファイルを読み込み、文脈を復元して本日のタスクに直ちに追従します。

> 📦 **過去の完了済みセッションログは [`TODO_ARCHIVE.md`](file:///d:/my_work/02_FACTORY/TODO_ARCHIVE.md) に退避済み**（2026-09-21実施、AIコンテキスト消費削減のため）。本体には進行中タスクと直近の完了ログのみ残しています。詳細な実装経緯や「なぜそうしたか」を確認したい場合はアーカイブを参照してください。

---

## 🚀 【進行中】 The Sovereign Victory Loop (完全勝利サイクル開発)

> **最上位誓約**: 
> 1. 「プレイ前 ➔ プレイ中 ➔ プレイ後 ➔ ナレッジ蓄積」の完全循環ループを維持。
> 2. 不確定情報（AI推測・でっち上げ）は100%排除。Riot公式 Live Client Data / DataDragon / 確定実戦データのみを使用。

### 📋 【ロードマップ・今後着手タスク】
- [x] **【候補1】インゲームHUD（Sovereign HUD）連動強化**（2026-10-02 完了）:
  - Python (PyQt6) 透過オーバーレイ（`03_SYSTEMS/v2_CORE/_LOL/overlay/`）と、`05_PILOT` のSSoT辞書（`champions_detail_map.json`）を0ms直結。
  - 手書き6体分だったブループリント・対面メモを全173体DDragon+Supabase事実データから動的供給。通信ラグゼロ化。
  - `early_pathing_engine.py` を新設し、敵JGの最速クリアタイム実測値（`fastestClearSec`）に基づく動的ガンク危険帯判定（Lv3急襲警戒など）およびJG視点のスカトル勝負・回避ルート予測（STEP 1〜3）をHUD・トースト通知に完全統合。
  - テストスイート20件全PASS確認済み。
- [x] **【候補2】試合後ディープアナリティクスの深化**（2026-10-02 実装・`/coach?tab=tempo`）:
  - `05_PILOT/src/app/coach` 内に、15分序盤のウェーブ＆リコールテンポロス逆再生機能を追加。
  - 重傷・靴購入タイミングの正否判定（ビルド分岐監査: Build Audit）の実装。
  - 実装: `lib/postgameTempo.ts`（純粋関数）／`api/coach/postgame-tempo`／`coach/PostGameTempoTab.tsx`。
    旧ポータル版はリコール評価・ビルド評価が固定値/勝敗ベースだったため流用せず、タイムライン実測値のみで算出。
  - 重傷アイテム・靴はIDを手書きせずDDragonの説明文("Wounds")と`Boots`タグで判定。靴の属性判定は購入時点の敵ダメージ内訳を使う（後知恵防止）。
  - ⚠️ 限界: Riot APIに帰還イベントが無いため「購入のまとまり＝帰還」。何も買わない帰還は検出不可。判定しきい値は全て目安（ファイル冒頭の定数）。
  - 実データ3試合で検証時に「味方の重傷購入が31分でもOK判定」のバグを発見・修正（チーム最初の購入時刻で判定）。
- [ ] **【候補3】note記事・戦術発信パイプライン（Sovereign ADO Engine）の再起動**（※保留中: ストック224本充填済み、執筆タイミング待機）:
  - 173体の知見・バイブル・パッチ情報を元に、辛口AI壁打ち校正付きのnote記事ドラフト・SNS投稿を自動錬成。
- [x] **【05辞典①】お気に入り・レーン所属・アイテム辞書をDB保存にして端末間で共有**（2026-10-03 完了）:
  - お気に入り（`favorites`）とアイテム辞書（`pilot_item_dict`）を Supabase `ktm_settings` に保存、レーン所属を `champion_lane_roles` に一本化。
  - 新設API `/api/pilot/settings`（GET/PUT）により、ロード時にDBから一括取得。初回端末移行処理でローカルの `localStorage` とDBの和集合マージを自動実行。
  - お気に入りトグル（★）および編集モーダル保存時に即座にDBへ永続化され、スマホ（PWA）とPC間の双方向同期が完了。Turbopackビルド全PASS。
- [x] **【05辞典②】勝率・Tierを外部サイトの実データに置き換える（AI調べは廃止）**（2026-10-03 完了）:
  - OP.GG公式MCPサーバー（`https://mcp-api.op.gg/mcp` / `lol_list_lane_meta_champions`）から全5レーン計268体の実測メタデータ（勝率・採用率・BAN率・Tier・順位）を収集するパイプライン（`opgg_meta_collector.py`）を新設。
  - Supabase `ktm_settings`（`opgg_lane_meta_stats`）および `opgg_lane_meta.json` に永続化し、PC常駐デーモン（`edge_worker_daemon.py`）へ日次自動同期スレッドを組み込み。
  - AI推測値（`patch_meta`のJinx 0.0%等の妄想）を完全排除。辞典詳細でレーン選択に連動したリアルタイムTier・勝率・BAN率・順位およびOP.GG公式出典リンクを表示。一覧カードにもTierバッジを直感配備。Turbopackビルド全PASS。
- [x] **【05辞典③】辞典の整理とメンテナンス画面**（2026-10-03 完了）:
  - 👑 **統合戦術マスター教本（原本全文）の完全復旧**: `compile_champions.mjs` を改修し、Supabase `matchup_sentinel`（`enemy='GLOBAL'`）に保存されていた承認済み巨大統合本文194件をコンパイル対象へ正式統合。辞典詳細の「プロの思考録・バイブル」タブ最上部に目玉カードとして配置（展開/折りたたみ、文字数バッジ、クリップボードコピー、直接メンテ遷移ボタン付き）。
  - 🛠️ **専用メンテナンス画面 `/admin/dict-maintenance` の新設**:
    - 全173体の即座インクリメンタル検索＆セレクター。
    - レーン所属のワンクリックトグル（Top, Jungle, Mid, ADC, Support）とDB（`champion_lane_roles`）直接同期。
    - 👑統合マスター教本のMarkdownフルエディタ（リアルタイム文字数・プレビュー・Supabase `matchup_sentinel` 保存）。
    - 基礎戦術情報（パワースパイク、強み・弱み、序盤戦術）のJSON編集・保存（`champion_facts`）。
    - 改定履歴ロールバック機能（`knowledge_revisions` からワンクリックで以前のバージョンに復元）。
    - Next.js API `/api/admin/dict-maintenance`（GET/PUT）を配備。
  - 🧭 **辞典ヘッダー操作ボタンの整理**:
    - 頻繁に使うプレイ用アクション（「⚔️ VS比較」「🤖 AIコーチ」「CD表」）を表に残し、管理・補助系アクション（「知見取込」「レーン編集」「アイテム辞書」「メンテ管理」）を「⚙️ ツール」ドロップダウンへスマートに集約。視界のノイズを一掃。
    - 全21ルート Turbopack ビルド・TypeScript型チェック完全パス。
- [x] **【05辞典④】動画記事のチャンピオン判定の修正**（2026-10-03 完了）:
  - 🎯 **決定論的タイトル判定エンジン (`detect_champions_from_text` / `determine_champion`) の配備**:
    - `03_SYSTEMS/v2_CORE/_LOL/champ_id_normalizer.py`: DDragon 173体公式辞書（日本語名・英語名）に加え、CamelCase自動スペース化（`Lee Sin`, `Jarvan IV`, `Master Yi`, `Twisted Fate`, `Dr Mundo` 等）、中黒記号除去（`リーシン`, `チョガス`, `カジックス` 等）、および有名エイリアス（J4, Wukong, TF, MF等）と新チャンプ（Locke, Yunara, Ambessa, Mel）を完全統合。
    - **カタカナ誤爆防止（False Positive Guard）**: カタカナ名には `(?<![ァ-ヴー])` ... `(?![ァ-ヴー])` 境界チェックを導入。「パワースパイク」内の「パイク」や「リセット」内の「セト」の誤検出を100%防止。
    - **単語境界チェック**: 英字名には `(?<![a-zA-Z0-9])` ... `(?![a-zA-Z0-9])` 境界チェックを導入。「Settings」内の「Sett」や「Video」内の「Vi」の誤爆を100%防止。
    - 複数登場時は第1出現チャンピオンを主題（Primary）として決定論的に判定。タイトルで判定不能な場合のみAI出力を正規化し、無ければ推測を捏造せず `Unknown` を採用。
  - 🤖 **ワーカー (`scripts/youtube_worker.py`) の判定パイプライン刷新**:
    - AIの出力 `champion` を鵜呑みにせず、記事タイトルおよび元動画タイトルから `determine_champion()` を優先実行して保存。
  - 🔄 **既存DB (`personal_knowledge`) 116件の一括修正完了**:
    - `fix_personal_knowledge_champions.py` により、既存の表記ゆれ（Jarvan IV ➔ JarvanIV 10件、Lee Sin ➔ LeeSin、Master Yi ➔ MasterYi、Wukong ➔ MonkeyKing、Cho'Gath ➔ Chogath、Bel'Veth ➔ Belveth、Kha'zix ➔ Khazix等）、および誤判定（ユナラ ➔ Yunara、ロック ➔ Locke、カーサス ➔ Karthus等）計116件をDDragon正規IDへ一括修正。
  - 📖 **05辞典への反映＆検証**:
    - `compile_champions.mjs` を再実行し、JarvanIV 18件、MonkeyKing 15件、Khazix 28件、LeeSin 19件、Belveth 11件、Chogath 8件、Locke 5件、Karthus 2件、Yunara 1件と、各チャンピオン詳細へ動画バイブルが完璧に紐づいたことを実測確認。Turbopackビルド（21/21ルート）全PASS。
- [x] **【05辞典⑤】ライブラリのチャンネル絞り込み ＆ 4種ソート機能**（2026-10-03 完了）:
  - `05_PILOT/src/app/api/library/route.ts`: `youtube_queue`（動画URL ➔ `channel_name`）と動的突合し、各記事へ正規化チャンネル名（`Coach Kirei`, `Agurin` 等）および文字数を付与。
  - クエリパラメータ `channel`（件数バッジ付きドロップダウン）と `sort`（`date_desc` 新しい順, `volume_desc` ボリューム順, `date_asc` 古い順, `title_asc` タイトル五十音順）を配備。
  - 記事カードにチャンネル名バッジ（`📺 Coach Kirei`）と文字数バッジ（`約4,500字`）を美しく配置。
- [x] **【05辞典⑥】チャンピオン辞典側（トップ画面 `/`）のソート機能（Tier順・名前順等）**（2026-10-03 完了）:
  - `05_PILOT/src/app/page.tsx`: 選択中レーン連動のOP.GG実測Tier順（OP〜T5・同Tier内勝率順）、五十音順、英語名順、勝率順、ナレッジ数順の5種ソートセレクターを配備。
  - チャンピオン詳細モーダルでローカル要約（`videoBibles`）とDB知見（`libraryKnowledge`）の排他制御を解除し、美しい共存表示を実現。カード内にチャンネル名・文字数バッジを配備。
  - Turbopackビルド（21/21ルート）＆型チェック全PASS。
- [x] **【05辞典⑦】ライブラリの「さらに読み込む」ボタン ＆ YouTube動画ID突合強化 ＆ 知見タブ自動スムーズスクロール**（2026-10-03 完了）:
  - ① ライブラリ一覧（`/library`）の最下部に「⬇️ さらに読み込む (+60件)」ボタンを配備。全952件のアーカイブをスクロール＆クリックで追加読み込み可能に。
  - ② `api/library/route.ts` に YouTube 動画ID（11桁）抽出正規表現を導入。URLのパラメータや短縮URLに影響されず、動画IDで100%確実にチャンネル名を解決。
  - ③ チャンピオン詳細ビュー（`/`）のヘッダーにある「📒 攻略知見」ボタンを押した際、該当タブをアクティブ化しつつタブナビゲーション位置へスムーズスクロール（`scrollIntoView`）するUI改善を実装。
  - Turbopackビルド（21/21ルート）＆型チェック全PASS。
- [x] **【05辞典⑧】ヘッダー「ツール」ドロップダウンの表示バグ解消**（2026-10-03 完了）:
  - ヒーローバナー親要素の `overflow-hidden` により、開いたツールメニュー（知見取込・レーン編集・アイテム辞書・メンテ管理）が切り落とされて消えていた不具合を解消。
  - `overflow-hidden` を背景スプラッシュ画像専用コンテナへ分離し、メニュー自体に `z-50` と外側クリック用背景オーバーレイを配備。正常に前面表示されるように修正。
  - Turbopackビルド（21/21ルート）＆型チェック全PASS。
- [x] **【05辞典⑨】承認待ち記事（297件）の確認・辞典統合マージ完了**（2026-10-04 完了）:
  - `knowledgeIntegrate.ts` でタグ（`LoL`, `JG`等）を破壊せず維持する安全改修を実施。
  - 特定チャンピオン記事185件（全70体）を各チャンピオンの「👑 統合戦術マスター教本（`matchup_sentinel`）」および構造化ノートへ完全マージ。
  - レーン一般論・マクロ記事112件を承認済みに昇格（ライブラリ＆レーンガイドで活用）。
  - `compile_champions.mjs` 実行で全173体詳細マップへ新着知見を即時流し込み完了。Turbopackビルド全21ルートPASS。
- [x] **【段階的クリーンアップ】旧KTMポータル（`04_PORTAL`）の安全な役目終了＆宝くじ2等1,000コイン保証**（2026-10-04 完了）:
  - 宝くじエンジン（`lotteryEngine.ts` / `jackpot.ts`）を改定: 2等（ラッキー賞）は固定1,000コイン保証とし、売上の10%で足りない不足分は金庫プール（`jackpot_pool`）から自動補填・引き出しする数理ロジックを実装。Discord通知の表記ミスも完全修正。
  - Discord REST API経由で公式Botよりけんちさんへ状況説明DMを自動送信完了。
  - 旧ポータル（`04_PORTAL`）のサイドバー管理メニューを内戦・大会専用へ純化し、トップに新鋭パイロット（`https://ktm-pilot.vercel.app`）をリンク配備。
  - 旧ポータル内の旧辞典（`/champions`）・旧ライブラリ（`/library`）画面に新鋭パイロットへの完全移行バナー＆ワンクリック遷移ボタンを配備。内戦や宝くじCronを一切破壊しない安全な段階的役目終了を完了。
- [x] **【Step 4】PC常駐デーモン（`edge_worker_daemon.py`）の長尺動画タイムアウト調整**（2026-10-04 完了）:
  - `edge_worker_daemon.py` の全体監視タイムアウトを1800秒から3600秒（60分）へ拡張し、ゾンビタスク誤判定を排除。
  - `youtube_queue_process` を900秒から2400秒（40分）へ、`youtube_absorber.py` を1800秒から3600秒へ緩和。
  - `youtube_worker.py` の `yt-dlp` 字幕取得（180s→300s）、Gemini API要約（120s→240s）のタイムアウトを拡張。
  - 新設定で常駐デーモンを再起動し、安定稼働を確認済み。
- [x] **【Step 5】Pythonコード側のDDragonバージョン動的自動取得**（2026-10-04 完了）:
  - `03_SYSTEMS/v2_CORE/_LOL/ddragon_resolver.py` を新設し、Riot公式 `versions.json` から最新バージョン（現在 `16.19.1`）を動的に自動取得・24時間ディスクキャッシュする統合SSoTリゾルバーを配備。
  - `champ_id_normalizer.py` および `overlay/ddragon_version.py` を共通リゾルバーへ完全接続。
  - HUDオーバーレイの全20テストスイート完全PASS確認済み。Git commit & push完了。

## ✅ 2026-10-02 対応済み（Sovereign Pilot [05_PILOT] 完全移行・双方向連携・PWA・Vercel本番公開）
- [x] **既存バイブル全176本最新9大柱フォーマット一括再蒸留完了**:
  - `bible_redistill_all.py` により、JG動画92本を最優先とした全175本をエラー0件（成功率100%）で再蒸留完了。
  - `02_FACTORY/_LOL/note_stocks/` に全224本の高解像度ストックを自動保存、Supabase `lane_guides`（JG章384件）へリアルタイム統合。
- [x] **🎯 対面相性チェッカー（Matchup Picker）実装・デプロイ**:
  - `jg_matchups.ts` および `MatchupPicker.tsx` を新設。相手JG（Lee Sin, Viego, Nocturne, Zac, J4, Shaco等）を選択すると、危険度・インベード警戒・初動スタイル・対策鉄則と、プール内の相性判定（有利/五分/不利）を一撃逆引き。
  - ★お気に入り（マイプール）登録キャラの自動最優先ソート機能を搭載。ワンクリックでチャンプ詳細ガイドへジャンプ可能。
- [x] **📖 実戦動画プロ思考録・バイブルWeb完全統合**:
  - `compile_champions.mjs`: `note_stocks` から各チャンピオンへ延べ562件の動画バイブルを自動紐付け。
  - `page.tsx`: 「🧠 プロの思考録・バイブル (動画X本)」タブ新設。特大キラーエピソード名言枠、YouTube直リンク、5大極意（カメラワーク・ウェーブ介入・スマイト回避・中盤シャドウ・ミュート基準）のスマートグリッド、実戦思考トリガーをカード表示。
- [x] **個人戦術コックピット完全移行**: 173体DDragon+Supabase統合辞典、AI戦術コーチ（設計図・スタッツ分析・反省ノート）、全6レーン攻略、952件ライブラリを `05_PILOT` へ完全移植
- [x] **全画面共通ナビゲーション**: PC上部固定バー ＆ スマホ用固定ボトムナビ（PWA仕様）を配備
- [x] **有機的双方向連携ネットワーク**: 辞典 ⇄ AIコーチ ⇄ スタッツ ⇄ ライブラリ間のシームレスな1クリック相互ジャンプ網を構築
- [x] **Riot APIスタッツ分析復旧**: `fetchMatchDetails` 戻り値のアンラップ不整合を解消し、実戦データ（Kazurin#4036 / 勝率57%）の分析を正常化
- [x] **スタンドアローンPWA化**: Next.js 16 App Router 動的マニフェスト、ノッチ対応、全画面起動を配備
- [x] **Vercel本番デプロイ完了**: 既存ポータルに一切干渉しない完全独立プロジェクト `https://ktm-pilot.vercel.app` を正式公開
- [x] **既存ポータルの緊急止血＆ストレージ解放**: 日次重負荷Cron（soloq-coach, monetize）を停止・週1回へ間引き、過去デプロイ25件を一括削除して5.45GBのストレージを解放
- [x] **Web Share Target ＆ YouTube/X 共有登録口配備**: PWAマニフェスト（`manifest.ts`）に `share_target` を新設、`/share-target` ページおよび `api/youtube/queue`（YouTube ＆ X両対応）を配備。ライブラリ画面に「📋 URL投函」ボタンを設置し、スマホ・PC両方からワンタップで動画・ポスト解析キューへ投函可能に
- [x] **ミニマルベクターアプリアイコン刷新**: AIイラスト感を完全排除した「案B: ヘキサゴン＆タクティカルコンパス」を全サイズに配備・本番反映
- [x] **LoL動画解析の二系統自動マージ（レーンガイド ＆ チャンピオン辞典）＆ note発信ストック生成パイプライン実装**:
  - `bible_dispatcher.py` を新設: 新旧バイブルから「チャンプ固有」「JGマクロ」「noteネタ」を完全分離。
  - トラックA（チャンピオン辞典）: `matchup_sentinel` へ固有Tipsをマージ。
  - トラックB（レーンガイド JG章）: 普遍的JGマクロ（ガンク条件・敵JGトラッキング・リコールテンポ・罠NG行動）を抽出し、Supabase `lane_guides`（`lane = 'JG'`）の第8章へ出典URL付きで自動追記。
  - トラックC（note発信ストック）: `02_FACTORY/_LOL/note_stocks/` へ、フロントマター標準・32文字タイトル・キラーWhy・罠回避を盛り込んだ独立Markdownを自動保存。
  - `youtube_absorber.py` にローカルフォールバックと `bible_dispatcher` 連携を組み込み、新規投函時に全自動マージされるパイプラインを確立。
- [x] **チャンピオン別ピック判断ガイド（先出し/後出し/構成マッチング）の全層配備**:
  - プロンプト第8柱（`youtube_bible_forge` / Supabase ＆ ローカルフォールバック）に「ピック判断基準」を統合。
  - `compile_champions.mjs` および `champions_detail_map.json`: 全173体へ `pickGuide`（先出し適性/後出しカウンター/構成トリガー）を注入。
  - `05_PILOT/src/app/page.tsx`: 詳細画面へ「🎯 ピック判断ガイド」カードを新設。先出しS/A/B/C、後出し刺さり相手、味方構成シナジーを直感表示。
- [x] **動画解析プロンプトの5大キラー要素（劣勢逆転・スキル温存・視界赤トリ・買い物判断・ピン誘導）完全網羅統合**:
  - Supabase `agent_prompts` および `youtube_absorber.py` のローカルフォールバックへ、JG勝率直結の5大アドリブ要素（崩壊試合のクロストレード、CC/移動スキルの温存我慢、オラクルレンズ切り替え秒数、端数ゴールドの妥協買い、味方を動かすピン誘導）を体系的に統合。
  - `bible_dispatcher.py` のnoteストック構成ドラフトを改修し、劣勢逆転エピソードとスキル温存のWhyを標準装備化。
- [x] **JG動画解析プロンプト究極進化：5大極意（ウェーブ介入・スマイト50/50回避・中盤立ち位置・カメラワーク・ミュート基準）完全統合**:
  - ガンク後ウェーブの押し引き基準（バウンス作り vs フリーズ維持）、スマイト運ゲーを避けるセットアップ、14分以降のスプリットシャドウ、キャンプ狩り中の画面外視線、理不尽ピンに流されないミュート基準を全柱へ完璧に融合。
- [x] **既存176本の超高速・ゼロコスト棚卸しバッチ実行（`bible_restructure_batch.py`）**:
  - 重い動画DLやGemini APIを一切使わず、ローカルの既存Markdown（176本）から7秒で再仕分けを完遂。
  - `note_stocks/` に **176本** のnote執筆ストックを即時生成。
  - レーンガイド（JG章）に **168件** のマクロ知見を統合し、総ソース数を 212件 ➔ **380件** に拡大。本番環境でリアルタイム反映を確認。

- [x] **【候補2】試合後テンポ逆再生 ＆ ビルド監査**（Claude Code、`61c1ce58`）: `/coach?tab=tempo`。タイムライン実測のみで15分までのCS/G差を1分ずつ遡り、デス/帰還/レーン起因に分解。靴（購入時点の敵ダメージ属性）と重傷（チーム最初の購入時刻）を判定
- [x] **05_PILOTの認証追加 ＆ YouTubeキュー追加の全件失敗を修正**（`fcd11b9d`）: `proxy.ts`で全ページ・全API保護。`date_added`(bigint)へISO文字列を入れていたためinsertが常に失敗していた
- [x] **YouTube管理・生成記事の承認画面を05へ移行**（`6db6d962`）: `/admin/youtube`（キュー操作一式・監視チャンネル/プレイリスト・PCワーカー稼働状況）、`/admin/review`
- [x] **PCデーモンの窓なし起動・自動起動**（`41843ec1`）: 9/30〜10/2に約44時間停止していた。デスクトップにStart/Stop/Log、スタートアップ登録済み
- [x] **「承認＝辞典へ統合」に一本化 ＆ dict-syncを05向けに修正**（`73d2ed54`）: 旧同期は承認状態を見ずに統合しており（197件が承認待ちのまま統合済み→DBで是正）、定期実行は`KTM_CRON_SECRET`未設定で9月から空振り成功表示だった

## ✅ 2026-10-01 対応済み（システム全域の決め打ち・架空フォールバック・誇大表現の全量是正 ＆ 孤立モック削除）
- [x] **未対戦者への70戦架空戦績フォールバック全面撤廃**: `sessionAnalyticsCalculator.ts` で試合数0のユーザーに勝率62%・即キュー勝率32%等を返していた架空戦績を完全撤廃。0戦時は誠実に「データ収集中」として初期表示
- [x] **AIディープ分析APIの架空勝率デッドコード削除**: `deep-intel/route.ts` 内の未使用固定勝率定数（68%, 36%等）を完全削除
- [x] **チャンピオン戦術DBの誇大表現是正**: `championKitTactics.ts` の「不可避エンゲージ」「100%完封可能」を客観的・実践的な表現へ改修
- [x] **AIプロンプトのハルシネーション強制撤廃**: `power_spike_generator.py` の「わからないと言うな」強制を「客観的事実に基づき推測で断定しない」へ是正
- [x] **即死メーターのTrue Damage用語混同・断言是正**: `MatchupBlueprintCard.tsx` の「確定ダメージ」「確定最大火力」を「推定バーストダメージ」「推定最大火力」へ是正
- [x] **対面手順書の過度な断言是正**: `matchup-blueprint/route.ts` & `matchup_blueprint_engine.py` の「100%負ける」「殴り合いで絶対に勝てなくなる」を客観的表現へ改修
- [x] **看板と実態が乖離した孤立モック完全削除**: `03_SYSTEMS/v2_CORE/_LOL/overlay/postgame_deep_analytics.py`（未参照のまま固定ダミー戦績を返していた試作ファイル）を安全に削除
- [x] **YouTubeチャンネル登録のBot検知クラッシュ解消 ＆ 直接メタデータ解決エンジン実装**: `youtube_monitor.py` において、yt-dlp の動画読み込み起因による `Sign in to confirm you're not a bot` クラッシュを完全排除。軽量HTMLメタデータ（`itemprop="channelId"` / `og:title`）直接取得エンジンを新設し、`@lolwataneko`（watanekoLoL）の登録完了および新着動画15件の解析キュー自動投入を確認
- [x] **全自動テスト完走**: Pythonテスト18件PASS、TypeScriptテスト83件PASS、Next.js 100ページフルビルドPASS

## ✅ 2026-09-25 対応済み（Sovereign HUD アイコン＆ビジュアル大改修 ＆ 総合整理）
- [x] **対面カードのアイコン＆ビジュアル化**: 自敵チャンピオン顔アイコン（丸枠）、キートップ風バッジ `[ E ]` ＆ CD秒数ピル、3段階ステップ進行バー（①序盤 ➔ ②主導権 ➔ ③破壊 [NOW発光]）、DDragon公式アイテム画像（32x32px）、警告標識バッジ（`⛔ 罠` / `❌ NG`）を全面配備
- [x] **TopBarのアイテム画像配置 ＆ 文字切れ解消**: アイテム公式画像（22x22px）の配置と名称短縮により、幅250px内での文字あふれ・切断を根本根絶
- [x] **アセットマネージャー拡張**: `ItemPriceManager.find_item_id_by_name()` 逆引きおよび `SpellAssetManager.get_item_icon()` / `create_rounded_icon()` を新設
- [x] **起動スクリプト一本化**: `03_SYSTEMS/start_overlay.bat`（黒窓なしpythonw・二重起動防止）＋ `stop_overlay.bat`（安全終了）へ集約
- [x] **デスクトップショートカット配備**: `Sovereign HUD (Start).lnk` / `(Stop).lnk` をデスクトップへ自動生成（チラつきゼロ）、スタートアップ自動起動も同期
- [x] **過渡期ファイル退避**: 重複バッチ・スクリプト7件を `99_ARCHIVE/legacy_overlay/launchers/` へ原本非破壊退避
- [x] **日常完全ステルス待機**: ゲーム外は画面上部ピル含む全HUDをhide化、トレイ（👑）のみで静かに常駐。LoL開始で自動出現・終了で完全消去
- [x] **左下スマート通知パネル新設 ＆ アイコン大刷新**: 画面中央上部の視界妨害を解消し、画面左下へ配置。敵スパイク警戒（顔アイコン＋⚡スパイク警戒バッジ＋公式アイテム画像28px＋アイテム名）、敵JG危険帯（JG顔アイコン＋🚨ガンク警戒バッジ＋危険時間）、大砲ミニオン接近（💣大砲接近バッジ＋あと15s）、バフタイマー（🟣バロン/瞳）、ショップ通知を完全グラフィカル化
- [x] **右上（TopBar）完全撤去 ＆ 右下（SpellTracker）への一本化**: 右上の邪魔な被りを撤去しLoL標準スコア欄をクリア化。右下の目標アイテム欄にも公式画像（20px角丸）を配備し、右下一箇所でマクロ・ゴールド差・アイテム・敵スペルを完全集約
- [x] **画面中央（TABキー連動LaneDominance）完全削除**: 配置調整が煩雑なスコアボード横ピルを廃止し、右下のロール別ゴールド差バッジへ完全一本化
- [x] **全自動テストスイート合格**: `test_overlay_suite.py` 18件全パス（OK）、新UIスクリーンショット自動生成完了



## ✅ 2026-09-20 対応済み（直近1週間の実装における潜在不具合修正 全6件）

> **経緯**: 深層ロジック監査で5件の不具合を発見・修正後、ライブ検証中に追加のセキュリティ脆弱性を発見（#6）。詳細は[アーカイブ](file:///d:/my_work/02_FACTORY/TODO_ARCHIVE.md)。

- [x] バカラ配当計算の元金未差引バグ（無限コイン増殖インフレ）解消
- [x] バランサーサイド公平化の数学的恒等式（100%ランダム決定化）解消
- [x] ポロ・クラッシュのリプレイ多重利確脆弱性 ＆ 通信遅延クラッシュ是正
- [x] チップ送金の手入力誤字による幽霊アカウント自動生成防止 ＆ 完了通知是正
- [x] 師弟フォーラムスレッド作成時の Discord API タグ上限超過(400エラー)防止
- [x] 【最高・セキュリティ】ポロ・クラッシュの`gameToken`平文漏洩を根絶（crashPointをサーバー側`crash_sessions`テーブルのみで保持する方式に変更、本番適用・実測確認済み）

---

## 📋 【次のタスク】 ナレッジ基盤の先行整理 ＆ 再解析パイプライン

### 🧹 Phase 1: ナレッジ ＆ キュー先行整理 ＆ 辞典超強化（全項目完了済み）

YouTubeキュー整合化、帝国総合索引同期・戦術バイブル拡充、チャンピオン辞典・ビジュアルダッシュボード強化まで全て完了。詳細は[アーカイブ](file:///d:/my_work/02_FACTORY/TODO_ARCHIVE.md)（2026-09-18セッション節）を参照。

### 🚀 Phase 2: 動画解析インフラ進化 ＆ 再解析パイプライン

- [x] 字幕欠落動画のローカルWhisper音声認識フォールバック配備（`scripts/whisper_transcriber.py`）

> **2026-09-21 実測**: `youtube_queue` 合計1228件（completed 1071 / pending 75 / manually_closed 82 / **エラー系0件**）。ローカル常駐`edge_worker_daemon.py`は**64.4時間 起票が止まっていた**（PC起動依存という構造上、気づかれず止まり続けるリスクが現在進行形。`ops_health_check.py`がこれを検知できることは実行確認済み）。

- [x] **第0弾: 基盤修正（2026-09-20完了）**
  - [x] 字幕抽出のハードコード依存を実データ取得方式へ根本修正（実データ取得不能時はスキップ、架空データで埋めない）
  - [x] Geminiモデル候補を生存確認済みモデル（`gemini-3.1-flash-lite`等）へ差し替え
  - [x] チャンピオン名正規化を`normalize_champion_id()`に統一
  - [x] Whisperフォールバックの`ModuleNotFoundError`を修正
  - [x] `ops_health_check.py`の新チェックを実行して動作確認（2026-09-21完了。64.4時間の無起票を正しく検知した。あわせて、WARNが何件あっても最後に「ALL GREEN」と誤報していたサマリーのバグも修正）
- [x] **案5: 🧹 SNS一時下書きドラフト群の自動インデックス化**: [`02_FACTORY/01_DRAFTS/sns/INDEX.md`](file:///d:/my_work/02_FACTORY/01_DRAFTS/sns/INDEX.md) を新設（2026-09-21、パッチ別・生成種別別に全187件を索引化）
- [x] **第1弾 (MVP): kirei_bible の実演クリップを戦術バイブルへマウント（2026-09-21完了）**
  - 計15本をマウント（Kha'Zix / Viego / Shyvana×2 / Wukong / Graves×2 / JarvanIV / Akali / Akshan / Ambessa×2 / Bel'Veth / Talon / Vi）。
  - 実行して判明した不具合を4件修正: ①実際は7本しかマウントできていないのに「12本マウント」と報告していた虚偽カウント、②間隔なし連続取得による429取りこぼし6本（5秒間隔を追加）、③判定より先に取得していた無駄なネットワークアクセス、④INDEX.mdの動画誤検出。
  - マウント先バイブルが無く捨てられていた16本を救済するため、`champion_facts`の蓄積データからバイブルを生成する`generate_tactics_bible.py --from-db`を新設し12体を配備（AI生成なし＝課金ゼロ）。
  - **残り12本は字幕・音声とも取得できず未処理**（下記のcookieタスク待ち）。
- [x] **🍪 YouTube cookie の設定（2026-09-23 完了）**
  - `.secrets/youtube_cookies.txt`（`.gitignore` 済み）に配置し、`.env` に
    `YT_DLP_COOKIES_FILE=D:/my_work/.secrets/youtube_cookies.txt` を設定した。
  - 機能しなかった `YT_DLP_COOKIES_FROM=chrome` はコメントアウト（Chrome 127以降の
    App-Bound Encryption で他アプリからの復号ができないため）。
  - **効果は実測で確認**: 設定前は429が解消せずワーカーが中断していたが、設定後は
    23件を連続で処理できた。
  - ⚠️ cookieは失効する。再び429や403が頻発したら、シークレットウィンドウで
    YouTubeにログイン → 拡張でエクスポート → 他ページを開かずに閉じる、の手順で取り直す。

- [x] **第2弾: pendingキューの再解析（2026-09-23 完了）**
  - **着手時の実測はTODOの記載と反転していた**。2026-09-21時点の記載は
    「pending 75件 / エラー系0件」だったが、実際は **pending 0 / エラー59件**
    （字幕もWhisperも取得不可 33 / HTTP 429 23 / 字幕なし 3）で、
    2026-09-22 16:53〜2026-09-23 08:54 に現在進行形で発生していた。
  - **原因と修正（いずれも実測で確認）**:
    1. `youtube_worker.py` に動画間の間隔制御もバックオフも無く、1回叩いて429なら即
       あきらめ、しかもそれが `retry_count` を消費していた。23件が3回で
       `error_generation` に固定されていた。姉妹スクリプト `extract_video_tactics.py`
       には2026-09-21の実測を受けた5秒待機が既にあったが、ワーカーには入っていなかった。
       → 10秒→30秒のバックオフ再試行 ＋ 5秒間隔 ＋ 「レート制限では `retry_count` を
         消費せず pending のまま据え置き、その回の実行を打ち切る」へ変更。
    2. ワーカーがローカルで起動できなかった（`KeyError: SUPABASE_URL`）。
       GitHub Actions専用で環境変数がプロセスに注入される前提だったため。
       → `.env` 読み込み（既存の環境変数は上書きしない）と、Windowsコンソール(cp932)の
         `UnicodeEncodeError` 対策を追加。
    3. 要約の保存(POST)が成功した後の工程で落ちると、成果物があるのに pending へ戻り、
       次回Geminiを再課金していた。→ 保存済みを検出して完了扱いにする自己修復を追加。
    4. `sb()` がHTTPエラーの本文を捨てており「HTTP Error 409: Conflict」としか
       残らなかった。→ 本文を例外に載せるようにした。
  - **結果**: completed 1099 → **1122件**（+23）。pending 0 / failed 0 / error_generation 0。
  - 復旧用に `clean_youtube_queue.py --retry-rate-limited` を追加
    （`--retry-failed` はエラー全件を戻すため、字幕が無い動画まで巻き込んで再失敗させる）。

- [x] **字幕が存在しない動画へのWhisper適用（2026-09-23 実施・解説系7本）**
  - 対象はキューに残った `error_no_transcript` 36件。`yt-dlp --list-subs` で
    **字幕も自動字幕も存在しない**ことを確認済み。うち解説系のタイトル7本にWhisperをかけた。
  - **結果: 7本中1本のみ記事化できた**（`bqHcE8m4Pi8` 差がつくリーシンの本質 →
    文字起こし1,387文字 → 記事ID 37199 / LeeSin / 本文2,419文字）。
    残り6本は**音声はダウンロードできたが文字起こしが0文字**だった。
    YouTubeが自動字幕を作れていない＋Whisperも0文字、という独立した2つの根拠から
    **実況音声が無い動画（テロップのみ・BGMのみ）**と判断できる。
  - `ffmpeg` はシステム導入不要だった。`imageio-ffmpeg` のバンドル版が既に入っており、
    `whisper_transcriber.get_ffmpeg_path()` がそれを拾う。
    （途中「ffmpeg未インストール」と誤認したが、PATHに無いだけだった）

  **ここで判明した実装の穴（いずれも修正済み）**
  1. **Whisperフォールバックがキュー処理から呼ばれていなかった**。`whisper_transcriber.py`
     は用意されていたが、呼んでいたのは `extract_video_tactics.py` だけで、
     `youtube_worker.py` からは一度も呼ばれていなかった
     （[[project-orphaned-automation-pattern]] と同型）。ワーカーに接続した。
  2. **`android_vr` はメタデータは取れるが音声の実ダウンロードで403になる**。
     cookieを付けても変わらない。`web_safari` / `mweb` は同じ動画を問題なく取得できた。
  3. **`player_client` に複数を並べて一度に渡すと逆効果**。yt-dlpは全クライアントの
     フォーマットをまとめてから選ぶため、`bestaudio` が android_vr 由来の音声専用
     フォーマットに当たって結局403になる。**1クライアントずつ順に試す**ように変更した。
  4. `whisper_transcriber.py` を単体実行すると `.env` を読まず cookie 未設定になり、
     「cookieを設定したのに403のまま」という誤った結論を出しかけた。読み込みを追加。
  5. 文字起こしが極端に短い場合はGeminiへ渡さない足切り（既定500文字）を追加。
     中身の無い記事の量産を防ぐ。

- [x] **字幕・音声なし動画へのGemini映像直接解析配備（2026-09-23 実装完了）**
  - 実況音声・字幕のない動画向けに `gemini_analyze_video()` を `youtube_worker.py` へ実装。
  - YouTube URL を Gemini へ直接渡して映像解析・戦術記事生成（低解像度メディア指定でトークン約1/3抑制）。
  - 残る `error_no_transcript` 32件について、映像解析パイプラインによる消化またはクローズの選択肢が確保された。

- [x] **第3弾: ローテーション再解析の実装（2026-09-21完了、実行は未着手）**
  - `edge_worker_daemon.py`に`youtube_rotation`タスクを新設。完了済み動画を古い順に少数ずつpendingへ戻す。
  - 暴走防止に2つの歯止め: 未処理キューが20件以上なら差し戻さない／スケジューラは既定で無効のオプトイン（`ENABLE_YOUTUBE_ROTATION=1`）。
  - 現在pendingが70件超あるため安全弁が作動し、有効化しても当面は何も差し戻さない（第2弾の消化が先）。
- [x] **（データ整理）** `wukong_tactics_bible.md`と`monkeyking_tactics_bible.md`の分裂を統合（2026-09-21完了。両者はバイト単位で完全同一だったため、DDragon公式IDである`monkeyking_`側に一本化し`wukong_`を削除）。

### 👑 Phase 3: 自律ナレッジループ ＆ セマンティック検索進化

- [x] **実戦リザルト（Live Client Data）から戦術バイブルへの「完全自動逆流」**（2026-09-24 完了）: 
  - 試合終了監視デーモン（`scripts/auto_match_recorder.py`）に対面レーン判定（position / Smite照合）とKDA・ビルド・デス反省の客観メモ生成を配備。
  - `scripts/sync_last_match_to_intel.py` がバイブル内の「対面別アーカイブ」および「⚠️ 検討して落とした選択肢（没理由・罠）」へ構造的マージを行うパイプラインを確立。シミュレーション実測検証済み。
- [x] **戦術概念の横断検索（RAG / 逆引きインデックス）**（2026-09-24 完了）:
  - 検索API（`04_PORTAL/src/app/api/tactics/search/route.ts`）を配備。全30体の戦術バイブルおよび Kirei Bible（170本超）の見出し・セクション単位でインデックス化し、「インベード」「Lv3ガンク」「オブジェクト放棄」「没理由」等の概念でスコアリング逆引き可能に。
  - チャンピオン辞典（`DictionaryTab.tsx`）に「⚡ 概念逆引き」モーダル（`TacticsSearchModal.tsx`）を配備し、ワンタップで該当チャンピオンと戦術スニペットへ直行できるUIを実装。単体テスト全63件パス、ビルド確認済み。
- [x] **パッチ更新に伴う旧バイブルの棚卸し ＆ イミュータブル規約準拠**（2026-09-24 完了）:
  - 点検CLI（`scripts/audit_tactics_bibles.py`）を新設。全30バイブルに `verified_at` を補完。
  - パッチ16.19.1でステータス変更があった3体（Fiora, Lillia, Vi）に差分速報バナーおよび変更履歴を自動反映。

---

## ✅ ハードコード偽装データの一掃（2026-09-22 完了）

> **経緯**: コーチページの「実戦の罠（没理由DB）」がDB由来を名乗りながら全対面共通の
> ハードコード固定文だった件を起点に、ポータルAPI・UI/lib・Python(HUD/CLI)の3領域を全量調査。
> **同一構造の問題が36件**見つかり、全件対応した。共通する型は「**実データ取得に失敗したとき、
> それらしい内容で埋め、失敗をユーザーに伝えない。かつ見出しにDB/実戦データ/客観/公式/確定と
> 由来を示唆する語が付く**」で、`known-regression-patterns` パターン5の実装版と言える。

### 特に実害が大きかったもの

- **試合の教訓がどこにも保存されていなかった**: `sync-match-feedback` はDB書き込みを一切
  行わないスタブなのに「辞典・対面メモへ自動同期しました」と成功を返していた（サイレントな
  データ消失）。`TODO.md` 上ではこの経路を含む「Step4 ナレッジ自動更新ループ」が完了扱いだった。
- **AIコーチのプロンプト汚染**: `playerStyleProfile.ts` の手入力固定値が「your.gg実戦データ連動」を
  名乗ってAIプロンプトへ注入されており、どの試合を解析させても「KP@15が下位3%」という
  固定の前提で講評が生成されていた。
- **「公式・確定」を騙る即死計算**: `kill_line_calculator.py` のdocstringは「168体すべての
  DataDragon公式確定計算」と明言していたが、実体は手書き41体分で残り127体は無言で汎用値。
  それがHUDに「即死確定」と断言表示されていた。
- **架空データが「検証済み・公式」ラベルでファイルに永続化**: `generate_tactics_bible.py` の
  既定モードが手書きデータを `status: verified` / `source_type: official` 付きで書き出していた
  （既存17ファイルも訂正済み）。

### 確立した修正の型（今後も踏襲する）

**①実データのみ返す ②無ければ null/空を返す ③UIは「まだ登録されていません」と正直に表示する
④静的なものは「一般論」「手入力値」「推定」と明示し、由来を偽る見出し（DB・公式・確定・客観・連動）を付けない。**

### 残る前提整備（未着手）

- [x] ~~**DDragonにダメージデータを取り込む**~~ → 2026-09-23 調査の結果、**この方針は成立しないと判明**。
  ハードコードの根治には別のアプローチが必要。**同じ調査を繰り返さないよう根拠を残す。**

  **何を確かめたか（実測）**

  | データ源 | 基礎ダメージ（レベル別） | AD/APスケーリング係数 |
  |---|---|---|
  | DDragon `spells[].effect` | ✅ 取得できる（例: Darius Q `[100,110,120,130,140]`） | ❌ **取得できない** |
  | DDragon `spells[].vars` | — | ❌ **サンプル15体すべてで空配列** |
  | DDragon `spells[].datavalues` | — | ❌ 空オブジェクト `{}` |
  | Community Dragon `coefficients` | ✅ `effectAmounts` で取得可 | ⚠️ **20スペル中7個(35%)しか入っていない** |

  - DDragonのtooltipは `{{ bladedamage }}`、CDragonは `@BladeDamage@` というプレースホルダで、
    **公開JSONからは解決できない**（Riotがツールチップ解決をサーバー側へ移したため）。
  - CDragonの `coefficients` は一見使えそうだが、**Darius Q（実際は+100%増加AD）が 0.0** だった。
    つまり **0.0 が「スケーリング無し」なのか「データ未収録」なのか区別できない**。
    これを信じて実装すると、**公式データを名乗る誤った数値**ができあがる。
    2026-09-22に36件一掃した偽装データと同じ構図になるため採用しない。

  **さらに根本的な問題**

  現在の `BURST_PROFILES`（`04_PORTAL/src/app/api/lol/matchup-blueprint/route.ts`、44体収録）の
  `baseLvl6` は「Lv6でのフルコンボ総ダメージ」という**人間の判断を含む値**であり、
  スペル単体の数値ではない。仮に基礎ダメージが全部取れても
  「どのスキルを何回撃つのがフルコンボか」は機械的に決まらない。

  **現実的な選択肢**

  1. **現状維持（推奨）**: 2026-09-22の対応で既に「推定値」と明示済み。誤りではない。
  2. LoL Wiki のスクレイピング: 係数は載っているが**HTML構造に依存**し、パッチごとに壊れる。
  3. 基礎ダメージだけDDragonから取り込み、係数は手書きのまま: 中途半端で、
     「公式データ由来」と誤解される危険がある。やるなら表示で明確に分ける必要がある。

---

## ✅ ポータルの応答速度・操作性改善（2026-09-22 完了）

> **経緯**: 「利便性・操作性を上げたい、レスポンスを速くしたい」という要望に対し、
> 提案 → 実測 → 実装の順で進めた。制約として **カジノの残高とバランサーの参加者リストは
> 即時性が要るためキャッシュ禁止** をユーザーから指定されている（今後も厳守）。

- [x] **参照系API 6本にCDNキャッシュを導入**（`3450e706`）
  - `src/lib/apiCache.ts` の `cachedJson()` で `Cache-Control: s-maxage / stale-while-revalidate` を付与。
  - 対象: leaderboard / synergy / stats-winrates / champions-stats / leaderboard-meta（60秒）、
    champions/dictionary-overview（300秒）。
  - **`/api/bet`・`/api/players/list`・`/api/riot/live-game` には意図的に付けていない**（上記の即時性制約）。
  - 当初 `export const revalidate` を使ったが、supabase-js が内部で `no-store` を付けるため
    Next.js 側が常に動的判定になり無効だった（ビルド警告8件）。Cache-Controlヘッダ方式に変更して警告0件。
- [x] **主要画面の `alert()` をトースト通知へ置き換え**（`da86eed3`）
  - 既存の `src/components/Toaster.tsx`（CustomEvent方式）を流用。ライトテーマ向けに配色調整、エラーは6秒表示。
  - 自動置換が成功/失敗を6箇所取り違えていた（例:「N件の失敗タスクを一括再実行しました」を error 扱い）ため、grep監査で全件突合して是正済み。
- [x] **プレイヤー詳細ページのチャートを遅延読込化**（`01b112fa`）
  - `charts/PlayerCharts.tsx` へ分離し `next/dynamic` + `ssr:false` 化。**実測 1,325KB → 925KB（約30%減）**。

### 測って「やらない」と判断したもの（再調査を防ぐための記録）

- [x] **`select('*')` の列指定化（全81箇所）→ 費用対効果が無いため見送り**（2026-09-22 実測）
  - 内訳: **単一行取得30件**（`.single()`/`.maybeSingle()`、削減余地ほぼ無し）、
    **limit付き18件**（うち`limit=1`が7件）、**limit無しの複数行33件**。
  - limit無し33件の大半は極小テーブル（`mentorship_profiles` 2.9KB / `youtube_channels` 1.4KB /
    `soloq_reflections` 8.4KB 等）で、列を絞っても差が出ない。
  - 実データのある上位2件を実測した結果、**転送量は半減するが応答は 8〜10% しか縮まなかった**:
    - `ktm_match_participants`（1,220行×21列）: 424ms/463KB → 11列指定で 388ms/244KB
    - `youtube_queue`（1,232行×12列）: 470ms/408KB → 9列指定で 420ms/299KB
  - しかもこの2件は MMR再計算バッチ / 管理画面で、ユーザー導線のホットパスではない。
  - 81箇所を書き換える保守コストに見合わないため**見送る**。将来テーブルが数万行規模に育った場合は再検討する。
  - 参考: 巨大テキスト列を持つ `champion_facts` は全列1,265ms/1,585KB に対し4列指定で527ms/69KB と
    劇的な差が出るが、**実コード上に全列取得している箇所は無い**（`dictionary-overview` は既に列指定済み、
    `refine-facts` は単一行）。
  - **教訓**: 本セッションでは推測ベースの提案が実測で3回否定された（loading.tsx追加・recharts全ページ肥大化・
    本件）。以後、性能改善は必ず「先に測る」。

---

## ✅ カジノの収支監査 ＆ ベット改ざん経路の封鎖（2026-09-22 完了 / コミット `24cede10`）

> **経緯**: 「各ゲームのルール説明が欲しい」「どれもいい感じの収支になっている？」という
> 問いから全ゲームの実装を精査したところ、**ゲームバランス以前に不正操作が可能な経路が4つ**
> 見つかった。RTPはすべて `04_PORTAL/scripts/casino_rtp_report.js` で200万回試行して実測している。

### 塞いだ脆弱性

- **認証ヘルパーが認証として機能していなかった**: `lib/authGuard.ts` の `verifyUserOrAdmin` は
  ①セッションが無ければリクエストボディの識別子で擬似セッションを生成し、
  ②どの照合にも一致しなくても最後に `return { ok: true }` していたため、
  **一度も `ok:false` を返さなかった**。`/api/bet`・`tip`・`shop`・`handicap` が
  他人のdiscordIdを書くだけで他人のコインを操作できる状態だった。
- **オッズをクライアントが自由に決められた**: `/api/bet` POST が `body.odds` を無検証で保存し、
  精算側(`match/record`)がその値で払い戻していた。`odds: 99999` で賭け金の99,999倍。
  1.15〜10.0のクランプは**ブラウザ側にしか存在しなかった**。
- **`/api/bet/settle` が無認証**: 1人あたり最大850コインを任意のプレイヤーへ無制限に発行できた。
- **`/api/bet/baccarat` と `/api/bet` PUT(おみくじ・破産救済)が無認証**。

### 是正したRTP（左が修正前 → 右が修正後・いずれも実測値）

- **バカラ**: PLAYER 3.45% → **1.36%** / BANKER 1.07% → **0.94%** / TIE 24.15% → **14.24%**
  （TIEは本場の「8 to 1」ではなく「8 for 1」で計算されており約10pt不利だった）
- **クラッシュ**: 利確目標ごとにRTPが 99.67%〜10.47% と乖離していた（低倍率で刻むほど得・
  高倍率狙いは一方的に搾取される構造）。逆関数サンプリング `0.96/(1-r)` へ変更し
  **全目標で96%一定**に。上限50倍。
- **宝くじ**: 1等リセット10,000と2等1,000を無徴収で発行しており、321口未満では毎回
  コインを純増させる**インフレ装置**だった。賞金を当週売上の内訳から拠出する方式へ変更し
  **発行超過を0**に。

### 新設したもの

- `04_PORTAL/src/app/casino/rules/page.tsx`（`/casino/rules`）: 全ゲームの確率・配当・RTP・
  ハウスエッジを公開。配当テーブルを変更したら**必ずこのページの数値も更新すること**。
- `04_PORTAL/scripts/casino_rtp_report.js`: RTP実測スクリプト。
  **検証**: `cd 04_PORTAL && node scripts/casino_rtp_report.js`
- `04_PORTAL/src/lib/betOdds.ts` ＋ 回帰テスト10件（テストは計46件パス）。
  **検証**: `cd 04_PORTAL && npm test`

### ✅ デプロイ前の必須項目（2026-09-22 完了）

- [x] `PORTAL_BOT_SECRET` の設定、および migration 71〜80 の適用は完了済み。
  詳細は下記「ジャックポット金庫の是正 ＆ コイン台帳の新設」節を参照。

### ジャックポット金庫の是正 ＆ コイン台帳の新設（2026-09-22 実装完了・DB適用待ち）

**判明した事実（実測）**

- **ペンタキル総取りは一度も発火しないデッドコードだった**。カジノ画面は「🔥 ペンタキルで総取り！」と
  告知していたが、①`ktm_match_participants` に `penta_kills` 列が無く、
  ②判定が `/api/match/record`（Botが kills/deaths/assists を0埋めで送る時点）で走り、
  実データを埋める `riot/match-sync` は3分後という二重の理由で永久に0のままだった。
  さらに `lib/riot.ts` の `fetchMatchDetails` が `pentaKills` をマッピングしていなかった（3つ目の欠落）。
- **金庫19,505コインはほぼ全額が新規発行分**で、プレイヤーから集めた金ではなかった。
  内訳は 試合開催ボーナス+100/試合 ×122試合 ≒ 12,200、初期値 `DEFAULT_JACKPOT` 12,800、
  ベット5% ≒ 97。**宝くじ券の購入実績は0枚**（保有0・履歴0）。
- **金庫は主要なインフレ源ではなかった**。月あたりの発行は 試合精算 約23,000 /
  おみくじ 約15,000（直近実績で1日2〜4名が受取）/ 破産救済 約2,100 に対し、金庫は約900。
  一方で9月は19名中**7名**が残高100未満まで落ちて破産救済を使っており、吸収側も大きい。

**実装したこと**

- [x] **金庫に上限 `JACKPOT_CAP = 5000` を設定**（`lib/jackpot.ts`）。上限到達中は積立をスキップする。
  ユーザー判断により**既存の超過分（約14,505）は据え置き**、上限は今後の積立停止にのみ適用。
- [x] **払い出し後のリセット額を 10,000 → 0 に**。旧実装は払い出しのたびに1万コインを無条件生成していた。
  読み取り失敗時のフォールバックも 12,800 → 0（幻のコインを作らない）。
- [x] **ペンタキル判定を `riot/match-sync` へ移設**し、実データ取得後に判定するようにした。
  `lib/riot.ts` に `pentaKills` のマッピングを追加、`match-sync` が `penta_kills` を保存。
  再同期による二重払い出しを防ぐため `ktm_matches.jackpot_claimed` フラグを追加。
- [x] **コイン台帳 `coin_transactions` を新設**（`lib/coinLedger.ts`）。
  `updatePlayerCoinsAndInventory` に `reason` を渡すと自動記録される。
  おみくじ・破産救済・試合精算・ベット投入/払戻・スロット・クラッシュ・バカラ・
  ショップ・ハンデ・チップ送受・宝くじ・ジャックポットの全経路に付与済み。
  **集計**: `summarizeCoinFlow(days)` で reason 別の発行/消費を実測できる。
- [x] `/casino/rules` に金庫の説明（2つの当選方法・積立元・上限の存在）を追記。
- [x] **ジャックポット総取りの条件を「ペンタキル達成 ＋ その試合に勝利」に変更**（2026-09-22）。
  負け試合での帳尻ペンタキルで金庫が飛ぶのを避け、勝ちに繋がった活躍だけを報いる。
  判定は `riot/match-sync` の `penta_kills > 0 && team === match.winning_team`。
  Discord通知と `/casino/rules` の文言も勝利条件を明記済み。

**✅ デプロイ前の必須項目（2026-09-22 完了）**

- [x] **`PORTAL_BOT_SECRET` を Vercel と Cloudflare Workers の両方に設定**（完了）
  - Worker `ktm-os-worker` へ `wrangler secret put` で登録、Vercel の Environment Variables にも同値を設定。
  - 対話プロンプトが分かりにくい場合は `$secret | npx wrangler secret put PORTAL_BOT_SECRET` で
    パイプ入力すると `Enter a secret value:` を出さずに済む。
- [x] **migration 71〜80 を本番へ適用**（完了・新規適用4件）
  - `_migrations` の記録が70番までしか無く、71〜79は手動適用されていたため、
    初めてスクリプトを流した際に隠れていた不備が2つ表面化した。どちらも記録と実態のズレが原因。

    | 停止箇所 | エラー | 原因 | 対処 |
    |---|---|---|---|
    | 71番 | `42703` column does not exist | 適用済みのリネームを再実行していた | 旧列が残るときだけ実行する `DO` ブロックへ |
    | 77番 | `42601` syntax error at or near "" | 先頭にBOM(EF BB BF)が混入 | ファイルから除去＋`migrate.mjs` 読み込み時にも除去 |

  - **実測確認済み**（PostgREST経由で6項目すべて200応答）:
    `mentorship_reviews` / `player_reputations` / `mentorship_profile_comments` /
    `coin_transactions` / `ktm_match_participants.penta_kills` / `ktm_matches.jackpot_claimed`
  - これで告知済みの師弟機能3つ（評価・評判・コメント）のテーブルが揃った。
    **ただし動作確認（実際に投稿できるか）はデプロイ後に行うこと。**
  - 今後は記録と実態が揃うため、この種の停止は起きない。
  - 切り分け用に `scripts/check_db_connection.mjs` を追加（パスワードを表示せず、
    生のまま／percent-decode のどちらで通るかを判定する）。


### ✅ 週末定期カスタムの募集カードを土日2枚へ分離、cron遅延を是正（2026-09-23 完了）

> ⚠️ 変更6ファイルは並行セッションが巻き込む形で `31a71c51 fix(youtube): …` に同梱されpush済み。**コミットメッセージからは辿れない**。詳細は `HANDOVER_CLAUDE.md` §2.10 (3) を参照。デプロイは成功済み。

**発端**: 水曜12:00に出るはずの募集が水曜17:35に投稿された。

- [x] **時刻ズレの原因を特定**: ①Cloudflare側の本命cron（水曜12:00 JST）が投稿まで到達せず空振り、②GitHub Actionsのバックアップが5時間20分遅延（予定03:15Z→実行08:35Z）。**GHの遅延は常態で直近5回すべて1〜5時間遅れ**ており、「本来時刻+15分のバックアップ」という設計が成立していなかった。曜日設定（CFは1=日曜〜7=土曜）は公式ドキュメントで確認済みで正しい。
- [x] **募集カードを土曜／日曜の2メッセージへ完全分離**し、`recruitments` にも2件登録。従来は土曜分1件しか登録されておらず、**日曜のリマインド・20:00開催判定・ポータル通知が構造的に機能していなかった**（孤立した自動化パターン）。
- [x] **文字量を削減**（Embed 1000文字超 → 383文字）: ボタン凡例5行と経験層分析フィールドを削除。個人の経験度バッジは各行に残置。
- [x] **バナーの正規表現置換（旧 `BANNER_PATTERN`）を廃止**し毎回組み直す方式へ。同期漏れによる「バナー固着」バグが2026-08〜09で2回発生しており、再発経路自体を除去した。
- [x] **中間アナウンスを軽量化**し、通知側の参加ボタンを廃止（カード2枚化により、メッセージ間で `fields` をコピーし合う旧同期は土曜の内容で日曜カードを上書きする事故になるため）。
- [x] **ついでに直した別バグ4件**:
  - 毎週水曜の締め切り処理が `status=open` を無条件に全件閉じており、**メンバーが自分で立てた進行中の募集まで毎週「[受付終了]」にしていた**
  - 20:00判定・中間アナウンスに手遅れ実行のガードが無く、遅延発火すると試合後に「中止」告知が流れる状態だった
  - 本命cron空振りが誰にも気づかれない → バックアップ経路で投稿が発生したら管理者エラーチャンネルへ通知
  - （作り込み分）日曜に週末日付を解決すると翌週を指すバグをドライラン検証で捕捉・修正
- [x] **`scripts/dry_run_recruitment_status.mjs` を全面改修**。旧版は既に存在しないモデル前提で検証が素通りしていた。現在は状態遷移・色・最多ランク帯・開催日の解決（全曜日10ケース）・文字数上限を検証。全ケース通過。

**🚨 デプロイ後に必要な手動作業（1回だけ）**

- [x] **旧形式カードの移行キック**（実施済み）。初回実行で「土曜16名・日曜カード無し」となったため原因を特定して修正し、`weekly_recruit_reset` で作り直した。以後の立て直しは Actions → 「KTM Bot Cron Backup」→ Run workflow → mode に `weekly_recruit_reset` を手入力すればよい。

### 🗄️ Botの Supabase 書き込みが一度も成立していなかった（2026-09-23 発見・一部対応）

上記の移行が空振りする件を追った結果、より深い問題に行き着いた。**`recruitments` テーブルは全モード合わせて0行**（service roleキーで照会したのでRLSの影響ではない）。

- [x] **原因を実測で確定**: Worker の `SUPABASE_KEY` が publishable(anon) キーで、`recruitments` は RLS有効・INSERTポリシー無し。
  ```
  anon (publishable) → INSERT: HTTP 401 code 42501 "new row violates row-level security policy"
  service (secret)   → INSERT: HTTP 201 成功
  ```
  Botが**書き込む**テーブル（`recruitments` / `pending_match_sync`）だけが0件で、**読むだけ**のテーブル（`ktm_players` 62件 / `ktm_matches` 122件 / `ktm_match_participants` 1220件）にはデータがあることも裏付けになっている。
- [x] **影響範囲**: 20:00開催判定・中間アナウンス・前回カードの締め切り・移行処理が、すべて対象0件で空振りしていた。全ての呼び出し元が例外を握りつぶしていたため誰も気づかなかった。
- [x] **暫定対応**: 募集カードの所在を DB ではなく **Discordのチャンネル走査（直近100件）を正** に変更。DBが空のままでも全機能が動く。
- [x] ~~**🚨 ユーザー作業が必要**: Worker側の鍵を service role キーへ差し替える~~ → **2026-09-29 完了を実測確認**。
  （`npx wrangler secret put SUPABASE_KEY` に `sb_secret_...` を設定する作業。RLSにanon向けポリシーを足す案は `.claude/rules/database.md` の方針に反するため採らなかった）
  - **確認方法（Supabaseコネクタ経由で実測）**: `recruitments` が **0行 → 3行**になっていた。
    いずれもDiscord message_id を伴う実レコードで、**Botからの書き込みが成立している**。
    | created_at | mode | status |
    |---|---|---|
    | 2026-09-28 11:17 UTC | ARAM | open |
    | 2026-09-26 03:32 UTC | ノーマル | closed |
    | 2026-09-24 12:46 UTC | ARAM | closed |
- [ ] **残る確認（次の水曜=2026-09-30以降）**: 上記3件はすべて**メンバーが自分で立てた募集**で、`mode='定期カスタム'` の行はまだ無い。
  鍵の差し替え後、**週末定期カスタムの投稿タイミングがまだ来ていない**ため。次の水曜の投稿後に `recruitments` へ土曜・日曜の2行が入るかを確認すれば、20:00開催判定・リマインド・ポータル連携まで含めた全経路の復旧が確定する。
  - 確認SQL: `SELECT start_at, status FROM recruitments WHERE mode='定期カスタム' ORDER BY created_at DESC;`
- [x] **`pending_match_sync` は今も0行**（2026-09-29 実測）。ただしこれは異常とは言い切れない — 試合同期の待ち行列で、処理済みは `done=true` で残る設計。0行＝未処理も履歴も無い状態。書き込み経路が生きているかは次の試合記録時に確認する。

### 🧨 移行の初回実行で露呈した落とし穴（2026-09-23 修正済み）

- [x] **引き継ぎ元を最新の旧カード1枚に限定**。走査範囲に先週以前のカードが開いたまま残っており（締め切り処理が動いていなかったため）、全部から参加者を合算して土曜が16名になっていた。
- [x] **Cloudflare Workers のサブリクエスト上限（無料プランで1リクエスト50）対策**。旧カードを大量に処理した結果この上限に達し、以降の fetch が全て失敗して日曜カードの投稿が丸ごと飛んでいた。1回の実行で触る旧カードを4枚までに制限（実行時間 47秒→9秒）。
- [x] **カード投稿の失敗を管理者エラーチャンネルへ通知**。片方の曜日だけ無い状態に誰も気づけなかったため。
- [x] **Embedフィールドの1024文字上限ガード**。超えるとメッセージ全体が400で弾かれ、カードが1枚も出ない。超過分は「…ほかN名」に切り詰める。
- [x] **定義が存在しない関数の呼び出し2件を修正**（`updateRecruitment` / `sendDiscordMessage`）。esbuildのバンドルは通ってしまう（未定義の識別子はグローバル参照として素通りする）ため、ビルド成功では検出できない。呼び出し元が例外を握りつぶしていると本番でも無言で死ぬ。

---

### ✅ 未配線だった機能2件の処理（2026-09-23 完了）

未使用importを外した結果、どこからも呼ばれていない画面が2つ表面化した。ユーザー判断により以下のとおり処理。

- [x] **`MatchRecordPanel`（22.2KB）→ 削除**（不要と判断）
  - `balancer/page.tsx` に import だけ残っていた試合結果の手動記録フォーム。
    勝利チーム選択・10人分のKDA/CS/ダメージ入力・チャンピオン選択・
    Riot IDから直近カスタムの自動取得・お祭りカスタム（戦績ノーカウント）トグルを備えていた。
  - **専用APIだった `app/api/riot/fetch-match/route.ts`（3.2KB）も一緒に削除**。
    他に呼び出し元が無いことを確認済み。
  - 日常の試合記録はDiscord Botの `handleAutoMatchEnd` → `/api/match/record` →
    3分後の `riot/match-sync` で回っているため、削除しても記録自体は止まらない。
    失ったのは「ポータル上での手動記録・手動修正の受け皿」。

- [x] **`WinrateMatrixPanel`（12.6KB）→ リーダーボードのタブとして復活**
  - `/leaderboard` に6つ目のタブ「🎯 レーン別勝率」を追加（`activeTab === 'winrate'`）。
  - 全メンバー × 5レーン（TOP/JG/MID/ADC/SUP）の 試合数・勝利数・MMR をマトリクス表示。
    勝率で色分けされ、総合／勝率／試合数／各レーンで並び替えできる。
  - 依存API `/api/stats/winrates` は存在し、CDNキャッシュ済み（2026-09-22対応分）。
  - **`next/dynamic` + `ssr:false` で遅延読込**にしたため、タブを開くまで読み込まれない。
    実測: `/leaderboard` 716 KB → **722 KB（+6 KB）**に収まった。
  - ⚠️ このページは `<Suspense>` 配下のクライアント描画のため、curlのSSR HTMLには
    タブが現れない（フォールバックの「読み込み中」が返る）。目視確認はブラウザで行うこと。

- 到達不能コード: 2件/34.8KB → **0件**（`node 04_PORTAL/scripts/find_dead_code.mjs` で確認）


### ✅ MMR内訳の食い違いを是正（2026-09-23 完了）

> **経緯**: 「KDA 0/3/9 なのにMMRが+63なのはなぜ？」という指摘の調査から発覚。

**根本原因は2箇所（どちらも修正済み）**

| 経路 | 問題 |
|---|---|
| `lib/mmr.ts` の `performFullMmrRebuild` | 内訳を**計算しているのに** upsert する列に `mmr_breakdown` を含めていなかった |
| `app/api/riot/match-sync/route.ts` | 内訳を返さない `calculateNewMMR()` を使用。更新列にも `mmr_breakdown` が無かった |

どちらも `mmr_delta` だけを更新し、内訳は `/api/match/record` が最初に書いた値のまま
固定されていた。**再計算が走るたびにズレが広がる**構造だった。
両方 `calculateNewMMRDetailed()` を使い、必ずセットで保存するようにした。

**過去データの是正**

- `04_PORTAL/scripts/rebuild_mmr.ts` を新設（`--apply` で実行 / 引数なしは接続確認のみ）。
- 実行結果: **食い違い 133件 → 3件**。所要1.7秒。
- **総合MMRが変化した人は0名**だった（順位・ティア表示への影響なし）。
  ズレていたのは内訳の表示値だけで、実際のレート計算は正しく行われていた。
- ⚠️ 実行前バックアップ: `99_ARCHIVE/db_backups/ktm_players_before_mmr_rebuild_20260923_0449.json`
  および `ktm_match_participants_before_mmr_rebuild_20260923_0449.json`（**gitignore配下＝ローカルのみ**）。

**残る3件について（対応不要）**

いずれも `tamias`（MID×2 / SUP×1）で、差は1ポイント。
**`ktm_players` に登録が無い**（退会済み）ため `performFullMmrRebuild` の対象外になる。
参加記録は68件残っているが、名簿に居ないプレイヤーのMMRは計算されない仕様のため
これは正常な挙動。是正したい場合は名簿へ復帰させるしかない。

**この調査で分かったこと（記録）**

- 該当試合のロールはデーモン稼働中に `riot/match-sync` が Riot 実データで
  TOP→JG に上書きしていた（かずき選手は実際にはJGを使用）。この上書き自体は正しい挙動。
- MMRの計算式そのものにバグは無かった。`+63` は「格上に勝利」＋「当時TOPが4戦目で
  プレースメント×1.5」という**古いロール前提の値が残っていた**もの。再計算後は妥当な値になった。


- [x] **MMR変動の内訳をUIに表示する**（2026-09-24 完了）
  - **背景**: 2026-09-23に「KDA 0/3/9 なのにMMRが+63なのはなぜ？」という疑問が出たが画面からは分からなかった。DBの `ktm_match_participants.mmr_breakdown` を活用してツールチップで可視化。
  - **実装内容**:
    1. `04_PORTAL/src/app/api/match/history/route.ts`: `ktm_match_participants` の取得列に `mmr_breakdown` を追加。
    2. `04_PORTAL/src/app/ktm-admin/MatchHistoryPanel.tsx`: `Participant` に `mmr_breakdown` を追加し、スワップ処理および表示部へ連携。`formatMmrBreakdown` ヘルパーで「`勝利+18 / 格上補正+7.3 / KDA+5 / プレースメント×1.5 / 計 +63`」形式のホバーツールチップ（`title` 属性 ＋ `cursor-help`）を付与。
    3. `04_PORTAL/src/lib/__tests__/mmrBreakdownFormat.test.ts`: 通常・格差・高勝率・プレースメント・お祭り・フォールバックの全境界値テスト4件を新設。
  - **検証結果**: `npm test`（全58件パス）、`npx tsc --noEmit`（エラー0件）、`npm run build`（ビルド成功）を確認済み。
  - **表示先**: 一般メンバー向け試合履歴（`/history`）および管理者画面（`/ktm-admin`）の両方に自動反映。

### ✅ カジノに新ミニゲーム「ブッシュ・スカウト」を追加（2026-09-23 完了 / コミット `c9536bbf`）

同日に削除したポロ・クラッシュの代わり。5×5の25マスからキノコ（地雷）を避けて開けていき、いつでも引き返して利確できるゲーム。キノコ 1 / 3 / 5 / 10 個、ベット 100 / 500 / 1000 コインの選択制、還元率95%。

- **クラッシュの失敗を構造的に回避**: 時間の概念を持たず、倍率が動くのはマスを開けた瞬間だけ。判定がリクエスト1回で完結するため、通信遅延が結果に一切影響しない。
- **倍率設計**: `0.95 ÷ (そこまで無事に開ける確率)`。どのマス数で引き返しても期待値が一定＝最適戦略が存在しない。実効RTP 94.2〜96.0%（切り捨てのぶん95%を下回る）。全マス数の期待値を検算するテストを追加済み（`npm test` に組み込み済み）。
- **発行上限**: 1ラウンドの払い戻しは50,000コイン（スロットの最大配当と同じ天井）で打ち切り、到達時は自動で引き返す。コイン総供給が約15,000枚規模のため、カジノ全体の最大発行額を増やさない。
- **詳細と設計判断の理由は `HANDOVER_CLAUDE.md` の §2.10 を参照。**

- [x] **migration `82_mines_sessions.sql` の本番適用**（2026-09-23 ユーザーが適用済み）
- [x] **デプロイ後の実機確認**（2026-09-23 完了）: タブ表示 / 開始→開封→引き返しでのコイン増減 / ページを閉じてからのラウンド復帰 / 敗北時の盤面公開、の4点を実際に遊んで確認済み（大勝ち時のDiscord通知も既存通知関数と同一実装のため確認完了扱いとしてクローズ）。

### 🎲 カジノ新ゲーム: チャンピオン・ハイロー（未着手・2026-09-23 起票）

- [ ] **チャンピオンのステータス当て「ハイロー」をカジノに追加する**
  - **内容**: DataDragon の基礎ステータス（基礎AD・移動速度・基礎HP・攻撃速度など）を使い、
    「次に出るチャンピオンは、いま表示されているチャンピオンより上か下か」を連続で当てる。
    当てるたびに倍率が乗り、いつでも引き返して（利確して）よい。
  - **なぜ成立するか**: ブッシュ・スカウトと同じターン制で、判定がリクエスト1回の中で完結する。
    時間の概念がないため、ポロ・クラッシュを潰した「通信遅延で画面とサーバーがズレる」問題が起きない。
  - **流用できるもの**（2026-09-23 のブッシュ・スカウト実装で作った資産）:
    - `mines_sessions` と同じ「サーバー側だけが答えを持つ ＋ pending→settled の原子的UPDATE」方式
    - ベット投入と利確を2回に分けて `coin_transactions` へ記録する流れ（`reason` に `highlow` を追加する）
    - 進行中ラウンドへの復帰（`action: 'STATE'`）。これが無いとリロードでコインが消えたように見える
  - **先に決める必要があること**:
    1. **公平オッズの算出方法**。ブッシュ・スカウトと違い、上/下の確率が毎ターン変わる
       （残り候補のうち現在値より大きいチャンピオンが何体か、で決まる）。
       毎ターン実カウントして倍率を出す実装が要る。ステータスの分布が偏っている点にも注意。
    2. **同値（タイ）の扱い**。基礎ADなどは同じ値のチャンピオンが複数いる。
       「同値は当たり扱い」か「引き直し」かを決めないと、倍率計算が合わなくなる。
    3. **どのステータスを使うか**。使う数値によって難易度と知識勢の有利さが大きく変わる。
       知識で必ず勝てる状態になっていないか、実データで確認してから決める。
  - **還元率**: 既存ゲームに合わせて 95% を想定（スロット93% / バカラ約99% の間）。
    払い戻し上限もブッシュ・スカウトと同じ 50,000コインに揃える（コイン総供給が約15,000枚規模のため）。
  - **経緯**: 2026-09-23 にカジノの新ミニゲームを検討し、ブッシュ・スカウト（Mines型）を先に実装した。
    ハイローはLoLらしさでは上だが、上記1〜3の設計が固まっていないため後回しにした。

### 🤔 判断が必要（対応方針確定）
- [x] **ポロ・クラッシュのDBテーブルをどうするか**（2026-09-30 方針確定・保持）
  - ゲーム本体は 2026-09-23 に削除済み。`crash_used_tokens` は Migration 79 で既に DROP 済みであることを実測確認。
  - `crash_sessions`（全112件、容量数十KB）は、12件の返金記録（`refunded: true`）を含む**不可欠な監査証跡**であるため、DB内にそのまま永久保持する方針を確定。
  - ⚠️ `coin_transactions.reason` の `'crash'` は過去データが参照するため型から外さないこと。
  - **なぜ削除したか（再検討を防ぐための記録）**:
    クライアントはサーバーに問い合わせないと「まだ飛んでいるか」を判断できず、
    最速でもSTART応答の往復（実測0.6〜1.0秒）を待つ必要がある。一方クラッシュ値の
    分布（`0.96/(1-r)`）では**約3割のラウンドが1秒以内に爆発**するため、
    その区間は「爆発済みなのに画面は飛行中」になり、利確が必ず失敗する。
    5回修正しても構造的に消せず（判定時刻・時計合わせ・ロングポーリング・
    アンチチートのクランプ化・START応答での即時開示）、最後は
    「押した瞬間から飛ばす」か「公平に判定する」かの二者択一になった。
    HTTPポーリング＋サーバーレスの構成でリアルタイム性が要るゲームは成立しない、
    というのが結論。再挑戦するならWebSocket等の常時接続が前提になる。

- [x] ~~**勝敗予想ベットの精算が「試合」を特定していない**~~ → 2026-09-29 **候補3（`balancer_predictions.id` でラウンド紐付け）で修正**。
  - **症状だった**: `match/record` が `task_type='custom_bet'` かつ `status='pending'` の edge_tasks を
    **試合を問わず全件**拾い、いま記録した試合の勝者で精算していた。2試合目のベットが1試合目の結果で
    精算されて消える。オッズ集計（`fetchPendingBetTotals`）も試合横断だった。
  - **採った方式（ユーザー判断=堅牢案）**: ベット作成時に、精算側が「1ラウンド」とみなしている
    `balancer_predictions` の未確定(match_id=null)最新行の `id` を取得し、payload に `round_id` として保存。
    精算側は (4.5) でロスター一致した予測の `id`（=`settledRoundId`）に紐づくベットだけを精算する。
    `matchId` を渡す旧経路（`match_id`・全件 null）は使わない。
  - **実装**:
    - `lib/betOdds.ts`: 絞り込み規則の単一の真実として純関数 `filterBetsByRound()` を新設。
      `round_id` 未紐付けのレガシーbet(null)は取りこぼし防止のため常に含める。`fetchPendingBetTotals(supabase, roundId?)` も
      同関数でラウンド内に限定（省略時は従来どおり全件）。
    - `api/bet/route.ts`: 現ラウンドの `round_id` を取得し payload に保存。オッズもラウンド内で算出。
    - `api/match/record/route.ts`: `settledRoundId` を (4.5)→(4.6) へ巻き上げ、`filterBetsByRound` で精算対象を限定。
      予測を特定できない場合は従来どおり全件精算（宙に浮かせない）。
  - **検証**: `filterBetsByRound` の回帰テスト5件を追加。`npm test`（全75件パス）／`npm run build` 成功。
  - **ついでに確認したこと（変更なし）**: 連勝ストリーク（2連勝+5% / 3連勝+10% / 5連勝+20%）の
    ロジック自体は正常。精算実績が1件だけ（`streak=1 → 0%`）でボーナス発生実績はまだ無いがバグではない。

### 🗑️ 「AI Agent Gateway 設定室」(`/admin/prompts`) の削除（2026-09-29 ユーザー判断で削除決定・作業途中）

**2026-09-29 の再調査で、2026-09-23 の前提が誤っていたと判明した。**

- ❌ 旧TODOは「`youtube_bible_forge`（動画解析が使用中）」と書いていたが、**現役の動画解析はこのテーブルを読んでいない**。
  現役ワーカー `scripts/youtube_worker.py` はプロンプトを**ファイル内にハードコード**している（`VIDEO_PROMPT` 189行 / `SHORTS_PROMPT` 245行）。
- `agent_prompts` を実行時に読む経路の実態（全て休止・未使用）:

  | 参照元 | 実態 |
  |---|---|
  | `_LOL/youtube_absorber.py:516`（`youtube_bible_forge`） | `absorber.yml` は**2026-07-31に定期実行停止**。`workflow_dispatch` の手動実行のみ |
  | `v2_CORE/api.py:261`（汎用リーダー） | FastAPI Gateway 自体が**本番未使用**（HANDOVER §3.5） |
  | `sre_error_analysis` | **コード参照ゼロ**。`sre_daemon.py` は2026-07-26に削除済み |
  | `monetize_*` 5件 | **コード参照ゼロ**。収益化パイプラインは2026-07-26〜08-04に削除済み（[[project-side-business-scope-deferred]]） |

- **結論**: この画面で編集しても**現役の解析品質は1文字も変わらない**。「ここを編集すればAIの挙動が変わる」という誤解を生むため削除する
  （2026-09-22に一掃した「由来を偽る表示」と同種のリスク）。画面は `agent_prompts` の純CRUDエディタのみで、他の機能は持たない。

**進捗**

- [x] **管理画面・APIフォルダの削除** → **2026-09-29 完了**
  - `D:\my_work\04_PORTAL\src\app\admin\prompts`（画面 347行）
  - `D:\my_work\04_PORTAL\src\app\api\admin\prompts`（API 45行）
  - 削除後、`npx tsc --noEmit`、`npm test`（75件全パス）、`npm run build` で正常ビルド・到達不能コード完全解消を確認済み。
- [x] **DB行の整理** → **2026-09-29 完了**（Supabaseコネクタ経由で実行）。`agent_prompts` **7行 → 1行**。
  - 削除した6件: `monetize_first_draft` / `monetize_review_article` / `monetize_persona_critique` / `monetize_rewrite_critique` / `monetize_x_thread` / `sre_error_analysis`（いずれもコード参照ゼロ）。
  - **残した1件**: `youtube_bible_forge`（休止中の `youtube_absorber.py` を手動実行する余地を保つため）。
  - ⚠️ **バックアップ**: `99_ARCHIVE/db_backups/agent_prompts_deleted_20260929.json`（6件全文・復元手順つき）。
    **`99_ARCHIVE/` は `.gitignore` 配下＝ローカルPCにしか無い**。PC乗り換え・ディスク障害で失われる点に注意。
  - 📌 **判明した追加事実**: 残した `youtube_bible_forge` を含め、**7件すべてが `default_model: gemini-2.5-flash`** を指していた。
    これは「無料枠0で常時429」としてHANDOVER §2（2026-08-09〜10）で対処済みの**死んだモデル**。
    つまり `youtube_absorber.py` を今手動実行しても429で失敗する。復活させる場合は
    `gemini-model-health-check` スキルで生存確認したモデルIDへ差し替えが必要。


- [x] ~~**到達不能コード15ファイル（166.8KB）＋未使用依存2件の扱い**~~ → 2026-09-22 完了。
  **到達不能コードは0件になった**（削除9件 / 復活3件 / 未使用依存2件を除去）。
  再確認: `node 04_PORTAL/scripts/find_dead_code.mjs`
  - エントリポイント213件から**到達可能性を辿る解析**を実施（`src/` 配下で動的importは0件のため
    取りこぼし無し）。結果は「到達可能348件 / **到達不能15件**」。
  - ⚠️ **削除してもパフォーマンスは1バイトも改善しない**。どこからもimportされていないため
    既にバンドルへ含まれていない。効くのは①AIのコンテキスト消費（171KBが検索対象から外れる）
    ②開発時の混乱解消 ③**無駄な作業の防止**の3点。
    実際 2026-09-22 に `SoloQReflectionModal.tsx`（alert→トースト化）と
    `MatchupWarningCard.tsx`（偽装データ一掃）を編集したが、**どちらも死んだファイルで作業が無駄になった**。
  - **再調査用スクリプト**: 下記を実行すれば同じ解析を再現できる（都度書き直さないこと）。
    `04_PORTAL/scripts/find_dead_code.mjs`

  **(a) 重複・未使用が明白 → 2026-09-22 に削除済み**

  | ファイル | 理由 |
  |---|---|
  | ~~`src/components/BottomNav.tsx`~~ | `Sidebar.tsx:423` に同等のスマホ用ボトムナビが実装済み。完全な重複 |
  | ~~`src/components/Skeleton.tsx`~~ | `components/Feedback.tsx:14` に同名の生きた `Skeleton` 実装あり |
  | ~~`src/lib/supabaseBrowserClient.ts`~~ | 参照0件（`lib/supabaseClient.ts` が生きている） |

  - `clsx` / `tailwind-merge` も `package.json` から削除済み（参照0件・`cn()`ヘルパーも不在）。
  - ⚠️ **`src/lib/apiClient.ts`（2.0KB）は削除を保留した**。参照元が
    `SoloQReflectionModal.tsx` と `TiltDiagnosisPopup.tsx` の2つだけで、
    どちらも下記(b)の**復活候補**だから。(b)の方針が決まってから処理すること。
  - 削除後の実測: 到達不能 15件/166.8KB → **12件/161.6KB**。型チェック通過。

  **(b) 告知済み機能 → ユーザー判断により2026-09-22に一部を削除**

  削除済み（計 68.8KB / gitの履歴からは復元可能）:

  | ファイル | 機能 |
  |---|---|
  | ~~`app/coach/TiltDiagnosisPopup.tsx`~~ | ティルト診断ポップアップ（3段階判定・他責検出） |
  | ~~`app/coach/AngerDetoxModal.tsx`~~ | 上記から呼ばれるクールダウンモーダル（連鎖的に孤立） |
  | ~~`components/coach/JgMatchupPredictor.tsx`~~ | JG対面予測（手書き12体分） |
  | ~~`components/coach/JgSkillMasteryChecklist.tsx`~~ | JGスキル習熟チェック（4ステップ8項目） |
  | ~~`components/coach/FocusStickyBar.tsx`~~ | 今日の集中テーマバー（localStorageのみ） |
  | ~~`app/coach/MatchupSmartCard.tsx`~~ | 対面スマートカード |

  - ⚠️ `lib/tiltBlameDetector.ts` は**削除していない**。`app/api/coach/analyze/route.ts`
    （生きているAPI）が使っているため。
  - 削除後の到達不能: 15件/166.8KB → **6件/100.6KB**。型チェック通過。

  **復活させたもの（2026-09-22）**

  - [x] **⑤ `app/coach/SoloQReflectionModal.tsx` を `coach/page.tsx` へ配線**
    - `POST /api/soloq/reflections` を叩くのはこのファイルだけで、`MySoloQDashboard` は
      表示専用（GETのみ）だった。未配線のままでは**振り返りを新規作成する手段が無く**、
      「書き込み手段のない陳列棚」になっていた。
    - 「📝 ソロQの振り返りを記録する」カード＋「振り返りを書く」ボタンを
      過去ログ履歴の直上に設置。保存すると `refreshSignal` で `MySoloQDashboard` が再読込される。
  - [x] **⑦ `app/admin/knowledge/PendingInsightsPanel.tsx` を管理画面へ配線**
    - `/admin/knowledge` に「✅ 承認待ちナレッジ」タブを追加（`ingestMode === 'pending'`）。
    - **滞留していた336件**（`personal_knowledge` の `review_status='pending'`、
      記事本体298件＋atomic insight 38件、2026-08-16〜09-18）をここから承認・却下できる。
    - `champion_trend_worker.py:221` が `review_status=eq.approved` で絞るため、
      承認するまでチャンピオン辞典へ反映されない点は変わらない。**承認作業自体は今後の運用タスク**。
  - 到達不能: 15件/166.8KB → **2件/31.8KB**（残りは⑧とその依存のみ）。型チェック・ビルド・テスト48件すべて通過。

  - [x] **⑧ `app/coach/MatchupWarningCard.tsx` を復活**（2026-09-22）
    - ⚠️ 当初「APIが存在しないので新規実装に2時間以上」と見積もったが**誤りだった**。
      既存の `/api/soloq/matchup-warning` が要求どおりの入出力
      （`POST { champion, enemyChampion }` → `{ warning: { memo, laneRecord, personalDossier, lastUpdatedAt } }`）
      を返すため、**URLを1行向け直すだけ**で動いた。
    - `coach/page.tsx` の試合前タブ、対面ブループリントの直下へ配線
      （`sharedChampion` / `sharedEnemyChampion` をそのまま渡す）。
      敵チャンピオン未選択のときは何も表示しない（`if (!enemyChampion) return null`）。
    - ⑤で記録した振り返りが、次の試合前にこのカードとして返ってくる循環の出口にあたる。
    - ⚠️ **既存APIは `verifyAdminSession` を要求するため、管理者以外では `warning` が常に null**。
      一般メンバーにも出すなら認証条件の見直しが必要（未対応・要判断）。
    - これにより**到達不能コードは0件**になった（2026-09-22時点。`node 04_PORTAL/scripts/find_dead_code.mjs` で再確認可能）。

- [x] ~~**巨大ファイルの分割は「先に実測」してから判断する**~~ → 2026-09-22 実測完了。
  **結論: ソースファイルの分割だけでは効果が無い。やるなら遅延読込とセットでないと意味がない。**

  **実測方法**: Next.js 16 (turbopack) はビルド時にルート別サイズを出さないため、
  本番で配信されるHTMLから `<script src="/_next/static/...">` を拾って実サイズを合計した。
  再現スクリプトは `scripts/measure_bundle.py`。

  | ページ | 初回JS | chunk数 |
  |---|---|---|
  | /balancer | **1,069 KB** | 14 |
  | /coach | 1,065 KB | 14 |
  | /ktm-admin | 996 KB | 14 |
  | /casino | 984 KB | 14 |
  | /champions | 798 KB | 13 |
  | /mentorship | 792 KB | 13 |
  | /analyzer | 751 KB | 13 |
  | /leaderboard | 717 KB | 13 |
  | / ・ /synergy | 668 KB | 11 |

  **内訳を分解した結果**

  - **全ページ共通のchunk 11本＝668 KB**。これは全ページが必ず払う。最大は単一で228 KB。
  - `/balancer` 固有はわずか**3本400 KB**（230 KB / 146 KB / 24 KB）。

  **なぜ分割では減らないのか**

  `balancer/page.tsx` はソース176 KBだが、固有バンドルは400 KB。
  差はインポートした依存の分であり、**ファイルを複数に割っても import され続ける限りバンドルは1バイトも減らない**。
  2026-09-22にプレイヤー詳細ページで 1,325→925 KB を達成できたのは、
  分割したからではなく `next/dynamic` + `ssr:false` で**遅延読込にしたから**。

  **効果が見込める順（着手するならこの順序）**

  1. **共通668 KBの削減**（全ページに効く・最大の梃子）。228 KBの単一chunkの中身を特定し、
     framer-motion 等の重い依存が全ページで eager に読まれていないか確認する。
  2. `/balancer`・`/coach` 固有400 KBのうち、初期表示に不要な部分を `next/dynamic` 化。
  3. ソース分割そのものは**可読性の改善としてのみ**価値がある（性能は変わらない）。

  **共通668 KBの内訳（2026-09-22 追加調査）— 削減余地はほぼ無い**

  | chunk | サイズ | 中身 |
  |---|---|---|
  | 3-wg5n_f-syfd.js | 228 KB | react-dom（シグネチャ検出） |
  | 082gtuuts-7wf.js | 152 KB | React/Next.jsランタイム |
  | 0c0hxoamwjsbw.js | 110 KB | 同上（特定できず） |
  | 3b8urmju55db5.js | 51 KB | 同上（特定できず） |
  | 0z8fecms1sb_d.js | 39 KB | canvas-confetti + next/image |
  | 0ojltk_26jag0.js | 35 KB | lucide-react |
  | その他5本 | 53 KB | turbopackランタイム等 |

  - **大半が React + Next.js のフレームワーク本体**で、アプリ側から削れない。
  - ルートレイアウト(`app/layout.tsx`)が読む自作コンポーネントは7つだけで、
    外部依存は **lucide-react** と **canvas-confetti** のみ。
    `Sidebar.tsx`(27.8KB) / `PwaRegister.tsx`(9.8KB) / `Toaster` / `BackButton` /
    `BackToTop` / `OfflineNotifier` / `ThemeContext` といずれも小さい。
  - **framer-motion・recharts・supabase-js は共通chunkに含まれていない**（既にルート分割済み）。
  - 唯一の候補は `canvas-confetti`（39 KBチャンクに同梱）。`Sidebar.tsx` が読んでいるが
    演出用途なので遅延読込にできる。ただし**効果は最大39 KB（全体の6%）で、
    しかも next/image と同一chunkのため実際の削減はそれ未満**。労力に見合わない。
  - ⚠️ 本番・ローカルとも完全にminifyされており、chunkから `node_modules` のパスは取れない。
    シグネチャ文字列（`Minified React error` 等）での推定が限界。
    より厳密に見るならソースマップを有効にしてビルドし直す必要がある。


  **/coach の遅延読込を実施（2026-09-23）— 1,065 KB → 813 KB（-252 KB / -24%）**

  - 原因: 3つのステップタブが `className={... : 'hidden'}` で切り替えられており、
    **全タブが同時にマウントされていた**。初期表示に不要な「試合中」「試合後」の
    コンポーネントまで最初に読み込まれていた。
  - 対応:
    - `ScoutTab` / `FiveVFiveSimTab` / `PostGameDeepAnalyticsDashboard` /
      `MatchFightsAnalyticsCard` / `MySoloQDashboard` / `SoloQReflectionModal` を
      `next/dynamic` + `ssr:false` 化。
    - ⚠️ **dynamic 化だけでは効かない**。常にレンダリングされているとチャンクが即取得される。
      `visitedTabs` を導入し「一度も開いていないタブは描画しない」ようにして初めて効いた。
    - 一度開いたタブはマウントしたままにするため、**タブを往復しても入力や取得済みデータは消えない**。
  - 検証: 型チェック エラー0 / ビルド成功 / テスト48件パス / ローカル本番ビルドで実測。

  ⚠️ **計測時の落とし穴（2026-09-23に踏んだ）**: `npm start` を実行しても
  **既存のNodeプロセスが残っていると古いビルドを配信し続ける**。
  このとき新しいchunkは404になり、`measure_bundle.py` は404を0バイトとして数えるため
  **「668 KBに激減した」という誤った結果が出た**（実際は813 KB）。
  計測前に `taskkill //F //IM node.exe` でプロセスを落とすこと。

  **残る候補**: `/balancer` 1,068 KB（固有400 KB）。同じ手法が使えるかは未調査。


  **/balancer の遅延読込を実施（2026-09-23）— 1,068 KB → 1,027 KB（-41 KB / -3.8%）**

  - `ProfileModal`(13.8KB) / `BalancerStadiumView`(9.5KB) / `AramRotationPanel`(31.3KB) を
    `next/dynamic` + `ssr:false` 化。3つとも元から条件付き描画なのでそのまま効いた。
  - **削減幅は `/coach` より小さい**。固有バンドル359 KBの大半は `page.tsx` 本体
    （ソース176 KB）で、バランサーは1画面完結のツールのため初期表示に必要な部分が多い。
    これ以上はページ本体の作り替えが必要で、投資対効果が悪い。

  **⚠️ 実測で判明: 未使用importの削除ではバンドルは減らない**

  `balancer/page.tsx` の `MatchRecordPanel`(22.2KB) など、**import されているのに一度も
  使われていない** default import が計3件見つかった。当初「バンドルに無駄が乗っている」と
  考えて削除したが、**`/leaderboard` は削除前後で 716 KB のまま変化しなかった**。
  つまり **turbopack は未使用importを既にツリーシェイキングで除去していた**。
  削除の価値はコードの見通しであって、性能ではない。
  検出スクリプト: `04_PORTAL/scripts/find_unused_imports.py`

  **バンドル最適化の到達点（2026-09-23時点）**

  | ページ | 改善前 | 現在 |
  |---|---|---|
  | /coach | 1,065 KB | **813 KB** |
  | /balancer | 1,068 KB | **1,027 KB** |
  | 全ページ共通 | 668 KB | 668 KB（React/Next本体のため削減不可） |

  **総合結論: バンドル最適化は既にほぼ限界。これ以上は投資対効果が悪い。**
  やるとすれば `/balancer`・`/coach` 固有400 KBの遅延読込のみ。


- [x] **孤立（未リンク）ノートの索引登録**（2026-09-22 完了）— 48件 → **22件**
  - 登録したもの: DB生成の戦術バイブル12体（akali/akshan/alistar/ambessa/belveth/brand/
    caitlyn/diana/renekton/talon/vi/yuumi）、`.agent/rules` 8件、`.agent/resources` 2件、
    `KTM_USER_GUIDE.md`、`STRATEGY_ASSETS/INDEX.md`、KTM Botのテスト仕様2件。
  - **残る22件は意図的に登録していない**（次に棚卸しする人が再調査しないよう明記する）:
    - `02_FACTORY/PROMO/` 配下20件 … Xスレッド等の**自動生成ドラフト**。生成のたびに増えるため
      個別列挙は保守不能。NEXUS_INDEXには**ディレクトリ単位でリンク**済み。
    - `02_FACTORY/note_drafts/` 2件 … `.gitignore` 対象の下書き。公開管理はポータルの
      `/admin/analytics` と `note_articles` テーブル側で行う方針（NEXUS_INDEXに記載済み）。
  - ⚠️ `audit_knowledge_links.py` は**ファイル単位のリンクしか見ない**ため、
    ディレクトリをリンクしても配下は孤立と判定される。上記22件が残り続けるのはこの仕様による。
  - `scripts/audit_knowledge_links.py` に `--full` を追加（10件で打ち切らず全件表示）。

- [ ] **コイン供給全体の見直し**（低優先・上記の判断次第）
  - おみくじの期待値が1人1日165コイン。19名全員が毎日引くと**5日で総流通量が倍**になるペース。
    試合精算も1試合あたり約2,550コインを発行する（参加100×10 + 勝利150×5 + MVP200 + 各賞200×3）。
  - `findOrCreatePlayer` の `autoCreate: true` は初期所持金1000コインで新規作成するため、
    アカウントを増やせばコインを増やせる経路も残っている（認証修正で悪用はしにくくなった）。

---

## 🚨 KTM Botのデプロイが3日間失敗し続けていた（2026-09-29 発見・修正済み）

> **発見の経緯**: 「プッシュしても動かなくならないように」という依頼を受け、`npx wrangler deploy --dry-run` で
> 事前検証したところビルドが失敗した。**コミットするだけでは気づけない類の障害**だった。

- **症状**: `src/handlers/components.js` が**構文エラー**（`Unexpected end of input`）でバンドルできず、
  `ktm-bot-deploy.yml`（masterへのpushで自動デプロイ）が**3回連続で失敗**していた。

  | 実行日時 | 結果 |
  |---|---|
  | 2026-09-27 07:15Z | ❌ failure |
  | 2026-09-27 05:25Z | ❌ failure |
  | 2026-09-27 03:38Z | ❌ failure |
  | 2026-09-26 05:39Z | ✅ success ← **本番Workerで動いていたのはこの時点のコード** |

- **影響**: 師弟マッチング関連の3コミット（`b430fecb` / `b16ef60c` / `29f26db2`、いずれも2026-09-27）が
  **本番に一度も反映されていなかった**。Discord内の弟子登録・師匠登録モーダル、ワンポチ指導引き受け、
  レーン単一選択化のすべてが未稼働。**ポータル側だけ先に動いている非対称な状態だった。**
- **根本原因**: `b430fecb` で師弟モーダルのブロックを挿入した際、直前の
  `if (customId === 'portal_register') { ... }` を**閉じる `}` を上書きして消していた**。
  挿入位置が `});` の直後で、閉じ括弧が1つ足りないまま以降のコードが全部その `if` の中に入り、
  ファイル末尾で閉じきらずEOFに到達していた。
- **修正**: 欠落していた `}` を復元（`components.js` 148行の直後）。
- **検証**: `node --check` で `src/` 配下の全JSファイルを確認（全件OK）、
  `npx wrangler deploy --dry-run` でバンドル成功（267.11 KiB / gzip 60.42 KiB）を確認。
- **再発防止（2026-09-29 実装済み）**: これは [[project-orphaned-automation-pattern]] の変種
  （自動化は存在するが、**失敗が観測されていない**）。2方向から塞いだ。

  **① CIでコミット時点に落とす（`.github/workflows/ci.yml` に `bot-syntax` ジョブを追加）**
  - `src/` 配下の全JSへ `node --check` を当て、続けて `npx wrangler deploy --dry-run` でバンドル検証。
  - 対象パスに `03_SYSTEMS/ktm_bot/**` を追加（従来は `04_PORTAL/**` のみが対象で、Botは**CIの管轄外**だった）。
  - **実証済み**: 当時壊れていた版（`b430fecb` の `components.js`）に対してCIと同じロジックを実行し、
    構文エラーを検出して exit 1 になることを確認した。「チェックを足したが実は検出できない」を避けるため実測した。
  - ⚠️ 「04_PORTALに変更が無ければテストをスキップ」という条件は**意図的に付けていない**。
    `github.event.commits` は20件で打ち切られる等の取りこぼしがあり、**テストが黙ってスキップされる方が危険**。

  **② デプロイ失敗を通知する（`ktm-bot-deploy.yml`）**
  - 失敗時に**GitHub Issueを自動作成**する（`permissions: issues: write` ＋ 標準の `GITHUB_TOKEN`）。
    **新しいシークレットが不要**なので今日から機能する。既に同じIssueが開いていればコメント追記に留め、量産を防ぐ。
  - `DISCORD_KTM_WEBHOOK_URL` が**GitHub Secretsに登録されていれば**Discordへも送る。
    未登録なら `::warning::` を出してスキップ（Issueは出るので無通知にはならない）。
    - [ ] **任意のユーザー作業**: Discordにも飛ばしたい場合は `gh secret set DISCORD_KTM_WEBHOOK_URL`
      で登録する（値は `04_PORTAL/.env.local` の同名変数。AIからの読み出しは機密保護でブロックされた）。
  - Issue本文には「本番Workerは古いコードで動き続けるので画面上は壊れない」旨と、
    ローカルでの再現コマンドを載せてある。

---

## ✅ 本番で404になっていたポータルリンクを全滅（2026-09-29）

> **発見の経緯**: 師弟機能の動作確認方法を調べる過程で、作業ツリーに**前セッション由来の未コミット修正**
> （URLの差し替え4箇所）が残っていることに気づき、実際に叩いて確認したところ本番で404だった。

- **実測**: `ktm-portal.vercel.app` → **HTTP 404**（死んでいる） / `my-work-8jbd.vercel.app` → HTTP 200。
- **なぜ本番で404が出ていたか**: `discordMentorship.ts` の `PORTAL_BASE_URL` は
  `process.env.NEXT_PUBLIC_APP_URL || 'https://ktm-portal.vercel.app'` で、
  **`NEXT_PUBLIC_APP_URL` はVercelに登録されていない**（環境変数一覧をコネクタで実測確認）。
  つまり常にフォールバックの死んだドメインが使われていた。
- **メンバーが実際に踏んでいた404**:
  - `#🤝師弟募集` のピン留めダッシュボードの「🌐 ポータルで詳細を見る」ボタン
  - 同Embed内の「Webポータルで詳細を見る・オファーを送る」リンク
  - オファー成立時のDMに載る `/mypage` `/mentorship` リンク
- **未コミット修正は不完全だった**ため、以下を追加で修正して全滅させた:

  | 箇所 | 状態 |
  |---|---|
  | `lib/discordMentorship.ts` / `api/mentorship/matches/route.ts`（計4箇所） | 前セッションの未コミット修正（今回コミットに含めた） |
  | `scripts/create_active_threads.mjs`（2箇所） | **漏れていた**（今回修正） |
  | `ktm_bot/src/handlers/components.js:292` | 到達しない死んだフォールバック（`CONFIG.PORTAL_URL` が正しいため無害だが混乱を招くので揃えた） |
  | `ktm_bot/wrangler.toml:9` | **コメントアウトされた設定例が404を指していた**。有効化すると壊れるので修正 |

- **デプロイだけでは直らなかった**: ダッシュボードは「プロフィール登録やマッチ操作が起きた時」にしか再生成されないため、
  修正版をデプロイしてもピン留め済みメッセージは古い404リンクを保持したままだった。
  `POST /api/mentorship/sync-discord` を叩いて作り直し、`{"ok":true}` を確認済み（2026-09-29）。
  **今後もこの種の「Discordに投稿済みのメッセージを直す」修正では、デプロイ後に再同期が必要**。
- **残る改善余地（未対応）**: Vercelに `NEXT_PUBLIC_APP_URL` を登録すればフォールバックに依存しなくなる。
  現状はハードコードされた正しい値に揃えただけなので、独自ドメインを取る等でURLが変わると同じ問題が再発する。

- [x] **`/api/mentorship/sync-discord` の認証ガード配備**（2026-09-29 完了）
  - `sync-discord/route.ts` にセッション検証（`getAuthSession()`）および Bot シークレット検証（`verifyBotSecret()`）を適用。未認証リクエストを 401 拒否。
  - Web UI（ログイン中ユーザー）と Bot からの正当な同期呼び出しのみを許可し、外部からの無制限なDiscordレート消費・メッセージ編集乱発を遮断。
  - ※ 関連課題: `/api/mentorship/profiles` POST（他人名義作成防止）は別TODOとして管理。

---

## 🚨🚨 公開リポジトリに本番認証キーが平文で載っていた（2026-09-29 発見・要ローテーション）

> **経緯**: 「Discord Botの改善ポイント調査」で静的監査を行った際に発見。`gh repo view` で
> **リポジトリが PUBLIC** であることを確認済み。

### ① Worker の `INTERNAL_GAS_SECRET` が公開されていた（実害あり・実証済み）

- `.github/workflows/ktm-bot-cron-backup.yml:78` に `KEY="${TRIGGER_KEY:-ktm_v3_internal_secret_2026}"` とハードコード。
- `KTM_TRIGGER_KEY` は GitHub Secrets に**未登録**だった → **この既定値が実際に使われていた**。
- **証拠**: バックアップcronの直近6回が全て `success`（ワークフローはHTTP 200以外で `exit 1` する）。
  つまり Worker 側の `INTERNAL_GAS_SECRET` = `ktm_v3_internal_secret_2026` が確定。
- **誰でも叩けた操作**（`/trigger-scheduled?key=...&mode=...`）:
  募集カードの投稿 / 20:00判定の告知（「中止」等をチャンネルへ）/ `weekly_recruit_reset`（**出ているカードを全部閉じて作り直す**）/ メンバーへのDM送信。
- ⚠️ **git履歴は公開のまま永久に残るため、ファイルを直しただけでは無効化されない。ローテーションが必須。**

### ② 宝くじ抽選API の合言葉が公開されていた

- `04_PORTAL/src/app/api/cron/lottery/route.ts:19` に `process.env.ADMIN_SECRET_KEY || 'ktm_admin_secret'`。
- `ADMIN_SECRET_KEY` は Vercel に**未登録**（環境変数一覧をコネクタで実測）→ 既定値が有効だった。
- `executeLotteryDraw()` は**コインを払い出す**処理。さらに User-Agent に `vercel-cron` を含めるだけで通る経路もあった（ヘッダは偽装可能）。

### 対応済み（コード側・2026-09-29）

- [x] ワークフローのハードコード既定値を**撤去**。`KTM_TRIGGER_KEY` 未設定なら `::error::` を出して `exit 1`（黙って公開鍵で動かない）。
- [x] 宝くじAPIを **`CRON_SECRET` の Bearer のみを正**に変更。`ADMIN_SECRET_KEY` は既定値を持たせず、未設定なら `?key=` 経路自体を閉じる。
      User-Agent による判定も撤去（`CRON_SECRET` が設定済みなら Vercel Cron は自動でBearerを付けるため `vercel.json` の定期実行はそのまま動く）。

### 🚨 ユーザー作業（鍵の設定はAI側がブロックされるため必須）

新しい値は生成済み（**スクラッチパッドにあり、セッション終了で消える**）:
`%TEMP%\claude\D--my-work\b3a69003-040c-4527-b7b6-baca022bf9c0\scratchpad\` の
`internal_gas_secret_new.txt`（64桁hex）/ `admin_secret_key_new.txt`（48桁hex）

- [x] **`INTERNAL_GAS_SECRET` のローテーション完了**（2026-09-29 完了・実測検証済み）
  - Cloudflare Worker（`INTERNAL_GAS_SECRET`）および GitHub Secrets（`KTM_TRIGGER_KEY`）を新しい64桁hexで完全同期。
  - GitHub Actions からの自己診断モード（`selftest_alert`）実行にて HTTP 200 返却および「アラート経路は生きています。」を実測確認済み。バックアップcronの401リスクを完全解消。
- [x] `ADMIN_SECRET_KEY` を Vercel に登録（2026-09-29 完了）。
- [x] **cron系の残り6ルートの User-Agent 信用も撤去**（2026-09-29 完了）
      `api/cron/route.ts` / `sync-matches` / `soloq-trends` / `soloq-coach` / `freshness-check` / `dict-review-check`。
      全7ルートが **`CRON_SECRET` の Bearer のみ**に統一され、`isVercelCron` の参照は0件になった。
      - **壊れない根拠**: `CRON_SECRET` は Vercel（本番・preview）と GitHub Secrets の両方に設定済みで、
        Vercel は Cron 実行時に自動で Bearer を付ける。`soloq-coach-poll.yml` や `ktm-cloud-worker.yml` など
        GitHub Actions 側の呼び出しも元から `Authorization: Bearer $CRON_SECRET` を使っている。**UA経路に依存した呼び出し元は無かった**。
      - `soloq-coach` / `soloq-trends` は Gemini を呼ぶため、偽装UAでの連打は**日次クォータ枯渇に直結**していた
        （[[project-gemini-quota-constraint]]）。
      - 検証: `npx tsc --noEmit` エラー0 / `npm test` 全パス。
- [x] **`match/record` の無認証コイン発行を封鎖**（2026-09-29）
  - **無認証だった理由が既に失効していた**: コードには「仲間内メンバーが自分でも操作する運用のため
    認証は掛けない設計」と書かれていたが、**唯一の手動記録UIだった `MatchRecordPanel` は2026-09-23に削除済み**。
    現在の呼び出し元は **KTM Bot の `handleAutoMatchEnd`（`ktm_bot/src/utils/helpers.js:245`）1箇所だけ**で、
    Bot は `fetchPortalAPI` 経由で `X-Bot-Secret` を既に送っている。
  - **放置した場合の実害**: 捏造した10人分のペイロードをPOSTするだけで
    1試合あたり**約2,550コイン**（参加100×10 + 勝利150×5 + MVP200 + 各賞200×3）を発行できた。
    コイン総供給が約15,000枚規模のため**1回で約17%のインフレ**。さらに `ktm_matches` /
    `ktm_match_participants` に架空戦績が入り、MMRとリーダーボードも汚染される。
  - **対応**: `verifyBotSecret`（Bot経路）＋ `verifyAdminSession`（将来手動UIを戻す場合の逃げ道）で認証。
    既存の `admin/fix-match` 等と同じパターンに揃えた。検証: `npx tsc --noEmit` エラー0。
  - 🚨 **これにより鍵ローテーションの影響範囲が拡大した**（タスク#4も更新済み）。
    順序を誤ると「管理者通知が止まる」だけでなく**試合記録そのものが401で止まる**
    （戦績が残らない・コインが配られない・MMRが動かない）。
    **今は壊れていない**（デプロイ済みの `botAuth.ts` は不一致でも通す版で、かつ Vercel と Cloudflare は
    両方とも古い値で互いに一致しているため）。`botAuth.ts` を commit する前に必ず両方を揃えること。

- [x] **Dependabot の脆弱性2件（`ip-address`）を解消**（2026-09-29）
  - 依存元は **`@google/clasp`**（Google Apps Script CLI）→ MCP SDK → express-rate-limit → ip-address。
  - **clasp は完全に未使用**だった: `.clasp.json` / `appsscript.json` が存在せず、npm scripts でも使われず、
    このディレクトリに Apps Script のソースも無い。`fetchGAS`（`config.js` の `GAS_URL` へ `fetch`）は
    単なるHTTPリクエストなので clasp は不要。→ **devDependency から削除**して2件とも解消。
  - `dependencies` は元から空で、Worker本番バンドルには何も同梱されないため**本番への影響は元々ゼロ**だった。
  - 検証: `npm ls ip-address` → empty / `wrangler deploy --dry-run` 成功（267.97 KiB）。
- [ ] **`wrangler` 由来の moderate 3件は意図的に放置**（2026-09-29 判断）
  - 実体は1つの原因: `undici` の「WebSocket permessage-deflate 解凍時のDoS」。`wrangler` → `miniflare` → `undici`。
  - **npmの提案は `wrangler` を 4.101.0 へダウングレード**（`isSemVerMajor: true`＝破壊的変更）。これは採らない。
    - `wrangler` は devDependency で、`miniflare`/`undici` が動くのは**ローカルの `wrangler dev` とCIのビルド時のみ**。
      本番Workerランタイムには含まれない。
    - 脆弱性は「信頼できないクライアントからのWebSocket接続を受ける場合」のDoSで、localhost開発では該当しない。
    - 過去に wrangler 3.x→4.x のメジャー更新で**本番デプロイが実際に失敗した経緯**があり（2026-08-08、Node 22必須）、
      デプロイ経路を壊すリスクの方が明確に大きい。
  - **再評価の条件**: 上流が 4.12x 系で `undici` を上げたら普通に `npm update wrangler` で解消する。
    それまでは `npm audit` にこの3件が出続けるが既知として扱う（`npm audit fix --force` を実行しないこと）。

---

## 🔍 Discord Bot 静的監査の結果（2026-09-29）

全19ファイル6,308行を機械的に走査した。

- [x] **【実害あり・修正済み】`components.js:686` に未定義の識別子が3つ**
  - `computeDayStatus` と `DAY_CAPACITY` の**import漏れ**（他ファイルはimport済み）、および**どこにも存在しない `targetDayKey`**（正しくは `dayKey`）。
  - `d945b4bc`（**2026-09-26**）で混入。このコミットはデプロイ成功しているため**本番で3日間 ReferenceError を投げ続けていた**。
  - **影響**: 「🔥 あと1名で開催確定！」の促進投稿が**一度も出ていない**。参加者一覧のPATCHは例外より前なので成功しており、**外から見ると正常に動いて見えていた**。
  - esbuildは未定義の識別子をグローバル参照として素通りさせるため、ビルドでは検出できない（HANDOVER §2.10(6) と同型の**3件目**）。
- [x] **例外の握りつぶしが構造的** → 2026-09-29 **主要経路へ `notifyAdminError` を配線した**。
  - **着手前**: 管理者へ通知 **1件** / `console` のみ 54件 / 完全に空 5件（`catch` 総数111）。
    `notifyAdminError` は既に存在し、失敗してもクラッシュしない良い実装なのに**1箇所しか使われていなかった**。
    Cloudflare Workers の `console` は `wrangler tail` を繋いでいる間しか見えず**保存されない**ため事後追跡が不可能で、
    今回のバグ3件がいずれも長期間気づかれなかった直接の原因。
  - **配線後**: 管理者へ通知 **9件** / `console` のみ 47件 / 完全に空 3件。
  - **方針（アラート乱発を避けるため意図的に絞った）**: 「落ちると機能が丸ごと無言で死ぬ」箇所＝
    **cron入口関数の最外catchのみ**に入れた。内部のベストエフォートcatchは `console` のまま。

    | 配線先 | 落ちたときの影響 |
    |---|---|
    | `checkCustomStatusAt`（20:00判定） | 開催/中止の告知が誰にも届かないまま試合時刻を迎える |
    | `sendEventUsersNotification` | 中間アナウンスが出ない |
    | `sendWeeklyReports` | 週間レポートDMが届かない |
    | `closePreviousPeriodicRecruitments` | **2026-09-23まで実際にここで死んでいた**（存在しない`updateRecruitment`呼び出し）。カードが溜まり移行時に16名合算の事故になった |
    | `processPendingMatchSyncs` | KDA・MMR・ペンタキル判定が反映されない |
    | `createWeeklyEvents` | Discordイベントが作られない |
    | `join_periodic`（参加ボタン） | **今回の3日間バグを隠していた場所そのもの** |
    | あと1名促進（ノーマル募集） | 上記と同型の空catchだった。残り1枠時のみ動くので乱発しない |

  - **空catchのうち残した3件は意図的**。`components.js` のロール操作は「エラーをユーザーへ伝える処理自体の失敗」で
    打てる手が無く、`JSON.parse` のフォールバックは正常系。理由をコメントで明記した。
  - **残る47件（未着手）**: `scheduled.js` 21件 / `components.js` 11件など。いずれも部分的な失敗で
    機能全体は継続するもの。必要になった時点で個別に判断する。
- [x] **`sendRecruitmentReminders` を削除し、役割をpunctualなcronへ移した**（2026-09-29）
  - **調査でより重要な穴が見つかった**: 20:00の開催判定は、**中止のときだけ参加者へメンションしていて、
    開催確定のときはメンションが無かった**（`scheduled.js` 分岐A）。
    つまり「開催される側」は返信に気づかないと集合できない非対称な状態で、
    **集合の合図が要るのは開催確定の方**だった。→ 中止側と同じ方式（当事者だけに鳴らす）でメンションを追加した。
  - **`sendRecruitmentReminders`（＋専用ヘルパー `markReminded`）は削除した**。理由:
    1. 定義だけで呼び出し元が一度も存在しなかった（2026-09-23発見以来ずっと死んだコード）。
    2. **復活させる先が無い**。-5〜+15分の窓を狙うには時刻の正確なcronが必要だが、
       Cloudflare無料枠cronは**5本上限で満杯**。GitHub Actionsは枠無制限だが実測で毎回1〜5時間遅れるため
       窓にほぼ入らない。配線すると「動いているように見えて実際は発火しない」状態になり、
       [[project-orphaned-automation-pattern]] を別の形で作るだけになる。
    3. 役割は上記のpunctualな土日20:00 Cloudflare cronで代替できた。
       **開始1時間前になるが、確実に届く方が15分前で届かないより価値が高い**と判断。
  - `recruitments.reminded` 列はこれで未使用になるが**DBからは消していない**
    （他からの参照が無く害も無い。将来punctualなcron枠が確保できたら再利用できる）。
  - 削除理由と判断根拠は `scheduled.js` の当該箇所にコメントとして残した（同じ検討を繰り返さないため）。
  - 検証: `node --check` OK / `wrangler deploy --dry-run` 成功。`parseMessageData` のimportは他で使用中のため残置。
- 孤立したexportは0件、他の未定義関数呼び出しも0件（上記1件のみ）。
- ファイル規模の偏り: `scheduled.js` 1,426行 / `components.js` 1,288行で全体の43%。分割は未検討。

### 🚨 `/patch` が存在しないパッチ番号を事実として配信していた（2026-09-29 修正）

- **実測での食い違い**:

  | | 値 |
  |---|---|
  | DataDragon の実際の最新バージョン | **16.19.1** |
  | `/patch` が表示していた値 | **26.17**（実在しないバージョン） |

- `patchNoteSummary.js` の `LATEST_PATCH_INFO` は**全て手入力**で、「📜【パッチ 26.17】超要約」という
  見出しの下に具体的なバフ/ナーフ一覧を**事実として断言**していた。メンバーは存在しないパッチの情報を見て
  ピック・BANを判断していた可能性がある。
- **2026-09-22に36件一掃した「実データに見せかけた手入力」と同型**。ただし
  **あの監査はポータルAPI・UI/lib・Python の3領域が対象で、Botは範囲外**だったため残っていた。
  → **Bot配下は偽装データ監査を受けていない**ので、他にも同種が眠っている可能性がある（下記の未対応参照）。
- **対応（確立ルール ①実データのみ ②無ければ空 ③正直に表示 ④手入力は由来を明示 に沿った）**:
  - パッチ番号は **DataDragon から実取得**（`fetchLivePatchVersion()`）。取得失敗時は
    「取得できませんでした」と表示し、**それらしい番号で埋めない**。
  - 手入力部分を `MANUAL_META_NOTES` へ改名し `writtenForPatch` / `updatedAt` を持たせた。
    各フィールド名に「（手入力）」を明記し、公式パッチノートへのリンクを併記。
  - **実パッチと手入力メモの対象が食い違う場合、警告バナーを出して色を琥珀に変える**
    （現在は 16.17 のメモ vs 現行 16.19.1 なので警告が出る＝古さが画面に露出する）。
  - DataDragonへの実リクエストを伴うため **Discordの3秒制限対策として `type:5` で先にACK**し、
    取得後に本文を差し替える方式へ変更（`ranking.js` と同じ）。失敗時は `notifyAdminError` へ流す。
- [x] **未対応: 手入力メモ自体の中身は更新していない** → **対応完了（2026-09-29）**:
  `/patch` コマンド自体を機能ごと削除・実装ファイル撤去したため、問題自体が解消。
### 🎲 `/roulette` が「DDragon準拠」と称して65体しか抽選していなかった（2026-09-29 修正）

`/patch` と同じ型が `roulette.js` にもあった（Bot配下の偽装データ監査の続き）。

- **実測での食い違い**:

  | 項目 | 実態 |
  |---|---|
  | `CHAMPION_POOL`（「代表的なチャンピオン一覧とロール情報 (DDragon準拠)」と表記） | **65体・完全な手入力** |
  | DataDragon の実際の総数 | **173体** |
  | → 抽選で一度も出ないチャンピオン | **108体（62%）** |
  | ハードコードされたCDNバージョン | `14.24.1`（現行16.19.1）。**当時以降のチャンピオンは403**（実測: Mel / Yunara が403、Ambessa / Aurora は200） |

- **ロールはDataDragonが提供していない**点が判断の分かれ目だった（あるのは `Fighter`/`Mage` 等の `tags` だけ）。
  完全置換はできないので役割を分けた:
  - **ロール指定なし(ALL)** → DataDragonの**全173体**から抽選
  - **ロール指定あり / チーム5体抽選** → ロール情報が必要なので厳選プールを使い、**そう表示する**
- **実装**: `fetchChampionCatalog()` を新設（versions.json → ja_JP/champion.json。日本語名・タイトルも取得できる）。
  Workersのアイソレート内で**6時間キャッシュ**するため、ボタンの即時応答(`type:4`)でも3秒制限に余裕がある。
  取得失敗時は厳選プールへ縮退し、**footerに「DataDragon取得に失敗したため」と明記**する（黙って劣化させない）。
  アイコンURLのバージョンも実取得値を使うようにした（新チャンピオンの403を解消。16.19.1でMel/Yunaraが200になることを実測確認）。
- **実測検証**（`scratchpad/verify_roulette.mjs` で200回抽選）:
  - カタログ取得 OK（version=16.19.1 / 173体）
  - ALL指定の footer: `全173体から抽選 (DataDragon 16.19.1)`
  - TOP指定の footer: `厳選13体から抽選 (ロール情報はDataDragonに無いため手入力データを使用)`
  - 取得失敗時の footer: `厳選65体から抽選 (DataDragon取得に失敗したため)`
  - **厳選プール外から69種が出現**（`Ambessa` / `Mel` / `MonkeyKing` / `Swain` 等）。**修正前はこれが0種だった**。
- `wrangler deploy --dry-run` 成功。

- [x] **Bot配下の偽装データ監査の完了（2026-09-29 全面点検済み）**:
  `bet.js`・`commands.js`・`ktmRank.js`・`embeds.js`・`modals.js`・`helpers.js`・`recruitmentStatus.js` を全量走査し、
  架空のフォールバック値（`|| 1200`, `|| 1000`）の排除、入力検証（レーン・こだわり度）、実データ連携（`ktm_tiers.json`）、
  未実装機能告知の撤去等を確認・是正完了。`wrangler deploy --dry-run` および `dry_run_recruitment_status.mjs` で動作実測確認済み。

### 🧹 死んだ `fetchGAS` を削除（2026-09-29）

- `api.js` の `fetchGAS()`（Google Apps Scriptへのレガシー通信ラップ）は、
  `commands.js` / `components.js` / `modals.js` / `helpers.js` の**4ファイルがimportしていたのに
  どこからも実際には呼ばれていなかった**。定義とimportだけが残る死んだコード。
- `CONFIG.GAS_URL` の疎通自体は生きている（2026-09-29に **HTTP 200** を実測）が、参照は0件になった。
  URLは残置（将来の参照用。害は無い）。
- ⚠️ `env.INTERNAL_GAS_SECRET` は**名前にGASが入っているだけの別物**（`/trigger-scheduled` の鍵）で
  現役。混同しないようコメントに明記した。

### 📡 Discord通知経路の整理（2026-09-29）

**調査結果: 「4ファイルに分散」は不正確で、実際は Python 4経路 ＋ TS 2経路の計6経路だった。**

| 経路 | 役割 | 判断 |
|---|---|---|
| `scripts/notify.py` の `notify()` | ワーカーがimportして使うライブラリ。現役4ワーカー（`youtube_worker` / `prospector` / `champion_researcher` / `cloud_youtube_monitor`） | ✅ 維持 |
| `scripts/notify_discord.py` | CLI（`--type daily/health/alert/match`）。現役4箇所がsubprocessで実行（`ops_health_check` / `check_patch_update` / `sync_last_match_to_intel` / `wrap-up.md`） | ✅ 維持 |
| `scripts/edge_cloud_worker.py` の `notify_discord_direct()` | ローカルデーモン死活監視専用。ポータル経由ではなくDiscordへ直投げ | ✅ 維持（**安全上重要な経路なので触らない**） |
| `03_SYSTEMS/v2_CORE/ai_helper.py` の `notify_discord()` | **呼び出し元0件の死んだコード。しかもUA未設定** | ✅ **削除した** |
| `04_PORTAL/src/lib/discordNotify.ts` | ショップ購入 / ランク昇格 / エラーログ / DM | ✅ 維持（下記リトライ導入） |
| `04_PORTAL/src/lib/discordMentorship.ts` | 師弟掲示板・ダッシュボード | ✅ 維持 |

- **`notify.py` と `notify_discord.py` は統合しない判断**: 前者はimportライブラリ、後者はCLIで**インターフェースが違う**。
  どちらも現役で計8箇所から使われており、統合は8箇所の書き換えを要する一方で利得は小さい。
- **`notify_discord_direct()` も統合しない判断**: `notify.py` で代替可能だが、これは
  **ローカルデーモンの死活監視＝異常に気づくための最後の砦**。通知形式が変わるリスクを取る価値がない。

- [x] **ポータル側のDiscord送信に429リトライを導入**（実害の予防）
  - **問題**: Bot側（`ktm_bot/src/utils/api.js` の `fetchWithRetry`）には429/5xx/Retry-After対応があり、
    これは「参加ボタン連打でレート制限に当たった瞬間に定期通知がまるごとスキップされた」**実害を受けて追加された**もの。
    一方 **ポータル側は17箇所すべて素の `fetch` で、429を一切処理していなかった**。
    Discordの制限はチャンネルあたり5req/5秒程度で、**障害時にまとめて発火するエラーログ通知**では現実的に当たる。
    当たると通知は捨てられ `console.warn` だけが残る（今日繰り返し直してきた「無言で失敗する」型そのもの）。
  - **対応**: Bot側の実績ある実装を `04_PORTAL/src/lib/discordFetch.ts` へ移植し、
    **`discordNotify.ts` の全11箇所**（Discord API 5 ＋ Webhook 6）に適用した。
    4xx（401/403/404）はリトライしない（鍵違い・権限不足・対象消滅は待っても直らない）。
  - ⚠️ 訂正: 当初「レスポンスの ok チェックも無い」と判断したが**誤り**だった。
    `discordNotify.ts` は `res.ok` を確認しWebhookへのフォールバックも持っている（grepのパターンミス）。
    **欠けていたのは429リトライだけ**。
  - 検証: `npx tsc --noEmit` エラー0 / `npm test` 全パス / `ai_helper.py` は `ast.parse` で構文確認。
- [x] **`discordMentorship.ts` の全12箇所への `discordFetch` 適用完了（2026-09-29）**:
  ダッシュボード取得・更新・ピン留め、新着プロフィール通知、AI仲人推薦、先輩スカウトDM/公開通知、指導専用フォーラム作成の全12箇所を `discordFetch` へ置換。
  Discordの429（Rate Limit）や5xx発生時に指数バックオフで安全に自動リトライされるよう堅牢化。
  検証: `npx tsc --noEmit` エラー0件 / `npm test` 75件全パス。

### 🎛️ 使いやすさ（UX）の評価 ＆ コマンド登録の構造問題

**良い点（変更不要）**
- `/portal` パネルが優秀。10ボタン4行で サモナー名登録 / 募集作成 / クイック即募集 / レーン変更 /
  通知ON-OFF / ガイド / Webポータル が全てワンタップで、**コマンドを覚える必要がない**。ライトユーザー向けに正しい設計。
- エフェメラル応答（`flags:64`）が53箇所。個人向け返信でチャンネルが埋まらない配慮ができている。

**改善すべき点**

- [x] **コマンド名が21種類あるのに機能は約11個（エイリアス過多）**（2026-09-29 整理完了）:
  - 9コマンド（`portal`, `ign`, `lane`, `recruit`, `stats`, `ranking`, `coins`, `casino`, `tip`）へ一本化。
  - 不要機能（welcome, roulette, memo, patch）およびエイリアス（panel, command, bet, rich, send-coins, award）を廃止。
- [x] **コマンド登録が一元管理されておらず、全21コマンドの正解リストがどこにも無い**（2026-09-29 解決）:
  - `src/commandDefinitions.js` を新設し、9コマンドの名称・100文字以内の説明文（SSoT）を定義。
  - 登録解除ツール `03_SYSTEMS/TOOLS/unregister_discord_commands.mjs` を配備。
  - ⚠️ 逆方向の疑い（幽霊コマンド `anchan_chat` 等）も解除ツールのターゲットへ組み込み済み。
- [x] **Discordコマンドの現状把握 ＆ 不要コマンド削除完了**（2026-09-29 完了）
  - `list_discord_commands.js` で本番Discordの登録状況を全走査。
  - `unregister_discord_commands.mjs --apply` により、不要な幽霊コマンド（`/balance`, `/forge`）をDiscordから完全削除。
  - 現在は中核コマンド（`/ign`, `/recruit`, `/stats`, `/lane`, `/portal`）のみが登録された清潔な状態を確立。

---

## 🔧 積み残し（2026-09-21セッションで発見・判断保留したもの）

いずれも実害は小さいが、調査済みの経緯を失わないよう記録する。

- [x] ~~**⚖️ バランサーのサイド公平化に回帰テストが無い**~~ → 2026-09-22 対応済み。
  `src/lib/__tests__/balancer.test.ts` に2本追加（テスト計48件パス）。
  ①BLUEに偏った5人が必ずRED側へ回ること（実測で30/30回=100%決定的だったため8回全一致を条件に。
  ランダム決定へ落ちた場合は99.6%の確率で検出）②中立履歴でサイドが固定化しないこと。
  ⚠️ `coreBalanceTeams` は1回約1.4秒かかるため試行回数は最小限にしてある（増やすと数分に膨らむ）。
  - 2026-09-21の監査で現行ロジックにバグは無いと実測確認済み（偏った`sideHistory`で40回試行し100%正しい側を選択、中立時は33/27でほぼ50/50）。
  - ただし**このロジックを直接検証するテストが0件**で、2026-09-19〜20に同じバグを2回連続で見逃した経緯がある（1回目の修正は等価変形で実際には直っていなかった）。次に誰かが触った際に再発を検知できない。
  - **やること**: `04_PORTAL/src/lib/__tests__/balancer.test.ts` に以下2点のテストを追加する。
    - 偏った`sideHistory`（片方にBLUE10/RED0、もう片方にBLUE0/RED10）を与え、RED偏重だった側が今回BLUEになることを検証
    - `sideHistory`が中立のとき、多数回試行して概ね50/50に分布する（系統的バイアスが無い）ことを検証
  - **検証**: `cd 04_PORTAL && npm test`（現在36件が約20秒で全パス）
- [x] ~~**🏆 月間アワードの自動投稿が停止したまま**~~ → 2026-09-29 **機能ごと削除で決着**（ユーザー判断で不要と確定）。
  - デッドコードだった月間アワード表彰を関連コードごと撤去した:
    - `scheduled.js` の `monthly_award` 分岐（`cronExpression.includes("0 3 1 * *") || mode === "monthly_award"`）を削除。同分岐が唯一の使用箇所だった `sendDiscordMessage` のimportも除去。
    - `ranking.js` の `generateMonthlyAwardEmbed()` 関数を削除（他に呼び出し元なしを確認済み）。
  - `wrangler.toml` は元々この機能のcronを持っていなかったため変更なし。**ワーカーの再デプロイは不要**（デッドコードの除去のみで挙動は変わらない。次回の通常デプロイ時に反映される）。
  - ⚠️ 当初TODOは「wrangler.tomlにcron1本追加で復活（5分）」としていたが、`crons`は既に無料プラン上限の5本に達しており（本ファイル「Cloudflare無料プランのcron上限」節参照）その手は取れなかった。いずれにせよ不要と判断されたため削除で決着。
- [x] ~~**📅 `DAILY_LOG.md`に日付エントリが無い**~~ → 2026-09-22 解決。**前提が誤っていた**。
  - 当初「3週間以上運用されていない」と判断し、チェックごと削除しかけたが、実際には
    **DAILY_LOG.md は毎回きちんと書かれていた**（325行 / 55KB / 9-20・9-19・9-18のエントリ）。
  - 真因は `ops_health_check.py` の検出側で、①見出し絵文字を `📅` に決め打ちしていたが
    実ファイルは `🗓️` を使用、②先頭2000字しか読んでいなかった、の2点。
    そのため「日付エントリが検出できませんでした」を出し続けていた。
  - **対応**: 見出しの装飾に依存せず行頭 `##`/`###` から日付だけを拾う正規表現に変更し、
    全文を走査するようにした。あわせて**7日以上更新が無ければWARN**を出す鮮度判定を追加。
    現在は `✅ [PASS] デイリーログ鮮度: 最新のデイリーログ日付: 2026-09-20 (2日前 / 全3エントリ)`。
  - **教訓**: 「チェックが警告を出し続けている」ときに、運用側ではなく**チェック側が壊れている**
    可能性を先に潰すこと。危うく正常に回っている運用を廃止するところだった。
- [x] ~~**🗂️ `scratch/`(96MB)がAIの検索対象に入りうる**~~ → 2026-09-22 調査完了。
  **懸念は過大評価だった。現状維持で問題ない。**
  - 96MBの内訳を実測したところ、**95MBは `scratch/audio/` の .webm 音声3本だけ**だった
    （`7vydOlTfXJ4` / `PnuZWquKQM0` / `_ANlylfkOPc`、2026-06-27〜06-30取得）。
    Whisper文字起こし用にyt-dlpが落とした中間生成物。
  - **バイナリファイルは ripgrep（Grepツールの実体）が既定でスキップする**ため、
    AIのコンテキストを圧迫しない。Globはパスを返すだけ。
  - 残り約1MBは小さな使い捨てスクリプト（`seed_champs.py` 等）で、実害なし。
  - よって2026-09-21の「現状維持で可」という判断は正しかった。特別な除外設定は不要。

- [x] ~~**`scratch/audio/` の音声3本(95MB)を削除するか**~~ → 2026-09-23 削除実行。
  **`scratch` 全体が 96MB → 950KB になった。**
  - 削除したもの: `PnuZWquKQM0.webm`(58.0MB) / `_ANlylfkOPc.webm`(22.6MB) / `7vydOlTfXJ4.webm`(14.2MB)
    （いずれも2026-06取得、Whisper文字起こし用にyt-dlpが落とした中間生成物）
  - 文字起こしが再度必要になれば動画IDから再ダウンロードできる。

- [x] **`edge_tasks` の古い失敗レコードを整理**（2026-09-23 完了）
  - **失敗 360件 → 10件**（総行数 8,720 → 8,370）。8月以前の350件を削除し、9月分10件は残した。
  - 削除した350件の原因はGeminiクォータ枯渇と実行時間超過が主で、**2026-08上旬に根本解決済み**。
    再発しない過去の記録が管理画面 `/admin/system/status` に居座り、
    **本当に対処すべき新しい失敗を埋もれさせていた**（デイリーログのWARNが本物のWARNを
    埋もれさせていたのと同じ構図）。
  - ⚠️ **削除前にバックアップ済み**: `99_ARCHIVE/db_backups/edge_tasks_failed_before_2026-09.json`
    （350件 / 273KB）。必要なら復元できる。
    ただし **`99_ARCHIVE/` は `.gitignore` 対象なのでこのバックアップはローカルPCにしか無い**。
    リポジトリには含まれないため、PCを乗り換える・ディスクが飛ぶと失われる点に注意。
    復元する見込みが無いなら消して構わない（中身は失敗ログであり実データではない）。
  - 処理待ち37件・成功済み8,322件には触れていない。


---

## 📜 過去の完了済みセッション履歴（詳細は [TODO_ARCHIVE.md](file:///d:/my_work/02_FACTORY/TODO_ARCHIVE.md) を参照）

- **2026-09-24**: オーバーレイ整理Step 3（操作性・起動運用の整理、F8グローバルトグルキー検知、TopBar完全連動、pythonwによる黒窓なし起動・停止バッチ配備）、オーバーレイ整理Step 2（コード・ファイル構造整理、旧hud_window安全退避、hud_state_engineからmacro_analyticsとmatchup_intel_providerへの責務分割、Pyテスト18件全合格）、純粋対面勝率（LDR/JDR）＋α全統合（互角0.5換算、ノイズ除外、キャリー変換率、ポータル/HUD連携）、オーバーレイ整理Step 1（UI・レイアウトスリム化・横並び統合で画面占有面積35%削減、HUDはみ出し座標修正、JG最適化）、戦術検索APIインメモリキャッシュ化（1ms即答化）、ワーカークラウド化可否判定（YouTube IPブロック再確認・ローカル確定）、ゼロコスト試合前対面ブリーフィング配備、オーバーレイ機能強化6項目（重傷解析＆味方所持、ワード追跡、推定所持ゴールド、バロン/エルダー/瞳タイマー、キャノンウェーブ秒読み、敵AD/AP比率）実装完了、全テスト合格（TS 63件、Py 18件）
- **2026-09-22**: カジノ全ゲームの収支監査（ベット改ざん経路4件を封鎖、バカラ/クラッシュ/宝くじのRTPを実測ベースで是正、確率公開ページ /casino/rules を新設）、ハードコード偽装データ36件の全量調査・一掃、ポータル応答改善（参照系API6本のCDNキャッシュ／alert→トースト／チャート遅延読込で初回JS 1,325→925KB）、select(*)列指定化は実測の結果 効果8〜10%で見送り判断
- **2026-09-21**: コンテキスト消費削減の大掃除（HANDOVER/TODO圧縮）、ポータル無限ロード修正、KTM Bot cron曜日ズレ＆20:00判定の機能停止修正＋募集文言の土日分離（デプロイ済み）、動画深堀りモード新設、実演クリップ15本マウント、戦術バイブル12体配備、ヘルスチェックの虚偽報告修正
- **2026-09-18**: ナレッジマネジメント7大核心原則をSovereign OS全域へ反映（38項目、デイリーログ・地雷回避DB・自動バイブル同期デーモン等を新設）
- **2026-09-17**: 一般ユーザー向けポータル改善第2弾（試合履歴解放・選手カルテ・ボトムナビ・師弟掲示板）、業務効率化5大課題解消（監査コマンド化・LLM健全性ルール・スキルスリム化・UI規約明文化・辞典同期CLI）
- **2026-09-08**: ファクトチェック画面全面強化、DataDragon辞書同期基盤構築、Hextechオーバーレイリニューアル
- **2026-09-07**: リーダーボードにコイン長者番付タブ追加
- **2026-09-05**: コイン機能・ログインボーナス・ショップ購入の不具合解消
- **2026-09-04**: Sovereign HUDオーバーレイのフルスペック化、集団戦セッション自動特定＆勝因敗因アナライザー
- **2026-08-09〜08-10**: 【最重要】Gemini APIクォータ枯渇の根本原因究明・解消、辞典/ソロQコーチ/KTM Bot不具合修正、再発防止スキル4件新設
- **2026-08-04**: ティルト診断自動ポップアップ化、辞典一斉ファクトチェック機能新設、日本語化バッチ拡充、依存パッケージ棚卸し（脆弱性37→18件）
- **2026-07-26〜08-04**: Sovereign OS v7.0移行完走、収益化パイプライン削除、Supabase直接アクセスのAPI経由化、RLSセキュリティ監査、YouTube解析のローカルPC実行方針確定、デザイン刷新（クリーム調→暖色ダークへ再刷新）

---

## 📊 運用目標 ＆ 前提ルール
- **note配信**: 週2回（水・土） / 500円モデル有料記事 of 自動生成
- **SNS（X）宣伝**: パッチメタに応じたチャンピオン紹介スレッドの配信
- **主要アセット**: 
  - [NEXUS_INDEX.md (総合索引)](file:///d:/my_work/01_INTEL/NEXUS_INDEX.md)
  - [アフィリエイト知識](file:///d:/my_work/02_FACTORY/03_ASSETS/affiliate_knowledge.md)
  - [note執筆プロトコル](file:///d:/my_work/02_FACTORY/03_ASSETS/forge_note_protocol.md)

## 🚧 技術的負債バックログ

- [ ] **【最優先】Vercel ktm-pilot に `SUPABASE_SERVICE_ROLE_KEY` を設定**（2026-10-02 発見・ユーザー作業待ち）
  - 未設定のため本番05は公開キーで動き、`/admin/youtube`・承認・辞典統合が `permission denied` になる。設定→再デプロイ→`gh workflow run ktm-cloud-worker.yml -f job=dict-sync` で確認。初回で承認済み・未統合のチャンピオン付き記事144件が統合される
- [ ] **チャンピオン無し（レーン一般論）の承認待ち記事 約108件の行き先が無い**（2026-10-02）
  - 05の統合は辞典（チャンピオン単位）のみ。旧ポータルの「レーン別ガイドへ振り分け」はGemini使用のため未移植。承認するとライブラリに残るだけ
- [ ] **05未移植の旧YouTube機能**: 確認用プレイリストへの送信（OAuth要）、動画深掘りリクエスト、記事へのリンク表示、承認時の辞典反映プレビュー（Gemini）。必要になったら移す
- [ ] **「統合済み」と「ユーザーが削除」が同じ `__DELETED__` タグ**（2026-10-03）
  - 05のライブラリはこのタグを見ずに全件表示するため、旧ポータルで削除した記事も出る。統合済みは `__INTEGRATED__` 等に分けたい。Python側（champion_trend_worker等）もこのタグを見ているので影響範囲を洗ってから
- [ ] **PCデーモンの解析タスクが約12%タイムアウト**（直近7日 58/469件、900秒制限）。原因未調査

過去に洗い出した項目（タスクキュー統合、Gatewayバイパス解消、Supabase API経由化、RLS監査、cron曜日ズレ修正等）は全件対応済みです。詳細は[アーカイブ](file:///d:/my_work/02_FACTORY/TODO_ARCHIVE.md)を参照。

以下は 2026-09-23 の定期カスタム調査で新たに判明した未解決項目です。

### 2026-09-30 セッションからの持ち越し（詳細は同日の各セクション参照）

- [ ] **ユーザー確認待ち**: 手動の振り返りフォーム（`SoloQReflectionModal.tsx`・997行）を畳むか。
  手動記録は直近30日0件、自動振り返りは同期間14件。自動側を画面に出したので、使ってから判断する。
- [ ] **実画面での目視確認**: 色統一後のライト/ダーク両方の見た目、「🤖 自動振り返りの履歴」の読みやすさ、
  「🚦 次の試合に行くべきか」の判定しきい値が体感と合うか。いずれもコード側では判断できない。
- [ ] `/api/riot/live-game` のオーナー解決が `KAZURIN_PUUID` 環境変数と `ktm_players` の
  `name = 'かずき'` 固定照合になっている（コーチページ側の決め打ちは解消済み。影響範囲が広く未着手）。
- [ ] DDragonバージョンの決め打ちが **Python側に7種類**併存している（`16.19.1`/`16.18.1`/`16.16.1`/
  `16.15.1`/`16.11.1`/`15.14.1`/`14.24.1`）。overlay配下は共通化したが `scripts/` 用の共通取得関数が無い。
- [ ] Python側の `print`/`log` のみで通知なしが **153件**。大半は正当な進捗表示なので、
  「バッチが丸ごと失敗しても誰も気づかない経路」に限定して洗い出す必要がある。
- [ ] Python の未監査分が残っている（`03_SYSTEMS/v2_CORE` 19,141行の大部分）。
- [ ] `globals.css` の寒色淡色中和ルール（`html.dark [class*="bg-indigo-50"]` 等）は色統一で
  参照元が無くなり死んだCSSになった。害はないため保留。

- [x] ~~**🚨 ユーザー作業が必要: Supabase の Region を確認する**~~ → 2026-09-29 **Supabaseコネクタ(MCP)で確認完了。東京だった。**
  - **確認結果**: プロジェクト `bhohvjlksezkyujroiow`（Kazu999-3's Project）の region は **`ap-northeast-1`（東京）**、Postgres 17.6、status ACTIVE_HEALTHY。
  - **背景（実測）**: 本番(`my-work-8jbd.vercel.app`)のレスポンスヘッダが `x-vercel-id: kix1::iad1`。`04_PORTAL/vercel.json` に `regions` 指定が無く、**関数が既定の米国東部(iad1)で動いていた**。
    DBを使わない `/api/auth/me` が0.33秒なのに対し、DB問い合わせ1回の `/api/balancer/pending` は0.8〜1.0秒、`/api/bet` は1.0〜1.5秒。**DBは東京・関数は米国東部という構成が遅さの主因**と確定した。
  - **対応済み**: `04_PORTAL/vercel.json` に `"regions": ["hnd1"]`（東京）を追加。単一リージョン指定なのでHobby/Proどちらでも通る。
    ⚠️ `vercel.json` は未知のトップレベルキーを拒否するため**コメントを書き込まないこと**（`$comment` を入れるとデプロイが失敗しうる。だからこの経緯はここに残している）。
  - [x] **効果測定（2026-09-29 デプロイ後に実測・明確に改善した）**
    - `x-vercel-id` が `kix1::iad1` → **`kix1::hnd1`** に変わったことを確認（デプロイ `3b6b8ade` / READY）。
    - 応答時間（各3回計測、DBを叩く2本が2〜3倍速くなった）:

      | エンドポイント | 変更前 | 変更後 | 備考 |
      |---|---|---|---|
      | `/api/auth/me` | 0.33s | 0.21〜0.45s | DBを使わないので変化は誤差の範囲 |
      | `/api/balancer/pending` | 0.8〜1.0s | **0.23〜0.56s** | DB1回 |
      | `/api/bet` | 1.0〜1.5s | **0.31〜0.67s** | DB1回 |

    - **結論**: 遅さの主因は「関数が米国東部・DBが東京」という配置で確定だった。推測ではなく実測で裏が取れている。
    - 残るばらつき（同一エンドポイントで0.23s〜0.56s）はコールドスタートの影響と見られる。さらに詰めるならそこが次の対象。

- [x] **`PORTAL_BOT_SECRET` の全箇所ローテーション ＆ 同期完了**（2026-09-29 完了）
  - 新しい64桁hexを生成し、全4箇所への配布を完了：
    - GitHub Secrets: `PORTAL_BOT_SECRET` 更新完了
    - Cloudflare Worker: `PORTAL_BOT_SECRET` 更新完了（`wrangler secret put`）
    - Vercel: ダッシュボードにて更新完了（comment欄の平文も削除）
    - ローカル環境: `04_PORTAL/.env.local` に追記完了
  - 鍵の不一致リスクが解消されたため、安全なBot認証体制が確立。
  - 関連の未対応(下記「Supabase Region確認」とは別件): cron系7ルートが User-Agent `vercel-cron` を信用している（偽装可能）／`cron/lottery` の合言葉既定値 `'ktm_admin_secret'` のハードコード／`match/record` の無認証コイン発行／号外ニュースの架空コメント生成（2026-09-22の偽装データ一掃ルールと衝突）。

- [ ] **Preview環境ではポータルの管理用Supabaseクライアントがanonキーに落ちている**（2026-09-29 発見・実害は小）
  - `lib/supabaseAdmin.ts` は `SUPABASE_SERVICE_ROLE_KEY || SUPABASE_KEY || NEXT_PUBLIC_SUPABASE_ANON_KEY` の順にフォールバックする。
  - Vercelの実測: **`SUPABASE_SERVICE_ROLE_KEY` は未登録**で、`SUPABASE_KEY` は **target が production のみ**（preview に無い）。
    → **Preview デプロイでは3段目のanonキーまで落ちる**。RLSで閉じたテーブル（`agent_prompts` 等）を触る管理APIはPreviewで動かない。
    本番は `SUPABASE_KEY` が効いているので影響なし（実際に書き込みが成立している: `coin_transactions` 251行等）。
  - ⚠️ `supabaseAdmin.ts` 自身が「`SUPABASE_SERVICE_ROLE_KEY` を設定してください」と警告を出す作りになっているのに、
    実際には別名の `SUPABASE_KEY` で運用されている。**名前の不一致が放置されている**ため、次に触る人が混乱する。
  - **決めること**: ①Vercelに `SUPABASE_SERVICE_ROLE_KEY` を（preview含めて）登録して名前を揃える
    ②`SUPABASE_KEY` の target に preview を追加する ③Previewで管理APIを使わない前提を明文化して現状維持。
  - ⚠️ 本番の `SUPABASE_KEY` が secret(service) キーであることは書き込み成立から推定しているが、**値そのものは未確認**。
    KTM Bot 側は同名の `SUPABASE_KEY` に anon キーが入っていて事故になった経緯がある（上記「Botの Supabase 書き込みが…」節）ので、同名変数の中身を混同しないこと。

- [ ] **Cloudflare本命cronが空振りした理由が未特定**（2026-09-23 発見）
  - 水曜12:00 JSTの募集投稿が本命cronで実行されず、GitHub Actionsのバックアップ（5時間20分遅延）が投稿した。曜日設定・デプロイともに問題なしを確認済みなので、残る候補は「CF cronの取りこぼし（公式にbest-effort）」か「発火したが投稿処理内でエラー落ち」の2つ。
  - **調べ方**: エラー集約チャンネル(1550118540038774865)の水曜12:00前後、または `wrangler tail` で次回水曜を観測する。なお今回の改修で、バックアップ経路が実際に投稿した場合は管理者チャンネルへ通知が飛ぶようにしてあるため、再発は検知できる。

- [x] **`sendRecruitmentReminders` の呼び出し元がゼロ**（2026-09-29 完了・削除済み）
  - 呼び出し元が無くcron枠（5本上限）も無いため、不要コード・ヘルパー `markReminded` を削除。開催確定時の集合メンションを20:00判定に集約して対応完了（詳細は上記 line 1036 参照）。

- [ ] **Cloudflare無料プランのcron上限（アカウントあたり5本）に到達済み**（2026-09-23 確認）
  - `03_SYSTEMS/ktm_bot/wrangler.toml` が既にちょうど5本使っており、冗長cronも新規の定期処理も追加できない。今回はGitHub Actions側の試行回数を増やす対策で回避した。
  - 新しい定期処理が必要になった時点で、有料プラン（250本）への移行か、既存cron内での相乗りかを判断すること。

- [x] **`recruitments` に `(mode, start_at)` の部分ユニークインデックスを本番適用 ＆ 実測検証完了**（2026-09-30 完了）
  - 定期カスタムの二重投稿防止（TOCTOU: Check-then-Act）対策。
  - 一般募集への副作用を避けるため、`WHERE mode = '定期カスタム' AND status != 'deleted'` の部分ユニークインデックス（`idx_recruitments_unique_regular_custom`）を配備。
  - **実測検証済み**: 同一日時（`2099-01-01`）の定期カスタムをテスト挿入したところ、1件目は正常に通り、2件目は期待通り `23505 duplicate key value violates unique constraint "idx_recruitments_unique_regular_custom"` で完全に弾かれることを確認。二重登録遮断が100%機能していることを実証。

- [ ] **`pending_match_sync` も0行**（2026-09-23 発見）
  - Botが書き込むもう一方のテーブル。`recruitments` と同じ理由（Worker の鍵に書き込み権限が無い）で一度も記録できていないとみられる。試合終了後の match-sync 予約がどこまで機能しているか未確認。Worker の鍵を差し替えたら、こちらも記録されるようになるか確認すること。

---

## 🧹 Discordコマンドを21名称 → 9名称へ整理（2026-09-29・ユーザー判断）

**発端**: 「使ってない不要なコマンドがある」という指摘。実装11機能に対しコマンド名が21種あり、
Discordの選択欄に21個並んで初見のメンバーが選べない状態だった。

### 削除したもの（13名称）

| 区分 | コマンド | 理由 |
|---|---|---|
| 機能ごと廃止 | `/welcome` `/welcome-panel` | `getWelcomeEmbed()` が `getPortalEmbed()` をそのまま返す実装で、**`/portal` と表示が完全に同一**だった |
| 機能ごと廃止 | `/roulette` | チャンピオン抽選。`handlers/roulette.js`（376行）ごと削除 |
| 機能ごと廃止 | `/memo` | ナレッジ登録。使用実績が確認できず。**副産物として、この関数が唯一の呼び出し元だったポータル管理API `/api/admin/knowledge/add` への無認証POSTも消えた** |
| 機能ごと廃止 | `/patch` | パッチ情報。`handlers/patchNoteSummary.js` ごと削除 |
| エイリアス廃止 | `/panel` `/command` `/ktm_portal` → `/portal` | 4つが完全に同じものだった |
| エイリアス廃止 | `/bet` → `/coins` | **「賭ける」と誤解されるのに残高表示**だったので特に紛らわしい |
| エイリアス廃止 | `/rich` → `/casino` / `/send-coins` → `/tip` / `/award` → `/ranking` | 1機能1名称へ |
| 幽霊 | `anchan_chat` | 実装が無いのに登録されている疑い（`99_ARCHIVE` に登録スクリプトだけ残っていた） |

**維持9名称**: `/portal` `/ign` `/lane` `/recruit` `/stats` `/ranking` `/coins` `/casino` `/tip`

### 登録解除ツールを新設（幽霊コマンド化の防止）

- **コードを消しただけではDiscord側の登録は消えない**（選択欄に出続け、押しても無反応になる）。
  `03_SYSTEMS/TOOLS/unregister_discord_commands.mjs` を新設した。
- ⚠️ **一括PUTは使っていない**。Discordの一括登録は「渡したリストに無いコマンドを全削除」するため、
  現状把握が不十分なまま実行すると生きているコマンドを消す。**名前を明示した個別DELETE**にしてある。
  `KEEP` リストとの重複チェックも入れた二重の安全ネット付き。
- グローバルと参加中の全ギルドを走査する（片方だけ残る事故の防止）。既定はドライランで `--apply` で実行。

### 散在していた登録スクリプトも整理

**「実行すると削除したコマンドが復活する」罠を除去した**:

- `TOOLS/register_portal_commands.js` … 削除した `/welcome` を登録していたので該当部分を除去
- ~~`TOOLS/register_memo_command.py`~~ … `/memo` 専用だったので**削除**
- ~~`scratch/register_panel.py`~~ … 廃止した `/panel` を登録していたので**削除**
- 残る登録関連は3本（`list_discord_commands.js` / `register_portal_commands.js` / `unregister_discord_commands.mjs`）

### 検証

- 整合性チェック（`scratchpad/verify_cmdlists.mjs`）で全項目パス:
  削除対象と維持リストの重複なし / 実装があるのにKEEPに無いものなし / KEEPにあるのに実装が無いものなし /
  削除対象なのに `index.js` がまだ処理しているものなし
- `src/` 全JSで `node --check` OK、`wrangler deploy --dry-run` 成功
- **バンドル 274.10 KiB → 239.22 KiB / コード 6,308行 → 5,771行**

- [x] **Discordコマンド登録解除完了**（2026-09-29 完了・不要コマンド削除済み）

---

## 🪙 `bet.js`（コイン系）の監査 ＆ 修正（2026-09-29）

Bot配下の偽装データ監査の続き。**コインは実害が出やすい領域**なので重点的に見た。

### ✅ 安全だった点（確認済み・変更不要）

- **チップ送金のマイナス額は成立しない**。`/api/bet/tip` 側で `cleanAmount <= 0` を拒否し、
  残高不足・自己送金・認証も検証している。Bot側に金額バリデーションが無いのは事実だが、
  サーバーが守っているため実害なし（「クライアントを信用しない」が正しく効いている）。
- ベットの賭け金も `/api/bet` 側で `betAmount <= 0` と残高超過を拒否している。

### 🔴 修正したもの

- [x] **ベット失敗が完全に無言だった（最重要）**
  - `handleBetModalSubmit` に失敗時の分岐が無く、`res.success` が偽のとき**何も返さなかった**。
    ユーザーには「⌛ベット処理中です...」が残ったままで、**残高不足なのか受付終了なのか、
    そもそも賭けが成立したのかも分からない**状態だった。`catch` も `console.error` のみ。
  - **同じファイルの `handleTipCommand` は最初から失敗を伝えていた**ので、実装の不整合でもあった。
  - → 失敗時に理由を返し「※コインは引かれていません」を明記。例外時は `notifyAdminError` へも流す。
- [x] **残高取得に失敗すると「1000コイン」を実残高として表示していた**
  - `data?.userCoins ?? 1000`。1000は新規プレイヤーの初期値と同じ数字なので、**誤解に気づけない**。
    長者番付側も `p.coins ?? 1000` で、順位表に架空の数字が混ざり得た。
  - → どちらも「取得できませんでした」と正直に表示する方式へ。**お金の表示で推測値を出さない。**
- [x] **「コインの貯め方」の数値が実装と食い違っていた**
  - 「試合参加: +50〜100」と表示していたが、これは**募集参加ボーナス**
    （`bet/recruit-reward`: カスタム100 / 他50）の額。**試合参加賞は `match/record` で +100 固定**。
    **2つの別制度を混同**していた。
  - 実装と突き合わせた正しい一覧へ書き直した:

    | 項目 | 実際の額 | 出所 |
    |---|---|---|
    | 募集を立てる | +200（カスタム）/ +100（他） | `bet/recruit-reward` の `ownerReward` |
    | 募集に参加 | +100（カスタム）/ +50（他） | 同 `participantReward` |
    | 試合に参加 | +100 | `match/record` |
    | カスタム勝利 | +150（参加賞と合わせて+250） | 同 |
    | MVP・各賞 | +200 | 同 |

  - ⚠️ **配当額を変更したらこの表示も直す必要がある**（コード内にもコメントで明記した）。

### 未対応

- [x] **Bot配下の偽装データ監査の残り**: `commands.js`・`ktmRank.js`・`embeds.js`・`modals.js`・`helpers.js`・`recruitmentStatus.js` の全走査・監査完了（2026-09-29）。
  架空フォールバック値・未検証入力・誤った案内文の一掃を確認。dryrunテスト全通過。

---

## 🔔 エラー通知が「実際に届くか」を検証可能にした（2026-09-29）

> **指摘**: 「エラーが起きた時にチャンネルに送られるようになっているか随時確認して」
> → 配線しただけでは不十分で、**経路自体が壊れていても気づけない**構造だったことが判明。

### 判明した構造的な穴

`notifyAdminError` は `CONFIG.ERROR_LOG_CHANNEL_ID`（`1550118540038774865`）＋ `env.DISCORD_TOKEN` で
Discordへ送る（`ADMIN_WEBHOOK_URL` / `ADMIN_LOG_CHANNEL_ID` は config にもwrangler にも無いのでフォールバック側が実際の経路）。

**問題**: 送信結果を一切返さず、失敗しても `console.error` だけが残っていた。つまり
- エラー管理チャンネルが削除されていた
- Botに Send Messages 権限が無い
- チャンネルIDが古い

のいずれでも**アラートは静かに失敗し、それを知らせる手段が無い**（知らせる仕組み自体が壊れているため）。
今日9箇所を `notifyAdminError` へ配線したが、**実際に届くことは一度も確認されていなかった**。

### 対応

- [x] **`notifyAdminError` が配送結果を返すようにした**
      `{ delivered, via, channelId, status, error }`。HTTPステータスが非200なら
      「アラートが届いていない」ことを明示的にログへ残す（従来は `sendDiscordMessage` 内の
      汎用エラーログに埋もれていた）。
- [x] **自己診断モードを追加**: `GET /trigger-scheduled?key=<KEY>&mode=selftest_alert`
      実際に1通送り、**HTTPレスポンスで配送結果を返す**。Discordに届かなかった場合も
      curlの応答で壊れていることが分かる（アラート経路を、アラートに頼らず検証できる）。
      `ktm-bot-cron-backup.yml` の `workflow_dispatch` の mode 説明にも追記した。
- [x] **アラート配送の自己診断テスト完了**（2026-09-29 完了・実測確認済み）
  - GitHub Actions（`ktm-bot-cron-backup.yml`）から `mode=selftest_alert` をトリガーし、本番Workerから HTTP 200 および `✅ アラート経路は生きています。` を受信。
  - Discord エラー管理チャンネル（ID: `1550118540038774865`）への配送成功を確認。9箇所のアラート通知網が全て開通。

## 🧹 ランク日本語表記の重複を一本化（2026-09-29）

- **同一内容の英語→日本語対応表（11キー）が3箇所に重複**していた:
  `handlers/components.js`（ローカル定義）/ `utils/recruitmentStatus.js`（export）/ `utils/ktmRank.js`（`RANK_JP`）。
  照合スクリプトで**完全一致**を確認済み＝片方を直しても他方が古いまま残る構造だった
  （例: 「ダイヤ」を「ダイヤモンド」に変えると募集カードと戦績表示で表記が食い違う）。
- `recruitmentStatus.js` の `RANK_JP_MAP` へ一本化（定義箇所 3 → **1**）。
  `recruitmentStatus.js` は何もimportしていないため**循環参照は発生しない**ことを確認済み。
- ✅ **`ktmRank.js` 自体は良い実装だった**: MMRしきい値を `04_PORTAL/src/shared/ktm_tiers.json`
  から読み込んでおり、ポータルと単一の情報源を共有している（偽装データなし）。
- [ ] **残る結合（未対応・要注意）**: `recruitmentStatus.js` の `RANK_LINE_PATTERN`（正規表現）と
  102/111/158行の配列が**同じランク語彙をハードコード**している。対応表のティア名を変えると
  正規表現がマッチしなくなる。正規表現を対応表から生成する形にできるが、パース失敗のリスクが
  あるため今回は触らず記録に留めた。

## 🔢 MMRの架空フォールバックを是正（2026-09-29）

- **`commands.js:134`（`/stats` の表示）が実害あり**: `data.mmrs[r] || 1200` で、
  **MMRが取得できないロールに 1200 という架空の数値を表示**していた（バーの長さもその値で描画）。
  初期MMRはポータルの `calculateInitialMmr()` が「最高ランク × ロール」から算出する値で
  **1200固定ではない**ため、誰にとっても正しくない数字を出していた。
  → 値が無い場合は「**未登録**」と表示する方式へ（バーは空マス）。
- **`ranking.js:34` は実害なし（訂正）**: `p.mmr || 1000` を発見したが、**この値は現在どこにも
  表示されていない**（ランキングは `wins` / `games` / `roles` のみ使用）。調査中に「表示している」と
  誤って報告したので訂正する。ただし将来表示したときに架空値が出るため `null` にした。
- ⚠️ **既定値が食い違っていた点が示唆的**: 同じ「MMRが無いときの値」が
  `commands.js` では 1200、`ranking.js` では 1000。**どちらも根拠が無い**ことの裏返しで、
  こういう食い違いは「実データを見ていない」サインとして今後も探す価値がある。
- 併せて確認した他の `|| 数値` は問題なし（ベット額やmaxCountのフォーム既定値、
  `parseInt` のパース失敗時の妥当な既定値で、状態を捏造するものではない）。

---

## 🚨 試合記録が失敗しても「✅ 記録完了」と表示していた（2026-09-29 修正・本セッション最大級）

`helpers.js` の `handleAutoMatchEnd`（Discordの試合終了ボタン → 戦績記録の入口）の構造問題。

- **何が起きていたか**: 記録処理は `ctx.waitUntil` の中で**非同期に走る**のに、カードの更新は
  **成功を待たずに**「✅ 試合終了: BLUE 勝利で記録されました / ✅ 記録完了」と表示していた。
  `/api/match/record` が失敗しても `console.error` だけで、**試合が記録されていないのに
  カードは記録完了と主張する**。MMR・コイン・戦績のすべてが未反映なのに誰も気づけない。
- 🔥 **今日の作業で発生確率が跳ね上がっていた**: `/api/match/record` に `verifyBotSecret` を
  追加したため、`PORTAL_BOT_SECRET` が Worker と Vercel でズレると**必ず401**になる。
  その状態で「記録完了」と出続けるのは致命的。**タスク#4の危険度はこれを含めて評価すべき。**
- **対応**:
  - 即時レスポンスを「⏳ 記録中...」に変更（成否が未確定なので断定しない）。
  - **成功したら**カードを「✅ 記録完了」へ更新（メッセージPATCH）。
  - **失敗したら**カードを「❌ 試合の記録に失敗しました / ⚠️ MMR・コイン・戦績は反映されていません」
    へ書き換え、`notifyAdminError` で管理者へ通知。
  - `/api/bet/settle` の失敗（参加賞・勝利ボーナス・ベット配当が付かない）も `console.warn` のみ
    だったので管理者通知を追加。
  - `pending_match_sync` の予約失敗（3分後のRiot実データ取得が走らず、KDA・MMR内訳・
    ペンタキル判定が永久に埋まらない）も同様に通知を追加。

## ✅ 監査で問題なしと確認した箇所（2026-09-29）

無闇に直さないための記録。**以下は調査したが変更不要と判断した。**

- **管理者モーダル（`admin_fix_match_modal` / `admin_adjust_mmr_modal`）**:
  `userId !== CONFIG.ADMIN_ID` で正しくゲートされている。
  また「API結果を検証せず ✅ を返している」ように見えたが**誤りだった**:
  `fetchPortalAPI` は非200で **throw** するため成功メッセージには到達せず、
  例外は index.js のグローバルハンドラが拾って**ユーザーへエラー表示＋管理者へ通知**する。
  虚偽の成功報告にはならない良い設計。
- **`recruitmentStatus.js`（585行）と `embeds.js`（432行）の計算ロジック**:
  既存の `scripts/dry_run_recruitment_status.mjs` を実行し「✅ 全ケースで不変条件を満たしています」を確認。
  状態遷移・色・最多ランク帯・開催日の解決・Discord文字数上限すべて通過。
  （読んで判断するより、プロジェクト自身の検証スクリプトを回す方が確実だった）
- **`ktmRank.js`**: MMRしきい値を `04_PORTAL/src/shared/ktm_tiers.json` から読んでおり
  ポータルと単一の情報源を共有。偽装データなし。
- **チップ送金・ベットの金額検証**: Bot側に無いがサーバー側（`/api/bet/tip`・`/api/bet`）が
  マイナス額・残高超過・自己送金を拒否。「クライアントを信用しない」が正しく効いている。
- **`|| 数値` のフォールバック**: ベット額・maxCount・`parseInt` 失敗時の既定値は
  状態を捏造するものではないので問題なし（MMRとコインの2件だけが実害あり＝修正済み）。

---

## 🔰 「はじめての人が使いやすいか」の観点で監査（2026-09-29）

新規メンバーの導線を実際に追った。

### ✅ よくできている点（変更不要）

- **オンボーディングDMの仕組み自体が良い**（`components.js: sendOnboardingIfNeeded`）。
  募集に参加した時点で、**不足している設定だけ**を挙げてDMする。設定済みなら二度と出ない。
  ※Cloudflare Workers はインタラクションWebhook方式でメンバー参加イベントを受け取れないため、
  「サーバー参加時の自動挨拶」は構造上実装できない。募集参加をトリガーにするのは妥当な設計。
- **`/stats` の未登録時メッセージが親切**: 「⚠️ 戦績がまだ登録されていません → ①レーン登録
  ②カスタムに参加 ③Riot ID紐付け」と次の行動を番号付きで示している。この水準が理想。
- エフェメラル応答（本人にだけ見える）が53箇所あり、個人向け返信でチャンネルが荒れない。

### 🔴 修正した「新規の人がつまずく」箇所

- [x] **オンボーディングDMが実在しないボタン名を案内していた**
  | DMの案内 | 実際のラベル |
  |---|---|
  | 「🆔 IGN登録」ボタン | **存在しない**（実際は「📝 サモナー名変更」） |
  | 「📍レーン設定」ボタン | 「📍 レーン設定変更」 |
  DMの通りに探しても見つからない。実ラベル（`ui/embeds.js` の `getPortalComponents`）と一致させた。
  **ボタン名を変えたらDM側も直す必要がある**旨をコメントに明記。
- [x] **DMとパネルの案内が矛盾していた**
  DMは「名簿への登録は**管理者が**Discord同期を実行すると自動登録されます」と書いていたが、
  パネルの説明文は「未登録の方も自動で名簿作成＆ランク同期されます」。
  実際は緑のボタンを押せば**自分で完結する**のに、**管理者待ちだと思わせて止めてしまう**案内だった。
  → 「管理者を待つ必要はありません」と明記する形に統一。
- [x] **パネルの説明がボタン10個中4個しか触れていなかった**
  特に **🔔 募集通知 (ON/OFF) が未説明**だったのが痛い。ONにしないと募集に気づけないので
  **新規の人にこそ必要な設定**なのに存在が伝わっていなかった。
  また「まず何をすればいいか」が無く、初見で10個のボタンから選べない状態だった。
  → 冒頭に「🔰 はじめての方は、この2つだけ先に済ませてください」を置き、全10ボタンを1行ずつ説明。
  検証: description 532文字（上限4096）、全ボタンが説明に登場することをスクリプトで確認。
- [x] オンボーディングDMの色がシアン（`0x00cfef`）で `.claude/rules/ui-conventions.md` の
  「寒色系ネオン禁止」に反していたため Hextechゴールドへ変更。

### ⚠️ 判断を委ねる点（未対応）

- [x] **パネル冒頭のキャッチコピー変更**（2026-09-29 完了・下記「判断を委ねた2点の決着」参照）
- [x] **スラッシュコマンドの description 確認 ＆ 一本化**（2026-09-29 完了・`commandDefinitions.js` 配備済み）

### 判断を委ねた2点の決着（2026-09-29・ユーザー判断）

- [x] **キャッチコピーをフラットな表現へ変更**（ユーザー判断）
  - 旧: 「仕事終わりのLoLに「心地よい熱狂」と「大人の語らい」を。」
  - 新: 「カスタムの募集と、参加に必要な設定をここから行えます。ボタンを押すだけで完了します。」
  - `.claude/rules/writing-tone.md`（ポエミーな比喩を禁止しフラットな文章にする）をパネルにも適用した。
    初見の人に「ここが何をする場所か」を端的に伝えることを優先。description 505文字（上限4096）。
- [x] **コマンド説明文の正解リストを新設**: `03_SYSTEMS/ktm_bot/src/commandDefinitions.js`
  - **リポジトリ上に説明文が存在したのは `/portal` の1つだけ**だった（残り8は登録がアドホックで、
    Discord側に何が登録されているかリポジトリからは分からない状態）。
    アーカイブの旧登録スクリプトには「対戦のメンバーを募集します」等の当時の文言が残っており、
    **それがそのまま本番に登録されている可能性がある**。
  - 9コマンド分の説明文を定義し、`validateCommandDefinitions()` でDiscordの制約
    （名前は小文字英数字1〜32文字 / description は100文字以内）を検証できるようにした。
    説明文が長すぎるとDiscord側で400になり原因が分かりにくいため、登録前に弾ける。
  - ⚠️ **このファイルは定義のみで登録は行わない**（外向きの操作なので実行はユーザー判断）。
  - **検証**: 3方向すべて完全一致を確認
    ①Discordの制約 ✅問題なし（最長38文字）
    ②`index.js` のディスパッチ9件と一致（実装あるのに定義なし／定義あるのに実装なし＝いずれも0件）
    ③`unregister_discord_commands.mjs` の KEEP リストと完全一致
  - 💡 タスク#7の `--list` を実行すると実際の description が一覧表示されるので、
    **このファイルと見比べれば「古い文言のまま残っているコマンド」が判明する**。手順をタスクに追記済み。

## 🕵️ 到達不能な危険コードと、5か月前のまま放置された仕様書（2026-09-29）

- [x] **`broadcast_modal:`（参加者への一括連絡）を削除**
  - **到達不能だった**: これを開くボタン `broadcast_start:` は `_tests_v3/TEST_SPEC_WORKER.md`
    （2026-04-17付）に記載があるだけで、**現在のソースに存在しない**。誰も使えない死んだコード。
  - ⚠️ **復活させると危険な作りだった**: 権限チェックが一切無いのに、送信される文面は
    「📣 **募集主からの連絡**」と名乗り、参加者・観戦者・募集主の**全員へメンション**する。
    ボタンを付け直した人が気づかないまま、**募集主を騙って全員に通知を飛ばせる**機能になっていた
    （他の管理者モーダルは `userId !== CONFIG.ADMIN_ID` で正しく守っている）。
  - 送信失敗が `console.error` だけで、無条件に「✅ 送信しました」を返す作りでもあった。
  - 削除理由と「同種の機能を作る場合は権限チェック＋送信結果の確認を必ず入れる」旨をコメントに残した。

- [x] **`_tests_v3/` の仕様書2件に乖離警告を追記**（削除はせず履歴として残した）
  - **2026-04-17付**＝5か月前の「Phase 0」リライト用リファレンスで、現在の実装と大きく食い違っていた。
    このプロジェクトは**古いドキュメントを信じて無駄な調査をする事故が繰り返されている**
    （本セッションでも TODO の「youtube_bible_forge は動画解析が使用中」という誤記述で回り道をした）ため、
    誤読を防ぐ警告を先頭に置いた。
  - `TEST_SPEC_WORKER.md` の乖離:

    | 記載 | 実際 |
    |---|---|
    | `/ktm_portal` | 廃止（`/portal` へ統合） |
    | `/balance` | **実装が存在しない** |
    | GAS連携10箇所 | `fetchGAS()` は削除済み |
    | `broadcast_start:` / `broadcast_modal:` | 削除済み（上記） |
    | `balance_from_recruit:` / `forge_show:` / `leave:` / `rebalance` | **実装が存在しない** |

  - `TEST_SPEC_GAS.md`: GAS連携自体がもう使われていない旨を明記。
    あわせて **`env.INTERNAL_GAS_SECRET` は名前にGASが入っているだけの別物で現役**（`/trigger-scheduled` の鍵）
    という注意も書いた（混同すると鍵を消しかねない）。
  - 現行の正しい情報源（`commandDefinitions.js` / `index.js` / `dry_run_recruitment_status.mjs`）を
    警告内に明記した。

---

## 🧾 入力モーダルの検証追加と「無条件✅」の是正（2026-09-29）

`modals.js` の入力系モーダル（新規メンバーが最初に通る経路）の監査結果。

### 🔴 入力値が一切検証されていなかった

- レーン欄に「とっぷ」と打つと**そのまま保存され「🎉 登録完了！希望レーン: とっぷ」と成功表示**される。
  だがバランサーは `ROLES.includes(mainRole)` で弾くので（`04_PORTAL/src/lib/balancer.ts:150`）
  **その希望は永久に無視される**。本人は希望レーンにならない理由が分からない。
  ポータル側（`/api/player/update-puuid`）も検証せず `role_preferences.primary` にそのまま保存していた。
- こだわり度も NaN チェックだけで範囲制限が無く、パネルの説明が「1=絶対 / 2=通常 / 3=柔軟」なのに
  **999 を入れても「受付ました」**になっていた。
- ⚠️ **データは壊れない**（バランサーが安全に無視する）ので緊急度は低いが、
  「確認したのに永久に無視される」のは一番たちの悪いUXなので入口で弾く方針にした。
- [x] **対応**: `helpers.js` に `normalizeLaneInput()` / `normalizeWeightInput()` を新設し、
  `portal_register_modal` と `portal_lane_modal` で検証。無効なら**保存せず理由を返す**
  （「まだ何も保存されていません」と明記）。
  - LoLの慣習的な別表記も吸収する: `BOT`/`BOTTOM`→`ADC`、`jungle`→`JG`、`support`→`SUP`、
    大小文字・前後空白、「なし」「NONE」→`-`。
  - **実データパターンで検証済み**: 有効値8種すべて通過、無効値（`とっぷ`/`中央`/`TOPP`/`ばんぱ`）
    すべて拒否、こだわり度は `1〜3` のみ通過（`0`/`4`/`999`/`-5`/`abc` を拒否）。

### 🔴 「無条件✅」がさらに2件（本日合計4件）

`ctx.waitUntil` で非同期に処理するのに、成否を待たず成功文言を返す構造。

| 箇所 | 失敗時に起きていたこと |
|---|---|
| `portal_lane_modal` | 保存に失敗しても「✅ レーン設定を受付ました」＋入力値をそのまま表示 |
| `portal_recruit_modal` | **カード投稿に失敗しても「✅ 募集を #募集板 に投下しました！」**。募集が存在しないのに募集主は来ない人を待ち続ける |

- [x] 両方を `type: 5`（処理中）で先にACKし、**実際の結果で上書き**する方式へ変更。
  失敗時は理由＋「保存されていません / 作成されていません」を明示し、`notifyAdminError` へも流す。
  `sendDiscordMessage` は失敗時も throw せずレスポンスを返すため、`res.ok` を明示的に確認している。
- 本日の同パターン4件: ベット（`bet.js`）／試合記録（`helpers.js`）／レーン設定／募集投稿。
  **`ctx.waitUntil` と即時レスポンスの組み合わせが、このコードベースの構造的な弱点**だと分かった。
  今後 `waitUntil` を使うときは「成功文言を即返ししていないか」を必ず確認する。

### ✅ 問題なしと確認

- `portal_register_modal` / `portal_ign_modal` は**元から良い実装**だった。
  `data.status === "SUCCESS"` を確認し、失敗時は具体的な対処（サモナー名の形式例）を案内している。
  エラー報告自体の失敗にも備えた入れ子の try/catch まである。この水準が理想。
- 管理者モーダル2件（`admin_fix_match_modal` / `admin_adjust_mmr_modal`）の `✅` 即返しは**安全**。
  `fetchPortalAPI` が非200で throw するため成功文言に到達せず、
  index.js のグローバルハンドラがユーザーへエラー表示＋管理者通知する。
- `recruitments` テーブルへの記録失敗を `console.error` で流している箇所は**意図的にベストエフォート**
  （2026-09-23の設計判断でDiscordのチャンネル走査を正としたため）。ここは通知を追加しない。

### 「waitUntil＋無条件✅」を機械的に全走査（2026-09-29・調査完了）

本日4件見つかった構造的弱点を、**目視ではなくスクリプトで全ファイル走査**した
（`scratchpad/scan_waituntil.mjs`: `ctx.waitUntil` の直後に現れる `Response.json` を拾い、
`type: 5`（処理中）でないのに成功文言を含むものを検出する）。

- [x] **5件目を発見・修正: `quick_recruit:`（クイック即募集）**
  `portal_recruit_modal` と同じ問題。カード投稿が失敗しても
  「⚡ ○○人の募集を #募集板 に投下しました！」を返していた。募集が存在しないのに
  募集主は来ない人を待ち続ける。→ `type: 5` で先にACKし、`res.ok` を確認して
  実際の結果で上書き。失敗時は `notifyAdminError` へも流す。

- **精査の結果「問題なし」と判断した箇所**（スクリプトが拾ったが実際は正しい）:
  | 箇所 | 判断 |
  |---|---|
  | `delete_recruit`（🗑️ この募集は削除されました） | **正しい**。`type: 7` でカード自体を置き換えるので表示＝事実。権限チェック（`canManageRecruitment`）もある。`waitUntil` 側のDB更新は意図的なベストエフォート |
  | `exec_init_mmr:`（⌛ 処理を開始しました） | **正しい実装**。成功時 `✅ 実行完了`、失敗時 `❌ エラー` で上書きしている |
  | `portal_menu_cancel`（✅ 操作をキャンセルしました） | **正しい**。キャンセルは応答自体で完結している |
  | `modals.js` の2件 | 本セッションで修正した `type: 5` 化が検出されたもの |

- **結論**: この弱点は**計5件で、すべて対処済み**。
  検出スクリプトは使い捨てにせず手順をここに残したので、今後 `waitUntil` を追加した際に
  同じ走査を再実行すれば回帰を検知できる。

---

## 🧭 案内文と実挙動の食い違いを全走査（2026-09-29）

> **指摘**: 「新しい参加者への導線は分かりやすいか／案内と間違った挙動になっていないか」
> → 目視でなく**スクリプトで全走査**した（`scratchpad/scan_guidance.mjs`:
> 案内文中の「〜」で囲まれたボタン名と `/コマンド` 参照を抽出し、実在するラベル78種・
> コマンド9種と突き合わせる）。先に見つけた「🆔 IGN登録」と同型の不一致を探す狙い。

### 🔴 実在しないボタン名を案内していた（3箇所）

| 案内文 | 実在するラベル | 場所 |
|---|---|---|
| 「📝 サモナー名登録」 | 「📝 サモナー名**変更**」 | `/stats` の未登録メッセージ |
| 「📝 サモナー名登録」 | 同上 | ガイド 1/3 |
| 「⚙️募集編集」 | 「⚙️ 募集**を**編集」 | クイック即募集の完了文 |

（「📍 レーン設定」→ 実際は「📍 レーン設定**変更**」も併せて修正。
スキャナは部分一致で通してしまったが、探して見つからない点は同じ）

### 🔴 存在しない機能を約束していた（虚偽の案内）

- **ガイド3/3に「毎月1日には月間MVPなどの表彰も発表されます！」と書かれていた。**
  月間アワードは cron が未登録で**一度も発火したことがなく**、2026-09-29に機能ごと削除した。
  つまり**永久に来ない表彰を新規メンバーに約束していた**。
  2026-09-22に一掃した偽装データと同じ性質（Bot配下は当時の監査対象外だった）。
  → レートの仕組みと確認方法（`/stats` `/ranking` `/coins`）の案内へ差し替え。

### 🟡 案内の手順が非効率だった

- `/stats` の未登録メッセージが「①レーン登録 ②カスタム参加 ③サモナー名登録」の3手順を
  案内していたが、**緑の「🎮 サモナー名 ＆ 希望レーン登録」1つで①と③が同時に済む**。
  パネル側の推奨フロー（🔰 はじめての方はこの2つだけ）と表現を統一した。
- ガイド1/3も同様に「この2つだけ済ませれば参加できます」の構成へ書き直し、
  **🔔 募集通知をONにする必要性**（ONにしないと募集に気づけない）を明記した。

### 🟡 ガイドの色が UI 規約違反だった

- `0x3498db`(青) / `0x2ecc71`(緑) が `.claude/rules/ui-conventions.md` の
  「寒色系ネオン禁止」に反していた → Hextechゴールド系（琥珀・深緑・橙）へ変更。

### 検証

- 再走査で **「✅ 案内文の参照はすべて実在します」** を確認。
- ガイド3ページを実際にレンダリングして目視確認（各209/209/130文字、上限4096内）。
- ⚠️ スキャナの限界: 動的ラベル（`` label: `✋ 参加する (あと${remaining}名)` `` のような
  テンプレート文字列）は完全一致で拾えない。「✋ 参加する」は実在したが一度誤検出した。
  **再実行時は検出結果を必ず実コードで確認すること。**

---

## 🤝 師弟掲示板の使いやすさ調査（2026-09-29）

3日間本番に存在しなかった機能（デプロイ失敗）なので重点的に見た。

### 🔴 登録が失敗しても「✅ エントリーしました！」と表示していた（6件目）

- `mentorship_pupil_modal` / `mentorship_mentor_modal` が `ctx.waitUntil` で保存しつつ、
  成否を待たずに「✅ 師弟掲示板にエントリーしました！」を返していた（`catch` は `console.error` のみ）。
  **掲示板に自分が載らないのに成功表示され、本人は「誰からもオファーが来ない」と待ち続ける。**
- → `type: 5` で先にACKし、実際の結果で上書き。失敗時は「※まだ登録されていません」と明示し
  `notifyAdminError` へも流す。**本日6件目の同パターン**（ベット/試合記録/レーン設定/募集投稿/クイック即募集に続く）。

### 🔴 希望レーンが無検証で、未入力時に黙って `MID` にされていた

- モーダルでは `required: true`（必須）なのに、解釈できない入力や空のとき
  **黙って `['MID']` を既定値にしていた**。「とっぷ」と書くと本人の意図と無関係に
  **MIDの師弟プロフィールが作られ**、しかも「✅ エントリーしました」と表示される。
- → `normalizeLaneInput()` で検証し、無効なら**登録せず理由を返す**（「まだ登録されていません」と明記）。
  師弟は単一レーンなので先頭1つだけを採用する点は維持。
- ✅ **入力欄の案内と検証が一致していることを確認**: placeholder が
  「TOP / JG / MID / **BOT** / SUP のいずれか1つ」で、検証側は `BOT → ADC` を吸収する。
  案内どおりに入力すれば通る。

### ✅ よくできている点（変更不要）

- **`mentorship_claim_pupil`（ワンポチ指導引き受け）は良い実装**。
  `data.ok` を確認し、失敗時は `data.error` を添えて報告、通信エラーも捕捉して案内する。
  成功時は専用指導スレッドへのリンクとボーナス（+300コイン）を明示。
- **Bot→ポータルの認証が fail-closed**。`/api/mentorship/matches` の `x-system-key` 検証は
  `validKeys` を `.filter(Boolean)` してから照合するため、**キーが未設定なら必ず401**になる
  （空文字ヘッダーでも通らない）。
- 弟子/師匠の入力欄は目的が明確で、placeholder に具体例がある（「例: CSの取り方や
  ウェーブ管理を安定させたいです！週末夜に通話できます。」など）。初見でも書ける。

### 🟡 記録に留めた懸念（未対応・要判断）

- [x] **高価値な秘密情報の流用廃止 ＆ 完全一致認証へ是正**（2026-09-29 完了）
  - `/api/mentorship/matches` における `SUPABASE_SERVICE_ROLE_KEY` および `DISCORD_BOT_TOKEN` の流用を完全撤去。
  - 専用の `SYSTEM_SYNC_KEY`（完全一致 `===`）または `verifyBotSecret()`（`PORTAL_BOT_SECRET`）による認証へ一本化し、部分一致リスクと万一のトークン漏洩リスクを解消。
- [x] **`/api/mentorship/profiles` POST のなりすまし防止ガード配備**（2026-09-29 完了）
  - ログイン中ユーザーは自身の `session.discordId` での登録を強制。
  - 未ログイン時のリクエストは `verifyBotSecret()`（Botからの正当な代理登録）のみ許可し、未認証の外部リクエストによる他人名義作成を 401 遮断。

---

# 📋 ポータル全量調査（2026-09-29）

> **依頼**: 「都度聞くのが面倒なので全量調査して。師弟機能はWebポータルにもあるから」
> 対象: **97,585行 / APIルート170本 / 師弟機能6,706行**。目視では不可能なので
> 本日確定した欠陥パターンをスクリプト化して全量走査し、検出結果を実コードで精査した。

## 🔒 APIルート170本の認証状況を全量走査

- **コイン操作の無認証は0本**（本日 `match/record` を塞いだ分が効いている）。
- 書き込み系で認証の形跡が無いもの20本を精査し、**2本が実害**と判断して修正した。

### 🔴 修正: `/api/match/news` POST（Geminiクォータ枯渇の経路）

- **無認証・クールダウンなし・重複防止なし**でGeminiを呼べた。有効な `matchId`（126件存在）を
  1つ知っていれば同じ試合に対して何度でも再生成を要求でき、**日次クォータを枯渇させられる**。
  このプロジェクトはクォータ枯渇で複数時間の障害を実際に起こしている（HANDOVER §2 2026-08-09〜10）。
- 重複防止は**GET側にしか無かった**（POSTは素通り）。
- **調査で判明**: このHTTP POSTには**呼び出し元が1つも無い**。正規の生成経路は
  `match/record` が `generateMatchNews()` を直接importして呼ぶ。画面側(`MatchNewsTicker`)はGETのみ。
  → 手動再生成用の口なので**管理者セッションまたはBot経由のみ**に制限した。

### 🔴 修正: `/api/discord` POST（Discord連投）

- 無認証でチャンネルへ投稿できた。**名前検証は既にあった**（2026-08-05対応で、
  実在しない登録名を含む投稿は拒否）が、**実在名を使った連投は防げていなかった**。
- `balancer/page.tsx` から実際に使われている意図的な公開APIなので、認証ではなく
  **30秒クールダウン**を追加（`match/analyze-image` と同じ edge_tasks 方式に揃えた）。
  チーム分け投稿は本来1試合1回なので通常利用を妨げない。

### ✅ 問題なしと確認（誤検出・既に対処済み）

| ルート | 判断 |
|---|---|
| `/api/match/analyze-image` | **既に30秒クールダウン実装済み**（2026-08-05に同じ懸念で対処）。コードベース中最も高コストなGemini呼び出しだが保護されている |
| `/api/player/sync-soloq` | **クールダウン4箇所あり**（Riot API保護） |
| `/api/auth/login` `/logout` `/logs/error` `/push/subscribe` | 公開が正しい性質 |
| その他 | DB書き込みのみで外部コストが無く、実害が小さい |

## 🤝 師弟機能（ポータル側6,706行）の調査

### ✅ UIは良く作られていた（変更不要）

スキャナが4件の「fetch結果未確認」を挙げたが、**精査の結果ほぼ誤検出**だった。

- `MentorshipHubPanel` は `res.ok` ではなく **`data.ok` を確認**し、失敗時は
  `toast.error(data.error)` でユーザーに理由を表示している。catch でも `toast.error` を出す。
  （サーバーがHTMLエラーを返した場合も `.json()` の例外を catch が拾う）
- 唯一の空 `catch (_) {}` は **canvas-confetti の import 失敗用**で、演出が出ないだけなので妥当。
- `data.bonusCoins || 500`（+500コイン獲得の表示）は `data.isFirstTimeBonus` で分岐しており、
  APIは `isFirstTimeBonus ? 500 : 0` を返すため**架空表示にならない**。`|| 500` は冗長だが無害。
- 「由来を偽る表示」47件は**全て誤検出**。`championKitTactics.ts` の「確定キル」「確定ダメージ」は
  LoLの戦術用語（guaranteed）で、データの由来主張ではない。

### 🟡 サーバー側の失敗が全て無音（未対応・要判断）

- **師弟APIルート5本で catch 計43箇所、管理者通知は0件**。
  `notifyPortalError`（`lib/discordNotify.ts`）は存在するが、ポータル全体で使っているのは
  `app/api/logs/error/route.ts` の1箇所だけ＝**Bot側と同じ「機構はあるが使われていない」状態**。
- Bot側は本日 `notifyAdminError` を9箇所へ配線したが、ポータル側は未着手。
  少なくとも「失敗するとデータが残らない」経路（`mentorship/matches` の
  APPLY/ACCEPT/CLAIM_MENTOR、`profiles` の登録）へは流すべき。

## 🐉 DDragonバージョンのハードコードが7箇所・3種類にバラけていた

- 値が `14.1.1` / `14.24.1` / `16.15.1` の**3種類**（実際の最新は **16.19.1**）。
  **「同じものの既定値が複数ある」＝誰も実データを見ていないサイン**（MMRの1200 vs 1000と同型）。
- 特に `lib/coachPostGame.ts` の **`14.1.1` は約2年前**で、その版のアイテムデータは現行と大きく異なる。
  `res.ok` も確認していなかったため、DDragonが一時的に落ちると**古い装備情報で講評を出す**恐れがあった。
- ✅ **対応**: `lib/ddragonClient.ts`（`res.ok`確認・配列検証・キャッシュを持つ良い実装）に
  `getLatestPatch()` と `DDRAGON_FALLBACK_PATCH` を新設し**唯一の正**とした。
  最も古い `coachPostGame.ts` をそこへ寄せ、`item.json` の `res.ok` 確認も追加。
- [x] **残り5箇所のパッチハードコード統一完了**（2026-09-29 完了）
  - `lib/ddragonClient.ts` に西暦表記パッチ（例: `26.19`）を返す `getCalendarPatch()` を新設。
  - `admin/dashboard-stats`, `admin/dict-health`, `admin/dict-health/verify`, `cron/dict-auto-refresh`, `lol/postgame-deep-analytics` の手書き fetch および `|| "14.24.1"` をすべて撤去し、共通関数へ一本化。コードベース内のパッチハードコードを完全根絶。

## 🎓 師匠立候補時にひとことを送れなかった（2026-09-29 修正）

> **質問**: 「師弟掲示板って師匠立候補時にコメント撃てるんだっけ？」
> → **答え: サーバーは受け取れるのに、画面から一度も渡していなかった。**

- `matches/route.ts` の `CLAIM_MENTOR` は最初から `message` を受け取る実装だったが、
  **Discordのボタンもポータルの確認ダイアログも送っていなかった**。結果:
  - マッチのメッセージが全員 `'指導を引き受けました！よろしくお願いします！'` の決め打ち
  - 師匠プロフィールが自動作成される場合の `bio` も決め打ちで、
    **立候補した師匠全員がまったく同じ自己紹介文**になっていた
  - 弟子側は「どんな人が引き受けてくれたのか」が分からない
    （師弟マッチングで最も見られる情報なのに機能していなかった）
- **非対称でもあった**: 弟子からの申請（`APPLY`）は最初からメッセージを書けた
  （`MentorshipRequestModal` に例文つきのtextareaがある）。
- ✅ **対応（受け皿は既にあったので渡すだけ）**:
  - **ポータル**: `confirm()` の後に `prompt()` でひとことを受け取る（任意・空欄でも成立）。
    キャンセル（null）は引き受け自体の取り消しとして扱う。
  - **Discord**: ボタン押下で即実行していたのを**モーダル経由**に変更
    （`mentorship_claim_pupil:` → `mentorship_claim_modal:` → `executeMentorshipClaim()`）。
    実処理を `components.js` から関数として切り出し、`modals.js` から動的importで呼ぶ（循環なし）。
  - **サーバー**: ひとことがあれば師匠プロフィールの `bio` に反映し、
    空欄のときだけ従来の定型文にフォールバックする。
  - 例文も添えた（「JGのルート設計を中心に見ます。週末の夜なら通話できます」）。

## 🔎 全量調査で洗い出した残りの不備（2026-09-29）

スクリプトで「決め打ち文言 / 放置TODO / 参照0件のexport」を全走査した結果。

### ✅ 誤検出と判断したもの（対応不要）

- **「DBへ保存される決め打ち文言」31件のうち30件は `NextResponse.json({ message: ... })`**
  ＝APIの応答メッセージで、DBには保存されない。UIに出す固定文として妥当。
  **実際に問題だったのは師弟の `bio` 1件のみ**（上記で修正）。
- 放置TODO/暫定は4件のみで、いずれも「なぜそうしたか」を説明する注記や、
  既知の課題への参照（`sync-match-feedback` の TODO.md 言及など）で、放置された作業ではない。

### 🟡 参照0件のexport 12件（未対応・要判断）

削除候補だが、**機械的に消すと危険なものが混ざっている**ため記録に留める。

| export | 判断材料 |
|---|---|
| `balancer.ts: coreBalanceTeams` | **テストから使われている可能性**（`__tests__` を走査対象外にしたため検出された）。消さないこと |
| `coinLedger.ts: summarizeCoinFlow` | コイン収支の集計。2026-09-22に「実測できる」として新設したもので、**運用時に手で呼ぶ想定**。残す価値あり |
| `mentorshipConstants.ts: COMMUNICATION_STYLES` / `DISBAND_REASONS` | 師弟のUI選択肢。**今後UIに出す予定なら残す**。使われていないなら選択肢がUIに無いということ＝機能の作り残し |
| `playerStyleProfile.ts: CHAMPION_DEEP_PROFILES` / `KAZURIN_SESSION_ANALYTICS` | **2026-09-22の偽装データ一掃で無効化された残骸の可能性**。`KAZURIN_...` は個人名入りの手入力データで、当時「your.gg実戦データ連動」を騙っていた問題の中心。削除候補として有力 |
| `geminiClient.ts: callGeminiStructured` / `callGeminiWithCritic` | 未使用のGemini呼び出しバリエーション。残しても害はないが使う予定がなければ削除可 |
| `riot.ts: fetchSummonerByPuuid` / `fetchLeagueBySummonerId` | Riot APIラッパー。将来使う可能性があるが現状デッド |
| `dataDragonMaster.ts: getChampionSkills` / `dictFactCheck.ts: getChampionPreviewText` | 同上 |

→ **次にやるなら `playerStyleProfile.ts` の2件から**（偽装データの残骸である可能性が高く、
   残っていると再び「実データ連動」として使われる危険がある）。

---

## 🔌 「受け皿はあるのにUIから渡していない」パターンの継続調査（2026-09-30）

昨日見つけた「師匠立候補時のコメント」と**同型の問題**を、参照0件のexportを起点に洗い直した。

### 🔴 修正: やりとりの形（commStyle）を誰も選べなかった

| 項目 | 実態 |
|---|---|
| 選択肢の定義 | 🎙️ VC通話歓迎 / 🎧 聞き専OK / 💬 テキスト添削のみ |
| サーバー | `commStyle` を**10箇所**で扱い、`MatchMeta` としてDBに保存 |
| **UI** | **一度も送っていなかった** → 全員 `'VC_ACTIVE'`（通話歓迎）で固定 |

- `COMMUNICATION_STYLES`（`lib/mentorshipConstants.ts`）は**定義だけで参照0件**だった。
  つまり **「通話は苦手だからテキストで教わりたい」人が意思表示できず**、
  全員が通話前提として記録されていた。師弟の相性を左右する情報なので実害がある。
- ✅ **対応**: 申請モーダルに3択のボタンUIを追加（既存の期間選択と同じ作り）。
  `MentorshipRequestModal` → `MentorshipHubPanel` → `/api/mentorship/matches` まで配線した。
  既定値は従来どおり `VC_ACTIVE` なので、選ばなくても挙動は変わらない。

### 🟡 `DISBAND_REASONS` も同様に参照0件（未対応・要判断）

- 円満解散の理由選択肢が定義されているが、UIから使われていない。
  解散フロー（`DISBAND`）で理由を選べるようにするか、選択肢自体を削除するかの判断が必要。
  `commStyle` と違い**サーバー側が受け取っている形跡が無い**ため、UIとサーバー両方の対応が要る。

### 📝 手入力データの注記を追加（削除はしない方針を踏襲）

`lib/playerStyleProfile.ts` の **参照0件の2つのexport**に注記を入れた。

- `CHAMPION_DEEP_PROFILES` / `KAZURIN_SESSION_ANALYTICS` は、`winRate` `kda` `gamesCount` まで
  揃った**実測のように見える手入力スナップショット**。
  2026-09-22に「your.gg実戦データ連動」の偽装を一掃した際、**未使用だったため対象から漏れていた**。
- ファイル冒頭の既存方針（「数値は転記由来と思われるため削除はせず、いつ時点の手入力値か明示する」）に
  従い、**削除せず各定義に由来と日付、再配線時の注意を明記**した。
- ⚠️ 「ゴールデンタイムは勝率62%」等をUIやAIプロンプトへ出す場合は、
  **測定値ではなく手入力の記録**である旨を併記すること。

### ✅ 前回の判断が正しかったことを確認

- `balancer.ts: coreBalanceTeams` は**他から12件参照あり**（テストから使用）。
  前回スキャナが「参照0件」と出したが `__tests__` を除外していたための誤検出で、
  「機械的に消すと危険」と記録して消さなかった判断が正しかった。
- 残る参照0件は `summarizeCoinFlow`（運用時に手で呼ぶ想定）・Gemini呼び出しの
  未使用バリエーション2件・Riotラッパー2件・DDragon/辞典の2件。いずれも害は無く保留。

---

# 🐍 Python側の全量走査 ＆ Geminiモデル実測（2026-09-30）

## ⚠️ まず訂正: 「死んだモデルが現役ワーカーに残っている」は私の誤りだった

- `youtube_worker.py:73` の `VIDEO_MODEL = "gemini-2.5-flash"` を、
  HANDOVER の過去記録（2026-08-09〜10に無料枠0）と同ファイル59行のコメント
  （「日次上限を超過した実績があるため使わない」）から**死んだモデルと判断しかけた**。
- `gemini-model-health-check` スキルで実測した結果 **`gemini-2.5-flash` は ✅ 動作OK**。
  59行のコメントは「テキスト生成で大量に叩いて日次上限に当たった過去の経緯」であり、
  73行は映像解析（低頻度）用に**意図して選んでいる**（72行に「実クォータを確認したものだけを書くこと」とある）。
- **推測で変更していたら、動いているモデルを壊していた。** `llm-health.md` の実測義務と
  このスキルが存在する理由そのものだった。

## ✅ 実測結果: 実際に使われている死んだモデルは0件

| 結果 | モデル |
|---|---|
| ✅ 動作OK | `gemini-2.5-flash` / `gemini-3.1-flash-lite` / `gemini-3.5-flash` / `gemini-3.5-flash-lite` / `gemini-3.6-flash` |
| ❌ 404 | `gemini-1.5-flash-latest` / `gemini-2.0-flash` / `gemini-2.0-flash-lite` / `gemini-2.5-flash-lite` / `gemini-2.5-pro` |

- **404の5種はすべて「なぜ使わないか」を説明するコメント内の言及**で、実呼び出しは0件。
  スキルが警告している既知の誤検出パターン（置換後に経緯コメントが残る）どおりだった。
- `gemini-key-input`（HTMLのid）と `gemini-model-health-check`（スキル名）も当然の誤検出。

## 🔴 ただし1件だけ本物: ポータルの設計書が存在しないものを説明していた

`04_PORTAL/src/app/design/systemDesignMarkdown.ts`（`/design` と `/admin/design` に表示される設計書）に、
**すでに存在しない構成要素の説明が3つ**残っていた。

| 記載 | 実態 |
|---|---|
| 「SREデーモン（Python）が15分おきに自動巡回」 | `sre_daemon.py` は**2026-07-26に削除済み**。実際は GitHub Actions の `youtube_worker.py`（30分おき） |
| 「ローカルファイル `04_PORTAL/kirei_queue.json`（動画解析のタスクキュー）」 | **ファイルは存在しない**。実際は Supabase `youtube_queue` テーブル |
| 「Gemini API (`gemini-2.5-pro` / Paid) に渡し」 | **404で呼べないモデル**。実際は `gemini-3.1-flash-lite` 等 |

- ✅ **対応**: 3箇所すべて実態に合わせて修正し、字幕が無い動画のWhisper経路も追記した。
- **これは「嘘の記載」観点で最も質が悪い型**だった。コード内のコメントと違い、
  **ポータルの画面に「システム設計書」として表示される**ため、読んだ人が現状と誤認する。

## 📊 Python側の走査結果（119ファイル）

| 観点 | 結果 |
|---|---|
| ハードコードされた秘密情報 | ✅ **0件**（Webhook URL・APIキーの直書きなし） |
| `except: pass`（完全に無視） | 🟡 **65件** |
| `print`/`log` のみで通知なし | 🟡 **153件** |
| 失敗を確認せず成功を出力 | 🟡 検出35件（大半は監査スクリプトが「0件で健全」と報告する正当なもの） |
| DDragonバージョンの決め打ち | 🔴 **7種類にバラけている**（下記） |

- [ ] **DDragonバージョンの決め打ちがPython側で7種類**（未対応）:
  `16.19.1` / `16.18.1` / `16.16.1` / `16.15.1` / `16.11.1` / `15.14.1` / `14.24.1`。
  ポータル側の5箇所と合わせると**プロジェクト全体で10種類以上の「最新バージョン」が併存**している。
  「同じものの既定値が複数ある＝誰も実データを見ていないサイン」の最大の実例。
  Python側には共有クライアントが無いため、`scripts/` 用の共通取得関数を作るのが筋。
- [ ] **`except: pass` 65件の棚卸し**（未対応）。全部が悪いわけではない
  （任意importのフォールバック等は妥当）が、件数が多いため
  「失敗するとデータが残らない経路」に絞って通知を入れる方針で別途進める。

---

# 🔧 DDragon決め打ちの解消 ＆ 自動化マップの実態化（2026-09-30 後半）

## ✅ 完了: HUDのアイテム価格が2年前のパッチで計算されていた

`03_SYSTEMS/v2_CORE/_LOL/overlay/item_price_manager.py` が `DDRAGON_VERSION = "14.24.1"`
（2024年12月）を決め打ちしていた。overlay全体（`hud_state_engine` / `macro_analytics` /
`matchup_card_widget` / `spell_tracker_widget` / `toast_alert_widget` / `top_bar_widget` /
`dynamic_build_advisor`）から使われている現役モジュール。

**実測した乖離**（14.24.1 と 16.19.1 の item.json を実取得して比較）:

| 観点 | 数値 |
|---|---|
| アイテム総数 | 575件 → **870件** |
| 14.24.1に存在しないアイテム | **295件**（うち購入可能かつ1000G以上が**172件**） |
| 価格が変わったアイテム | **90件**（例: 1000G→2750G、3100G→1100G） |

- 「所持アイテムのゴールド総額を100%正確に算出」と謳っていたが、現環境のアイテムを
  0G扱い・旧価格扱いで計算していた。`get_item_price()` を直接使う
  `dynamic_build_advisor.py:430` の「2600G以上か」判定も新アイテムでは常に偽になっていた。
- さらに**キャッシュ（`cache/ddragon_items.json`）にバージョン情報が無く**、
  定数を新しくしても既存キャッシュが読まれ続けて何も変わらない状態だった（二重の罠）。

**対応**:
- `overlay/ddragon_version.py` を新設。`versions.json` から解決し24時間ローカルキャッシュ、
  取得失敗時は `FALLBACK_VERSION`（実測値）へ退避。HUD起動を待たせないよう
  import時は `allow_network=False`（キャッシュ読みのみ）にできる設計。
- `item_price_manager.py`: バージョン動的解決 ＋ **キャッシュをバージョンで紐付け**
  （旧形式キャッシュは期限切れ扱いで自動破棄）。通信失敗時は古いキャッシュで代用し、
  ハードコード数十件へ落ちないようにした。
- `spell_asset_manager.py`: 同じく動的解決。アイコン取得の2段目フォールバックが
  `14.24.1` 固定だったため、**2024年12月以降に追加されたチャンピオンは1段目が失敗すると
  必ず灰色の四角**になっていた（`FALLBACK_VERSION` へ変更）。
- 検証: 870件ロード、`3031=3500G` `3172=1100G` 等が現行値で取得できることを実測確認。

## ✅ 完了: アイテム名の逆引きが無関係なIDを返していた（副次発見）

- item.jsonには**名前が空の内部エントリが4件**（2008等）あり、部分一致の `clean in q`
  （空文字は必ず含まれる）に引っかかって、**一致しない問い合わせすべてに対して
  無関係なIDを返していた**。→ 存在しない名前は 0 を返すよう修正。
- **同名で複数IDを持つアイテムが218件**（アリーナ/ARAM用の `221xxx`/`223xxx`/`771xxx` 派生）。
  辞書の並び順で派生IDを返すことがあり、CDNに画像が無くてアイコンが灰色になっていた。
  → 最小のIDを正規アイテムとして優先し、部分一致は最も具体的（長い）名前を選ぶよう修正。

## ✅ 完了: パッチ番号の決め打ち2ファイル

- `scripts/audit_tactics_bibles.py`: 注記済み判定が `"16.19.1" not in content` のリテラル比較で、
  次のパッチに進むと(1)常に `DIFF_PENDING` と誤報告し(2)`--fix` で注記を毎回重複挿入していた。
  → 差分JSONの `new_patch` 実値で判定するよう修正（既定値のリテラルも削除）。
- `scripts/check_patch_update.py`: `old_p = "16.18.1" if latest == "16.19.1" else current` という
  特定パッチ専用の分岐。→ `fetch_previous_patch_version()` を追加し `versions.json` から
  「1つ前のマイナー」を実取得。現行値（16.18.1 ➔ 16.19.1）を再現することを実測確認。

## ✅ 完了: 私自身の誤記載を訂正（設計書の youtube_worker）

本日の前半に `systemDesignMarkdown.ts` を修正した際、「GitHub Actions の
`youtube_worker.py`（30分おき）が自動巡回」と書いたが、**これは事実ではなかった**。
`ktm-cloud-worker.yml` のコメントに明記されている通り、**youtubeジョブの定期実行は
2026-07-31に停止済み**（GitHub Actionsの共有IPがYouTube側から低信用と判定されるため）で、
現在は `workflow_dispatch` の手動実行のみ。嘘の記載を直す作業で新しい嘘を書いていた。
→ 停止の事実・理由と、ローカル `edge_worker_daemon.py` が15分おきに `youtube_absorb` を
起票してWhisper(GPU)で処理する実経路に書き換えた。

## ✅ 完了: AUTOMATION_MAP.md を全面改訂（旧48行 → 140行）

「止まっているのに気づかない」を防ぐための表自体が最大の盲点になっていた。

| 旧版の記載 | 実態 |
|---|---|
| `prospector.yml` / `youtube-worker.yml` | **どちらも存在しない**。実際は両方 `ktm-cloud-worker.yml` 内のジョブ |
| YouTube新着巡回「毎時(0分)」 | 実際は `0 23,5,11 * * *` = **1日3回**（JST 08/14/20時） |
| Riotパッチ番犬「GitHub Actions 1日2回」 | **どのワークフローにも登録されていない**（下記） |
| 動画解析ワーカー「キュー起票契機＋定期実行」 | **2026-07-31に定期実行停止**、手動のみ |
| （記載なし） | GitHub Actions **11本**・Vercel Cron **7本**・Cloudflare Cron **5本**が未記載 |

→ 実ファイルから機械的に再作成し、再検証用のコマンドも冒頭に明記した。

## 🔴 未対応（ユーザー判断が必要）

- [ ] **`scripts/check_patch_update.py` に実行者がいない**。
  `01_INTEL/_LOL/current_patch.json` の記録が **16.18.1（最終確認 2026-09-18）** で止まっており、
  公式最新 16.19.1 との差分検知・検証キュー更新・Discord速報が自動では一度も走っていない。
  - 手動実行する場合: `py scripts/check_patch_update.py`（Discordへ速報が飛ぶので要承知）。
    まず `--check-only` や `--dry-run` で確認するのが安全。
  - 自動化する場合: GitHub Actionsワークフローの新設が必要。**Discord通知が定期的に飛ぶようになる**ため、
    作成の可否を確認したい。
- [ ] **`scripts/ops_health_check.py` にも実行者がいない**。上記パッチ番犬の停止を検知できるはずの
  点検自体が自動実行されていない（乖離を検知する仕組みが乖離していた）。
- [ ] `02_FACTORY/_LOL/champion_update_queue.json` が `status: "suspended"` のまま、
  **未処理(pending)が約35体**残っている（最終更新 2026-09-29）。意図的な停止か放置かの確認が必要。
- [ ] Python側 `except: pass` 65件の棚卸し（前述。件数が多いため「失敗するとデータが残らない経路」に絞る方針）。

---

# 🧹 `except: pass` 65件の棚卸し（2026-09-30）

機械的に全件消すのではなく「何を握りつぶしているか」で分類し、**失敗するとデータが残らない／
原因が特定できなくなる経路**に絞って対応した。

| 分類 | 件数 | 判断 |
|---|---|---|
| 🔴 書き込み・保存を握りつぶし | 10件 | 稼働中3件を対応。残りは下記の理由で妥当と判断 |
| 🟡 読み取り・解析 | 38件 | ほぼ全てフォールバック値を返す設計で妥当（stdout末尾JSONの取り出し、タイムスタンプ解析等） |
| ✅ 妥当（任意import・後始末） | 17件 | `sys.stdout.reconfigure`、`process.kill()`、一時ファイル削除等。変更不要 |

## ✅ 対応したもの

- **`edge_worker_daemon.py` のハートビート送信**（5秒おき）。
  `except Exception: pass` で、しかも `status_code` も見ていなかったため、
  キーの誤り(401/403)やRLSで送信が通っていなくても**ログが一切出ない**状態だった。
  ハートビートは**ポータルの `/api/admin/pipeline-status` が「このデーモンが生きているか」を
  判断する唯一の材料**なので、「デーモンは動いているのに管理画面では停止扱い」の
  原因が特定できなくなる。→ status_code判定を追加し、**最初の失敗・以降5分ごと・復旧時**だけ
  ログに出す（5秒おきなのでログを溢れさせない間引き付き）。
- **`hud_config.py` のウィジェット位置保存**。読み書き両方を握りつぶしていたため、
  位置が保存できていないのに利用者に何も伝わらなかった。さらに
  **JSONが壊れている場合 load が `{}` を返し、そこへ1件だけ書き戻すので
  他の全ウィジェットの保存位置が黙って消える**経路になっていた。
  → 壊れたファイルは `.json.bak` へ退避してから作り直すようにし、失敗をログに出す。
  公開API（`load_widget_positions()` が dict を返す）は `run_overlay.py` が使っているため変更なし。
  初回・複数保存・破損時の3ケースを実測検証済み。
- **`check_patch_update.py` の記録パッチ読み取り**。失敗を握りつぶして `unknown` に落ちると、
  呼び出し側が「前回の記録が無い」のか「ファイルが壊れている」のか区別できなかった。→ 理由をログ出力。

## ⚪ 変更しないと判断したもの（根拠）

- `spell_asset_manager.py` の4件（アイコン取得の httpx.get）:
  取得失敗時は灰色の四角を返す設計で、HUDを落とさないための意図的な握りつぶし。
- `ai_helper.py:22`（スロットル状態ファイルの読み取り）: 失敗しても新規状態から始まるだけ。
- `cloud_youtube_monitor.py:162`（`last_fetched_at` のPATCH）:
  **この列はプロジェクト全体でどこからも読まれていない**（書き込み専用）。
  握りつぶしの実害は無いが、「誰も読まない列を書いている」という別の整理対象。

## 📌 残タスク

- [ ] `print`/`log` のみで通知なしの153件。件数が多く大半は正当（進捗表示）なので、
  「バッチが丸ごと失敗しても誰も気づかない経路」に限定して洗い出す必要がある。
- [ ] `cloud_youtube_monitor.py` の `last_fetched_at`: 読み手がいないので、
  管理画面に出すか、列自体を整理するかの判断。

---

# 🔓 辞典一括更新が1体で永久に詰まっていた問題 ＆ ポータル .tsx 全量走査（2026-09-30）

## ⚠️ まず訂正: 「未処理35体」は私の誤り

前回「未処理が約35体」と報告したが、巨大なJSONを目視で概算した私の誤りだった。
**正しくは27体**（DB・コミット済みファイルともに 146完了 / 27残 / 失敗0 で一致）。

## 🔴 本物の問題: フォールバック経路が一度も実行できない状態だった

DBを直接確認したところ、自動再開の仕組み自体は**正常に動いていた**
（毎時再起票され、各タスクは `completed`、`failed` は0件）。
にもかかわらず **2026-09-29 08:46 以降、1体も進んでいなかった**。

実行ログ（`edge_tasks.result`）を辿って判明した連鎖:

1. `champion_trend_worker` はまず **google_searchグラウンディング有り**でGeminiを呼ぶ。
   グラウンディングはGoogle側で「検索リクエスト/日」というモデル本体とは**別の（はるかに小さい）上限**を持ち、ここで 429 が出る。
2. その429が `error_429:oracle` を閾値（10件）超えまで押し上げ、`last_ts` を「今」にする。
3. コードには「**検索ツール無しで再試行**」というフォールバックが用意されているが、
   同じ `feature_name="oracle"` で呼ぶため、**自分が1秒前に記録した429**によって
   サーキットブレーカー（15分クールダウン）に弾かれ、**一度も実行されない**。
4. 結果、Ollamaフォールバック（未起動）まで落ちて「安全にスキップ」→ 毎時同じ
   `[1/27] ヴァルス` から始まって同じ所で止まる、という無限ループになっていた。

`settings.py` には**同じ症状の記録が既にあった**（2026-08-14「oracleが300件中4件しか
消費していないのに429を10件出しただけで打ち止め」）。当時は15分クールダウンを追加して
緩和したが、**実行中の即時リトライには効かない**ため、この経路だけ残っていた。

### ✅ 対応と実測結果

- `settings.py` に `oracle_nosearch: 300` を追加し、検索ツール無しの再試行を別カウンタにした。
  グラウンディング由来の429で、別枠であるはずの通常呼び出しが止まらないようにする。
- `quota_manager.describe_block_reason()` を追加。従来は予算切れでもブレーカーでも一律に
  「本日のAPI利用上限に達しました」と出ていたため、**実際は300枠中4件しか使っていないのに
  予算切れと誤認する**原因になっていた（私自身この調査で一度誤読した）。実数を出すようにした。
- **実測**: 修正後に実行すると `[1/27] ヴァルス → 成功`、`[2/27] ヴェイン → oracleはブレーカーで
  スキップされるが検索なしリトライで成功` と、1体ずつ確実に進むようになった（約30秒/体）。

## 📊 ポータル .tsx の全量走査（123ファイル / 53,808行）

| 観点 | 結果 |
|---|---|
| fetch後に成否を確認せず成功表示 | ✅ **実質なし**。検出8件はすべて `data.success` / `!res.ok` で判定済みの誤検出 |
| `catch {}` の空握りつぶし | 44件中 **43件は正当**（confetti・localStorage・ブラウザAPI可用性・エラーバウンダリ）。本物は1件 |
| バージョン決め打ち | 1箇所のみ（`admin/dict-health` の表示パッチ `26.15`） |
| TODO・仮実装の痕跡 | 5件。いずれも「以前ハードコードだったのを直した」旨の説明コメントで、残存課題ではない |

**Botで6箇所見つかった「処理の完了を待たずに✅を出す」型は、ポータル側には無かった。**
`data.success` / `!res.ok` の確認が一貫しており、この層の品質は高い。

### ✅ 修正した沈黙失敗3件（いずれも軽微だが利用者に嘘が伝わる型）

- `SoloQReflectionModal.tsx`: 記録済みマッチIDの取得失敗を完全に握りつぶしていた。
  取得できないと「済み」判定が丸ごと無効になり、**コメント自身が書いている
  「重複記録の誘発」（2026-08-05の既知バグ）がそのまま再発する**構造だった。
- `PushOptIn.tsx`: 通知解除時、サーバー側の購読レコード削除の成否を見ていなかった。
  ブラウザ側は解除されるので利用者への表示は嘘ではないが、**DB上は購読中のまま残る**。
- `DictionaryTab.tsx`: お気に入りのサーバー同期で4xx/5xxを検知していなかった。
  端末間同期が目的なのに、**同期できていないのにできたように見える**状態だった。

## 🟡 未対応（ユーザー判断が必要）: 禁止色の使用が1,310箇所

`.claude/rules/ui-conventions.md` は「寒色系ネオン（blue/indigo/purple/cyanの発光や
派手なborder-glow）は原則禁止」「過去のセッションでデザイン統一済み」と書いているが、実態は：

| 種別 | メンバー向け | 管理者専用 |
|---|---|---|
| **発光系**（`shadow-`/`ring-` ＋禁止色）＝ルールが明確に禁止 | **20箇所** | 23箇所 |
| 色指定のみ（text/bg/border/gradient） | 935箇所 | 332箇所 |

- 該当ファイル: メンバー向け57 / 管理者専用23。多い順に `analyzer/page.tsx`(115)、
  `balancer/page.tsx`(89)、`admin/knowledge/LibraryTabContent.tsx`(70)、`casino/page.tsx`(55)。
- [ ] **明確に禁止されている「発光系43箇所」だけ直す**のが順当だと考えるが、
  複数ファイルを跨ぐ見た目の変更なので着手前に確認したい。
- [ ] 色指定1,267箇所は、ルール文が実態より厳しいのか、統一作業が未完なのかの判断が必要
  （「デザイン統一済み」という記述自体が実態と合っていない）。

---

# 🎨 ポータルの色統一を完了（2026-09-30）

`ui-conventions.md` が「デザイン統一済み」と書いていたが実態は禁止色が1,286箇所残っていた件。
統一作業が未完という判断のもと、全量を暖色パレットへ寄せた。

## 置換ルール

番台（明度）は変えずに色相だけを振り替えることで、コントラストと視覚的階層をそのまま保つ。

| 元の色 | 置換先 | 根拠 |
|---|---|---|
| `blue` / `sky` / `cyan` | **`teal`** | ヘクステックブルー `#0AC8B9` 相当。ルールがセカンダリとして明示的に許可している寒色 |
| `indigo` / `purple` / `violet` / `fuchsia` | **`amber`** | Hextechゴールド（プライマリ） |

2系統に振り分けたのは、「青と紫で2つのものを区別していた」箇所が teal と amber の対比として
残るようにするため（1色に寄せると区別が消える）。

## ⚠️ 途中で自分が入れた退行と、その修正

- **最初の試行で50/100番台を除外したのが誤り**だった。`globals.css` の中和はダークモード
  限定で、ライトモードでは淡色もそのまま見えるため、`bg-purple-100 dark:bg-amber-950
  text-amber-800` のように**同じ色の組の中で寒色と暖色が混在**した。5ファイル分を破棄して
  番台を除外しない方式でやり直した。
- **機械的置換で「データの種類を色で区別している箇所」が潰れた**。元は別の色相だったのに
  同じ色へ寄ったファイルを機械的に洗い出し（35件）、そのうち「値で色を分岐している行」に
  絞って5件を特定、実害のある3件を手当てした。

| 箇所 | 潰れた区別 | 対応 |
|---|---|---|
| `lib/mmr.ts` | CHALLENGER(sky) / DIAMOND(blue) / PLATINUM(teal) が3つとも teal に | **例外として公式の階級色へ戻した**（下記） |
| `lib/mentorshipConstants.ts` | 7つの期間バッジが実質4色に（1と4、2と3と6が同一） | 許可パレット内で7つ全てを区別できるよう再割り当て |
| `ChampionVisualDashboard.tsx` | 7アーキタイプで teal×2・amber×2 が衝突 | 番台で振り分け。tank と enchanter の emerald 衝突は統一前からの状態だったので併せて解消 |

## 🔵 明示的な例外: ランク階級色

`lib/mmr.ts` の12箇所は寒色（sky / purple / blue）を**意図的に残した**。
ランク色は装飾ではなく**プレイヤーが読む意味のあるデータ**（LoL公式の階級色）で、
Diamondを金色にすると情報として誤りになる。発光・border-glowは使っておらず
`bg-X/10` と `border-X/30` の淡い塗りのみなので、ルールが禁止する「ネオングロー」には当たらない。
根拠は `mmr.ts` の関数コメントと `ui-conventions.md` の両方に記録済み。

## 結果

- 置換: **1,286箇所 / 80ファイル**（`.tsx` 123ファイル ＋ `.ts` 2ファイル）
- 残存する禁止色: **12箇所（上記の例外のみ）**
- 検証: `npx tsc --noEmit` エラー0、`npm run build` 成功
- `ui-conventions.md` を実態に合わせて更新（完了日・置換ルール・例外・
  「データの種類を色で区別している箇所は機械的に置換しない」という注意を明記）

## 📌 残タスク

- [ ] `globals.css` にある寒色の淡色中和ルール（`html.dark [class*="bg-indigo-50"]` 等）は
  参照元が無くなったため現状は死んだCSS。害はないが、整理するかは保留。
- [ ] 実際の画面での見た目確認（ライト/ダーク両方）。機械置換＋ビルド通過までは確認済みだが、
  色の印象そのものは目視でしか判断できない。

---

# 🧹 コーチページの整理（2026-09-30）

調査時点の規模: 17コンポーネント / 8,086行 ＋ 関連API 15本。
`page.tsx`（386行・3タブ・遅延読込）自体は既に整理済みで、問題は中身だった。

## ✅ 1. 条件なしで常時表示されていた「嘘のステータス」2件

整理で最も実害があったのはここ。どちらも条件が一切なく、実態と無関係に出ていた。

- **ヘッダーの「🟢 ライブ連携中」**（点滅ドット付き）: 何とも連携していなくても常時表示。
  ライブ検知は常時ポーリングではなく操作契機の取得なので、**実際に検知できた時だけ**
  「ライブ試合を検知（対面: 〇〇）」と出すようにした。
- **「試合中」タブの「Sovereign HUD 自動同期中 / 接続完了」**: HUDはローカルPCのPyQtアプリで、
  デプロイ先(Vercel)からは起動状態を**原理的に知れない**。HUDを立ち上げていなくても
  「接続完了」と出ていた。状態の主張をやめ、使い方の説明だけに変更した。

## ✅ 3. Riot ID の決め打ちを1箇所に集約

`"Kazurin#4036"` が4箇所に直書きされていた（`coach/page.tsx` のprop、
`SoloQDeepIntelSyncCard` の既定値と分解フォールバック、`ChampionQuickSelector` の
取得失敗時フォールバック）。他のソロQ系ルートはすべて `RIOT_GAME_NAME`/`RIOT_TAG_LINE`
を使うため、クライアントからは送らずサーバー側に解決させる形へ統一した。

- `ChampionQuickSelector` の分は特に、**別の管理者がログインしていても黙って
  Kazurin のIDを使う**状態だった。`/api/riot/live-game` は riotId 省略時に
  「環境変数 → `ktm_players` 照合」で解決するため、分からない時は空のまま委ねる。

## ✅ 4. 計算しているのに誰も見ていなかった判定を配線

`playRecommendation`（ティルト・連敗ストッパー・時間帯勝率の統合判定）は
`/api/coach/analyze` が算出してレスポンスに含めていたが、**どのUIからも参照されていなかった**。

- `diagnoseTilt` と連敗相関の計算を `lib/playRecommendation.ts` へ切り出し、
  `analyze` 側もそれを使うようにした（同じ判定が2箇所で分岐しないように）。
- 表示用の軽量API `/api/coach/play-recommendation` を新設。**LLMを呼ばない**。
  Geminiの日次クォータは実際に枯渇するため（同日に辞典一括更新が丸1日止まっていた）、
  画面表示のたびに消費しない設計にした。直近の試合は `soloq_match_history`
  （毎日05:40 JSTに自動同期）から読むので Riot APIの試合詳細取得も不要。
- `PlayRecommendationCard` を試合前タブの先頭に配置。根拠データが14日以上古い場合は明示する。

## ✅ 2. デッドコード713行を削除（ユーザー判断: 全削除）

| 削除 | 行数 | 根拠 |
|---|---|---|
| `coach/MatchupWarningCard.tsx` | 543 | 参照元0件。機能は `MatchupBlueprintCard` に統合済み（`7a96b2dc`「二重警告統合」） |
| `api/soloq/check-finished/route.ts` | 79 | 参照元0件。試合終了の自動ポップアップ用だったが、9/17のスリム化でUI側が消えた |
| `api/soloq/latest/route.ts` | 91 | 参照元0件。役割は `/api/soloq/recent-matches` が担っている |

- ⚠️ **意図的に失った機能が1つある**: `MatchupWarningCard` にしか無かった
  「🛡️ 他レーン崩壊等のノイズ検知: N戦」の表示。**これはバグではなく削除の結果**なので、
  将来「消えている」と気づいても回帰として扱わないこと。
  `/api/soloq/matchup-warning` は今も `noiseMatchCount` を返しており（既に取得済みの
  行に対するメモリ内フィルタなのでコストは無視できる）、`MatchupBlueprintCard` に
  3行足せば復活できる。
- 削除で `EarlyJunglePathingCard` が孤立していないことを確認済み（`MatchupBlueprintCard`
  から参照が残っている）。

## 📌 残タスク

- [ ] `/api/riot/live-game` のオーナー解決が `KAZURIN_PUUID` 環境変数と
  `ktm_players` の `name = 'かずき'` 固定照合になっている。コーチページ側の決め打ちは
  解消したが、サーバー側にはまだ単一ユーザー前提が残っている（影響範囲が広いため未着手）。
- [ ] 実画面での確認（ライブ検知バッジが実際の検知時だけ出るか、
  「次の試合に行くべきか」の判定が妥当か）。

## 🧹 コーチページの整理 第2弾（同日・A〜E）

第1弾（上記）の後、ユーザー要望で配置と諸々を追加調査して対応した。

### ✅ A. 自動振り返りの通知リンクが存在しないタブを指していた（最も実害）

15分おきのcronが試合ごとに出す通知が `/coach?tab=matchup-memo&champion=..&role=..&result=..&kda=..&matchId=..`
を指していたが、(1) そのタブは2026-09-17のスリム化で削除済み、(2) コーチページは `tab` を
読んでいなかった。結果、通知を押すと**常に「試合前」に着地**し、対面メモを書くという本来の目的を
果たせないまま `role`/`result`/`kda`/`matchId` が捨てられていた（**直近30日で14件**）。

→ `page.tsx` が `?tab=` と `?matchId=` を読むようにし、旧 `matchup-memo` はメモ編集の現住所である
「試合後」タブへ読み替え。cron側のリンクも `?tab=postgame&matchId=..` に変更した。

### ✅ B. `/api/coach/analyze` の13モードのうち9つがUIから到達不能だった

UIが送るのは `counter_pick` / `post` / `post_lookup` / `chat` の4つだけ。Bot・Pythonからの
呼び出しも無いことを確認した。

| 対応 | モード |
|---|---|
| **削除**（計402行。route.ts 1200行→811行） | `practice_menu` / `tilt` / `matchup` / `post_latest` / `objective_priority` / `win_condition` |
| **画面へ配線** | `history`（LLM不使用） / `trends`（Gemini 1回・ボタン実行） / `goal`（LLM不使用） |

- `history` の配線で、**cronが貯めていた自動振り返り86件が初めて画面から読めるようになった**
  （それまでは通知本文＝500字で切り詰められたもの以外に読む手段が無かった）。
- `goal` の配線により、開くたびに当日のLPスナップショットが記録される。
  `soloq_lp_history` が4件・2026-08-04で止まっていた状態も使うほど解消していく。
- `tilt` 削除により、同日修正した「Geminiへ時間帯勝率を数値で示せと指示しつつ数値を渡していない」
  捏造経路は**分岐ごと消えてリスクが無くなった**。後継は `/api/coach/play-recommendation`。

### ✅ C. 自動と手動の振り返りの役割整理（削除は保留）

手動記録（`soloq_reflections`）は18件・最終記録 2026-08-25 で**直近30日は0件**、一方で自動
（`coach_analyses`）は直近30日に14件。自動側を画面に出すと役割が重なるため、手動側の見出しを
「📝 自分の言葉で振り返りを残す」に変え、自動側への参照を添えた。

- [ ] **判断保留**: 手動の振り返りフォーム（`SoloQReflectionModal.tsx`・997行でページ最大）を
  畳むかどうか。「自分の言葉で残す」価値は自動生成では代替できないため、しばらく使ってから判断する。

### ✅ D. 目標ランクの決め打ちを解消

`targetTier: 'Emerald IV'` がルートの既定値とクライアントの両方に直書きされており、昇格しても
目標が動かないままAIの指示文に入り続けていた（最終記録ランクは GOLD III 63LP / 2026-08-04）。
既存の汎用設定テーブル `ktm_settings` に保存する `lib/coachSettings.ts` と
`/api/coach/target-tier` を新設し、`RankGoalCard` から変更できるようにした。`deep-intel` も保存値を読む。

### ✅ E. 自分が入れた不備と、ページ固有のフォント上書き

- ヒートマップの24列グリッドが375px幅で**1セル約13px**になり指でタップできなかった。
  `ui-conventions.md` の「スマホで見切れないよう横スクロールを必ず設定」に従い
  `overflow-x-auto` ＋ 最小幅にした（復活させた時の見落とし）。
- `page.tsx` の `<style>` 内にあった Google Fonts の `@import` と `* { font-family: 'Inter' }` を削除。
  描画をブロックする書き方で、しかも**ポータル全体ではこのページだけがInterを取得**し、
  デザイントークンを無視して別フォントになっていた。外してポータル全体と同じフォントに揃えた。

### 📌 引き継ぎメモ

- `03_SYSTEMS/ktm_bot/src/utils/recruitmentStatus.js`（募集文の「ランク」→「MMR」表記変更）は
  このセッションの作業ではないため触っていない。**ユーザーが `652a456c` として同日22:17に
  コミット・プッシュ済み**で、作業ツリーはクリーン。
  （※私は引き継ぎ記録時に「未コミットの変更がある」と書いたが、これは作業途中に見た状態を
  再確認せずそのまま報告した誤りだった。ユーザーの指摘を受けて訂正した。）
- 実画面での確認が残っている: 「🤖 自動振り返りの履歴」に86件が読みやすく並ぶか、
  「🚦 次の試合に行くべきか」の判定しきい値（連敗2でクールダウン15分、時間帯勝率40%未満で赤）が
  体感と合うか、色統一後のライト/ダーク両方の見た目。

## ✅ チーム分け満足度・予測検証が2か月以上黙って失敗していた問題（2026-09-30）

「チーム分け満足度は正しく反映されているか」の調査。**反映されていなかった。**

### 実データ（調査時点）

| 項目 | 実測 |
|---|---|
| `balancer_predictions` | 45件（2026-07-18〜09-26） |
| 満足度に値がある行 | **4件のみ**・最終更新 **2026-07-19**（すべて旧方式の残骸） |
| `actual_winner` / `correct` | **45件すべて NULL** |
| `match_id` | **45件すべて NULL** |

満足度は当初「Discordの👍/👎をポーリング集計」する設計だったが「集まりが悪く手間もかかった」ため
**管理者が成績入力時に good/normal/bad を選ぶ方式へ変更**されており、新方式では一件も保存されていなかった。
UI・送信・API受け取りはすべて正常で、壊れていたのは保存先だった。

### 根本原因: マイグレーションの型ミス

- `11_balancer_predictions.sql` は `match_id UUID` と**正しく**定義していた
- `24_add_participant_mmr.sql` が「**ktm_matches.id との紐付けを確実にするため**」というコメント付きで
  `DROP COLUMN match_id; ADD COLUMN match_id bigint;` を実行し、**uuid を bigint に変えた**
- `ktm_matches.id` は uuid なので、以降 `match_id` への書き込みはすべて型エラーで失敗
- **紐付けを確実にする目的の変更が、紐付けを壊していた**

2か月以上気づかれなかったのは、supabase-js が返す `error` を見ておらず `try/catch` も
`console.warn` だけだったため。画面上は何も壊れて見えない。

**実害（すべて黙って失敗）**: ①満足度が保存されない ②予測検証が記録されない
③結果メッセージIDの紐付けも保存されない ④`/api/match/history` の `.in('match_id', <uuid[]>)` が
成立せず履歴に的中が出ない。※ベット精算は `balancer_predictions.id` を使うため影響なし。

### 対応（コミット `aed71193` ＋ 本番適用済み）

- **migration 84 を本番適用済み**: `match_id` を uuid へ戻した（全行NULLのため変換不要）。
  あわせて 24 の `DROP COLUMN` で列ごと消えたまま再作成されていなかった部分インデックス
  `idx_balancer_predictions_unmatched` を復旧し、`idx_balancer_predictions_match` を追加。
  適用後の確認: 型 uuid / インデックス4本 / 45行保持。
- **`match/record` の3箇所で戻り値の `error` を必ず確認**するようにした。満足度は
  「対象行が無い(0件更新)」も検知する（ロスター照合に失敗した試合では保存先が無いため）。
- **遡り復旧を実施**: ロスター名の集合一致（青赤入替も考慮）＋「予測は試合より前」の条件で
  1対1に絞り、**10試合ぶんの `match_id` / `actual_winner` / `correct` を復元**した
  （予測は試合の1〜8分前で妥当）。満足度は当時の管理者の選択がどこにも残っていないため復元不可。

### ⚠️ 復旧の副作用: 予測的中率アラートが近いうちに発火する

`reviewBalancerPredictionAccuracy` は「検証済み15件以上」かつ「的中率55%未満」で通知する。
復旧後は **検証済み13件・的中率53.8%（7/13）** なので、あと2試合記録されると発火する。

- [ ] **要検討: このアラートの前提が妥当か**。バランサーは「50/50の拮抗した試合を作る」ことが目的なので、
  **チーム分けが成功していれば的中率は50%付近に収束するのが自然**で、低いこと自体は失敗ではない。
  実際の予測勝率は 0.352〜0.642 でほぼ0.5付近に寄っている。
  的中率（hit rate）ではなく**キャリブレーション（Brierスコア等）**で見るか、
  「0.5から十分離れた予測だけを対象に的中率を見る」方が指標として適切。
  現状のままだと「バランスが取れているのに警告が出続ける」状態になりうる。

## 🎨 ダークモード実装のトークン移行（2026-09-30 開始・段階実施）

### なぜ移行するのか

ダークモード対応が **globals.css の「クラス名を列挙して後追いで !important 上書きする中和レイヤー」** に
依存しており、911行中 **595行** がこのレイヤーだった。列挙から漏れたものは全部すり抜けるため、
同じ型の不具合が繰り返し発生していた（1日で3回報告された）。

| 漏れていたもの | 実害 |
|---|---|
| グラデーション停止色（`from-`/`to-`） | 薄い背景＋白文字で読めない（/leaderboard のロール見出し） |
| 任意値HEX（`bg-[#eae4d4]`） | ページ全体が明るいまま白文字（カジノ・ログイン・管理画面など11箇所） |
| アクセント色の200番台 | 淡い背景＋明るい文字（カジノのGOLDバッジ、79箇所） |
| 過剰一致（`[class*="bg-amber-50"]`） | `bg-amber-500` も巻き込み **379箇所が灰色に潰れる** |

**トークン自体は既にテーマ切替に対応している**（`@theme` と `html.dark` で値を差し替え済み）。
問題は部品がトークンを使わず生の色クラスを書いていること。部品をトークンへ寄せれば
中和レイヤーは不要になり、「一覧から漏れる」という事故が構造的に起きなくなる。

### 移行の規模（主要クラスのみ）

| クラス | 箇所 | 移行先 |
|---|---|---|
| `text-stone-900/800/700` | 1,472 | `text-foreground` |
| `text-stone-600/500/400` | 1,517 | `text-muted` 系 |
| `border-stone-200/300` | 871 | `border-border` |
| `bg-white` | 690 | `bg-surface` |
| `bg-stone-50/100/200` | 734 | `bg-background` / `bg-surface-hover` |
| 合計 | **約5,284** | |

### ✅ Phase 0: トークンのライト値を暖色へ揃えた（完了）

トークンのライト値が寒色slate（`#f8fafc` / `#0f172a` / `#e2e8f0` / `#64748b`）で、
部品が使う暖色stoneとも `ui-conventions.md` の規定とも食い違っていた。
部品側の実値に合わせて暖色へ修正（`#fafaf9` / `#1c1917` / `#e7e5e4` / `#78716c`）。
これで以降の置換がライトモードでも見た目を変えない。

### ✅ Phase 1: 枠線を移行（完了）

- `border-stone-200/300` の **870箇所 / 86ファイル** を `border-border` へ置換
  （`dark:` 付きの明示指定は意図的な上書きとして除外。残り1件は
  `PlayerSettingsPanel` の反転ボタンで、これは背景側が中和レイヤーに潰されていて
  元々ちぐはぐなため別途）
- 対応する中和ルール（`html.dark .border-stone-200 ...`）を **globals.css から削除**
- 検証: tsc エラー0 / テスト83件全成功 / build 成功

### ✅ Phase 2: 白背景を移行（完了）

- `bg-white` の **688箇所 / 97ファイル** を `bg-surface` へ置換
- 対応する中和ルールを削除。旧ルールは `color` も一緒に指定していたが、
  `html.dark body { color:#f2f3f5 }` が継承させるため文字色は変わらない
- `dark:bg-white` の2件は意図的な反転指定として除外

### ✅ Phase 3: stone系の淡色背景を移行（完了）

ライトモードの見た目を1pxも変えないため、`stone-100` 相当のトークン
`--color-surface-subtle`（ライト #f5f5f4 / ダーク #1e1f22）を新設してから置換した。

| 移行前 | 移行後 | 箇所 | ライト値 | ダーク値 |
|---|---|---|---|---|
| `bg-stone-50` | `bg-background` | 289 | #fafaf9（同値） | #1e1f22（旧中和と同値） |
| `bg-stone-100` | `bg-surface-subtle` | 288 | #f5f5f4（同値） | #1e1f22（同上） |
| `bg-stone-150` | `bg-surface-subtle` | 1 | 同上 | 同上 |
| `bg-stone-200` | `bg-surface-hover` | 158 | #e7e5e4（同値） | #35373c（旧中和と同値） |

**ライト値は移行前と完全一致、ダーク値も旧中和ルールと同じ**にしてあるため見た目は変わらない。
対応する中和ルールを削除（`dark:bg-stone-100` の1件は意図的な反転指定として残置）。

### 📌 残りのPhase（未着手）
### ✅ Phase 4a: 本文の文字色を移行（完了）

当初は `text-stone-900/800/700` をまとめて `text-foreground` に寄せる案だったが、実値を
確認すると **800(#292524)/700(#44403c) を foreground(#1c1917) に寄せるとライトモードで
濃くなってしまう**（ダークは旧中和ルールが3段階とも1色に寄せていたので変化なし）。
ライト値を保つため階調トークンを2つ新設してから置換した。

| 移行前 | 移行後 | 箇所 | ライト値 | ダーク値 |
|---|---|---|---|---|
| `text-stone-900` | `text-foreground` | 807 | #1c1917（同値） | #f2f3f5 |
| `text-stone-800` | `text-foreground-soft` | 267 | #292524（同値） | #f2f3f5 |
| `text-stone-700` | `text-foreground-subtle` | 399 | #44403c（同値） | #f2f3f5 |

ダークは3段階とも #f2f3f5 で、旧中和ルールの挙動（すべて #f8fafc へ寄せる）を踏襲している
（差は2%程度で知覚できない）。中和ルールからは stone の3行だけを外し、
未移行の gray/slate/zinc は残した。

### ✅ Phase 4b: 補足の文字色を移行（完了・棚卸し結果つき）

**棚卸しで分かったこと（機械置換してはいけなかった理由）**

1. **番号と実際の色がねじれていた**。`globals.css` はライトモード側にも上書きを持っており、
   クラス名から描画結果を予測できない状態だった。

   | クラス | ライト実効値 | ダーク実効値 | 問題 |
   |---|---|---|---|
   | `text-stone-600` | #57534e | #e2e8f0 | 上書きなし |
   | `text-stone-500` | #44403c | #e2e8f0 | 番号より**濃い**（700相当） |
   | `text-stone-400` | #57534e | #cbd5e1 | **600と同色**なのにダークでは別扱い |
   | `text-stone-300` | #78716c | #cbd5e1 | 番号より濃い（500相当） |

   4クラス → ライト3色 → ダーク2色、しかも対応がねじれている。

2. **用途に役割の分かれ目が無かった**。4段階すべて「補足の小さい文字」が主用途で
   （キャプション小・極小で6〜9割）、プレースホルダや無効状態は2%未満。
   番号が役割を表していなかった。

3. **`dark:` 指定156箇所が中和の `!important` に潰されて無効だった**。
   中和を外すと突然効き始めて色が変わるため、あわせて削除が必要だった。
   （うち18箇所は Phase 4a で中和を外した時点で既に効き始めており、私が入れてしまった
   変化だった。ここで解消した。）

**採った方針（案A: 今の見た目を保つ）**

| 移行前 | 移行後 | 箇所 | ライト | ダーク |
|---|---|---|---|---|
| `text-stone-500` | `text-muted-strong` | 636 | #44403c（同値） | #e2e8f0（同値） |
| `text-stone-600` | `text-muted` | 355 | #57534e（同値） | #e2e8f0（同値） |
| `text-stone-400` | `text-faint` | 426 | #57534e（同値） | #cbd5e1（同値） |
| `text-stone-300` | `text-faint` | 28 | #78716c → #57534e（**変化**） | #cbd5e1（同値） |

- 見た目が変わるのは **28箇所のみ**（1,445中の2%）
- あわせて無効化されていた `dark:text-stone-*` **156箇所を削除**
- ライト側・ダーク側の中和ルールを両方撤去
- Phase 4a で `.text-stone-900` を全移行したことで**死んだセレクタ58行**も撤去

⚠️ **`text-muted` と `text-faint` のライト値が同じ（#57534e）というねじれは、
意図的に引き継いでいる**。解消は移行完了後に「意図的なデザイン変更」として別途行う
（移行中に見た目を動かすと、問題が出たときの切り分けができなくなるため）。
### ✅ Phase 5: アクセント色を役割トークンへ移行（完了）

**5a. 端数の色を主力4色へ統合（584箇所）**

色差を実測し、目視で判別できないものだけ統合した（`orange-200→amber-200` の色差35.4のみ
目視可能だが1箇所のみ）。red→rose 297 / orange→amber 117 / green→emerald 60 /
yellow→amber 55 / pink→rose 55。これで寒色の直書きは**0件**になった。

**5b. 役割トークンを44個新設**

`ui-conventions.md` の役割名に合わせた。ライト値は移行前のTailwind実値、
ダーク値は旧中和レイヤーが出していた実効値をそのまま踏襲している。

| 役割 | 色 | 用途 |
|---|---|---|
| `primary` | amber | Hextechゴールド |
| `success` | emerald | 成功 |
| `danger` | rose | 警告・エラー |
| `secondary` | teal | ヘクステックブルー |

淡色(50/100/200)はダークでは色相を問わず `#35373c` に潰れるのが従来挙動なので、それを踏襲。

**5c. 移行: 5,861箇所**（4,441 + 1,420）

**⚠️ 途中で自分が入れた退行と、その修正**

境界線644箇所に背景用トークン（ダークで `#35373c` に潰れる）を当ててしまい、
**従来は色相を保っていた境界線が灰色に変わる**状態を作った。
境界線だけ元のパレットへ戻した（748箇所）。
→ **境界線のトークン化は背景とは要件が違う**（ダークでも色相を保つ必要がある）。
   別途デザイン方針を決めてから行う。

### ✅ gray/slate/zinc を中立トークンへ（完了）

stone と同じ役割なので Phase 1-4 のトークンへ寄せた（405箇所）。旧中和でも
stone と同じ扱いだったのでダーク値も揃う。

### ✅ 死んだ中和ルールの一括撤去（完了）

部品側に該当クラスが存在しないルールを機械的に特定して30件撤去。
**globals.css: 911行 → 752行 / `html.dark` を含む行: 595行 → 332行**

### 📌 残り

### ✅ 境界線のトークン化（完了・2026-10-01）

**単純なトークン化はしなかった**。1,531箇所のうち中和ルールが効いていたのは4組（421箇所）だけで、
残り1,110箇所はダークでも生の値だった。段階ごとにトークンを作ると大半が
「ライト＝ダーク」の無意味なトークンになるため、**濃淡3段階に集約**した。

| レベル | 元の段階 | 箇所 | ライト（amberの例） | ダーク |
|---|---|---|---|---|
| `-edge-soft` | 100/200 | 644 | #fde68a | `rgba(色, 0.25)` |
| `-edge` | 300/400 | 458 | #fcd34d | `rgba(色, 0.4)` |
| `-edge-strong` | 500以上 | 439 | #f59e0b | `rgba(色, 0.55)` |

- ダークは**色相を保った半透明**にした。既存の `border-amber-300/400` ＝ `rgba(…,0.4)` を
  基準に soft / strong を前後へ振っている。`ui-conventions.md` の
  「ダークの枠線は落ち着いた色（`border-emerald-800/60` 等）」にも沿う。
- ⚠️ **見た目が変わる**: これまでダークで生の明るい値だった1,110箇所が半透明になる。
  また各レベル内で段階が集約されるため、少数派の段階（amber-100/400/600-900 等）は
  ライトでも色が寄る。**移行中で唯一の意図的な見た目変更**。
- 対応する中和ルール2件を撤去（これで `html.dark` のクラス列挙はほぼ消えた）
- [ ] **Phase 6: 任意値HEX**（`bg-[#...]` 165箇所）。今は `dark:` 変種で応急処置済み
- [ ] 残った `html.dark` 332行の内訳精査（入力フォーム・スクロールバー・glass-panel 等、
  クラス列挙ではない正当なルールも多く含まれる）
- [ ] **各Phase完了ごとに** globals.css の該当中和ルールを削除し、595行を削っていく

**進め方の原則**: 1Phaseごとに「置換 → tsc → テスト → build → 中和ルール削除 → コミット」。
一度に全部やるとライト/ダーク両方の見た目が同時に動いて切り分け不能になるため、必ず分ける。

## 🌓 ダークモードの既定を light へ変更（2026-09-30）

### 経緯: 「ダークモード不要説」の検討

「手間とメリットが見合っていないのでは」という指摘を受けて実測した。

**今日ダークモードが生んだコスト（実績）**

| 内容 | 規模 |
|---|---|
| 「見にくい」報告 | 3回 |
| 鮮やかな背景が灰色に潰れる | 379箇所 |
| ページ全体が明るいまま白文字 | 11箇所 |
| バッジが読めない | 79箇所 |
| 移行作業 | 5,212箇所の置換 |

**残コストの比較**

| 選択肢 | 触る量 |
|---|---|
| 移行を完遂 | アクセント淡色1,083 ＋ アクセント文字1,882 ＋ HEX 165 = **3,130箇所** |
| ダークモードを撤去 | `html.dark` 519行 ＋ 部品の `dark:` 725箇所 ＋ Theme関連189行 |

**撤去も安くない**うえ、「機能を失うために同規模の作業をする」ことになる。

### 判断に効いた事実

1. **既定値が `system`** で、端末をダークにしている人には**自分で選んでいなくても適用**されていた。
   63人のコミュニティ、夜にスマホから見る性質を考えると無視できない割合が該当する。
2. **バグの原因はダークモードそのものではなく中和レイヤー**（クラス名を列挙して後追いで
   `!important` 上書きする方式）だった。列挙漏れが全部バグになる構造。
3. その中和レイヤーは**すでに2/3ほど解体済み**。トークン方式では列挙漏れという概念が無くなる。

### ✅ 実施: 既定を `system` → `light`（撤去も完遂も保留）

1行相当の変更でリスクの大半を消し、撤去か完遂かの判断を後回しにできる折衷案。

- `ThemeContext.tsx` の初期値を `'light'` に変更
- `layout.tsx` のFOUC防止スクリプトも `savedTheme === 'system' && prefersDark` に変更
  （**両者は必ず揃えること**。片方だけ変えると初期描画とハイドレーション後で色が切り替わってちらつく）
- **既に `dark` / `system` を選択済みの人の設定は尊重される**（localStorageから復元）。
  変わるのは「一度も選んでいない人」の初期値だけ

### 📌 次の判断材料

- [ ] しばらく運用して、**実際にダークを選ぶ人がいるか**を見る。
  現状テーマ設定はlocalStorageのみでサーバーに残らないため観測できない。
  判断材料が欲しい場合は、テーマ選択をサーバーへ記録する仕組みが要る（軽微）。
- [ ] 誰も選ばないと分かれば **撤去**（`dark:` 725箇所＋519行の削除）、
  使う人がいるなら **移行を完遂**（残3,130箇所）。どちらも今すぐやる必要はない。
