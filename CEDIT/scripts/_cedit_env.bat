@echo off
REM Shared paths for local CEDIT scripts.
set "SCRIPTS=%~dp0"
for %%I in ("%SCRIPTS%..") do set "APP=%%~fI"
for %%I in ("%APP%\..") do set "ROOT=%%~fI"
set "FRONT=%APP%\frontend"
set "PY=%ROOT%\venv\Scripts\python.exe"
set "PIP=%ROOT%\venv\Scripts\pip.exe"
if not exist "%PY%" (
  set "PY=%APP%\venv\Scripts\python.exe"
  set "PIP=%APP%\venv\Scripts\pip.exe"
)
exit /b 0
