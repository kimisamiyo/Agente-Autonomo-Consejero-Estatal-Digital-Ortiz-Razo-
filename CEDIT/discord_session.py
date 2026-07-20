"""
Sesiones Discord: historial, modo, freemium por conversación y plan Pro.
"""
import json
import os
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List

from cedit_core import FREE_LIMIT, FreemiumLimitError

SESSIONS_FILE = os.path.join(os.path.dirname(__file__), ".cedit_discord_sessions.json")
PRO_USERS_FILE = os.path.join(os.path.dirname(__file__), ".cedit_pro_users.json")
FREE_SESSION_TTL_HOURS = 24
DISCORD_HISTORY_TURNS = 24


def conversation_id(channel_id: int, user_id: int, is_dm: bool) -> str:
    """DM por usuario; en canales compartidos, historial y cupo por persona."""
    if is_dm:
        return f"dm_{user_id}"
    return f"ch_{channel_id}_u_{user_id}"


def _load_json(path: str) -> dict:
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    return {}


def _save_json(path: str, data: dict) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_iso(value: str) -> datetime | None:
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (TypeError, ValueError):
        return None


def _default_blob(user_id: int, is_pro: bool) -> dict:
    return {
        "history": [],
        "audit_count": 0,
        "mode": "chat",
        "locale": "es",
        "last_plan": "",
        "filename": "",
        "owner_user_id": user_id,
        "last_activity_at": _utc_now_iso(),
        "persist": is_pro,
    }


def is_pro_user(user_id: int) -> bool:
    return bool(_load_json(PRO_USERS_FILE).get(str(user_id), {}).get("active"))


def is_pro_confirmed(user_id: int) -> bool:
    """Plan Pro activo con wallet 0x registrada (no solo flag local)."""
    if not is_pro_user(user_id):
        return False
    wallet = (get_pro_settings(user_id).get("wallet") or "").strip()
    return wallet.startswith("0x") and len(wallet) >= 10


def get_pro_settings(user_id: int) -> dict:
    return _load_json(PRO_USERS_FILE).get(str(user_id), {})


def activate_pro_user(user_id: int, wallet: str = "", persist: bool = True) -> None:
    data = _load_json(PRO_USERS_FILE)
    data[str(user_id)] = {"active": True, "wallet": wallet or "wallet_demo", "persist_context": persist}
    _save_json(PRO_USERS_FILE, data)


class ConversationSession:
    def __init__(self, conv_id: str, user_id: int, is_pro: bool = False):
        self.conv_id = conv_id
        self.user_id = user_id
        self.is_pro = is_pro
        self.auto_reset_notice = False
        self._store = _load_json(SESSIONS_FILE)
        if conv_id not in self._store:
            self._store[conv_id] = _default_blob(user_id, is_pro)
        self._blob = self._store[conv_id]
        self._blob.setdefault("owner_user_id", user_id)
        self._apply_ttl_if_needed()

    def _apply_ttl_if_needed(self) -> None:
        if self.is_pro:
            return
        last = self._blob.get("last_activity_at")
        if not last:
            self.touch()
            return
        parsed = _parse_iso(last)
        if not parsed:
            self.touch()
            return
        if datetime.now(timezone.utc) - parsed >= timedelta(hours=FREE_SESSION_TTL_HOURS):
            self._hard_reset(auto=True)

    def touch(self) -> None:
        self._blob["last_activity_at"] = _utc_now_iso()
        self.save()

    @property
    def owner_user_id(self) -> int:
        return int(self._blob.get("owner_user_id", self.user_id))

    @property
    def history(self) -> List[Dict]:
        return self._blob.setdefault("history", [])

    @property
    def mode(self) -> str:
        return self._blob.get("mode", "chat")

    @mode.setter
    def mode(self, value: str) -> None:
        self._blob["mode"] = value
        self.save()

    def get_locale(self) -> str:
        loc = (self._blob.get("locale") or "es").lower()[:2]
        return loc if loc in ("es", "qu", "ay") else "es"

    def set_locale(self, locale: str) -> None:
        loc = (locale or "es").lower()[:2]
        self._blob["locale"] = loc if loc in ("es", "qu", "ay") else "es"
        self.save()

    def append(self, role: str, content: str) -> None:
        self.history.append({"role": role, "content": content})
        if len(self.history) > DISCORD_HISTORY_TURNS:
            self._blob["history"] = self.history[-DISCORD_HISTORY_TURNS:]
        self.touch()

    def set_mentor_result(self, result: dict) -> None:
        self._blob["last_mentor"] = {
            "guide_graph": result.get("guide_graph"),
            "mef_score": result.get("mef_score"),
            "guide_phase": result.get("guide_phase"),
            "guide_completeness": result.get("guide_completeness"),
            "show_pdf": bool(result.get("show_pdf")),
            "mode": result.get("input_mode") or result.get("mode"),
            "opinion": result.get("opinion", ""),
            "response": result.get("response", ""),
        }
        self.save()

    def get_mentor_result(self) -> dict:
        return self._blob.get("last_mentor") or {}

    def set_plan(
        self,
        content: str,
        filename: str = "",
        opinion: str = "",
        dictamen: str = "",
        source_excerpt: str = "",
    ) -> None:
        self._blob["last_plan"] = content
        if filename:
            self._blob["filename"] = filename
        if opinion:
            self._blob["audit_opinion"] = opinion
        if dictamen:
            self._blob["audit_dictamen"] = dictamen
        if source_excerpt:
            self._blob["source_excerpt"] = source_excerpt
        self.save()

    def get_plan(self) -> str:
        return self._blob.get("last_plan", "")

    def set_pending_pdf(self, pdf_hash: str, mef_score: int) -> None:
        self._blob["pending_pdf"] = {
            "pdf_hash": (pdf_hash or "").strip().lower(),
            "mef_score": int(mef_score or 0),
        }
        self.save()

    def get_pending_pdf(self) -> dict:
        return self._blob.get("pending_pdf") or {}

    def get_filename(self) -> str:
        return self._blob.get("filename", "")

    def get_audit_meta(self) -> dict:
        return {
            "opinion": self._blob.get("audit_opinion", ""),
            "dictamen": self._blob.get("audit_dictamen", ""),
            "source_excerpt": self._blob.get("source_excerpt", ""),
        }

    def usage(self) -> Dict[str, Any]:
        count = int(self._blob.get("audit_count", 0))
        if self.is_pro:
            return {"count": count, "limit": "∞", "remaining": "∞", "freemium_exceeded": False, "is_pro": True}
        return {
            "count": count,
            "limit": FREE_LIMIT,
            "remaining": max(0, FREE_LIMIT - count),
            "freemium_exceeded": count >= FREE_LIMIT,
            "is_pro": False,
        }

    def check_freemium(self, mode: str) -> None:
        if self.is_pro or mode not in ("audit", "plan"):
            return
        if self.usage()["freemium_exceeded"]:
            raise FreemiumLimitError(
                f"Límite de esta conversación: **{FREE_LIMIT}** auditorías/planes.\n"
                "Usa **`/reiniciar_memoria`** para empezar de cero.\n"
                "O **`/conectar_wallet`** para Plan Pro."
            )

    def increment_audit(self, mode: str) -> Dict[str, Any]:
        if self.is_pro or mode not in ("audit", "plan"):
            return self.usage()
        self._blob["audit_count"] = int(self._blob.get("audit_count", 0)) + 1
        self.touch()
        return self.usage()

    def _hard_reset(self, *, auto: bool = False, voluntary: bool = False) -> None:
        self._store.pop(self.conv_id, None)
        _save_json(SESSIONS_FILE, self._store)
        self._store = _load_json(SESSIONS_FILE)
        self._blob = self._store.setdefault(self.conv_id, _default_blob(self.user_id, self.is_pro))
        self.touch()
        if auto:
            self.auto_reset_notice = True

    def reset(self, *, voluntary: bool = False) -> None:
        """Borrado total: contexto limpio y cupo renovado (freemium)."""
        self._hard_reset(auto=False, voluntary=voluntary)

    def save(self) -> None:
        _save_json(SESSIONS_FILE, self._store)


def get_session(channel_id: int, user_id: int, is_dm: bool) -> ConversationSession:
    return ConversationSession(conversation_id(channel_id, user_id, is_dm), user_id, is_pro=is_pro_user(user_id))
