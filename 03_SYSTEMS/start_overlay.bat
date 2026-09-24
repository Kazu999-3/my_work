@echo off
setlocal
cd /d "%~dp0"

for %%I in ("%~dp0..\.venv\Scripts\pythonw.exe") do set "PYTHONW_EXE=%%~fI"
for %%I in ("%~dp0..\.venv\Scripts\python.exe") do set "PYTHON_EXE=%%~fI"
for %%I in ("%~dp0v2_CORE\_LOL\overlay\run_overlay.py") do set "OVERLAY_SCRIPT=%%~fI"

if not exist "%PYTHONW_EXE%" (
    set "PYTHONW_EXE=pythonw.exe"
)
if not exist "%PYTHON_EXE%" (
    set "PYTHON_EXE=python.exe"
)

if not "%~1"=="" (
    echo ===================================================
    echo Sovereign HUD - Dev/Debug Mode [%*]
    echo ===================================================
    "%PYTHON_EXE%" "%OVERLAY_SCRIPT%" %*
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Process exited with code: %ERRORLEVEL%
        pause
    )
    exit /b 0
)

start "" "%PYTHONW_EXE%" "%OVERLAY_SCRIPT%"
exit /b 0
