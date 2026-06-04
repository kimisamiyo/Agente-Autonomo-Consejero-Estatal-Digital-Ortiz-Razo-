# Despliegue gratuito CEDIT (web + Discord + Telegram 24/7)

WhatsApp **no** entra en este plan: sigue en tu PC con `scripts/WA-2-CEDIT-WhatsApp-Tunel.bat` y Tunnelmole.

## Qué vas a tener

| Pieza | Dónde (gratis) | ¿24/7? |
|--------|----------------|--------|
| **Web** (React) | Cloudflare Pages o Vercel | Sí (estático) |
| **API** (FastAPI) | Fly.io o Render | Fly: sí* · Render free: duerme ~15 min sin visitas |
| **Discord + Telegram** | Fly.io (`cedit-bots`) u Oracle VM | Sí en Fly/Oracle |
| **WhatsApp** | Local + túnel | Solo con el PC encendido |

\* Fly.io incluye crédito mensual gratis; con `auto_stop_machines = off` la API no se apaga.

## Requisitos previos

1. Código en **GitHub** (sin `.env`; usa `.env.example`).
2. Cuentas: [Fly.io](https://fly.io), [Cloudflare](https://dash.cloudflare.com) (Pages).
3. Mismas claves que en local: Groq, Pinecone, `DISCORD_TOKEN`, `TELEGRAM_BOT_TOKEN`.

---

## Paso 1 — API en Fly.io (recomendado)

Desde la carpeta `CEDIT` (donde está `api.py`):

```bash
# Instalar CLI: https://fly.io/docs/hands-on/install-flyctl/
fly auth login
fly launch --config fly.api.toml --copy-config --no-deploy
```

En el asistente, elige **no** crear Postgres/Redis. Cambia el nombre `cedit-api` si ya existe.

Carga secretos (mismo contenido que tu `.env` local, sin WhatsApp si quieres):

```bash
fly secrets set GROQ_API_KEY=gsk_... PINECONE_API_KEY=... GROQ_MODEL=llama-3.3-70b-versatile GROQ_MODEL_FALLBACK=llama-3.1-8b-instant
```

Despliega:

```bash
fly deploy --config fly.api.toml
```

Comprueba: `https://cedit-api.fly.dev/api/health` (sustituye por tu app). Debe mostrar `llama-3.3-70b-versatile` en `groq`.

**Alternativa API (más simple, no 24/7):** en [Render](https://render.com) → New → Blueprint → conecta el repo y usa `render.yaml`. La primera petición tras dormir puede tardar ~1 min.

---

## Paso 2 — Bots Discord + Telegram en Fly.io

Segunda app (mismo repo, otro `fly.toml`):

```bash
fly launch --config fly.bots.toml --copy-config --no-deploy
fly secrets set DISCORD_TOKEN=... TELEGRAM_BOT_TOKEN=... GROQ_API_KEY=... PINECONE_API_KEY=... GROQ_MODEL=llama-3.3-70b-versatile GROQ_MODEL_FALLBACK=llama-3.1-8b-instant
fly deploy --config fly.bots.toml
fly logs -a cedit-bots
```

Debes ver líneas de `cedit.telegram.bot` y el bot de Discord conectado.

**Nota:** la primera consulta en Discord/Telegram puede tardar porque carga el modelo de embeddings (~500 MB RAM). `fly.api.toml` y `fly.bots.toml` piden **512 MB**; si falla OOM, sube a 1 GB en el dashboard de Fly.

---

## Paso 3 — Web en Cloudflare Pages

1. Dashboard → **Workers & Pages** → Create → **Pages** → Connect Git.
2. Proyecto: carpeta raíz del repo; **Build command:**  
   `cd CEDIT/frontend && npm ci && npm run build`
3. **Build output directory:** `CEDIT/frontend/dist`
4. **Environment variables** (Production):

   | Variable | Valor |
   |----------|--------|
   | `VITE_API_BASE_URL` | `https://cedit-api.fly.dev` (sin `/` final) |
   | `VITE_CEDIT_WEB_URL` | `https://tu-proyecto.pages.dev` |

5. Deploy. Abre la URL y prueba el chat.

**Vercel:** igual, root `CEDIT/frontend`, mismas variables `VITE_*`.

---

## Paso 4 — WhatsApp (sigue en local)

No hay tier gratis fiable con URL fija para Meta sin pagar. En tu máquina:

1. `scripts/2-CEDIT-Levantar.bat` (API en 8001).
2. `scripts/WA-2-CEDIT-WhatsApp-Tunel.bat` (Tunnelmole).
3. Webhook en Meta apuntando a la URL del túnel.

---

## Opción todo-en-uno (Oracle Cloud Always Free)

Si prefieres **una sola VM** 24/7 (API + bots + opcional túnel):

1. Crea una VM **ARM** Ubuntu en Oracle Cloud (Always Free).
2. Clona el repo, `python3 -m venv venv`, `pip install -r requirements-deploy.txt`.
3. Copia `.env` a `CEDIT/.env`.
4. Usa `systemd` o `screen`/`tmux`:

   ```bash
   uvicorn api:app --host 0.0.0.0 --port 8000
   python run_bots.py
   ```

5. Abre el puerto 8000 en el firewall de Oracle; sirve el front con `npm run build` + nginx, o despliega solo el front en Cloudflare apuntando a `http://IP:8000` (mejor HTTPS con Caddy + dominio).

---

## Variables importantes en la nube

- **Nunca** subas `.env` a Git.
- En Fly: `fly secrets set KEY=value`.
- En Cloudflare Pages: solo `VITE_*` (son públicas en el bundle; no pongas claves secretas ahí).
- CORS en `api.py` ya permite `*`; la web en otro dominio funcionará con `VITE_API_BASE_URL`.

---

## Resumen de coste

| Servicio | Coste típico |
|----------|----------------|
| Cloudflare Pages | $0 |
| Fly.io API + bots | $0 dentro del crédito mensual |
| Render API free | $0 (con sleep) |
| Groq / Pinecone | Cuotas gratis de cada proveedor |
| WhatsApp Meta | Gratis en modo prueba; túnel local $0 |

---

## Comandos útiles

```bash
# API
fly status -a cedit-api
fly logs -a cedit-api

# Bots
fly logs -a cedit-bots
fly ssh console -a cedit-bots

# Re-desplegar tras cambios en Git
fly deploy --config fly.api.toml
fly deploy --config fly.bots.toml
```

Si algo falla, revisa `/api/health` en la API y los logs de `cedit-bots` en Fly.
