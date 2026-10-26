' KTM Sovereign - LoL Match Watcher バックグラウンド起動スクリプト
' コマンドプロンプト画面を一切出さずに裏で静かに常駐させます。

Dim WshShell, fso
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' 作業ディレクトリをプロジェクトルート (d:\my_work) に設定
Dim scriptDir, baseDir
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
baseDir = fso.GetParentFolderName(scriptDir)
WshShell.CurrentDirectory = baseDir

' 0 = ウィンドウ完全非表示 (SW_HIDE), False = 完了を待たずに非同期常駐
WshShell.Run "cmd /c node scripts\ktm_match_watcher.mjs", 0, False
