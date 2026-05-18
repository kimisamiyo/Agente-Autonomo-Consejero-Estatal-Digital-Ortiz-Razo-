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
