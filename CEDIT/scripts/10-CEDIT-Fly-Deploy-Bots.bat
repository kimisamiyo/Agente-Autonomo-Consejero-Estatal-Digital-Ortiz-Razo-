@echo off
chcp 65001 >nul
setlocal EnableExtensions
call "%~dp0_cedit_env.bat"
cd /d "%APP%"

if not exist "%APP%\.env" (
  echo [ERROR] Falta %APP%\.env
  pause
  exit /b 1
)

"%FLY%" auth whoami >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Sin login Fly. Ejecute: 7-CEDIT-Fly-Login.bat
  pause
  exit /b 1
)

echo.
echo  CEDIT — Despliegue BOTS (Discord + Telegram)
echo  ============================================
echo  IMPORTANTE: Cierre bot.py y telegram_bot.py en su PC
echo  (solo puede haber UNA instancia de cada bot).
echo.
echo  API debe estar OK: https://cedit-api.fly.dev/api/health
echo.
pause

for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%APP%\.env") do (
  set "%%A=%%B"
)

echo [1/4] Crear app cedit-bots (si no existe)...
"%FLY%" apps create cedit-bots 2>nul
"%FLY%" launch --config fly.bots.toml --copy-config --no-deploy --yes --name cedit-bots --region iad -a cedit-bots 2>nul

echo [2/4] Secretos bots...
"%FLY%" secrets set -a cedit-bots ^
  DISCORD_TOKEN=%DISCORD_TOKEN% ^
  TELEGRAM_BOT_TOKEN=%TELEGRAM_BOT_TOKEN% ^
  GROQ_API_KEY=%GROQ_API_KEY% ^
  PINECONE_API_KEY=%PINECONE_API_KEY% ^
  GROQ_MODEL=%GROQ_MODEL% ^
  GROQ_MODEL_FALLBACK=%GROQ_MODEL_FALLBACK%

echo [3/4] Deploy bots (build largo, ~15-30 min la 1ra vez)...
"%FLY%" deploy --config fly.bots.toml -a cedit-bots
if errorlevel 1 goto :fail

echo [4/4] Logs en vivo (Ctrl+C para salir, los bots siguen en Fly)...
"%FLY%" logs -a cedit-bots

echo.
echo  LISTO — Pruebe Discord !AYUDA y Telegram /start
echo  Logs: scripts\fly.cmd logs -a cedit-bots
echo.
pause
exit /b 0

:fail
echo.
echo [ERROR] Revise el mensaje arriba.
echo   scripts\fly.cmd logs -a cedit-bots
pause
exit /b 1
