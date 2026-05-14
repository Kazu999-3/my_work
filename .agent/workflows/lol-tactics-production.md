---
description: 最新パッチ情報から「勝てる戦術」を抽出し、note記事とSNS拡散用ポストを一度に生成するLoL軍師専用のワークフロー。
---

# ⚔️ LoL軍師：戦術記事生産ワークフロー v2

> **担当エージェント**: [軍師 (Strategist)](file:///d:/my_work/.agent/agents/Strategist.md)
> **大憲章参照**: [ANTIGRAVITY.md](file:///d:/my_work/ANTIGRAVITY.md) — 第3章：品質基準

このワークフローは、最新のパッチデータとAIの分析を組み合わせ、プレイヤーが「今すぐ使える」戦術記事を爆速で生成するためのものです。

---

## 📋 事前準備
- [ ] 対象チャンピオンの確認（ユーザー指定 or 自動選定）
- [ ] 最新パッチ番号の確認

---

## 🛠️ ステップ詳細

### Step 1: データ収集 → `lol-data-collector` スキル
// turbo
1. [lol-data-collector](file:///d:/my_work/.agent/skills/lol-data-collector/SKILL.md) を起動する。
2. 対象チャンピオン × ロール × 最新パッチ で統計データを取得。
3. 結果を `01_INTEL/tactics/lolalytics_{champion}_{patch}.md` に保存。
4. **チャンピオン未指定の場合の自動選定基準**:
   - 勝率変動 ±2% 以上
   - ピック率 5% 以上
   - 過去に記事未制作

### Step 2: プロトレンド追跡 → `pro-build-tracker` スキル
// turbo
1. [pro-build-tracker](file:///d:/my_work/.agent/skills/pro-build-tracker/SKILL.md) を起動する。
2. Step 1 で選定したチャンピオンについてプロのビルドを追跡。
3. 一般統計との **乖離ポイント** を抽出（ここが記事の付加価値になる）。
4. 結果を `01_INTEL/tactics/pro_trend_{champion}_{date}.md` に保存。

### Step 3: 超・ディープ・メタ・リサーチ (Protocol v3)
1. **多角的データ収集**: 参照：`.agent/rules/31_deep_research_v3.md`
   - **最低5件以上のクエリ実行**: 公式、統計、プロデータ、コミュニティ、動画解析の5方向から `search_web` で徹底調査。
   - **生データの抽出**: `read_url_content` を用い、パッチ変更の「正確な数値」と、それによる「数学的インパクト（秒単位の効率等）」を算出。
2. **リサーチ調査報告書 (Artifact) の作成**: 
   - 執筆を開始する前に、Step 1・2のデータ + 追加調査を統合したリサーチ報告書を Artifact として出力。
   - ユーザーの確認を得てから次ステップへ。

### Step 4: 「軍師の助言」執筆
// turbo
1. **目標10,000文字以上**のLoL特化構成でドラフトを作成する。

   **必須セクション構成** (ANTIGRAVITY.md 第3章準拠):
   - **Hook & Context** (800字+): パッチによる生態系破壊の深層解説
   - **Statistical Truth** (1200字+): サイト別データの乖離から読み解く「大衆の誤解」と「真の勝機」
   - **The Mechanics** (2000字+): 秒単位のクリア、バッファ入力、全スキルセットのシナジー
   - **Matchup Encyclopedia** (3000字+): **15体以上**の対面データと具体的な詰め将棋
   - **Macro Strategy** (1500字+): 心理戦、オブジェクト周りの駆け引き
   - **Premium Zone** (500字+): AIとプロの統計だけが知る「隠れたTier S」

2. 出力先: `03_FACTORY/note_drafts/draft_{champion}_{patch}.md`

### Step 5: AI臭監査 → `style-auditor` スキル
// turbo
1. [style-auditor](file:///d:/my_work/.agent/skills/style-auditor/SKILL.md) でドラフトを監査。
2. NGワード検出 → 自動修正（最大3回リトライ）。
3. **90点以上になるまで通過させない。**

### Step 6: ビジュアル & プロモーション
// turbo
1. `generate_image` で、サイバーパンク × 軍師感のアイキャッチ画像を生成。
2. X拡散用ポスト **3種類** を作成:
   - **速報型**: 「【パッチ{X}速報】{Champion}の勝率が{Y}%に急上昇。理由は...」
   - **データ型**: 「{Champion}使い必見。コアの{Item}変更で勝率+{Z}%。詳細は↓」
   - **共感型**: 「{Champion}で勝てなくなったと感じてませんか？実はビルドを変えるだけで...」
3. 出力先: `03_FACTORY/sns_promotions/x_posts_{champion}_{patch}.md`

### Step 7: 軍師報告書の提出
最終報告として以下を王に提示:
```markdown
## 📩 軍師報告書
- 対象パッチ: {patch}
- 対象チャンピオン: {champion} ({role})
- 記事ドラフト: [リンク]
- AI臭スコア: {点}/100
- X投稿案: 3本 [リンク]
- アイキャッチ: [リンク]

### 👑 王のアクション
- [ ] 記事内容の最終確認
- [ ] noteへの投稿
- [ ] X投稿の予約
```

---

## 🎯 期待される成果
- パッチリリースから24時間以内の「最速攻略」という圧倒的な先行者利益。
- 1本あたりの制作時間: **5時間 → 30分** に短縮。
- AI臭スコア **90点以上** の高品質記事を保証。
