$desktop = [System.Environment]::GetFolderPath('Desktop')

# 古い文字化けショートカットがあれば削除
Get-ChildItem -Path $desktop -Filter "*Sovereign*" | Remove-Item -Force -ErrorAction SilentlyContinue

$batPath = "D:\my_work\03_SYSTEMS\start_overlay.bat"
$shortcutPath = Join-Path $desktop "Sovereign HUD (LoL Overlay).lnk"

$ws = New-Object -ComObject WScript.Shell
$s = $ws.CreateShortcut($shortcutPath)
$s.TargetPath = $batPath
$s.WorkingDirectory = "D:\my_work\03_SYSTEMS"
$s.Description = "Sovereign HUD LoL Overlay Launcher"
$s.Save()

Write-Host "Re-created clean shortcut: $shortcutPath"
