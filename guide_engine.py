"""
Motor supremo de fases, perfiles de usuario y grafo de decisiones CEDIT.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import IntEnum
from typing import Any, Dict, List, Optional, Tuple

# --- Datos críticos MEF (7) ---
CRITICAL_DATA_LABELS = [
    "presupuesto total y desglose (soles, componentes)",
    "plazo de ejecución y cronograma",
    "ubicación (ubigeo, región, provincia, distrito)",
    "entidad ejecutora y unidad formuladora",
    "población beneficiaria e indicadores",
    "objetivos, productos y componente Invierte.pe",
    "código SNIP o CUI del proyecto",
]

CRITICAL_DATA_IDS = [
    "presupuesto",
    "cronograma",
    "ubicacion",
    "entidad",
    "beneficiarios",
    "objetivos",
    "snip_cui",
]

CRITICAL_PATTERNS: List[Tuple[str, List[str]]] = [
    (r"presupuesto|costo\s+total|monto|s/|soles|financiamiento", ["presupuesto", "costo", "monto", "soles", "s/"]),
    (r"cronograma|plazo|mes(es)?\s+de\s+ejecuci|duraci[oó]n", ["cronograma", "plazo", "meses", "duración"]),
    (r"ubigeo|ubicaci[oó]n|distrito|provincia|departamento", ["ubigeo", "ubicación", "distrito", "provincia"]),
    (r"entidad\s+ejecutora|formulador|gerencia|municipalidad|ministerio", ["entidad ejecutora", "formulador", "municipalidad"]),
    (r"beneficiar|indicador|poblaci[oó]n\s+meta|hogares", ["beneficiario", "indicador", "población"]),
    (r"objetivo|producto|componente|invierte", ["objetivo", "producto", "componente", "invierte"]),
    (r"snip|cui|\bcodigo\b", ["snip", "cui"]),
]

# --- Perfil de usuario (recopilación mentor) ---
USER_PROFILE_FIELDS: List[Dict[str, Any]] = [
    {
        "id": "rol",
        "label": "Rol institucional",
        "question": "¿Actúa como ciudadano, formulador, alcalde/regidor, ingeniero o asesor de inversión?",
        "pattern": r"ciudadano|formulador|alcalde|regidor|ingeniero|asesor|servidor|funcionario|municipal",
        "keywords": ["ciudadano", "formulador", "alcalde", "regidor", "ingeniero", "asesor"],
    },
    {
        "id": "experiencia_mef",
        "label": "Experiencia MEF/Invierte.pe",
        "question": "¿Es su primera vez formulando ante el MEF o ya ha presentado expedientes?",
        "pattern": r"primera\s+vez|sin\s+experiencia|novato|ya\s+present|experiencia|años?\s+formulando",
        "keywords": ["primera vez", "sin experiencia", "novato", "experiencia", "años"],
    },
    {
        "id": "tipo_entidad",
        "label": "Tipo de entidad",
        "question": "¿La ejecuta una municipalidad, gobierno regional, ministerio, ESSALUD, universidad u otra?",
        "pattern": r"municipalidad|gobierno\s+regional|gore|ministerio|essalud|universidad|ugel|pliego",
        "keywords": ["municipalidad", "gobierno regional", "gore", "ministerio", "essalud"],
    },
    {
        "id": "sector",
        "label": "Sector del proyecto",
        "question": "¿El proyecto es educación, salud, infraestructura vial, agua/saneamiento, productivo u otro?",
        "pattern": r"educaci[oó]n|salud|vial|carretera|agua|saneamiento|riego|productivo|seguridad|cultural",
        "keywords": ["educación", "salud", "vial", "agua", "saneamiento", "productivo"],
    },
    {
        "id": "region",
        "label": "Región / macrozona",
        "question": "¿En qué departamento o región se ejecutará?",
        "pattern": r"lima|cusco|arequipa|piura|loreto|puno|jun[ií]n|la\s+libertad|amazonas|ancash|departamento",
        "keywords": ["lima", "cusco", "arequipa", "piura", "loreto", "departamento"],
    },
    {
        "id": "urgencia",
        "label": "Urgencia / plazo político",
        "question": "¿Tiene fecha límite de convocatoria, entrega o cierre fiscal?",
        "pattern": r"urgente|plazo|convocatoria|cierre\s+fiscal|diciembre|enero|inmediato",
        "keywords": ["urgente", "plazo", "convocatoria", "cierre fiscal"],
    },
    {
        "id": "tamano_proyecto",
        "label": "Escala del proyecto",
        "question": "¿El monto referencial es menor a 500 mil, entre 500 mil y 5 millones, o mayor a 5 millones de soles?",
        "pattern": r"millones?|mil\s+soles|pequeño|mediano|gran\s+proyecto|macro",
        "keywords": ["millones", "mil soles", "macro", "mediano"],
    },
]

# --- Programas estatales impulsadores (nodos de canalización) ---
STATE_PROGRAMS: List[Dict[str, Any]] = [
    {
        "id": "prog_invierte",
        "label": "Invierte.pe (MEF)",
        "icon": "account_balance",
        "description": "Sistema Nacional de Inversión Pública — formulación y registro de PIP",
        "sector": ["educacion", "salud", "vial", "agua", "productivo", "general"],
        "entidad": ["municipalidad", "gore", "ministerio"],
        "monto_min": 0,
        "monto_max": 999_999_999,
        "url": "https://www.mef.gob.pe/es/invierte-pe",
        "hint": "Todo PIP debe estar registrado aquí. Requisito base para cualquier inversión pública.",
    },
    {
        "id": "prog_foniprel",
        "label": "FONIPREL",
        "icon": "emoji_events",
        "description": "Fondo concursable MEF — cofinancia hasta 99.9% PIP de GR/GL",
        "sector": ["educacion", "salud", "vial", "agua", "electrificacion"],
        "entidad": ["municipalidad", "gore"],
        "monto_min": 100_000,
        "monto_max": 50_000_000,
        "url": "https://www.mef.gob.pe/es/foniprel",
        "hint": "Ideal para municipalidades con bajo presupuesto. Cofinancia hasta 99.9%. Concursable por convocatoria.",
    },
    {
        "id": "prog_oxi",
        "label": "Obras por Impuestos (OxI)",
        "icon": "business",
        "description": "Empresas privadas financian obras con su impuesto a la renta vía ProInversión",
        "sector": ["educacion", "salud", "vial", "agua", "general"],
        "entidad": ["municipalidad", "gore", "ministerio"],
        "monto_min": 1_000_000,
        "monto_max": 500_000_000,
        "url": "https://www.investinperu.pe/",
        "hint": "Rápido si hay empresa privada interesada. S/3,276M adjudicados en 2026. 67% en transporte/educación/salud.",
    },
    {
        "id": "prog_procompite",
        "label": "PROCOMPITE",
        "icon": "storefront",
        "description": "Cofinanciamiento no reembolsable para planes de negocio (AEO)",
        "sector": ["productivo", "agrario"],
        "entidad": ["municipalidad", "gore"],
        "monto_min": 80_000,
        "monto_max": 1_000_000,
        "url": "https://procompite.produce.gob.pe/",
        "hint": "Para cadenas productivas. GR/GL destinan 5-15% de presupuesto. Requiere AEO constituido.",
    },
    {
        "id": "prog_proinnovate",
        "label": "ProInnóvate",
        "icon": "lightbulb",
        "description": "Financiamiento hasta S/500K para innovación empresarial (pymes)",
        "sector": ["productivo", "tecnologia"],
        "entidad": ["privada", "pyme"],
        "monto_min": 50_000,
        "monto_max": 500_000,
        "url": "https://inngenius.proinnovate.gob.pe/",
        "hint": "Para pymes innovadoras. Hasta 75% cofinanciamiento. Requiere RUC activo y ventas >S/772K.",
    },
    {
        "id": "prog_pronied",
        "label": "PRONIED (SIAT)",
        "icon": "school",
        "description": "Asesoría técnica para expedientes de infraestructura educativa",
        "sector": ["educacion"],
        "entidad": ["municipalidad", "gore"],
        "monto_min": 500_000,
        "monto_max": 100_000_000,
        "url": "https://www.gob.pe/pronied",
        "hint": "Obligatorio para infra educativa. SIAT da asesoría gratis en expedientes técnicos. Convocatoria anual.",
    },
    {
        "id": "prog_trabaja_peru",
        "label": "Llamkasun Perú (Trabaja Perú)",
        "icon": "engineering",
        "description": "Cofinancia proyectos intensivos en mano de obra no calificada",
        "sector": ["vial", "agua", "general"],
        "entidad": ["municipalidad"],
        "monto_min": 50_000,
        "monto_max": 5_000_000,
        "url": "http://www.trabajaperu.gob.pe/",
        "hint": "Genera empleo temporal + obra. Ideal para defensas ribereñas, vías rurales, saneamiento.",
    },
    {
        "id": "prog_agroideas",
        "label": "AGROIDEAS (MIDAGRI)",
        "icon": "agriculture",
        "description": "Cofinanciamiento para productores agrarios organizados",
        "sector": ["agrario", "productivo"],
        "entidad": ["asociacion", "cooperativa", "privada"],
        "monto_min": 30_000,
        "monto_max": 500_000,
        "url": "https://www.gob.pe/agroideas",
        "hint": "Para asociaciones de productores. Planes de negocio, reconversión productiva, mejora tecnológica.",
    },
    {
        "id": "prog_riego",
        "label": "Programa Nacional de Riego (PSI)",
        "icon": "water_drop",
        "description": "Riego tecnificado y expedientes técnicos de irrigación (MIDAGRI)",
        "sector": ["agrario", "agua"],
        "entidad": ["municipalidad", "gore", "asociacion"],
        "monto_min": 200_000,
        "monto_max": 20_000_000,
        "url": "https://www.gob.pe/psi",
        "hint": "S/69M en 2026 para riego tecnificado. Elaboran expedientes técnicos gratis si calificas.",
    },
    {
        "id": "prog_app",
        "label": "APP (Asociaciones Público-Privadas)",
        "icon": "handshake",
        "description": "ProInversión gestiona concesiones y APP de gran escala",
        "sector": ["vial", "salud", "educacion", "agua", "energia"],
        "entidad": ["gore", "ministerio"],
        "monto_min": 10_000_000,
        "monto_max": 999_999_999,
        "url": "https://www.investinperu.pe/",
        "hint": "Para megaproyectos (>S/10M). Concesión a largo plazo. Proceso complejo pero sostenible.",
    },
]

# Mapeo de keywords de sector detectadas → sector normalizado
_SECTOR_MAP = {
    "educacion": ["educaci", "colegio", "universidad", "escuela", "iest", "pedagog", "sunedu", "ugel"],
    "salud": ["salud", "hospital", "posta", "essalud", "centro de salud", "biomedic"],
    "vial": ["carretera", "trocha", "puente", "vial", "camino", "transporte"],
    "agua": ["agua", "saneamiento", "alcantarillado", "desague", "potable", "ptar"],
    "productivo": ["productivo", "cadena", "negocio", "emprendimiento", "pyme", "empresa"],
    "agrario": ["agr", "riego", "cultivo", "ganaderia", "pesca", "acuicola", "cacao", "cafe"],
    "electrificacion": ["electrific", "energia", "panel solar", "red electrica"],
    "tecnologia": ["innovaci", "tecnolog", "software", "digital", "tic"],
    "general": [],
}


# Entidades que el mentor puede "consultar" (mensaje de estado en UI)
MONITORING_ENTITIES: List[Tuple[str, str]] = [
    ("SUNEDU", r"sunedu|superintendencia.{0,20}educaci"),
    ("MEF", r"\bmef\b|ministerio de econom"),
    ("PRONIED", r"pronied|infraestructura educativa"),
    ("Invierte.pe", r"invierte\.pe|\bsnip\b|\bcui\b"),
    ("OSCE", r"\bosce\b|supervisi[oó]n de contrataciones"),
    ("FONIPREL", r"foniprel"),
    ("PROCOMPITE", r"procompite"),
    ("ProInversión", r"proinversi[oó]n|obras por impuestos|\boxi\b"),
    ("MIDAGRI", r"midagri|desarrollo agrario"),
    ("Contraloría", r"contralor[ií]a"),
]


def detect_monitoring_entities(
    text: str,
    history: Optional[List[Dict]] = None,
) -> List[str]:
    """Organismos citados en el hilo — para mensajes tipo 'buscando sobre SUNEDU'."""
    blob = _combined_text(text, history)
    found: List[str] = []
    for label, pattern in MONITORING_ENTITIES:
        if re.search(pattern, blob, re.I):
            found.append(label)
    return list(dict.fromkeys(found))


# Cargos / autoridades (Perú) — nombre propio opcional
_PUBLIC_FIGURE_PATTERNS: List[Tuple[str, str]] = [
    (
        "Gobernador regional",
        r"gobernador(?:a)?\s+regional\s+(?:de\s+)?([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+(?:de\s+)?[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,3})",
    ),
    (
        "Gobernador regional",
        r"gobernador(?:a)?\s+regional\b",
    ),
    (
        "Gobernador regional",
        r"gobernador(?:a)?\s+regional\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)",
    ),
    (
        "Alcalde provincial",
        r"alcalde(?:sa)?\s+provincial(?:\s+de\s+)?([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)",
    ),
    (
        "Alcalde distrital",
        r"alcalde(?:sa)?\s+distrital(?:\s+de\s+)?([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)",
    ),
    (
        "Alcalde",
        r"alcalde(?:sa)?\s+(?:de\s+)?([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)",
    ),
    (
        "Prefecto",
        r"prefecto(?:a)?\s+(?:de\s+)?([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,3})",
    ),
    (
        "Regidor",
        r"regidor(?:a)?\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,2})",
    ),
    (
        "Ministro",
        r"ministro(?:a)?\s+de\s+([\wáéíóúñ]{3,30})",
    ),
    (
        "Vicegobernador",
        r"vicegobernador(?:a)?\s+(?:de\s+)?([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,3})",
    ),
    (
        "Gerente regional",
        r"gerente\s+regional\s+(?:de\s+)?([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,2})",
    ),
    (
        "Servidor público",
        r"servidor(?:a)?\s+p[uú]blico(?:a)?\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,3})",
    ),
    (
        "Autoridad",
        r"(?:el|la)\s+(gobernador(?:a)?|alcalde(?:sa)?|prefecto(?:a)?)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,3})",
    ),
]


_NAME_STOP_WORDS = frozenset({
    "de", "la", "el", "los", "las", "del", "y", "en", "con", "para", "por",
    "regional", "provincial", "distrital", "apoya", "apoyo", "mencionado", "mencion",
    "proyecto", "dijo", "indico", "indicó", "solicito", "solicitó", "quiere",
    "necesita", "debe", "sera", "será", "este", "esta", "esta", "nuestro", "nuestra",
})


def _clean_figure_name(raw: str) -> str:
    """Recorta nombres que capturaron verbos o ruido del enunciado."""
    words = raw.split()
    kept: List[str] = []
    for w in words:
        if w.lower() in _NAME_STOP_WORDS:
            break
        if len(kept) >= 3:
            break
        kept.append(w)
    return " ".join(kept).title() if kept else ""


def detect_public_figures(
    text: str,
    history: Optional[List[Dict]] = None,
) -> List[Dict[str, str]]:
    """Autoridades o servidores mencionados — para riesgo institucional y mensaje de estado."""
    blob = _combined_text(text, history)
    figures: List[Dict[str, str]] = []
    seen: set = set()

    for role, pattern in _PUBLIC_FIGURE_PATTERNS:
        for m in re.finditer(pattern, blob, re.I):
            groups = [g.strip() for g in m.groups() if g and str(g).strip()]
            name = ""
            if role == "Autoridad" and len(groups) >= 2:
                role = groups[0].capitalize()
                name = _clean_figure_name(groups[1])
            elif groups:
                name = _clean_figure_name(groups[-1])
                if len(name) < 3:
                    name = ""
            label = f"{role} {name}".strip() if name else role
            key = label.lower()
            if key in seen:
                continue
            seen.add(key)
            figures.append({"role": role, "name": name, "label": label})

    figures.sort(key=lambda x: len(x["label"]), reverse=True)
    deduped: List[Dict[str, str]] = []
    for f in figures:
        low = f["label"].lower()
        if any(
            f["label"] != o["label"] and low in o["label"].lower()
            for o in deduped
        ):
            continue
        deduped.append(f)
    return deduped[:3]


def build_research_context_hint(
    text: str,
    history: Optional[List[Dict]] = None,
) -> str:
    """Instrucción LLM: investigar organismos/autoridades con obras, precedentes y preferencias."""
    entities = detect_monitoring_entities(text, history)
    figures = detect_public_figures(text, history)
    sectors = detect_sector(text, history)
    if not entities and not figures and sectors == ["general"]:
        blob = _combined_text(text, history)
        if not re.search(r"proyecto|obra|inversi|pip|mef|educaci|salud|vial", blob, re.I):
            return ""

    lines = [
        "\n▓ INVESTIGACIÓN OBLIGATORIA DEL MENTOR (usa contexto normativo + RAG; no pidas al usuario) ▓",
        "Antes de responder, contrasta en tu conocimiento y el contexto recuperado:",
        "- **Obras y PIP similares** en el mismo sector y zona (qué se aprobó, qué observaron, plazos y montos referenciales).",
        "- **Preferencias del organismo** (criterios, ventanillas, programas como FONIPREL/PRONIED/OxI si aplican).",
        "- **Precedentes que funcionaron y los que fracasaron** (causa probable) para orientar la mejor ruta.",
        "- **Recomendación concreta**: qué camino conviene más a ESTE caso (no un listado genérico).",
        "- **Impacto y escenarios**: qué podría lograr su idea si sale bien; qué podría pasar si no (realista, sin alarmismo ni promesas vacías).",
    ]
    if entities:
        lines.append(
            f"- Organismo(s) citado(s): **{', '.join(entities[:4])}**. "
            "Busca qué tipo de obras financia/supervisa, requisitos habituales y alertas típicas de observación."
        )
    if figures:
        labels = ", ".join(f["label"] for f in figures[:3])
        lines.append(
            f"- Autoridad(es): **{labels}**. "
            "Cartera y preferencias públicas de su gestión (obras priorizadas, alianzas GORE-Municipio), "
            "riesgos de gobernanza; sin difamar ni inventar escándalos."
        )
    if sectors and sectors[0] != "general":
        lines.append(
            f"- Sector **{sectors[0]}**: comparar con 1-2 casos reales o patrones MEF en esa línea (selva, costa, sierra)."
        )
    lines.append(
        "- Entrega al usuario la **mejor recomendación posible** con esa investigación; máximo 1 pregunta al final si falta un dato crítico."
    )
    return "\n".join(lines)


# Alias histórico
build_institutional_risk_hint = build_research_context_hint


def build_mentor_activity_message(
    text: str,
    history: Optional[List[Dict]] = None,
) -> str:
    entities = detect_monitoring_entities(text, history)
    figures = detect_public_figures(text, history)
    sectors = detect_sector(text, history)
    topics: List[str] = []

    if entities:
        topics.append(f"obras y criterios de **{entities[0]}**")
    if sectors and sectors[0] != "general":
        topics.append(f"proyectos **{sectors[0]}** similares")
    elif entities:
        topics.append("precedentes MEF en proyectos parecidos")
    if figures:
        topics.append(f"preferencias de **{figures[0]['label']}**")
    if not topics:
        return ""

    if len(topics) == 1:
        return f"Investigando {topics[0]} para recomendarle la mejor ruta…"
    if len(topics) == 2:
        return f"Investigando {topics[0]} y {topics[1]}…"
    return f"Investigando {topics[0]}, {topics[1]} y {topics[2]}…"


def detect_sector(text: str, history: Optional[List[Dict]] = None) -> List[str]:
    """Detecta sectores relevantes del proyecto a partir del texto."""
    blob = _combined_text(text, history)
    sectors = []
    for sector, keywords in _SECTOR_MAP.items():
        if any(k in blob for k in keywords):
            sectors.append(sector)
    return sectors if sectors else ["general"]


def recommend_programs(
    text: str,
    history: Optional[List[Dict]] = None,
    *,
    entidad: Optional[str] = None,
    monto: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """Recomienda programas estatales según sector, entidad y monto del proyecto."""
    sectors = detect_sector(text, history)
    blob = _combined_text(text, history)

    if not entidad:
        if "municipalidad" in blob or "municipal" in blob:
            entidad = "municipalidad"
        elif "gobierno regional" in blob or "gore" in blob:
            entidad = "gore"
        elif "ministerio" in blob:
            entidad = "ministerio"
        elif "pyme" in blob or "empresa" in blob or "privad" in blob:
            entidad = "privada"
        elif "asociacion" in blob or "cooperativa" in blob:
            entidad = "asociacion"

    recommendations = []
    for prog in STATE_PROGRAMS:
        sector_match = any(s in prog["sector"] for s in sectors) or "general" in prog["sector"]
        entidad_match = entidad is None or entidad in prog["entidad"]
        monto_match = monto is None or (prog["monto_min"] <= monto <= prog["monto_max"])

        if sector_match and entidad_match and monto_match:
            score = 0
            score += 2 if any(s in prog["sector"] for s in sectors) else 0
            score += 1 if entidad and entidad in prog["entidad"] else 0
            score += 1 if monto and prog["monto_min"] <= monto <= prog["monto_max"] else 0
            recommendations.append({**prog, "relevance_score": score})

    recommendations.sort(key=lambda x: x["relevance_score"], reverse=True)
    return recommendations[:4]


# --- Nodos del grafo (visualización + trazabilidad) ---
GRAPH_PHASES: List[Dict[str, Any]] = [
    {
        "id": "gate_legal",
        "phase": -1,
        "label": "Validación legal",
        "icon": "gavel",
        "description": "Proyecto legítimo y sin indicios de fraude",
    },
    {
        "id": "role_detect",
        "phase": -1,
        "label": "Detección de rol",
        "icon": "person_search",
        "description": "Ciudadano vs formulador de expediente",
    },
    {
        "id": "profile_collect",
        "phase": -1,
        "label": "Perfil del usuario",
        "icon": "badge",
        "description": "Rol, experiencia, sector, región, urgencia",
    },
    {
        "id": "f0_descubrir",
        "phase": 0,
        "label": "Descubrir",
        "icon": "explore",
        "description": "Intención y problema sin asumir conocimiento MEF",
    },
    {
        "id": "f1_diagnosticar",
        "phase": 1,
        "label": "Diagnosticar",
        "icon": "stethoscope",
        "description": "Actor institucional y ubicación aproximada",
    },
    {
        "id": "f2_recopilar",
        "phase": 2,
        "label": "Recopilar",
        "icon": "inventory_2",
        "description": "7 datos críticos del expediente, uno por turno",
    },
    {
        "id": "f3_riesgo",
        "phase": 3,
        "label": "Evaluar riesgo",
        "icon": "warning",
        "description": "Matriz fatalista y peores escenarios",
    },
    {
        "id": "f4_orientar",
        "phase": 4,
        "label": "Orientar",
        "icon": "route",
        "description": "Hoja de ruta priorizada hacia aprobación",
    },
    {
        "id": "f5_consolidar",
        "phase": 5,
        "label": "Consolidar",
        "icon": "task_alt",
        "description": "Listo para Plan Técnico Oficial PDF",
    },
    {
        "id": "pdf_generate",
        "phase": 6,
        "label": "PDF oficial",
        "icon": "picture_as_pdf",
        "description": "Expediente ~9-10 páginas MEF/Invierte.pe",
    },
    {
        "id": "mef_score",
        "phase": 6,
        "label": "Índices MEF",
        "icon": "analytics",
        "description": "Documento, plan PDF, riesgo",
    },
    {
        "id": "prog_canalizar",
        "phase": 4,
        "label": "Programas Impulsadores",
        "icon": "rocket_launch",
        "description": "FONIPREL, OxI, PROCOMPITE, ProInnóvate, PRONIED y más",
    },
]

DISCOVERY_KEYWORDS = re.compile(
    r"proyecto|plan|inversi[oó]n|obra|expediente|mef|invierte|auditor",
    re.I,
)


class CoachingPhase(IntEnum):
    DESCUBRIR = 0
    DIAGNOSTICAR = 1
    RECOPILAR = 2
    EVALUAR_RIESGO = 3
    ORIENTAR = 4
    CONSOLIDAR = 5


PHASE_NAMES = {
    CoachingPhase.DESCUBRIR: "DESCUBRIR",
    CoachingPhase.DIAGNOSTICAR: "DIAGNOSTICAR",
    CoachingPhase.RECOPILAR: "RECOPILAR",
    CoachingPhase.EVALUAR_RIESGO: "EVALUAR_RIESGO",
    CoachingPhase.ORIENTAR: "ORIENTAR",
    CoachingPhase.CONSOLIDAR: "CONSOLIDAR",
}

PHASE_NODE_ID = {
    CoachingPhase.DESCUBRIR: "f0_descubrir",
    CoachingPhase.DIAGNOSTICAR: "f1_diagnosticar",
    CoachingPhase.RECOPILAR: "f2_recopilar",
    CoachingPhase.EVALUAR_RIESGO: "f3_riesgo",
    CoachingPhase.ORIENTAR: "f4_orientar",
    CoachingPhase.CONSOLIDAR: "f5_consolidar",
}


@dataclass
class UserProfileState:
    fields: Dict[str, bool] = field(default_factory=dict)
    collected: List[str] = field(default_factory=list)
    missing: List[str] = field(default_factory=list)
    completeness_pct: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "fields": self.fields,
            "collected": self.collected,
            "missing": self.missing,
            "completeness_pct": self.completeness_pct,
            "items": [
                {
                    "id": f["id"],
                    "label": f["label"],
                    "collected": self.fields.get(f["id"], False),
                    "question": f["question"],
                }
                for f in USER_PROFILE_FIELDS
            ],
        }


@dataclass
class GuideState:
    phase: CoachingPhase
    phase_name: str
    completeness_pct: int
    critical_present: int
    critical_total: int
    data_gaps: List[str]
    critical_collected: List[str]
    critical_items: List[Dict[str, Any]]
    pdf_ready: bool
    is_sparse_input: bool
    risk_required: bool
    current_node_id: str
    profile: UserProfileState
    nodes_visited: List[str]
    nodes_active: List[str]
    mentor_message: str
    recommended_programs: List[Dict[str, Any]] = field(default_factory=list)
    detected_sectors: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "phase": self.phase.value,
            "phase_name": self.phase_name,
            "completeness_pct": self.completeness_pct,
            "critical_present": self.critical_present,
            "critical_total": self.critical_total,
            "data_gaps": self.data_gaps,
            "critical_collected": self.critical_collected,
            "critical_items": self.critical_items,
            "pdf_ready": self.pdf_ready,
            "is_sparse_input": self.is_sparse_input,
            "risk_required": self.risk_required,
            "current_node_id": self.current_node_id,
            "profile": self.profile.to_dict(),
            "nodes_visited": self.nodes_visited,
            "nodes_active": self.nodes_active,
            "mentor_message": self.mentor_message,
            "recommended_programs": self.recommended_programs,
            "detected_sectors": self.detected_sectors,
        }


def _combined_text(text: str, history: Optional[List[Dict]] = None) -> str:
    parts = [text or ""]
    for h in history or []:
        parts.append(h.get("content") or "")
    return " ".join(parts).lower()


def _word_count(text: str) -> int:
    return len(re.findall(r"\S+", text or ""))


def detect_critical_items(text: str, history: Optional[List[Dict]] = None) -> Tuple[List[str], List[str], List[Dict[str, Any]]]:
    blob = _combined_text(text, history)
    collected, gaps, items = [], [], []
    for cid, label, (pattern, keywords) in zip(
        CRITICAL_DATA_IDS, CRITICAL_DATA_LABELS, CRITICAL_PATTERNS
    ):
        ok = bool(re.search(pattern, blob, re.I)) or any(k in blob for k in keywords)
        items.append({"id": cid, "label": label, "collected": ok})
        if ok:
            collected.append(label)
        else:
            gaps.append(label)
    return collected, gaps, items


def detect_data_gaps(text: str, history: Optional[List[Dict]] = None) -> List[str]:
    _, gaps, _ = detect_critical_items(text, history)
    return gaps


def assess_user_profile(text: str, history: Optional[List[Dict]] = None) -> UserProfileState:
    blob = _combined_text(text, history)
    fields: Dict[str, bool] = {}
    collected, missing = [], []
    for spec in USER_PROFILE_FIELDS:
        ok = bool(re.search(spec["pattern"], blob, re.I)) or any(
            k in blob for k in spec["keywords"]
        )
        fields[spec["id"]] = ok
        if ok:
            collected.append(spec["label"])
        else:
            missing.append(spec["label"])
    total = len(USER_PROFILE_FIELDS)
    pct = int(round(100 * len(collected) / total)) if total else 0
    return UserProfileState(
        fields=fields,
        collected=collected,
        missing=missing[:3],
        completeness_pct=pct,
    )


def _has_problem_signal(blob: str) -> bool:
    return bool(
        re.search(
            r"problema|necesidad|carencia|deficiencia|brecha|mejorar|construir|implementar",
            blob,
            re.I,
        )
    )


def _has_entity_signal(blob: str) -> bool:
    return bool(
        re.search(
            r"municipalidad|gobierno|regional|ministerio|entidad|formulador|ugel|essalud|mef",
            blob,
            re.I,
        )
    )


def _has_location_signal(blob: str) -> bool:
    return bool(
        re.search(
            r"ubigeo|distrito|provincia|departamento|lima|cusco|arequipa|piura|loreto|puno",
            blob,
            re.I,
        )
    )


def _build_nodes_visited(phase: CoachingPhase, profile: UserProfileState, has_pdf: bool) -> List[str]:
    visited = ["gate_legal", "role_detect"]
    if profile.completeness_pct > 0:
        visited.append("profile_collect")
    if profile.completeness_pct >= 40:
        visited.append("profile_collect")
    phase_ids = [
        "f0_descubrir",
        "f1_diagnosticar",
        "f2_recopilar",
        "f3_riesgo",
        "f4_orientar",
        "f5_consolidar",
    ]
    for i, nid in enumerate(phase_ids):
        if i <= phase.value:
            visited.append(nid)
    if has_pdf and phase.value >= 1:
        if "f1_diagnosticar" not in visited:
            visited.append("f1_diagnosticar")
    return list(dict.fromkeys(visited))


def _mentor_message_for_phase(
    phase: CoachingPhase,
    profile: UserProfileState,
    gaps: List[str],
    pdf_ready: bool,
) -> str:
    if pdf_ready:
        return "Mentor supremo: expediente listo para consolidar en PDF oficial MEF."
    if phase == CoachingPhase.DESCUBRIR:
        return "Acompañando su idea: le mostraré cómo puede tomar forma y qué conviene explorar."
    if phase == CoachingPhase.DIAGNOSTICAR:
        return "Afinando su proyecto: recomendaciones e impacto antes de la siguiente pregunta."
    if phase == CoachingPhase.RECOPILAR:
        focus = gaps[0] if gaps else "datos críticos"
        return f"Su expediente madura ({focus}): recomendaciones primero, luego una pregunta concreta."
    if phase == CoachingPhase.EVALUAR_RIESGO:
        return "Analizando riesgos y peores escenarios (enfoque fatalista responsable)."
    if phase == CoachingPhase.ORIENTAR:
        return "Orientando hoja de ruta hacia mayor probabilidad de aprobación MEF."
    if profile.missing:
        return f"Completando perfil ({profile.completeness_pct}%): falta {profile.missing[0]}."
    return "Liderando su proceso de inversión pública paso a paso."


def assess_guide_state(
    text: str,
    history: Optional[List[Dict]] = None,
    *,
    has_pdf: bool = False,
) -> GuideState:
    blob = _combined_text(text, history)
    collected, gaps, critical_items = detect_critical_items(text, history)
    present = len(collected)
    total = len(CRITICAL_DATA_LABELS)
    completeness = int(round(100 * present / total)) if total else 0
    profile = assess_user_profile(text, history)

    user_parts = [h.get("content", "") for h in (history or []) if h.get("role") == "user"]
    user_parts.append(text or "")
    user_only = " ".join(user_parts)
    sparse = _word_count(user_only) <= 30 and not has_pdf

    if sparse and not DISCOVERY_KEYWORDS.search(blob):
        phase = CoachingPhase.DESCUBRIR
    elif sparse:
        phase = CoachingPhase.DESCUBRIR
    elif not (_has_problem_signal(blob) and _has_entity_signal(blob)):
        phase = CoachingPhase.DIAGNOSTICAR
    elif present < 5:
        phase = CoachingPhase.RECOPILAR
    elif present >= 5 and completeness < 70:
        phase = CoachingPhase.EVALUAR_RIESGO
    elif completeness >= 70:
        phase = CoachingPhase.CONSOLIDAR
    else:
        phase = CoachingPhase.ORIENTAR

    pdf_ready = (
        completeness >= 70
        and present >= 5
        and phase.value >= CoachingPhase.EVALUAR_RIESGO.value
    )

    current_node_id = PHASE_NODE_ID[phase]
    nodes_visited = _build_nodes_visited(phase, profile, has_pdf)
    nodes_active = [current_node_id]
    if phase == CoachingPhase.RECOPILAR:
        for item in critical_items:
            if not item["collected"]:
                nodes_active.append(f"data_{item['id']}")
                break

    sectors = detect_sector(text, history)
    programs = recommend_programs(text, history) if phase.value >= CoachingPhase.DIAGNOSTICAR.value else []

    if phase.value >= CoachingPhase.ORIENTAR.value and programs:
        nodes_active.append("prog_canalizar")
        if "prog_canalizar" not in nodes_visited:
            nodes_visited.append("prog_canalizar")

    return GuideState(
        phase=phase,
        phase_name=PHASE_NAMES[phase],
        completeness_pct=completeness,
        critical_present=present,
        critical_total=total,
        data_gaps=gaps[:4],
        critical_collected=collected,
        critical_items=critical_items,
        pdf_ready=pdf_ready,
        is_sparse_input=sparse,
        risk_required=phase.value >= CoachingPhase.EVALUAR_RIESGO.value,
        current_node_id=current_node_id,
        profile=profile,
        nodes_visited=nodes_visited,
        nodes_active=nodes_active,
        mentor_message=_mentor_message_for_phase(phase, profile, gaps, pdf_ready),
        recommended_programs=programs,
        detected_sectors=sectors,
    )


def build_graph_visualization(state: GuideState) -> Dict[str, Any]:
    """Payload para UI: recorrido del grafo y sub-nodos de datos/perfil."""
    nodes = []
    for gn in GRAPH_PHASES:
        status = "pending"
        if gn["id"] in state.nodes_visited and gn["id"] != state.current_node_id:
            status = "completed"
        if gn["id"] == state.current_node_id:
            status = "current"
        if gn["id"] in state.nodes_active and gn["id"] != state.current_node_id:
            status = "active"
        nodes.append({**gn, "status": status})

    prog_nodes = []
    for prog in state.recommended_programs:
        prog_nodes.append({
            "id": prog["id"],
            "label": prog["label"],
            "icon": prog["icon"],
            "description": prog["description"],
            "hint": prog["hint"],
            "url": prog.get("url", ""),
            "relevance_score": prog.get("relevance_score", 0),
            "status": "active" if "prog_canalizar" in state.nodes_active else "pending",
        })

    return {
        "version": "3.0-programs",
        "current_node_id": state.current_node_id,
        "phase": state.phase.value,
        "phase_name": state.phase_name,
        "completeness_pct": state.completeness_pct,
        "profile_completeness_pct": state.profile.completeness_pct,
        "pdf_ready": state.pdf_ready,
        "mentor_message": state.mentor_message,
        "nodes": nodes,
        "critical_items": state.critical_items,
        "profile": state.profile.to_dict(),
        "trail": state.nodes_visited,
        "edges": _build_edges(state),
        "recommended_programs": prog_nodes,
        "detected_sectors": state.detected_sectors,
    }


def _build_edges(state: GuideState) -> List[Dict[str, str]]:
    """Aristas del recorrido para diagramas."""
    trail = state.nodes_visited
    edges = []
    for i in range(len(trail) - 1):
        edges.append({"from": trail[i], "to": trail[i + 1], "kind": "visited"})
    if state.current_node_id and trail and trail[-1] != state.current_node_id:
        edges.append({"from": trail[-1], "to": state.current_node_id, "kind": "current"})
    return edges


def risk_level_from_index(risk_index: int) -> str:
    if risk_index >= 70:
        return "CRÍTICO"
    if risk_index >= 46:
        return "ALTO"
    if risk_index >= 26:
        return "MEDIO"
    return "BAJO"


def guide_phase_instruction(
    state: GuideState,
    text: str = "",
    history: Optional[List[Dict]] = None,
) -> str:
    profile_hint = ""
    if state.profile.missing:
        profile_hint = (
            f"\nPERFIL USUARIO — completitud {state.profile.completeness_pct}%. "
            f"Falta conocer: {', '.join(state.profile.missing[:2])}. "
            f"Pregunta naturalmente si encaja en el turno (máx. 1 pregunta de perfil)."
        )

    programs_context = ""
    if state.recommended_programs and state.phase.value >= CoachingPhase.DIAGNOSTICAR.value:
        top_progs = state.recommended_programs[:3]
        prog_lines = [f"  • {p['label']}: {p['hint']}" for p in top_progs]
        programs_context = (
            f"\nPROGRAMAS ESTATALES DETECTADOS (usa como perspectiva/dirección):\n"
            + "\n".join(prog_lines)
        )

    institutional_context = build_research_context_hint(text, history)

    base = f"""
═══════════════════════════════════════════════════════════════
GRAFO SUPREMO CEDIT — Nodo: {state.current_node_id} | Fase: {state.phase_name}
Completitud expediente: {state.critical_present}/{state.critical_total} ({state.completeness_pct}%).
Perfil usuario: {state.profile.completeness_pct}%.
Datos críticos faltantes: {", ".join(state.data_gaps) if state.data_gaps else "ninguno"}.
Sectores detectados: {", ".join(state.detected_sectors)}.
{profile_hint}{programs_context}{institutional_context}
═══════════════════════════════════════════════════════════════

▓▓▓ VOZ DE GUÍA TRANSPARENTE (orden sagrado del mensaje) ▓▓▓

SIEMPRE en este orden en ## Mi opinión… y secciones siguientes (las PREGUNTAS van AL FINAL):
1) **Validar** lo que dijo (1 frase cálida, sin halago vacío).
2) **Cómo va tomando forma su idea** — narrar la transformación: "Usted planteó X; con lo que sumó, esto ya parece un PIP de…; aún falta…".
3) **Recomendaciones** — 2-3 viñetas accionables (programas, ruta MEF, aliado institucional) ANTES de preguntar.
4) **Qué podría lograr / qué podría pasar** — impacto positivo realista + 1-2 escenarios adversos plausibles (apegado a precedentes, sin inventar cifras).
5) **Siguiente paso** — solo entonces 1-2 preguntas sencillas que el usuario SÍ pueda responder.

TONO: lindo, directo, honesto. El usuario quiere saber **cómo puede impactar** y **qué riesgos hay**; no un cuestionario.

▓▓▓ RESTRICCIONES (violar = fallo) ▓▓▓
1. MÁXIMO 1-2 preguntas por turno, siempre en ## Siguiente paso (al final).
2. NO empieces con preguntas ni con listas de "aspectos a considerar".
3. NO pidas al usuario lo que TÚ investigas (normativa, precedentes, criterios del organismo).
4. Ante ambigüedad, SUGIERE opciones: "Veo camino A o B; ¿cuál se acerca más?"
5. Sé breve en fases 0-2: reparte en secciones cortas (no un muro de texto).
6. NO inventes cifras ni porcentajes sin base. PDF solo si pdf_ready={state.pdf_ready}.
7. PROHIBIDO manual numerado (1. Marco normativo 2. Requisitos…) o título tipo "Creación de Instituto de…".
8. PROHIBIDO "¿Te gustaría profundizar…?" — las preguntas van solo en ## Siguiente paso, al final.
"""
    if state.phase == CoachingPhase.DESCUBRIR:
        return base + """
═══ FASE DESCUBRIR ═══
Estructura EXACTA (en el chat; respeta el orden):

## Mi opinión como CEDIT
(1-2 frases cálidas: qué entendiste de su sueño o problema.)

## Cómo va tomando forma su idea
(2 frases: de idea vaga → hacia qué tipo de proyecto público va; qué pieza falta para afinar.)

## Recomendaciones
(2 viñetas concretas: ruta, programa estatal o referencia de obra similar investigada.)

## Qué podría lograr y qué podría pasar
(1 frase de impacto positivo realista + 1 escenario de riesgo honesto, sin dramatizar.)

## Siguiente paso
(UNA pregunta al final. Ej.: "¿Lo lideraría una municipalidad o un gobierno regional?")

PROHIBIDO: preguntas antes de recomendar; dictamen formal; más de 1 pregunta.
"""
    if state.phase == CoachingPhase.DIAGNOSTICAR:
        return base + """
═══ FASE DIAGNOSTICAR ═══
Estructura EXACTA:

## Mi opinión como CEDIT
(Reconoce avance y emoción detrás del proyecto — 1-2 frases.)

## Cómo va tomando forma su idea
(Narrativa clara: problema → solución tentativa → encaje MEF/sector; qué maduró desde el turno anterior.)

## Recomendaciones
(2-3 viñetas: normativa o ventanilla clave, programa impulsador si aplica, ajuste de enfoque sugerido.)

## Qué podría lograr y qué podría pasar
(Impacto en beneficiarios/territorio + escenario favorable y uno adverso plausible, con transparencia.)

## Siguiente paso
(1-2 preguntas al final: ubicación y/o ejecutor, lenguaje sencillo.)

## Lo que ya sabemos
(Checklist breve ✓ — no repetir en párrafos anteriores.)

PROHIBIDO: preguntas antes de recomendaciones; listas genéricas de "aspectos".
"""
    if state.phase == CoachingPhase.RECOPILAR:
        missing = state.data_gaps[:2]
        focus = ", ".join(missing) if missing else "datos restantes"
        return base + f"""
═══ FASE RECOPILAR — Foco próximo dato: {focus} ═══
Estructura EXACTA:

## Mi opinión como CEDIT
(Celebra un dato bien aportado; 1 frase de confianza en el proceso.)

## Cómo va tomando forma su idea
("Su expediente pasó de …% a …% de claridad; ahora el MEF vería esto como…; falta cerrar: {focus}.")

## Recomendaciones
(2-3 viñetas priorizadas: qué reforzar YA, programa o cofinanciamiento, buena práctica de un caso similar.)

## Qué podría lograr y qué podría pasar
(Impacto si logra viabilidad + qué podría frenarlo si no completa {focus} — realista, sin inventar números.)

## Siguiente paso
(1-2 preguntas SOLO sobre {focus}, al final, lenguaje cotidiano y por qué ayuda en 1 frase.)

## Avance del expediente
(✓ / ○ checklist — no duplicar en secciones anteriores.)

PROHIBIDO: preguntas antes de recomendaciones; SNIP/CUI/códigos técnicos; repetir lo ya respondido.
"""
    if state.phase == CoachingPhase.EVALUAR_RIESGO:
        return base + """
═══ FASE EVALUAR_RIESGO ═══
Aquí sí se permite extensión. Estructura:

## Mi opinión como CEDIT
## Puntos fuertes
## Dictamen técnico de auditoría
## Escenario pessimista y riesgo
(Mínimo 5 riesgos en matriz, 1 peor escenario narrativo, probabilidad de rechazo)
## Para alimentar su plan técnico (PDF) — solo si faltan datos
Sé fatalista responsable: nombra qué puede salir MAL con datos concretos.
"""
    if state.phase == CoachingPhase.ORIENTAR:
        prog_hint = ""
        if state.recommended_programs:
            prog_names = [p["label"] for p in state.recommended_programs[:3]]
            prog_hint = f"\n\n## Programas impulsadores recomendados\nMenciona estos programas como VÍAS DE FINANCIAMIENTO/APOYO concretas: {', '.join(prog_names)}.\nPara cada uno, explica en 1 frase por qué aplica y qué beneficio da (cofinanciamiento, asesoría, etc.)."
        return base + f"""
═══ FASE ORIENTAR ═══
## Mi opinión como CEDIT
## Puntos fuertes
## Dictamen técnico de auditoría
## Escenario pessimista y riesgo
## Hoja de ruta (prioridades top 3)
{prog_hint}
Da acciones concretas, no preguntas. El usuario ya dio los datos.
Incluye los PROGRAMAS ESTATALES como vías de financiamiento/apoyo.
"""
    prog_hint_cons = ""
    if state.recommended_programs:
        prog_names = [p["label"] for p in state.recommended_programs[:3]]
        prog_hint_cons = f"\nProgramas estatales aplicables: {', '.join(prog_names)}. Menciónalos en el resumen final."
    return base + f"""
═══ FASE CONSOLIDAR ═══
## Mi opinión como CEDIT | ## Puntos fuertes | ## Dictamen | ## Escenario pessimista y riesgo
## Programas impulsadores{prog_hint_cons}
## Listo para su Plan Técnico Oficial
Invita a generar PDF. Resume qué incluirá. Menciona programas estatales que pueden impulsar el proyecto.
"""


def format_guide_progress(state: GuideState) -> str:
    bar_filled = state.critical_present
    bar_empty = state.critical_total - bar_filled
    bar = "█" * bar_filled + "░" * bar_empty
    prof = state.profile.completeness_pct
    return (
        f"**{state.phase_name}** · Expediente `{bar}` {state.critical_present}/{state.critical_total} "
        f"({state.completeness_pct}%) · Perfil {prof}% · Nodo `{state.current_node_id}`"
    )
