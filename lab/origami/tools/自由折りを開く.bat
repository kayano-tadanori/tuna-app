@echo off
rem Freefold entry: starts (or reuses) a no-cache local server for this folder and opens the page.
rem If Python is not available, opens the page as file:// (it works the same way).
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  start "" "%~dp0freefold3d.html"
  exit /b 0
)
title freefold server - close this window to stop
python "%~dp0serve_freefold.py"
if errorlevel 1 start "" "%~dp0freefold3d.html"
