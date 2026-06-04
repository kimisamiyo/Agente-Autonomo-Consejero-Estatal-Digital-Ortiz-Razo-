"""
URLs de canal omnicanal para atestación PDF (CeditFirmasPdf).
"""
from __future__ import annotations

import os

from cedit_links import DISCORD_SERVER_INVITE, TELEGRAM_BOT_URL, WEB_APP_URL


def build_channel_url(
    channel: str,
    *,
    conversation_id: str = "",
    discord_channel_id: int | str = "",
    telegram_chat_id: str = "",
) -> str:
    ch = (channel or "Web").strip()
    web_base = (WEB_APP_URL or "http://127.0.0.1:5173").rstrip("/")

    if ch.lower() == "web":
        if conversation_id:
            return f"{web_base}/?conversation={conversation_id}"
        return web_base

    if ch.lower() == "discord":
        if discord_channel_id:
            return f"https://discord.com/channels/@me/{discord_channel_id}"
        return DISCORD_SERVER_INVITE

    if ch.lower() == "telegram":
        if telegram_chat_id:
            return f"{TELEGRAM_BOT_URL}?start=chat_{telegram_chat_id}"
        return TELEGRAM_BOT_URL

    if ch.lower() == "whatsapp":
        phone_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "").strip()
        if phone_id:
            return f"https://wa.me/{phone_id}"
        return "https://wa.me/"

    return web_base
