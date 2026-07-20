@echo off
setlocal EnableExtensions
chcp 65001 >nul

echo.
echo  CEDIT - Detener API (puertos 8000 y 8001)
echo  ========================================
echo.

for %%P in (8000 8001) do (
  for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%%P" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
  )
)

timeout /t 1 /nobreak >nul 2>nul
netstat -ano | findstr ":8001" | findstr "LISTENING" >nul
if errorlevel 1 (
  echo Listo - puertos API libres.
) else (
  echo [AVISO] Aun hay proceso en 8001. Cierre CEDIT-API-8001.
)
echo.
pause
endlocal
