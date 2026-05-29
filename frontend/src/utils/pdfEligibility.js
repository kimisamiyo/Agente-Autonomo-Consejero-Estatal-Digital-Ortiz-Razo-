/** Fases de recopilación — aún no se ofrece PDF. */
const EARLY_PHASES = new Set(['DESCUBRIR', 'DIAGNOSTICAR', 'RECOPILAR']);

export const MEF_SUCCESS_THRESHOLD = 80;
const RISK_BLOCK_THRESHOLD = 70;

/**
 * @returns {{ show: boolean, reason?: 'phase'|'score'|'risk'|'none', est?: number, risk?: number }}
 */
export function canShowPdfOffer(msg) {
  if (!msg) return { show: false, reason: 'none' };

  const phase = (msg.guidePhase || msg.guide_graph?.phase_name || '').toUpperCase().replace(/\s/g, '_');
  if (EARLY_PHASES.has(phase)) {
    return { show: false, reason: 'phase' };
  }

  if (!msg.showPdf) {
    return { show: false, reason: 'phase' };
  }

  const est = msg.mefScore?.estimated_with_official_plan ?? msg.mefScore?.approval_index ?? 0;
  const risk = msg.mefScore?.risk_index ?? 100;

  if (est < MEF_SUCCESS_THRESHOLD) {
    return { show: false, reason: 'score', est, risk };
  }
  if (risk >= RISK_BLOCK_THRESHOLD) {
    return { show: false, reason: 'risk', est, risk };
  }

  return { show: true, est, risk };
}

export function isEarlyGuidePhase(msg) {
  const phase = (msg?.guidePhase || msg?.guideGraph?.phase_name || '').toUpperCase().replace(/\s/g, '_');
  return EARLY_PHASES.has(phase);
}

/** Registro Syscoin solo cuando el expediente alcanza umbral de plan PDF (≥80%). */
export function shouldShowSyscoinBadge(msg) {
  if (!msg || msg.isDocAck) return false;
  if (!msg.isAudit && msg.mode !== 'audit' && msg.mode !== 'plan') return false;
  const est =
    msg.mefScore?.estimated_with_official_plan ??
    msg.mefScore?.approval_index ??
    0;
  return Number(est) >= MEF_SUCCESS_THRESHOLD;
}
