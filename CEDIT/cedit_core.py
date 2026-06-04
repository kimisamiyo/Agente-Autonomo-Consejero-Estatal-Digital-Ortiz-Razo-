"""
Núcleo compartido CEDIT — misma lógica para Web (FastAPI), Discord y n8n.
"""
import os
import io
import json
import re
import hashlib
import datetime
import time
from typing import List, Dict, Optional, Tuple, Any

from pathlib import Path

from dotenv import load_dotenv
from fpdf import FPDF
from pypdf import PdfReader

from langchain_groq import ChatGroq
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_pinecone import PineconeVectorStore
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage

from guide_engine import (
    assess_guide_state,
    build_graph_visualization,
    build_mentor_activity_message,
    detect_public_figures,
    format_guide_progress,
    guide_phase_instruction,
    risk_level_from_index,
    CoachingPhase,
)

load_dotenv(Path(__file__).resolve().parent / ".env", override=True)

FREE_LIMIT = int(os.getenv("CEDIT_FREE_LIMIT", "10"))
USAGE_FILE = os.path.join(os.path.dirname(__file__), ".cedit_usage.json")

# Señales fuertes: el usuario presenta un plan/expediente y pide asesoramiento (consume cupo)
PLAN_AUDIT_STRONG_KEYWORDS = [
    "auditar", "auditoría", "auditoria", "audita ", "audita mi", "audita el",
    "revisar mi plan", "revisar el plan", "revisar mi expediente", "revisar expediente",
    "analiza el pdf", "analiza mi pdf", "analiza el archivo", "analiza mi plan",
    "dictamen técnico", "dictamen tecnico", "dictamen de",
    "mi plan de inversión", "mi plan de inversion", "nuestro plan de inversión",
    "mi expediente técnico", "mi expediente tecnico", "mi proyecto de inversión",
    "mi proyecto de inversion", "nuestro proyecto", "formular mi plan",
    "presentar al mef", "aprobación en el mef", "aprobacion en el mef",
    "ficha técnica del proyecto", "reestructuración del", "reestructuracion del",
]

# Contexto del proyecto propio (plan en elaboración, no consulta genérica)
PLAN_OWNERSHIP_PHRASES = [
    "mi plan", "mi expediente", "mi proyecto", "nuestro plan", "nuestro proyecto",
    "el plan que", "este plan", "este expediente", "este proyecto",
    "presupuesto del proyecto", "costo del proyecto", "cronograma del proyecto",
]

# Dudas de ciudadano / consulta normativa general (NO consumen cupo)
CITIZEN_GENERAL_KEYWORDS = [
    "ciudadano", "ciudadana", "derecho", "derechos", "reclamo", "queja", "denuncia",
    "silencio administrativo", "gob.pe", "transparencia", "información pública",
    "informacion publica", "defensoría", "defensoria", "contraloría", "contraloria",
    "carta al estado", "carta formal", "solicitud de información",
    "trámite ciudadano", "tramite ciudadano", "servidor público me negó",
]

# Preguntas conceptuales (qué/cómo/cuál) sin presentar un plan propio
CONCEPTUAL_QUESTION_STARTS = (
    "qué es", "que es", "qué son", "que son", "cuál es", "cual es",
    "cuáles son", "cuales son", "cómo es", "como es", "cómo puedo", "como puedo",
    "explícame", "explicame", "dime qué", "dime que", "en qué consiste",
    "diferencia entre", "ejemplo de", "pasos para", "requisitos para",
)

PLAN_RESPONSE_KEYWORDS = [
    "plan de", "expediente", "dictamen", "presupuesto", "invierte.pe",
    "viabilidad", "brechas", "reestructurac", "mef", "componente",
]

AUDIT_SECTION_MARKERS = {
    "opinion": [
        "## mi opinión", "## mi opinion", "## mi opinión como cedit", "## mi opinion como cedit",
        "## opinión del consejero", "## opinion del consejero",
    ],
    "strengths": ["## puntos fuertes", "## fortalezas", "## aspectos positivos"],
    "dictamen": ["## dictamen técnico", "## dictamen tecnico", "## auditoría", "## auditoria"],
}


def _load_usage() -> Dict[str, int]:
    if os.path.exists(USAGE_FILE):
        try:
            with open(USAGE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    return {}


def _save_usage(data: Dict[str, int]) -> None:
    with open(USAGE_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f)


def reset_usage(scope_id: str) -> Dict[str, Any]:
    """Borra el contador freemium de un scope (p. ej. userId web compartido)."""
    data = _load_usage()
    data.pop(scope_id, None)
    _save_usage(data)
    return get_usage(scope_id)


def get_usage(scope_id: str) -> Dict[str, Any]:
    """scope_id = user_id web o conv_id Discord."""
    data = _load_usage()
    count = data.get(scope_id, 0)
    return {
        "count": count,
        "limit": FREE_LIMIT,
        "remaining": max(0, FREE_LIMIT - count),
        "freemium_exceeded": count >= FREE_LIMIT,
    }


def increment_usage(scope_id: str, mode: str) -> Dict[str, Any]:
    """Solo auditorías y planes consumen cupo freemium."""
    if mode not in ("audit", "plan"):
        return get_usage(scope_id)
    data = _load_usage()
    data[scope_id] = data.get(scope_id, 0) + 1
    _save_usage(data)
    return get_usage(scope_id)


def check_freemium(scope_id: str, mode: str) -> None:
    if mode not in ("audit", "plan"):
        return
    if get_usage(scope_id)["freemium_exceeded"]:
        raise FreemiumLimitError(
            f"Has alcanzado el límite gratuito de {FREE_LIMIT} auditorías/planes en esta sesión. "
            "Reinicia la conversación o activa Plan Pro."
        )


class FreemiumLimitError(Exception):
    pass


def is_citizen_or_general_normative(message: str) -> bool:
    """Consultas de ciudadanía o conceptos MEF/Invierte.pe sin plan propio."""
    t = (message or "").lower().strip()
    if not t:
        return False
    if any(k in t for k in CITIZEN_GENERAL_KEYWORDS):
        return True
    if t.startswith(CONCEPTUAL_QUESTION_STARTS):
        if not any(p in t for p in PLAN_OWNERSHIP_PHRASES):
            return True
    if "?" in t and any(s in t for s in CONCEPTUAL_QUESTION_STARTS):
        if not any(p in t for p in PLAN_OWNERSHIP_PHRASES):
            if not any(k in t for k in ("auditar", "auditoría", "auditoria", "audita")):
                return True
    return False


def is_plan_audit_request(message: str, has_pdf: bool = False) -> bool:
    """True si el usuario plantea un plan/expediente y busca asesoramiento (cuenta cupo)."""
    if has_pdf:
        return True
    t = (message or "").lower()
    if is_citizen_or_general_normative(message):
        return False
    if any(k in t for k in PLAN_AUDIT_STRONG_KEYWORDS):
        return True
    has_ownership = any(p in t for p in PLAN_OWNERSHIP_PHRASES)
    has_plan_context = any(
        x in t
        for x in (
            "plan de inversión", "plan de inversion", "expediente técnico", "expediente tecnico",
            "invierte.pe", "perfil de inversión", "perfil de inversion", "formulación",
            "formulacion", "presupuesto multianual", "ficha técnica", "viabilidad del proyecto",
        )
    )
    if has_ownership and has_plan_context:
        return True
    if has_ownership and any(
        x in t for x in ("presupuesto", "viabilidad", "snip", "componente", "dictamen", "mef")
    ):
        return True
    formulation_signals = (
        "crear un", "crear una", "quiero crear", "me gustaría", "me gustaria",
        "es posible", "instituto", "universidad", "centro educativo", "escuela",
        "carrera de", "programa de estudios", "formular un proyecto", "mi idea es",
        "tengo la idea", "proyecto de inversión", "proyecto de inversion",
    )
    if sum(1 for s in formulation_signals if s in t) >= 2:
        return True
    if any(s in t for s in ("instituto", "proyecto", "obra", "pip ")) and any(
        s in t for s in ("crear", "gustaría", "gustaria", "quiero", "formular", "tratar")
    ):
        return True
    return False


def detect_input_mode(message: str, has_pdf: bool = False) -> str:
    """
    Modo de respuesta/prompt. 'chat' = ciudadano o consulta normativa sin plan propio.
    """
    if not is_plan_audit_request(message, has_pdf=has_pdf):
        return "chat"
    t = (message or "").lower()
    if has_pdf or any(
        x in t
        for x in (
            "auditar", "auditoría", "auditoria", "audita", "dictamen",
            "analiza el pdf", "analiza mi pdf", "revisar expediente",
        )
    ):
        return "audit"
    return "plan"


def _history_indicates_audit_session(history: Optional[List[Dict]] = None) -> bool:
    """Historial con respuesta de auditoría previa (p. ej. tras subir PDF)."""
    markers = (
        "## mi opinión",
        "## dictamen",
        "dictamen técnico de auditoría",
        "dictamen tecnico de auditoria",
        "## puntos fuertes",
        "documento recibido",
        "revisando expediente",
    )
    for m in history or []:
        role = (m.get("role") or "").lower()
        if role not in ("assistant", "ai", "bot"):
            continue
        if (m.get("mode") or "").lower() in ("audit", "plan"):
            return True
        c = (m.get("content") or "").lower()
        if any(marker in c for marker in markers):
            return True
    return False


def is_audit_session_active(
    session_mode: Optional[str] = None,
    history: Optional[List[Dict]] = None,
) -> bool:
    """True si el usuario ya entró en modo auditoría/plan y cada mensaje debe contar."""
    sm = (session_mode or "").lower().strip()
    if sm in ("audit", "plan"):
        return True
    return _history_indicates_audit_session(history)


def consumes_freemium_credit(
    message: str,
    has_pdf: bool = False,
    mode: Optional[str] = None,
    session_mode: Optional[str] = None,
    history: Optional[List[Dict]] = None,
) -> bool:
    """Solo auditorías de planes/expedientes consumen las 10 consultas gratis."""
    if is_audit_session_active(session_mode, history):
        return True
    resolved = mode or detect_input_mode(message, has_pdf=has_pdf)
    if resolved == "chat":
        return False
    return is_plan_audit_request(message, has_pdf=has_pdf)


def detect_response_mode(content: str, is_audit: bool = False) -> str:
    if is_audit:
        return "audit"
    if not content:
        return "chat"
    t = content.lower()
    has_headings = "## " in content or "### " in content
    if has_headings and any(k in t for k in PLAN_RESPONSE_KEYWORDS):
        return "plan"
    return "chat"


def should_offer_pdf(
    content: str,
    is_audit: bool = False,
    *,
    guide_state: Optional[Any] = None,
    mef_score: Optional[Dict[str, Any]] = None,
) -> bool:
    mode = detect_response_mode(content, is_audit=is_audit)
    if mode not in ("audit", "plan"):
        return False
    if guide_state is None:
        return False
    if not guide_state.pdf_ready:
        return False
    if guide_state.phase.value < CoachingPhase.ORIENTAR.value:
        return False
    if not mef_score:
        return False
    est = int(mef_score.get("estimated_with_official_plan", 0) or 0)
    risk = int(mef_score.get("risk_index", 100) or 100)
    if est < MEF_APPROVAL_THRESHOLD:
        return False
    if risk >= 70:
        return False
    return True


_DATA_GAP_CHECKS: List[Tuple[str, str, List[str]]] = [
    ("presupuesto total y desglose (soles, componentes)", r"presupuesto|costo\s+total|monto|s/|soles|financiamiento", ["presupuesto", "costo", "monto", "soles", "s/"]),
    ("plazo de ejecución y cronograma", r"cronograma|plazo|mes(es)?\s+de\s+ejecuci|duraci[oó]n", ["cronograma", "plazo", "meses", "duración"]),
    ("ubicación (ubigeo, región, provincia, distrito)", r"ubigeo|ubicaci[oó]n|distrito|provincia|departamento", ["ubigeo", "ubicación", "distrito", "provincia"]),
    ("entidad ejecutora y unidad formuladora", r"entidad\s+ejecutora|formulador|gerencia|municipalidad|ministerio", ["entidad ejecutora", "formulador", "municipalidad"]),
    ("población beneficiaria e indicadores", r"beneficiar|indicador|poblaci[oó]n\s+meta|hogares", ["beneficiario", "indicador", "población"]),
    ("objetivos, productos y componente Invierte.pe", r"objetivo|producto|componente|invierte", ["objetivo", "producto", "componente", "invierte"]),
    ("código SNIP o CUI del proyecto", r"snip|cui|\bcodigo\b", ["snip", "cui"]),
]


def _combined_audit_text(text: str, history: Optional[List[Dict]] = None) -> str:
    parts = [text or ""]
    for h in history or []:
        parts.append(h.get("content") or "")
    return " ".join(parts).lower()


def detect_project_data_gaps(text: str, history: Optional[List[Dict]] = None) -> List[str]:
    """Detecta huecos de información para sugerir preguntas contextuales."""
    blob = _combined_audit_text(text, history)
    gaps = []
    for label, pattern, keywords in _DATA_GAP_CHECKS:
        if not re.search(pattern, blob, re.I) and not any(k in blob for k in keywords):
            gaps.append(label)
    return gaps[:4]


def locale_instruction(locale: str = "es") -> str:
    return LOCALE_PROMPTS[_normalize_locale(locale)]


def _parse_score_json(raw: str) -> Dict[str, Any]:
    """Extrae JSON de la respuesta del modelo de puntuación MEF."""
    default = {
        "approval_index": 0,
        "document_only_index": 0,
        "estimated_with_official_plan": 0,
        "risk_index": 50,
        "risk_level": "MEDIO",
        "worst_case_scenarios": [],
        "strengths": [],
        "missing_points": [],
        "recommendations": [],
        "summary": "",
    }
    if not raw:
        return default
    match = re.search(r"\{[\s\S]*\}", raw)
    if not match:
        return default
    try:
        data = json.loads(match.group())
        for k in default:
            if k in data:
                default[k] = data[k]
        for field in ("approval_index", "document_only_index", "estimated_with_official_plan", "risk_index"):
            try:
                default[field] = max(0, min(100, int(float(default[field]))))
            except (TypeError, ValueError):
                default[field] = 0 if field != "risk_index" else 50
        for field in ("strengths", "missing_points", "recommendations", "worst_case_scenarios"):
            if not isinstance(default[field], list):
                default[field] = [str(default[field])] if default[field] else []
        if isinstance(default.get("risk_level"), str):
            default["risk_level"] = default["risk_level"].strip().upper()
        return default
    except json.JSONDecodeError:
        return default


def score_document_against_mef(
    document_text: str,
    filename: str = "documento.pdf",
    normative_ctx: str = "",
) -> Dict[str, Any]:
    """
    Puntúa un borrador/expediente según criterios MEF/Invierte.pe (índice 0-100).
    """
    excerpt = (document_text or "")[:8000]
    score_prompt = f"""
Eres evaluador técnico del MEF (Perú) para planes de inversión pública en Invierte.pe.
Analiza el documento "{filename}" y responde ÚNICAMENTE con un JSON válido (sin markdown):
{{
  "approval_index": <entero 0-100, calidad actual global del material>,
  "document_only_index": <entero 0-100, si solo se presentara este borrador al MEF>,
  "estimated_with_official_plan": <entero 0-100, probabilidad si genera plan técnico oficial CEDIT de ~10 págs>,
  "risk_index": <entero 0-100, MAYOR = más riesgo de rechazo u observación grave ante MEF>,
  "risk_level": <"BAJO"|"MEDIO"|"ALTO"|"CRÍTICO">,
  "worst_case_scenarios": ["peor escenario plausible 1", "..."],
  "strengths": ["punto fuerte 1", "..."],
  "missing_points": ["brecha 1", "..."],
  "recommendations": ["qué debería aportar el usuario 1", "..."],
  "summary": "frase breve"
}}
Evalúa también riesgos técnicos, normativos, financieros, institucionales y temporales. Sé realista (enfoque fatalista responsable).
Criterios: identificación, problema, solución, presupuesto, cronograma, beneficiarios, riesgos, marco normativo, coherencia SNIP/componente.
Contexto normativo:
{normative_ctx[:3000]}

DOCUMENTO:
{excerpt}
"""
    messages = [
        HumanMessage(content="Eres auditor MEF. Solo JSON, sin texto extra."),
        HumanMessage(content=score_prompt),
    ]
    raw = invoke_llm(messages).content
    parsed = _parse_score_json(raw)
    if not parsed.get("risk_level"):
        parsed["risk_level"] = risk_level_from_index(int(parsed.get("risk_index", 50)))
    parsed["meets_expediente_threshold"] = parsed["estimated_with_official_plan"] >= MEF_APPROVAL_THRESHOLD
    return parsed


def format_mef_score_markdown(score: Dict[str, Any]) -> str:
    """Bloque markdown para mostrar en chat tras subir documento."""
    doc_i = score.get("document_only_index", 0)
    est_i = score.get("estimated_with_official_plan", 0)
    risk_i = score.get("risk_index", 50)
    risk_lvl = score.get("risk_level", "MEDIO")
    lines = [
        "\n\n## Índice de aprobación MEF (estimado por CEDIT)\n",
        f"- **Con su documento actual:** aprox. **{doc_i}%** de alineación con parámetros MEF/Invierte.pe.",
        f"- **Si genera el Plan Técnico Oficial (PDF) con CEDIT:** estimación **{est_i}%**.",
        f"- **Índice de riesgo (rechazo/observación grave):** **{risk_i}%** — nivel **{risk_lvl}**.",
    ]
    if score.get("meets_expediente_threshold"):
        lines.append(f"- ✅ Supera el umbral de **{MEF_APPROVAL_THRESHOLD}%** para figurar en **Mis expedientes** tras generar el PDF.")
    else:
        lines.append(f"- Para **Mis expedientes** se requiere **≥{MEF_APPROVAL_THRESHOLD}%** tras el plan oficial.")
    if score.get("worst_case_scenarios"):
        lines.append("\n### Peores escenarios plausibles\n")
        lines.extend(f"- {s}" for s in score["worst_case_scenarios"][:4])
    if score.get("strengths"):
        lines.append("\n### Fortalezas de su documento\n")
        lines.extend(f"- {s}" for s in score["strengths"][:6])
    if score.get("missing_points"):
        lines.append("\n### Puntos que faltan o deben reforzarse\n")
        lines.extend(f"- {s}" for s in score["missing_points"][:8])
    if score.get("recommendations"):
        lines.append("\n### Qué podría aportar para mejorar\n")
        lines.extend(f"- {s}" for s in score["recommendations"][:6])
    if score.get("summary"):
        lines.append(f"\n*{score['summary']}*")
    return "\n".join(lines)


# Preguntas en lenguaje cotidiano (no jerga MEF/SNIP en fases tempranas).
_GAP_SIMPLE_QUESTIONS: Dict[str, str] = {
    "presupuesto total y desglose (soles, componentes)": (
        "¿Tiene un monto aproximado en soles (aunque sea un rango, por ejemplo entre 500 mil y 2 millones)?"
    ),
    "plazo de ejecución y cronograma": (
        "¿En cuántos meses o años imagina el proyecto y cuándo le gustaría empezar (año aproximado)?"
    ),
    "ubicación (ubigeo, región, provincia, distrito)": (
        "¿En qué región, provincia y distrito estaría el centro o la obra?"
    ),
    "entidad ejecutora y unidad formuladora": (
        "¿Quién lo ejecutaría en la práctica (municipalidad, gobierno regional, universidad, otro)?"
    ),
    "población beneficiaria e indicadores": (
        "¿A cuántas personas o familias beneficiaría más o menos (número aproximado)?"
    ),
}

# No pedir al usuario datos que rara vez tiene en mano en RECOPILAR/DIAGNOSTICAR.
_GAPS_SKIP_EARLY_PHASES = frozenset({
    "código SNIP o CUI del proyecto",
    "objetivos, productos y componente Invierte.pe",
})


def append_followup_questions(content: str, gaps: List[str]) -> str:
    if not gaps or "## para alimentar" in content.lower():
        return content
    lines = ["\n\n## Para alimentar su plan técnico (PDF)\n"]
    added = 0
    for gap in gaps[:2]:
        if gap in _GAPS_SKIP_EARLY_PHASES:
            continue
        q = _GAP_SIMPLE_QUESTIONS.get(gap)
        if q:
            lines.append(f"- {q}")
        else:
            plain = gap.split("(")[0].strip().lower()
            lines.append(f"- ¿Podría contarme sobre **{plain}**?")
        added += 1
    if added == 0:
        return content
    lines.append(
        "\n*Con lo que nos cuente iremos armando el plan oficial; no hace falta códigos técnicos aún.*"
    )
    return content + "\n".join(lines)


def get_pdf_document_stats(pdf_bytes: bytes) -> Tuple[str, int, int]:
    reader = PdfReader(io.BytesIO(pdf_bytes))
    if reader.is_encrypted:
        try:
            reader.decrypt("")
        except Exception:
            raise ValueError("El PDF está protegido con contraseña. Suba una versión sin bloqueo.")
    pages = len(reader.pages)
    parts = []
    for page in reader.pages:
        extracted = page.extract_text()
        if extracted:
            parts.append(extracted)
    text = "\n".join(parts).strip()
    if not text:
        raise ValueError(
            "No se pudo extraer texto del PDF. Puede ser un escaneo sin OCR. "
            "Use un PDF con texto seleccionable o exporte desde Word/Invierte.pe."
        )
    return text, pages, len(text)


def parse_audit_sections(content: str) -> Dict[str, str]:
    """Extrae opinión, puntos fuertes y dictamen del markdown del agente."""
    lines = content.split("\n")
    sections = {"opinion": "", "strengths": "", "dictamen": content, "full": content}
    current = "dictamen"
    buffers: Dict[str, List[str]] = {"opinion": [], "strengths": [], "dictamen": []}

    for line in lines:
        lower = line.strip().lower()
        matched = False
        for key, markers in AUDIT_SECTION_MARKERS.items():
            if any(lower.startswith(m) for m in markers):
                current = key if key != "dictamen" else "dictamen"
                matched = True
                break
        if not matched:
            buffers[current].append(line)

    for key in ("opinion", "strengths", "dictamen"):
        text = "\n".join(buffers[key]).strip()
        if text:
            sections[key] = text
    if sections["opinion"]:
        sections["display"] = sections["opinion"]
        if sections["strengths"]:
            sections["display"] += "\n\n### Puntos fuertes\n" + sections["strengths"]
    else:
        sections["display"] = content
    return sections


# --- Inicialización del motor RAG ---
def _log(msg: str) -> None:
    try:
        print(msg)
    except UnicodeEncodeError:
        print(msg.encode("ascii", "replace").decode("ascii"))


_vectorstore: Optional[PineconeVectorStore] = None


def get_vectorstore() -> PineconeVectorStore:
    """Carga embeddings + Pinecone solo al primer uso (uvicorn escucha antes en Fly)."""
    global _vectorstore
    if _vectorstore is None:
        _log("[CEDIT] Cargando embeddings y Pinecone...")
        embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-mpnet-base-v2")
        _vectorstore = PineconeVectorStore(index_name="agenteautonomo-ortiz", embedding=embeddings)
    return _vectorstore

GROQ_MODEL = "llama-3.1-8b-instant"
GROQ_MODEL_FALLBACK = "llama-3.1-8b-instant"
# compound y llama-4-scout comparten el mismo TPD (500k/día) en Groq
GROQ_SCOUT_TPD_MODELS = {
    m.strip()
    for m in os.getenv(
        "GROQ_SCOUT_TPD_MODELS",
        "groq/compound,meta-llama/llama-4-scout-17b-16e-instruct",
    ).split(",")
    if m.strip()
}
GROQ_TEMPERATURE = float(os.getenv("GROQ_TEMPERATURE", "0.2"))
GROQ_DEBUG = os.getenv("GROQ_DEBUG", "").strip().lower() in ("1", "true", "yes")
GROQ_MAX_SYSTEM_CHARS = int(os.getenv("GROQ_MAX_SYSTEM_CHARS", "6000"))
GROQ_MAX_RAG_CHARS = int(os.getenv("GROQ_MAX_RAG_CHARS", "2000"))

_llm_instances: Dict[str, ChatGroq] = {}
_groq_model_cooldown_until: Dict[str, float] = {}


def _parse_groq_retry_seconds(exc: Exception) -> Optional[float]:
    text = str(exc)
    m = re.search(r"try again in (\d+)m([\d.]+)s", text, re.I)
    if m:
        return int(m.group(1)) * 60 + float(m.group(2))
    m2 = re.search(r"try again in ([\d.]+)s", text, re.I)
    if m2:
        return float(m2.group(1))
    return None


def _mark_groq_model_cooldown(model: str, exc: Exception) -> None:
    if not _is_groq_rate_limit(exc):
        return
    wait = _parse_groq_retry_seconds(exc) or 1800.0
    until = time.time() + wait
    _groq_model_cooldown_until[model] = until
    text = str(exc).lower()
    if "llama-4-scout" in text or "llama-scout" in text:
        for shared in GROQ_SCOUT_TPD_MODELS:
            _groq_model_cooldown_until[shared] = until
    if GROQ_DEBUG:
        _log(f"[CEDIT] Cooldown {model} ~{int(wait)}s por límite Groq")


def _groq_model_available(model: str) -> bool:
    return time.time() >= _groq_model_cooldown_until.get(model, 0.0)


def reset_groq_runtime() -> None:
    """Limpia cooldowns y caché LLM (p. ej. al reiniciar uvicorn)."""
    _groq_model_cooldown_until.clear()
    _llm_instances.clear()


def _read_cedit_dotenv() -> Dict[str, str]:
    """Lee CEDIT/.env directamente (evita otra variable de entorno o .env duplicado)."""
    env_path = Path(__file__).resolve().parent / ".env"
    out: Dict[str, str] = {}
    if not env_path.is_file():
        return out
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        out[key.strip()] = val.strip()
    return out


def reload_groq_config() -> None:
    """Recarga modelos desde CEDIT/.env y limpia cooldowns/caché LLM."""
    global GROQ_MODEL, GROQ_MODEL_FALLBACK
    file_env = _read_cedit_dotenv()
    GROQ_MODEL = (
        file_env.get("GROQ_MODEL")
        or os.getenv("GROQ_MODEL")
        or "llama-3.1-8b-instant"
    ).strip()
    GROQ_MODEL_FALLBACK = (
        file_env.get("GROQ_MODEL_FALLBACK")
        or os.getenv("GROQ_MODEL_FALLBACK")
        or "llama-3.1-8b-instant"
    ).strip()
    os.environ["GROQ_MODEL"] = GROQ_MODEL
    os.environ["GROQ_MODEL_FALLBACK"] = GROQ_MODEL_FALLBACK
    reset_groq_runtime()


reload_groq_config()


def groq_runtime_status() -> Dict[str, Any]:
    now = time.time()
    primary = GROQ_MODEL
    fallback = GROQ_MODEL_FALLBACK
    cooldowns = {
        model: max(0, int(until - now))
        for model, until in _groq_model_cooldown_until.items()
        if until > now
    }
    return {
        "primary": primary,
        "fallback": fallback,
        "env_file": str(Path(__file__).resolve().parent / ".env"),
        "cooldown_seconds": cooldowns,
    }


def _get_groq_llm(model_name: str) -> ChatGroq:
    if model_name not in _llm_instances:
        _llm_instances[model_name] = ChatGroq(temperature=GROQ_TEMPERATURE, model_name=model_name)
    return _llm_instances[model_name]


def _is_groq_rate_limit(exc: Exception) -> bool:
    text = str(exc).lower()
    if any(
        k in text
        for k in (
            "429",
            "rate_limit",
            "rate limit",
            "tokens per day",
            "rate_limit_exceeded",
            "quota",
            "too many requests",
        )
    ):
        return True
    status = _groq_http_status(exc)
    if status == 429:
        return True
    code = getattr(exc, "code", None)
    if code in ("rate_limit_exceeded", "tokens"):
        return True
    return False


def _groq_http_status(exc: Exception) -> Optional[int]:
    status = getattr(exc, "status_code", None)
    if status is not None:
        return int(status)
    response = getattr(exc, "response", None)
    if response is not None:
        return getattr(response, "status_code", None)
    text = str(exc)
    for code in (403, 404, 429, 503):
        if f"error code: {code}" in text.lower() or f" {code} " in f" {text} ":
            return code
    return None


def _is_groq_fallback_worthy(exc: Exception) -> bool:
    """Errores donde conviene probar el otro modelo sin avisar al usuario."""
    if _is_groq_rate_limit(exc):
        return True
    text = str(exc).lower()
    if any(
        k in text
        for k in (
            "permissions_error",
            "blocked at the project",
            "model_not_found",
            "does not exist",
            "decommissioned",
            "not supported",
        )
    ):
        return True
    status = _groq_http_status(exc)
    return status in (403, 404, 503)


def _groq_model_chain() -> List[str]:
    """Orden: principal → respaldo; omite modelos en cooldown por 429."""
    primary, fallback = GROQ_MODEL, GROQ_MODEL_FALLBACK
    chain: List[str] = []
    seen = set()
    for model in (primary, fallback):
        if model and model not in seen and _groq_model_available(model):
            chain.append(model)
            seen.add(model)
    return chain


def invoke_llm(messages):
    """Groq con fallback transparente; cooldown solo por modelo que recibió 429."""
    chain = _groq_model_chain()
    if not chain:
        raise RuntimeError(
            "Los modelos de IA están temporalmente al límite. Espera unos minutos e inténtalo de nuevo."
        )

    last_err: Optional[Exception] = None
    for i, model in enumerate(chain):
        try:
            if GROQ_DEBUG and i > 0:
                _log(f"[CEDIT] Groq fallback → {model}")
            result = _get_groq_llm(model).invoke(messages)
            if model == GROQ_MODEL and GROQ_MODEL in _groq_model_cooldown_until:
                _groq_model_cooldown_until.pop(GROQ_MODEL, None)
            return result
        except Exception as ex:
            last_err = ex
            _mark_groq_model_cooldown(model, ex)
            if _is_groq_fallback_worthy(ex) and i + 1 < len(chain):
                next_model = chain[i + 1]
                if _rate_limit_blocks_model(ex, next_model):
                    if GROQ_DEBUG:
                        _log(f"[CEDIT] Misma cuota TPD en {next_model}, sin segundo intento.")
                    raise
                if GROQ_DEBUG:
                    _log(f"[CEDIT] {model} no disponible, probando {next_model}…")
                continue
            raise
    if last_err:
        raise last_err
    raise RuntimeError("No hay modelos Groq configurados (GROQ_MODEL).")


def public_llm_error_message(exc: Exception) -> str:
    """Mensaje seguro para web/Discord: nunca expone modelos Groq ni códigos API."""
    if isinstance(exc, RuntimeError) and "temporalmente al límite" in str(exc):
        return (
            "El asistente está con mucha demanda en este momento. "
            "Espera unos minutos e inténtalo de nuevo."
        )
    if _is_groq_rate_limit(exc):
        return (
            "El asistente está con mucha demanda en este momento. "
            "Espera unos minutos e inténtalo de nuevo."
        )
    text = str(exc).lower()
    if "blocked at the project" in text or "permissions_error" in text:
        return "No pudimos procesar tu solicitud ahora. Inténtalo de nuevo en unos instantes."
    if any(
        x in text
        for x in (
            "groq",
            "llama-4-scout",
            "llama-scout",
            "meta-llama",
            "rate_limit",
            "tokens per day",
            "error code: 429",
            "error code: 403",
            "gpt-oss",
        )
    ):
        return "No pudimos procesar tu solicitud ahora. Inténtalo de nuevo en unos instantes."
    return str(exc)


# Compatibilidad con imports legacy
llm = _get_groq_llm(GROQ_MODEL)


def _cap_rag_context(text: str, max_chars: Optional[int] = None) -> str:
    limit = max_chars if max_chars is not None else GROQ_MAX_RAG_CHARS
    if len(text) <= limit:
        return text
    return text[:limit] + "\n\n[... contexto normativo truncado ...]"


def _rate_limit_blocks_model(exc: Exception, model: str) -> bool:
    """True si el 429 ya aplica al modelo de respaldo (misma cuota TPD)."""
    if not model or not _is_groq_rate_limit(exc):
        return False
    text = str(exc).lower()
    slug = model.lower()
    short = slug.split("/")[-1]
    return slug in text or short in text


def _escape_langchain_system_template(text: str, allowed_vars: Optional[Tuple[str, ...]] = ("context",)) -> str:
    """Los .md del agent_mind usan llaves (Mermaid/JSON); LangChain las interpreta como variables."""
    escaped = text.replace("{", "{{").replace("}", "}}")
    for var in allowed_vars or ():
        escaped = escaped.replace(f"{{{{{var}}}}}", f"{{{var}}}")
    return escaped


AGENT_MIND_FULL_FILES = [
    "master.md",
    "soul.md",
    "soul_extended.md",
    "instinct.md",
    "vision.md",
    "plan.md",
    "decision_graph.md",
    "decision_graph_extended.md",
]
AGENT_MIND_CHAT_FILES = [
    "master.md",
    "soul.md",
    "instinct.md",
    "plan.md",
]


def load_cognitive_architecture(
    files: Optional[List[str]] = None,
    max_chars: Optional[int] = None,
) -> str:
    mind_dir = os.path.join(os.path.dirname(__file__), "agent_mind")
    file_list = files or AGENT_MIND_FULL_FILES
    cap = max_chars if max_chars is not None else GROQ_MAX_SYSTEM_CHARS
    prompt_parts = []
    for f in file_list:
        path = os.path.join(mind_dir, f)
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as file:
                prompt_parts.append(file.read())
    base = "\n\n".join(prompt_parts)
    if len(base) > cap:
        base = (
            base[:cap]
            + "\n\n[... memoria del agente recortada para cumplir límites Groq; prioriza normativa y guía MEF ...]"
        )
    raw = base + "\n\nContexto normativo encontrado:\n{context}"
    return _escape_langchain_system_template(raw)


def _make_chat_prompt_template(system_text: str) -> ChatPromptTemplate:
    return ChatPromptTemplate.from_messages([
        ("system", system_text),
        MessagesPlaceholder(variable_name="chat_history"),
        ("human", "{input}"),
    ])


SYSTEM_PROMPT_TEXT = load_cognitive_architecture()
CHAT_SYSTEM_PROMPT_TEXT = load_cognitive_architecture(
    AGENT_MIND_CHAT_FILES,
    max_chars=min(GROQ_MAX_SYSTEM_CHARS, 7000),
)

prompt = _make_chat_prompt_template(SYSTEM_PROMPT_TEXT)
chat_prompt = _make_chat_prompt_template(CHAT_SYSTEM_PROMPT_TEXT)

CEDIT_IDENTITY_FIRST_TURN_ES = """
IDENTIDAD — Primer turno (NO te presentes a menos que te pregunten quién eres):
- NO digas "Soy CEDIT" ni te presentes si el usuario solo saluda ("hola", "cómo estás", "buenas").
- En el primer turno responde de forma NATURAL, amable y breve. Ejemplo:
  "¡Hola! ¿En qué puedo ayudarle hoy? Si tiene alguna duda sobre un trámite o proceso del Estado, o si necesita orientación para un proyecto, estoy aquí para guiarle."
- SÉ BREVE: 2-3 oraciones máximo si es un saludo.
- Si el usuario plantea una consulta concreta, responde directamente con contenido útil.
- NUNCA generes listas de "aspectos a considerar".
- NO menciones "inversión pública" ni "MEF" a menos que el usuario lo mencione primero.
- Tu tono: cálido, cercano, profesional. Como un funcionario amable que quiere ayudar.
"""

CEDIT_IDENTITY_WHOAMI_ES = """
IDENTIDAD — Te preguntaron quién eres. Responde:
"Soy CEDIT, su Consejero Estatal Digital. Puedo resolver sus dudas como ciudadano sobre trámites y procesos del Estado, o guiarle como servidor público a consolidar un plan de inversión sostenible ante el MEF."
- Luego pregunta brevemente en qué puedes ayudar.
- SÉ BREVE: máximo 3 oraciones.
"""

CEDIT_IDENTITY_FIRST_TURN_QU = """
IDENTIDAD — Ñawpaq kutichiy (o napay / ¿pitaj kanki?):
- Preséntate UNA sola vez **llapan runasimipi (quechua)** — mana español rimaytachu:
  "Ñuqaqa **CEDIT** kani, Perú llaqtapa Digital Amachiq (Consejero Estatal Digital). Llank'ayniqa llaqtayuq runata purichinapi yanapayta, kamachiq runakunatapas **MEF**wan **Invierte.pe**wan allin inversión plan wakichiyta."
- Chay qipan usqhaylla runapa tapunanta quechua nisqapi kutichiy.
"""

CEDIT_IDENTITY_FIRST_TURN_AY = """
IDENTIDAD — Nayra kutichawi (jan ukax napay / ¿kuna runas thaqha?):
- Preséntate UNA sola vez **taqi arut aymara** — jani español arut:
  "Nayax **CEDIT** satawa, Perú markan Digital Amuyt'iri. Lurañan llaqta runanakar puriyt'apxta, kamachirinakar **MEF** ukat **Invierte.pe** ukan sum inversión plan lurañ yanapt'apxta."
- Ukhamaraki jumana jiskt'äwim aymara arut kutichipxama.
"""

CEDIT_IDENTITY_FIRST_BY_LOCALE = {
    "es": CEDIT_IDENTITY_FIRST_TURN_ES,
    "qu": CEDIT_IDENTITY_FIRST_TURN_QU,
    "ay": CEDIT_IDENTITY_FIRST_TURN_AY,
}

CEDIT_IDENTITY_ONGOING = """
IDENTIDAD — Conversación en curso:
- Eres **CEDIT**. **PROHIBIDO** repetir la presentación larga ni abrir en español si el idioma activo no es español.
- Ve directo al contenido en el idioma activo. Solo preséntate de nuevo si preguntan explícitamente quién eres (en ese idioma, una vez).
"""

LOCALE_PROMPTS = {
    "es": (
        "IDIOMA ACTIVO: **español** (Perú). Toda la respuesta en español."
    ),
    "qu": (
        "IDIOMA ACTIVO: **QUECHUA (Runasimi)** — OBLIGATORIO, sin excepción.\n"
        "- Escribe **todo** el mensaje en quechua sureño peruano (ortografía escolar): saludo, explicación, preguntas y viñetas.\n"
        "- **PROHIBIDO** mezclar oraciones en español (no digas «Soy CEDIT», «Mi función es», «¿En qué puedo ayudarle?»).\n"
        "- Solo acrónimos oficiales entre paréntesis si no hay palabra en quechua: (MEF), (Invierte.pe), (SNIP).\n"
        "- Si el usuario escribe en quechua, responde **100% en quechua**."
    ),
    "ay": (
        "IDIOMA ACTIVO: **AYMARA** — OBLIGATORIO, sin excepción.\n"
        "- Escribe **taqi** kutichawi aymara arut (ortografía escolar peruana).\n"
        "- **Janiw** español arut jikxatañapaka (jan «Soy CEDIT», «¿En qué puedo ayudarle?»).\n"
        "- Solo acrónimos entre paréntesis: (MEF), (Invierte.pe).\n"
        "- Jiskt'äwi aymara arut ukham jiskt'ätaxa, **100% aymara** kutichipxama."
    ),
}


def _history_has_assistant_turn(history: Optional[List[Dict]]) -> bool:
    for m in history or []:
        role = (m.get("role") or "").lower()
        if role in ("assistant", "ai", "bot"):
            return True
    return False


def _user_asks_who_are_you(message: str) -> bool:
    t = (message or "").lower()
    triggers = (
        "quién eres", "quien eres", "qué eres", "que eres", "quién es cedit",
        "presentate", "preséntate", "who are you", "piq runa kanki", "kuna runa kanki",
        "pitaj kanki", "ima sutiyki", "kuna runa kanki", "kuna sutim",
    )
    return any(x in t for x in triggers)


def _normalize_locale(locale: str = "es") -> str:
    key = (locale or "es").lower()[:2]
    return key if key in LOCALE_PROMPTS else "es"


def cedit_identity_instruction(
    history: Optional[List[Dict]] = None,
    message: str = "",
    locale: str = "es",
) -> str:
    key = _normalize_locale(locale)
    asks_who = _user_asks_who_are_you(message)
    first = not _history_has_assistant_turn(history)

    if asks_who:
        block = CEDIT_IDENTITY_WHOAMI_ES
    elif first:
        block = CEDIT_IDENTITY_FIRST_BY_LOCALE.get(key, CEDIT_IDENTITY_FIRST_TURN_ES)
    else:
        block = CEDIT_IDENTITY_ONGOING
    return block + "\n" + locale_instruction(key)


REJECTION_OUT_OF_SCOPE = {
    "technical": {
        "es": (
            "Con gusto le atiendo en lo que es mi especialidad.\n\n"
            "Soy CEDIT, su Consejero Estatal Digital del Perú. Puedo **guiarle en trámites y derechos "
            "ciudadanos**, aclarar **normativa** (**MEF**, **Invierte.pe**, **OSCE**) y apoyar **planes de "
            "inversión pública** conforme a la ley.\n\n"
            "Sobre programación, depuración de código o errores técnicos de software, **no puedo ayudarle**; "
            "ese tema queda fuera de la gestión pública que regula mi trabajo.\n\n"
            "**¿Qué desea hacer ahora?** Por ejemplo: consultar un trámite, un requisito normativo o un "
            "expediente de inversión — con gusto le oriento."
        ),
        "qu": (
            "Sumaqta yanapayta atiyniyuq kachkani.\n\n"
            "Ñuqaqa **CEDIT** kani, Perú llaqtapa Digital Amachiq. Llaqtayuq runapa **kamachiy puriykunapi**, "
            "**hayñinkunapi**, **MEF** / **Invierte.pe** / **OSCE** **kamachikuykunapi** chaymanta **inversión "
            "plan** allin wakichiyta yanapayta atiyni.\n\n"
            "Programación, código allichay utaq software pantaykunamantaqa **manam yanapayta atiynichu**; "
            "chayqa mana kamachiq llaqtapa llank'ayniyuqchu.\n\n"
            "**¿Imatataq kunan ruwayta munanki?** Ejemplopaq: huk trámite tapuy, normativa utaq inversión "
            "expediente — kusisqa purichiyta qonqayki."
        ),
        "ay": (
            "Suma juk'amp yanapt'asmat jumanakaruxa.\n\n"
            "Nayax **CEDIT** satawa, Perú markan Digital Amuyt'iri. Jumanakar **kamachin lurañ puriyt'apxta**, "
            "**hayk'apt'awinakapaxa**, **MEF** / **Invierte.pe** / **OSCE** **kamachinakapaxa** ukat **inversión "
            "plan** sum lurañata yanapt'asmat.\n\n"
            "Programación, código alañ ukax **janw yanapt'kaspati**: janiw kamachin markan lurañanakapax utjkiti.\n\n"
            "**¿Kunats jumax kunjam lurañ munasmat?** Uka: mä trámite jiskt'äwi, kamachi ukax inversión "
            "expediente — suma puriyt'apxta."
        ),
    },
    "illicit": {
        "es": (
            "Le agradezco su mensaje. Soy **CEDIT**, Consejero Estatal Digital del Perú.\n\n"
            "Mi utilidad para usted es **orientar trámites legales**, aclarar **derechos ciudadanos** y apoyar "
            "**planes de inversión pública** serios ante el **MEF** e **Invierte.pe**, siempre con **legalidad** "
            "y ética pública.\n\n"
            "Sobre lo que plantea, **no puedo ayudarle**: toca conductas ilegales o contrarias al interés del "
            "Estado. Esas materias no caben en la gestión pública ni en expedientes que evalúa el sector público.\n\n"
            "**¿Qué desea hacer en su lugar?** Si lo prefiere, retomemos un proyecto legítimo, un trámite o una "
            "consulta normativa en la que sí pueda asistirle."
        ),
        "qu": (
            "Qanpa willakuyniykita agradeceykuy. Ñuqaqa **CEDIT** kani, Perú llaqtapa Digital Amachiq.\n\n"
            "Yanapayta atiyniyqa **kamachisqa trámitekuna purichiy**, **llaqtayuq hayñinkuna** willayta chaymanta "
            "**MEF**wan **Invierte.pe**wan **inversión plan** allin wakichiy, **kamachisqa** kasqanpi.\n\n"
            "Qam willasqaykimantaqa **manam yanapayta atiynichu**: mana allin, mana kamachisqa luraqkunam. "
            "Chaykunqa mana kamachiq llaqtapa llank'ayniyuqchu.\n\n"
            "**¿Imatataq wak munanki?** Allin proyecto, trámite utaq normativa tapuy — chaypi kusisqa yanapayta atiyni."
        ),
        "ay": (
            "Juman aruskipäwim juk'amp yuspagara. Nayax **CEDIT** satawa, Perú markan Digital Amuyt'iri.\n\n"
            "Yanapt'asmat jumanakar **kamachin lurañ puriyt'apxta**, **llaqta runanakan hayk'apt'awinakapaxa** ukat "
            "**MEF** ukat **Invierte.pe** ukan **inversión plan** sum lurañata, **kamachin** sata.\n\n"
            "Juman uñt'ayatax **janw yanapt'kaspati**: jan kamachin, jan sum lurañawinakawa. "
            "Ukax janiw kamachin markan lurañanakapax utjkiti.\n\n"
            "**¿Kunats jumax wak munasmat?** Suma proyecto, trámite ukax kamachi jiskt'äwi — ukham yanapt'asmat."
        ),
    },
}

REJECTION_IN_AUDIT_SESSION = {
    "technical": {
        "es": (
            "Gracias por seguir en **modo auditoría** de su expediente.\n\n"
            "Soy **CEDIT**. Aquí mi utilidad es revisar su **plan o expediente** según **MEF** e **Invierte.pe** "
            "(viabilidad, costos, brechas normativas, datos del proyecto).\n\n"
            "Sobre **programación, código o errores de software**, **no puedo ayudarle** en esta sesión; "
            "no forma parte del dictamen de inversión pública.\n\n"
            "**¿Qué aspecto de su expediente desea revisar ahora?** Por ejemplo: viabilidad, financiamiento, "
            "componente Invierte.pe o datos faltantes para el dictamen."
        ),
        "qu": (
            "Gracias, **qhaway modo**niykipi kachkanki.\n\n"
            "Ñuqaqa **CEDIT** kani. Kaypi **MEF** / **Invierte.pe** nisqapi planniyki qhawayta yanapayta atiyni "
            "(allin ruway, qullqiy, kamachikuy pantasqakuna, proyecto willakuy).\n\n"
            "**Programación** utaq **código**mantaqa **manam yanapayta atiynichu**; mana qhaway dictamenpa "
            "llank'ayniyuqchu.\n\n"
            "**¿Imataq kunan expedientenmanta qhawayta munanki?** Ejemplopaq: allin ruway, qullqiy, Invierte.pe "
            "componente utaq mana kachkaq willakuykuna."
        ),
        "ay": (
            "Yuspagara, **uñakawi modon** uñt'atasmatjja.\n\n"
            "Nayax **CEDIT** satawa. Akan **MEF** / **Invierte.pe** ukan plan uñakawi yanapt'asmat — "
            "suma lurañ, qullqi, kamachi jan walt'awinaka, proyecto yatiyawi.\n\n"
            "**Programación** ukax **janw yanapt'kaspati**; janiw inversión uñakawi lurañanakapax utjkiti.\n\n"
            "**¿Kunats jumax kunjam expediente uñakaw munasmat?** Uka: suma lurañ, qullqi, Invierte.pe "
            "componente jan ukax jani utjki yatiyawinaka."
        ),
    },
    "illicit": {
        "es": (
            "Gracias por su mensaje. Seguimos en **modo auditoría**, pero solo para expedientes **legítimos** "
            "y conformes a la ley.\n\n"
            "Soy **CEDIT**. Puedo apoyar **planes de inversión pública** serios ante el **MEF** e **Invierte.pe**; "
            "**no puedo ayudarle** con propuestas ilegales ni orientar fraude o delitos.\n\n"
            "**¿Desea retomar la revisión de un expediente legal?** Indíqueme, por ejemplo: viabilidad, "
            "presupuesto, brechas normativas o datos pendientes de su plan."
        ),
        "qu": (
            "Qanpa willakuyniykita agradeceykuy. **Qhaway modon** kachkayku, ichaqa **kamachisqa** "
            "proyectokunallam.\n\n"
            "Ñuqaqa **CEDIT** kani. **MEF**wan **Invierte.pe**wan allin **inversión plan** qhawayta atiyni; "
            "mana allin, mana kamachisqa willakuykunamantaqa **manam yanapayta atiynichu**.\n\n"
            "**¿Allin expedientenmanta qhawayta munankichu?** Ejemplopaq: allin ruway, presupuesto, "
            "kamachikuy pantasqakuna utaq mana kachkaq datos."
        ),
        "ay": (
            "Juman aruskipäwim juk'amp yuspagara. **Uñakawi modon** uñt'atasmatjja, ukhamaraki **kamachin** "
            "proyectonakakiw.\n\n"
            "Nayax **CEDIT** satawa. **MEF** ukat **Invierte.pe** ukan sum **inversión plan** uñakawi "
            "yanapt'asmat; jan kamachin uñt'awinakax **janw yanapt'kaspati**.\n\n"
            "**¿Sum expediente uñakaw munasmat?** Uka: suma lurañ, presupuesto, kamachi jan walt'awinaka "
            "jan ukax jani utjki yatiyawinaka."
        ),
    },
}


def kind_rejection_message(
    kind: str,
    locale: str = "es",
    in_audit_session: bool = False,
) -> str:
    key = _normalize_locale(locale)
    source = REJECTION_IN_AUDIT_SESSION if in_audit_session else REJECTION_OUT_OF_SCOPE
    bucket = source.get(kind) or source["technical"]
    return bucket.get(key, bucket["es"])


def _chat_rejection_payload(
    scope: str,
    kind: str,
    locale: str = "es",
    *,
    audit_session: bool = False,
    session_mode: Optional[str] = None,
    skip_usage: bool = False,
) -> Dict[str, Any]:
    if audit_session and not skip_usage:
        check_freemium(scope, "audit")
    usage = get_usage(scope)
    if audit_session and not skip_usage:
        usage = increment_usage(scope, "audit")
    sm = (session_mode or "audit").lower().strip()
    mode = "plan" if audit_session and sm == "plan" else "audit" if audit_session else "chat"
    return {
        "response": kind_rejection_message(kind, locale, in_audit_session=audit_session),
        "mode": mode,
        "input_mode": mode,
        "consumes_audit_credit": audit_session,
        "usage": usage,
        "show_pdf": False,
    }


PDF_OUTPUT_LOCALE_NOTE = {
    "es": "Redacta el documento en español formal peruano (MEF).",
    "qu": "Redacta el documento en quechua; incluye glosario breve en español para términos MEF.",
    "ay": "Redacta el documento en aymara; incluye glosario breve en español para términos MEF.",
}

MEF_APPROVAL_THRESHOLD = 80

AUDIT_STRUCTURE_INSTRUCTION = """
▓▓▓ MODO CEDIT: GUÍA / LÍDER / MENTOR — NO ASISTENTE PASIVO ▓▓▓

MÁXIMA PRIORIDAD: La estructura y longitud de tu respuesta la define [FASE GRAFO] más arriba.
Si la fase es DESCUBRIR, DIAGNOSTICAR o RECOPILAR → OBEDECE sus restricciones de formato SIN EXCEPCIÓN.

PROHIBIDO (formato enciclopedia / manual — lo que el usuario NO quiere):
• Listas numeradas largas tipo "1. Marco normativo 2. Requisitos 3. Duración…".
• Títulos sueltos tipo "Creación de Instituto de…" sin las secciones ## del mentor.
• Subsecciones genéricas (Denominación, Objetivos, Diseño curricular…) copiadas de manuales SUNEDU.
• Cerrar con "¿Te gustaría profundizar…?", "¿necesitas ayuda para elaborar…?" o variantes.
• Más de 12 líneas totales en fases 0-2 sin usar las secciones ## obligatorias del grafo.

PROHIBICIONES ABSOLUTAS EN FASES TEMPRANAS (0-2):
• NO hagas listas de "aspectos a considerar" (el usuario no las pidió).
• NO hagas más de 2 preguntas por mensaje. JAMÁS.
• NO escribas más de 4 párrafos repartidos en las secciones ## (no un solo bloque).
• NO preguntes cosas que TÚ debes investigar (normativa, obras similares, criterios del organismo, precedentes).
• NO termines con "¿Te gustaría profundizar en alguno...?" — TÚ DECIDES la dirección.

COMPORTAMIENTO DE GUÍA (orden del mensaje):
1. Muestra cómo **va transformándose su idea** (de vaga → expediente concreto).
2. Da **recomendaciones** y análisis (programas, ruta, precedentes) — con tono lindo y transparente.
3. Explica **qué podría lograr** (impacto) y **qué podría pasar** (riesgos reales, sin alarmismo ni promesas vacías).
4. Solo al final, **1-2 preguntas** sencillas que el usuario pueda responder.

• INVESTIGA antes de preguntar: obras similares, organismo, qué aprobó o observó el MEF.
• NO empieces el turno con preguntas ni con listas de "aspectos a considerar".
• Pregunta solo lo que el usuario PUEDE saber (lugar, ejecutor, plazo/monto aproximados).
• NO pidas SNIP/CUI/códigos técnicos en fases tempranas.
• GUÍA = propones dirección; el usuario confirma o corrige.

SEGURIDAD: Si es ilegal o fraudulento, rechaza sin usar esta estructura.
NO inventes cifras. PDF solo en CONSOLIDAR o completitud ≥70%.
RECOLECCIÓN en fases avanzadas: extrae datos del expediente (denominación, SNIP/CUI, entidad, ubigeo, costo, plazo, componente, beneficiarios).
"""


def sanitize_mentor_response(content: str) -> str:
    """Quita cierres tipo enciclopedia que el modelo aún suele generar."""
    if not content:
        return content
    banned_patterns = [
        r"¿\s*te gustaría profundizar[^\n?]*\?",
        r"¿\s*necesitas ayuda para elaborar[^\n?]*\?",
        r"¿\s*deseas que profundice[^\n?]*\?",
        r"¿\s*quieres que profundice[^\n?]*\?",
    ]
    out = content
    for pat in banned_patterns:
        out = re.sub(pat, "", out, flags=re.I)
    return re.sub(r"\n{3,}", "\n\n", out).strip()

AUDIT_PDF_GATHERING_INSTRUCTION = """
Al auditar un documento adjunto (PDF), extrae y utiliza TODA la información disponible:
denominación, entidad, ubigeo, montos, cronograma, objetivos, productos, indicadores, riesgos,
normativa citada, firmas y fechas. Si el texto está incompleto, señala qué datos faltan para un expediente MEF sólido.
"""

# Secciones del PDF oficial (~9-10 páginas): una llamada LLM por bloque
PDF_SECTION_SPECS: List[Tuple[str, str, str]] = [
    ("1", "IDENTIFICACIÓN Y RESUMEN EJECUTIVO",
     "Ficha del proyecto, entidad ejecutora, ubicación, costo total, plazo, financiamiento, objetivo general y resumen de 1 página."),
    ("2", "MARCO NORMATIVO Y ALCANCE",
     "Directivas MEF, Invierte.pe, SNIP, Ley de Presupuesto; alcance territorial e institucional del proyecto."),
    ("3", "DIAGNÓSTICO Y PROBLEMÁTICA",
     "Situación actual, demanda, brechas, población beneficiaria, indicadores de línea base."),
    ("4", "ALTERNATIVAS Y SOLUCIÓN TÉCNICA",
     "Alternativas evaluadas, solución propuesta, ingeniería/alcance físico, metodología de ejecución."),
    ("5", "FORMULACIÓN FINANCIERA Y PRESUPUESTO",
     "Costo de inversión, desglose por componentes/capitulos, fuentes de financiamiento, O&M, contingencias."),
    ("6", "CRONOGRAMA DE EJECUCIÓN",
     "Hitos, plazos por fase, entregables, supervisión y liquidación."),
    ("7", "ANÁLISIS DE RIESGOS",
     "Matriz: riesgo | probabilidad | impacto | mitigación. Mínimo 8 riesgos."),
    ("8", "IMPACTO SOCIOAMBIENTAL Y SOSTENIBILIDAD",
     "Externalidades, salvaguardas, sostenibilidad técnica y fiscal del proyecto."),
    ("9", "CAPACIDAD INSTITUCIONAL Y GESTIÓN",
     "Unidad formuladora, ejecutora, contrataciones OSCE, cadena de responsabilidad."),
    ("10", "CONCLUSIONES, VIABILIDAD Y RECOMENDACIONES MEF",
     "Dictamen de viabilidad, brechas pendientes, pasos para Invierte.pe y firma conceptual del documento."),
]

PDF_MIN_WORDS_PER_SECTION = 380
PDF_AUDIT_TEXT_LIMIT = 18000
PDF_CHAT_EXTRACT_LIMIT = 12000


def _format_history(history: List[Dict], limit: int = 6) -> List:
    formatted = []
    for msg in history[-limit:]:
        role = msg.get("role", "")
        content = msg.get("content", "")
        if role in ("user", "human"):
            formatted.append(HumanMessage(content=content))
        elif role in ("assistant", "bot", "ai"):
            formatted.append(AIMessage(content=content))
    return formatted


def _build_conversation_digest(
    history: Optional[List[Dict]],
    base_content: str,
    audit_opinion: str = "",
    audit_dictamen: str = "",
    source_document: str = "",
) -> str:
    parts = []
    if source_document:
        parts.append(f"--- DOCUMENTO FUENTE (expediente del usuario) ---\n{source_document[:PDF_AUDIT_TEXT_LIMIT]}")
    if audit_opinion:
        parts.append(f"--- OPINIÓN DE AUDITORÍA (chat) ---\n{audit_opinion[:3000]}")
    if audit_dictamen:
        parts.append(f"--- DICTAMEN DE AUDITORÍA (chat) ---\n{audit_dictamen[:5000]}")
    if history:
        parts.append("--- HISTORIAL DE CONVERSACIÓN ---")
        for h in history[-12:]:
            role_name = "Usuario" if h.get("role") == "user" else "Asesor CEDIT"
            parts.append(f"{role_name}: {(h.get('content') or '')[:2000]}")
    parts.append(f"--- PROPUESTA / ANÁLISIS BASE ---\n{base_content[:8000]}")
    return "\n\n".join(parts)


def _gather_normative_context(queries: List[str], k: int = 2) -> str:
    seen = set()
    chunks: List[str] = []
    for q in queries:
        if not q or len(q) < 20:
            continue
        for doc in get_vectorstore().similarity_search(q[:1500], k=k):
            snippet = doc.page_content.strip()
            key = snippet[:120]
            if key not in seen:
                seen.add(key)
                chunks.append(snippet)
    return "\n\n---\n\n".join(chunks[:12])


def _generate_pdf_sections_chunked(digest: str, project_name: str, normative_ctx: str) -> str:
    """Genera el plan oficial sección por sección para alcanzar ~9-10 páginas."""
    prior = ""
    sections_out: List[str] = []
    system_msg = (
        "Eres redactor técnico oficial del MEF para expedientes Invierte.pe. "
        "Redactas SOLO la sección solicitada, en español formal, sin saludos ni texto de chat. "
        "Usa ## para el título de sección y ### para subsecciones. Incluye viñetas, tablas en texto "
        "(filas con | cuando aplique) y cifras concretas tomadas del contexto del usuario. "
        f"Cada sección debe tener al menos {PDF_MIN_WORDS_PER_SECTION} palabras de contenido sustantivo."
    )

    for num, title, focus in PDF_SECTION_SPECS:
        chunk_prompt = (
            f"Genera ÚNICAMENTE la sección ## {num}. {title}\n\n"
            f"Enfoque obligatorio: {focus}\n\n"
            f"Proyecto: {project_name}\n\n"
            f"Contexto normativo (Pinecone):\n{normative_ctx[:4000]}\n\n"
            f"Material del usuario y auditoría:\n{digest[:14000]}\n\n"
        )
        if prior:
            chunk_prompt += (
                f"Secciones ya redactadas (no repetir, solo enlazar si es necesario):\n{prior[-3500:]}\n\n"
            )
        chunk_prompt += (
            "No escribas otras secciones. No uses 'Mi opinión' ni tono conversacional. "
            "Inventario de datos: si el contexto trae montos, plazos o ubigeo, deben aparecer aquí."
        )
        messages = [
            HumanMessage(content=system_msg),
            HumanMessage(content=chunk_prompt),
        ]
        section_text = invoke_llm(messages).content.strip()
        if not section_text.lower().startswith("##"):
            section_text = f"## {num}. {title}\n\n{section_text}"
        sections_out.append(section_text)
        prior += section_text + "\n\n"

    return "\n\n".join(sections_out)


def is_technical_code_or_error(text: str) -> bool:
    t = (text or "").lower()
    
    # 1. Firmas de errores de consola/programación o trazas de excepción
    error_signatures = [
        "traceback (most recent call last):",
        "unboundlocalerror:",
        "typeerror:",
        "valueerror:",
        "syntaxerror:",
        "not found (error code:",
        "xhrsendprocessor",
        "post http://localhost",
        "get http://localhost",
        "404 (not found)",
        "500 (internal server error)",
        "502 (bad gateway)",
        "at main.js",
        "@ main.js",
        "main.js?attr="
    ]
    if any(sig in t for sig in error_signatures):
        return True
        
    # 2. Bloques de código explícitos o palabras clave de programación pura
    programming_keywords = [
        "import react",
        "const [",
        "const {",
        "useState(",
        "useEffect(",
        "document.getelementbyid",
        "public class ",
        "def run_chat(",
        "def process_user_message(",
        "import sys",
        "import os",
        "npm install",
        "pip install",
        "app.post('/",
        "app.listen("
    ]
    if any(kw in t for kw in programming_keywords):
        return True
        
    # 3. Presencia de bloques de código markdown que parezcan código de programación
    if "```" in text:
        for block_lang in ["python", "javascript", "js", "typescript", "ts", "json", "html", "css", "cpp", "c#", "java", "sql"]:
            if f"```{block_lang}" in t:
                return True
                
    return False


def is_illicit_or_harmful(text: str) -> bool:
    t = (text or "").lower()
    
    # Palabras clave delictivas o ilícitas explícitas
    illicit_words = [
        "robar bancos", "robar un banco", "secuestrar", "asesinar", "matar a ", 
        "lavado de activos", "lavar dinero", "coima", "soborno", "evadir impuestos", 
        "defraudar al estado", "malversar", "desfalco", "hackear", "fabricar bombas", 
        "atentado terrorista", "delinquir", "cometer fraude", "tráfico de influencias",
        "cohecho", "colusión"
    ]
    
    return any(word in t for word in illicit_words)


def run_chat(
    message: str,
    history: Optional[List[Dict]] = None,
    user_id: str = "anonymous",
    canal: str = "web",
    usage_scope: Optional[str] = None,
    skip_usage: bool = False,
    locale: str = "es",
    session_mode: Optional[str] = None,
) -> Dict[str, Any]:
    history = history or []
    scope = usage_scope or user_id
    audit_session = is_audit_session_active(session_mode, history)

    if is_technical_code_or_error(message):
        return _chat_rejection_payload(
            scope,
            "technical",
            locale,
            audit_session=audit_session,
            session_mode=session_mode,
            skip_usage=skip_usage,
        )

    if is_illicit_or_harmful(message):
        return _chat_rejection_payload(
            scope,
            "illicit",
            locale,
            audit_session=audit_session,
            session_mode=session_mode,
            skip_usage=skip_usage,
        )
    if audit_session:
        sm = (session_mode or "audit").lower().strip()
        mode = "plan" if sm == "plan" else "audit"
        billable = True
    else:
        mode = detect_input_mode(message)
        billable = consumes_freemium_credit(message, mode=mode)
    if not skip_usage and billable:
        check_freemium(scope, "audit")

    docs = get_vectorstore().similarity_search(message, k=3)
    contexto = _cap_rag_context("\n\n".join([d.page_content for d in docs]))

    prefix_instructions = cedit_identity_instruction(history, message, locale)
    if (canal or "").lower() == "whatsapp":
        prefix_instructions += (
            "\nCANAL WHATSAPP: mensajes CORTOS (máx. 3 bloques ##). "
            "Sin listas numeradas largas. Sin '¿Te gustaría profundizar…?'. "
            "Prioriza guía fluida en móvil.\n"
        )
    if (canal or "").lower() == "telegram":
        prefix_instructions += (
            "\nCANAL TELEGRAM: mensajes CORTOS (máx. 3 bloques ##). "
            "Sin listas numeradas largas. Sin '¿Te gustaría profundizar…?'. "
            "Prioriza guía fluida en móvil, como WhatsApp.\n"
        )
    if (canal or "").lower() == "discord":
        prefix_instructions += (
            "\nCANAL DISCORD: una sola respuesta cohesiva. "
            "No repitas saludos, resúmenes del turno anterior ni la misma idea dos veces. "
            "Ve directo a validar, orientar o preguntar (máx. 1–2 preguntas).\n"
        )
    guide_state = None
    if mode in ("audit", "plan"):
        guide_state = assess_guide_state(message, history, has_pdf=False)
        prefix_instructions += "\n\n[FASE GRAFO — OBEDECE ESTAS RESTRICCIONES]\n" + guide_phase_instruction(
            guide_state, message, history
        )
        prefix_instructions += "\n" + format_guide_progress(guide_state) + "\n"
        if mode == "audit":
            prefix_instructions += "\n" + AUDIT_PDF_GATHERING_INSTRUCTION + "\n" + AUDIT_STRUCTURE_INSTRUCTION
        else:
            prefix_instructions += "\n" + AUDIT_STRUCTURE_INSTRUCTION

    formatted_input = (
        f"[INSTRUCCIONES OPERATIVAS — aplícalas a la respuesta que generes]\n"
        f"{prefix_instructions}\n"
        f"[FIN INSTRUCCIONES]\n\n"
        f"[MENSAJE DEL USUARIO]\n{message}\n[Canal: {canal}]"
    )

    history_limit = 12 if (canal or "").lower() == "discord" else 6
    messages = chat_prompt.format_messages(
        context=contexto,
        chat_history=_format_history(history, limit=history_limit),
        input=formatted_input,
    )
    respuesta = invoke_llm(messages)
    content = sanitize_mentor_response(respuesta.content or "")
    response_mode = detect_response_mode(content, is_audit=(mode == "audit"))
    if mode in ("audit", "plan"):
        response_mode = mode

    usage = get_usage(scope)
    if not skip_usage and billable:
        usage = increment_usage(scope, "audit")

    mef_score = None
    if (response_mode == "audit" or mode in ("audit", "plan")) and guide_state is not None:
        combined = _combined_audit_text(message + "\n" + content, history)
        if guide_state.phase.value >= CoachingPhase.RECOPILAR.value or len(combined) > 200:
            mef_score = score_document_against_mef(combined, "conversacion.txt", normative_ctx=contexto)

    result = {
        "response": content,
        "mode": response_mode,
        "input_mode": mode,
        "consumes_audit_credit": billable,
        "usage": usage,
        "show_pdf": should_offer_pdf(
            content,
            is_audit=(mode == "audit"),
            guide_state=guide_state,
            mef_score=mef_score,
        ),
        "mentor_activity": build_mentor_activity_message(message, history),
        "monitoring_figures": detect_public_figures(message, history),
    }
    if response_mode == "audit" or mode in ("audit", "plan"):
        if guide_state is None:
            guide_state = assess_guide_state(message, history, has_pdf=False)
        gaps = detect_project_data_gaps(content, history)
        if guide_state.phase.value < CoachingPhase.EVALUAR_RIESGO.value:
            content = append_followup_questions(content, gaps)
            content = sanitize_mentor_response(content)
        sections = parse_audit_sections(content)
        if not sections.get("opinion") and guide_state.phase.value < CoachingPhase.EVALUAR_RIESGO.value:
            sections["opinion"] = content
            sections["display"] = ""
        result["response"] = content
        result["opinion"] = sections.get("opinion", "")
        result["strengths"] = sections.get("strengths", "")
        result["dictamen"] = sections.get("dictamen", content)
        result["display"] = sections.get("display", content)
        result["data_gaps"] = gaps
        result["needs_more_info"] = bool(gaps)
        result["guide_phase"] = guide_state.phase_name
        result["guide_completeness"] = guide_state.completeness_pct
        result["guide_graph"] = build_graph_visualization(guide_state)
        result["guide_state"] = guide_state.to_dict()
        if mef_score:
            result["mef_score"] = mef_score
        result["show_pdf"] = should_offer_pdf(
            content,
            is_audit=True,
            guide_state=guide_state,
            mef_score=mef_score,
        )
    return result


def extract_pdf_text(content: bytes, max_chars: Optional[int] = None) -> str:
    text, _, _ = get_pdf_document_stats(content)
    if max_chars and len(text) > max_chars:
        return text[:max_chars]
    return text


def run_audit_pdf(
    pdf_bytes: bytes,
    filename: str,
    user_text: str = "",
    user_id: str = "anonymous",
    canal: str = "web",
    usage_scope: Optional[str] = None,
    skip_usage: bool = False,
    locale: str = "es",
    history: Optional[List[Dict]] = None,
) -> Dict[str, Any]:
    scope = usage_scope or user_id
    if not skip_usage:
        check_freemium(scope, "audit")

    text, page_count, char_count = get_pdf_document_stats(pdf_bytes)
    if len(text) > PDF_AUDIT_TEXT_LIMIT:
        text = text[:PDF_AUDIT_TEXT_LIMIT]

    rag_queries = [
        text[:1200],
        text[1200:2400] if len(text) > 1200 else "",
        user_text or "auditoría plan inversión pública MEF Invierte.pe",
    ]
    contexto = _cap_rag_context(_gather_normative_context([q for q in rag_queries if q], k=3))
    guide_state = assess_guide_state(text, history, has_pdf=True)

    user_note = f"\nComentario del usuario: {user_text}" if user_text.strip() else ""
    pregunta = (
        f"Realiza una auditoría guiada (mentor MEF) del siguiente expediente/plan de proyecto.\n\n"
        f"ARCHIVO: {filename}\n"
        f"PÁGINAS EXTRAÍDAS: texto completo hasta {len(text)} caracteres.\n\n"
        f"CONTENIDO DEL DOCUMENTO:\n{text[:PDF_CHAT_EXTRACT_LIMIT]}\n"
        f"{user_note}\n\n"
        f"{cedit_identity_instruction(history, user_text or filename, locale)}\n"
        f"[FASE GRAFO]\n{guide_phase_instruction(guide_state, user_text or text, history)}\n"
        f"{format_guide_progress(guide_state)}\n"
        f"{AUDIT_PDF_GATHERING_INSTRUCTION}\n"
        f"{AUDIT_STRUCTURE_INSTRUCTION}"
    )

    messages = chat_prompt.format_messages(
        context=contexto,
        chat_history=_format_history(history or [], limit=4),
        input=pregunta,
    )
    respuesta = invoke_llm(messages)
    content = respuesta.content
    gaps = detect_project_data_gaps(text, history)
    if guide_state.phase.value < CoachingPhase.EVALUAR_RIESGO.value:
        content = append_followup_questions(content, gaps)
    sections = parse_audit_sections(content)
    usage = get_usage(scope)
    if not skip_usage:
        usage = increment_usage(scope, "audit")

    combined_pdf = _combined_audit_text((user_text or "") + "\n" + text + "\n" + content, history)
    mef_score_pdf = score_document_against_mef(combined_pdf, filename, normative_ctx=contexto)
    if guide_state.phase.value >= CoachingPhase.EVALUAR_RIESGO.value:
        content += format_mef_score_markdown(mef_score_pdf)

    return {
        "response": content,
        "display": sections.get("display", content),
        "opinion": sections.get("opinion", ""),
        "strengths": sections.get("strengths", ""),
        "dictamen": sections.get("dictamen", content),
        "filename": filename,
        "mode": "audit",
        "input_mode": "audit",
        "consumes_audit_credit": True,
        "usage": usage,
        "show_pdf": should_offer_pdf(
            content,
            is_audit=True,
            guide_state=guide_state,
            mef_score=mef_score_pdf,
        ),
        "mentor_activity": build_mentor_activity_message(user_text or text, history),
        "monitoring_figures": detect_public_figures(user_text or text, history),
        "source_excerpt": text[:PDF_AUDIT_TEXT_LIMIT],
        "page_count": page_count,
        "char_count": char_count,
        "data_gaps": gaps,
        "needs_more_info": bool(gaps),
        "mef_score": mef_score_pdf,
        "guide_phase": guide_state.phase_name,
        "guide_completeness": guide_state.completeness_pct,
        "guide_graph": build_graph_visualization(guide_state),
        "guide_state": guide_state.to_dict(),
        "blockchain_payload": f"[REGISTRO BLOCKCHAIN] Auditoría: {filename} | user={user_id} | canal={canal}",
    }


def run_refine_plan(
    original_content: str,
    user_request: str,
    history: Optional[List[Dict]] = None,
    user_id: str = "anonymous",
    usage_scope: Optional[str] = None,
    skip_usage: bool = False,
) -> Dict[str, Any]:
    scope = usage_scope or user_id
    if not skip_usage:
        check_freemium(scope, "plan")
    refine_prompt = (
        f"Tienes este plan/documento previo:\n\n{original_content[:5000]}\n\n"
        f"El usuario pide: {user_request}\n\n"
        f"Reescribe el plan COMPLETO con los cambios solicitados. "
        f"Usa formato markdown con ## para secciones y viñetas. "
        f"Cumple normativa MEF e Invierte.pe.\n"
        f"{cedit_identity_instruction(history, user_request)}\n{AUDIT_STRUCTURE_INSTRUCTION}"
    )
    docs = get_vectorstore().similarity_search(user_request, k=3)
    contexto = "\n\n".join([d.page_content for d in docs])
    messages = prompt.format_messages(
        context=contexto,
        chat_history=_format_history(history or [], limit=4),
        input=refine_prompt,
    )
    respuesta = invoke_llm(messages)
    content = respuesta.content
    usage = get_usage(scope)
    if not skip_usage:
        usage = increment_usage(scope, "plan")
    sections = parse_audit_sections(content)
    return {
        "response": content,
        "display": sections.get("display", content),
        "mode": detect_response_mode(content),
        "input_mode": "plan",
        "consumes_audit_credit": True,
        "usage": usage,
        "show_pdf": should_offer_pdf(content),
    }


# --- PDF ---
class CEDITPdf(FPDF):
    def __init__(self, title, project_name):
        super().__init__()
        self.doc_title = title
        self.project_name = project_name
        self.set_margins(18, 22, 18)

    def header(self):
        if self.page_no() <= 2:
            return
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(173, 0, 23)
        self.cell(0, 5, "CEDIT - Plan Tecnico MEF / Invierte.pe", align="L")
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 5, self.project_name[:55] if self.project_name else "", align="R", new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(173, 0, 23)
        y = self.get_y()
        self.line(self.l_margin, y, self.w - self.r_margin, y)
        self.ln(5)

    def footer(self):
        if self.page_no() <= 1:
            return
        self.set_y(-18)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(128, 128, 128)
        fecha = datetime.datetime.now().strftime("%d/%m/%Y %H:%M")
        self.cell(0, 5, f"CEDIT | {fecha}", align="L")
        self.cell(0, 5, f"Pagina {self.page_no()}/{{nb}}", align="R", new_x="LMARGIN", new_y="NEXT")

    def add_title_page(self):
        self.add_page()
        self.set_fill_color(248, 248, 248)
        self.rect(0, 0, self.w, self.h, style="F")
        self.ln(35)
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(173, 0, 23)
        self.cell(0, 8, "CONSEJERO ESTATAL DIGITAL", align="C", new_x="LMARGIN", new_y="NEXT")
        self.ln(12)
        self.set_font("Helvetica", "B", 22)
        self.set_text_color(40, 40, 40)
        self.multi_cell(0, 11, self.doc_title, align="C")
        if self.project_name:
            self.ln(10)
            self.set_font("Helvetica", "", 14)
            self.set_text_color(80, 80, 80)
            self.multi_cell(0, 8, self.project_name, align="C")
        self.ln(20)
        self.set_font("Helvetica", "", 11)
        self.set_text_color(100, 100, 100)
        self.cell(0, 7, "Documento tecnico para formulacion y evaluacion", align="C", new_x="LMARGIN", new_y="NEXT")
        self.cell(0, 7, "Ministerio de Economia y Finanzas - Invierte.pe", align="C", new_x="LMARGIN", new_y="NEXT")
        self.ln(30)
        self.set_draw_color(173, 0, 23)
        self.set_line_width(0.8)
        cx = self.w / 2
        self.line(cx - 40, self.get_y(), cx + 40, self.get_y())

    def add_table_of_contents(self):
        self.add_page()
        self.set_font("Helvetica", "B", 16)
        self.set_text_color(173, 0, 23)
        self.cell(0, 10, "INDICE", new_x="LMARGIN", new_y="NEXT")
        self.ln(6)
        self.set_font("Helvetica", "", 11)
        self.set_text_color(50, 50, 50)
        for num, title, _ in PDF_SECTION_SPECS:
            self.cell(12, 7, f"{num}.")
            self.cell(0, 7, title, new_x="LMARGIN", new_y="NEXT")
        self.ln(4)
        self.set_font("Helvetica", "I", 9)
        self.set_text_color(120, 120, 120)
        self.multi_cell(0, 5, "Documento generado por IA con base en la auditoria y datos del usuario. Validar en entidad competente.")

    def add_content(self, text):
        self.add_page()
        self.set_auto_page_break(auto=True, margin=22)
        width = self.w - self.l_margin - self.r_margin
        last_was_h2 = False

        for line in text.split("\n"):
            stripped = line.strip()
            if not stripped:
                self.ln(2)
                continue

            clean = stripped.replace("**", "").replace("__", "")

            if stripped.startswith("### "):
                self.ln(2)
                self.set_font("Helvetica", "B", 12)
                self.set_text_color(90, 90, 90)
                self.multi_cell(width, 7, clean[4:])
            elif stripped.startswith("## "):
                if last_was_h2 and self.get_y() > 40:
                    self.add_page()
                last_was_h2 = True
                self.ln(3)
                self.set_fill_color(245, 240, 240)
                self.set_font("Helvetica", "B", 13)
                self.set_text_color(173, 0, 23)
                self.multi_cell(width, 9, clean[3:], fill=True)
                self.set_draw_color(173, 0, 23)
                self.line(self.l_margin, self.get_y() + 1, self.w - self.r_margin, self.get_y() + 1)
                self.ln(3)
            elif stripped.startswith("# "):
                self.ln(4)
                self.set_font("Helvetica", "B", 15)
                self.set_text_color(173, 0, 23)
                self.multi_cell(width, 9, clean[2:])
            elif "|" in stripped and stripped.count("|") >= 2:
                self.set_font("Helvetica", "", 9)
                self.set_text_color(40, 40, 40)
                cells = [c.strip() for c in stripped.split("|") if c.strip()]
                row = "  |  ".join(cells[:6])
                self.multi_cell(width, 5, row)
                self.ln(1)
            elif stripped.startswith(("- ", "* ", "• ", "\u2022 ")):
                self.set_font("Helvetica", "", 10)
                self.set_text_color(30, 30, 30)
                bullet = clean.lstrip("-*\u2022 ").strip()
                self.set_x(self.l_margin + 4)
                self.multi_cell(width - 4, 6, f"  - {bullet}")
                self.ln(1)
            else:
                last_was_h2 = False
                self.set_font("Helvetica", "", 10)
                self.set_text_color(30, 30, 30)
                self.multi_cell(width, 6, clean)
                self.ln(1)


def sanitize_for_pdf(text: str) -> str:
    if not text:
        return ""
    for k, v in {
        "“": '"', "”": '"', "‘": "'", "’": "'", "—": "-", "–": "-", "•": "-",
    }.items():
        text = text.replace(k, v)
    return text.encode("latin-1", "ignore").decode("latin-1")


def generate_plan_pdf(
    content: str,
    title: str = "Plan de Inversión Pública",
    project_name: str = "Proyecto CEDIT",
    modifications: Optional[str] = None,
    history: Optional[List[Dict]] = None,
    user_id: str = "anonymous",
    usage_scope: Optional[str] = None,
    skip_usage: bool = False,
    audit_opinion: str = "",
    audit_dictamen: str = "",
    source_document: str = "",
    pdf_output_language: str = "es",
) -> Tuple[bytes, str, str, Dict[str, Any]]:
    scope = usage_scope or user_id
    if not skip_usage:
        check_freemium(scope, "plan")

    if modifications:
        mod_prompt = (
            f"Plan previo:\n{content[:4000]}\n\nModificaciones: {modifications}\n\n"
            "Reescribe el documento completo con encabezados ## y viñetas."
        )
        ctx = _gather_normative_context([modifications], k=2)
        messages = prompt.format_messages(context=ctx, chat_history=[], input=mod_prompt)
        content = invoke_llm(messages).content

    digest = _build_conversation_digest(
        history,
        content,
        audit_opinion=audit_opinion,
        audit_dictamen=audit_dictamen,
        source_document=source_document,
    )
    normative_ctx = _gather_normative_context(
        [content[:1500], audit_dictamen[:800], source_document[:800], "MEF Invierte.pe plan inversión"],
        k=2,
    )
    lang = (pdf_output_language or "es").lower()[:2]
    if lang not in PDF_OUTPUT_LOCALE_NOTE:
        lang = "es"
    _log(f"[CEDIT] Generando PDF por secciones (10 bloques), idioma={lang}...")
    content = _generate_pdf_sections_chunked(
        digest,
        project_name=project_name or "Proyecto de Inversión Pública",
        normative_ctx=normative_ctx + "\n" + PDF_OUTPUT_LOCALE_NOTE[lang],
    )
    plan_score = score_document_against_mef(content[:6000], title, normative_ctx=normative_ctx)

    pdf = CEDITPdf(sanitize_for_pdf(title), sanitize_for_pdf(project_name))
    pdf.alias_nb_pages()
    pdf.add_title_page()
    pdf.add_table_of_contents()
    pdf.add_content(sanitize_for_pdf(content))
    pdf_output = pdf.output()
    if isinstance(pdf_output, str):
        pdf_output = pdf_output.encode("latin-1", errors="ignore")
    elif isinstance(pdf_output, bytearray):
        pdf_output = bytes(pdf_output)
    doc_hash = hashlib.sha256(pdf_output).hexdigest()
    filename = f"CEDIT_Plan_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    if not skip_usage:
        increment_usage(scope, "plan")
    return pdf_output, filename, f"0x{doc_hash[:40]}", plan_score
