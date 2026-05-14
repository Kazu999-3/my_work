# Antigravity Sovereign OS: タスクスケジューラ登録スクリプト
# このスクリプトは、autonomous_kingdom.py を毎日午前0時に自動実行するように登録します。

$TaskName = "AntigravityAutonomousKingdom"
$PythonPath = "d:\my_work\.venv\Scripts\python.exe"
$ScriptPath = "d:\my_work\02_ENGINE\autonomous_kingdom.py"
$WorkingDirectory = "d:\my_work"

# 既存のタスクがあれば削除（更新のため）
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

# アクションの定義
$Action = New-ScheduledTaskAction -Execute $PythonPath -Argument $ScriptPath -WorkingDirectory $WorkingDirectory

# トリガーの定義 (毎日 午前 0:00)
$Trigger = New-ScheduledTaskTrigger -Daily -At 12am

# 設定の定義 (バッテリー駆動時も実行、最長実行時間など)
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

# タスクの登録
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Description "Antigravity OS: トレンド検知から記事作成までを全自動で行う自律循環サイクル"

Write-Host "✅ タスク '$TaskName' を Windows タスクスケジューラに登録しました。"
Write-Host "📅 毎日 午前 0:00 に実行されます。"
