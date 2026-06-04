@echo off
chcp 65001 >nul
setlocal EnableExtensions

rem Requiere API en puerto 8000 (scripts\2-CEDIT-Levantar-Todo.bat o uvicorn).
rem Meta debe apuntar a: https://SU-URL.tunnelmole.net/api/whatsapp/webhook

set "SCRIPTS=%~dp0"
set "APP=%SCRIPTS%.."
set "ROOT=%APP%\.."

echo.
echo  CEDIT — Levantar túnel WhatsApp (tunnelmole)
echo  ==============================================
echo  API local: http://127.0.0.1:8000
echo  Verify token en Meta: cedit_webhook_secret
echo  Campo suscripción: messages
echo.

where npx >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Instale Node.js desde https://nodejs.org
  pause
  exit /b 1
)

curl -s -o nul -w "%%{http_code}" http://127.0.0.1:8000/api/health 2>nul | findstr /r "^200$" >nul
if errorlevel 1 (
  echo [AVISO] La API no responde en :8000. Ejecute primero 2-CEDIT-Levantar-Todo.bat
  echo.
)

echo Iniciando tunnelmole (deje esta ventana abierta)...
echo Copie la URL https://....tunnelmole.net en Meta ^> WhatsApp ^> Configuration
echo.
npx --yes tunnelmole 8000

pause
endlocal
