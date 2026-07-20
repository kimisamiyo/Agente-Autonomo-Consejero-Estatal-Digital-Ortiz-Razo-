/** Puntos de decisión en auditoría MEF — timeline horizontal con bifurcaciones. */

const MAX_CHECKPOINTS = 24;
const MAX_ABANDONED = 24;

export function isAuditSession(sessionMode, messages = []) {
  return (
    sessionMode === 'audit' ||
    sessionMode === 'plan' ||
    messages.some((m) => m.consumesAuditCredit || m.isAudit || m.showPdf || m.guideGraph)
  );
}

export function shouldCreateCheckpoint(botMessage) {
  if (!botMessage || botMessage.role !== 'bot') return false;
  if (botMessage.isDocAck || botMessage.isFreemiumBlock) return false;
  return Boolean(
    botMessage.guideGraph ||
      botMessage.isAudit ||
      botMessage.consumesAuditCredit ||
      botMessage.mode === 'audit' ||
      botMessage.mode === 'plan'
  );
}

/** Metadatos mínimos del pipeline (fallback si el grafo se guardó sin nodes). */
export const GUIDE_PIPELINE_NODES = [
  { id: 'f0_descubrir', label: 'Descubrir', icon: 'explore' },
  { id: 'f1_diagnosticar', label: 'Diagnosticar', icon: 'stethoscope' },
  { id: 'f2_recopilar', label: 'Recopilar', icon: 'inventory_2' },
  { id: 'f3_riesgo', label: 'Evaluar riesgo', icon: 'warning' },
  { id: 'f4_orientar', label: 'Orientar', icon: 'route' },
  { id: 'f5_consolidar', label: 'Consolidar', icon: 'task_alt' },
  { id: 'pdf_generate', label: 'PDF oficial', icon: 'picture_as_pdf' },
];

const PHASE_TO_NODE = {
  DESCUBRIR: 'f0_descubrir',
  DIAGNOSTICAR: 'f1_diagnosticar',
  RECOPILAR: 'f2_recopilar',
  EVALUAR_RIESGO: 'f3_riesgo',
  ORIENTAR: 'f4_orientar',
  CONSOLIDAR: 'f5_consolidar',
};

/** Reconstruye nodes del pipeline cuando la persistencia solo dejó el resumen. */
export function ensureGuideGraphNodes(graph) {
  if (!graph) return [];
  if (graph.nodes?.length) return graph.nodes;

  const phaseKey = String(graph.phase_name || '')
    .toUpperCase()
    .replace(/\s/g, '_');
  const currentId =
    graph.current_node_id ||
    PHASE_TO_NODE[phaseKey] ||
    (graph.pdf_ready ? 'pdf_generate' : 'f0_descubrir');
  const order = GUIDE_PIPELINE_NODES.map((n) => n.id);
  const currentIdx = order.indexOf(currentId);
  const trail = new Set(graph.trail || []);

  return GUIDE_PIPELINE_NODES.map((meta, idx) => {
    let status = 'pending';
    if (meta.id === currentId) status = 'current';
    else if (trail.has(meta.id) || (currentIdx >= 0 && idx < currentIdx)) status = 'completed';
    else if (graph.pdf_ready && meta.id === 'pdf_generate') status = 'active';
    return { ...meta, status, description: '' };
  });
}

export function slimGuideGraph(graph) {
  if (!graph) return null;
  const nodes = ensureGuideGraphNodes(graph).map((n) => ({
    id: n.id,
    label: (n.label || '').slice(0, 28),
    icon: n.icon || 'circle',
    status: n.status || 'pending',
  }));
  return {
    phase_name: graph.phase_name,
    phase: graph.phase,
    current_node_id: graph.current_node_id,
    completeness_pct: graph.completeness_pct,
    profile_completeness_pct: graph.profile_completeness_pct,
    pdf_ready: graph.pdf_ready,
    mentor_message: (graph.mentor_message || '').slice(0, 200),
    trail: (graph.trail || []).slice(-8),
    nodes,
    critical_items: (graph.critical_items || []).map((c) => ({
      id: c.id,
      label: (c.label || '').slice(0, 40),
      collected: c.collected,
    })),
    profile: graph.profile
      ? {
          completeness_pct: graph.profile.completeness_pct,
          items: (graph.profile.items || []).map((i) => ({
            id: i.id,
            label: (i.label || '').slice(0, 28),
            collected: i.collected,
          })),
        }
      : undefined,
  };
}

export function findLastUserPrompt(messages, beforeIndex) {
  for (let i = beforeIndex - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m?.role === 'user' && !m.isFile) {
      return String(m.content || '').replace(/[#*`]/g, '').slice(0, 120);
    }
    if (m?.role === 'user' && m.isFile) {
      const match = String(m.content || '').match(/\*\*([^*]+\.pdf)\*\*/i);
      return match ? `PDF: ${match[1]}` : 'Documento PDF';
    }
  }
  return 'Inicio de auditoría';
}

export function createCheckpoint(messages, messageIndex, botMessage, sessionMode, parentId = null) {
  const g = botMessage.guideGraph || {};
  const phase = botMessage.guidePhase || g.phase_name || 'AUDITORÍA';
  const exp = botMessage.guideCompleteness ?? g.completeness_pct ?? 0;
  const risk = botMessage.mefScore?.risk_index;

  return {
    id: `cp_${messageIndex}_${Date.now()}`,
    messageIndex,
    phase,
    nodeId: g.current_node_id || 'f0_descubrir',
    label: phase,
    subtitle: `${exp}% expediente${risk != null ? ` · riesgo ${risk}%` : ''}`,
    mentorMessage: (g.mentor_message || '').slice(0, 160),
    userPrompt: findLastUserPrompt(messages, messageIndex),
    sessionMode: sessionMode || botMessage.mode || 'audit',
    guideGraph: slimGuideGraph(g),
    mefSnapshot: botMessage.mefScore
      ? {
          document_only_index: botMessage.mefScore.document_only_index,
          estimated_with_official_plan: botMessage.mefScore.estimated_with_official_plan,
          risk_index: botMessage.mefScore.risk_index,
          risk_level: botMessage.mefScore.risk_level,
        }
      : null,
    pdfReady: Boolean(g.pdf_ready || botMessage.showPdf),
    createdAt: Date.now(),
    parentId,
    abandoned: false,
    forkFromId: null,
    branchLane: 0,
    position: null,
  };
}

export function appendCheckpoint(checkpoints, messages, messageIndex, botMessage, sessionMode) {
  if (!shouldCreateCheckpoint(botMessage)) return checkpoints;
  const active = (checkpoints || []).filter((c) => !c.abandoned);
  const abandoned = (checkpoints || []).filter((c) => c.abandoned);
  const parentId = active.length ? active[active.length - 1].id : null;
  const cp = createCheckpoint(messages, messageIndex, botMessage, sessionMode, parentId);
  const withoutDup = active.filter((c) => c.messageIndex !== messageIndex);
  const nextActive = [...withoutDup, cp].slice(-MAX_CHECKPOINTS);
  return [...nextActive, ...abandoned.slice(-MAX_ABANDONED)];
}

/**
 * Reconstruye el camino activo desde mensajes guardados (p. ej. tras reiniciar el PC).
 * No recupera ramas abandonadas; esas solo existen si decisionCheckpoints se guardó entero.
 */
export function rebuildCheckpointsFromMessages(messages = [], sessionMode = 'audit') {
  const cps = [];
  (messages || []).forEach((msg, index) => {
    if (!shouldCreateCheckpoint(msg)) return;
    const parentId = cps.length ? cps[cps.length - 1].id : null;
    const cp = createCheckpoint(messages, index, msg, sessionMode, parentId);
    if (msg.checkpointId) cp.id = msg.checkpointId;
    cps.push(cp);
  });
  return cps.map(trimCheckpointForStorage);
}

/** Une checkpoints guardados con reconstrucción desde mensajes si faltan nodos. */
export function ensureDecisionCheckpoints(chat) {
  const messages = chat?.messages || [];
  const sessionMode = chat?.sessionMode || 'audit';
  const saved = chat?.decisionCheckpoints || [];
  const rebuilt = rebuildCheckpointsFromMessages(messages, sessionMode);

  if (!rebuilt.length) return saved;

  const savedAbandoned = saved.filter((c) => c.abandoned);
  const savedActive = saved.filter((c) => !c.abandoned);

  if (savedActive.length === 0 && savedAbandoned.length === 0) {
    return rebuilt;
  }

  if (rebuilt.length > savedActive.length) {
    return [...rebuilt, ...savedAbandoned].map(trimCheckpointForStorage);
  }

  return saved.map(trimCheckpointForStorage);
}

/**
 * Al restaurar: el tramo posterior pasa a rama abandonada.
 * Conserva TODAS las ramas previas (no las borra al volver a bifurcar).
 * Nunca elimina nodos del camino activo conservado (kept).
 */
export function forkCheckpointsAt(checkpoints, forkCp) {
  if (!forkCp) return checkpoints || [];
  const all = checkpoints || [];

  const kept = all
    .filter((c) => !c.abandoned && c.messageIndex <= forkCp.messageIndex)
    .sort((a, b) => a.messageIndex - b.messageIndex);

  const pruned = all
    .filter((c) => !c.abandoned && c.messageIndex > forkCp.messageIndex)
    .sort((a, b) => a.messageIndex - b.messageIndex);

  const priorAbandoned = all.filter((c) => c.abandoned);

  if (!pruned.length) {
    return [...kept, ...priorAbandoned];
  }

  const lane = nextBranchLane([...kept, ...priorAbandoned]);
  const newAbandoned = pruned.map((c, i) => ({
    ...c,
    abandoned: true,
    forkFromId: forkCp.id,
    parentId: i === 0 ? forkCp.id : pruned[i - 1].id,
    branchLane: lane,
  }));

  // Solo limitar ramas; el camino kept no se toca
  const abandoned = [...priorAbandoned, ...newAbandoned].slice(-MAX_ABANDONED);
  return [...kept, ...abandoned];
}

function nextBranchLane(checkpoints) {
  const used = new Set(
    (checkpoints || [])
      .filter((c) => c.abandoned)
      .map((c) => Number(c.branchLane) || 1)
  );
  let lane = 1;
  while (used.has(lane) && lane < 8) lane += 1;
  return lane;
}

export function pruneCheckpointsAfter(checkpoints, messageIndex) {
  return (checkpoints || []).filter((c) => c.messageIndex <= messageIndex);
}

const NODE_W = 112;
const NODE_H = 58;
const GAP_X = 36;
const PAD_X = 28;
const MAIN_Y_RATIO = 0.5;
const LANE_OFFSET = 72;

/** Layout horizontal: camino activo en el centro; cada rama en su carril. */
export function layoutTimeline(checkpoints, containerWidth = 640, containerHeight = 220) {
  const list = checkpoints || [];
  const active = list
    .filter((c) => !c.abandoned)
    .sort((a, b) => a.messageIndex - b.messageIndex);
  const abandoned = list.filter((c) => c.abandoned);

  const maxLane = abandoned.reduce((m, c) => Math.max(m, Number(c.branchLane) || 1), 0);
  const neededH = Math.max(containerHeight, 160 + maxLane * LANE_OFFSET);
  const mainY = Math.round(neededH * MAIN_Y_RATIO);

  const positions = {};

  active.forEach((cp, i) => {
    positions[cp.id] = {
      x: PAD_X + i * (NODE_W + GAP_X),
      y: mainY - NODE_H / 2,
      lane: 0,
    };
  });

  // Agrupar por fork + carril para no pisar ramas distintas del mismo origen
  const byForkLane = {};
  abandoned.forEach((cp) => {
    const lane = Number(cp.branchLane) || 1;
    const key = `${cp.forkFromId || 'root'}__${lane}`;
    if (!byForkLane[key]) byForkLane[key] = [];
    byForkLane[key].push(cp);
  });

  Object.values(byForkLane).forEach((nodes) => {
    nodes.sort((a, b) => a.messageIndex - b.messageIndex);
    const forkId = nodes[0]?.forkFromId;
    const lane = Number(nodes[0]?.branchLane) || 1;
    const forkPos = forkId ? positions[forkId] : null;
    const sign = lane % 2 === 0 ? 1 : -1;
    const laneIdx = Math.ceil(lane / 2);
    const rawY = mainY + sign * LANE_OFFSET * laneIdx - NODE_H / 2;
    const branchY = Math.min(neededH - NODE_H - 10, Math.max(8, rawY));
    const startX = forkPos
      ? forkPos.x + NODE_W + GAP_X * 0.35
      : PAD_X + Math.max(active.length, 1) * (NODE_W + GAP_X);

    nodes.forEach((cp, i) => {
      positions[cp.id] = {
        x: startX + i * (NODE_W + GAP_X),
        y: branchY,
        lane,
      };
    });
  });

  const maxX = Object.values(positions).reduce(
    (m, p) => Math.max(m, (p?.x || 0) + NODE_W + PAD_X),
    containerWidth
  );

  return {
    positions,
    contentWidth: Math.max(containerWidth, maxX),
    contentHeight: neededH,
    mainY,
    nodeW: NODE_W,
    nodeH: NODE_H,
  };
}

/** @deprecated Prefer layoutTimeline — se mantiene por compatibilidad. */
export function defaultNodePosition(index, total, containerWidth = 640, containerHeight = 300) {
  const { positions } = layoutTimeline(
    Array.from({ length: total }, (_, i) => ({
      id: `tmp_${i}`,
      messageIndex: i,
      abandoned: false,
    })),
    containerWidth,
    containerHeight
  );
  return positions[`tmp_${index}`] || { x: PAD_X, y: containerHeight / 2 };
}

export function buildNetworkEdges(checkpoints, positions, nodeW = NODE_W, nodeH = NODE_H) {
  const edges = [];
  const cx = nodeW / 2;
  const cy = nodeH / 2;
  const byId = Object.fromEntries((checkpoints || []).map((c) => [c.id, c]));

  (checkpoints || []).forEach((cp) => {
    const parentId = cp.parentId;
    if (!parentId || !byId[parentId] || !positions[cp.id] || !positions[parentId]) return;
    const pa = positions[parentId];
    const pb = positions[cp.id];
    const isBranch = Boolean(cp.abandoned) || pa.lane !== pb.lane;
    edges.push({
      id: `${parentId}->${cp.id}`,
      from: parentId,
      to: cp.id,
      x1: pa.x + (isBranch ? cx : nodeW),
      y1: pa.y + cy,
      x2: pb.x + (isBranch ? cx : 0),
      y2: pb.y + cy,
      kind: cp.abandoned ? 'branch' : isBranch ? 'fork' : 'timeline',
    });
  });

  // Cadena temporal en activos (también si falta parentId)
  const active = (checkpoints || [])
    .filter((c) => !c.abandoned)
    .sort((a, b) => a.messageIndex - b.messageIndex);
  for (let i = 0; i < active.length - 1; i += 1) {
    const a = active[i];
    const b = active[i + 1];
    const already = edges.some((e) => e.from === a.id && e.to === b.id);
    if (already || !positions[a.id] || !positions[b.id]) continue;
    const pa = positions[a.id];
    const pb = positions[b.id];
    edges.push({
      id: `seq_${a.id}-${b.id}`,
      from: a.id,
      to: b.id,
      x1: pa.x + nodeW,
      y1: pa.y + cy,
      x2: pb.x,
      y2: pb.y + cy,
      kind: 'timeline',
    });
  }

  return edges;
}

export function trimCheckpointForStorage(cp) {
  return {
    id: cp.id,
    messageIndex: cp.messageIndex,
    phase: cp.phase,
    nodeId: cp.nodeId,
    label: (cp.label || '').slice(0, 32),
    subtitle: (cp.subtitle || '').slice(0, 48),
    userPrompt: (cp.userPrompt || '').slice(0, 80),
    mentorMessage: (cp.mentorMessage || '').slice(0, 120),
    sessionMode: cp.sessionMode,
    guideGraph: cp.guideGraph,
    pdfReady: cp.pdfReady,
    createdAt: cp.createdAt,
    parentId: cp.parentId || null,
    abandoned: Boolean(cp.abandoned),
    forkFromId: cp.forkFromId || null,
    branchLane: cp.branchLane || 0,
    position: cp.position,
  };
}
