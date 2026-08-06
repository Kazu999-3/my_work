# Google Agent Skills Standard 準拠ガイド (google/skills)

当プロジェクト（Sovereign Mind）の `.agent/skills/` は、**Google Cloud 公式 Agent Skills リポジトリ (`google/skills`)** の標準仕様に準拠しています。

## 🎯 設計原則 (Open Agent Skills Standard)

1. **オンデマンド知識注入 (Context Inflation Prevention)**:
   - 全すべての指示・ナレッジを初期プロンプトに詰め込むのではなく、**特定のタスク（note自動執筆、ファクトチェック、データ移行など）が必要になった時点でのみSkillをロード**します。
2. **標準フォーマット (`SKILL.md` + YAML Frontmatter)**:
   - 各スキルは `skills/<skill_name>/SKILL.md` に格納。
   - 先頭に `name` と `description` の YAML Frontmatter を必須で記述。

```yaml
---
name: note_writer
description: LoLのSSOTデータから500円モデル有料note記事ドラフトを自動生成するスキル
---
```

## 🛠️ プロジェクト内主要スキル
- `knowledge-cutoff-awareness`: 最新LoLパッチ・Webライブラリの自動検索・ファクトチェック
- `note-writer`: 収益化500円note記事の執筆ルール＆Xプロモ作成
- `indexing-awareness`: コードベース型定義の完全参照＆ハルシネーション防止
