@echo off
echo Registering sovereign-worker:// URI protocol with .venv python...
powershell -Command "New-Item -Path 'HKCU:\Software\Classes\sovereign-worker' -Force | Out-Null; Set-ItemProperty -Path 'HKCU:\Software\Classes\sovereign-worker' -Name '(default)' -Value 'URL:Sovereign Worker Protocol'; Set-ItemProperty -Path 'HKCU:\Software\Classes\sovereign-worker' -Name 'URL Protocol' -Value ''; New-Item -Path 'HKCU:\Software\Classes\sovereign-worker\shell\open\command' -Force | Out-Null; Set-ItemProperty -Path 'HKCU:\Software\Classes\sovereign-worker\shell\open\command' -Name '(default)' -Value 'cmd.exe /c start \"\" \"d:\my_work\.venv\Scripts\python.exe\" \"d:\my_work\03_SYSTEMS\v2_CORE\edge_worker_daemon.py\"'"
echo Protocol registered successfully.
