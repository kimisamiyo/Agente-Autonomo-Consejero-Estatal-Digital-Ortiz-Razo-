@echo off
setlocal EnableExtensions
chcp 65001 >nul

call "%~dp0_cedit_env.bat"

if not exist "%PY%" (
  echo [ERROR] Ejecute primero: scripts\1-CEDIT-Instalar.bat
  pause
  exit /b 1
)

echo.
echo  CEDIT - Discord (local)
echo  =======================
echo  Token: DISCORD_TOKEN en .env
echo  Idioma: /idioma  o  escriba IDIOMA ES / QU / AY en el chat
echo.

cd /d "%APP%"
"%PY%" bot.py
pause
endlocal
