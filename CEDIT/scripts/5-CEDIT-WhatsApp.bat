@echo off
setlocal EnableExtensions
chcp 65001 >nul

REM Needs API up first: 2-CEDIT-Levantar.bat

call "%~dp0_cedit_env.bat"

echo.
echo  CEDIT - WhatsApp (local)
echo  ========================
echo  1) scripts\2-CEDIT-Levantar.bat   (API :8001)
echo  2) Este script / tunel si usa webhook
echo.
echo  Idioma en chat: IDIOMA ES / QU / AY
echo.

if exist "%APP%\whatsapp_bridge\server.js" (
  cd /d "%APP%\whatsapp_bridge"
  if not exist node_modules call npm install
  node server.js
) else if exist "%~dp0WA-2-CEDIT-WhatsApp-Tunel.bat" (
  echo No hay whatsapp_bridge local. Abriendo guia de tunel...
  call "%~dp0WA-2-CEDIT-WhatsApp-Tunel.bat"
) else (
  echo [AVISO] Configure WhatsApp segun docs o WA-2 tunnel.
  pause
)
endlocal
