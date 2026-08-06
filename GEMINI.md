# Gemini 3 / Antigravity エントリポイント (GEMINI.md)

このファイルは Google Antigravity (Gemini 3) の対話開始時に自動ロードされるエントリポイントです。
単一の真実の源（SSoT: Single Source of Truth）パターンに従い、主要プロジェクト憲法 `ANTIGRAVITY.md` および `.agent/rules/` を自動参照します。

## 🏛️ プロジェクト憲法 ＆ 定義への参照
- プロジェクト全容・技術スタック・機能マップ: [ANTIGRAVITY.md](file:///d:/my_work/ANTIGRAVITY.md)
- 基本行動指針・自動デプロイフロー: [01_base_style.md](file:///d:/my_work/.agent/rules/01_base_style.md)
- セキュリティ・破壊操作縛り: [03_security_rules.md](file:///d:/my_work/.agent/rules/03_security_rules.md)
- ハルシネーション防止＆知識カットオフ対策: [04_hallucination_prevention.md](file:///d:/my_work/.agent/rules/04_hallucination_prevention.md)

## 👑 行動原則
1. **日本語完全対応**: 全ての応答・解説・ログ・コミットメッセージは日本語で行う。
2. **ワンストップ全自動デプロイ**: コード修正後は「1. 実装 ➔ 2. 動作テスト＆否定的なセルフレビュー ➔ 3. 型チェック ➔ 4. Git commit & push」まで途中で確認を挟まず自律実行する。
3. **ハルシネーションの厳禁**: コード編集前に必ず `view_file` や `grep_search` で型定義を確認する。
