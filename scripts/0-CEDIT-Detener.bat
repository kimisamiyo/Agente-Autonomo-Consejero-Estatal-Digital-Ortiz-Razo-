@echo off
chcp 65001 >nul
echo.
echo  CEDIT — Detener API (puertos 8000 y 8001)
echo  ==========================================
echo  Discord / Telegram / Web: cierre sus ventanas (titulos 3-, 5-, 2-).
echo.

for %%P in (8000 8001) do (
  for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%%P.*LISTENING" 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
  )
)

for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq python.exe" /FO LIST 2^>nul ^| findstr /I "PID:"') do (
  wmic process where "ProcessId=%%a" get CommandLine 2>nul | findstr /I "uvicorn api:app" >nul && taskkill /F /PID %%a >nul 2>&1
)

timeout /t 2 /nobreak >nul 2>nul
netstat -ano | findstr ":8001.*LISTENING" >nul && (
  echo [AVISO] Aun hay proceso en 8001. Cierre la ventana 1-CEDIT-API-8001.
) || (
  echo Listo — puertos API libres.
)
echo.
pause
