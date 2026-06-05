@echo off
chcp 65001 >nul
setlocal EnableExtensions
call "%~dp0_cedit_env.bat"
cd /d "%APP%"

set "CEDIT_WEB_URL=https://cedit-web.pages.dev"

echo.
echo  CEDIT — Configurar web en Discord (Fly)
echo  URL: %CEDIT_WEB_URL%
echo.

"%FLY%" auth whoami >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Sin login Fly. Ejecute: 7-CEDIT-Fly-Login.bat
  pause
  exit /b 1
)

findstr /B /C:"CEDIT_WEB_URL=" "%APP%\.env" >nul 2>&1
if errorlevel 1 (
  echo CEDIT_WEB_URL=%CEDIT_WEB_URL%>> "%APP%\.env"
  echo [OK] Anadido a .env
) else (
  echo [OK] .env ya tiene CEDIT_WEB_URL (revise el valor)
)

"%FLY%" secrets set CEDIT_WEB_URL=%CEDIT_WEB_URL% -a cedit-bots
if errorlevel 1 goto :fail

"%FLY%" deploy --config fly.bots.toml -a cedit-bots
if errorlevel 1 (
  echo [AVISO] Deploy fallo; intentando solo reinicio...
  "%FLY%" apps restart cedit-bots
)

echo.
echo  LISTO. En Discord: /ayuda -^> Redes
echo  Web: %CEDIT_WEB_URL%
echo.
pause
exit /b 0

:fail
echo [ERROR] Revisar mensaje arriba.
pause
exit /b 1
