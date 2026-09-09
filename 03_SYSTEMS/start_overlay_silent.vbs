' Sovereign HUD - サイレントバックグラウンド起動ランチャー (VBScript)
' 黒いコマンドプロンプト画面を一切出さずにバックグラウンドで常駐起動します。

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' スクリプトのあるディレクトリを特定
ScriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
BaseDir = fso.GetParentFolderName(ScriptDir)

' 安定性の高い .venv\Scripts\python.exe を使用 (0 = vbHide で黒画面を完全非表示)
PythonExe = BaseDir & "\.venv\Scripts\python.exe"
If Not fso.FileExists(PythonExe) Then
    PythonExe = "python.exe"
End If

OverlayScript = ScriptDir & "\v2_CORE\_LOL\overlay\run_overlay.py"

' カレントディレクトリをプロジェクトルートに設定
WshShell.CurrentDirectory = BaseDir

' ウィンドウを完全に非表示 (0 = vbHide) で実行
WshShell.Run """" & PythonExe & """ """ & OverlayScript & """", 0, False
