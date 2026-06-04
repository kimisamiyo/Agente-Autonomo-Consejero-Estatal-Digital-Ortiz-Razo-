"""
Sesiones Telegram: historial, modo mentor y freemium por chat.
"""
import json
import os
import re
from typing import Any, Dict, List

from cedit_core import FREE_LIMIT, FreemiumLimitError

SESSIONS_FILE = os.path.join(os.path.dirname(__file__), ".cedit_telegram_sessions.json")


def normalize_chat_id(chat_id: str | int) -> str:
    digits = re.sub(r"\D", "", str(chat_id or ""))
    return digits or "unknown"


def conversation_id(chat_id: str | int) -> str:
    return f"tg_{normalize_chat_id(chat_id)}"


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


class TelegramSession:
    def __init__(self, chat_id: str | int):
        self.chat_id = normalize_chat_id(chat_id)
        self.conv_id = conversation_id(self.chat_id)
        self._store = _load_json(SESSIONS_FILE)
        self._blob = self._store.setdefault(
            self.conv_id,
            {
                "history": [],
                "audit_count": 0,
                "mode": "chat",
                "last_plan": "",
                "filename": "",
                "pending_reset": False,
            },
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

    @property
    def pending_reset(self) -> bool:
        return bool(self._blob.get("pending_reset"))

    @pending_reset.setter
    def pending_reset(self, value: bool) -> None:
        self._blob["pending_reset"] = value
        self.save()

    def append(self, role: str, content: str) -> None:
        self.history.append({"role": role, "content": content})
        if len(self.history) > 16:
            self._blob["history"] = self.history[-16:]
        self.save()

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

    def usage(self) -> Dict[str, Any]:
        count = int(self._blob.get("audit_count", 0))
        return {
            "count": count,
            "limit": FREE_LIMIT,
            "remaining": max(0, FREE_LIMIT - count),
            "freemium_exceeded": count >= FREE_LIMIT,
            "is_pro": False,
        }

    def check_freemium(self, mode: str) -> None:
        if mode not in ("audit", "plan"):
            return
        if self.usage()["freemium_exceeded"]:
            raise FreemiumLimitError(
                f"Límite de esta conversación: {FREE_LIMIT} consultas de plan.\n"
                "Escriba REINICIAR para empezar de cero."
            )

    def increment_audit(self, mode: str) -> Dict[str, Any]:
        if mode not in ("audit", "plan"):
            return self.usage()
        self._blob["audit_count"] = int(self._blob.get("audit_count", 0)) + 1
        self.save()
        return self.usage()

    def reset(self) -> None:
        self._store.pop(self.conv_id, None)
        _save_json(SESSIONS_FILE, self._store)
        self._blob = self._store.setdefault(
            self.conv_id,
            {
                "history": [],
                "audit_count": 0,
                "mode": "chat",
                "last_plan": "",
                "filename": "",
                "pending_reset": False,
            },
        )

    def save(self) -> None:
        _save_json(SESSIONS_FILE, self._store)


def get_telegram_session(chat_id: str | int) -> TelegramSession:
    return TelegramSession(chat_id)
