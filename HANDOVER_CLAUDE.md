# 🤝 Sovereign OS 開発引き継ぎマニュアル (HANDOVER_CLAUDE.md)

本ドキュメントは、`my_work` (Sovereign OS) プロジェクトのシステム構造・稼働実態・絶対ルールをまとめた引き継ぎ資料です。Antigravity → Claude、Claude → Antigravity のどちらの方向へ切り替える場合も、本書と `02_FACTORY/TODO.md`・`01_INTEL/NEXUS_INDEX.md` を読み込めば文脈を復元できるよう、作業したツール側が都度この3ファイルを更新する運用にしています。

> 📦 **詳細な実装・修正履歴は [`02_FACTORY/TODO_ARCHIVE.md`](file:///d:/my_work/02_FACTORY/TODO_ARCHIVE.md) およびgit logに集約済み**（2026-09-21実施、AIコンテキスト消費削減のため）。本書では各期間のヘッドラインのみ要約しています。

---

## 📖 1. はじめに

Sovereign OS は、League of Legends (LoL) の戦術解析・データ分析と、note 配信および AI ツール等のアフィリエイトによる自動収益化、および大会運営 (KTM) ポータルを統合した個人事業 OS です。

運用体制はAntigravity中心（2026-08-04〜）だが、大規模な不具合修正セッションはClaude Codeで実施することが多い（直近: 2026-09-20）。

---

## 📜 2. 実装履歴サマリー（詳細は [`TODO_ARCHIVE.md`](file:///d:/my_work/02_FACTORY/TODO_ARCHIVE.md) を参照）

- **〜v7.0（〜2026-07月）**: FastAPI Agent Gateway・Webhook駆動ハイブリッドキュー・YouTube Absorber自律化・Riot&Discord改名自己修復・Sovereign Mind等のコアエンジン構築。収益化ファクトリー（note自動投稿・アフィリエイトバッチ）を一時構築後、2026-07-26に設計見直しのため削除（`promoter.py`のみ現役cronのため残置）。
- **2026-08-04（Claude Code）**: ソロQ振り返り自動化（ティルト診断ポップアップ・曜日×時間帯ヒートマップ）、チャンピオン辞典の一斉ファクトチェック機能新設（`dict_fact_check_queue`）、日本語化バッチ拡充。
- **2026-08-09〜08-10（Claude Code）【最重要】**: Gemini APIクォータ枯渇の根本原因究明・解消（`gemini-2.0-flash`系が無料枠0/0だったと判明、`gemini-3.x`系へ統一）。クォータ追跡の欠陥修正・サーキットブレーカー新設。辞典/ソロQコーチ/KTM Botの複数不具合修正。再発防止用に`gemini-model-health-check`等4スキルを新設。
- **2026-09-04〜09-08（Antigravity）**: Sovereign HUDオーバーレイのフルスペック化、集団戦勝因敗因アナライザー、DataDragon公式辞書同期基盤の構築（全173チャンピオン日英対照辞書）、Hextech Dark Goldオーバーレイへ全面リニューアル。
- **2026-09-08（The Sovereign Victory Loop 着手）**: 即死キルライン境界メーター・3段階勝ちパターン手順書・オーバーレイ連動HUD・試合後ディープアナリティクス・ナレッジ自動更新ループを構築し、プレイ前→プレイ中→プレイ後→ナレッジ蓄積の完全循環ループを完成。
- **2026-09-17（Antigravity、業務効率化）**: 過去11セッション791プロンプトの分析に基づき5大課題を解消 — `/audit`コマンド化、LLM健全性・虚偽報告防止ルール化、休眠スキル17件アーカイブ（常設6件に集約）、UIカラーパレット規約明文化（暖色ダーク＋Hextechゴールド）、辞典DataDragon一括同期CLI新設。一般ユーザー向けポータル改善（試合履歴解放・選手カルテ・ボトムナビ等）も実施。
- **2026-09-18（Antigravity）**: note 10記事のディープリサーチに基づく「ナレッジマネジメント7大核心原則」を全域反映（38項目、デイリーログ・地雷回避DB・自動バイブル同期デーモン・リンク整合性リンター等を新設）。
- **2026-09-20（Claude Code）**: カジノ経済ロジックの潜在不具合5件修正（バカラ配当・バランサー公平化・クラッシュ多重利確等）＋本番ライブ検証。検証中に発覚した`crashPoint`平文漏洩の重大脆弱性を根絶。動画解析パイプラインの現状調査（`edge_worker_daemon.py`が41時間停止していたことが判明）＆Phase2着手前の基盤修正3件。
- **2026-09-21（Claude Code）**: AIエージェントのコンテキスト消費削減のため、本ファイルおよび`TODO.md`の過去ログを`TODO_ARCHIVE.md`へ退避・圧縮。

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
│   ├── TODO_ARCHIVE.md            # 過去セッションログの詳細アーカイブ
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
- **v2_CORE が現役なのは3つ**: ① `run_pulse_once.py`（Sovereign Pulse、GitHub Actionsから6時間おき） ② `edge_worker_daemon.py`（ローカルPCでの字幕なし動画のwhisper文字起こし、`start_all.bat` 経由） ③ `scripts/edge_cloud_worker.py`（GitHub Actions `edge-cloud-worker.yml`から5分おき、クラウド完結タスクを処理）。それ以外の `v2_CORE` モジュール（FastAPI Gateway常時起動、SREデーモン等）は本番では使われていません。
- **既知の修正済みバグ**: `start_all.ps1` の既定モード（`-Mode edge`）は「Edge Worker Daemon起動」を謳いながら実際は SQLite時代の遺物 `task_worker.py` を起動しており、`SovereignQueue._get_conn()` 不在で起動直後にクラッシュしていた（2026-07-26修正済み）。
- **`start_all.ps1` の簡素化 (2026-07-26)**: `-Mode all`（ポータル/Bot/Ollama/Core APIのローカル重複起動＋`sre_daemon.py`）を廃止し、Edge Worker Daemon単独起動のみに一本化した。`sre_daemon.py`はGatewayバイパス問題とクラウド側との重複巡回タスクを抱えていたため削除。唯一有用だった「字幕なし動画(youtube_absorb)の15分おき自動起票」ロジックは `edge_worker_daemon.py` 自身（`youtube_absorb_scheduler_loop`）に統合済み。
- **2026-09-20時点の追加確認**: ローカル常駐`edge_worker_daemon.py`自体が41時間以上起票停止していたことが判明（PC起動依存という構造上、気づかれず止まり続けるリスクが現在進行形）。`scripts/ops_health_check.py`に`check_youtube_automation_freshness()`を追加済みだが動作確認は未実施（`TODO.md`のPhase2節参照）。
- 詳細な移行経緯・落とし穴は `AI_HANDOFF.md` を参照。同ファイルの方が本書より新しい場合がある。

---

## ⚠️ 4. 開発時の絶対ルールまとめ

Claude で開発・コード修正を行う際は、以下のルールを必ず順守してください。

1. **日本語対応の徹底**: 思考・コードコメント・応答・進捗表示は全て日本語で行う。
2. **Next.js の絶対パスエイリアス禁止**: `04_PORTAL` 内のコードで `@/` インポートは絶対に使用しない（常に `../../` などの相対パスを使用）。
3. **作業前確認 (y/n)**: リスクの高い操作（削除・機密変更・広範な書き換え）の前に作業計画を報告し確認を取る。非破壊操作（調査・テスト・軽微な修正）は自律実行可（詳細: `.claude/rules/confirmation.md`）。
4. **AI臭さの排除**: 記事や文章生成時にポエミーな比喩表現（王、舞など）を使用しない。
5. **Supabase Identity 列の個別 Update 運用**: Identity 列を含むテーブルへの Upsert/Insert エラーを防ぐため、個別 Update を並列実行する。

---

## 📋 5. 残タスク・Sovereign OS v8.0 ロードマップ

現在の未完了タスクおよび技術的負債は `02_FACTORY/TODO.md` に集約しています。そちらを参照してください。主な柱:

- コンテンツ収益化の運用（アフィリエイト記事・YouTube動画解析ジョブ監視）
- Sovereign OS v8.0への移行（APIファースト化、ジョブキュー統合、スクリプト大掃除）
- 動画解析インフラ進化（Phase2: 主要JGチャンピオン再解析バッチ、Phase3: 自律ナレッジループ）

---

## 💬 6. Claude 開発開始用コピペプロンプト

Claude Code や Claude Chat で本プロジェクトの開発を再開する際、以下のプロンプトをそのままコピペして入力してください。

```text
Sovereign OS (my_work) の開発を引き継ぎます。
プロジェクト直下の `CLAUDE.md` および `HANDOVER_CLAUDE.md` を読み込み、
さらに `01_INTEL/NEXUS_INDEX.md` と `02_FACTORY/TODO.md` を参照して、
現在のプロジェクト状態と「今日やること」を把握した上で、次の作業の提案を行ってください。
```
