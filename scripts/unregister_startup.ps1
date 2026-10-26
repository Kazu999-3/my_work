# KTM Sovereign - スタートアップ自動起動 解除スクリプト

$startupDir = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupDir "KTM_Match_Watcher.lnk"

if (Test-Path $shortcutPath) {
    Remove-Item -Path $shortcutPath -Force
    Write-Host "✅ スタートアップ登録を解除しました: $shortcutPath" -ForegroundColor Yellow
} else {
    Write-Host "ℹ️ スタートアップ登録は見つかりませんでした。"
}
