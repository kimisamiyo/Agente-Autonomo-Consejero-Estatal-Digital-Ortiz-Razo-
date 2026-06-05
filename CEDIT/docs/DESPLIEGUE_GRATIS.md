# CEDIT — Guía completa: local y despliegue gratuito

**CEDIT** (Consejero Estatal Digital) — mentor MEF / Invierte.pe en **web**, **Discord**, **Telegram** y (opcional) **WhatsApp**.

Esta guía cubre **dos caminos**:

| Camino | Para qué sirve | ¿24/7? |
|--------|----------------|--------|
| **A — Local (Windows)** | Desarrollar, probar, WhatsApp con túnel | Solo con el PC encendido |
| **B — Nube (gratis)** | Web + API + Discord en producción | Sí (Fly + Cloudflare) |

**Orden recomendado en nube:** GitHub → API (Fly) → Bots (Fly) → Web (Cloudflare) → WhatsApp (local).

---

## Índice

1. [Requisitos y secretos](#1-requisitos-y-secretos)
2. [Parte A — Levantar todo en local](#parte-a--levantar-todo-en-local-windows)
3. [Parte B — Desplegar en la nube](#parte-b--desplegar-en-la-nube)
4. [Parte C — WhatsApp (solo local)](#parte-c--whatsapp-solo-local)
5. [Actualizar después de cambios](#actualizar-después-de-cambios)
6. [Problemas frecuentes](#problemas-frecuentes)
7. [Resumen de URLs](#resumen-de-urls)

---

## 1. Requisitos y secretos

### Software (Windows)

| Herramienta | Uso |
|-------------|-----|
| [Python 3.11 o 3.12](https://www.python.org/downloads/) | API, bots, núcleo |
| [Node.js LTS](https://nodejs.org) | Frontend, n8n, túnel WhatsApp |
| [Git](https://git-scm.com/download/win) | Subir código a GitHub |
| [Fly CLI](https://fly.io/docs/hands-on/install-flyctl/) | API y bots 24/7 |

Fly en Windows:

```powershell
winget install Fly-io.flyctl
```

Cierra y abre la terminal. Prueba:

```cmd
fly version
```

Si no se reconoce: `%USERPROFILE%\.fly\bin\flyctl.exe version`

### Archivo `.env` (nunca subir a Git)

Copia la plantilla:

```text
CEDIT\.env.example  →  CEDIT\.env
```

Rellena al menos:

| Variable | Obligatorio | Dónde se usa |
|----------|-------------|--------------|
| `GROQ_API_KEY` | Sí | API + bots (IA) |
| `PINECONE_API_KEY` | Sí | RAG normativo |
| `GROQ_MODEL` | Recomendado | `meta-llama/llama-4-scout-17b-16e-instruct` |
| `GROQ_MODEL_FALLBACK` | Recomendado | `llama-3.1-8b-instant` (cuota distinta) |
| `DISCORD_TOKEN` | Si usas Discord | Bot Discord |
| `TELEGRAM_BOT_TOKEN` | Si usas Telegram | Bot Telegram |
| `CEDIT_WEB_URL` | En nube | URL pública web (botón Redes) |
| `SYSCOIN_*`, `CEDIT_CONTRACT_*` | Opcional | Mint blockchain en web |

**Regla:** `git status` **no** debe listar `.env`. Si aparece, no hagas commit.

### Cuentas (nube)

1. [GitHub](https://github.com) — código  
2. [Fly.io](https://fly.io) — API + Discord (puede pedir tarjeta; plan gratis con límites)  
3. [Cloudflare](https://dash.cloudflare.com) — web estática  
4. [Groq Console](https://console.groq.com) — clave IA  
5. [Pinecone](https://www.pinecone.io) — índice vectorial  

---

## Parte A — Levantar todo en local (Windows)

Ruta base del código (ajusta si clonaste en otra carpeta):

```text
C:\Users\mayro\Downloads\CEDIT\CEDIT
```

El `venv` de Python suele estar en la carpeta **padre**:

```text
C:\Users\mayro\Downloads\CEDIT\venv
```

### A.1 — Instalación (una sola vez)

Doble clic o desde CMD:

```cmd
cd /d C:\Users\mayro\Downloads\CEDIT\CEDIT\scripts
1-CEDIT-Instalar.bat
```

Hace: crear `venv` → `pip install` → `npm install` en `frontend/`.

### A.2 — Levantar todos los servicios

```cmd
2-CEDIT-Levantar.bat
```

Abre ventanas separadas:

| Ventana | URL / acción |
|---------|----------------|
| API | http://127.0.0.1:8001 |
| Web (chat) | http://127.0.0.1:5173 |
| Discord | Bot en línea si hay `DISCORD_TOKEN` |
| n8n | http://127.0.0.1:5678 |
| Telegram | Si hay `TELEGRAM_BOT_TOKEN` |

**Comprobar API:**

```text
http://127.0.0.1:8001/api/health
```

Debe responder: `{"status":"ok","service":"CEDIT"}`

**Comprobar web:** abre http://127.0.0.1:5173 y envía un mensaje.

### A.3 — Detener servicios

```cmd
0-CEDIT-Detener.bat
```

Libera puertos 8000/8001.

### A.4 — Servicios por separado

| Script | Qué levanta |
|--------|-------------|
| `3-CEDIT-Telegram.bat` | Solo Telegram |
| `4-CEDIT-n8n.bat` | Solo n8n |

### A.5 — Discord en local

- Comandos slash: `/ayuda`, `/auditar`, etc.  
- Texto: `!` + consulta (ej. `!hola` o `! ¿Cuáles son mis derechos?`)  
- **No** ejecutes `bot.py` local **y** Fly a la vez con el mismo `DISCORD_TOKEN` (solo una sesión).

### A.6 — n8n (opcional)

1. Importa en http://localhost:5678 los JSON de `CEDIT/n8n/`  
2. Activa **primero** `CEDIT-02-Blockchain-Registro.json`, **después** `CEDIT-01-Entrada-Omnicanal.json`  
3. Toggle **Active** (verde) en ambos  

Más detalle: [`INICIO-RAPIDO.md`](../INICIO-RAPIDO.md)

### A.7 — Manual (sin .bat)

**API:**

```cmd
cd /d C:\Users\mayro\Downloads\CEDIT\CEDIT
..\venv\Scripts\python.exe -m uvicorn api:app --host 127.0.0.1 --port 8001
```

**Frontend:**

```cmd
cd /d C:\Users\mayro\Downloads\CEDIT\CEDIT\frontend
npm run dev
```

**Discord:**

```cmd
cd /d C:\Users\mayro\Downloads\CEDIT\CEDIT
..\venv\Scripts\python.exe bot.py
```

---

## Parte B — Desplegar en la nube

### B.0 — Subir código a GitHub

```cmd
cd /d C:\Users\mayro\Downloads\CEDIT
git status
```

Confirma que **no** aparece `.env`.

```cmd
git add .
git commit -m "CEDIT: actualización"
git push origin main
```

Repo de referencia:  
`https://github.com/kimisamiyo/Agente-Autonomo-Consejero-Estatal-Digital-Ortiz-Razo-`

Estructura del repo:

```text
CEDIT/                 ← raíz git
  LICENSE
  README.md
  CEDIT/               ← api.py, bot.py, frontend/
    fly.api.toml
    fly.bots.toml
    scripts/
```

---

### B.1 — Login en Fly

Doble clic:

```text
scripts\7-CEDIT-Fly-Login.bat
```

O:

```cmd
cd /d C:\Users\mayro\Downloads\CEDIT\CEDIT
fly auth login
```

Se abre el navegador para iniciar sesión.

---

### B.2 — API en Fly (`cedit-api`)

**Opción rápida (todo en uno):**

```text
scripts\9-CEDIT-Fly-Deploy-Todo.bat
```

**Solo API:**

```text
scripts\8-CEDIT-Fly-Deploy-API.bat
```

**O manual:**

```cmd
cd /d C:\Users\mayro\Downloads\CEDIT\CEDIT
fly launch --config fly.api.toml --copy-config --no-deploy --yes --name cedit-api --region iad
```

Secretos (sustituye por tus valores del `.env`):

```cmd
fly secrets set -a cedit-api ^
  GROQ_API_KEY=TU_CLAVE ^
  PINECONE_API_KEY=TU_CLAVE ^
  GROQ_MODEL=meta-llama/llama-4-scout-17b-16e-instruct ^
  GROQ_MODEL_FALLBACK=llama-3.1-8b-instant
```

Blockchain (opcional, web):

```cmd
fly secrets set -a cedit-api SYSCOIN_RPC_URL=... CEDIT_CONTRACT_ADDRESS=0x... CEDIT_MINTER_PRIVATE_KEY=0x...
```

Desplegar:

```cmd
fly scale count 1 -a cedit-api -y
fly deploy --config fly.api.toml -a cedit-api
```

**Probar:**

```text
https://cedit-api.fly.dev/api/health
https://cedit-api.fly.dev/api/health/detail
```

En `detail` verás `primary` y `fallback` de Groq.

**Redeploy solo API** (tras cambios de código):

```text
scripts\15-CEDIT-Fly-Redeploy-API.bat
```

| Parámetro Fly API | Valor actual |
|-------------------|--------------|
| Puerto interno | **8080** (normal en logs; Fly expone HTTPS) |
| RAM | **2 GB** |
| Health | `/api/health` |

---

### B.3 — Discord en Fly (`cedit-bots`)

En Fly corre **solo Discord** (Telegram sigue en local con `3-CEDIT-Telegram.bat` para evitar conflictos de memoria).

Secretos:

```cmd
fly secrets set -a cedit-bots ^
  DISCORD_TOKEN=TU_TOKEN ^
  GROQ_API_KEY=TU_CLAVE ^
  PINECONE_API_KEY=TU_CLAVE ^
  GROQ_MODEL=meta-llama/llama-4-scout-17b-16e-instruct ^
  GROQ_MODEL_FALLBACK=llama-3.1-8b-instant ^
  CEDIT_WEB_URL=https://cedit-web.pages.dev
```

Desplegar:

```cmd
fly scale count 1 -a cedit-bots -y
fly deploy --config fly.bots.toml -a cedit-bots
```

Scripts:

| Script | Uso |
|--------|-----|
| `10-CEDIT-Fly-Redeploy-Bots.bat` | Redeploy bots |
| `14-CEDIT-Fly-Set-Web-URL.bat` | Solo URL web en Discord |

**Logs:**

```cmd
fly logs -a cedit-bots
```

Busca: `[CEDIT] ... conectado` y `Slash commands`.

**Probar Discord:**

- `/ayuda` → menú con botones  
- `!hola` → respuesta del mentor  
- Botón **Redes** → enlace a la web  

**Importante:** cierra `bot.py` local si Fly ya usa el mismo token.

---

### B.4 — Web en Cloudflare Pages

Guía visual: `scripts\11-CEDIT-Web-Cloudflare-Ayuda.bat`  
Si el build falla: `scripts\13-CEDIT-Fix-Cloudflare-Web.bat`

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**  
2. Elige el repo de GitHub  

**Build settings:**

| Campo | Valor (repo con carpeta `CEDIT/` padre) |
|-------|----------------------------------------|
| **Root directory** | `CEDIT/frontend` |
| **Build command** | `npm install && npm run build` |
| **Build output** | `dist` |

**Variables de entorno (Production):**

| Variable | Valor |
|----------|--------|
| `VITE_API_BASE_URL` | `https://cedit-api.fly.dev` (sin `/` final) |
| `VITE_CEDIT_WEB_URL` | `https://cedit-web.pages.dev` (tu URL `.pages.dev`) |

3. **Save and Deploy**  
4. Tras el primer deploy, confirma `VITE_CEDIT_WEB_URL` y **Retry deployment** si cambiaste variables  

**Probar:** abre tu URL Pages y envía un mensaje en el chat.

---

### B.5 — Telegram en producción (opcional)

Por defecto **no** va en Fly (ahorra RAM y evita caídas). En tu PC:

```cmd
scripts\3-CEDIT-Telegram.bat
```

Requiere API local o que adaptes el handler a la API en Fly (modo avanzado).

---

## Parte C — WhatsApp (solo local)

Meta exige URL pública; en plan gratis no hay dominio fijo sin túnel.

1. `2-CEDIT-Levantar.bat` (API en :8001)  
2. `WA-2-CEDIT-WhatsApp-Tunel.bat` → copia URL `https://....tunnelmole.net`  
3. Meta Developer → Webhook:  
   `https://TU-URL.tunnelmole.net/api/whatsapp/webhook`  
   Verify token: `cedit_webhook_secret` (o el de tu `.env`)  
4. Guía: `WA-1-CEDIT-WhatsApp-Ayuda.bat`  

Sin PC + túnel encendidos, WhatsApp no responde.

---

## Actualizar después de cambios

```cmd
cd /d C:\Users\mayro\Downloads\CEDIT
git add .
git commit -m "descripcion del cambio"
git push origin main
```

| Componente | Comando / acción |
|------------|------------------|
| API Fly | `scripts\15-CEDIT-Fly-Redeploy-API.bat` o `fly deploy --config fly.api.toml -a cedit-api` |
| Bots Fly | `scripts\10-CEDIT-Fly-Redeploy-Bots.bat` o `fly deploy --config fly.bots.toml -a cedit-bots` |
| Web | Push a GitHub → Cloudflare redeploy automático (o Retry manual) |
| Local | Cierra ventanas y vuelve a `2-CEDIT-Levantar.bat` |

---

## Problemas frecuentes

| Síntoma | Causa probable | Qué hacer |
|---------|----------------|-----------|
| Web «sin conexión» | API caída o URL mal en Cloudflare | Probar `/api/health`; revisar `VITE_API_BASE_URL` |
| Discord «La aplicación no respondió» | Bot local + Fly con mismo token, o deploy viejo | `fly scale count 1 -a cedit-bots`; redeploy; cerrar `bot.py` local |
| «Mucha demanda» (Groq) | Límite TPM/RPM free tier | Esperar 1–2 min; menos pestañas; revisar [console.groq.com](https://console.groq.com) |
| API reinicia en Fly | OOM al cargar embeddings | Ya configurado 2 GB; `fly logs -a cedit-api` |
| Log `8080` en Fly | Normal | Uvicorn escucha en 8080 **dentro** del contenedor; fuera es `https://cedit-api.fly.dev` |
| Cloudflare build falla | `package-lock` o root directory | Root `CEDIT/frontend`; ver `13-CEDIT-Fix-Cloudflare-Web.bat` |
| Telegram no responde en Fly | Telegram no está en Fly por diseño | Usar `3-CEDIT-Telegram.bat` en PC |
| n8n Unauthorized | Sesión vieja | Incógnito en :5678; ver `INICIO-RAPIDO.md` |

---

## Resumen de URLs

| Servicio | URL ejemplo |
|----------|-------------|
| **Web** | https://cedit-web.pages.dev |
| **API** | https://cedit-api.fly.dev |
| **Health** | https://cedit-api.fly.dev/api/health |
| **API docs** | https://cedit-api.fly.dev/docs |
| **Local API** | http://127.0.0.1:8001 |
| **Local web** | http://127.0.0.1:5173 |
| **Discord** | Bot en Fly (sin URL pública) |
| **Telegram** | Local o bot @iCEDIT_BOT |

---

## Scripts — índice rápido

Ver [`scripts/LEEME.txt`](../scripts/LEEME.txt)

| Script | Función |
|--------|---------|
| `1-CEDIT-Instalar.bat` | Instalación local |
| `2-CEDIT-Levantar.bat` | Todo local |
| `0-CEDIT-Detener.bat` | Detener API |
| `7-CEDIT-Fly-Login.bat` | Login Fly |
| `8-CEDIT-Fly-Deploy-API.bat` | Deploy API |
| `9-CEDIT-Fly-Deploy-Todo.bat` | API + bots completo |
| `10-CEDIT-Fly-Redeploy-Bots.bat` | Redeploy Discord |
| `11-CEDIT-Web-Cloudflare-Ayuda.bat` | Ayuda Cloudflare |
| `14-CEDIT-Fly-Set-Web-URL.bat` | URL web en bot |
| `15-CEDIT-Fly-Redeploy-API.bat` | Redeploy API |
| `DESPLIEGUE-COMANDOS-CMD.txt` | Comandos copiables |

---

## Licencia

[MIT](../../LICENSE) — Copyright (c) 2026 Mayrol Andre Ortiz Daza / Luis Razo.
