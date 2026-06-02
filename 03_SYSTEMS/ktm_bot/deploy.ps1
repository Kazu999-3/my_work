# KTM Sovereign OS: Unified Deployment Script
Write-Host "[*] Starting KTM Unified Deployment..." -ForegroundColor Cyan

$CurrentDir = Get-Location

# 1. GAS (Google Apps Script) Deployment
Write-Host "[1/2] Synchronizing GAS code..." -ForegroundColor Yellow
Set-Location -Path "$CurrentDir\gas"
npx @google/clasp push
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] GAS synchronization failed. Aborting." -ForegroundColor Red
    Set-Location -Path $CurrentDir
    exit 1
}

# 2. Cloudflare Workers Deployment
Write-Host "[2/2] Deploying Cloudflare Workers..." -ForegroundColor Yellow
Set-Location -Path $CurrentDir
npm run deploy
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Workers deployment failed." -ForegroundColor Red
    exit 1
}

Write-Host "[SUCCESS] Bot deployment complete for all environments!" -ForegroundColor Green
