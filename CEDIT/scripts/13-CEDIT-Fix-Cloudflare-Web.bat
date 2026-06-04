@echo off
chcp 65001 >nul
setlocal EnableExtensions

cd /d "C:\Users\mayro\Downloads\CEDIT"

echo.
echo  Fix Cloudflare Pages
echo  ====================
echo.

if exist "requirements.txt" (
  if not exist "requirements-local.txt" (
    move /y "requirements.txt" "requirements-local.txt"
  ) else (
    del /f "requirements.txt"
  )
)

cd /d "C:\Users\mayro\Downloads\CEDIT\CEDIT\frontend"
call npm install
cd /d "C:\Users\mayro\Downloads\CEDIT"

git add -A
git commit -m "fix: Cloudflare web (root frontend, npm lock, sin pip en raiz)"
git push origin main

echo.
echo  Cloudflare Settings ^> Builds:
echo    Root directory:   CEDIT/frontend
echo    Build command:    npm install ^&^& npm run build
echo    Output directory: dist
echo.
echo  Retry deployment
pause
endlocal
