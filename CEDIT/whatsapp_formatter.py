"""
Formateo de respuestas CEDIT para WhatsApp (burbujas cortas, sin UI).
"""
from __future__ import annotations

import re
from typing import List

from discord_mentor import (
    build_panel_markdown,
    is_mentor_mode,
    mentor_chat_body,
    metrics_summary_lines,
    pdf_lock_reason,
)

MAX_BUBBLE = 1200
FOOTER = "\n\Acciones *MÉTRICAS* · *AYUDA* · *REINICIAR_"


def md_to_whatsapp(text: str) -> str:
    if not text:
        return ""
    out = text
    out = re.sub(r"^#{1,6}\s*(.+)$", r"*\1*", out, flags=re.M)
    out = re.sub(r"\*\*(.+?)\*\*", r"*\1*", out)
    out = re.sub(r"__(.+?)__", r"_\1_", out)
    out = re.sub(r"`([^`]+)`", r"\1", out)
    out = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", out)
    return out.strip()


def chunk_text(text: str, limit: int = MAX_BUBBLE) -> List[str]:
    text = (text or "").strip()
    if not text:
        return []
    if len(text) <= limit:
        return [text]
    chunks: List[str] = []
    rest = text
    while rest:
        if len(rest) <= limit:
            chunks.append(rest)
            break
        cut = rest.rfind("\n\n", 0, limit)
        if cut < limit // 2:
            cut = rest.rfind("\n", 0, limit)
        if cut < limit // 2:
            cut = rest.rfind(" ", 0, limit)
        if cut < 1:
            cut = limit
        chunks.append(rest[:cut].strip())
        rest = rest[cut:].strip()
    return chunks


def format_help() -> str:
    return md_to_whatsapp(
        "*CEDIT — Consejero Estatal Digital*\n\n"
        "Cuénteme su idea o proyecto y lo guiaré paso a paso.\n\n"
        "*Comandos:*\n"
        "• *AYUDA* — este menú\n"
        "• *MÉTRICAS* — fase, índice MEF y riesgo\n"
        "• *FASE* — en qué etapa va su plan\n"
        "• *EXPEDIENTE* — avance y datos que faltan\n"
        "• *PDF* — cuándo puede el plan oficial (≥80%)\n"
        "• *REINICIAR* — borrar memoria de este chat\n\n"
        "También en *Discord* (botón **Redes**) y *Telegram* (@iCEDIT_BOT).\n\n"
        "Adjunte un *PDF* para auditar un expediente.\n"
        "Puede escribir con naturalidad; no hace falta códigos técnicos."
    )


def format_metrics(result: dict, usage: dict | None = None) -> str:
    lines = metrics_summary_lines(result)
    if usage:
        lines.append(
            f"\n*Cupo:* {usage.get('count', 0)}/{usage.get('limit', 10)} consultas"
        )
    return md_to_whatsapp("📊 *Mis métricas*\n\n" + "\n".join(lines))


def format_phase(result: dict) -> str:
    graph = result.get("guide_graph") or {}
    phase = result.get("guide_phase") or graph.get("phase_name") or "—"
    return md_to_whatsapp(f"🧭 *Fase:* {phase}")


def format_expediente(result: dict) -> str:
    panel = build_panel_markdown(result.get("opinion", ""), result.get("response", ""))
    graph = result.get("guide_graph") or {}
    phase = result.get("guide_phase") or graph.get("phase_name") or "—"
    if panel:
        body = f"📋 *Expediente — {phase}*\n\n{panel}"
    else:
        exp = graph.get("completeness_pct", 0)
        body = f"📋 *Expediente — {phase}*\n\nAvance: {exp}%. Siga contándome su proyecto."
    return md_to_whatsapp(body)


def format_pdf_status(result: dict) -> str:
    if result.get("show_pdf"):
        return md_to_whatsapp(
            "✅ *Plan PDF habilitado*\n\n"
            "Su expediente supera el umbral MEF. "
            "Por ahora el PDF completo se genera en la web CEDIT; "
            "aquí seguimos afinando su idea por chat."
        )
    reason = pdf_lock_reason(result) or "Siga conversando con el mentor."
    return md_to_whatsapp(f"🔒 *PDF aún no disponible*\n\n{reason}")


def format_freemium_block() -> str:
    return md_to_whatsapp(
        "🔒 *Límite alcanzado*\n\n"
        "Usó las consultas gratuitas de plan en este chat.\n"
        "Escriba *REINICIAR* para empezar de cero."
    )


def format_reset_confirm() -> str:
    return md_to_whatsapp(
        "🧠 *¿Reiniciar memoria?*\n\n"
        "Se borrará el historial de este chat.\n"
        "Responda *SÍ* para confirmar o cualquier otra cosa para cancelar."
    )


def format_reset_done() -> str:
    return md_to_whatsapp(
        "✅ Memoria reiniciada. Cuénteme de nuevo su idea o proyecto."
    )


def format_mentor_bubbles(result: dict, *, is_first_turn: bool = False) -> List[str]:
    """Primera respuesta amplia; luego formato compacto."""
    mode = result.get("input_mode") or result.get("mode", "chat")
    if not is_mentor_mode(result.get("mode", ""), mode):
        body = md_to_whatsapp(result.get("display") or result.get("response") or "")
        return chunk_text(body + FOOTER)

    if is_first_turn:
        full = md_to_whatsapp(result.get("response") or mentor_chat_body(result))
        return [b for b in chunk_text(full + FOOTER) if b.strip()]

    opinion = md_to_whatsapp(mentor_chat_body(result))
    graph = result.get("guide_graph") or {}
    phase = result.get("guide_phase") or graph.get("phase_name") or ""
    phase_line = f"\n\n🧭 *Fase:* {phase}" if phase else ""
    compact = f"💬 *Mi opinión — CEDIT*\n\n{opinion}{phase_line}{FOOTER}"
    return [b for b in chunk_text(compact) if b.strip()]
