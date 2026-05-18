"""
Núcleo compartido CEDIT — misma lógica para Web (FastAPI), Discord y n8n.
"""
import os
import io
import json
import hashlib
import datetime
from typing import List, Dict, Optional, Tuple, Any

from dotenv import load_dotenv
from fpdf import FPDF
from pypdf import PdfReader

from langchain_groq import ChatGroq
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_pinecone import PineconeVectorStore
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage

load_dotenv()

FREE_LIMIT = int(os.getenv("CEDIT_FREE_LIMIT", "10"))
USAGE_FILE = os.path.join(os.path.dirname(__file__), ".cedit_usage.json")

# Palabras que activan modo auditoría / plan MEF
AUDIT_INPUT_KEYWORDS = [
    "plan de inversión", "plan de inversion", "expediente técnico", "expediente tecnico",
    "invierte.pe", "invierte pe", "perfil de inversión", "perfil de inversion",
    "formulación", "formulacion", "reestructuración", "reestructuracion",
    "auditar", "auditoría", "auditoria", "dictamen", "mef", "ficha técnica",
    "ficha tecnica", "componente", "snip", "viabilidad", "presupuesto multianual",
]

PLAN_RESPONSE_KEYWORDS = [
    "plan de", "expediente", "dictamen", "presupuesto", "invierte.pe",
    "viabilidad", "brechas", "reestructurac", "mef", "componente",
]

AUDIT_SECTION_MARKERS = {
    "opinion": ["## mi opinión", "## mi opinion", "## opinión del consejero", "## opinion del consejero"],
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


def detect_input_mode(message: str, has_pdf: bool = False) -> str:
    if has_pdf:
        return "audit"
    t = (message or "").lower()
    if any(k in t for k in AUDIT_INPUT_KEYWORDS):
        if any(x in t for x in ("auditar", "auditoría", "auditoria", "revisar expediente", "analiza el pdf", "analiza el archivo")):
            return "audit"
        return "plan"
    return "chat"


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


def should_offer_pdf(content: str, is_audit: bool = False) -> bool:
    mode = detect_response_mode(content, is_audit=is_audit)
    return mode in ("audit", "plan")


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


_log("[CEDIT] Cargando embeddings y Pinecone...")
embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-mpnet-base-v2")
vectorstore = PineconeVectorStore(index_name="agenteautonomo-ortiz", embedding=embeddings)

llm = ChatGroq(temperature=0.2, model_name="llama-3.3-70b-versatile")


def load_cognitive_architecture() -> str:
    mind_dir = os.path.join(os.path.dirname(__file__), "agent_mind")
    files = ["master.md", "soul.md", "instinct.md", "vision.md", "plan.md"]
    prompt_parts = []
    for f in files:
        path = os.path.join(mind_dir, f)
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as file:
                prompt_parts.append(file.read())
    base = "\n\n".join(prompt_parts)
    return base + "\n\nContexto normativo encontrado:\n{context}"


SYSTEM_PROMPT_TEXT = load_cognitive_architecture()

prompt = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_PROMPT_TEXT),
    MessagesPlaceholder(variable_name="chat_history"),
    ("human", "{input}"),
])

AUDIT_STRUCTURE_INSTRUCTION = """
IMPORTANTE — Estructura OBLIGATORIA para auditorías de planes/expedientes (responde en este orden exacto con estos encabezados markdown):

## Mi opinión como su consejero
(Empatía, tono cercano, guía clara sobre lo que leíste del documento del usuario. 2-3 párrafos cortos.)

## Puntos fuertes
(Viñetas con lo que está bien formulado en el plan presentado.)

## Dictamen técnico de auditoría
(Dictamen formal: viabilidad, brechas legales frente a normativa MEF/Invierte.pe, recomendaciones concretas. Usa viñetas y **negritas** en conceptos clave.)
"""


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


def run_chat(
    message: str,
    history: Optional[List[Dict]] = None,
    user_id: str = "anonymous",
    canal: str = "web",
    usage_scope: Optional[str] = None,
    skip_usage: bool = False,
) -> Dict[str, Any]:
    history = history or []
    scope = usage_scope or user_id
    mode = detect_input_mode(message)
    if not skip_usage and mode in ("audit", "plan"):
        check_freemium(scope, mode)

    docs = vectorstore.similarity_search(message, k=3)
    contexto = "\n\n".join([d.page_content for d in docs])

    extra = ""
    if mode in ("audit", "plan"):
        extra = "\n\n" + AUDIT_STRUCTURE_INSTRUCTION

    messages = prompt.format_messages(
        context=contexto,
        chat_history=_format_history(history),
        input=message + extra + f"\n\n[Canal: {canal}]",
    )
    respuesta = llm.invoke(messages)
    content = respuesta.content
    response_mode = detect_response_mode(content, is_audit=(mode == "audit"))

    usage = get_usage(scope)
    if not skip_usage and mode in ("audit", "plan"):
        usage = increment_usage(scope, mode)

    result = {
        "response": content,
        "mode": response_mode,
        "input_mode": mode,
        "usage": usage,
        "show_pdf": should_offer_pdf(content, is_audit=(mode == "audit")),
    }
    if response_mode == "audit" or mode == "audit":
        sections = parse_audit_sections(content)
        result["opinion"] = sections.get("opinion", "")
        result["strengths"] = sections.get("strengths", "")
        result["dictamen"] = sections.get("dictamen", content)
        result["display"] = sections.get("display", content)
    return result


def extract_pdf_text(content: bytes) -> str:
    reader = PdfReader(io.BytesIO(content))
    if reader.is_encrypted:
        try:
            reader.decrypt("")
        except Exception:
            raise ValueError("El PDF está protegido con contraseña. Suba una versión sin bloqueo.")

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
    return text


def run_audit_pdf(
    pdf_bytes: bytes,
    filename: str,
    user_text: str = "",
    user_id: str = "anonymous",
    canal: str = "web",
    usage_scope: Optional[str] = None,
    skip_usage: bool = False,
) -> Dict[str, Any]:
    scope = usage_scope or user_id
    if not skip_usage:
        check_freemium(scope, "audit")

    text = extract_pdf_text(pdf_bytes)

    docs = vectorstore.similarity_search(text[:1000], k=4)
    contexto = "\n\n".join([d.page_content for d in docs])

    user_note = f"\nComentario del usuario: {user_text}" if user_text.strip() else ""
    pregunta = (
        f"Realiza una auditoría completa del siguiente expediente/plan de proyecto.\n\n"
        f"CONTENIDO DEL DOCUMENTO ({filename}):\n{text[:6000]}\n"
        f"{user_note}\n\n"
        f"{AUDIT_STRUCTURE_INSTRUCTION}"
    )

    messages = prompt.format_messages(context=contexto, chat_history=[], input=pregunta)
    respuesta = llm.invoke(messages)
    content = respuesta.content
    sections = parse_audit_sections(content)
    usage = get_usage(scope)
    if not skip_usage:
        usage = increment_usage(scope, "audit")

    return {
        "response": content,
        "display": sections.get("display", content),
        "opinion": sections.get("opinion", ""),
        "strengths": sections.get("strengths", ""),
        "dictamen": sections.get("dictamen", content),
        "filename": filename,
        "mode": "audit",
        "usage": usage,
        "show_pdf": True,
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
        f"Cumple normativa MEF e Invierte.pe.\n{AUDIT_STRUCTURE_INSTRUCTION}"
    )
    docs = vectorstore.similarity_search(user_request, k=3)
    contexto = "\n\n".join([d.page_content for d in docs])
    messages = prompt.format_messages(
        context=contexto,
        chat_history=_format_history(history or [], limit=4),
        input=refine_prompt,
    )
    respuesta = llm.invoke(messages)
    content = respuesta.content
    usage = get_usage(scope)
    if not skip_usage:
        usage = increment_usage(scope, "plan")
    sections = parse_audit_sections(content)
    return {
        "response": content,
        "display": sections.get("display", content),
        "mode": detect_response_mode(content),
        "usage": usage,
        "show_pdf": should_offer_pdf(content),
    }


# --- PDF (mismo código que api.py) ---
class CEDITPdf(FPDF):
    def __init__(self, title, project_name):
        super().__init__()
        self.doc_title = title
        self.project_name = project_name

    def header(self):
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(173, 0, 23)
        self.cell(0, 6, "CONSEJERO ESTATAL DIGITAL (CEDIT)", align="L")
        self.cell(0, 6, "Documento Generado por IA", align="R", new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(173, 0, 23)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(4)

    def footer(self):
        self.set_y(-20)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(128, 128, 128)
        fecha = datetime.datetime.now().strftime("%d/%m/%Y %H:%M")
        self.cell(0, 5, f"CEDIT | Generado: {fecha}", align="L")
        self.cell(0, 5, f"Pagina {self.page_no()}/{{nb}}", align="R", new_x="LMARGIN", new_y="NEXT")

    def add_title_page(self):
        self.add_page()
        self.ln(40)
        self.set_font("Helvetica", "B", 28)
        self.set_text_color(173, 0, 23)
        self.cell(0, 15, self.doc_title, align="C", new_x="LMARGIN", new_y="NEXT")
        if self.project_name:
            self.ln(8)
            self.set_font("Helvetica", "", 16)
            self.set_text_color(74, 74, 74)
            self.cell(0, 10, self.project_name, align="C", new_x="LMARGIN", new_y="NEXT")

    def add_content(self, text):
        self.add_page()
        self.set_auto_page_break(auto=True, margin=20)
        width = self.w - self.l_margin - self.r_margin

        for line in text.split("\n"):
            stripped = line.strip()
            if not stripped:
                self.ln(3)
                continue

            clean = stripped.replace("**", "").replace("__", "")

            if stripped.startswith("### "):
                self.ln(3)
                self.set_font("Helvetica", "B", 12)
                self.set_text_color(100, 100, 100)
                self.multi_cell(width, 7, clean[4:])
            elif stripped.startswith("## "):
                self.ln(4)
                self.set_font("Helvetica", "B", 14)
                self.set_text_color(74, 74, 74)
                self.multi_cell(width, 8, clean[3:])
            elif stripped.startswith("# "):
                self.ln(5)
                self.set_font("Helvetica", "B", 16)
                self.set_text_color(173, 0, 23)
                self.multi_cell(width, 9, clean[2:])
            elif stripped.startswith(("- ", "* ", "• ", "\u2022 ")):
                self.set_font("Helvetica", "", 11)
                self.set_text_color(30, 30, 30)
                bullet = clean.lstrip("-*\u2022 ").strip()
                self.multi_cell(width, 6, f"- {bullet}")
                self.ln(1)
            else:
                self.set_font("Helvetica", "", 11)
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
) -> Tuple[bytes, str, str]:
    scope = usage_scope or user_id
    if not skip_usage:
        check_freemium(scope, "plan")

    if modifications:
        mod_prompt = (
            f"Plan previo:\n{content[:4000]}\n\nModificaciones: {modifications}\n\n"
            "Reescribe el documento completo con encabezados ## y viñetas."
        )
        docs = vectorstore.similarity_search(modifications, k=2)
        ctx = "\n\n".join([d.page_content for d in docs])
        messages = prompt.format_messages(context=ctx, chat_history=[], input=mod_prompt)
        content = llm.invoke(messages).content

    historial_contexto = ""
    if history:
        historial_contexto = "\n--- HISTORIAL ---\n"
        for h in history:
            role_name = "Usuario" if h.get("role") == "user" else "Asesor CEDIT"
            historial_contexto += f"{role_name}: {h.get('content', '')}\n"

    generating_prompt = (
        "Redacta un DOCUMENTO TÉCNICO OFICIAL MEF/Invierte.pe extenso y profesional.\n"
        "Secciones: ## 1. RESUMEN EJECUTIVO, ## 2. VIABILIDAD, ## 3. PRESUPUESTO Y CRONOGRAMA, "
        "## 4. MATRIZ DE RIESGOS, ## 5. CONCLUSIONES.\n"
        "Sin saludos ni texto conversacional. Incorpora todo el historial.\n\n"
        f"{historial_contexto}\nPropuesta base:\n{content}"
    )
    messages_clean = [
        HumanMessage(content="Eres redactor técnico oficial del MEF. Solo el plan, sin chat."),
        HumanMessage(content=generating_prompt),
    ]
    content = llm.invoke(messages_clean).content

    pdf = CEDITPdf(sanitize_for_pdf(title), sanitize_for_pdf(project_name))
    pdf.alias_nb_pages()
    pdf.add_title_page()
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
    return pdf_output, filename, f"0x{doc_hash[:40]}"
