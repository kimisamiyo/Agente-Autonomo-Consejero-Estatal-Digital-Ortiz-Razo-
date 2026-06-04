@echo off
chcp 65001 >nul
call "%~dp0_cedit_env.bat"
cd /d "%APP%"

echo.
echo  Fly login — se abrira el navegador
echo  ================================
"%FLY%" auth login
if errorlevel 1 (
  echo [ERROR] Login fallo.
  pause
  exit /b 1
)
"%FLY%" auth whoami
echo.
pause
