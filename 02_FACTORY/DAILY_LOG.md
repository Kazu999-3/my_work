# 📅 Sovereign OS デイリー作業ログ (DAILY_LOG)

本ファイルは、日々の開発・執筆・分析作業の「唯一の入口」であり、作業の経緯と再利用可能なナレッジを蓄積するマスター日誌です。

## 📜 運用プロトコル
1. **AIが書く（自動追記）**: 作業ログは人間ではなく、セッション完了時にAIが指定フォーマットで追記する。
2. **AIが真っ先に読む（立ち上がり循環）**: 翌日のセッション開始時、AIは直近のデイリーログを読み、文脈と前回の「判断経緯」を即座に復元する。
3. **3行ナレッジ抽出の義務化**: 毎回の作業から「他でも使える知見・ルール・判断基準」を抽出し、ナレッジ層へ還元する。

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

- **🎮 実戦対面知見 (Yorick vs KSante / WIN)**: Lv1~2は無理に突っ込まずQスタック蓄積を徹底。Lv3で霧の乙女召喚からEヒット時のバーストでキルライン到達 (※罠: 対面が防具積む前の強引なタワーダイブは被ノックバックで即死するため禁止)