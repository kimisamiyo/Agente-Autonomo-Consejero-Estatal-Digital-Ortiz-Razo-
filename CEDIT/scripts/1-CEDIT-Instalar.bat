@echo off
chcp 65001 >nul
setlocal EnableExtensions

rem ============================================================
rem  PASO 1 — Instalar (venv → Python → frontend)
rem  WhatsApp no requiere pasos extra aquí.
rem ============================================================

call "%~dp0_cedit_env.bat"
cd /d "%ROOT%"

echo.
echo  [1/1] CEDIT — INSTALACION
echo  ==========================
echo  Raiz: %ROOT%
echo  App:  %APP%
echo.

rem --- [1/4] Python / venv ---
echo  [1/4] Entorno virtual Python...
where py >nul 2>&1
if errorlevel 1 goto :use_python
py -3.12 -c "import sys" >nul 2>&1
if errorlevel 1 goto :use_python
set "USE_PY=py -3.12"
goto :venv_create
:use_python
where python >nul 2>&1
if errorlevel 1 (
  echo [ERROR] No se encontro Python. Instale 3.11 o 3.12 desde python.org
  pause
  exit /b 1
)
set "USE_PY=python"
:venv_create

if not exist "%PY%" (
  echo        Creando venv\ ...
  %USE_PY% -m venv "%ROOT%\venv"
  if errorlevel 1 (
    echo [ERROR] No se pudo crear el venv.
    pause
    exit /b 1
  )
)
echo        OK - venv listo.

rem --- [2/4] pip ---
echo.
echo  [2/4] Dependencias Python (API, Discord, Telegram, IA)...
echo        Primera vez: 5-15 minutos.
"%PY%" -m pip install --upgrade pip -q
"%PIP%" install ^
  discord.py python-telegram-bot python-dotenv pypdf fpdf2 ^
  langchain-groq langchain-huggingface langchain-pinecone langchain-core ^
  fastapi uvicorn python-multipart httpx requests ^
  sentence-transformers ^
  web3 eth-account
if errorlevel 1 (
  echo [ERROR] Fallo pip install.
  pause
  exit /b 1
)
echo        OK - paquetes Python.

rem --- [3/4] Verificar API ---
echo.
echo  [3/4] Verificando api.py y .env ...
cd /d "%APP%"
if not exist "%APP%\.env" (
  echo [AVISO] No hay .env — copie .env.example a .env y complete claves.
)
"%PY%" -c "import api" 2>nul
if errorlevel 1 (
  echo [AVISO] import api fallo. Revise .env en %APP%
) else (
  echo        OK - backend importa correctamente.
)

rem --- [4/4] npm frontend ---
echo.
echo  [4/4] Frontend (npm)...
if not exist "%FRONT%\package.json" (
  echo        Sin carpeta frontend — omitido.
  goto :done
)
where npm >nul 2>&1
if errorlevel 1 (
  echo [AVISO] npm no encontrado. Instale Node.js LTS para la web.
  goto :done
)
cd /d "%FRONT%"
call npm install
if errorlevel 1 (
  echo [AVISO] npm install fallo. Ejecute manualmente en frontend\
) else (
  echo        OK - frontend listo.
)

:done
echo.
echo  ========================================
echo  INSTALACION COMPLETA
echo  Siguiente: scripts\2-CEDIT-Levantar.bat
echo  WhatsApp (aparte): WA-1 luego WA-2 con API ya activa
echo  ========================================
echo.
pause
endlocal
