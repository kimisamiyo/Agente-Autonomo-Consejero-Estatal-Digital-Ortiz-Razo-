@echo off
chcp 65001 >nul
setlocal EnableExtensions
call "%~dp0_cedit_env.bat"
cd /d "%APP%"

"%FLY%" auth whoami >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Sin sesion Fly. Ejecute: scripts\7-CEDIT-Fly-Login.bat
  pause
  exit /b 1
)

echo.
echo  Despliegue API (cedit-api)
echo  ==========================
"%FLY%" launch --config fly.api.toml --copy-config --no-deploy
echo.
echo  Antes de deploy, configure secrets (pegue su .env):
echo    scripts\fly.cmd secrets set GROQ_API_KEY=... PINECONE_API_KEY=...
echo.
pause
"%FLY%" scale count 1 -a cedit-api -y 2>nul
"%FLY%" deploy --config fly.api.toml -a cedit-api
echo.
echo  Prueba: https://cedit-api.fly.dev/api/health
pause
endlocal
