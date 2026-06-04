@echo off
chcp 65001 >nul
setlocal EnableExtensions

rem Bot Telegram solo (requiere paso 1 y API opcional en :8001)

call "%~dp0_cedit_env.bat"

if not exist "%PY%" (
  echo [ERROR] Ejecute primero: scripts\1-CEDIT-Instalar.bat
  pause
  exit /b 1
)

"%PY%" -c "import telegram" 2>nul
if errorlevel 1 (
  echo Instalando python-telegram-bot...
  "%PIP%" install python-telegram-bot -q
)

if not exist "%APP%\.env" (
  echo [AVISO] Cree %APP%\.env con TELEGRAM_BOT_TOKEN=...
  pause
  exit /b 1
)

echo.
echo  CEDIT — Telegram (solo)
echo  =======================
echo  Token: TELEGRAM_BOT_TOKEN en .env
echo  En Telegram: /start o AYUDA
echo.

cd /d "%APP%"
"%PY%" telegram_bot.py
pause
endlocal
