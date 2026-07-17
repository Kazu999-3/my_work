@echo off
title KTM Portal Deploy
echo ============================================
echo   KTM Portal Deploy  (build then git push)
echo ============================================
echo.
cd /d D:\my_work\04_PORTAL
echo [1/2] Building... (please wait)
call npm run build
if %errorlevel% neq 0 (
  echo.
  echo ============================================
  echo   [ERROR] Build failed.
  echo   Copy the red error above and send it to Claude.
  echo ============================================
  pause
  exit /b 1
)
echo.
echo [2/2] Pushing to GitHub...
cd /d D:\my_work
git push
if %errorlevel% neq 0 (
  echo.
  echo ============================================
  echo   [ERROR] git push failed. Send the output to Claude.
  echo ============================================
  pause
  exit /b 1
)
echo.
echo ============================================
echo   [OK] Done!
echo   Portal: Vercel auto-deploys in 1-2 min.
echo   Bot: auto-deploys via GitHub Actions.
echo ============================================
pause
