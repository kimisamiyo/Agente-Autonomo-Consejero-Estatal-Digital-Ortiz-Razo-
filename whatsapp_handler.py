"""
Lógica de conversación WhatsApp — mentor CEDIT vía cedit_core.
"""
from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional

from cedit_core import (
    FreemiumLimitError,
    consumes_freemium_credit,
    detect_input_mode,
    run_audit_pdf,
    run_chat,
)
from discord_mentor import is_mentor_mode
from whatsapp_client import download_media, mark_read, send_bubbles, send_text
from whatsapp_formatter import (
    format_expediente,
    format_freemium_block,
    format_help,
    format_mentor_bubbles,
    format_metrics,
    format_pdf_status,
    format_phase,
    format_reset_confirm,
    format_reset_done,
    md_to_whatsapp,
)
from whatsapp_session import get_whatsapp_session

log = logging.getLogger("cedit.whatsapp")

CMD_HELP = frozenset({"AYUDA", "HELP", "MENU", "MENÚ", "INICIO"})
CMD_METRICS = frozenset({"METRICAS", "MÉTRICAS", "METRICS", "METRICA", "MÉTRICA"})
CMD_PHASE = frozenset({"FASE", "PHASE"})
CMD_EXPEDIENTE = frozenset({"EXPEDIENTE", "AVANCE", "PROGRESO"})
CMD_PDF = frozenset({"PDF", "PLAN", "DOCUMENTO"})
CMD_RESET = frozenset({"REINICIAR", "RESET", "BORRAR", "REINICIAR MEMORIA"})


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


def _handle_command(sess, wa_id: str, cmd: str) -> bool:
    mentor = sess.get_mentor_result()

    if cmd in CMD_HELP:
        send_text(wa_id, format_help())
        return True

    if cmd in CMD_RESET:
        if sess.pending_reset:
            sess.reset()
            send_text(wa_id, format_reset_done())
            return True
        sess.pending_reset = True
        send_text(wa_id, format_reset_confirm())
        return True

    if cmd in ("SI", "SÍ", "YES", "CONFIRMAR") and sess.pending_reset:
        sess.pending_reset = False
        sess.reset()
        send_text(wa_id, format_reset_done())
        return True

    if cmd in CMD_METRICS:
        if not mentor:
            send_text(
                wa_id,
                md_to_whatsapp(
                    "Aún no hay métricas. Cuénteme su idea o adjunte un PDF de expediente."
                ),
            )
            return True
        send_text(wa_id, format_metrics(mentor, sess.usage()))
        return True

    if cmd in CMD_PHASE:
        if not mentor:
            send_text(wa_id, md_to_whatsapp("Aún no hay fase de mentor. Escriba su proyecto."))
            return True
        send_text(wa_id, format_phase(mentor))
        return True

    if cmd in CMD_EXPEDIENTE:
        if not mentor:
            send_text(wa_id, md_to_whatsapp("Sin expediente aún. Cuénteme su proyecto."))
            return True
        send_text(wa_id, format_expediente(mentor))
        return True

    if cmd in CMD_PDF:
        if not mentor:
            send_text(wa_id, md_to_whatsapp("Primero desarrollemos su plan por chat."))
            return True
        send_text(wa_id, format_pdf_status(mentor))
        return True

    return False


def process_text_message(wa_id: str, text: str, message_id: str = "", *, skip_mark_read: bool = False) -> None:
    if not skip_mark_read:
        mark_read(message_id)
    sess = get_whatsapp_session(wa_id)
    raw = (text or "").strip()
    if not raw:
        return

    cmd = _normalize_command(raw)
    if _handle_command(sess, wa_id, cmd):
        return

    if sess.pending_reset:
        sess.pending_reset = False
        send_text(wa_id, md_to_whatsapp("Reinicio cancelado. Siga contándome su proyecto."))

    send_text(
        wa_id,
        md_to_whatsapp(
            "⏳ *Recibí su mensaje.* CEDIT está analizando su caso "
            "_(puede tardar hasta 1 minuto la primera vez)_."
        ),
    )

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
            user_id=f"whatsapp_{wa_id}",
            canal="whatsapp",
            skip_usage=True,
            session_mode=active_mode,
        )
        sess.append("user", raw)
        sess.append("assistant", result.get("display") or result.get("response", ""))
        _apply_result(sess, result)

        bubbles = format_mentor_bubbles(result, is_first_turn=first_turn)
        send_bubbles(wa_id, bubbles)
    except FreemiumLimitError:
        send_text(wa_id, format_freemium_block())
    except Exception as ex:
        log.exception("WhatsApp chat error: %s", ex)
        send_text(
            wa_id,
            md_to_whatsapp("Hubo un error procesando su mensaje. Intente de nuevo en un momento."),
        )


def process_document_message(
    wa_id: str,
    media_id: str,
    filename: str,
    caption: str = "",
    message_id: str = "",
    *,
    skip_mark_read: bool = False,
) -> None:
    if not skip_mark_read:
        mark_read(message_id)
    sess = get_whatsapp_session(wa_id)
    send_text(wa_id, md_to_whatsapp("📄 Recibí su documento. Revisando ante normativa MEF…"))

    data = download_media(media_id)
    if not data:
        send_text(wa_id, md_to_whatsapp("No pude descargar el archivo. Intente enviarlo de nuevo."))
        return

    name = filename or "expediente.pdf"
    if not name.lower().endswith(".pdf"):
        send_text(wa_id, md_to_whatsapp("Por ahora solo acepto archivos *PDF*."))
        return

    first_turn = len(sess.history) == 0

    try:
        sess.check_freemium("audit")
        result = run_audit_pdf(
            data,
            name,
            user_text=caption or "",
            user_id=f"whatsapp_{wa_id}",
            canal="whatsapp",
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

        bubbles = format_mentor_bubbles(result, is_first_turn=first_turn)
        send_bubbles(wa_id, bubbles)
    except FreemiumLimitError:
        send_text(wa_id, format_freemium_block())
    except Exception as ex:
        log.exception("WhatsApp PDF error: %s", ex)
        send_text(wa_id, md_to_whatsapp(f"Error al auditar PDF: {ex}"))


def extract_messages(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Extrae mensajes entrantes del webhook Meta."""
    out: List[Dict[str, Any]] = []
    for entry in payload.get("entry") or []:
        for change in entry.get("changes") or []:
            if change.get("field") and change.get("field") != "messages":
                continue
            value = change.get("value") or {}
            for msg in value.get("messages") or []:
                wa_id = msg.get("from", "")
                msg_id = msg.get("id", "")
                msg_type = msg.get("type", "")
                item: Dict[str, Any] = {"wa_id": wa_id, "message_id": msg_id, "type": msg_type}

                if msg_type == "text":
                    item["text"] = (msg.get("text") or {}).get("body", "")
                    out.append(item)
                elif msg_type == "document":
                    doc = msg.get("document") or {}
                    item["media_id"] = doc.get("id", "")
                    item["filename"] = doc.get("filename", "documento.pdf")
                    item["caption"] = msg.get("caption") or ""
                    out.append(item)
                elif msg_type == "button":
                    item["text"] = (msg.get("button") or {}).get("text", "")
                    out.append(item)
                elif msg_type == "interactive":
                    inter = msg.get("interactive") or {}
                    btn = inter.get("button_reply") or inter.get("list_reply") or {}
                    item["text"] = btn.get("title") or btn.get("id") or ""
                    if item["text"]:
                        out.append(item)
    return out


def handle_webhook_payload(payload: Dict[str, Any]) -> None:
    msgs = extract_messages(payload)
    log.info("Procesando %d mensaje(s) WhatsApp", len(msgs))
    for msg in msgs:
        wa_id = msg.get("wa_id")
        if not wa_id:
            continue
        try:
            if msg.get("type") == "document":
                process_document_message(
                    wa_id,
                    msg.get("media_id", ""),
                    msg.get("filename", "documento.pdf"),
                    msg.get("caption", ""),
                    msg.get("message_id", ""),
                    skip_mark_read=True,
                )
            else:
                text = msg.get("text", "")
                if text:
                    process_text_message(
                        wa_id, text, msg.get("message_id", ""), skip_mark_read=True
                    )
        except Exception as ex:
            log.exception("WhatsApp mensaje no procesado (%s): %s", wa_id, ex)
