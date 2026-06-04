@echo off
chcp 65001 >nul
setlocal EnableExtensions

rem ============================================================
rem  PASO 2 — Levantar núcleo CEDIT (sin WhatsApp)
rem  Orden: API → Web → Discord → n8n → Telegram
rem ============================================================

call "%~dp0_cedit_env.bat"

if not exist "%PY%" (
  echo [ERROR] No hay venv. Ejecute: scripts\1-CEDIT-Instalar.bat
  pause
  exit /b 1
)

"%PY%" -c "import discord, fastapi" 2>nul
if errorlevel 1 (
  echo [ERROR] Faltan dependencias. Ejecute: scripts\1-CEDIT-Instalar.bat
  pause
  exit /b 1
)

echo.
echo  [2/2] CEDIT — LEVANTAR (sin WhatsApp)
echo  =====================================
echo  [1] API        http://127.0.0.1:8001
echo  [2] Web        http://127.0.0.1:5173
echo  [3] Discord    bot.py
echo  [4] n8n        http://127.0.0.1:5678  (si esta instalado)
echo  [5] Telegram   telegram_bot.py
echo.
echo  WhatsApp: use WA-1 y WA-2 (no se abre aqui).
echo  Detener API: scripts\0-CEDIT-Detener.bat
echo.

rem --- Liberar puertos API ---
echo  Liberando puertos 8000 y 8001...
for %%P in (8000 8001) do (
  for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%%P.*LISTENING" 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
  )
)
timeout /t 2 /nobreak >nul 2>nul

rem --- [1] API ---
start "1-CEDIT-API-8001" cmd /k "cd /d "%APP%" && title 1-CEDIT-API-8001 && echo [1/5] API http://127.0.0.1:8001 && "%PY%" -m uvicorn api:app --host 127.0.0.1 --port 8001"
timeout /t 5 /nobreak >nul 2>nul

rem --- [2] Web ---
start "2-CEDIT-Web-5173" cmd /k "cd /d "%FRONT%" && title 2-CEDIT-Web-5173 && echo [2/5] Web http://127.0.0.1:5173 && npm run dev"
timeout /t 3 /nobreak >nul 2>nul

rem --- [3] Discord ---
start "3-CEDIT-Discord" cmd /k "cd /d "%APP%" && title 3-CEDIT-Discord && echo [3/5] Discord — espere Gateway connected && "%PY%" bot.py"
timeout /t 3 /nobreak >nul 2>nul

rem --- [4] n8n ---
where n8n >nul 2>&1
if errorlevel 1 (
  echo [AVISO] n8n no en PATH — ventana 4 con instrucciones.
  start "4-CEDIT-n8n-FALTA" cmd /k "title 4-CEDIT-n8n && echo [4/5] Instale: npm install -g n8n && echo Luego: n8n"
) else (
  start "4-CEDIT-n8n-5678" cmd /k "title 4-CEDIT-n8n-5678 && echo [4/5] n8n http://127.0.0.1:5678 && n8n"
)
timeout /t 2 /nobreak >nul 2>nul

rem --- [5] Telegram ---
"%PY%" -c "import telegram" 2>nul
if errorlevel 1 (
  echo [AVISO] Telegram omitido — falta python-telegram-bot.
) else if not exist "%APP%\.env" (
  echo [AVISO] Telegram omitido — falta .env con TELEGRAM_BOT_TOKEN.
) else (
  findstr /I "TELEGRAM_BOT_TOKEN=" "%APP%\.env" | findstr /V "=$" >nul 2>&1
  if errorlevel 1 (
    echo [AVISO] Telegram omitido — TELEGRAM_BOT_TOKEN vacio en .env
  ) else (
    start "5-CEDIT-Telegram" cmd /k "cd /d "%APP%" && title 5-CEDIT-Telegram && echo [5/5] Telegram polling && "%PY%" telegram_bot.py"
  )
)

echo.
echo  Ventanas 1- a 5- abiertas (WhatsApp aparte: WA-2).
echo  Chat web:  http://127.0.0.1:5173
echo  API docs:  http://127.0.0.1:8001/docs
echo.
pause
endlocal
