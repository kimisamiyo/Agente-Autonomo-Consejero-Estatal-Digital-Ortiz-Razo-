"""
Registro Premium web por wallet + nombre de usuario.
"""
import json
import os
import datetime
from typing import Any, Dict, Optional

WALLETS_FILE = os.path.join(os.path.dirname(__file__), ".cedit_web_premium.json")


def _load() -> dict:
    if os.path.exists(WALLETS_FILE):
        try:
            with open(WALLETS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    return {}


def _save(data: dict) -> None:
    with open(WALLETS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _norm_wallet(wallet: str) -> str:
    return (wallet or "").strip().lower()


def register_wallet(wallet: str, display_name: str, user_id: str = "") -> Dict[str, Any]:
    w = _norm_wallet(wallet)
    if not w or len(w) < 6:
        raise ValueError("Wallet inválida. Ingrese una dirección válida.")
    name = (display_name or "").strip()
    if not name or len(name) < 2:
        raise ValueError("El nombre de usuario debe tener al menos 2 caracteres.")

    data = _load()
    entry = {
        "wallet": wallet.strip(),
        "display_name": name,
        "user_id": user_id,
        "active": True,
        "registered_at": datetime.datetime.now().isoformat(),
    }
    data[w] = entry
    _save(data)
    return entry


def lookup_wallet(wallet: str) -> Optional[Dict[str, Any]]:
    return _load().get(_norm_wallet(wallet))


def is_pro_wallet(wallet: Optional[str]) -> bool:
    if not wallet:
        return False
    entry = lookup_wallet(wallet)
    return bool(entry and entry.get("active"))


def connect_wallet(wallet: str) -> Dict[str, Any]:
    entry = lookup_wallet(wallet)
    if not entry:
        raise ValueError("Wallet no registrada. Use el registro Premium la primera vez.")
    if not entry.get("active"):
        raise ValueError("Esta wallet no tiene Plan Pro activo.")
    return entry
