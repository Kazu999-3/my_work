---
trigger: glob
globs: ["**/*.ps1"]
description: PowerShell スクリプトの作成や実行、セキュリティスキャンを行う際に適用する。
---

# PowerShell 規約

- セキュリティ監査（`security_scan.ps1`）の実行時は、エラー内容を詳細に報告する。
- スクリプト実行時は、必要に応じて適切な実行ポリシー（ExecutionPolicy Bypass 等）を検討する。
- 実行後のリターンコードを確認し、正常終了を保証する。
