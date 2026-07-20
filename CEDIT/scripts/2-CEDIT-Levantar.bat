@echo off
setlocal EnableExtensions
chcp 65001 >nul

REM Local: API + Web only. Bots: scripts 3/4/5.

call "%~dp0_cedit_env.bat"

if not exist "%PY%" (
  echo [ERROR] No hay venv. Ejecute: scripts\1-CEDIT-Instalar.bat
  echo Buscado: %ROOT%\venv  y  %APP%\venv
  pause
  exit /b 1
)

"%PY%" -c "import fastapi" 2>nul
if errorlevel 1 (
  echo [ERROR] Faltan deps. Ejecute: scripts\1-CEDIT-Instalar.bat
  pause
  exit /b 1
)

echo.
echo  CEDIT - LEVANTAR WEB + API (local)
echo  ==================================
echo  Python: %PY%
echo  [1] API   http://127.0.0.1:8001
echo  [2] Web   http://127.0.0.1:5173
echo.
echo  Bots aparte:
echo    3-CEDIT-Discord.bat
echo    4-CEDIT-Telegram.bat
echo    5-CEDIT-WhatsApp.bat
echo  Opcional: 4-CEDIT-n8n.bat
echo.

for %%P in (8000 8001) do (
  for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%%P" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
  )
)
timeout /t 1 /nobreak >nul 2>nul

start "CEDIT-API-8001" cmd /k "cd /d "%APP%" && title CEDIT-API-8001 && echo API http://127.0.0.1:8001 && "%PY%" -m uvicorn api:app --host 127.0.0.1 --port 8001"
timeout /t 4 /nobreak >nul 2>nul

start "CEDIT-Web-5173" cmd /k "cd /d "%FRONT%" && title CEDIT-Web-5173 && echo Web http://127.0.0.1:5173 && npm run dev"

echo.
echo  Abra http://127.0.0.1:5173
echo  Docs http://127.0.0.1:8001/docs
echo.
pause
endlocal
