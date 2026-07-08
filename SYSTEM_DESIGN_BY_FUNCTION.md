# Sovereign OS 機能別システム設計書

Sovereign OSのポータル、データ管理、自動化ツール、収益化エンジンを機能別に定義する設計書です。

---

## 1. 👑 チャンピオン辞典・攻略ライブラリ機能 (Champion Directory)
各チャンピオンの戦術（プレイスタイル、先出し・後出し評価、立ち回り、ビルド等）を閲覧・編集・検索する機能。

### 1-1. コンポーネント構成
* **フロントエンド**: `04_PORTAL/src/app/champions/page.tsx`
  - チャンピオン一覧、フィルター、編集用フォーム、自動トレンド取得トリガー
* **データベース**: Supabase テーブル `matchup_sentinel`
  - `matchup_id`: `champ_{ChampName}_global`
  - `raw_data`: `jg_style` (ロール、タイプ、先出し・後出し評価), `patch_meta` をJSONB形式で内包

### 1-2. データ処理ロジック
* DDragon APIよりチャンピオンの静的データ（ID, 日本語名, タグ）を取得。
* Supabaseから `enemy = 'GLOBAL'` のデータを全件取得し、チャンピオンIDをキーにしてマージ。

---

## 2. 🎮 大会運営・レートバランサー機能 (KTM Bot & Balancer)
カスタムマッチの運営、メンバー管理、プレイヤーのMMR（実力値レート）計算、戦力の均衡化を行う機能。

### 2-1. コンポーネント構成
* **Discord Bot**: `ktm_bot` (Cloudflare Workers)
  - コマンド・ボタン押下のレシーバー、署名検証
* **バックエンド**: Google Apps Script (GAS)
  - スプレッドシートとの連携、チーム分けアルゴリズム
* **管理者ポータル**: `04_PORTAL/src/app/ktm-admin/`
  - MMRの再構築（`/api/mmr/rebuild`）、整合性検証（`/api/mmr/check-integrity`）

### 2-2. チーム分け＆MMR算出ロジック
* 希望ポジションに基づき、ペナルティ点数（希望外ペナルティ、NG配置ペナルティ）を最小化する組み合わせを選出。
* レーンごとのMMR差の2乗和を最小化し、両チームの平均MMRが最も近くなるようシャッフル。

---

## 3. 🤖 コア自動化エンジン・動画要約機能 (Sovereign Core & SRE)
YouTubeからの攻略動画の自動要約、トレンド収集、不要データの一括削除を裏側で自律実行する機能。

### 3-1. コンポーネント構成
* **常駐監視デーモン**: `03_SYSTEMS/v2_CORE/sre_daemon.py`
  - エラーのAI分析、定期的なサブプロセスの並行起動
* **YouTube解析**: `03_SYSTEMS/v2_CORE/youtube_absorber.py`
  - `yt-dlp`による字幕抽出、Geminiによる攻略ドキュメント生成
* **辞典マージ**: `03_SYSTEMS/v2_CORE/dict_synthesizer.py`
  - 複数記事の要約・マージ統合、削除マーク記事のクリーンアップ

---

## 4. 💰 アフィリエイト・収益化管理機能 (Monetization & Analytics)
note記事の自動生成・投稿、X(Twitter)へのスレッド配信、アフィリエイトリンクの埋め込み、PV数分析を行う機能。

### 4-1. コンポーネント構成
* **管理画面**: `04_PORTAL/src/app/admin/knowledge/`
  - アフィリエイトリンクのインライン編集、バッチ実行のコンソール監視
* **自動投稿バッチ**: `03_SYSTEMS/v2_CORE/monetization_batch.py`
  - Playwrightを使用したnote/Xへの自動下書き保存および投稿
* **データベース**: Supabase テーブル `note_pv_history`
  - 各記事のアクセス推移・ランキングデータの保存
