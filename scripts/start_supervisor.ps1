$cmd = "d:\my_work\.venv\Scripts\pythonw.exe"
$args = "d:\my_work\scripts\sovereign_supervisor.py"

$started = $false
try {
    $res = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{CommandLine = "$cmd $args"; CurrentDirectory = "d:\my_work"} -ErrorAction Stop
    if ($res.ReturnValue -eq 0) {
        Write-Output "Sovereign Supervisor started via CIM (PID: $($res.ProcessId))"
        $started = $true
    }
} catch {
    # サンドボックス等でWMI/CIMがブロックされた場合はStart-Processにフォールバック
}

if (-not $started) {
    $proc = Start-Process -FilePath $cmd -ArgumentList $args -WorkingDirectory "d:\my_work" -PassThru
    if ($proc) {
        Write-Output "Sovereign Supervisor started via Start-Process (PID: $($proc.Id))"
    } else {
        Write-Error "Failed to start supervisor"
    }
}
