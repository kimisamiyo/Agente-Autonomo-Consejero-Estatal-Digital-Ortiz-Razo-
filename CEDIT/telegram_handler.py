"""
Lógica de conversación Telegram — mismo flujo mentor que WhatsApp/Discord.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import List

from cedit_core import (
    FreemiumLimitError,
    consumes_freemium_credit,
    detect_input_mode,
    run_audit_pdf,
    run_chat,
)
from discord_mentor import is_mentor_mode
from telegram_formatter import (
    format_expediente,
    format_freemium_block,
    format_help,
    format_mentor_bubbles,
    format_metrics,
    format_pdf_status,
    format_phase,
    format_reset_confirm,
    format_reset_done,
    md_to_telegram,
)
from telegram_session import get_telegram_session

log = logging.getLogger("cedit.telegram")

CMD_HELP = frozenset({"AYUDA", "HELP", "MENU", "MENÚ", "INICIO", "START"})
CMD_METRICS = frozenset({"METRICAS", "MÉTRICAS", "METRICS", "METRICA", "MÉTRICA"})
CMD_PHASE = frozenset({"FASE", "PHASE"})
CMD_EXPEDIENTE = frozenset({"EXPEDIENTE", "AVANCE", "PROGRESO"})
CMD_PDF = frozenset({"PDF", "PLAN", "DOCUMENTO"})
CMD_RESET = frozenset({"REINICIAR", "RESET", "BORRAR", "REINICIAR MEMORIA"})


@dataclass
class TelegramReply:
    text: str


def _normalize_command(text: str) -> str:
    t = (text or "").strip().upper()
    t = re.sub(r"\s+", " ", t)
    return t


def _apply_result(sess, result: dict) -> None:
    mode = result.get("input_mode") or result.get("mode", "chat")
    if result.get("consumes_audit_credit"):
        sess.increment_audit(mode if mode in ("audit", "plan") else "audit")
        if mode in ("audit", "plan"):
            sess.mode = mode
    elif is_mentor_mode(result.get("mode", ""), mode):
        sess.mode = mode

    if is_mentor_mode(result.get("mode", ""), mode):
        sess.set_mentor_result(result)
        if result.get("response") or result.get("opinion"):
            sess.set_plan(
                result.get("response", ""),
                opinion=result.get("opinion", ""),
                dictamen=result.get("dictamen", ""),
            )


def _handle_command(sess, cmd: str) -> List[TelegramReply]:
    mentor = sess.get_mentor_result()

    if cmd in CMD_HELP:
        return [TelegramReply(format_help())]

    if cmd in CMD_RESET:
        if sess.pending_reset:
            sess.reset()
            return [TelegramReply(format_reset_done())]
        sess.pending_reset = True
        return [TelegramReply(format_reset_confirm())]

    if cmd in ("SI", "SÍ", "YES", "CONFIRMAR") and sess.pending_reset:
        sess.pending_reset = False
        sess.reset()
        return [TelegramReply(format_reset_done())]

    if cmd in CMD_METRICS:
        if not mentor:
            return [
                TelegramReply(
                    md_to_telegram(
                        "Aún no hay métricas. Cuénteme su idea o adjunte un PDF de expediente."
                    )
                )
            ]
        return [TelegramReply(format_metrics(mentor, sess.usage()))]

    if cmd in CMD_PHASE:
        if not mentor:
            return [TelegramReply(md_to_telegram("Aún no hay fase de mentor. Escriba su proyecto."))]
        return [TelegramReply(format_phase(mentor))]

    if cmd in CMD_EXPEDIENTE:
        if not mentor:
            return [TelegramReply(md_to_telegram("Sin expediente aún. Cuénteme su proyecto."))]
        return [TelegramReply(format_expediente(mentor))]

    if cmd in CMD_PDF:
        if not mentor:
            return [TelegramReply(md_to_telegram("Primero desarrollemos su plan por chat."))]
        return [TelegramReply(format_pdf_status(mentor))]

    return []


def process_text_message(chat_id: str | int, text: str) -> List[TelegramReply]:
    sess = get_telegram_session(chat_id)
    raw = (text or "").strip()
    if not raw:
        return []

    cmd = _normalize_command(raw)
    cmd_replies = _handle_command(sess, cmd)
    if cmd_replies:
        return cmd_replies

    if sess.pending_reset:
        sess.pending_reset = False
        return [TelegramReply(md_to_telegram("Reinicio cancelado. Siga contándome su proyecto."))]

    replies: List[TelegramReply] = [
        TelegramReply(
            md_to_telegram(
                "⏳ *Recibí su mensaje.* CEDIT está analizando su caso "
                "_(puede tardar hasta 1 minuto la primera vez)_."
            )
        )
    ]

    first_turn = len(sess.history) == 0

    try:
        active_mode = sess.mode if sess.mode in ("audit", "plan") else None
        mode = detect_input_mode(raw)
        billable = consumes_freemium_credit(
            raw, mode=mode, session_mode=active_mode, history=sess.history
        )
        if billable:
            sess.check_freemium("audit")

        result = run_chat(
            raw,
            history=sess.history,
            user_id=f"telegram_{sess.chat_id}",
            canal="telegram",
            skip_usage=True,
            session_mode=active_mode,
        )
        sess.append("user", raw)
        sess.append("assistant", result.get("display") or result.get("response", ""))
        _apply_result(sess, result)

        for bubble in format_mentor_bubbles(result, is_first_turn=first_turn):
            replies.append(TelegramReply(bubble))
    except FreemiumLimitError:
        replies = [TelegramReply(format_freemium_block())]
    except Exception as ex:
        log.exception("Telegram chat error: %s", ex)
        replies = [
            TelegramReply(
                md_to_telegram("Hubo un error procesando su mensaje. Intente de nuevo en un momento.")
            )
        ]

    return replies


def process_document_message(
    chat_id: str | int,
    data: bytes,
    filename: str,
    caption: str = "",
) -> List[TelegramReply]:
    sess = get_telegram_session(chat_id)
    replies = [TelegramReply(md_to_telegram("📄 Recibí su documento. Revisando ante normativa MEF…"))]

    name = filename or "expediente.pdf"
    if not name.lower().endswith(".pdf"):
        return [TelegramReply(md_to_telegram("Por ahora solo acepto archivos *PDF*."))]

    if not data:
        return [TelegramReply(md_to_telegram("No pude leer el archivo. Intente enviarlo de nuevo."))]

    first_turn = len(sess.history) == 0

    try:
        sess.check_freemium("audit")
        result = run_audit_pdf(
            data,
            name,
            user_text=caption or "",
            user_id=f"telegram_{sess.chat_id}",
            canal="telegram",
            skip_usage=True,
        )
        user_line = f"PDF: {name}" + (f"\n{caption}" if caption else "")
        sess.mode = "audit"
        sess.append("user", user_line)
        sess.append("assistant", result.get("display") or result.get("response", ""))
        _apply_result(sess, result)
        sess.set_plan(
            result["response"],
            name,
            opinion=result.get("opinion", ""),
            dictamen=result.get("dictamen", ""),
            source_excerpt=result.get("source_excerpt", ""),
        )

        for bubble in format_mentor_bubbles(result, is_first_turn=first_turn):
            replies.append(TelegramReply(bubble))
    except FreemiumLimitError:
        replies = [TelegramReply(format_freemium_block())]
    except Exception as ex:
        log.exception("Telegram PDF error: %s", ex)
        replies = [TelegramReply(md_to_telegram(f"Error al auditar PDF: {ex}"))]

    return replies
