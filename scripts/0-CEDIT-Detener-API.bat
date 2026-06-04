@echo off
chcp 65001 >nul
echo Cerrando procesos en puerto 8000 (API CEDIT)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000.*LISTENING"') do (
  taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq python.exe" /FO LIST ^| findstr /I "PID:"') do (
  wmic process where "ProcessId=%%a" get CommandLine 2>nul | findstr /I "uvicorn api:app" >nul && taskkill /F /PID %%a >nul 2>&1
)
timeout /t 2 /nobreak >nul
netstat -ano | findstr ":8000.*LISTENING" >nul && (
  echo [AVISO] Aun hay algo en 8000. Cierre manual la ventana 1-CEDIT-API-8000.
) || (
  echo Listo. Puerto 8000 libre.
)
pause
