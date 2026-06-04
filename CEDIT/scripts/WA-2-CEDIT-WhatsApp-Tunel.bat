@echo off
chcp 65001 >nul
setlocal EnableExtensions

rem Túnel WhatsApp — tunnelmole → API local :8001
rem Requiere: 2-CEDIT-Levantar.bat (API activa). No abre Discord ni Web.

call "%~dp0_cedit_env.bat"

echo.
echo  CEDIT — WhatsApp tunel (tunnelmole)
echo  ====================================
echo  Requiere API en http://127.0.0.1:8001
echo  Si falla: 2-CEDIT-Levantar.bat y espere ~10 s
echo.
echo  Meta ^> Webhook:
echo    https://....tunnelmole.net/api/whatsapp/webhook
echo    Verify token: cedit_webhook_secret
echo    Campo: messages
echo.

where npx >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Instale Node.js LTS desde https://nodejs.org
  pause
  exit /b 1
)

set "HEALTH_OK=0"
for /L %%i in (1,1,6) do (
  curl -s -o nul -w "%%{http_code}" http://127.0.0.1:8001/api/health 2>nul | findstr /r "^200$" >nul && set "HEALTH_OK=1" && goto :health_done
  if %%i LSS 6 timeout /t 3 /nobreak >nul 2>nul
)
:health_done
if "%HEALTH_OK%"=="0" (
  echo [AVISO] La API no responde en :8001.
  echo         Ejecute 2-CEDIT-Levantar.bat y vuelva a lanzar este script.
  echo.
  choice /C SN /M "¿Abrir tunel de todos modos"
  if errorlevel 2 exit /b 1
)

echo Iniciando tunnelmole — deje esta ventana abierta...
echo.
npx --yes tunnelmole 8001
pause
endlocal
