"""
Locale compartido CEDIT (es | qu | ay) para Discord / Telegram / WhatsApp.
"""
from __future__ import annotations

import re

VALID_LOCALES = frozenset({"es", "qu", "ay"})

LOCALE_LABELS = {
    "es": "Español",
    "qu": "Quechua (Runasimi)",
    "ay": "Aymara",
}

_LOCALE_ALIASES = {
    "ES": "es",
    "ESP": "es",
    "ESPAÑOL": "es",
    "ESPANOL": "es",
    "SPANISH": "es",
    "QU": "qu",
    "QUECHUA": "qu",
    "RUNASIMI": "qu",
    "AY": "ay",
    "AYMARA": "ay",
}


def normalize_locale(value: str | None) -> str:
    key = (value or "es").strip().lower()[:2]
    return key if key in VALID_LOCALES else "es"


def parse_locale_from_command(cmd: str) -> str | None:
    t = (cmd or "").strip().upper()
    t = re.sub(r"\s+", " ", t)
    t = t.lstrip("/").split("@")[0].strip()
    if not t:
        return None
    if t in ("IDIOMA", "LANGUAGE", "LENGUA", "SIMI", "ARU"):
        return ""
    for prefix in ("IDIOMA ", "LANGUAGE ", "LENGUA ", "SIMI ", "ARU "):
        if t.startswith(prefix):
            rest = t[len(prefix) :].strip()
            return _LOCALE_ALIASES.get(rest)
    return None


def format_locale_menu(current: str = "es") -> str:
    cur = normalize_locale(current)
    return (
        "*Idioma / Simi / Aru*\n\n"
        f"Actual: *{LOCALE_LABELS[cur]}* (`{cur}`)\n\n"
        "Escriba:\n"
        "• `IDIOMA ES` — Español\n"
        "• `IDIOMA QU` — Quechua\n"
        "• `IDIOMA AY` — Aymara"
    )


def format_locale_changed(locale: str) -> str:
    loc = normalize_locale(locale)
    msgs = {
        "es": f"Idioma actualizado a *{LOCALE_LABELS[loc]}*. Seguire respondiendo en este idioma.",
        "qu": f"Simi tikrasqa: *{LOCALE_LABELS[loc]}*. Kunanqa kay simipi kutichisaq.",
        "ay": f"Aru mayjt'atawa: *{LOCALE_LABELS[loc]}*. Jichhax aka arut kutichiristwa.",
    }
    return msgs.get(loc, msgs["es"])
