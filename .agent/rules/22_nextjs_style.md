---
trigger: glob
globs: ["04_PORTAL/**/*.ts", "04_PORTAL/**/*.tsx"]
description: 04_PORTAL(Next.js)配下のTypeScript/TSXファイルを扱う際に適用する。
---

# Next.js (04_PORTAL) 規約

- **[重要]** Vercel等のデプロイ環境で `module-not-found` エラーを頻発させるため、Next.jsプロジェクトにおいて絶対パスエイリアス（`@/`）は絶対に一切使用しないこと。常に `../../` 等の相対パスを使用する。
