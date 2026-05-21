# Inicio rápido CEDIT (Windows)

## Errores comunes en PowerShell

### `n8n` o `npm` bloqueados
PowerShell puede bloquear scripts. Usa **cmd**:

```cmd
cmd /c "n8n"
cmd /c "npm run dev"
```

### `venv` no encontrado
El entorno virtual está en la carpeta **padre** del proyecto:

```powershell
cd C:\Users\mayro\Downloads\CEDIT
.\venv\Scripts\activate
cd CEDIT
uvicorn api:app --reload
```

### Proxy `/api/usage` ECONNREFUSED
El frontend (5173) necesita la API en **8000**. Levanta `uvicorn` antes que `npm run dev`.

### Discord `Command "buenas" is not found`
Escribe consultas con **`!`** al inicio, por ejemplo: `! ¿Cuáles son mis derechos?`  
O usa **`/ayuda`** para el menú con botones.

---

## n8n — «Unauthorized» o webhooks 404

### «Unauthorized» al abrir un workflow en el editor

Suele ser **sesión vieja** tras `n8n user-management:reset` (ese comando borra usuarios y deja la base en estado inicial).

1. Cierra pestañas de `http://localhost:5678`.
2. Abre **ventana de incógnito** o borra cookies de `localhost:5678`.
3. Arranca n8n: `cmd /c "n8n"`.
4. Entra de nuevo y completa **Owner setup** (email + contraseña nuevos).
5. Importa otra vez los JSON de `n8n/` si la lista de workflows está vacía.

Si PowerShell dice **UnauthorizedAccess** al escribir `n8n`, no es n8n: es la política de scripts. Usa siempre `cmd /c "n8n"`.

### `404 The requested webhook "cedit/chat" is not registered`

El flujo **no está activo** o no se importó el workflow.

1. Importa y activa **primero** `CEDIT-02-Blockchain-Registro.json`, **después** `CEDIT-01-Entrada-Omnicanal.json`.
2. Toggle **Active** (verde) en ambos → **Save**.
3. FastAPI en puerto **8000**.
4. El frontend usa `http://localhost:5173/n8n/chat` → proxy → `http://localhost:5678/webhook/cedit/chat` (con workflows activos).

### El toggle Active no pasa / se queda cargando

1. Elimina workflows CEDIT duplicados en n8n (solo debe haber un 01 y un 02).
2. Vuelve a **Import from File** con los JSON de la carpeta `n8n/` (versión actual del repo).
3. Activa **02** primero, luego **01**. Si falla un nodo, abre el workflow y revisa que no haya icono de error rojo.

### Hablo con CEDIT y no pasa nada

En la consola de n8n suele aparecer: `webhook "POST cedit/chat" is not registered`.

1. El flujo **01 no está Active** (el botón *Execute workflow* en el editor **no** registra el webhook de producción).
2. Arriba a la derecha del workflow: interruptor **Active** en verde → **Save**.
3. Deben estar encendidos **uvicorn** (8000) y **n8n** (5678).
4. La web llama `/n8n/chat` → `http://localhost:5678/webhook/cedit/chat`. Si n8n falla, la app usa `/api/chat` sola (necesita uvicorn).

Comprueba en el navegador (con 01 Active): debe responder JSON, no 404.
`http://localhost:5678/webhook/cedit/chat` (solo POST; usa la app o Postman).

### `401 Wrong username or password`

Contraseña distinta a la del owner actual. Tras un reset, solo vale la cuenta creada en el primer arranque posterior; si no la recuerdas: `cmd /c "n8n user-management:reset"` y vuelve a registrar owner (incógnito + reimportar workflows).

---

## Radar noticias MEF (n8n flujo 03)

Cada día a las **8:00** (configurable en n8n) revisa enlaces nuevos en  
https://www.gob.pe/institucion/mef/noticias

1. Importa y activa `n8n/CEDIT-03-MEF-Noticias-Diarias.json` (con FastAPI encendido).
2. Prueba: `POST http://127.0.0.1:8000/api/automation/mef-news/sync`
3. Ver historial: `GET http://127.0.0.1:8000/api/automation/mef-news/latest`

Detalle en `n8n/README.md`.

---

## Tres terminales

| Terminal | Comando |
|----------|---------|
| API | `uvicorn api:app --reload` (desde `CEDIT\CEDIT` con venv activo) |
| Web | `cd frontend` → `cmd /c "npm run dev"` |
| Discord | `python bot.py` |

## Nombre y avatar del bot

- **Nombre visible:** `CEDIT - Agent` (cambiable con `DISCORD_BOT_NAME` en `.env`)
- **Avatar:** `CEDIT/assets/cedit-discord-avatar.png`

Al iniciar `python bot.py`, se aplica **una vez**. Para forzar: `set CEDIT_FORCE_AVATAR=1` y reinicia.

Manual: `python scripts/set_discord_profile.py`

## Discord — diseño restaurado

- Embed de bienvenida con bandera de Perú y botones
- **`!`** + pregunta para chatear
- PDF adjunto → auditoría + **barra de auditoría**
- **`/reiniciar_memoria`** — nueva conversación y cupos gratis
- **`/conectar_wallet`** — Plan Pro (demo: cualquier texto en `wallet`)
