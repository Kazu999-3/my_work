' 👑 Sovereign OS - 統合スーパーバイザー バックグラウンドサイレント起動スクリプト
Dim WshShell, fso
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

Dim scriptDir, baseDir
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
baseDir = fso.GetParentFolderName(scriptDir)
WshShell.CurrentDirectory = baseDir

' pythonw.exe でコマンド画面を完全非表示(SW_HIDE=0)で非同期起動
WshShell.Run """d:\my_work\.venv\Scripts\pythonw.exe"" ""d:\my_work\scripts\sovereign_supervisor.py""", 0, False

