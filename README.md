# CEDIT — Consejero Estatal Digital

## Inicio rápido (2 clics tras `git pull`)

| Paso | Script | Qué hace |
|------|--------|----------|
| **1** | [`scripts/1-CEDIT-Instalar.bat`](scripts/1-CEDIT-Instalar.bat) | Crea `venv`, instala Python y `npm` del frontend |
| **2** | [`scripts/2-CEDIT-Levantar-Todo.bat`](scripts/2-CEDIT-Levantar-Todo.bat) | Abre 4 ventanas: API, Web, Discord, n8n |

### Ventanas que abre el paso 2

1. **1-CEDIT-API-8000** — Backend `http://127.0.0.1:8000`
2. **2-CEDIT-Web-5173** — Chat `http://127.0.0.1:5173`
3. **3-CEDIT-Discord** — Bot Discord
4. **4-CEDIT-n8n-5678** — Automatización `http://127.0.0.1:5678`

### Requisitos

- Python 3.11 o 3.12
- Node.js LTS (frontend)
- Archivo `.env` en esta carpeta (`CEDIT/`) con claves API y `DISCORD_TOKEN`
- n8n global: `npm install -g n8n` (opcional)

### Manual (una sola terminal API)

```powershell
cd CEDIT
..\venv\Scripts\python.exe -m uvicorn api:app --reload --host 127.0.0.1 --port 8000
```

Más detalle: [`INICIO-RAPIDO.md`](INICIO-RAPIDO.md) · Alma del agente: [`SOUL.md`](SOUL.md)
