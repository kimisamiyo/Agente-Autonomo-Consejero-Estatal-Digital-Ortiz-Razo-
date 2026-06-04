/** Puntos de decisión en auditoría MEF — checkpoints para volver atrás en el chat. */

const MAX_CHECKPOINTS = 12;

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

export function slimGuideGraph(graph) {
  if (!graph) return null;
  return {
    phase_name: graph.phase_name,
    phase: graph.phase,
    current_node_id: graph.current_node_id,
    completeness_pct: graph.completeness_pct,
    profile_completeness_pct: graph.profile_completeness_pct,
    pdf_ready: graph.pdf_ready,
    mentor_message: (graph.mentor_message || '').slice(0, 200),
    trail: (graph.trail || []).slice(-8),
    critical_items: (graph.critical_items || []).map((c) => ({
      id: c.id,
      label: (c.label || '').slice(0, 40),
      collected: c.collected,
    })),
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

export function createCheckpoint(messages, messageIndex, botMessage, sessionMode) {
  const g = botMessage.guideGraph || {};
  const phase = botMessage.guidePhase || g.phase_name || 'AUDITORÍA';
  const exp = botMessage.guideCompleteness ?? g.completeness_pct ?? 0;
  const risk = botMessage.mefScore?.risk_index;
  const riskLvl = botMessage.mefScore?.risk_level;

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
    position: null,
  };
}

export function appendCheckpoint(checkpoints, messages, messageIndex, botMessage, sessionMode) {
  if (!shouldCreateCheckpoint(botMessage)) return checkpoints;
  const cp = createCheckpoint(messages, messageIndex, botMessage, sessionMode);
  const withoutDup = (checkpoints || []).filter((c) => c.messageIndex !== messageIndex);
  return [...withoutDup, cp].slice(-MAX_CHECKPOINTS);
}

export function pruneCheckpointsAfter(checkpoints, messageIndex) {
  return (checkpoints || []).filter((c) => c.messageIndex <= messageIndex);
}

/** Layout inicial tipo red neuronal (capas por fase). */
export function defaultNodePosition(index, total, containerWidth = 640, containerHeight = 300) {
  const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(total))));
  const row = Math.floor(index / cols);
  const col = index % cols;
  const padX = 56;
  const padY = 48;
  const cellW = (containerWidth - padX * 2) / Math.max(cols - 1, 1);
  const rows = Math.ceil(total / cols) || 1;
  const cellH = (containerHeight - padY * 2) / Math.max(rows - 1, 1);
  const jitterX = ((index * 17) % 24) - 12;
  const jitterY = ((index * 23) % 20) - 10;
  return {
    x: padX + col * cellW + jitterX,
    y: padY + row * cellH + jitterY,
  };
}

export function buildNetworkEdges(checkpoints, positions) {
  const edges = [];
  const sorted = [...checkpoints].sort((a, b) => a.messageIndex - b.messageIndex);
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const pa = positions[a.id] || a.position || { x: 0, y: 0 };
    const pb = positions[b.id] || b.position || { x: 0, y: 0 };
    edges.push({
      id: `${a.id}-${b.id}`,
      from: a.id,
      to: b.id,
      x1: pa.x + 40,
      y1: pa.y + 28,
      x2: pb.x + 40,
      y2: pb.y + 28,
      kind: 'timeline',
    });
  }
  // Conexiones laterales decorativas (estilo red neuronal)
  sorted.forEach((cp, i) => {
    if (i > 0 && i % 2 === 0) {
      const prev = sorted[i - 2];
      if (prev) {
        const pa = positions[prev.id] || prev.position || { x: 0, y: 0 };
        const pb = positions[cp.id] || cp.position || { x: 0, y: 0 };
        edges.push({
          id: `lat_${prev.id}-${cp.id}`,
          from: prev.id,
          to: cp.id,
          x1: pa.x + 40,
          y1: pa.y + 28,
          x2: pb.x + 40,
          y2: pb.y + 28,
          kind: 'lateral',
        });
      }
    }
  });
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
    sessionMode: cp.sessionMode,
    guideGraph: cp.guideGraph,
    pdfReady: cp.pdfReady,
    createdAt: cp.createdAt,
    position: cp.position,
  };
}
