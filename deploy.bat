@echo off
title KTM Portal Deploy
echo ============================================
echo   KTM Portal Deploy  (build, commit, push)
echo ============================================
echo.
cd /d D:\my_work\04_PORTAL
echo [1/3] Building... (please wait)
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
echo [2/3] Committing any uncommitted changes...
cd /d D:\my_work
REM Stage everything, including new files created by other tools/AIs.
git add -A
REM Commit only if there is something staged. "git diff --cached --quiet"
REM returns 1 when there ARE staged changes; in that case we commit.
git diff --cached --quiet
if %errorlevel% neq 0 (
  git commit -m "chore(deploy): commit local changes before push"
  echo   Committed local changes.
) else (
  echo   Nothing new to commit.
)
echo.
echo [3/3] Pushing to GitHub...
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
