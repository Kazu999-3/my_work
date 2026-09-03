# Sovereign HUD Overlay Launcher (PowerShell)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$VenvPython = Join-Path (Split-Path -Parent $ScriptDir) ".venv\Scripts\python.exe"

if (-not (Test-Path $VenvPython)) {
    $VenvPython = "python"
}

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  👑 Sovereign HUD Overlay を起動します..." -ForegroundColor Yellow
Write-Host "=============================================" -ForegroundColor Cyan

& $VenvPython "$ScriptDir\v2_CORE\_LOL\overlay\run_overlay.py" $args
