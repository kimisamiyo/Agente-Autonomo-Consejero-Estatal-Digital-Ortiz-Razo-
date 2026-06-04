@echo off
chcp 65001 >nul
setlocal EnableExtensions

echo.
echo  Fix Cloudflare — package-lock + git push
echo  ======================================
echo.

cd /d "C:\Users\mayro\Downloads\CEDIT\CEDIT\frontend"

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Instale Node.js LTS desde https://nodejs.org
  pause
  exit /b 1
)

if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /f package-lock.json

echo Regenerando package-lock.json (1-2 min)...
call npm install
if errorlevel 1 (
  echo [ERROR] npm install fallo
  pause
  exit /b 1
)

echo Probando build local...
call npm run build
if errorlevel 1 (
  echo [AVISO] build local fallo — revise errores arriba
)

cd /d "C:\Users\mayro\Downloads\CEDIT"

if exist requirements.txt (
  if not exist requirements-local.txt move /y requirements.txt requirements-local.txt
  if exist requirements.txt del /f requirements.txt
)

git add CEDIT/frontend/package-lock.json CEDIT/frontend/.node-version 2>nul
git add -u
git commit -m "fix: regenerar package-lock para Cloudflare Pages"
if errorlevel 1 (
  echo [AVISO] Nada que commitear
) else (
  git push origin main
)

echo.
echo  EN CLOUDFLARE (Settings ^> Environment variables ^> Production):
echo    SKIP_DEPENDENCY_INSTALL = true
echo.
echo  EN CLOUDFLARE (Settings ^> Builds):
echo    Root directory:   CEDIT/frontend
echo    Build command:    npm install ^&^& npm run build
echo    Output directory: dist
echo.
echo  Luego: Retry deployment
echo.
pause
endlocal
