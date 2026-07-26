# 🤝 Sovereign OS 開発引き継ぎマニュアル (HANDOVER_CLAUDE.md)

本ドキュメントは、これまで Antigravity で進めてきた `my_work` (Sovereign OS) プロジェクトの全修正・実装履歴、システム構造、および今後 Claude 上でスムーズに開発を継続するための引き継ぎ資料です。

---

## 📖 1. はじめに

Sovereign OS は、League of Legends (LoL) の戦術解析・データ分析と、note 配信および AI ツール等のアフィリエイトによる自動収益化、および大会運営 (KTM) ポータルを統合した個人事業 OS です。

今後は Claude (Claude Code CLI / Claude Web / Custom Instructions) をメインアシスタントとして開発・運用を推進します。

---

## 📜 2. Antigravity での主な実装・修正全履歴

Antigravity で実施されたこれまでの修正・新機能実装の到達点です。

### 🚀 (1) Sovereign OS v1.0 ～ v7.0 コアエンジンの構築
- **FastAPI Agent Gateway (`03_SYSTEMS/v2_CORE/api.py`)**
  - LLM (Gemini) 呼び出しの共通窓口。冷却キーローテーション、クォータ保護、429エラー自動回避機構を統合。
- **Webhook駆動ハイブリッドキュー (`edge_worker_daemon.py` / `SovereignQueue`)**
  - 非同期タスクの過剰実行を防ぎ、イベント駆動でスクレイピングや解析タスクを分散処理。
- **YouTube Absorber & モニターの完全自律化**
  - RSSフィード巡回によりAPI枠を消費せず新着動画を検知。YouTube文字起こしから AI が自動で戦術・ルーン・ビルドを抽出してチャンピオン辞典へ自動アペンド。
- **Riot & Discord 連携の改名自己修復**
  - プレイヤーの Riot ID / Discord 名変更時の自動修復・安全停止機能。
- **Sovereign Mind (ティルト防止メンタルチェッカー)**
  - pywebview ベースのデスクトップアプリ。試合終了時の自動ポップアップと連敗検知、マインドフルネスタイマー、単一 `.exe` ビルド完了。

### 🎨 (2) ポータル (`04_PORTAL`) のUI改善 ＆ 機能ハブ化
- **サイドバー導線の最適化**
  - メニュー項目を 10項目から 6項目へ整理し、直感的なセクション分けを実施。
- **チャンピオン辞典のタブ統合ハブ化**
  - 辞典閲覧 / マッチアップ対面 / AI更新ダッシュボードを単一ページに統合。
- **自動化パイプラインダッシュボード**
  - ジョブ実行状態、キュー消費ログ、SRE自己修復状況のリアルタイム可視化。
- **辞典 ➔ note 記事生成の直結導線**
  - 辞典の戦術データからワンクリックで 500円モデル有料 note 記事の下書きを出力する導線を構築。

### 💰 (3) 収益化ファクトリー ＆ AI 執筆プロトコル

> ⚠️ **2026-07-26 削除済み**: 以下の収益化パイプライン（`_MONETIZE/`、`agents/`、`monetization_batch.py`、`note-publisher` スキル/プラグイン等）は、設計を見直した上で改めて実装するため一旦削除しました。実装記録として過去の到達点のみ残しています。現存するのは `promoter.py` のみ（`pulse.py` の6時間おきcronが直接利用しているため）。

- **Ghost Writer & Style Auditor**
  - AI特有のポエミーな表現（「王」「～の舞」など）を徹底排除し、自然な人間の言葉に変換する校正ルールを制定。
- **note 自動投稿 ＆ X 宣伝スレッド連携 (`note-publisher`)**
  - Playwright を用いた note 下書き保存、有料領域区切り、および X（Twitter）スレッドの自動連動。
- **ハイブリッドアフィリエイトバッチ (`tool_scout.py` / `tool_forge.py`)**
  - AIツール等のトレンド自動収集と広告リンク入りのレビュー記事・SNS拡散文脈の自動錬成。

---

## 🗺️ 3. システム構造 ＆ ディレクトリマップ

```text
my_work/
├── CLAUDE.md                      # Claude用最上位ルール＆コマンド指示書
├── HANDOVER_CLAUDE.md             # 本引き継ぎマニュアル
├── ANTIGRAVITY.md                 # プロジェクト最高憲法・仕様書
├── SYSTEM_DESIGN.md               # システム全体設計書
│
├── 01_INTEL/                      # [知識・プロンプト層]
│   ├── NEXUS_INDEX.md             # 帝国総合索引 (全アセットへのリンク)
│   ├── _LOL/                      # LoL戦術、パッチデータ
│   └── _MONETIZE/                 # アフィリエイトプロンプト、進化ルール
│
├── 02_FACTORY/                    # [成果物・執筆層]
│   ├── TODO.md                    # 業務ダッシュボード (本日のタスク・バックログ)
│   ├── 01_DRAFTS/                 # note記事・SNSスレッド下書き
│   ├── 02_PUBLISHED/              # 投稿済み書庫
│   └── 03_ASSETS/                 # アフィリエイト知識、note執筆プロトコル等
│
├── 03_SYSTEMS/                    # [実行エンジン・プログラム層]
│   ├── v2_CORE/                   # API Gateway (api.py), EdgeWorkerDaemon, 各種バッチ
│   └── ktm_bot/                   # 大会運営用 Discord Bot
│
└── 04_PORTAL/                     # [Web表示層 (Next.js)]
    ├── src/                       # ポータルUIコンポーネント・APIルート
    └── package.json
```

---

## ⚠️ 3.5. 稼働実態の補足 (2026-07-26 調査確認済み)

上記のシステム構造マップは設計上の理想形であり、**実際の稼働状況とは乖離**があります。フォルダ全体の不具合調査で判明した実態は以下の通りです。

- **ポータル・Bot はクラウド常時稼働**: `04_PORTAL` は Vercel、`03_SYSTEMS/ktm_bot` は Cloudflare Workers 上で稼働。ローカルで `npm run dev` を叩いても本番とは別のプレビュー環境が立つだけ。
- **YouTube解析・辞典同期はGitHub Actions**: `scripts/youtube_worker.py`（30分おき）・`scripts/prospector.py`・`.github/workflows/ktm-cloud-worker.yml` が担当。`03_SYSTEMS/v2_CORE/youtube_absorber.py` 系の旧処理（`absorber.yml`）は重複解析を防ぐため**明示的に停止済み**。
- **v2_CORE が現役なのは2つだけ**: ① `run_pulse_once.py`（Sovereign Pulse、GitHub Actionsから6時間おき） ② `edge_worker_daemon.py`（ローカルPCでの字幕なし動画のwhisper文字起こし、`start_all.bat` 経由）。それ以外の `v2_CORE` モジュール（FastAPI Gateway常時起動、SREデーモン等）は本番では使われていません。
- **既知の修正済みバグ**: `start_all.ps1` の既定モード（`-Mode edge`）は「Edge Worker Daemon起動」を謳いながら実際は SQLite時代の遺物 `task_worker.py` を起動しており、`SovereignQueue._get_conn()` 不在で起動直後にクラッシュしていた（2026-07-26修正済み）。これにより字幕なし動画の文字起こしが実質機能していなかった可能性がある。
- **`start_all.ps1` の簡素化 (2026-07-26)**: `-Mode all`（ポータル/Bot/Ollama/Core APIのローカル重複起動＋`sre_daemon.py`）を廃止し、Edge Worker Daemon単独起動のみに一本化した。`sre_daemon.py`はGatewayバイパス問題とクラウド側との重複巡回タスクを抱えていたため削除。唯一有用だった「字幕なし動画(youtube_absorb)の15分おき自動起票」ロジックは `edge_worker_daemon.py` 自身（`youtube_absorb_scheduler_loop`）に統合済み。`healer.py`（sre_daemon.py専用の自己修復エンジン）も呼び出し元が無くなったため`deprecated/`へ移動。
- 詳細な移行経緯・落とし穴は `AI_HANDOFF.md` を参照。同ファイルの方が本書より新しい場合がある。

---

## ⚠️ 4. 開発時の絶対ルールまとめ

Claude で開発・コード修正を行う際は、以下のルールを必ず順守してください。

1. **日本語対応の徹底**: 思考・コードコメント・応答・進捗表示は全て日本語で行う。
2. **Next.js の絶対パスエイリアス禁止**: `04_PORTAL` 内のコードで `@/` インポートは絶対に使用しない（常に `../../` などの相対パスを使用）。
3. **作業前確認 (y/n)**: ファイル変更・削除・コマンド実行の前に作業計画を報告し確認を取る。
4. **AI臭さの排除**: 記事や文章生成時にポエミーな比喩表現（王、舞など）を使用しない。
5. **Supabase Identity 列の個別 Update 運用**: Identity 列を含むテーブルへの Upsert/Insert エラーを防ぐため、個別 Update を並列実行する。

---

## 📋 5. 残タスク・Sovereign OS v8.0 ロードマップ

現在 `02_FACTORY/TODO.md` に記載されている未完了タスクおよび技術的負債です。Claude 上で次に行う作業の参考にしてください。

- [ ] **コンテンツ収益化の運用**
  - [ ] 新規アフィリエイト記事の構成案作成 ＆ 投稿
  - [ ] YouTube動画解析ジョブの監視と辞典整理状況の確認
- [ ] **Sovereign OS v8.0 への移行（技術的負債解消）**
  - [ ] **APIファースト化**: `04_PORTAL` (Next.js) から Supabase DB への直接アクセスを廃止し、FastAPI Gateway (`api.py`) 経由に統一。
  - [ ] **ジョブキュー統合**: SQLite SovereignQueue と Supabase edge_tasks の2系統キューを SovereignQueue へ一本化。
  - [ ] **スクリプト大掃除**: `04_PORTAL/scripts/` 内の重複旧スクリプトを消去。

---

## 💬 6. Claude 開発開始用コピペプロンプト

Claude Code や Claude Chat で本プロジェクトの開発を再開する際、以下のプロンプトをそのままコピペして入力してください。

```text
Sovereign OS (my_work) の開発を引き継ぎます。
プロジェクト直下の `CLAUDE.md` および `HANDOVER_CLAUDE.md` を読み込み、
さらに `01_INTEL/NEXUS_INDEX.md` と `02_FACTORY/TODO.md` を参照して、
現在のプロジェクト状態と「今日やること」を把握した上で、次の作業の提案を行ってください。
```
