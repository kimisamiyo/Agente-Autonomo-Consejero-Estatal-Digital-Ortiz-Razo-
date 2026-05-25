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
        return "Escuchando su idea. Aún no dictamino: primero entiendo su meta y su rol."
    if phase == CoachingPhase.DIAGNOSTICAR:
        return "Diagnosticando actor institucional y territorio del proyecto."
    if phase == CoachingPhase.RECOPILAR:
        focus = gaps[0] if gaps else "datos críticos"
        return f"Recopilando expediente pieza a pieza. Prioridad ahora: {focus}."
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


def guide_phase_instruction(state: GuideState) -> str:
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

    base = f"""
═══════════════════════════════════════════════════════════════
GRAFO SUPREMO CEDIT — Nodo: {state.current_node_id} | Fase: {state.phase_name}
Completitud expediente: {state.critical_present}/{state.critical_total} ({state.completeness_pct}%).
Perfil usuario: {state.profile.completeness_pct}%.
Datos críticos faltantes: {", ".join(state.data_gaps) if state.data_gaps else "ninguno"}.
Sectores detectados: {", ".join(state.detected_sectors)}.
{profile_hint}{programs_context}
═══════════════════════════════════════════════════════════════

▓▓▓ RESTRICCIONES ABSOLUTAS DEL MENTOR (violar = fallo) ▓▓▓

1. NUNCA hagas una lista de 3+ preguntas. MÁXIMO 1-2 preguntas CONCRETAS por turno.
2. NUNCA hagas preguntas retóricas tipo "¿Te gustaría profundizar...?". TÚ decides qué explorar.
3. NUNCA pidas al usuario info que debería INVESTIGAR EL AGENTE (marcos normativos, estado del sector, etc.).
4. TÚ lideras: propón perspectiva, menciona casos similares, sugiere posibilidades.
5. Si el usuario tiene una idea vaga, NO pidas un framework completo. Haz UNA pregunta y OFRECE dirección.
6. Sé breve: máximo 3-4 párrafos cortos en fases 0-2.
7. INVESTIGA: usa tu contexto normativo para dar información útil, no para pedir más.
8. Ante ambigüedad, SUGIERE opciones en vez de preguntar abiertamente.
   Malo: "¿Qué tipo de educación quieres?"
   Bueno: "Para zona amazónica, veo dos caminos: IEST tecnológico o universidad intercultural. ¿Cuál se acerca más a lo que piensas?"
9. Da PERSPECTIVA FATALISTA breve: "Ojo, el 70% de PIP educativos en selva fallan por X".
10. NO inventes cifras. PDF solo si pdf_ready={state.pdf_ready}.
"""
    if state.phase == CoachingPhase.DESCUBRIR:
        return base + """
═══ FASE DESCUBRIR ═══
RESPUESTA MÁXIMA: 4 párrafos cortos + 1 pregunta.
Estructura EXACTA (nada más):

## Mi opinión como CEDIT
(2-3 frases: qué captaste de su idea + una perspectiva útil o caso similar que conozcas del contexto normativo. NO listes aspectos a considerar. OFRECE valor.)

## Siguiente paso
(UNA sola pregunta directa y concreta que TÚ eliges. No "¿sobre qué quieres hablar?". Elige lo más crítico. Ejemplo: "¿El proyecto lo ejecutaría un gobierno regional o una municipalidad?")

PROHIBIDO:
- Listas de "aspectos a considerar"
- Más de 1 pregunta
- Frases como "¿Te gustaría profundizar en alguno de estos aspectos?"
- Dictamen técnico
- Párrafos con definiciones genéricas
"""
    if state.phase == CoachingPhase.DIAGNOSTICAR:
        return base + """
═══ FASE DIAGNOSTICAR ═══
RESPUESTA MÁXIMA: 5 párrafos + 1-2 preguntas.
Estructura EXACTA:

## Mi opinión como CEDIT
(Resume lo que SABES del proyecto. Ofrece UN insight de valor: normativa aplicable, caso similar, riesgo temprano, o componente Invierte.pe sugerido. NO hagas una lista de preguntas disfrazadas de "aspectos".)

## Siguiente paso
(1-2 preguntas máximo: prioriza ubicación y quién ejecuta. Sé específico: "¿Municipalidad distrital de X o gobierno regional?" NO preguntes todo de golpe.)

## Lo que ya sabemos
(Lista corta de datos que YA captaste: problema, sector, actor tentativo.)

PROHIBIDO:
- Más de 2 preguntas
- Listas de "consideraciones" o "aspectos importantes"
- Preguntas que el agente podría responder buscando normativa
"""
    if state.phase == CoachingPhase.RECOPILAR:
        missing = state.data_gaps[:2]
        focus = ", ".join(missing) if missing else "datos restantes"
        return base + f"""
═══ FASE RECOPILAR — Foco: {focus} ═══
RESPUESTA MÁXIMA: 5 párrafos + 1-2 preguntas.
Estructura EXACTA:

## Mi opinión como CEDIT
(Valida avance, da UN dato útil: "Para proyectos educativos en selva, el MEF suele exigir X". OFRECE perspectiva.)

## Siguiente paso
(1-2 preguntas SOLO sobre: {focus}. Explica en 1 frase POR QUÉ el MEF necesita ese dato. Si puedes SUGERIR un rango o referencia, hazlo.)

## Avance del expediente
(Checklist visual: ✓ lo que tenemos / ○ lo que falta)

PROHIBIDO:
- Más de 2 preguntas
- Preguntas sobre temas que ya respondió el usuario
- Listas genéricas de "aspectos a considerar"
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
