@echo off
chcp 65001 >nul
setlocal EnableExtensions

rem Corrige: "fatal: No url found for submodule path 'CEDIT' in .gitmodules"
rem Convierte CEDIT en carpeta normal para Cloudflare Pages.

cd /d "C:\Users\mayro\Downloads\CEDIT"

echo.
echo  CEDIT — Arreglar submodule en GitHub
echo  =====================================
echo.

if not exist "CEDIT" (
  echo [ERROR] No existe la carpeta CEDIT
  pause
  exit /b 1
)

echo [1/5] Quitar CEDIT del indice como submodule...
git rm --cached CEDIT 2>nul
git rm --cached -f CEDIT 2>nul

echo [2/5] Eliminar .git interno en CEDIT si existe...
if exist "CEDIT\.git" (
  rmdir /s /q "CEDIT\.git" 2>nul
  del /f /q "CEDIT\.git" 2>nul
)

echo [3/5] Agregar CEDIT como archivos normales (puede tardar)...
git add CEDIT/

echo [4/5] Commit...
git commit -m "fix: CEDIT como carpeta normal para Cloudflare Pages"
if errorlevel 1 (
  echo [AVISO] Nada que commitear o commit fallo. Revise: git status
)

echo [5/5] Push a GitHub...
git push origin main
if errorlevel 1 (
  echo [ERROR] Push fallo. Ejecute: git pull origin main --rebase
  echo         luego: git push origin main
  pause
  exit /b 1
)

echo.
echo  LISTO — En Cloudflare Pages: Retry deployment
echo.
pause
endlocal
