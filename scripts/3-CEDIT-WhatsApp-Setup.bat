@echo off

chcp 65001 >nul

setlocal EnableExtensions



rem ============================================================

rem  WhatsApp CEDIT — Meta Cloud API (sin Cloudflare en la PC)

rem ============================================================



echo.

echo  CEDIT — WhatsApp (Meta Cloud API)

echo  ================================

echo.

echo  OPCION A — Prueba en su PC (sin instalar tunel permanente)

echo  ----------------------------------------------------------

echo  1. .env en CEDIT\:

echo       WHATSAPP_TOKEN=...

echo       WHATSAPP_PHONE_NUMBER_ID=1158293370698200

echo       WHATSAPP_VERIFY_TOKEN=cedit_webhook_secret

echo       WHATSAPP_API_VERSION=v25.0

echo.

echo  2. Levante API: scripts\2-CEDIT-Levantar-Todo.bat

echo.

echo  3. Otra ventana: scripts\4-CEDIT-WhatsApp-Tunel.bat

echo     (usa npx localtunnel — no instala nada en Windows)

echo.

echo  4. Meta ^> WhatsApp ^> Configuration ^> Webhook:

echo       https://SU-URL.loca.lt/api/whatsapp/webhook

echo       Verify token: cedit_webhook_secret

echo       Suscripcion: messages

echo.

echo  5. Meta ^> API Setup: agregue su celular (+51...) como prueba.

echo.

echo  6. Escriba al +1 555 199 1442: AYUDA

echo     Luego una consulta y espere ~1 minuto.

echo.

echo  OPCION B — Hackathon (PC apagada, URL fija, recomendado)

echo  --------------------------------------------------------

echo  1. Suba el repo a GitHub (sin .env).

echo  2. render.com ^> New Web Service ^> conecte el repo.

echo  3. Root: carpeta CEDIT

echo     Build:  pip install -r requirements.txt

echo     Start:  uvicorn api:app --host 0.0.0.0 --port 10000

echo  4. En Render ^> Environment: pegue las variables del .env

echo  5. Webhook Meta:

echo       https://SU-APP.onrender.com/api/whatsapp/webhook

echo.

echo  Comandos WhatsApp: AYUDA, METRICAS, FASE, EXPEDIENTE, PDF, REINICIAR

echo.

echo  Status local: http://127.0.0.1:8000/api/whatsapp/status

echo.

pause

endlocal

