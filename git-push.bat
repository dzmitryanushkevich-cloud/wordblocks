@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

where git >nul 2>nul
if errorlevel 1 (
  echo Git is not installed. Run git-init.bat first.
  pause
  exit /b 1
)
if not exist .git (
  echo No repository here yet. Run git-init.bat first.
  pause
  exit /b 1
)

git remote get-url origin >nul 2>nul
if errorlevel 1 (
  echo.
  echo No remote yet. Create an EMPTY repo on github.com and paste its URL below.
  echo Example: https://github.com/yourname/wordblocks.git
  set /p REMOTE="Repository URL: "
  git remote add origin "!REMOTE!"
)

set MSG=
set /p MSG="Commit message (Enter for default): "
if "!MSG!"=="" set MSG=Update WordBlocks

git add -A
git commit -m "!MSG!" || echo Nothing to commit.
git push -u origin main
echo.
git log --oneline -n 5
echo.
pause
