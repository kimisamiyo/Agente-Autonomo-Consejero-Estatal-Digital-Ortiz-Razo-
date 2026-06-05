# CEDIT — Complete guide: local setup and free deployment

[Español — Guía completa](DESPLIEGUE_GRATIS.md) · **English**

**CEDIT** (Digital State Advisor) — MEF / Invierte.pe mentor on **web**, **Discord**, **Telegram**, and (optional) **WhatsApp**.

This guide covers **two paths**:

| Path | Purpose | 24/7? |
|------|---------|-------|
| **A — Local (Windows)** | Develop, test, WhatsApp via tunnel | Only while your PC is on |
| **B — Cloud (free tier)** | Web + API + Discord in production | Yes (Fly + Cloudflare) |

**Recommended cloud order:** GitHub → API (Fly) → Bots (Fly) → Web (Cloudflare) → WhatsApp (local).

---

## Table of contents

1. [Requirements and secrets](#1-requirements-and-secrets)
2. [Part A — Run everything locally](#part-a--run-everything-locally-windows)
3. [Part B — Deploy to the cloud](#part-b--deploy-to-the-cloud)
4. [Part C — WhatsApp (local only)](#part-c--whatsapp-local-only)
5. [Updating after changes](#updating-after-changes)
6. [Common issues](#common-issues)
7. [URL summary](#url-summary)

---

## 1. Requirements and secrets

### Software (Windows)

| Tool | Use |
|------|-----|
| [Python 3.11 or 3.12](https://www.python.org/downloads/) | API, bots, core |
| [Node.js LTS](https://nodejs.org) | Frontend, n8n, WhatsApp tunnel |
| [Git](https://git-scm.com/download/win) | Push code to GitHub |
| [Fly CLI](https://fly.io/docs/hands-on/install-flyctl/) | API and bots 24/7 |

Fly on Windows:

```powershell
winget install Fly-io.flyctl
```

Close and reopen the terminal. Test:

```cmd
fly version
```

If not recognized: `%USERPROFILE%\.fly\bin\flyctl.exe version`

### `.env` file (never commit to Git)

Copy the template:

```text
CEDIT\.env.example  →  CEDIT\.env
```

Fill at least:

| Variable | Required | Used in |
|----------|----------|---------|
| `GROQ_API_KEY` | Yes | API + bots (AI) |
| `PINECONE_API_KEY` | Yes | Normative RAG |
| `GROQ_MODEL` | Recommended | `meta-llama/llama-4-scout-17b-16e-instruct` |
| `GROQ_MODEL_FALLBACK` | Recommended | `llama-3.1-8b-instant` (separate quota) |
| `DISCORD_TOKEN` | If using Discord | Discord bot |
| `TELEGRAM_BOT_TOKEN` | If using Telegram | Telegram bot |
| `CEDIT_WEB_URL` | In cloud | Public web URL (Networks button) |
| `SYSCOIN_*`, `CEDIT_CONTRACT_*` | Optional | Blockchain mint on web |

**Rule:** `git status` must **not** list `.env`. If it does, do not commit.

### Accounts (cloud)

1. [GitHub](https://github.com) — source code  
2. [Fly.io](https://fly.io) — API + Discord (may ask for a card; free allowance with limits)  
3. [Cloudflare](https://dash.cloudflare.com) — static web  
4. [Groq Console](https://console.groq.com) — AI key  
5. [Pinecone](https://www.pinecone.io) — vector index  

---

## Part A — Run everything locally (Windows)

Base path (adjust if you cloned elsewhere):

```text
C:\Users\mayro\Downloads\CEDIT\CEDIT
```

Python `venv` is usually in the **parent** folder:

```text
C:\Users\mayro\Downloads\CEDIT\venv
```

### A.1 — Install (once)

Double-click or from CMD:

```cmd
cd /d C:\Users\mayro\Downloads\CEDIT\CEDIT\scripts
1-CEDIT-Instalar.bat
```

Creates `venv` → `pip install` → `npm install` in `frontend/`.

### A.2 — Start all services

```cmd
2-CEDIT-Levantar.bat
```

Opens separate windows:

| Window | URL / action |
|--------|----------------|
| API | http://127.0.0.1:8001 |
| Web (chat) | http://127.0.0.1:5173 |
| Discord | Bot online if `DISCORD_TOKEN` is set |
| n8n | http://127.0.0.1:5678 |
| Telegram | If `TELEGRAM_BOT_TOKEN` is set |

**Check API:**

```text
http://127.0.0.1:8001/api/health
```

Expected: `{"status":"ok","service":"CEDIT"}`

**Check web:** open http://127.0.0.1:5173 and send a message.

### A.3 — Stop services

```cmd
0-CEDIT-Detener.bat
```

Frees ports 8000/8001.

### A.4 — Individual services

| Script | Starts |
|--------|--------|
| `3-CEDIT-Telegram.bat` | Telegram only |
| `4-CEDIT-n8n.bat` | n8n only |

### A.5 — Discord locally

- Slash commands: `/ayuda`, `/auditar`, etc.  
- Text: `!` + query (e.g. `!hello` or `! What are my rights?`)  
- Do **not** run local `bot.py` **and** Fly with the same `DISCORD_TOKEN` (one session only).

### A.6 — n8n (optional)

1. Import JSON files from `CEDIT/n8n/` at http://localhost:5678  
2. Activate **first** `CEDIT-02-Blockchain-Registro.json`, **then** `CEDIT-01-Entrada-Omnicanal.json`  
3. Toggle **Active** (green) on both  

More detail: [`INICIO-RAPIDO.md`](../INICIO-RAPIDO.md)

### A.7 — Manual (without .bat)

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

## Part B — Deploy to the cloud

### B.0 — Push code to GitHub

```cmd
cd /d C:\Users\mayro\Downloads\CEDIT
git status
```

Confirm `.env` does **not** appear.

```cmd
git add .
git commit -m "CEDIT: update"
git push origin main
```

Reference repo:  
`https://github.com/kimisamiyo/Agente-Autonomo-Consejero-Estatal-Digital-Ortiz-Razo-`

Repo layout:

```text
CEDIT/                 ← git root
  LICENSE
  README.md
  CEDIT/               ← api.py, bot.py, frontend/
    fly.api.toml
    fly.bots.toml
    scripts/
```

---

### B.1 — Fly login

Double-click:

```text
scripts\7-CEDIT-Fly-Login.bat
```

Or:

```cmd
cd /d C:\Users\mayro\Downloads\CEDIT\CEDIT
fly auth login
```

Browser opens for sign-in.

---

### B.2 — API on Fly (`cedit-api`)

**Quick (all-in-one):**

```text
scripts\9-CEDIT-Fly-Deploy-Todo.bat
```

**API only:**

```text
scripts\8-CEDIT-Fly-Deploy-API.bat
```

**Or manual:**

```cmd
cd /d C:\Users\mayro\Downloads\CEDIT\CEDIT
fly launch --config fly.api.toml --copy-config --no-deploy --yes --name cedit-api --region iad
```

Secrets (replace with your `.env` values):

```cmd
fly secrets set -a cedit-api ^
  GROQ_API_KEY=YOUR_KEY ^
  PINECONE_API_KEY=YOUR_KEY ^
  GROQ_MODEL=meta-llama/llama-4-scout-17b-16e-instruct ^
  GROQ_MODEL_FALLBACK=llama-3.1-8b-instant
```

Blockchain (optional, web):

```cmd
fly secrets set -a cedit-api SYSCOIN_RPC_URL=... CEDIT_CONTRACT_ADDRESS=0x... CEDIT_MINTER_PRIVATE_KEY=0x...
```

Deploy:

```cmd
fly scale count 1 -a cedit-api -y
fly deploy --config fly.api.toml -a cedit-api
```

**Test:**

```text
https://cedit-api.fly.dev/api/health
https://cedit-api.fly.dev/api/health/detail
```

`detail` shows Groq `primary` and `fallback`.

**API-only redeploy** (after code changes):

```text
scripts\15-CEDIT-Fly-Redeploy-API.bat
```

| Fly API setting | Current value |
|-----------------|---------------|
| Internal port | **8080** (normal in logs; Fly exposes HTTPS) |
| RAM | **2 GB** |
| Health | `/api/health` |

---

### B.3 — Discord on Fly (`cedit-bots`)

Fly runs **Discord only** (Telegram stays local via `3-CEDIT-Telegram.bat` to save RAM).

Secrets:

```cmd
fly secrets set -a cedit-bots ^
  DISCORD_TOKEN=YOUR_TOKEN ^
  GROQ_API_KEY=YOUR_KEY ^
  PINECONE_API_KEY=YOUR_KEY ^
  GROQ_MODEL=meta-llama/llama-4-scout-17b-16e-instruct ^
  GROQ_MODEL_FALLBACK=llama-3.1-8b-instant ^
  CEDIT_WEB_URL=https://cedit-web.pages.dev
```

Deploy:

```cmd
fly scale count 1 -a cedit-bots -y
fly deploy --config fly.bots.toml -a cedit-bots
```

Scripts:

| Script | Use |
|--------|-----|
| `10-CEDIT-Fly-Redeploy-Bots.bat` | Redeploy bots |
| `14-CEDIT-Fly-Set-Web-URL.bat` | Web URL in Discord only |

**Logs:**

```cmd
fly logs -a cedit-bots
```

Look for: `[CEDIT] ... conectado` and `Slash commands`.

**Test Discord:**

- `/ayuda` → menu with buttons  
- `!hello` → mentor reply  
- **Networks** button → web link  

**Important:** stop local `bot.py` if Fly uses the same token.

---

### B.4 — Web on Cloudflare Pages

Visual help: `scripts\11-CEDIT-Web-Cloudflare-Ayuda.bat`  
Build fails: `scripts\13-CEDIT-Fix-Cloudflare-Web.bat`

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**  
2. Select your GitHub repo  

**Build settings:**

| Field | Value (repo with parent `CEDIT/` folder) |
|-------|------------------------------------------|
| **Root directory** | `CEDIT/frontend` |
| **Build command** | `npm install && npm run build` |
| **Build output** | `dist` |

**Environment variables (Production):**

| Variable | Value |
|----------|--------|
| `VITE_API_BASE_URL` | `https://cedit-api.fly.dev` (no trailing `/`) |
| `VITE_CEDIT_WEB_URL` | `https://cedit-web.pages.dev` (your `.pages.dev` URL) |

3. **Save and Deploy**  
4. After first deploy, confirm `VITE_CEDIT_WEB_URL` and **Retry deployment** if you changed variables  

**Test:** open your Pages URL and send a chat message.

---

### B.5 — Telegram in production (optional)

By default **not** on Fly (saves RAM). On your PC:

```cmd
scripts\3-CEDIT-Telegram.bat
```

Requires local API or advanced handler wiring to Fly API.

---

## Part C — WhatsApp (local only)

Meta requires a public URL; free tier has no fixed domain without a tunnel.

1. `2-CEDIT-Levantar.bat` (API on :8001)  
2. `WA-2-CEDIT-WhatsApp-Tunel.bat` → copy `https://....tunnelmole.net`  
3. Meta Developer → Webhook:  
   `https://YOUR-URL.tunnelmole.net/api/whatsapp/webhook`  
   Verify token: `cedit_webhook_secret` (or your `.env` value)  
4. Guide: `WA-1-CEDIT-WhatsApp-Ayuda.bat`  

Without PC + tunnel running, WhatsApp will not respond.

---

## Updating after changes

```cmd
cd /d C:\Users\mayro\Downloads\CEDIT
git add .
git commit -m "description of change"
git push origin main
```

| Component | Command / action |
|-----------|------------------|
| Fly API | `scripts\15-CEDIT-Fly-Redeploy-API.bat` or `fly deploy --config fly.api.toml -a cedit-api` |
| Fly bots | `scripts\10-CEDIT-Fly-Redeploy-Bots.bat` or `fly deploy --config fly.bots.toml -a cedit-bots` |
| Web | Push to GitHub → Cloudflare auto-redeploy (or manual Retry) |
| Local | Close windows and run `2-CEDIT-Levantar.bat` again |

---

## Common issues

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Web “no connection” | API down or wrong Cloudflare URL | Check `/api/health`; verify `VITE_API_BASE_URL` |
| Discord “The application did not respond” | Local bot + Fly same token, or old deploy | `fly scale count 1 -a cedit-bots`; redeploy; stop local `bot.py` |
| “High demand” (Groq) | Free tier TPM/RPM limit | Wait 1–2 min; fewer tabs; check [console.groq.com](https://console.groq.com) |
| API restarts on Fly | OOM loading embeddings | 2 GB configured; `fly logs -a cedit-api` |
| Log shows `8080` on Fly | Normal | Uvicorn listens on 8080 **inside** container; public URL is `https://cedit-api.fly.dev` |
| Cloudflare build fails | `package-lock` or root directory | Root `CEDIT/frontend`; see `13-CEDIT-Fix-Cloudflare-Web.bat` |
| Telegram silent on Fly | Telegram not on Fly by design | Use `3-CEDIT-Telegram.bat` on PC |
| n8n Unauthorized | Stale session | Incognito on :5678; see `INICIO-RAPIDO.md` |

---

## URL summary

| Service | Example URL |
|---------|-------------|
| **Web** | https://cedit-web.pages.dev |
| **API** | https://cedit-api.fly.dev |
| **Health** | https://cedit-api.fly.dev/api/health |
| **API docs** | https://cedit-api.fly.dev/docs |
| **Local API** | http://127.0.0.1:8001 |
| **Local web** | http://127.0.0.1:5173 |
| **Discord** | Bot on Fly (no public URL) |
| **Telegram** | Local or bot @iCEDIT_BOT |

---

## Scripts — quick index

See [`scripts/LEEME.txt`](../scripts/LEEME.txt)

| Script | Function |
|--------|----------|
| `1-CEDIT-Instalar.bat` | Local install |
| `2-CEDIT-Levantar.bat` | Start everything locally |
| `0-CEDIT-Detener.bat` | Stop API |
| `7-CEDIT-Fly-Login.bat` | Fly login |
| `8-CEDIT-Fly-Deploy-API.bat` | Deploy API |
| `9-CEDIT-Fly-Deploy-Todo.bat` | Full API + bots |
| `10-CEDIT-Fly-Redeploy-Bots.bat` | Redeploy Discord |
| `11-CEDIT-Web-Cloudflare-Ayuda.bat` | Cloudflare help |
| `14-CEDIT-Fly-Set-Web-URL.bat` | Web URL in bot |
| `15-CEDIT-Fly-Redeploy-API.bat` | Redeploy API |
| `DESPLIEGUE-COMANDOS-CMD.txt` | Copy-paste commands |

---

## License

[MIT](../../LICENSE) — Copyright (c) 2026 Mayrol Andre Ortiz Daza / Luis Razo.
