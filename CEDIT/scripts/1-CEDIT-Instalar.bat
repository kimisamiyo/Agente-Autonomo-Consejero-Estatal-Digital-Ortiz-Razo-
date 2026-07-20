@echo off
setlocal EnableExtensions
chcp 65001 >nul

call "%~dp0_cedit_env.bat"
cd /d "%ROOT%"

echo.
echo  [1] CEDIT - INSTALACION LOCAL
echo  =============================
echo  Raiz: %ROOT%
echo  App:  %APP%
echo.

echo  [1/4] Entorno virtual Python...
where py >nul 2>&1
if errorlevel 1 goto use_python
py -3.12 -c "import sys" >nul 2>&1
if errorlevel 1 goto use_python
set "USE_PY=py -3.12"
goto venv_create
:use_python
where python >nul 2>&1
if errorlevel 1 (
  echo [ERROR] No se encontro Python 3.11+. Instale desde python.org
  pause
  exit /b 1
)
set "USE_PY=python"
:venv_create

if not exist "%PY%" (
  echo        Creando %ROOT%\venv ...
  %USE_PY% -m venv "%ROOT%\venv"
  if errorlevel 1 (
    echo [ERROR] No se pudo crear el venv.
    pause
    exit /b 1
  )
  set "PY=%ROOT%\venv\Scripts\python.exe"
  set "PIP=%ROOT%\venv\Scripts\pip.exe"
)
echo        OK - %PY%

echo.
echo  [2/4] Dependencias Python...
"%PY%" -m pip install --upgrade pip -q
"%PIP%" install -r "%APP%\requirements-deploy.txt"
if errorlevel 1 (
  echo [ERROR] Fallo pip install.
  pause
  exit /b 1
)
echo        OK

echo.
echo  [3/4] .env ...
if not exist "%APP%\.env" (
  if exist "%APP%\.env.example" (
    copy /Y "%APP%\.env.example" "%APP%\.env" >nul
    echo        Creado .env desde .env.example - complete las claves.
  ) else (
    echo [AVISO] No hay .env ni .env.example
  )
) else (
  echo        OK - .env encontrado
)

echo.
echo  [4/4] Frontend npm...
where npm >nul 2>&1
if errorlevel 1 (
  echo [AVISO] npm no encontrado. Instale Node.js LTS.
  goto done
)
cd /d "%FRONT%"
call npm install
if errorlevel 1 (
  echo [AVISO] npm install fallo.
) else (
  echo        OK
)

:done
echo.
echo  Listo. Siguiente: scripts\2-CEDIT-Levantar.bat
echo.
pause
endlocal
