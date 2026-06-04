@echo off
chcp 65001 >nul
setlocal EnableExtensions

rem n8n solo — flujos CEDIT-01 / CEDIT-02 en Active

echo.
echo  CEDIT — n8n (solo)
echo  ==================
echo  URL: http://127.0.0.1:5678
echo  Active (verde): CEDIT-02 luego CEDIT-01
echo.

where n8n >nul 2>&1
if errorlevel 1 (
  echo [ERROR] n8n no instalado. Ejecute: npm install -g n8n
  pause
  exit /b 1
)

start "4-CEDIT-n8n-5678" cmd /k "title 4-CEDIT-n8n && n8n"
echo Ventana n8n abierta.
pause
endlocal
