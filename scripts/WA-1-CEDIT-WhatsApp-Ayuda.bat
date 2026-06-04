@echo off
chcp 65001 >nul
setlocal EnableExtensions

call "%~dp0_cedit_env.bat"

echo.
echo  CEDIT — WhatsApp (guia, aparte del nucleo)
echo  ==========================================
echo.
echo  ORDEN:
echo    1) scripts\1-CEDIT-Instalar.bat
echo    2) scripts\2-CEDIT-Levantar.bat   (API en :8001)
echo    3) scripts\WA-2-CEDIT-WhatsApp-Tunel.bat
echo.
echo  .env en %APP%:
echo    WHATSAPP_TOKEN=...
echo    WHATSAPP_PHONE_NUMBER_ID=...
echo    WHATSAPP_VERIFY_TOKEN=cedit_webhook_secret
echo    WHATSAPP_API_VERSION=v25.0
echo.
echo  Meta ^> WhatsApp ^> Configuration ^> Webhook:
echo    https://SU-URL.tunnelmole.net/api/whatsapp/webhook
echo    Verify token: cedit_webhook_secret
echo    Campo: messages
echo.
echo  Meta ^> API Setup: agregue su celular (+51...) como numero de prueba.
echo  Escriba al numero de prueba de Meta: AYUDA
echo.
echo  Status local: http://127.0.0.1:8001/api/whatsapp/status
echo  Comandos: AYUDA, METRICAS, FASE, EXPEDIENTE, PDF, REINICIAR
echo.
pause
endlocal
