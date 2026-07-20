@echo off
setlocal EnableExtensions
chcp 65001 >nul

call "%~dp0_cedit_env.bat"

if not exist "%PY%" (
  echo [ERROR] Ejecute primero: scripts\1-CEDIT-Instalar.bat
  pause
  exit /b 1
)

"%PY%" -c "import telegram" 2>nul
if errorlevel 1 (
  "%PIP%" install python-telegram-bot -q
)

echo.
echo  CEDIT - Telegram (local)
echo  ========================
echo  Token: TELEGRAM_BOT_TOKEN en .env
echo  Idioma: IDIOMA ES  /  IDIOMA QU  /  IDIOMA AY
echo.

cd /d "%APP%"
"%PY%" telegram_bot.py
pause
endlocal
