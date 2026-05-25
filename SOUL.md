# SOUL — Índice del Mentor Definitivo CEDIT

## Documentación

| Archivo | Nivel |
|---------|--------|
| [`agent_mind/soul.md`](agent_mind/soul.md) | Resumen operativo |
| [`agent_mind/soul_extended.md`](agent_mind/soul_extended.md) | **Supremo** — doctrina, perfil, fases, tono |
| [`agent_mind/decision_graph.md`](agent_mind/decision_graph.md) | Grafo resumido |
| [`agent_mind/decision_graph_extended.md`](agent_mind/decision_graph_extended.md) | **Supremo** — capas, subgrafos, trazabilidad |
| [`guide_engine.py`](guide_engine.py) | Motor ejecutable + JSON para UI |

## Visualización del recorrido

En **modo auditoría/plan**, cada respuesta del API incluye `guide_graph`. El frontend muestra el componente **Recorrido del mentor CEDIT** con:

- Pipeline de nodos (Descubrir → … → PDF)
- Barra de expediente (7 datos críticos)
- Barra de perfil de usuario (7 campos)
- Chips de sub-nodos activos
- Mensaje del mentor en el nodo actual

## Métricas triples

1. Documento actual (%)  
2. Con plan PDF (%)  
3. Índice de riesgo (%, BAJO → CRÍTICO)

---

*Reiniciar API (`uvicorn`) tras cambios en `cedit_core` o `guide_engine`.*
