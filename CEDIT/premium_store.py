"""
Registro Premium web por wallet + nombre de usuario.
"""
import json
import os
import datetime
from typing import Any, Dict, List, Optional

WALLETS_FILE = os.path.join(os.path.dirname(__file__), ".cedit_web_premium.json")
MINTS_FILE = os.path.join(os.path.dirname(__file__), ".cedit_mint_index.json")
PENDING_PDF_FILE = os.path.join(os.path.dirname(__file__), ".cedit_pending_pdf.json")


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


def activate_wallet(
    wallet: str,
    display_name: Optional[str] = None,
    user_id: str = "",
) -> Dict[str, Any]:
    """Conecta wallet existente o registra automáticamente (Plan Pro)."""
    entry = lookup_wallet(wallet)
    if entry:
        if display_name and display_name.strip() and entry.get("display_name") != display_name.strip():
            data = _load()
            w = _norm_wallet(wallet)
            entry = {**entry, "display_name": display_name.strip()}
            data[w] = entry
            _save(data)
        return entry
    w = wallet.strip()
    short = f"{w[:6]}…{w[-4:]}" if len(w) > 12 else w
    name = (display_name or "").strip() or f"Usuario {short}"
    return register_wallet(wallet, name, user_id)


def _load_mints() -> dict:
    if os.path.exists(MINTS_FILE):
        try:
            with open(MINTS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    return {}


def _save_mints(data: dict) -> None:
    with open(MINTS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def record_mint_backup(
    wallet: str,
    token_id: int,
    *,
    messages: Optional[List[Dict[str, Any]]] = None,
    channel: str = "Web",
) -> None:
    """Índice local del último mint por wallet (complementa lectura on-chain)."""
    w = _norm_wallet(wallet)
    if not w or token_id is None:
        return
    data = _load_mints()
    items = data.get(w) or []
    entry = {
        "token_id": int(token_id),
        "channel": channel,
        "saved_at": datetime.datetime.now().isoformat(),
    }
    if messages:
        entry["messages"] = messages[:40]
    items = [entry] + [i for i in items if i.get("token_id") != int(token_id)]
    data[w] = items[:20]
    _save_mints(data)


def get_latest_mint_backup(wallet: str) -> Optional[Dict[str, Any]]:
    w = _norm_wallet(wallet)
    items = _load_mints().get(w) or []
    return items[0] if items else None


def _load_pending_pdf() -> dict:
    if os.path.exists(PENDING_PDF_FILE):
        try:
            with open(PENDING_PDF_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    return {}


def _save_pending_pdf(data: dict) -> None:
    with open(PENDING_PDF_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def record_pending_pdf_attestation(
    wallet: str,
    *,
    pdf_hash: str,
    mef_score: int,
    channel_url: str,
    channel: str = "Web",
    conversation_id: str = "",
) -> None:
    w = _norm_wallet(wallet)
    if not w or not pdf_hash:
        return
    data = _load_pending_pdf()
    key = f"{w}:{conversation_id or 'default'}"
    data[key] = {
        "pdf_hash": pdf_hash.strip().lower(),
        "mef_score": int(mef_score),
        "channel_url": channel_url,
        "channel": channel,
        "conversation_id": conversation_id,
        "saved_at": datetime.datetime.now().isoformat(),
    }
    _save_pending_pdf(data)


def peek_pending_pdf_attestation(
    wallet: str,
    *,
    conversation_id: str = "",
) -> Optional[Dict[str, Any]]:
    w = _norm_wallet(wallet)
    key = f"{w}:{conversation_id or 'default'}"
    return _load_pending_pdf().get(key)


def consume_pending_pdf_attestation(
    wallet: str,
    pdf_hash: str,
    *,
    conversation_id: str = "",
) -> Optional[Dict[str, Any]]:
    w = _norm_wallet(wallet)
    key = f"{w}:{conversation_id or 'default'}"
    data = _load_pending_pdf()
    entry = data.get(key)
    if not entry:
        return None
    expected = (entry.get("pdf_hash") or "").strip().lower()
    got = (pdf_hash or "").strip().lower()
    if expected != got:
        return None
    del data[key]
    _save_pending_pdf(data)
    return entry


def record_pdf_firma_backup(
    wallet: str,
    token_id: int,
    *,
    pdf_hash: str,
    channel: str = "Web",
    mef_score: int = 0,
) -> None:
    w = _norm_wallet(wallet)
    if not w or token_id is None:
        return
    data = _load_mints()
    items = data.get(w) or []
    entry = {
        "kind": "pdf_firma",
        "token_id": int(token_id),
        "pdf_hash": pdf_hash,
        "channel": channel,
        "mef_score": int(mef_score),
        "saved_at": datetime.datetime.now().isoformat(),
    }
    items = [entry] + [i for i in items if not (i.get("kind") == "pdf_firma" and i.get("token_id") == int(token_id))]
    data[w] = items[:20]
    _save_mints(data)
