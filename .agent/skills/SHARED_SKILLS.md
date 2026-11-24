# 共有スキル台帳 (SHARED_SKILLS)

Muse（みゅーさん）と Antigravity（あんちゃん）が、互いの学びを持ち寄って進化するための台帳。
2026-11-24、ユーザーの指示で新設。同日、スキル化候補の全件棚卸しと一括同期を実施（ユーザー承認済みの設計マップに基づく）。

## 仕組み（相互進化ループ）

1. **作る**: どちらか一方が、再利用できる手順・知見をスキル化する。
   - Antigravity側：`.agent/skills/<名前>/SKILL.md`（このリポジトリ内）
   - Muse側：Muse のカスタムスキル置き場（リポジトリ外）
2. **持ち寄る**: 相手にも使えるスキルは、相手の形式に合わせた写しを相手側に置き、この台帳に1行追加する。
   - Muse → Antigravity：このリポジトリの `.agent/skills/` に写しを置く（ユーザーが pull して Antigravity に読ませる）。
   - Antigravity → Muse：`.agent/skills/` に置いた時点で共有されたものとし、Muse がレビュー時に取り込む。
3. **使う**: 各自、自分の環境でスキルを使う。環境依存の部分（ツール名・パス等）は各自の写し側で読み替える。
4. **改善を持ち帰る**: 使って気づいた改善点は、自分の写しだけでなく、台帳経由で相手側の写しにも反映する。改善したら台帳の「最終同期」を更新する。

## ルール

- 台帳への追加・更新は、スキルを置いた側が行う。
- 写し同士で内容が食い違ったら、新しい日付の同期を正とする。判断に迷う変更は勝手にマージせず、ユーザーに確認する。
- スキルの内容に、ユーザーの未決定事項や、相手が勝手に決めた仕様を含めない。
- 個人情報・認証情報はスキルに書かない。

## 台帳

| スキル | 内容 | 出どころ | Antigravity側 | Muse側 | 最終同期 |
| --- | --- | --- | --- | --- | --- |
| ai-smell-removal | 文章からAI臭を除き人間らしく直す。プロジェクト固有ルール（固有禁止語彙・言い切り原則）を含む | Muse（2026-11-24、GitHubのhumanizer系＋日本語実践記事を統合）。同日、ghost-writer と執筆規約 30_content_factory の固有ルールを統合 | `.agent/skills/ai-smell-removal/SKILL.md` | カスタムスキル `ai_smell_removal` | 2026-11-24 |
| note-monetize-pipeline | note収益化パイプライン（初稿→辛口査定→リライト→X宣伝スレッド）。ツール紹介系記事用 | Supabase `agent_prompts` の monetize 系4プロンプト（02_FACTORY/INFRA/prompts_migration_v6.sql） | `.agent/skills/note-monetize-pipeline/SKILL.md` | カスタムスキル `note_monetize_pipeline` | 2026-11-24 |
| prompt-techniques-checklist | プロンプト技法「ランクA／ランクS」18技法の場面別チェックリスト（依頼前／回答後／深掘り） | reference_items A1（かねき @kaneki_aiafi） | `.agent/skills/prompt-techniques-checklist/SKILL.md` | カスタムスキル `prompt_techniques_checklist` | 2026-11-24 |
| note-sales-funnel | note／Brain販売ファネルと投稿の型（X長文＋短尺動画＋保存促進、段階価格、選べる記事構成、Xポストの4層構造） | reference_items B12（テンペ）／B8（くろねこ）／B2（とら）＋ `02_FACTORY/PROMO/THREADS/x_viral_lead_framework.md`（2026-11-25 統合） | `.agent/skills/note-sales-funnel/SKILL.md` | カスタムスキル `note_sales_funnel` | 2026-11-25 |
| automation-design-check | 自動化の設計チェック（4行設計シート、自動化レベル1〜5、止まる5原因、週次点検） | reference_items B3（プルぽち「Muse自動化の教科書2026年11月版」） | `.agent/skills/automation-design-check/SKILL.md` | カスタムスキル `automation_design_check` | 2026-11-24 |
| bot-copy-generator | Discord告知・募集文のコピー作成（KTMコミュニティ用） | Antigravity | `.agent/skills/bot-copy-generator/SKILL.md` | カスタムスキル `bot_copy_generator`（取り込み済み） | 2026-11-24 |
| knowledge-drill | 積ん読を定着させる理解度クイズ（AI家庭教師） | Antigravity | `.agent/skills/knowledge-drill/SKILL.md` | カスタムスキル `knowledge_drill`（取り込み済み） | 2026-11-24 |
| recall-decision | 過去の設計判断・没理由の逆引き（/why） | Antigravity | `.agent/skills/recall-decision/SKILL.md` | カスタムスキル `recall_decision`（取り込み済み。パス・ツール名は Muse 向けに読み替え） | 2026-11-24 |
| gmail-account-audit | Gmail棚卸し（登録サイト洗い出し・メルマガ解除リスト・サブスク棚卸し） | reference_items A2（ごろとん）＋B1（あさひ） | なし（Gmailコネクター前提のため Muse 専用） | カスタムスキル `gmail_account_audit` | 2026-11-24 |
| regression-patterns-review | 再発バグパターン7件の照合チェックリスト（SPEC作成・差分レビュー用） | `.claude/skills/known-regression-patterns` を Muse 向けに再構成 | 元スキルが `.claude/skills/known-regression-patterns` にあり | カスタムスキル `regression_patterns_review` | 2026-11-24 |
| supabase-migration-lint | Supabase migration の罠スキャン | `.claude/skills/supabase-migration-lint`（スクリプト本体） | 元スキル（Claude Code側）にあり | カスタムスキル `supabase_migration_lint`（元スクリプトを実行する手順） | 2026-11-24 |
| supabase-table-security | Supabaseテーブル＆APIルートのセキュリティチェック | `04_PORTAL/.claude/skills/supabase-table-security` | 元スキル（Claude Code側）にあり | カスタムスキル `supabase_table_security`（レビュー用に再構成） | 2026-11-24 |
| gemini-model-health-check | Geminiモデルの生死確認（実リクエストで検証） | `.claude/skills/gemini-model-health-check` | 元スキル（Claude Code側）にあり | カスタムスキル `gemini_model_health_check`（条件付き：Gemini APIキーが必要） | 2026-11-24 |
| skill-inventory-audit | スキル棚卸し（重複・未同期・廃止漏れの洗い出し） | `.claude/skills/skill-usage-audit` の考え方を Muse 向けに再構成 | 元スキル（Claude Code側）にあり | カスタムスキル `skill_inventory_audit` | 2026-11-24 |
| session-wrap-up | セッションの締め・記録（判断経緯と没理由を残す） | `.claude/skills/session-handover-update` の考え方を Muse のメモリ運用向けに再構成 | 元スキル（Claude Code側）にあり | カスタムスキル `session_wrap_up` | 2026-11-24 |
| ghost-writer | **廃止**（2026-11-24、ユーザーの承認により ai-smell-removal へ統合） | Claude Code側 | `.claude/skills/ghost-writer/SKILL.md` は廃止通知に差し替え済み | ai-smell-removal に統合 | 2026-11-24 |
| muse-dash | 棚卸しダッシュボードの構築・更新 | Muse（2026-11-24、X投稿の構築プロンプトを参考） | 未移行（Muse環境前提が多く、考え方のみ共有） | カスタムスキル `muse_dash` | 2026-11-24 |

## スキル化しなかったものの扱い（2026-11-24 棚卸しの結論）

- **reference_items B5（MEMORY.md圧縮論）**：週次メモリ整理の運用に反映済みのため、スキル化はしない。
- **reference_items A9（敵JG習慣トラッカー）／C2（スキルCD表示）**：スキルではなく、Tactical Pilot の機能SPEC候補として進める。
- **reference_items B7（合法なGitHubリポジトリ10選）**：一部実施済み（Whisper、Ollama）。残りは参照のみ。
- **ルール／ワークフロー類**：`.agent/rules/30_content_factory.md`、`02_FACTORY/03_ASSETS/forge_note_protocol.md`、`.agent/rules/31_deep_research_v3.md`、`.agent/rules/known_pitfalls.md`、`.agent/workflows/`（audit／weekly-review／wrap-up）は、現行の形（常駐ルール・参照データ・Antigravity側ワークフロー）で維持する。30_content_factory の文体原則の一部は ai-smell-removal へ統合済み。
- **統合済み**：`02_FACTORY/PROMO/THREADS/x_viral_lead_framework.md`（500円note誘導の4層Xポスト構造）は 2026-11-25 に note-sales-funnel へ統合した。
- **未確認**：本番 Supabase の `reference_items`／`personal_knowledge` に、マイグレーション後に画面等から直接追加されたレコードの有無は、Muse の環境から本番DBへ接続できないため未確認（2026-11-24）。reference_items の投入経路はシードのみの設計。

## Antigravityへのお願い

- 新しいスキルを作ったら、この台帳に行を追加してください。
- 共有スキルを改善したら、台帳の「最終同期」を更新してください。
- Muse側に渡したい学び（地雷・手順・判断経緯）は、スキル化するか `known_pitfalls.md` に残してください。Museがレビュー時に拾います。
