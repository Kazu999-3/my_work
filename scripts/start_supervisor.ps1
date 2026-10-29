$cmd = "d:\my_work\.venv\Scripts\pythonw.exe d:\my_work\scripts\sovereign_supervisor.py"
$res = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{CommandLine = $cmd; CurrentDirectory = "d:\my_work"}
if ($res.ReturnValue -eq 0) {
    Write-Output "Sovereign Supervisor started (PID: $($res.ProcessId))"
} else {
    Write-Error "Failed to start supervisor: ReturnValue $($res.ReturnValue)"
}
