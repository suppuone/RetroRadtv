@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 (
  py open_demo.py
) else (
  python open_demo.py
)
if errorlevel 1 pause
endlocal
