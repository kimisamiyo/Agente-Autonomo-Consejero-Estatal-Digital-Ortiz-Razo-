@echo off
chcp 65001 >nul
setlocal EnableExtensions
call "%~dp0_cedit_env.bat"
cd /d "%APP%"

"%FLY%" auth whoami >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Sin login Fly. Ejecute: 7-CEDIT-Fly-Login.bat
  pause
  exit /b 1
)

echo.
echo  CEDIT — Solo redeploy bots (Discord + Telegram)
echo  ================================================
echo  - 1 maquina (evita dos bots con el mismo token)
echo  - 2 GB RAM (evita OOM al cargar embeddings)
echo  - Solo Discord en Fly (Telegram: 3-CEDIT-Telegram.bat en PC)
echo.
echo  Si tiene la web en Cloudflare, en .env agregue:
echo    CEDIT_WEB_URL=https://su-proyecto.pages.dev
echo.
pause

for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%APP%\.env") do (
  set "%%A=%%B"
)

if defined CEDIT_WEB_URL (
  echo [secrets] CEDIT_WEB_URL configurado
  "%FLY%" secrets set CEDIT_WEB_URL=%CEDIT_WEB_URL% -a cedit-bots
)

"%FLY%" scale count 1 -a cedit-bots -y
"%FLY%" deploy --config fly.bots.toml -a cedit-bots
if errorlevel 1 (
  echo [ERROR] Deploy fallo. Ver: fly logs -a cedit-bots
  pause
  exit /b 1
)

echo.
echo  LISTO. Pruebe /ayuda en Discord en ~1 minuto.
echo  Logs: fly logs -a cedit-bots
echo.
pause
