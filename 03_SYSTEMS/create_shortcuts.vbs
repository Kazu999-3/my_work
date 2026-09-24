' Sovereign HUD - Shortcut Generator (VBScript)
Option Explicit
Dim WshShell, fso, ScriptDir, DesktopDir, StartupDir, s1, s2, s3, s4
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

ScriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
DesktopDir = WshShell.SpecialFolders("Desktop")
StartupDir = WshShell.ExpandEnvironmentStrings("%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup")

Set s1 = WshShell.CreateShortcut(DesktopDir & "\Sovereign HUD (Start).lnk")
s1.TargetPath = ScriptDir & "\start_overlay.bat"
s1.WorkingDirectory = ScriptDir
s1.WindowStyle = 7
s1.Description = "Sovereign HUD Overlay (Start)"
s1.Save

Set s2 = WshShell.CreateShortcut(DesktopDir & "\Sovereign HUD (Stop).lnk")
s2.TargetPath = ScriptDir & "\stop_overlay.bat"
s2.WorkingDirectory = ScriptDir
s2.WindowStyle = 7
s2.Description = "Sovereign HUD Overlay (Stop)"
s2.Save

Set s4 = WshShell.CreateShortcut(DesktopDir & "\Sovereign HUD (Demo).lnk")
s4.TargetPath = ScriptDir & "\v2_CORE\_LOL\overlay\run_demo.bat"
s4.WorkingDirectory = ScriptDir & "\v2_CORE\_LOL\overlay"
s4.WindowStyle = 1
s4.Description = "Sovereign HUD Overlay (Live Demo Mode)"
s4.Save

If fso.FolderExists(StartupDir) Then
    Set s3 = WshShell.CreateShortcut(StartupDir & "\Sovereign_HUD_Overlay.lnk")
    s3.TargetPath = ScriptDir & "\start_overlay.bat"
    s3.WorkingDirectory = ScriptDir
    s3.WindowStyle = 7
    s3.Description = "Sovereign HUD LoL Overlay Auto-Launcher"
    s3.Save
End If

WScript.Echo "SUCCESS"
