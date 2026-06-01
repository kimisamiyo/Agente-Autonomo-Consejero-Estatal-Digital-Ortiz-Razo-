@echo off
chcp 65001 >nul
setlocal EnableExtensions

rem ============================================================
rem  Túnel WhatsApp — tunnelmole (Meta SÍ puede verificar)
rem  No instala nada permanente. Solo npx + Node.js.
rem  NO usar localtunnel ni ngrok gratis para Meta webhook.
rem ============================================================

echo.
echo  CEDIT — Túnel WhatsApp (tunnelmole)
echo  ===================================
echo.
echo  ANTES: API en http://127.0.0.1:8000
echo.
echo  Cuando aparezca la URL https://....tunnelmole.net
echo  pegue en Meta ^> WhatsApp ^> Configuration:
echo.
echo    https://SU-URL.tunnelmole.net/api/whatsapp/webhook
echo    Verify token: cedit_webhook_secret
echo    Campo: messages
echo.
pause

where npx >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Falta Node.js. Instale desde nodejs.org
  pause
  exit /b 1
)

echo Iniciando tunnelmole en puerto 8000...
npx --yes tunnelmole 8000

pause
endlocal
