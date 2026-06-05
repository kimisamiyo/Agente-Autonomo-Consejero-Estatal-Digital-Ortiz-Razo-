"""
Enlaces públicos CEDIT — Discord, Telegram y web (única fuente para bots).
"""
from __future__ import annotations

import os

DISCORD_CLIENT_ID = os.getenv("DISCORD_CLIENT_ID", "1503228806406733844")
DISCORD_BOT_INVITE = (
    f"https://discord.com/oauth2/authorize?client_id={DISCORD_CLIENT_ID}"
    "&permissions=2147601408&integration_type=0&scope=bot+applications.commands"
)
DISCORD_SERVER_INVITE = os.getenv("DISCORD_SERVER_INVITE", "https://discord.gg/QANgqeZuJU")
TELEGRAM_BOT_URL = os.getenv("TELEGRAM_BOT_URL", "https://t.me/iCEDIT_BOT")
TELEGRAM_BOT_USERNAME = os.getenv("TELEGRAM_BOT_USERNAME", "iCEDIT_BOT")


def _resolve_web_url() -> str:
    for key in ("CEDIT_WEB_URL", "VITE_CEDIT_WEB_URL", "CEDIT_WEB_APP_URL"):
        raw = os.getenv(key, "").strip()
        if raw:
            return raw.rstrip("/")
    return ""


WEB_APP_URL = _resolve_web_url()
WEB_APP_COMING_SOON = (
    "Web CEDIT — por el momento en despliegue; el enlace público se publicará aquí."
)
