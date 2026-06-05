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
echo  CEDIT — Redeploy API (2 GB, puerto 8080, chat en hilos)
echo  =====================================================
echo  Si su app en Fly tiene otro nombre, edite fly.api.toml
echo  o use: fly deploy -a SU_APP --config fly.api.toml
echo.
pause

"%FLY%" scale count 1 -a cedit-api -y 2>nul
"%FLY%" deploy --config fly.api.toml -a cedit-api
if errorlevel 1 goto :fail

echo.
echo  Prueba: https://cedit-api.fly.dev/api/health
echo  Logs:  fly logs -a cedit-api
echo.
pause
exit /b 0

:fail
echo [ERROR] Si la app no se llama cedit-api, mire: fly apps list
pause
exit /b 1
