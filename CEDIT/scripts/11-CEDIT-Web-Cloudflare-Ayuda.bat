@echo off
chcp 65001 >nul
echo.
echo  CEDIT — Web en Cloudflare Pages
echo  ===============================
echo.
echo  PREVIO: API en Fly respondiendo:
echo    https://cedit-api.fly.dev/api/health
echo.
echo  1) Subir repo a GitHub (sin .env)
echo     cd C:\Users\mayro\Downloads\CEDIT
echo     git add . ^&^& git commit ^&^& git push
echo.
echo  2) https://dash.cloudflare.com
echo     Workers ^& Pages ^> Create ^> Pages ^> Connect Git
echo.
echo  3) Build settings:
echo     Build command:
echo       cd CEDIT/frontend ^&^& npm ci ^&^& npm run build
echo     Output directory:
echo       CEDIT/frontend/dist
echo.
echo  4) Environment variables (Production):
echo     VITE_API_BASE_URL = https://cedit-api.fly.dev
echo     VITE_CEDIT_WEB_URL = (vacio al 1er deploy)
echo.
echo  5) Tras el 1er deploy copie la URL .pages.dev
echo     Vuelva a Variables y ponga:
echo     VITE_CEDIT_WEB_URL = https://SU-PROYECTO.pages.dev
echo     Retry deployment
echo.
echo  6) Discord bot — enlace web en Redes:
echo     scripts\fly.cmd secrets set CEDIT_WEB_URL=https://SU-PROYECTO.pages.dev -a cedit-bots
echo     scripts\fly.cmd apps restart cedit-bots
echo.
pause
