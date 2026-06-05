@echo off
chcp 65001 >nul
set "DOC=%~dp0..\docs\DESPLIEGUE_GRATIS.md"
if exist "%DOC%" (
  start "" "%DOC%"
  echo.
  echo  Guia abierta: docs\DESPLIEGUE_GRATIS.md
  echo  Guia: Parte A local, Parte B Fly+Cloudflare, Parte C WhatsApp.
) else (
  echo [ERROR] No se encuentra %DOC%
)
echo.
pause
