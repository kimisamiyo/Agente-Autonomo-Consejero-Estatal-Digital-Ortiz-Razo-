@echo off
rem Rutas comunes CEDIT (llamar con: call "%~dp0_cedit_env.bat")
set "SCRIPTS=%~dp0"
for %%I in ("%SCRIPTS%..") do set "APP=%%~fI"
for %%I in ("%APP%\..") do set "ROOT=%%~fI"
set "PY=%ROOT%\venv\Scripts\python.exe"
set "PIP=%ROOT%\venv\Scripts\pip.exe"
set "FRONT=%APP%\frontend"
if exist "%USERPROFILE%\.fly\bin\flyctl.exe" (
  set "FLY=%USERPROFILE%\.fly\bin\flyctl.exe"
) else (
  set "FLY=fly"
)
exit /b 0
