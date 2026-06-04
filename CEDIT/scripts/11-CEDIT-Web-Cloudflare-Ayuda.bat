@echo off
chcp 65001 >nul
echo.
echo  CEDIT — Cloudflare Pages (config correcta)
echo  ==========================================
echo.
echo  Root directory:   CEDIT/frontend
echo  Build command:    npm install ^&^& npm run build
echo  Output directory: dist
echo.
echo  Variables:
echo    VITE_API_BASE_URL = https://cedit-api.fly.dev
echo    VITE_CEDIT_WEB_URL = https://TU.pages.dev (tras 1er deploy)
echo.
echo  Si falla: 13-CEDIT-Fix-Cloudflare-Web.bat
pause
