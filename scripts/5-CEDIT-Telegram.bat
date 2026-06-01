@echo off
chcp 65001 >nul
setlocal EnableExtensions

rem ============================================================
rem  PASO 5 — Bot Telegram (long polling, sin túnel)
rem  Requiere TELEGRAM_BOT_TOKEN en CEDIT\.env
rem ============================================================

set "SCRIPTS=%~dp0"
set "APP=%SCRIPTS%.."
set "ROOT=%APP%\.."
set "PY=%ROOT%\venv\Scripts\python.exe"

if not exist "%PY%" (
  echo.
  echo [ERROR] No hay venv. Ejecute: scripts\1-CEDIT-Instalar.bat
  echo.
  pause
  exit /b 1
)

"%PY%" -c "import telegram" 2>nul
if errorlevel 1 (
  echo.
  echo Instalando python-telegram-bot...
  "%PY%" -m pip install python-telegram-bot -q
)

if not exist "%APP%\.env" (
  echo.
  echo [AVISO] Cree %APP%\.env con TELEGRAM_BOT_TOKEN=...
  echo Token: Telegram @BotFather -^> /newbot
  echo.
)

echo.
echo  [5] CEDIT — Bot Telegram
echo  ========================
echo  Token en .env: TELEGRAM_BOT_TOKEN
echo  Sin ngrok: el bot sale a buscar mensajes (polling).
echo  En Telegram: busque su bot y escriba /start
echo.

cd /d "%APP%"
"%PY%" telegram_bot.py
pause
endlocal
