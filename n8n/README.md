# Flujos n8n para CEDIT

Importa en tu n8n local (`http://localhost:5678`):

| Orden | Archivo | Función |
|-------|---------|---------|
| 1 | `CEDIT-02-Blockchain-Registro.json` | Hash / trazabilidad |
| 2 | `CEDIT-01-Entrada-Omnicanal.json` | Chat web → FastAPI |
| 3 | `CEDIT-03-MEF-Noticias-Diarias.json` | **08:00** — radar [noticias MEF](https://www.gob.pe/institucion/mef/noticias) |

## Pasos rápidos

1. Inicia n8n: `cmd /c "n8n"` (en PowerShell puro `n8n` puede dar UnauthorizedAccess).
2. Importa **02 → 01 → 03**. Activa **02**, luego **01**, luego **03**.
3. FastAPI en `http://127.0.0.1:8000`: `uvicorn api:app --reload`
4. Zona horaria del flujo 03: `America/Lima` (8:00 Perú si el servidor usa esa TZ). Opcional al arrancar n8n: `set TZ=America/Lima` antes de `n8n`.

## Flujo 03 — Radar noticias MEF

- **Cron:** `0 8 * * *` (todos los días a las 08:00).
- **Módulo Python:** `mef_news_automation.py` — descarga el listado Gob.pe, detecta enlaces nuevos, comprueba URLs y marca relevancia para inversión pública.
- **API:** `POST /api/automation/mef-news/sync` (lo llama n8n).
- **Estado local:** `.cedit_mef_news_state.json` (no se sube a git).
- **Prueba manual sin esperar al cron:**
  - `POST http://localhost:8000/api/automation/mef-news/sync`
  - o activar el 03 y llamar: `POST http://localhost:5678/webhook/cedit/automation/mef-news`
- **Discord (opcional):** variable de entorno en n8n `DISCORD_MEF_NEWS_WEBHOOK_URL` con la URL del webhook del canal.

### Seguridad opcional

En `.env` del backend: `CEDIT_AUTOMATION_KEY=una-clave-secreta`  
n8n debe enviar header `X-Automation-Key` con el mismo valor (añadir en el nodo HTTP si lo usas).

## Conexión con el frontend

El proxy de Vite envía `/n8n/*` → `http://localhost:5678/webhook/cedit/*` (workflows **Active**)

- Chat web: `POST http://localhost:5173/n8n/chat` → n8n 01 → FastAPI `/api/chat`
- Si n8n devuelve 404, la web usa `/api/chat` directo (requiere uvicorn).
- **Importante:** el botón *Execute workflow* en el editor **no** activa el webhook; debe estar el toggle **Active** en verde.
- Blockchain: el flujo 01 llama al 02 cuando hay auditoría
- Idioma: `locale` + `X-Locale` en el body/headers (reimportar 01 si estaba viejo)

## Variables

| Variable | Uso |
|----------|-----|
| `CEDIT_API_URL` | `http://127.0.0.1:8000` (n8n local) |
| `DISCORD_MEF_NEWS_WEBHOOK_URL` | Aviso diario de noticias nuevas (flujo 03) |
| `CEDIT_AUTOMATION_KEY` | Proteger `/api/automation/*` (opcional) |
| `TZ` | `America/Lima` para cron 8:00 Perú |

Si n8n está en Docker y FastAPI en el host, usa `http://host.docker.internal:8000` en los nodos HTTP.
