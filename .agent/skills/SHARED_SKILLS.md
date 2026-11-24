# 共有スキル台帳 (SHARED_SKILLS)

Muse（みゅーさん）と Antigravity（あんちゃん）が、互いの学びを持ち寄って進化するための台帳。
2026-11-24、ユーザーの指示で新設。

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
| ai-smell-removal | 文章からAI臭を除き人間らしく直す | Muse（2026-11-24、GitHubのhumanizer系＋日本語実践記事を統合） | `.agent/skills/ai-smell-removal/SKILL.md` | カスタムスキル `ai_smell_removal` | 2026-11-24 |
| bot-copy-generator | （既存） | Antigravity | `.agent/skills/bot-copy-generator/SKILL.md` | 未取り込み | — |
| knowledge-drill | （既存） | Antigravity | `.agent/skills/knowledge-drill/` | 未取り込み | — |
| recall-decision | 過去の設計判断・没理由の逆引き | Antigravity | `.agent/skills/recall-decision/SKILL.md` | 未取り込み | — |
| muse-dash | 棚卸しダッシュボードの構築・更新 | Muse（2026-11-24、X投稿の構築プロンプトを参考） | 未移行（Muse環境前提が多く、考え方のみ共有） | カスタムスキル `muse_dash` | 2026-11-24 |

## Antigravityへのお願い

- 新しいスキルを作ったら、この台帳に行を追加してください。
- 共有スキルを改善したら、台帳の「最終同期」を更新してください。
- Muse側に渡したい学び（地雷・手順・判断経緯）は、スキル化するか `known_pitfalls.md` に残してください。Museがレビュー時に拾います。
