# Antigravity Sovereign OS: YouTube Watcher Task Registration
# This script registers youtube_playlist_watcher.py to run at logon.

$TaskName = "AntigravityYouTubeWatcher"
$PythonPath = "d:\my_work\.venv\Scripts\python.exe"
$ScriptPath = "d:\my_work\02_ENGINE\youtube_playlist_watcher.py"
$WorkingDirectory = "d:\my_work"

# Unregister existing task
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

# Define Action
$Action = New-ScheduledTaskAction -Execute $PythonPath -Argument $ScriptPath -WorkingDirectory $WorkingDirectory

# Define Trigger (At Logon)
$Trigger = New-ScheduledTaskTrigger -AtLogOn

# Define Settings
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

# Register Task
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Description "Antigravity OS: YouTube Playlist Watcher for automatic transcription and organization."

# Start Now
Start-ScheduledTask -TaskName $TaskName

Write-Host "[SUCCESS] Task '$TaskName' registered and started."
Write-Host "The watcher is running in the background and will scan playlists every 30 minutes."
