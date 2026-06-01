"""
Cliente Meta WhatsApp Cloud API — envío de texto y descarga de media.
"""
from __future__ import annotations

import logging
import os
import time
from pathlib import Path
from typing import List, Optional

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

log = logging.getLogger("cedit.whatsapp")


def _cfg(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def is_configured() -> bool:
    return bool(_cfg("WHATSAPP_TOKEN") and _cfg("WHATSAPP_PHONE_NUMBER_ID"))


def _token() -> str:
    return _cfg("WHATSAPP_TOKEN")


def _phone_number_id() -> str:
    return _cfg("WHATSAPP_PHONE_NUMBER_ID")


WHATSAPP_VERIFY_TOKEN = _cfg("WHATSAPP_VERIFY_TOKEN", "cedit_webhook_secret")
WHATSAPP_API_VERSION = _cfg("WHATSAPP_API_VERSION", "v21.0")
WHATSAPP_PHONE_NUMBER_ID = _phone_number_id()


def _graph_url(path: str = "messages") -> str:
    return f"https://graph.facebook.com/{WHATSAPP_API_VERSION}/{_phone_number_id()}/{path}"


def send_text(to_wa_id: str, body: str) -> bool:
    if not is_configured():
        log.warning("WhatsApp no configurado (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID)")
        return False
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to_wa_id,
        "type": "text",
        "text": {"preview_url": False, "body": body[:4096]},
    }
    try:
        with httpx.Client(timeout=30.0) as client:
            r = client.post(
                _graph_url("messages"),
                headers={"Authorization": f"Bearer {_token()}"},
                json=payload,
            )
            if r.status_code >= 400:
                log.error("WhatsApp send error %s: %s", r.status_code, r.text)
                return False
            return True
    except Exception as ex:
        log.exception("WhatsApp send failed: %s", ex)
        return False


def send_bubbles(to_wa_id: str, messages: List[str], pause_s: float = 0.35) -> None:
    for i, msg in enumerate(messages):
        if not msg:
            continue
        send_text(to_wa_id, msg)
        if i < len(messages) - 1 and pause_s:
            time.sleep(pause_s)


def download_media(media_id: str) -> Optional[bytes]:
    if not is_configured() or not media_id:
        return None
    try:
        with httpx.Client(timeout=60.0) as client:
            meta = client.get(
                f"https://graph.facebook.com/{WHATSAPP_API_VERSION}/{media_id}",
                headers={"Authorization": f"Bearer {_token()}"},
            )
            if meta.status_code >= 400:
                log.error("Media meta error: %s", meta.text)
                return None
            url = meta.json().get("url")
            if not url:
                return None
            blob = client.get(url, headers={"Authorization": f"Bearer {_token()}"})
            if blob.status_code >= 400:
                return None
            return blob.content
    except Exception as ex:
        log.exception("Media download failed: %s", ex)
        return None


def mark_read(message_id: str) -> None:
    if not is_configured() or not message_id:
        return
    try:
        with httpx.Client(timeout=15.0) as client:
            client.post(
                _graph_url("messages"),
                headers={"Authorization": f"Bearer {_token()}"},
                json={
                    "messaging_product": "whatsapp",
                    "status": "read",
                    "message_id": message_id,
                },
            )
    except Exception:
        pass
