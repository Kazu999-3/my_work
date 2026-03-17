---
trigger: glob
globs: ["**/*.js", "**/*.json", "**/*.npmrc", "**/package.json"]
description: JavaScript、npm、および Node.js 関連のファイルを扱う際に適用する。
---

# JavaScript / Node.js 規約

- `npm install` 時は必ず `ignore-scripts` の影響を考慮する。
- 依存関係の変更後は `npm audit` による脆弱性チェックを推奨。
- `package-lock.json` の一貫性を維持する。
- `.npmrc` のセキュリティ設定（ignore-scripts=true）を維持・確認する。
