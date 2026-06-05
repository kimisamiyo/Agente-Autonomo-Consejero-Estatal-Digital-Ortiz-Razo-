# CEDIT — Consejero Estatal Digital

Licencia: [MIT](../LICENSE) — Copyright (c) 2026 Mayrol Andre Ortiz Daza / Luis Razo.

## Inicio rápido (2 clics tras `git pull`)

| Paso | Script | Qué hace |
|------|--------|----------|
| **1** | [`scripts/1-CEDIT-Instalar.bat`](scripts/1-CEDIT-Instalar.bat) | venv → pip → verificar API → npm (orden fijo) |
| **2** | [`scripts/2-CEDIT-Levantar.bat`](scripts/2-CEDIT-Levantar.bat) | API → Web → Discord → n8n → Telegram |

Lista completa: [`scripts/LEEME.txt`](scripts/LEEME.txt)

### Ventanas que abre el paso 2

1. **1-CEDIT-API-8001** — Backend `http://127.0.0.1:8001`
2. **2-CEDIT-Web-5173** — Chat `http://127.0.0.1:5173`
3. **3-CEDIT-Discord** — Bot Discord
4. **4-CEDIT-n8n-5678** — Automatización `http://127.0.0.1:5678`
5. **5-CEDIT-Telegram** — Bot Telegram (si hay token en `.env`)

### WhatsApp (aparte)

1. [`scripts/WA-1-CEDIT-WhatsApp-Ayuda.bat`](scripts/WA-1-CEDIT-WhatsApp-Ayuda.bat) — guía Meta
2. Con el paso 2 ya activo: [`scripts/WA-2-CEDIT-WhatsApp-Tunel.bat`](scripts/WA-2-CEDIT-WhatsApp-Tunel.bat)

### Requisitos

- Python 3.11 o 3.12
- Node.js LTS (frontend y túnel WhatsApp)
- Archivo `.env` en esta carpeta (`CEDIT/`) con claves API, `DISCORD_TOKEN`, `TELEGRAM_BOT_TOKEN`
- n8n global: `npm install -g n8n` (opcional)

### Manual (una sola terminal API)

```powershell
cd CEDIT
..\venv\Scripts\python.exe -m uvicorn api:app --host 127.0.0.1 --port 8001
```

Detener API: `scripts/0-CEDIT-Detener.bat`

Más detalle: [`INICIO-RAPIDO.md`](INICIO-RAPIDO.md) · Alma del agente: [`SOUL.md`](SOUL.md)
