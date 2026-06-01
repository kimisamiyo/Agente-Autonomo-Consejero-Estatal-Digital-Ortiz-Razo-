"""
Helpers Discord — mismo flujo mentor que la web (opinión corta, panel, métricas, PDF ≥80%).
"""
from __future__ import annotations

import re
from typing import Any, Dict, Optional, Tuple

from cedit_core import MEF_APPROVAL_THRESHOLD

PANEL_HEADING = re.compile(
    r"^##\s*(avance del expediente|lo que ya sabemos|para alimentar|datos críticos)",
    re.I,
)

EARLY_PHASES = frozenset({"DESCUBRIR", "DIAGNOSTICAR", "RECOPILAR"})


def split_opinion_content(opinion: str = "") -> Tuple[str, str]:
    text = (opinion or "").strip()
    if not text:
        return "", ""
    lines = text.split("\n")
    split_at = len(lines)
    for i, line in enumerate(lines):
        if PANEL_HEADING.match(line.strip()):
            split_at = i
            break
    if split_at >= len(lines):
        return text, ""
    chat = "\n".join(lines[:split_at]).strip()
    panel = "\n".join(lines[split_at:]).strip()
    return chat or text, panel


def get_follow_up_section(full_content: str = "") -> str:
    text = full_content or ""
    if "para alimentar" not in text.lower():
        return ""
    parts = re.split(r"##\s*Para alimentar", text, maxsplit=1, flags=re.I)
    if len(parts) < 2:
        return ""
    return f"## Para alimentar{parts[1]}".strip()


def build_panel_markdown(opinion: str = "", full_content: str = "") -> str:
    _, panel = split_opinion_content(opinion)
    follow = get_follow_up_section(full_content)
    chunks = [c for c in (panel, follow) if c]
    return "\n\n".join(chunks).strip()


def is_mentor_mode(mode: str, input_mode: str = "") -> bool:
    m = (input_mode or mode or "").lower()
    return m in ("audit", "plan")


def pdf_lock_reason(result: dict) -> Optional[str]:
    if result.get("show_pdf"):
        return None
    phase = (result.get("guide_phase") or "").upper().replace(" ", "_")
    if phase in EARLY_PHASES:
        return "Complete el recorrido del mentor (fase avanzada) antes del PDF oficial."
    score = result.get("mef_score") or {}
    est = int(score.get("estimated_with_official_plan") or score.get("approval_index") or 0)
    risk = int(score.get("risk_index") or 100)
    if est < MEF_APPROVAL_THRESHOLD:
        return f"PDF disponible desde **{MEF_APPROVAL_THRESHOLD}%** de éxito estimado (ahora: **{est}%**)."
    if risk >= 70:
        return f"Riesgo alto (**{risk}%**). Primero mitigamos brechas con el mentor."
    if not score:
        return "Siga conversando para calcular su índice MEF."
    return "Aún no cumple los criterios para el Plan Técnico Oficial."


def truncate_md(text: str, limit: int = 1800) -> str:
    t = (text or "").strip()
    if len(t) <= limit:
        return t or "—"
    return t[: limit - 20].rstrip() + "\n\n… *(continúa en el hilo)*"


def mentor_chat_body(result: dict) -> str:
    opinion = result.get("opinion") or ""
    full = result.get("response") or ""
    display = result.get("display") or ""
    chat, _ = split_opinion_content(opinion)
    if chat:
        return chat
    if display and display != full:
        return display
    return full or opinion or "—"


def metrics_summary_lines(result: dict) -> list[str]:
    score = result.get("mef_score") or {}
    graph = result.get("guide_graph") or {}
    phase = result.get("guide_phase") or graph.get("phase_name") or "—"
    doc_i = score.get("document_only_index", "—")
    est = score.get("estimated_with_official_plan", "—")
    risk = score.get("risk_index", "—")
    risk_lvl = score.get("risk_level", "—")
    exp = graph.get("completeness_pct", "—")
    prof = graph.get("profile_completeness_pct", "—")
    lines = [
        f"**Fase mentor:** {phase}",
        f"**Expediente MEF:** {exp}% · **Perfil:** {prof}%",
        f"**Índice documento:** {doc_i}%",
        f"**Con plan PDF CEDIT:** {est}%",
        f"**Riesgo:** {risk}% ({risk_lvl})",
    ]
    if result.get("show_pdf"):
        lines.append(f"\n✅ **PDF habilitado** (≥{MEF_APPROVAL_THRESHOLD}% y riesgo controlado)")
    else:
        reason = pdf_lock_reason(result)
        if reason:
            lines.append(f"\n🔒 {reason}")
    crit = graph.get("critical_items") or []
    pending = [c["label"].split("(")[0].strip()[:28] for c in crit if not c.get("collected")][:4]
    if pending:
        lines.append("\n**Datos que faltan:** " + ", ".join(pending))
    progs = graph.get("recommended_programs") or []
    if progs:
        names = ", ".join(p["label"] for p in progs[:3])
        lines.append(f"\n**Programas sugeridos:** {names}")
    return lines
