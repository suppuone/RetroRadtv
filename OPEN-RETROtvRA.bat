@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  start "RetroRadtv v2 Preview Server" /min cmd /c "py -3 -m http.server 8782 --bind 127.0.0.1"
) else (
  start "RetroRadtv v2 Preview Server" /min cmd /c "python -m http.server 8782 --bind 127.0.0.1"
)
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8782/"
