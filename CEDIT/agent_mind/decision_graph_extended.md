# GRAFO DE DECISIONES EXTENDED — Arquitectura Suprema CEDIT

> Versión maestra multi-nodo, multi-perfil, multi-sector.  
> Resumen: `decision_graph.md` · Motor: `guide_engine.py` · Visualización UI: `GuideGraphTrail.jsx`

---

## 1. Arquitectura de capas

```mermaid
flowchart TB
    subgraph CAPA0["Capa 0 — Seguridad y rol"]
        L0A[gate_legal]
        L0B[role_detect]
        L0C[profile_collect]
    end
    subgraph CAPA1["Capa 1 — Coaching"]
        L1A[f0_descubrir]
        L1B[f1_diagnosticar]
        L1C[f2_recopilar]
    end
    subgraph CAPA2["Capa 2 — Evaluación"]
        L2A[f3_riesgo]
        L2B[f4_orientar]
    end
    subgraph CAPA3["Capa 3 — Entrega"]
        L3A[f5_consolidar]
        L3B[pdf_generate]
        L3C[mef_score]
    end
    L0A --> L0B --> L0C --> L1A --> L1B --> L1C --> L2A --> L2B --> L3A --> L3B --> L3C
```

| Capa | Nodos | Función |
|------|-------|---------|
| 0 | legal, rol, perfil | Elegibilidad y contexto humano |
| 1 | F0-F2 | Recopilación sin sobreproducción |
| 2 | F3-F4 | Riesgo fatalista + ruta de mejora |
| 3 | F5-PDF-score | Consolidación y métricas |

---

## 2. Grafo maestro expandido

```mermaid
flowchart TB
    START([Entrada]) --> LEGAL{¿Legal?}
    LEGAL -->|No| REJ[Rechazo + redirección CEDIT]
    LEGAL -->|Sí| ROLE{¿Expediente propio?}
    ROLE -->|No| NORM[Consulta normativa]
    ROLE -->|Sí| PROF[Perfil usuario 7 campos]
    PROF --> F0[F0 DESCUBRIR]
    F0 --> F1[F1 DIAGNOSTICAR]
    F1 --> F2[F2 RECOPILAR]
    F2 --> SUB2{Sub-nodos datos}
    SUB2 --> D1[data_presupuesto]
    SUB2 --> D2[data_cronograma]
    SUB2 --> D3[data_ubicacion]
    SUB2 --> D4[data_entidad]
    SUB2 --> D5[data_beneficiarios]
    SUB2 --> D6[data_objetivos]
    SUB2 --> D7[data_snip_cui]
    D1 & D2 & D3 & D4 & D5 & D6 & D7 --> GATE2{≥5/7?}
    GATE2 -->|No| F2
    GATE2 -->|Sí| F3[F3 EVALUAR_RIESGO]
    F3 --> SEC{Subgrafo sector}
    SEC --> RMAT[Matriz 7 dimensiones]
    RMAT --> FATAL{Índice riesgo}
    FATAL -->|CRÍTICO| ALERTA[Alerta + reformulación]
    FATAL -->|ALTO/MEDIO| WARN[Mitigación]
    FATAL -->|BAJO| F4[F4 ORIENTAR]
    ALERTA --> F4
    WARN --> F4
    F4 --> CMP{≥70% completitud?}
    CMP -->|No| F2
    CMP -->|Sí| F5[F5 CONSOLIDAR]
    F5 --> PDF[PDF oficial 10 secciones]
    PDF --> SCORE[mef_score triple]
    SCORE --> OK{≥80%?}
    OK -->|Sí| EXP[Mis expedientes]
    OK -->|No| F4
```

---

## 3. Nodo L0C — Perfil de usuario (detalle)

```mermaid
flowchart LR
    P0[profile_rol] --> P1[profile_experiencia]
    P1 --> P2[profile_tipo_entidad]
    P2 --> P3[profile_sector]
    P3 --> P4[profile_region]
    P4 --> P5[profile_urgencia]
    P5 --> P6[profile_tamano]
```

| ID perfil | Si falta, preguntar cuando |
|-----------|----------------------------|
| rol | F0 o F1 |
| experiencia_mef | F0 |
| tipo_entidad | F1 |
| sector | F1 (define subgrafo) |
| region | F1 |
| urgencia | F2 |
| tamano_proyecto | F2 (junto presupuesto) |

**Visualización UI:** chips verdes = recopilado; gris = pendiente; ámbar = foco activo.

---

## 4. Nodo F2 — Subgrafo de datos críticos

Cada sub-nodo `data_*` es una **arista reflexiva** en F2 hasta completar:

```mermaid
stateDiagram-v2
    [*] --> presupuesto
    presupuesto --> cronograma: OK
    cronograma --> ubicacion: OK
    ubicacion --> entidad: OK
    entidad --> beneficiarios: OK
    beneficiarios --> objetivos: OK
    objetivos --> snip: OK
    snip --> [*]: 5+ OK → F3
    presupuesto --> presupuesto: incompleto
```

**Regla de oro:** el LLM pregunta solo el sub-nodo marcado `active` en `guide_graph.nodes_active`.

---

## 5. Subgrafo sectorial (F3)

```mermaid
flowchart TB
    SEC[Detectar sector] --> EDU[Educación]
    SEC --> SAL[Salud]
    SEC --> VIA[Vialidad]
    SEC --> AGU[Agua/Saneamiento]
    SEC --> PRO[Productivo]
    SEC --> OTRO[General]

    EDU --> RE1[RIESGO: demanda matrícula, infra educativa]
    SAL --> RE2[RIESGO: ESSALUD, equipamiento biomédico]
    VIA --> RE3[RIESGO: interferencias, SMO, terrenos]
    AGU --> RE4[RIESGO: operador, tarifas, O&M]
    PRO --> RE5[RIESGO: mercado, cadena valor]
```

---

## 6. Subgrafo fatalista (F3 — obligatorio)

| Nivel riesgo | Índice | Acción del mentor |
|--------------|--------|-------------------|
| BAJO | 0-25 | Optimismo cauteloso |
| MEDIO | 26-45 | 2-3 brechas prioritarias |
| ALTO | 46-69 | Peor escenario explícito |
| CRÍTICO | 70-100 | Rechazo probable; reformular antes de PDF |

**Elementos mínimos del bloque chat:**
1. Al menos **5 riesgos** en matriz (probabilidad × impacto).
2. **1 peor escenario narrativo** (3-5 líneas).
3. **Probabilidad cualitativa** de rechazo (baja/media/alta).
4. **2 mitigaciones** accionables.

---

## 7. Nodo F4 — Árbol de orientación

```mermaid
flowchart TD
    O0[Calcular brechas vs MEF] --> O1{¿Mayor brecha?}
    O1 -->|Normativa| A1[Citar directiva + gob.pe]
    O1 -->|Financiera| A2[Desglose + contingencia]
    O1 -->|Técnica| A3[Alcance + metodología]
    O1 -->|Institucional| A4[UF + OSCE]
    O1 -->|Temporal| A5[Cronograma realista]
    A1 & A2 & A3 & A4 & A5 --> TOP[Top 3 acciones ordenadas]
    TOP --> NEXT[Pregunta siguiente dato si <70%]
```

---

## 8. Nodo F5 + PDF — Pipeline de consolidación

| Paso | Sistema | Salida |
|------|---------|--------|
| 1 | `assess_guide_state` pdf_ready=true | Habilitar botón UI |
| 2 | `_build_conversation_digest` | Contexto unificado |
| 3 | `_generate_pdf_sections_chunked` ×10 | Secciones MEF |
| 4 | `CEDITPdf` | Archivo formal |
| 5 | `score_document_against_mef` | Triple índice + riesgo |
| 6 | ≥80% | `Mis expedientes` |

---

## 9. Trazabilidad y visualización (API → UI)

Cada respuesta de auditoría incluye `guide_graph`:

```json
{
  "current_node_id": "f2_recopilar",
  "phase_name": "RECOPILAR",
  "nodes": [{ "id": "f0_descubrir", "status": "completed", "label": "Descubrir", "icon": "explore" }],
  "critical_items": [{ "id": "presupuesto", "collected": false }],
  "profile": { "completeness_pct": 42, "items": [] },
  "trail": ["gate_legal", "role_detect", "f0_descubrir", "f1_diagnosticar", "f2_recopilar"],
  "mentor_message": "Recopilando expediente pieza a pieza..."
}
```

**Estados visuales:**
- `completed` — azul, nodo superado
- `current` — ámbar pulsante, foco del turno
- `active` — sub-nodo en progreso (ej. data_presupuesto)
- `pending` — gris, aún no alcanzado

---

## 10. Matriz de transición (tabla completa)

| Desde | Condición | Hacia |
|-------|-----------|-------|
| START | texto ≤30 palabras | F0 |
| START | PDF adjunto | F1 o F2 según extracción |
| F0 | problema + actor | F1 |
| F1 | + ubicación | F2 |
| F2 | dato i incompleto | F2 (sub-nodo data_i) |
| F2 | ≥5/7 datos | F3 |
| F3 | siempre | evaluación riesgo |
| F3 | riesgo CRÍTICO | alerta → F4 |
| F4 | completitud <70% | F2 |
| F4 | completitud ≥70% | F5 |
| F5 | usuario confirma | PDF |
| PDF | score <80% | F4 |
| PDF | score ≥80% | Mis expedientes |

---

## 11. Casos especiales (multi-rama)

### 11.1 Usuario experto — entrada densa
Saltar F0 si: 7/7 datos explícitos en un mensaje → F3 directo (nunca saltar riesgo).

### 11.2 Urgencia CRÍTICA (perfil)
Priorizar checklist mínimo viable; advertir calidad insuficiente si aplica.

### 11.3 Municipio pequeño + proyecto grande
Riesgo institucional ALTO por capacidad; nodo F3 enfatiza UF y asistencia técnica.

### 11.4 Proyecto productivo
Activar subgrafo PRO; riesgo de mercado y sostenibilidad económica.

### 11.5 Segunda vuelta post-PDF
Re-score → si bajó índice, F4 con brechas del PDF generado.

---

## 12. Sincronización con archivos MD

| Archivo | Rol en el grafo |
|---------|-----------------|
| `master.md` | Gates legales L0A |
| `instinct.md` | Rama REJ |
| `soul_extended.md` | Conducta por fase |
| `plan.md` | Orquestación omnicanal |
| `guide_engine.py` | Estado machine ejecutable |

---

## 13. Nodos de Programas Estatales Impulsadores

A partir de F1 (cuando se detecta sector), el motor identifica programas estatales aplicables:

```mermaid
flowchart TB
    DETECT[Detectar sector + entidad + monto] --> MATCH{Matching engine}
    MATCH --> TOP3[Top 3 programas por relevance_score]
    TOP3 --> ORIENT[Inyectar en F4 ORIENTAR como perspectiva]
    TOP3 --> CONSOL[Incluir en F5 PDF como vía de financiamiento]
```

**Programas modelados (10):**
| ID | Programa | Aplicabilidad |
|----|----------|---------------|
| prog_invierte | Invierte.pe (MEF) | Todo PIP — requisito base |
| prog_foniprel | FONIPREL | GR/GL, cofin. concursable hasta 99.9% |
| prog_oxi | Obras por Impuestos | Empresa privada + obra pública |
| prog_procompite | PROCOMPITE | Planes de negocio productivos |
| prog_proinnovate | ProInnóvate | Pymes innovadoras |
| prog_pronied | PRONIED (SIAT) | Infraestructura educativa |
| prog_trabaja_peru | Llamkasun Perú | Obras intensivas mano de obra |
| prog_agroideas | AGROIDEAS | Productores agrarios organizados |
| prog_riego | PSI Riego | Irrigación tecnificada |
| prog_app | APP (ProInversión) | Megaproyectos concesión |

**Comportamiento del mentor:**
- F1-F2: menciona programa más relevante como "perspectiva" ("Ojo, si es educación, PRONIED da asesoría gratis para expedientes")
- F4: sección formal `## Programas impulsadores recomendados` con top 3
- F5/PDF: integra recomendación de financiamiento en el plan técnico

**Visualización frontend:** `recommended_programs` en `guide_graph` JSON, renderizado en `GuideGraphTrail.jsx`.

---

## 14. Red de decisiones interactiva (UI — solo auditoría)

Cuando `isAuditSession` es verdadero, cada respuesta del bot con `guide_graph` crea un **checkpoint** (`decisionCheckpoints`):

| Campo | Uso |
|-------|-----|
| `messageIndex` | Índice del mensaje bot en el chat |
| `phase` / `nodeId` | Fase y nodo del grafo MEF |
| `userPrompt` | Última pregunta del usuario antes de esa respuesta |
| `guideGraph` | Snapshot slim del estado |

**Componente:** `AuditDecisionNetwork.jsx`
- Nodos **arrastrables** (posiciones en `nodePositions`)
- Conexiones curvas estilo red neuronal (timeline + laterales)
- Botón **Restaurar chat aquí** → trunca mensajes y checkpoints posteriores
- Visible **solo en auditoría/plan**, no en consulta normativa ciudadana

**Restaurar:** confirma al usuario; `messages.slice(0, messageIndex + 1)`; la siguiente pregunta usa historial truncado hacia la API.

---

## 15. Evolución futura (grafo v4)

- Persistencia de `guide_graph` por `conversationId` en backend.
- Historial de nodos visitados en sidebar.
- Export PNG del recorrido para informes UF.
- Grafo condicional por normativa regional.

---

**Versión:** 3.0 SUPREME + PROGRAMS · **Nodos totales:** 12 principales + 7 datos + 7 perfil + 5 sectores + 10 programas
