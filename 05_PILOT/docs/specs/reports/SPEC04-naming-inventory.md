# 名称の出現箇所一覧 (SPEC04-naming-inventory.md)

本ドキュメントは、`05_PILOT/docs/specs/04-numbers-and-labels-followup-SPEC.md`（SPEC 04）に基づき、「KTM PILOT / SOVEREIGN PILOT」「レーン攻略 / レーンガイド / レーン攻略バイブル」「ADC / BOT」の出現箇所（ファイル・UI画面・文脈）を網羅的に洗い出した調査一覧である。
※SPECの指示に基づき、本フェーズでは**コード・UI上の名称変更は行わず、出現箇所の提示のみ**を行う。

---

## 1. アプリケーション製品名（KTM PILOT vs SOVEREIGN PILOT）

| No | ファイルパス / 行番号 | 画面・コンテキスト | 表記 | 備考 |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `src/app/layout.tsx:6` | ブラウザタブ タイトル (`<title>`) | `KTM PILOT` | `title: 'KTM PILOT \| LoL個人戦術コックピット'` |
| 2 | `src/app/layout.tsx:12` | Apple Web App タイトル | `KTM PILOT` | `title: 'KTM PILOT'` |
| 3 | `src/app/manifest.ts:5` | PWA マニフェスト アプリ名 | `KTM PILOT` | `name: 'KTM PILOT - LoL戦術コックピット'` |
| 4 | `src/components/GlobalNavbar.tsx:71` | 全画面共通 ナビゲーションバー見出し | `SOVEREIGN PILOT` | ブランドロゴ横のメインタイトル表示 |
| 5 | `src/app/login/page.tsx:44` | 合言葉ログイン画面 ヘッダー見出し | `Sovereign Pilot` | ログインカード上部のアプリ見出し |
| 6 | `src/app/overlay/page.tsx:165` | ゲーム中リアルタイムHUD ヘッダー | `Sovereign HUD` | オーバーレイ画面のタイトル表示 |

### 考察と選択肢（未決事項）
- **現状**: 外側のメタデータ（HTMLタイトル、PWAマニフェスト）は `KTM PILOT`、内側の主要UI（ナビバー、ログイン画面、HUD）は `SOVEREIGN PILOT` / `Sovereign` と二重化している。
- **選択肢**:
  - **案A**: `KTM PILOT` に統一（ポータルやコミュニティ名 KTM との一貫性を最優先）
  - **案B**: `SOVEREIGN PILOT` に統一（UIのブランド表示・自律AIコックピットの世界観を最優先）
  - **案C**: 正式名称を `KTM SOVEREIGN PILOT` とし、略称・ブランドとして使い分けルールを定義

---

## 2. レーン攻略コンテンツ（レーン攻略 vs レーンガイド vs レーン攻略バイブル）

| No | ファイルパス / 行番号 | 画面・コンテキスト | 表記 | 備考 |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `src/components/GlobalNavbar.tsx:26` | 上部ナビゲーションバー リンク | `レーン攻略` | ナビのリンクテキスト |
| 2 | `src/app/lane-guides/page.tsx:128` | レーン攻略ページ 読込ローディング | `レーン攻略バイブル` | `レーン攻略バイブルを読み込み中...` |
| 3 | `src/app/lane-guides/page.tsx:183` | レーン攻略ページ ヘッダーバッジ | `{activeLane} BIBLE` | 例: `JG BIBLE` |
| 4 | `src/app/lane-guides/page.tsx:208` | レーン攻略ページ AI最適化ボタン | `AIガイド最適化・再構築` | 最適化モーダルトリガー |
| 5 | `src/app/api/lane-guides/route.ts:7-13` | レーン攻略API レーン選択肢ラベル | `TOP レーン攻略` 等 | `⚔️ TOP レーン攻略`、`🌲 JG ジャングル攻略` 等 |
| 6 | `src/lib/laneDetector.ts:15-18` | レーン自動判定ユーティリティ | `TOP レーン攻略` 等 | ラベル定義 |
| 7 | `src/lib/laneGuideIntegrate.ts:159` | 記事統合パイプライン 生成タイトル | `{lane} レーン攻略ガイド` | 初回自動生成時のタイトル |
| 8 | `src/app/admin/dashboard/page.tsx:628` | 運用ダッシュボード ナレッジ統計カード | `レーンガイド` | `<Stat label="レーンガイド" value={...} />` |
| 9 | `src/app/admin/review/page.tsx:651` | 審査画面 上部リンクボタン | `レーン攻略バイブル ↗` | 該当ページへの外部リンク |
| 10 | `src/app/admin/review/_review/FactsPreviewTab.tsx:187` | 審査画面 行単位ルーティング先 | `🗺️ レーンガイドへ` | 辞典/レーンガイド/除外の選択肢 |
| 11 | `src/app/admin/review/_review/LanePreviewTab.tsx:6` | 審査画面 レーン統合プレビュータブ | `レーンガイド` | タブ名および説明文 |
| 12 | `src/app/admin/review/_review/PreviewModal.tsx:175` | 審査プレビューモーダル タブ | `レーンガイド` | プレビューモーダルのタブ名 |

### 考察と選択肢（未決事項）
- **現状**: ナビバーでは「レーン攻略」、ページ本体やリンクでは「レーン攻略バイブル」、管理画面やAPI・DB内部では「レーンガイド」と3通りの呼称が混在している。
- **選択肢**:
  - **案A**: **「レーン攻略バイブル」** に統一（各チャンピオンの「対面戦術バイブル」と世界観・格調を揃える）
  - **案B**: **「レーン攻略ガイド」** に統一（機能的でわかりやすい一般的な呼称）
  - **案C**: **「レーン攻略」** に統一（短縮形としてUIの省スペース性を優先）

---

## 3. レーン・ロール表記（ADC vs BOT）

| No | ファイルパス / 行番号 | 画面・コンテキスト | 表記 | 備考 |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `src/app/_champions/ChampionListView.tsx:91` | トップ チャンピオン一覧 ロールタブ | `ADC` | `["ALL", "TOP", "JG", "MID", "ADC", "SUP"]` |
| 2 | `src/app/_champions/LaneMaintenanceModal.tsx:23` | 所属レーン編集モーダル | `ADC` | `['TOP', 'JG', 'MID', 'ADC', 'SUP']` |
| 3 | `src/app/_champions/LaneTempoHud.tsx:35` | ミニHUD タイトルフォールバック | `BOT/ADC指標` | `🏹 BOT/ADC指標` |
| 4 | `src/app/_champions/MatchupTab.tsx:172` | 対面タブ レーンフィルター | `ADC` | `{ key: "ADC", label: "🏹 ADC" }` |
| 5 | `src/app/_champions/useChampionDetailData.ts:81` | チャンピオン詳細データ結合 | `ADC / BOT` | DB実測値は `BOT`、設定値は `ADC` のため相互変換処理あり |
| 6 | `src/app/admin/dashboard/page.tsx:651` | ダッシュボード ロール別カバー率 | `BOT` | `['TOP', 'JG', 'MID', 'BOT', 'SUP']` |
| 7 | `src/app/admin/dashboard/page.tsx:536` | ダッシュボード 募集ログ ロール判定 | `ADC` | `{ icon: '🏹', label: 'ADC' }` |
| 8 | `src/app/admin/youtube/ChampionScoutPanel.tsx:19` | YouTubeスカウター ロールフィルター | `ADC (BOT)` | `{ key: 'BOT', label: 'ADC (BOT)' }` (keyはBOT) |
| 9 | `src/app/admin/review/_review/types.ts:4` | 審査画面 型定義 `LaneKey` | `ADC` | `'JG' \| 'TOP' \| 'MID' \| 'ADC' \| 'SUP' \| 'COMMON'` |
| 10 | `src/app/admin/review/_review/types.ts:173` | 審査画面 フィルター選択肢 | `ADC/BOT` | `{ key: 'ADC', label: '🏹 ADC/BOT', icon: '🏹' }` |
| 11 | `src/app/api/lane-guides/route.ts:11` | レーン攻略API レーン選択肢 | `BOT/ADC` | `{ key: 'ADC', label: '🏹 BOT/ADC レーン攻略' }` |
| 12 | `src/app/coach/FiveVFiveSimTab.tsx:134` | 5v5シミュレーター スロット定義 | `BOT` | `roles = ['TOP', 'JG', 'MID', 'BOT', 'SUP']` |
| 13 | `src/app/coach/MissionCard.tsx:35` | デイリーミッション ロール変換 | `ADC` | `BOTTOM: 'ADC'` |
| 14 | `src/app/library/_library/ArticleCard.tsx:44` | 戦術ライブラリ 記事カードバッジ | `ADC` | `🏹 ADC` |
| 15 | `src/data/champions_summary.json` | 正本データ `roles` | `BOT` | 例: カイ＝サ、ジンクス等は `roles: ["BOT"]` |
| 16 | `src/data/opgg_lane_meta.json` | OP.GG メタデータ | `ADC` | キーは `ADC` |

### 考察と選択肢（未決事項）
- **現状**: プレイヤー向け画面（一覧タブ、ライブラリ、募集）では慣用的な「ADC」が多く使われ、システム内部や5v5・正本JSONでは公式レーン名の「BOT」が使われており、一部画面では「ADC (BOT)」や「BOT/ADC」と併記している。
- **選択肢**:
  - **案A**: UI表示を **`BOT`** に統一（Riot公式のレーン分類 Bottom に揃える。メイジ等の非マークスマンBot適性チャンプとの整合性が高い）
  - **案B**: UI表示を **`ADC`** に統一（プレイヤーコミュニティで最も浸透している通称に揃える）
  - **案C**: 主要UIでは **`BOT (ADC)`** または **`ADC/BOT`** の併記を標準とする
