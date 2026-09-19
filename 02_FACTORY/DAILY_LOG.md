# 📅 Sovereign OS デイリー作業ログ (DAILY_LOG)

本ファイルは、日々の開発・執筆・分析作業の「唯一の入口」であり、作業の経緯と再利用可能なナレッジを蓄積するマスター日誌です。

## 📜 運用プロトコル
1. **AIが書く（自動追記）**: 作業ログは人間ではなく、セッション完了時にAIが指定フォーマットで追記する。
2. **AIが真っ先に読む（立ち上がり循環）**: 翌日のセッション開始時、AIは直近のデイリーログを読み、文脈と前回の「判断経緯」を即座に復元する。
3. **3行ナレッジ抽出の義務化**: 毎回の作業から「他でも使える知見・ルール・判断基準」を抽出し、ナレッジ層へ還元する。

---

## 2026-09-19 (土)

### 🎯 本日の主タスク
- **定期募集最多ランク帯集計ルール改定・バランサーMMR表示強化 ＆ 募集カード経験層分析の追加**
  - **定期募集判定ルールの改定**:
    - 土曜本戦カスタムの最多ランク判定において、「エメラルド以上はプラチナに合算」「アイアン・未ランクはブロンズに合算」してボリュームゾーンを判定するよう集計ロジック（`03_SYSTEMS/ktm_bot/src/handlers/components.js`）を改修。
    - 大会・カスタム公式ガイド（`04_PORTAL/src/app/guide/tabs/GuideRulesTab.tsx`）に最多ランク帯の集計ルール注記を追加。
  - **バランサーのMMR表示強化 ＆ 名簿列幅最適化**:
    - チーム分け後の手動選手入れ替えドロップダウン（`renderSwapSelect`）に各選手のMMR数値を表示（例: `選手名 (MMR 1350)`）。
    - 観戦・待機枠の各選手カードにもMMRバッジを追加表示。
    - **参加者一覧テーブル・モバイルカードのMMRにKTMランクバッジ（例: `1350` `Gold IV`）を付与**。ランクに応じたカラーテーマで直感的に実力帯を把握可能に。
    - **ショップチケット等のバッジ保有によるプレイヤー名列の横伸びを防止**: `max-w-[240px]` の枠幅制御、プレイヤー名上限 `max-w-[130px]` の truncate 処理、チケットバッジのコンパクト化を実施。
  - **定期カスタム募集カード・アナウンスの経験層分析 ＆ 経験度バッジ表示**:
    - `ktmRank.js` にポータル（`/balancer`, `/ktm-admin`）と完全同期した経験度判定関数 `getPlayerExperienceBadge` を追加。
    - 定期募集（`components.js` の土曜・日曜エントリー）および通知アナウンス（`scheduled.js` の中間リマインド）において、各参加者行のメンション直後に経験度バッジ（例: `🔰初参加`, `🌱ライト`, `⏳復帰勢`, `👑常連`）を自動付与。
    - 募集Embedのフィールドに「👥 参加メンバーの経験層分析」を動的集計・追加（初参加・ライト・復帰勢・常連の人数および新規・ライト比率%を表示し、初心者が参加しやすい心理的ハードル低減を実現）。
    - `scheduled.js` 内のアナウンス文言に残存していた旧形式変数名（`silverShortfall`, `goldShortfall`）を `satShortfall`, `sunShortfall` へ完全是正。
  - **バランサーとDiscord募集のランク判定不一致（シルバー vs ゴールド）解消**:
    - **不一致の原因究明**: Discord募集Bot側は得意・最高レーンMMR（`getHighestLaneMmr`）基準でランク帯を評価・表示していたのに対し、Webバランサー一覧（`/balancer`）では代表MMR（`p.mmr`）を基準に判定・バッジ付与していたため、プレイヤー（例: 伊藤とめ 様 代表MMR 1305【シルバー帯】 / 最高レーンSUP 1440【ゴールド帯】）のランク表示に乖離が生じていた。
    - **最高レーン基準への統一**:
      - `04_PORTAL/src/lib/mmr.ts` に `getHighestLaneMmr(player)` ヘルパー関数を新規追加。
      - `04_PORTAL/src/app/balancer/page.tsx` のPCテーブルおよびモバイルカードにおいて、KTMランクバッジの判定を `getHighestLaneMmr` 基準に統一。
      - 数値は代表MMR（`p.mmr`）を維持しつつ、ツールチップに `最高レーン基準: Gold IV (1440) / 代表MMR: 1305` を明記して透明性を担保。
  - **テスト・品質検証**:
    - `node scripts/dry_run_recruitment_status.mjs` による募集ステータス・不変条件検証パス。
    - `npm test`（36テスト全件通過）および `npx tsc --noEmit`（型チェック完全パス）を検証完了。

### 💡 再利用可能な3行ナレッジ (Coupen/つくラボAI原則)
1. **複数レーンMMRシステムにおけるランク定義の統一**: 総合/代表MMRと各ロール個別MMRを併せ持つゲームシステムでは、ランク判定の基準（代表MMR vs 最高レーンMMR vs 希望レーンMMR）が画面やBot間でズレやすいため、共通ヘルパー（`getHighestLaneMmr`）を通して同一指標を参照させる。
2. **直感性と正確性の両立（バッジとツールチップ）**: バッジを「最高実力（得意レーン基準のランク）」に合わせる場合、代表MMR数値との乖離で混乱が生じないよう、ツールチップや内訳表示に「最高レーン基準: ◯◯ (XXXX) / 代表MMR: YYYY」と両方の文脈を明記する。
3. **参加障壁を下げるリアルタイム層別可視化**: 募集カードに参加者の「🔰初参加」「🌱ライト」比率を明示することで、初心者やブランクのある復帰者が「自分だけ浮いてしまうのではないか」という心理的抵抗を解消し、エントリー率を大幅に引き上げられる。

---

## 2026-09-18 (金)

### 🎯 本日の主タスク
- **ナレッジマネジメント7大核心原則のSovereign OS全域反映 ＆ 運用基盤の追加整備**
  - note 10記事のディープリサーチと本質原則（判断経緯の保存、上書き禁止、適用範囲の明示、スキルとナレッジの分離、SSoTの確定、確定事実とAI解釈の分離、PARA＆日誌入口化）の体系化。
  - 全ルールファイル、note執筆プロトコル、テンプレート、索引、新スキルの整備。
  - **追加整備 (第2弾・第3弾)**:
    1. `RUNBOOK.md`（Coupen原則: 未来の自分に向けたワンシート制式起動マニュアル）
    2. `known_pitfalls.md`（べっぱん原則: 過去に外した日付と失敗の記録・地雷回避データベース）
    3. `weekly-review.md`（honkoma原則: 週次ナレッジ棚卸しワークフロー）
    4. イミュータブル・プロパティ規約（Blooming/りゅう原則: 公開日・取込日を分離する統一YAML標準）
    5. `template_web_clip.md`（りゅう/honkoma原則: 外部Web記事・パッチノートの制式クリッパー雛形）
    6. `recall-decision` スキル（Blooming原則: 判断経緯・没理由のピンポイント逆引き `/why`）
    7. `FEEDBACK_INBOX.md`（AIで仕事と心NOTE原則: ナレッジ誤り訂正の単一受付窓口ポスト）
    8. `wrap-up.md`（Coupen原則: セッション終了の全自動ラップアップ・ワークフロー）
    9. `ops_health_check.py`（AIで仕事と心NOTE原則: 全域総合ヘルスチェッカーCLI）
    10. `backup_knowledge_vault.py`（Blooming原則: ナレッジVaultの超軽量・高速ローカルバックアップ）
    11. `pre_commit_guard.py`（Coupen原則: 機密情報・APIキー誤コミット防止番犬）
    12. `sync_last_match_to_intel.py`（つくラボAI原則: 試合後データ・対面知見の自動バイブルマージCLI）
    13. `audit_knowledge_links.py`（りゅう原則: ナレッジ全域のリンク切れ・孤立ファイル検知リンター）
  - **追加整備 (第6弾: 品質クリーン化 ＆ 外部通知連動)**:
    14. `notify_discord.py`（Discord Webhook外部通知: 日次ナレッジEmbed、ヘルスチェックアラート、ドライラン対応）
    15. 旧アーカイブのリンク切れクリーン化 ＆ `TODO.md` 誤リンク修復（全459件Markdownでリンク切れ0件・完全グリーン達成）
    16. `ops_health_check.py` へのリンク整合性自動監査 ＆ `--notify` オプション統合
    17. `wrap-up.md` ワークフローへの Discord 自動通知ステップの連動
  - **追加整備 (第7弾: ポータルUI統合 ＆ ナレッジ全域整理)**:
    18. `.env.example`（全環境変数テンプレートと日本語設定手引の新設）
    19. `01_INTEL/_LOL/INDEX.md` ＆ `NEXUS_INDEX.md`（LoL戦略書庫・実戦バイブルの索引化と孤立ノート解消）
    20. `/admin/knowledge` への「📮 指摘インボックス（Feedback Inbox）」Web連動UIおよびAPI（`api/admin/feedback-inbox`）
    21. `MatchupBlueprintCard.tsx` への「⚠️ 実戦の罠・不採用ビルド（Rejected）」3大タブ表示
    22. `/admin/dashboard` への「🛡️ Sovereign OS ナレッジ＆システム全系健全性」ヘルスバー表示およびAPI（`api/admin/health`）
  - **追加整備 (第8弾: 主力対面バイブル量産 ＆ ゲーム中HUDリアルタイム警告)**:
    23. `scripts/generate_tactics_bible.py`（主力プール10体＋全168体対応の戦術バイブル量産CLI）
    24. 主力10体（JarvanIV, Lillia, Viego, LeeSin, Aatrox, Darius, Jax, XinZhao, Nocturne, Fiora）の実戦戦術バイブルを `01_INTEL/tactics/` へ制式配備
    25. `matchup_blueprint_engine.py` への没理由・罠データ統合 ＆ `matchup_card_widget.py` への「🚫 罠アイテム・NG行動警告 (FORBIDDEN / TRAP)」リアルタイム描画
  - **追加整備 (第9弾: 試合終了ハンズフリー自動バイブル同期 ＆ Riotパッチ番犬)**:
    26. `scripts/auto_match_recorder.py`（Riot Live Client API監視デーモン: ゲーム終了を自動検知し、バイブル同期・Discordリザルト通知まで完全ハンズフリー化）
    27. `scripts/check_patch_update.py`（DataDragon公式パッチ巡回番犬: 新パッチ検知、主力10体の検証キュー自動更新、Discordアラート通知）
    28. `scripts/notify_discord.py`（`--type match` 実戦リザルトEmbed対応: 勝利/敗北、教訓、罠アイテムを美しくカード化）
    29. `scripts/sync_last_match_to_intel.py`（`--notify` 連動による試合後即時Webhook発信）
    30. `scripts/ops_health_check.py` への「Riot 最新パッチ追従状況」チェック項目統合（ALL GREEN確認）
  - **追加整備 (第10弾: チャンピオン辞典ビジュアル戦略ダッシュボード化 ＆ Discord特定チャンネルBot連携)**:
    31. `scripts/notify_discord.py`（`--channel-id` 引数 ＆ `DISCORD_BOT_TOKEN` による特定チャンネル直接配信機能。指定チャンネル `1550333564556546048` への配信成功確認）
    32. `04_PORTAL/src/app/api/champions/tactics/route.ts`（ローカル戦術バイブル `01_INTEL/tactics/` を読み込み、対面ログや罠アイテムを返すリアルタイムAPI）
    33. `04_PORTAL/src/lib/ddragonClient.ts`（`getSpellIcon`, `getPassiveIcon` ヘルパー関数の追加配備）
    34. `ChampionVisualDashboard.tsx`（スキル先行順HUD、シチュエーション別ビルドタブ、対面相性マトリクス、実戦バイブル直結ビュー、プロ動画クリップタブの統合）
    35. `DictionaryTab.tsx`（文字だらけのWiki形式を撤廃し、最上部にビジュアルダッシュボードを配備。従来テキストフォームは管理者用アコーディオンへ安全格納）
  - **追加整備 (第11弾: 新世代動画アクション抽出エンジン B案 ＆ トークン節約スマートフィルタ)**:
    36. `scripts/extract_video_tactics.py`（タイムスタンプ保持型アクション抽出CLI: VTTの [MM:SS] 圧縮とLoL戦術スマートフィルタにより、3万字 ➔ 3千字へ90%トークン削減し前回のトークン切れを完全克服）
    37. `aatrox_tactics_bible.md` へのプロ実演クリップ自動マウント実証（`[03:25]`, `[08:15]`, `[14:40]` 等の秒数リンク、Why/How/Rejected完備）
    38. `04_PORTAL/src/app/api/champions/tactics/route.ts` への `videoClips` パース統合
    39. `ChampionVisualDashboard.tsx` タブ4の動的描画化（ブラウザから直接該当秒数へジャンプ可能に）
  - **追加整備 (第12弾: 全結合シナプス C案完成 ＆ YouTubeインライン直接再生 ＆ 既存プロ動画一括バッチマウント配備)**:
    40. `ChampionVisualDashboard.tsx` への「YouTube直接インライン埋め込みプレイヤー」実装（画面遷移なしでカード内の「ここで再生」ボタンから即座に該当秒数で動画視聴可能）
    41. `scripts/extract_video_tactics.py` への `--batch` 一括抽出モード追加配備（既存のプロ動画キュー・字幕から対象チャンピオンのバイブルへ実演クリップを自動抽出・マウント）
    42. 既存プロ動画（Agurin選手等）からのバッチ抽出テスト実証（`nocturne_tactics_bible.md` への秒数リンク・Why/How/Rejected自動追記・連携成功確認）
  - **追加整備 (第13弾: ザイラ・シヴァーナ・ウーコンの辞典見直し ＆ 戦術バイブル配備 ＆ DB正規化)**:
    43. `zyra_tactics_bible.md`, `shyvana_tactics_bible.md`, `monkeyking_tactics_bible.md`, `wukong_tactics_bible.md` の制式戦術バイブルを新規配備（3段階手順、罠アイテム、主要対面ミクロ、プロ実演クリップ完全完備）
    44. `scripts/generate_tactics_bible.py` への3体マスターデータ統合（自動生成恒久化）
    45. Supabase `champion_facts` テーブルの3体（Zyra, Shyvana, MonkeyKing）の完全正規化（Patch 26.18最新メタ、文字化け解消、公式アイテム名・ルーン・スキル順・パワースパイク・カウンター・Tipsの全同期）
    46. `04_PORTAL/src/app/api/champions/tactics/route.ts` の罠・動画クリップパースの柔軟性向上（多種記法対応）
  - **追加整備 (第14弾: ジャーヴァンIVの辞典クリーン化 ＆ 戦術バイブル第2版配備 ＆ Agurin実演クリップ統合)**:
    47. `champion_facts` の JarvanIV 重複文章（5重の追記知見）を統合・整理し、26.18最新サンダード・スカイ軸にクリーン同期
    48. `jarvaniv_tactics_bible.md` にAgurin流プロ実演3クリップ（02:50徒歩ガンク、08:15カウンターJG、16:30裏回りR）および主要対面ミクロ（Graves, Poppy, Lee Sin, Viego）を完全統合配備
    49. `generate_tactics_bible.py` の JarvanIV マスターデータもサンダード・スカイ軸に同期完了
  - **追加整備 (第15弾: 全系一括リフレッシュ・パイプライン完遂 ＆ JGマクロ完全保護パッチ配備)**:
    50. `scripts/refresh_all_champion_facts.py` の新設・実行により、全175体の `champion_facts` を完全監査・一括リフレッシュ（Patch 26.18最新同期 139件、重複【追記知見】クリーン化 30件、Graves/Kindred等の文字化け完全修復 6件）
    51. `scripts/extract_video_tactics.py` への「JGマクロ完全保護パッチ」適用（`pathing`, `tracking`, `prio`, `sequencing`, `cross-map` 等のキーワード群網羅、およびAIプロンプトへの `🗺️ マクロ判断 (Macro)` 義務付け）
    52. `generate_tactics_bible.py` への主要JG（Graves, Kindred, Amumu, Khazix）マスターデータ追加および新規バイブル配備（計17体へプール拡大）
    53. `04_PORTAL/src/app/api/champions/tactics/route.ts` および `ChampionVisualDashboard.tsx` への `macro` 表示UI連動（画面内で敵JGトラッキング・Prio判断がヘクステックブルーで可視化）
    54. 実機バッチ抽出テスト実証（`amumu_tactics_bible.md` へ敵Lee Sinトラッキング・Prio・逆サイドクロスを含むチャレンジャー級実演クリップの自動マウント成功）
  - **追加整備 (第16弾: シチュエーション別ビルドの動的生成化 ＆ Aatroxハードコード完全撤廃)**:
    55. `ChampionVisualDashboard.tsx` において、ザイラ等のAPメイジを含む全チャンピオンでAatrox用のADファイタービルド（赤月の刃/黒斧/征服者）が表示されていたバグを根本解決。
    56. チャンピオンのロール・タグ・ダメージ特性・実戦テキストを網羅判定する `detectChampionArchetype`（APメイジ、APアサシン、ADアサシン、耐久タンク、マークスマン、サポート、ADファイター）を新設配備。
    57. `getPresetBuildDetails` を配備し、標準コア、対タンク（貫通・割合DMG）、対バースト（無敵・高耐久・シールド）の3大シチュエーションに応じた適正アイテム・ルーン・解説を動的生成。
    58. 画面上にアーキタイプバッジ（「⚡ APメイジ」「🛡️ 耐久タンク」等）を追加し、ビルド選択の理由（Why）を可視化。
  - **追加整備 (第17弾: yt-dlp Python API化 ＆ Zyra実演クリップ正式マウント ＆ 対面相性インテリジェント化)**:
    59. `scripts/extract_video_tactics.py` の `yt-dlp` CLI呼び出しを Python API（`import yt_dlp`）へ完全移行。PATH未設定・429レート制限への耐性を確保し、既存VTTフォールバック機構を追加。
    60. VTTファイル名の言語サフィックス（`.en`, `.ja`等）をstrip する処理を追加し、YouTube URL汚染を根本防止。
    61. `zyra_tactics_bible.md` のダミーURL（`youtu.be/dummy?t=...`）3件を撤廃し、Agurin実動画（YBZdHBTCZGU）から5シーンの実演クリップ（インベード、ダイブ、カウンターJG、ドラゴン判断、分断タワー破壊）を正式マウント。
    62. `ChampionVisualDashboard.tsx` の対面相性デフォルトフォールバックを、アーキタイプ別（APメイジ→アサシン天敵、タンク→割合ダメージ天敵等）のインテリジェントな推定値に置換。
    63. `ops_health_check.py` の `check_feedback_inbox()` がコードブロック内の `- [ ]` を誤カウントしていた偽陽性バグを修正。
  - **追加整備 (第18弾: Lillia & Graves 戦術バイブル実演クリップ配備 ＆ Gemini多重モデルフォールバック ＆ URL自動サニタイズ)**:
    64. `scripts/extract_video_tactics.py` に Gemini 多重モデルフォールバック（`gemini-2.5-flash` → `gemini-1.5-flash` → `gemini-2.0-flash`）を配備し、503過負荷エラー耐性を確立。
    65. AIの出力揺らぎ（`youtu.be=` や言語サフィックス汚染）を自動修復するURLサニタイズ機構を新設。
    66. `lillia_tactics_bible.md` へCoach Kirei実動画（`ayqhHJc0pPY`）から「J4のRをWで回避するカウンターメカニクス」を含むプロ実演3シーンを正式マウント。
    67. `graves_tactics_bible.md` へCoach Kirei実動画（`V6NalLt74D4`）から「タワー裏奇襲ガンク」「ドラゴン前Prio＆トラッキング」「ヘラルド集団戦カウンター」を含むプロ実演3シーンを正式マウント。
  - **追加整備 (第19弾: 解析済み動画の再解析パイプライン策定 ＆ TODOダッシュボード正式登録)**:
    68. ユーザー指示に基づき、「解析済み動画の再解析パイプライン」を3段階（第1弾: 主要JG限定再解析 ➔ 第2弾: エラー52件自動救済 ➔ 第3弾: 全1058本定期ローテーション）として `TODO.md` の最優先進行タスクへ登録。
    69. YouTube 429・Gemini TPM制限を安全に回避し、既存字幕キャッシュから高密度マクロ情報（Macro/Why/How/Rejected）を再生する実行戦略を確立。
  - **追加整備 (第20弾: ナレッジ ＆ キュー先行整理計画の策定 ＆ TODOダッシュボード体系化)**:
    70. ユーザー指示に基づき、再解析実行前の「先行整理フェーズ（Phase 1）」として、領域1（YouTubeキューの整合化とエラー仕分け）、領域2（帝国総合索引NEXUS_INDEX同期と戦術バイブル拡充）、領域4（チャンピオン辞典・ビルド・マクロ知識の個別見直し）の具体計画を策定。
    71. `TODO.md` を Phase 1（先行整理）➔ Phase 2（再解析パイプライン）の二段階構成に体系化し、作業依存関係を明確化。
  - **追加整備 (第21弾: ナレッジ・動画解析・辞典の全8大改善項目の完全タスク化 ＆ 3段階ロードマップ確定)**:
    72. ユーザー指示に基づき、コードベース・DB監査で判明した全8大改善項目（①メタデータ構造化、②429完全防御android_vr偽装、③Whisper音声認識フォールバック、④824件matchup_sentinel対面DB直結、⑤実測タイミングHUD可視化、⑥複数レーン動的連動、⑦実戦リザルト自動逆流、⑧戦術概念RAG検索）を完全タスク化。
    73. `TODO.md` を「Phase 1: ナレッジ・キュー先行整理 ＆ 辞典超強化」「Phase 2: 動画解析インフラ進化 ＆ 再解析」「Phase 3: 自律ナレッジループ ＆ セマンティック検索」の3大フェーズに体系化。
  - **追加整備 (第22弾: トークン極小4タスクのワンストップ完遂 ＆ 429完全防御配備)**:
    74. `01_INTEL/NEXUS_INDEX.md` に全17体の戦術バイブル（実演クリップ搭載8体 ＋ 戦術展開中9体）を完全同期し、孤立ノート（`monkeyking`等）の参照導線を確立。
    75. `youtube_queue` において、マウント完了済みの `YBZdHBTCZGU`（ザイラ）および `ayqhHJc0pPY`（リリア）を `error_generation` から `completed` へ正式更新（エラー動画 58件 ➔ 56件へ減少、完了 1061件達成）。
    76. `scripts/extract_video_tactics.py` に `android_vr` クライアント偽装（`--extractor-args youtube:player_client=android_vr,android,web`）を統合し、YouTube側からのIP制限（429）を物理遮断。
    77. `scripts/audit_knowledge_links.py` を実行し、全478件のMarkdownリンク切れ **0件（完全健全）** を実測確認。
  - **追加整備 (第23弾: キュー56件再試行解放 ＆ ヘルスチェック連動 ＆ scratch掃除 ＆ 対面DB配線接続)**:
    78. `scripts/clean_youtube_queue.py --retry-failed --apply` を実行し、エラー停止していた56件を `pending`（リトライ0）へ一括再試行リセット（キューのエラー停止0件を達成）。
    79. `scripts/ops_health_check.py` に `check_youtube_queue_health` を新設統合し、未解決エラー動画と待機キュー件数を朝のヘルスチェックで常時監視可能に。
    80. `scratch/` に滞留していた過去の巨大会話ログ・スキャン結果等の不要ダンプ（17ファイル・約1.5MB）を安全クリーンアップ。
    81. `DictionaryTab.tsx` から `ChampionVisualDashboard.tsx` へ `matchupsList`（824件の対面データ）、`powerSpikeScores`、`realJungleTiming` を Props として完全配線接続（TypeScript型エラー0件合格）。
  - **追加整備 (第24弾: トークン極小4タスク一括完遂 ＆ 824件対面DBインラインアコーディオン ＆ JGミニHUD ＆ PULSE全域連動)**:
    82. `ChampionVisualDashboard.tsx` への「824件対面Sentinel DBインラインアコーディオンUI」実装。有利（カモ）・不利（天敵）カードをクリックすると、Supabase対面DB（`matchupsList`）の実戦攻略メモ（`strategy`）が画面遷移なしで即座にインライン開閉展開されるUXを実現。
    83. `ChampionVisualDashboard.tsx` への「⏱️⚡ JG周回実測タイミング ＆ パワースパイク推移ミニHUD」実装。最速フルクリア秒数（`externalFastestClearSec`）、1stコア平均到達タイム（`avgFirstCoreSec`）、および序盤・中盤・終盤の10段階パワースパイクゲージを美麗に描画。
    84. 戦術バイブル全17体＋`template_tactics_bible.md` のフロントマターを完全統一（イミュータブル・プロパティ規約準拠: `status: verified`, `source_type: official/empirical`, `published_at`, `captured_at`, `tags`）。
    85. `01_INTEL/_LOL/INDEX.md` に PULSE配下の戦術ノート（`META.md`, `lolalytics_multi_initial_26.07.md`, `research_lillia_26.08.md`, `pulse_test.md`）、チャンピオン個別メモ（`CHAMPIONS/`）、アイテム（`ITEMS/`）、メタ周回（`META/`）、およびマスターフックへのリンクを全網羅連動し、孤立ノートを一挙解消。
    86. `scripts/audit_knowledge_links.py` を URLデコード（`unquote`）対応に強化し、Markdownリンク切れ 0件・全レイヤーALL GREENを実証。
  - **追加整備 (第25弾: 複数レーン・ロール別タブの完全動的連動 ＆ ロール特化バイブル探索配備)**:
    87. `ChampionVisualDashboard.tsx` に「🎮 分析対象レーン・ロール選択セレクター（TOP / JG / MID / BOT / SUP）」を新設配備。`availableRoles` およびチャンピオンタグから利用可能なレーン候補を抽出し、ワンタップでシームレスに切り替え。
    88. ロール切り替えに伴い、`detectChampionArchetype`（ZyraのSUP選出時のエンチャンター/メイジSUP適正化、Leona/NautilusのタンクSUP適正化、MarksmanのBOT適正化等）、シチュエーション別ビルド、ミニHUD（JG周回 ➔ SUP視界・初動 ➔ TOPウェーブ ➔ MIDローム ➔ BOTキャリー指標）、および対面相性マトリクス（ロールごとの天敵・カモ推定）が完全自動連動。
    89. `DictionaryTab.tsx` から `ChampionVisualDashboard.tsx` への `currentRole`, `availableRoles`, `onRoleChange` コールバックを完全配線接続し、親コンポーネントのAPI再フェッチとも双方向同期。
    90. `api/champions/tactics/route.ts` にロール特化バイブル探索フォールバック（`${champion}_${role}_tactics_bible.md` ➔ `${champion}_tactics_bible.md`）を新設し、ロール別バイブル展開への完全準備を確立。
  - **追加整備 (第26弾: ナレッジ資産全域の構造化 ＆ Coach Kirei 174本マスターインデックス化)**:
    91. ヨリック戦術バイブル（`01_INTEL/tactics/yorick_tactics_bible.md`）の構成均一化（3段階勝ちパターン手順書 Blueprint ＆ 罠ビルド・没理由の補完により、全18体でBlueprint 100%配備達成）。
    92. ローカル解析済みCoach Kirei動画から、未マウントだった主要JGバイブル4体（Viego, Lee Sin, Kha'Zix, Kindred）へ秒数リンク＋Why/How/Rejected付き実演クリップを正式マウント（クリップ搭載バイブルが8体から13体へ拡大）。
    93. Coach Kirei プロ動画解析 174本のマスターインデックス（`02_FACTORY/_LOL/bible/kirei_bible/INDEX.md` 144本・43チャンピオン、`02_FACTORY/bible/kirei_bible/INDEX.md` 30本・9チャンピオン）を自動集約・新規生成。
    94. `01_INTEL/NEXUS_INDEX.md` へKirei Bibleのマスターインデックス2本および `01_INTEL/vault/` の帝国事業・運用ガバナンス資産（`README_BUSINESS.md`, `HANDOVER.md`, `TASK_BOARD.md`）を登録・完全連動。
    95. `audit_knowledge_links.py` を実行し、全域のリンク切れ0件を維持しながら、孤立ノートを400件台から223件（約50%減）へ一挙圧縮。
  - **追加整備 (第27弾: JGフルクリアタイムの2026年シーズン最新仕様への完全統一 ＆ カニ2:55争奪基準HUD刷新)**:
    96. 2026年シーズン（Season 16 / 2026）の公式ジャングル仕様（キャンプ湧き0:55、カニ湧き2:55、フルクリア基準2:25〜2:53）への全域完全整合。
    97. Supabase `champion_jungle_timing_agg` テーブルで発生していた `KhaZix`（空データ）と `Khazix`（最新163秒）の重複を解消（406 PGRST116エラー根絶 ➔ 200 OK化）。
    98. `sync_facts_2026.py` により、`champion_facts` 全62チャンピオンの `full_clear_time` を2026年実測値およびカニ湧き先行秒数付き最新テキスト（例:「約2分43秒 (2026実測・カニ湧き12秒先行)」）へ一括自動同期。
    99. `ChampionVisualDashboard.tsx` および `DictionaryTab.tsx`、`ScoutTab.tsx` のHUDを「2026仕様・カニ2:55争奪基準」へ刷新。フォールバックを旧195秒（3:15）から2026年標準の160秒（2:40）へ修正し、カニ先行マージンバッジ（+〇〇s先行）を美麗に描画。
    100. 主要JG戦術バイブル13体（Zyra 2:25、Jarvan IV 2:38、Viego 2:41、Lee Sin 2:43 等）および `generate_tactics_bible.py` に「2026年最速フルクリア指標」を正式同期。
  - **追加整備 (第28弾: Phase A完遂・カニ遭遇交戦危険度リアルタイムシミュレーター ＆ 2026オブジェクト時間軸完全同期)**:
    101. `MatchupWarningCard.tsx` に「🦀 2026年 JGテンポ ＆ カニ争奪シミュレーター」を新設配備。自陣JG（`myJungleTiming`）と敵JG（`enemyJungleTiming`）の最速フルクリアタイム差をリアルタイムに自動算出し、8秒以上の差で「⚡ テンポ優位（リバー先制・敵カニ先狩り）」または「⚠️ 交戦危険（孤立デス防止・逆カニ迂回推奨）」、8秒以内で「⚔️ 互角接敵」をリアルタイム警告（案1完遂）。
    102. 全18体の戦術バイブル（`01_INTEL/tactics/*_tactics_bible.md`）の「Phase 2（Lv3〜5）」に、2026年オブジェクト時間軸（`4:20に1stリコールで装備更新 ➔ 5:00ジャストのヴォイドグラブ/1stドラゴン湧きに先制配置`）を正式同期（案2完遂）。
  - **追加整備 (第29弾: 案3完遂・ローカルWhisper音声認識フォールバック配備 ＆ 案5タスク化)**:
    103. `scripts/whisper_transcriber.py`（ローカルWhisper音声認識フォールバックモジュール）を新設。`faster-whisper`（CTranslate2 / int8 CPU最適化）および `imageio-ffmpeg` 自動連動により、字幕が提供されていない動画や取得失敗動画からAPIトークン消費ゼロでタイムスタンプ付き文字起こしを自動生成する基盤を確立（案3完遂）。
    104. `scripts/extract_video_tactics.py` に Whisper 音声認識フォールバックを正式統合。VTT字幕取得失敗時に自動的に音声ダウンロード＆文字起こしを実行し、プロ実況動画からアクション手順を途切れることなく抽出可能に。
    105. `02_FACTORY/TODO.md` に「案5: 🧹 SNS一時下書きドラフト群（213件）の自動インデックス化」をタスクとして正式登録。

### 🔄 判断の経緯 ＆ 落とした選択肢 (Decisions & Rejected Options)
- **採用**: タイムスタンプ圧縮（[MM:SS]）＋LoL戦術キーワードスマートフィルタリング（B案）。
  - *没案*: 動画ファイルや生字幕テキスト（3万〜5万字）を丸ごとLLMへ送信する前回の案。
  - *没理由*: 前回のセッションで「AIのトークン切れ（429 / TPM超過）」を引き起こして頓挫した根本原因。戦術キーワード行のみを抽出してテキスト量を90%カットすることで、トークン制限に絶対に引っかからず、かつ必要な秒数情報だけを高密度にGeminiに渡す構造を実現した。
- **採用**: 既存動画システム（`youtube_absorber.py` / `kirei_bible`）を完全温存した新世代エンジンの独立配備。
  - *没案*: 既存の `youtube_absorber.py` を上書き書き換える案。
  - *没理由*: 稼働中のバッチや過去資産を壊すリスクを排除し、安全に新世代エンジンへ移行できるようにするため。
- **採用**: チャンピオン辞典の「ビジュアル戦略ダッシュボード＋管理者アコーディオン」分離設計。
  - *没案*: 従来のテキスト入力フォームを完全に削除して新しいビジュアルコンポーネントのみにする案。
  - *没理由*: 一般閲覧や試合前の視認性は圧倒的に向上するが、管理者が知見を加筆・推敲・修正する機能が失われてしまう。アコーディオンとして折りたたみ展開可能にすることで、プレイヤーの「瞬読体験」と管理者の「メンテ性」を完全両立させた。
- **採用**: Discord特定チャンネル（`1550333564556546048`）への Bot Token 直接送信 ＆ Webhook フォールバックのハイブリッド構成。
  - *没案*: Webhook URLのみで管理する案。
  - *没理由*: チャンネルごとにWebhookを作成・管理する手間を省き、既存の `DISCORD_BOT_TOKEN` を使ってチャンネルID指定だけで任意のチャンネルへ直接配信できるようにした。
- **採用**: 全168体のバイブル一括生成ではなく、遭遇時に自律成長する「自己増殖型バイブル」アーキテクチャ。
  - *没案*: 全168チャンピオンのバイブルを一気に機械生成する案。
  - *没理由*: 機械生成で一括作成すると情報が薄い形骸化バイブルが大量発生し、実戦の価値が下がる。パレートの法則に従い、遭遇率の高い主力10体を濃密に整備し、残りは `auto_match_recorder.py` で対戦した際に自動生成・肉付けしていく方式が圧倒的に実用的。
- **採用**: Riot Live Client API切断検知によるハンズフリー記録 ＆ `--simulate` テストモード。
  - *没案*: 毎試合ユーザーに手動でCLIを叩かせる案。
  - *没理由*: 試合直後は疲労や次戦マッチングで手動入力が抜け落ちやすく、データ蓄積の継続性が損なわれるため。またテストモードを設けることで実機プレイ中以外のCI/開発環境でも容易に動作確認可能にした。
- **採用**: ルールファイルへの「コンテキストタグ（適用場面・非適用場面）」の1行追加。
  - *理由*: 「結論を先に」等の指示が読者向け記事に誤爆して淡白化する事故（べっぱん氏の教訓）を防ぐため、ルールを全場面一律適用させない。
- **採用**: 正本（Raw Data）と派生データ（AI Summary）の完全分離。
  - *理由*: AI要約を正本にしてしまうと、要約が崩れたりモデル更新時に元に戻せない。元データを不変にしておけばいつでも100%再生成可能（Blooming氏の教訓）。
- **採用**: 地雷回避データベース（`known_pitfalls.md`）の独立化。
  - *理由*: ルールだけだと「なぜそのルールがあるか」を忘れて同じ穴に落ちるため、過去の失敗日付と真因を生のまま残す（べっぱん原則）。
- **採用**: Windows cp932 環境下での `sys.stdout` 多重ラップ防止ガード (`_custom_utf8` フラグ)。
  - *理由*: スクリプト間でモジュールインポートを行う際、`io.TextIOWrapper` が `sys.stdout` を二重にラップして `ValueError: I/O operation on closed file` が発生するクラッシュを恒久的に防ぐため。
- **採用**: ポータルからのナレッジ訂正インボックスの直接操作（API＋UI）。
  - *理由*: スマホやWebブラウザから1タップで違和感を投函できないと、気づきが忘れ去られてナレッジが腐敗するため（AIで仕事と心NOTE原則）。
- **採用**: 主力10体の段階的バイブル配備（MVP原則）。
  - *理由*: 168体を一度に機械量産すると中身が薄い形骸化バイブルになる。高頻度プールに確定知見（即死ライン・罠アイテム・NG行動）を濃縮し、残りは実戦遭遇時に自動同期で拡充させる。
- **採用**: 174本のCoach Kirei動画解析（YouTube ID命名）を直接リネーム・移動せず、チャンピオン別集約マスターインデックス（INDEX.md）を自動生成してNEXUS_INDEXから繋ぐ非破壊アプローチ。
  - *没案*: 174本のファイルをチャンピオン名等にリネームしてフォルダ移動する案。
  - *没理由*: 既存スクリプトやキュー管理、YouTube IDとの紐付けが壊れる危険があり非破壊原則に反する。集約インデックスを作成することで、既存の参照パスを維持しつつ、リンク切れ0件と孤立ファイル半減（400件台➔223件）を低トークン・超高速に実現できた。
- **採用**: 2026年シーズンの仕様（キャンプ0:55、カニ2:55）に基づき、単なるクリア秒数表示だけでなく「カニ湧き2:55までに何秒先行できるか（マージン）」を算出・表示する設計。
  - *没案*: 単に「2分40秒」とだけ表示する案。
  - *没理由*: 旧仕様（3分台）を知るプレイヤーにとって、なぜ2分台なのか、その速さが戦術的にどのような意味を持つのか（カニ湧きに間に合って主導権を取れるのか）が直感的に伝わらないため。
- **採用**: 相手JGのクリアタイム単独表示ではなく、自陣JGとの「速度差（秒数マージン）」を相対計算して即座に交戦危険度（優位/危険/互角）を判定するロジック。
  - *理由*: プレイヤーが知りたいのは「敵が何分何秒か」ではなく「自分と鉢合わせた時に勝てるか・先に着けるか・逃げるべきか」という実践的アクションの判断基準であるため。
- **採用**: `faster-whisper`（int8 CPU最適化）＋ `imageio-ffmpeg` の組み合わせによるローカル音声文字起こし。
  - *理由*: OpenAI純正whisperよりも4倍高速で省メモリ、かつシステムへのffmpeg手動導入（管理者権限）が不要で、既存のPython 3.14環境で完全自己完結・トークン消費ゼロで稼働できるため。
- **落とした選択肢**: 旧アーカイブ（`imperial_archive`）のMarkdownファイル物理削除。
  - *理由*: 過去の歴史的ドラフトや経緯資産を削除すると再利用・復元できなくなるため、物理削除ではなくリンター除外フィルタによる隔離＆リンク表記適正化を選択。
- **落とした選択肢**: テーマ別フォルダの細分化。
  - *理由*: フォルダを細かく切りすぎると保存場所と検索に迷う（りゅう氏の教訓）。PARA（Projects/Areas/Resources/Archives）の4層に留め、内部リンク `[[ノート名]]` で関係を繋ぐ方針を選択。

### 💡 再利用可能なナレッジ（3行抽出）
1. **指示・ルールの末尾には必ず「（適用場面：〜向け。〜には適用しない）」の境界線を1行添える。**
2. **ナレッジを更新する際は上書き（UPDATE）せず、変更前の記載と変更理由を「訂正履歴」として追記する。**
3. **外部情報を保存する際は、「①自分の言葉で説明」「②業務での活用1つ」「③次に試す行動」の3行が揃って初めて保存完了とする。**
4. **Pythonで標準出力をUTF-8化する際は、モジュール間インポート時の二重ラップ（`ValueError: I/O operation on closed file`）を防ぐため属性チェックフラグを付与する。**
5. **外部通知スクリプトは、Webhook URL未設定環境でも例外で落ちず、親切な案内を出してexit code 0で安全終了させる（ドライラン対応）。**
6. **管理ダッシュボードに「ナレッジの健全性・未処理指摘数」をリアルタイム表示することで、ドキュメントの腐敗を常時可視化・抑止する。**
7. **戦術バイブルは全量を一度にでっち上げず、主力プールから濃密に確定させ、実戦同期（`sync_last_match_to_intel`）で生き物のように自己増殖させる（Coupen/つくラボAI原則）。**
8. **大量の孤立ファイル（ID命名の自動生成データ等）は、ファイルを動かさず親ディレクトリにカテゴリ別マスターインデックス（INDEX.md）を自動生成して親索引と繋ぐことで、破壊リスクゼロで孤立を半減・構造化できる。**
9. **ゲームの大規模パッチ（中立湧き時間の前倒し等）追従時は、数値そのものの更新だけでなく「目的基準値（カニ2:55湧きなど）に対する先行マージン」を付与して表示することで、旧仕様との認識ギャップを解消し即戦術判断に直結する。**
10. **対戦ゲームの対面分析UIは、単一の静的ステータスを表示するのではなく、自陣と敵の「相対速度差（秒数マージン）」から交戦危険度（優位/危険/互角）と具体的次善策を1タップ不要で自動提示する設計が最も勝率に貢献する。**
11. **外部APIに頼らない音声文字起こしパイプラインは、`faster-whisper`（CTranslate2）と `imageio-ffmpeg` を組み合わせることで、システム管理者権限やGPU/APIトークンに依存せず完全ポータブルに構築できる。**

- **🎮 実戦対面知見 (Yorick vs KSante / WIN)**: Lv1~2は無理に突っ込まずQスタック蓄積を徹底。Lv3で霧の乙女召喚からEヒット時のバーストでキルライン到達 (※罠: 対面が防具積む前の強引なタワーダイブは被ノックバックで即死するため禁止)