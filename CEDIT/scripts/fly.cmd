@echo off
rem Wrapper Fly — funciona en CMD y PowerShell (cmd /c scripts\fly.cmd ...)
if not exist "%USERPROFILE%\.fly\bin\flyctl.exe" (
  echo [ERROR] No existe flyctl.exe en %USERPROFILE%\.fly\bin\
  echo Instale: winget install Fly-io.flyctl
  echo Luego cierre y abra la terminal.
  exit /b 1
)
"%USERPROFILE%\.fly\bin\flyctl.exe" %*
