@echo off
chcp 65001 >nul
setlocal EnableExtensions

rem ============================================================
rem  PASO 2 — Levantar CEDIT (API, Web, Discord, n8n)
rem  Ejecutar DESPUES del paso 1. Abre 4 ventanas numeradas.
rem ============================================================

set "SCRIPTS=%~dp0"
set "APP=%SCRIPTS%.."
set "ROOT=%APP%\.."
set "PY=%ROOT%\venv\Scripts\python.exe"

if not exist "%PY%" (
  echo.
  echo [ERROR] No hay venv. Ejecute primero:
  echo   scripts\1-CEDIT-Instalar.bat
  echo.
  pause
  exit /b 1
)

"%PY%" -c "import discord" 2>nul
if errorlevel 1 (
  echo.
  echo [ERROR] Falta discord.py. Ejecute: scripts\1-CEDIT-Instalar.bat
  echo.
  pause
  exit /b 1
)

echo.
echo  [2/2] CEDIT — LEVANTAR TODO
echo  ===========================
echo  Orden de arranque:
echo    [0] Si la API falla: scripts\0-CEDIT-Detener-API.bat
echo    [1] API Backend    http://127.0.0.1:8000
echo    [2] Web Frontend   http://127.0.0.1:5173
echo    [3] Bot Discord    bot.py
echo    [4] n8n            http://127.0.0.1:5678
echo    [5] Telegram       telegram_bot.py (opcional, ver scripts\5-CEDIT-Telegram.bat)
echo.
echo  Espere ~30-60 s en Discord hasta ver: connected to Gateway
echo  n8n: importe flujos CEDIT-02 y CEDIT-01 y Active (verde)
echo.

rem --- [1] API (debe ir primero: el chat usa /api) ---
start "1-CEDIT-API-8000" cmd /k "cd /d "%APP%" && title 1-CEDIT-API-8000 && echo [1] Backend FastAPI - http://127.0.0.1:8000 && echo Carpeta: %APP% && "%PY%" -m uvicorn api:app --host 127.0.0.1 --port 8000"

timeout /t 4 /nobreak >nul 2>nul

rem --- [2] Frontend Vite ---
start "2-CEDIT-Web-5173" cmd /k "cd /d "%APP%\frontend" && title 2-CEDIT-Web-5173 && echo [2] Frontend Vite - http://127.0.0.1:5173 && npm run dev"

timeout /t 2 /nobreak >nul 2>nul

rem --- [3] Bot Discord ---
start "3-CEDIT-Discord" cmd /k "cd /d "%APP%" && title 3-CEDIT-Discord && echo [3] Bot Discord - cargando embeddings... && "%PY%" bot.py"

timeout /t 2 /nobreak >nul 2>nul

rem --- [4] n8n (opcional para proxy; la web tambien usa API directa) ---
where n8n >nul 2>&1
if errorlevel 1 (
  echo [AVISO] n8n no esta en PATH. Omitiendo ventana 4. Instale: npm install -g n8n
  start "4-CEDIT-n8n-FALTA" cmd /k "echo [4] n8n no instalado. npm install -g n8n && n8n"
) else (
  start "4-CEDIT-n8n-5678" cmd /k "title 4-CEDIT-n8n-5678 && echo [4] n8n - http://127.0.0.1:5678 && echo Active: CEDIT-02 luego CEDIT-01 && n8n"
)

echo.
echo  Cuatro ventanas abiertas (titulos 1- a 4-).
echo  Telegram (opcional): scripts\5-CEDIT-Telegram.bat
echo  Abra el chat: http://127.0.0.1:5173
echo  Docs API:     http://127.0.0.1:8000/docs
echo.
pause
endlocal
