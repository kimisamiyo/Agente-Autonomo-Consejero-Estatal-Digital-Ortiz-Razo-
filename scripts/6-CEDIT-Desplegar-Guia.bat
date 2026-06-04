@echo off
chcp 65001 >nul
set "DOC=%~dp0..\docs\DESPLIEGUE_GRATIS.md"
if exist "%DOC%" (
  start "" "%DOC%"
  echo.
  echo  Guia abierta: docs\DESPLIEGUE_GRATIS.md
  echo  Resumen: 1 Instalar, 2 Levantar, WA-2 WhatsApp local.
) else (
  echo [ERROR] No se encuentra %DOC%
)
echo.
pause
