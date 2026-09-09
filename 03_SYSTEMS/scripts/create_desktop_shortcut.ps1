$desktop = [System.Environment]::GetFolderPath('Desktop')
$batPath = "D:\my_work\03_SYSTEMS\start_overlay.bat"
$shortcutPath = Join-Path $desktop "👑 Sovereign HUD (LoLオーバーレイ起動).lnk"

$ws = New-Object -ComObject WScript.Shell
$s = $ws.CreateShortcut($shortcutPath)
$s.TargetPath = $batPath
$s.WorkingDirectory = "D:\my_work\03_SYSTEMS"
$s.Description = "Sovereign HUD LoL Overlay Launcher"
$s.Save()

Write-Host "Created shortcut: $shortcutPath"
