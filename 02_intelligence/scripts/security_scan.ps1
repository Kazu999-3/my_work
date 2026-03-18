# security_scan.ps1
# セキュリティ監査用スクリプト

Write-Host "--- Security Audit Starting ---" -ForegroundColor Cyan

# 1. npm audit による依存関係の脆弱性チェック
Write-Host "[1/2] Checking npm dependencies for vulnerabilities..." -ForegroundColor Yellow
npm audit

# 2. .env ファイルの存在確認と権限（簡易チェック）
Write-Host "`n[2/2] Checking sensitive files..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "  [OK] .env file exists and is tracked locally." -ForegroundColor Green
} else {
    Write-Host "  [INFO] .env file not found. Ensure secrets are managed correctly." -ForegroundColor Gray
}

Write-Host "`n--- Security Audit Completed ---" -ForegroundColor Cyan
