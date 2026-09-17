@echo off
cd /d "%~dp0"
where claude >/dev/null 2>nul
if errorlevel 1 (
  echo.
  echo Claude Code is not installed yet.
  echo Open PowerShell and run:  irm https://claude.ai/install.ps1 ^| iex
  echo Then run this file again.
  echo.
  pause
  exit /b 1
)
claude
