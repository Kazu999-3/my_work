' Edge Worker Daemon - start in background without a console window.
' Double start is prevented by the lock file in start_all.ps1, so running this repeatedly is safe.
' Log: 03_SYSTEMS\logs\edge_worker.log
Option Explicit
Dim WshShell, fso, RootDir, LogFile, Cmd
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

RootDir = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
LogFile = RootDir & "\03_SYSTEMS\logs\edge_worker.log"
Cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & RootDir & "\start_all.ps1"" -LogFile """ & LogFile & """"

' 0 = hidden window / False = do not wait
WshShell.Run Cmd, 0, False
