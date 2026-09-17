---
description: チャンピオンの戦術データから500円有料note記事の下書きをワンストップ生成し、DBへ保存する
---

以下のチャンピオンについて、500円モデル有料note記事（無料部分・有料部分・X宣伝文）を生成し、ポータル下書きDB（`note_articles`）へ保存してください。

## 執筆・生成の手順

### 1. 📊 インテル収集
- `01_INTEL/_LOL/ddragon_master_dict.json` および Supabaseの `champion_facts` / `matchup_sentinel` から、対象チャンピオンの最新ビルド、パワースパイク、有利/不利マッチアップ、戦術メモを取得すること。

### 2. ✍️ 記事ドラフト錬成 (`02_FACTORY/03_ASSETS/forge_note_protocol.md` 準拠)
- **タイトル**: 検索流入とクリック率を意識した32文字以内の強烈なフック（例: `【S16最新】〇〇で勝率爆上げする3つの急所`）。
- **無料部分 (`content_free`)**: 
  - なぜ今このチャンピオンが強いのか（メタ・パッチの背景）
  - 初心者が陥りがちな「負けパターン」の言語化
  - 核心（有料エリア）への期待感を高めるCuriosity Gap
- **有料部分 (`content_paid`)**:
  - 秒単位・スキル単位の具体的メカニクス（コンボ・立ち位置・パワースパイク）
  - 主要対面（5〜10体）の確定勝ちパターン手順書（Lv1〜2、Lv3〜5、Lv6〜）
  - 中盤以降のマクロ・集団戦での立ち回り
- **X宣伝スレッド (`promo_text`)**:
  - ツイート用のフックと要約スレッド（画像添付の示唆含む）

### 3. 🛡️ AI臭さの完全排除 (Anti-AI-Smell)
- `ghost-writer` および `04_hallucination_prevention.md` を厳格遵守：
  - 「王」「〜の舞」「〜の調べ」「君」などのポエミーな比喩表現は一切禁止。
  - 「〜しましょう」「〜することが重要です」などの退屈な語尾の3連続を排除。
  - 実戦的なプレイヤー目線の言葉遣い（「即死ライン」「ウェーブフリーズ」「ワンコン」等）で記述すること。

### 4. 💾 DB (`note_articles`) への下書き投入
- 生成完了後、Supabaseの `note_articles` テーブルに以下のカラムで下書きをINSERTし、ポータル `/admin/analytics` の記事下書きプレビューから確認可能にすること：
  - `title`, `champion`, `patch`, `content_free`, `content_paid`, `promo_text`, `status: 'draft'`, `source_skill: 'note-gen'`
