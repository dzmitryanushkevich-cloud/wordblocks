@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

where git >nul 2>nul
if errorlevel 1 (
  echo.
  echo Git is not installed.
  echo Install it with:  winget install --id Git.Git -e
  echo Then run this file again.
  echo.
  pause
  exit /b 1
)

for /f "delims=" %%i in (git config --get user.email) do set EMAIL=%%i
if "!EMAIL!"=="" (
  set /p EMAIL="Email for commits: "
  set /p UNAME="Name for commits: "
  git config --global user.email "!EMAIL!"
  git config --global user.name "!UNAME!"
)

if exist .git (
  echo Repository already exists here.
) else (
  git init -b main
)

git add -A
git commit -m "WordBlocks: word puzzle prototype" || echo Nothing to commit.
echo.
git log --oneline -n 5
git status --short
echo.
pause
