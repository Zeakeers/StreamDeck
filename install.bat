@echo off
setlocal
cd /d "%~dp0"

where npm >nul 2>&1
if %errorlevel% neq 0 (
  echo [ERROR] npm is not installed or not in PATH. Install Node.js first: https://nodejs.org
  pause
  exit /b 1
)

if not defined STREAMDECK_SERVER set "STREAMDECK_SERVER=http://localhost:3000"

set "SERVER_URL=%~1"
if "%SERVER_URL%"=="" (
  set /p "SERVER_URL=Enter StreamDeck Server URL [%STREAMDECK_SERVER%]: "
)
if "%SERVER_URL%"=="" (
  set "SERVER_URL=%STREAMDECK_SERVER%"
)

echo Target Server URL: %SERVER_URL%

echo Installing dependencies...
call npm install
if %errorlevel% neq 0 (
  echo [ERROR] npm install failed.
  pause
  exit /b %errorlevel%
)

echo Linking global commands...
call npm link
if %errorlevel% neq 0 (
  echo [ERROR] npm link failed. Try running terminal as Administrator.
  pause
  exit /b %errorlevel%
)

echo.
echo Pre-syncing media assets from server (%SERVER_URL%)...
call node "%~dp0bin\player.js" "%SERVER_URL%" --sync-only

:: Create background runner script in project folder (inactive)
set "VBS_FILE=%~dp0start-player.vbs"
(
echo Set WshShell = CreateObject("WScript.Shell"^)
echo WshShell.Run "powershell -NoProfile -Command ""Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*bin\player.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }""", 0, True
echo WshShell.Run "node ""%~dp0bin\player.js"" ""%SERVER_URL%""", 0, False
) > "%VBS_FILE%"

:: Create background stopper script in project folder
set "STOP_BAT=%~dp0stop-player.bat"
(
echo @echo off
echo echo Stopping background StreamDeck player...
echo powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*bin\player.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
echo echo Background player stopped.
echo timeout /t 2 ^>nul
) > "%STOP_BAT%"

echo.
echo ==================================================
echo  Installation Complete
echo  Global commands: 'streamdeck' and 'streamdeck-player'
echo ==================================================
echo How to use local audio player on Windows:
echo.
echo 1. Run in foreground (terminal):
echo    streamdeck-player
echo    (or with custom URL: streamdeck-player http://ip:port)
echo.
echo 2. Run silently in background (no console window):
echo    Double-click 'start-player.vbs' in this folder
echo.
echo 3. Stop background player:
echo    Double-click 'stop-player.bat' in this folder
echo.
echo 4. Enable auto-start on boot (optional):
echo    Press Win+R, type 'shell:startup', copy 'start-player.vbs' there
echo ==================================================
pause
