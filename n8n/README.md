# Flujos n8n para CEDIT

Importa **en este orden** en tu n8n local (`http://localhost:5678`):

1. `CEDIT-01-Entrada-Omnicanal.json` — recibe chat web/Discord y llama a FastAPI
2. `CEDIT-02-Blockchain-Registro.json` — registra auditorías (hash + respuesta)

## Pasos rápidos

1. Abre n8n → **Workflows** → menú **⋯** → **Import from File** (o `Ctrl+V` con el JSON copiado).
2. Importa el **01**, luego el **02**.
3. En cada workflow: **Save** y activa el toggle **Active**.
4. Copia las URLs de prueba de los nodos Webhook (Production/Test).
5. Asegúrate de que FastAPI corre en `http://localhost:8000` (`uvicorn api:app --reload`).

## Conexión con el frontend

El proxy de Vite envía `/n8n/*` → `http://localhost:5678/webhook-test/cedit/*`

- Chat web: `POST http://localhost:5173/n8n/chat` → n8n → FastAPI `/api/chat`
- Blockchain: el flujo 01 llama al 02 cuando detecta auditoría

## Variables

| Variable | Valor por defecto |
|----------|-------------------|
| `CEDIT_API_URL` | `http://host.docker.internal:8000` (n8n en Docker) o `http://127.0.0.1:8000` (n8n local) |

Si n8n y FastAPI están en la misma máquina sin Docker, edita los nodos HTTP y usa `http://127.0.0.1:8000`.
