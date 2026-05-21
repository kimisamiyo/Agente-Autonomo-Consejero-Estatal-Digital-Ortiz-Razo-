"""
Sesiones Discord: historial, modo, freemium por conversación y plan Pro.
"""
import json
import os
from typing import Any, Dict, List

from cedit_core import FREE_LIMIT, FreemiumLimitError

SESSIONS_FILE = os.path.join(os.path.dirname(__file__), ".cedit_discord_sessions.json")
PRO_USERS_FILE = os.path.join(os.path.dirname(__file__), ".cedit_pro_users.json")


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


def is_pro_user(user_id: int) -> bool:
    return bool(_load_json(PRO_USERS_FILE).get(str(user_id), {}).get("active"))


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
        self._store = _load_json(SESSIONS_FILE)
        self._blob = self._store.setdefault(
            conv_id,
            {"history": [], "audit_count": 0, "mode": "chat", "last_plan": "", "filename": "", "persist": is_pro},
        )

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

    def append(self, role: str, content: str) -> None:
        self.history.append({"role": role, "content": content})
        if len(self.history) > 16:
            self._blob["history"] = self.history[-16:]
        self.save()

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
        self.save()
        return self.usage()

    def reset(self) -> None:
        pro = get_pro_settings(self.user_id)
        if self.is_pro and pro.get("persist_context", True):
            self._blob["history"] = []
            self._blob["audit_count"] = 0
            self._blob["mode"] = "chat"
            self.save()
        else:
            self._store.pop(self.conv_id, None)
            _save_json(SESSIONS_FILE, self._store)

    def save(self) -> None:
        _save_json(SESSIONS_FILE, self._store)


def get_session(channel_id: int, user_id: int, is_dm: bool) -> ConversationSession:
    return ConversationSession(conversation_id(channel_id, user_id, is_dm), user_id, is_pro=is_pro_user(user_id))
