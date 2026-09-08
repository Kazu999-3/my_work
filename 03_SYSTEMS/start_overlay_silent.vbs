' Sovereign HUD - サイレントバックグラウンド起動ランチャー (VBScript)
' 黒いコマンドプロンプト画面を一切出さずにバックグラウンドで常駐起動します。

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' スクリプトのあるディレクトリを特定
ScriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
BaseDir = fso.GetParentFolderName(ScriptDir)

VenvPython = BaseDir & "\.venv\Scripts\pythonw.exe"
If Not fso.FileExists(VenvPython) Then
    VenvPython = BaseDir & "\.venv\Scripts\python.exe"
End If
If Not fso.FileExists(VenvPython) Then
    VenvPython = "pythonw.exe"
End If

OverlayScript = ScriptDir & "\v2_CORE\_LOL\overlay\run_overlay.py"

' ウィンドウを完全に非表示 (0 = vbHide) で実行
WshShell.Run """" & VenvPython & """ """ & OverlayScript & """", 0, False
