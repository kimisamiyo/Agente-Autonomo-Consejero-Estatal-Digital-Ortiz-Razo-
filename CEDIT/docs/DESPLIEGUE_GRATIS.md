# Despliegue paso a paso — CEDIT en la nube (gratis)

Guía para dejar **Web + API + Discord + Telegram** funcionando 24/7.  
**WhatsApp** sigue en tu PC (no hay URL fija gratis para Meta).

Orden: **GitHub → API (Fly) → Bots (Fly) → Web (Cloudflare) → WhatsApp (local)**.

---

## Antes de empezar (checklist)

En tu PC, abre `CEDIT\.env` y ten a mano estos valores (los pegarás en Fly, **no** en GitHub):

| Variable | ¿Dónde va? |
|----------|------------|
| `GROQ_API_KEY` | Fly API + Fly bots |
| `GROQ_MODEL` | `llama-3.1-8b-instant` (recomendado) |
| `GROQ_MODEL_FALLBACK` | `llama-3.1-8b-instant` |
| `PINECONE_API_KEY` | Fly API + Fly bots |
| `DISCORD_TOKEN` | Solo Fly bots |
| `TELEGRAM_BOT_TOKEN` | Solo Fly bots |
| Blockchain (`SYSCOIN_*`, `CEDIT_*`) | Solo Fly API (si usas mint en web) |

Cuentas a crear (gratis):

1. [GitHub](https://github.com) — subir el código  
2. [Fly.io](https://fly.io) — API y bots (puede pedir tarjeta; no cobra si te mantienes en el free allowance)  
3. [Cloudflare](https://dash.cloudflare.com) — sitio web estático  

Herramientas en Windows:

- [Git](https://git-scm.com/download/win)  
- [Node.js LTS](https://nodejs.org) (ya lo tienes para el front)  
- Fly CLI (Windows):  
  `winget install Fly-io.flyctl`  
  **Cierra y abre** PowerShell o Cursor; prueba: `fly version` o `flyctl version`  
  Si sigue «no se reconoce», usa la ruta completa:  
  `%USERPROFILE%\.fly\bin\flyctl.exe version`

---

## Paso 0 — Subir el proyecto a GitHub (sin secretos)

1. Abre PowerShell:

```powershell
cd C:\Users\mayro\Downloads\CEDIT
git init
git add .
git status
```

2. Confirma que **NO** aparece `.env` en la lista (está en `.gitignore`). Si aparece, no hagas commit.

3. Crea un repo vacío en GitHub (ej. `cedit-mef`).

4. Enlaza y sube:

```powershell
git remote add origin https://github.com/TU_USUARIO/cedit-mef.git
git branch -M main
git commit -m "CEDIT: proyecto inicial"
git push -u origin main
```

Estructura esperada del repo:

```
CEDIT/              ← carpeta raíz del repo
  CEDIT/            ← api.py, bot.py, frontend/
  render.yaml
  venv/             ← ignorado por git
```

---

## Paso 1 — API en Fly.io (backend 24/7)

Todo este paso se hace en la carpeta donde está `api.py`:

```powershell
cd C:\Users\mayro\Downloads\CEDIT\CEDIT
fly auth login
```

Se abre el navegador; inicia sesión en Fly.

### 1.1 Crear la app (sin desplegar aún)

```powershell
fly launch --config fly.api.toml --copy-config --no-deploy
```

Responde en el asistente:

- **Nombre de app:** `cedit-api` (o otro si ya existe; anótalo)
- **Región:** elige la más cercana (ej. `gru` São Paulo)
- **¿Postgres?** → **No**
- **¿Redis?** → **No**

### 1.2 Pegar secretos (copia desde tu `.env`)

Sustituye los valores por los tuyos reales:

```powershell
fly secrets set `
  GROQ_API_KEY=gsk_TU_CLAVE `
  PINECONE_API_KEY=pcsk_TU_CLAVE `
  GROQ_MODEL=llama-3.1-8b-instant `
  GROQ_MODEL_FALLBACK=llama-3.1-8b-instant
```

Si usas blockchain en la web, añade en el mismo comando (o otro `fly secrets set`):

```powershell
fly secrets set SYSCOIN_RPC_URL=https://rpc-zk.tanenbaum.io/ SYSCOIN_CHAIN_ID=57057 CEDIT_CONTRACT_ADDRESS=0x... CEDIT_MINTER_PRIVATE_KEY=0x...
```

### 1.3 Desplegar

```powershell
fly deploy --config fly.api.toml
```

La primera vez tarda varios minutos (Docker + `sentence-transformers`).

### 1.4 Probar que vive

Abre en el navegador (cambia el nombre si usaste otro):

`https://cedit-api.fly.dev/api/health`

Debes ver JSON con algo como `"primary": "llama-3.1-8b-instant"`.

Si falla:

```powershell
fly logs -a cedit-api
```

Si ves **OOM / killed**, en [fly.io dashboard](https://fly.io/dashboard) → tu app → **Scale** → sube RAM a **1 GB** y vuelve a `fly deploy`.

**Anota tu URL de API:** `https://cedit-api.fly.dev` (la usarás en Cloudflare).

---

## Paso 2 — Discord + Telegram en Fly.io (segunda app)

Misma carpeta `CEDIT`:

```powershell
cd C:\Users\mayro\Downloads\CEDIT\CEDIT
fly launch --config fly.bots.toml --copy-config --no-deploy
```

- Nombre sugerido: `cedit-bots`  
- Sin Postgres/Redis  

### 2.1 Secretos de los bots

```powershell
fly secrets set `
  DISCORD_TOKEN=TU_TOKEN_DISCORD `
  TELEGRAM_BOT_TOKEN=TU_TOKEN_TELEGRAM `
  GROQ_API_KEY=gsk_TU_CLAVE `
  PINECONE_API_KEY=pcsk_TU_CLAVE `
  GROQ_MODEL=llama-3.1-8b-instant `
  GROQ_MODEL_FALLBACK=llama-3.1-8b-instant
```

### 2.2 Desplegar bots

```powershell
fly deploy --config fly.bots.toml
```

### 2.3 Ver logs (como estar “aquí” viendo la consola)

```powershell
fly logs -a cedit-bots
```

Busca:

- Telegram: líneas `[INFO] cedit.telegram.bot`  
- Discord: `connected to Gateway` o similar  

**Importante:** no ejecutes `bot.py` ni `telegram_bot.py` en tu PC al mismo tiempo; solo **una** instancia por bot (si no, Discord/Telegram se desconectan entre sí).

### 2.4 Probar

- **Discord:** escribe `!AYUDA` o menciona al bot  
- **Telegram:** `/start` en tu bot  

La primera respuesta puede tardar ~1–2 min (carga embeddings).

---

## Paso 3 — Web en Cloudflare Pages (chat en el navegador)

### 3.1 Conectar GitHub

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**  
2. Autoriza GitHub y elige el repo `cedit-mef` (o el nombre que pusiste).

### 3.2 Configuración de build

| Campo | Valor |
|--------|--------|
| **Production branch** | `main` |
| **Framework preset** | None |
| **Build command** | `cd CEDIT/frontend && npm ci && npm run build` |
| **Build output directory** | `CEDIT/frontend/dist` |

(Si tu repo es **solo** la carpeta interna `CEDIT` sin padre, usa `cd frontend && npm ci && npm run build` y output `frontend/dist`.)

### 3.3 Variables de entorno (Settings → Environment variables → Production)

| Nombre | Valor ejemplo |
|--------|----------------|
| `VITE_API_BASE_URL` | `https://cedit-api.fly.dev` (sin `/` al final) |
| `VITE_CEDIT_WEB_URL` | Lo rellenas después del primer deploy |

Pulsa **Save and Deploy**.

### 3.4 Primer deploy y URL

Cloudflare te da una URL tipo: `https://cedit-mef.pages.dev`

1. Cópiala  
2. Vuelve a **Environment variables** y pon esa URL en `VITE_CEDIT_WEB_URL`  
3. **Redeploy** (Deployments → ⋮ → Retry deployment)

### 3.5 Probar la web

1. Abre `https://tu-proyecto.pages.dev`  
2. Escribe un mensaje en el chat  
3. Si error de red: revisa que `VITE_API_BASE_URL` sea exactamente tu app Fly y que `https://cedit-api.fly.dev/api/health` responda  

---

## Paso 4 — WhatsApp (solo en tu PC, como ahora)

En la nube gratis no hay URL fija para Meta. En tu máquina:

1. `scripts\1-CEDIT-Instalar.bat` (si hace falta)  
2. `scripts\2-CEDIT-Levantar.bat` → API en `http://127.0.0.1:8001`  
3. `scripts\WA-2-CEDIT-WhatsApp-Tunel.bat` → copia la URL `https://....tunnelmole.net`  
4. Meta → WhatsApp → Webhook:  
   `https://TU-URL.tunnelmole.net/api/whatsapp/webhook`  
   Token: `cedit_webhook_secret`  
5. Guía completa: `scripts\WA-1-CEDIT-WhatsApp-Ayuda.bat`  

Mientras el PC esté apagado o sin túnel, WhatsApp no recibirá mensajes.

---

## Paso 5 — Comprobar que “todo” está vivo

| Qué | Cómo comprobar |
|-----|----------------|
| API | `https://cedit-api.fly.dev/api/health` → 200 + JSON |
| Web | Abrir Pages → chat responde |
| Discord | `!AYUDA` en servidor o DM |
| Telegram | `/start` |
| WhatsApp | Mensaje con PC + WA-2 activos |

---

## Actualizar después de cambiar código

```powershell
cd C:\Users\mayro\Downloads\CEDIT\CEDIT
git add .
git commit -m "descripcion del cambio"
git push
```

- **API:** `fly deploy --config fly.api.toml`  
- **Bots:** `fly deploy --config fly.bots.toml`  
- **Web:** Cloudflare redeploya solo al hacer push (si activaste auto deploy)

---

## Problemas frecuentes

| Síntoma | Qué hacer |
|---------|-----------|
| Web “no hay conexión” | Revisa `VITE_API_BASE_URL` y `/api/health` en Fly |
| Discord no responde | `fly logs -a cedit-bots`; cierra `bot.py` local |
| Telegram no responde | Mismo; un solo `telegram_bot.py` en el mundo |
| “Mucha demanda” (Groq) | Cuota agotada; espera o revisa [console.groq.com](https://console.groq.com) |
| Fly build muy lento / falla RAM | Escala VM a 1 GB en dashboard |
| Cloudflare build falla | Revisa ruta `CEDIT/frontend` según estructura del repo |

---

## Resumen de URLs que tendrás

```
Web:      https://TU-PROYECTO.pages.dev
API:      https://cedit-api.fly.dev
Docs API: https://cedit-api.fly.dev/docs
Discord:  (en la nube, sin URL pública)
Telegram: (en la nube, sin URL pública)
WhatsApp: túnel local → Meta webhook
```

Cuando termines el Paso 1, guarda la URL real de la API; todo lo demás depende de ella.
