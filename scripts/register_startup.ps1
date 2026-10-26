$ErrorActionPreference = "Stop"

$startupDir = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupDir "KTM_Match_Watcher.lnk"

$workDir = "d:\my_work"
$vbsPath = Join-Path $workDir "scripts\run_match_watcher_silent.vbs"
$nodePath = "C:\Program Files\nodejs\node.exe"

$wshShell = New-Object -ComObject WScript.Shell
$shortcut = $wshShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "wscript.exe"
$shortcut.Arguments = '"' + $vbsPath + '"'
$shortcut.WorkingDirectory = $workDir
$shortcut.Description = "KTM Sovereign - LoL Match Watcher (Background)"
if (Test-Path $nodePath) {
    $shortcut.IconLocation = "$nodePath,0"
}
$shortcut.Save()

Write-Host "Startup shortcut created successfully: $shortcutPath"
