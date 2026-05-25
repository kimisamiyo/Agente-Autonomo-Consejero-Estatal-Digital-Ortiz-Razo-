@echo off
chcp 65001 >nul
setlocal EnableExtensions

rem ============================================================
rem  PASO 1 — Instalar CEDIT (venv + Python + frontend npm)
rem  Doble clic tras clonar o hacer pull del repositorio.
rem ============================================================

set "SCRIPTS=%~dp0"
set "APP=%SCRIPTS%.."
set "ROOT=%APP%\.."
set "VENV=%ROOT%\venv"
set "PY=%VENV%\Scripts\python.exe"
set "PIP=%VENV%\Scripts\pip.exe"

cd /d "%ROOT%"

echo.
echo  [1/2] CEDIT — INSTALACION
echo  ==========================
echo  Carpeta raiz: %ROOT%
echo.

where py >nul 2>&1
if errorlevel 1 goto :use_python
py -3.12 -c "import sys" >nul 2>&1
if errorlevel 1 goto :use_python
set "USE_PY=py -3.12"
goto :venv_create
:use_python
where python >nul 2>&1
if errorlevel 1 (
  echo [ERROR] No se encontro Python. Instale Python 3.11 o 3.12 desde python.org
  pause
  exit /b 1
)
set "USE_PY=python"
:venv_create

if not exist "%PY%" (
  echo  Creando entorno virtual en venv\ ...
  %USE_PY% -m venv "%VENV%"
  if errorlevel 1 (
    echo [ERROR] No se pudo crear el venv.
    pause
    exit /b 1
  )
)

echo  Actualizando pip ...
"%PY%" -m pip install --upgrade pip -q

echo.
echo  Instalando dependencias Python (API + Discord + IA)...
echo  (La primera vez puede tardar 5-15 minutos)
echo.

"%PIP%" install ^
  discord.py python-dotenv pypdf fpdf2 ^
  langchain-groq langchain-huggingface langchain-pinecone langchain-core ^
  fastapi uvicorn python-multipart httpx requests ^
  sentence-transformers

if errorlevel 1 (
  echo.
  echo [ERROR] Fallo pip install. Revise internet o ejecute de nuevo.
  pause
  exit /b 1
)

echo.
echo  Comprobando importacion del backend...
cd /d "%APP%"
"%PY%" -c "import api"
if errorlevel 1 (
  echo [AVISO] import api fallo. Revise .env y claves API en carpeta CEDIT.
  goto :npm_block
)
echo  OK - api.py carga correctamente.

:npm_block
if not exist "%APP%\frontend\package.json" goto :done
echo.
echo  Instalando dependencias del frontend (npm)...
cd /d "%APP%\frontend"
where npm >nul 2>&1
if errorlevel 1 (
  echo [AVISO] npm no encontrado. Instale Node.js LTS para la web en :5173
  goto :done
)
call npm install
if errorlevel 1 (
  echo [AVISO] npm install fallo. Ejecute manualmente en frontend\
) else (
  echo  OK - frontend listo.
)
cd /d "%APP%"

:done

echo.
echo  ========================================
echo  INSTALACION COMPLETA
echo  Siguiente paso: doble clic en
echo    scripts\2-CEDIT-Levantar-Todo.bat
echo  ========================================
echo.
pause
endlocal
