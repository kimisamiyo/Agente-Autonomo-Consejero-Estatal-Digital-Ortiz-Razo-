@echo off
chcp 65001 >nul
setlocal EnableExtensions
call "%~dp0_cedit_env.bat"
cd /d "%APP%"

if not exist "%APP%\.env" (
  echo [ERROR] Falta %APP%\.env
  pause
  exit /b 1
)

"%FLY%" auth whoami >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Sin login Fly. Ejecute: 7-CEDIT-Fly-Login.bat
  pause
  exit /b 1
)

echo.
echo  CEDIT — Despliegue completo Fly (API + bots)
echo  ============================================
echo  Si falla "payment information": anada tarjeta en
echo  https://fly.io/dashboard/kimisamiyo/billing
echo  (plan gratis; Fly pide tarjeta para verificar cuenta)
echo.
pause

rem --- Leer .env sin mostrar valores ---
for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%APP%\.env") do (
  set "%%A=%%B"
)

echo.
echo [1/6] Crear app cedit-api (region iad)...
"%FLY%" apps create cedit-api 2>nul
"%FLY%" launch --config fly.api.toml --copy-config --no-deploy --yes --name cedit-api --region iad 2>nul

echo [2/6] Secretos API...
"%FLY%" secrets set -a cedit-api ^
  GROQ_API_KEY=%GROQ_API_KEY% ^
  PINECONE_API_KEY=%PINECONE_API_KEY% ^
  GROQ_MODEL=%GROQ_MODEL% ^
  GROQ_MODEL_FALLBACK=%GROQ_MODEL_FALLBACK% ^
  SYSCOIN_RPC_URL=%SYSCOIN_RPC_URL% ^
  SYSCOIN_CHAIN_ID=%SYSCOIN_CHAIN_ID% ^
  SYSCOIN_EXPLORER_URL=%SYSCOIN_EXPLORER_URL% ^
  CEDIT_CONTRACT_ADDRESS=%CEDIT_CONTRACT_ADDRESS% ^
  CEDIT_PDF_CONTRACT_ADDRESS=%CEDIT_PDF_CONTRACT_ADDRESS% ^
  CEDIT_MINTER_PRIVATE_KEY=%CEDIT_MINTER_PRIVATE_KEY% ^
  CEDIT_MINT_GAS_GWEI=%CEDIT_MINT_GAS_GWEI% ^
  CEDIT_MINT_GAS_BUFFER=%CEDIT_MINT_GAS_BUFFER% ^
  CEDIT_MINT_GAS_FALLBACK=%CEDIT_MINT_GAS_FALLBACK% ^
  CEDIT_MINT_GAS_LIMIT_MAX=%CEDIT_MINT_GAS_LIMIT_MAX%

echo [3/6] Deploy API (10-20 min primera vez)...
"%FLY%" deploy --config fly.api.toml -a cedit-api
if errorlevel 1 goto :fail

echo [4/6] Crear app cedit-bots...
"%FLY%" apps create cedit-bots 2>nul
"%FLY%" launch --config fly.bots.toml --copy-config --no-deploy --yes --name cedit-bots --region iad 2>nul

echo [5/6] Secretos bots...
"%FLY%" secrets set -a cedit-bots ^
  DISCORD_TOKEN=%DISCORD_TOKEN% ^
  TELEGRAM_BOT_TOKEN=%TELEGRAM_BOT_TOKEN% ^
  GROQ_API_KEY=%GROQ_API_KEY% ^
  PINECONE_API_KEY=%PINECONE_API_KEY% ^
  GROQ_MODEL=%GROQ_MODEL% ^
  GROQ_MODEL_FALLBACK=%GROQ_MODEL_FALLBACK% ^
  CEDIT_WEB_URL=%CEDIT_WEB_URL%

echo [6/6] Deploy bots (2 GB RAM, 1 maquina)...
"%FLY%" scale count 1 -a cedit-bots -y 2>nul
"%FLY%" deploy --config fly.bots.toml -a cedit-bots
if errorlevel 1 goto :fail

echo.
echo  LISTO
echo  API:   https://cedit-api.fly.dev/api/health
echo  Logs:  fly logs -a cedit-api
echo         fly logs -a cedit-bots
echo  Web:   Cloudflare Pages (paso manual en dashboard)
echo.
pause
exit /b 0

:fail
echo.
echo [ERROR] Revisar mensaje arriba. Billing: fly.io/dashboard/kimisamiyo/billing
pause
exit /b 1
