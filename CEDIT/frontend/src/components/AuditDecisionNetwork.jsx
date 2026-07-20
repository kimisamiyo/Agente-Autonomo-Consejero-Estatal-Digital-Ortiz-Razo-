import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { buildNetworkEdges, layoutTimeline } from '../utils/auditDecisionPoints';

const phaseColors = {
  DESCUBRIR: { ring: '#64748b', fill: '#f8fafc', glow: 'rgba(100,116,139,0.3)' },
  DIAGNOSTICAR: { ring: '#1d4ed8', fill: '#eff6ff', glow: 'rgba(29,78,216,0.35)' },
  RECOPILAR: { ring: '#1e40af', fill: '#dbeafe', glow: 'rgba(30,64,175,0.35)' },
  EVALUAR_RIESGO: { ring: '#334155', fill: '#f1f5f9', glow: 'rgba(51,65,85,0.35)' },
  ORIENTAR: { ring: '#0f766e', fill: '#f0fdfa', glow: 'rgba(15,118,110,0.35)' },
  CONSOLIDAR: { ring: '#1e3a8a', fill: '#dbeafe', glow: 'rgba(30,58,138,0.45)' },
};

function getPhaseStyle(phase) {
  const key = (phase || '').toUpperCase().replace(/\s/g, '_');
  return phaseColors[key] || phaseColors.DIAGNOSTICAR;
}

function edgePath(edge) {
  const { x1, y1, x2, y2, kind } = edge;
  if (kind === 'timeline') {
    const mid = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
  }
  // Bifurcación: curva hacia el carril de la rama
  const dx = Math.max(28, Math.abs(x2 - x1) * 0.45);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx * 0.2} ${y2}, ${x2} ${y2}`;
}

const AuditDecisionNetwork = ({
  checkpoints = [],
  activeCheckpointId = null,
  onRestore,
  expanded: expandedProp,
  onExpandedChange,
  className = '',
}) => {
  const { t } = useI18n();
  const containerRef = useRef(null);
  const scrollRef = useRef(null);
  const [size, setSize] = useState({ w: 720, h: 200 });
  const [selectedId, setSelectedId] = useState(null);
  const [expandedInternal, setExpandedInternal] = useState(false);
  const isControlled = expandedProp !== undefined;
  const expanded = isControlled ? Boolean(expandedProp) : expandedInternal;

  const toggleExpanded = () => {
    const next = !expanded;
    if (isControlled) {
      onExpandedChange?.(next);
    } else {
      setExpandedInternal(next);
    }
  };

  const activeList = useMemo(
    () =>
      [...checkpoints]
        .filter((c) => !c.abandoned)
        .sort((a, b) => a.messageIndex - b.messageIndex),
    [checkpoints]
  );

  const abandonedList = useMemo(
    () => checkpoints.filter((c) => c.abandoned),
    [checkpoints]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [expanded]);

  const layout = useMemo(
    () => layoutTimeline(checkpoints, Math.max(size.w, 480), Math.max(size.h, 180)),
    [checkpoints, size.w, size.h]
  );

  const edges = useMemo(
    () => buildNetworkEdges(checkpoints, layout.positions, layout.nodeW, layout.nodeH),
    [checkpoints, layout]
  );

  useEffect(() => {
    if (!expanded || !scrollRef.current || !activeCheckpointId) return;
    const pos = layout.positions[activeCheckpointId];
    if (!pos) return;
    const scroller = scrollRef.current;
    const target = pos.x - scroller.clientWidth / 2 + layout.nodeW / 2;
    scroller.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }, [activeCheckpointId, expanded, layout]);

  if (!checkpoints.length) return null;

  const latest = activeList[activeList.length - 1] || checkpoints[checkpoints.length - 1];
  const selected = checkpoints.find((c) => c.id === selectedId) || null;

  const handleNodeActivate = (cp) => {
    setSelectedId(cp.id);
  };

  const handleRestore = (cp) => {
    if (!cp) return;
    if (cp.abandoned && cp.forkFromId) {
      const fork = checkpoints.find((c) => c.id === cp.forkFromId);
      if (fork) onRestore?.(fork);
      return;
    }
    onRestore?.(cp);
  };

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col ${
        !expanded ? 'cedit-network-pulse-light' : ''
      } ${className}`}
    >
      <button
        type="button"
        onClick={toggleExpanded}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/80 hover:bg-slate-100 transition-colors text-left min-h-[56px]"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="material-symbols-outlined text-slate-600 text-lg shrink-0">
            timeline
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-800 tracking-wide">{t('decision.title')}</p>
            <p className="text-[10px] text-slate-500 truncate mt-0.5">
              {expanded
                ? t('decision.subtitle')
                : t('decision.collapsedHint', {
                    count: activeList.length,
                    phase: latest?.label || '—',
                  })}
            </p>
          </div>
        </div>
        <span className="shrink-0 text-[10px] font-semibold text-slate-700 px-2.5 py-1 rounded-md border border-slate-200 bg-white">
          {expanded ? t('decision.collapse') : t('decision.expand')}
        </span>
      </button>

      {expanded && (
        <>
          <div
            ref={scrollRef}
            className="relative w-full overflow-x-auto overflow-y-auto bg-slate-50 max-h-[min(340px,42vh)]"
          >
            <div
              ref={containerRef}
              className="relative select-none min-h-[200px]"
              style={{
                width: layout.contentWidth,
                height: Math.max(layout.contentHeight || 200, 200),
                backgroundImage:
                  'linear-gradient(180deg, rgba(241,245,249,0.9) 0%, rgba(248,250,252,1) 45%, rgba(241,245,249,0.95) 100%)',
              }}
            >
              {/* Eje horizontal principal */}
              <div
                className="absolute left-4 right-4 h-px bg-slate-300/80 pointer-events-none"
                style={{ top: layout.mainY }}
              />

              <svg
                className="absolute inset-0 pointer-events-none overflow-visible"
                width={layout.contentWidth}
                height={Math.max(layout.contentHeight || 200, 200)}
              >
                <defs>
                  <linearGradient id="tl-main" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.35" />
                    <stop offset="50%" stopColor="#2563eb" stopOpacity="0.95" />
                    <stop offset="100%" stopColor="#1e40af" stopOpacity="0.5" />
                  </linearGradient>
                  <linearGradient id="tl-branch" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#64748b" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#94a3b8" stopOpacity="0.7" />
                  </linearGradient>
                </defs>
                {edges.map((edge) => {
                  const d = edgePath(edge);
                  const isBranch = edge.kind === 'branch' || edge.kind === 'fork';
                  const isActive =
                    activeCheckpointId &&
                    (edge.from === activeCheckpointId || edge.to === activeCheckpointId);
                  return (
                    <g key={edge.id}>
                      <path
                        d={d}
                        fill="none"
                        stroke={
                          isActive ? '#1d4ed8' : isBranch ? 'url(#tl-branch)' : 'url(#tl-main)'
                        }
                        strokeWidth={isActive ? 2.8 : isBranch ? 1.4 : 2.2}
                        strokeDasharray={isBranch ? '5 5' : 'none'}
                        opacity={isBranch ? 0.75 : 0.95}
                      />
                      {!isBranch && (
                        <circle r="2.5" fill="#2563eb" opacity="0.85">
                          <animateMotion dur="3.2s" repeatCount="indefinite" path={d} />
                        </circle>
                      )}
                    </g>
                  );
                })}
              </svg>

              {checkpoints.map((cp) => {
                const pos = layout.positions[cp.id];
                if (!pos) return null;
                const style = getPhaseStyle(cp.phase);
                const isActive = activeCheckpointId === cp.id;
                const isSelected = selectedId === cp.id;
                const isLatest =
                  !cp.abandoned && activeList[activeList.length - 1]?.id === cp.id;

                return (
                  <div
                    key={cp.id}
                    role="button"
                    tabIndex={0}
                    className={`absolute z-10 transition-transform duration-200 ${
                      isSelected || isActive ? 'z-20 scale-[1.04]' : 'hover:scale-[1.03]'
                    }`}
                    style={{
                      left: pos.x,
                      top: pos.y,
                      width: layout.nodeW,
                      height: layout.nodeH,
                    }}
                    onClick={() => handleNodeActivate(cp)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleNodeActivate(cp);
                      }
                    }}
                  >
                    <div
                      className={`w-full h-full rounded-xl border-2 flex flex-col items-center justify-center px-1.5 text-center shadow-sm ${
                        cp.abandoned ? 'opacity-70' : ''
                      } ${isLatest && !cp.abandoned ? 'ring-2 ring-blue-400/60' : ''} ${
                        isActive ? 'ring-2 ring-blue-700' : ''
                      }`}
                      style={{
                        borderColor: cp.abandoned ? '#94a3b8' : style.ring,
                        backgroundColor: cp.abandoned ? '#f8fafc' : style.fill,
                        boxShadow:
                          isActive || isSelected
                            ? `0 0 14px ${style.glow}`
                            : '0 2px 8px rgba(15,23,42,0.06)',
                      }}
                    >
                      <span className="text-[9px] font-black uppercase tracking-tight text-slate-800 leading-none">
                        {(cp.label || cp.phase || 'NODO').slice(0, 14)}
                      </span>
                      <span className="text-[8px] font-semibold text-slate-600 mt-0.5 leading-tight line-clamp-2">
                        {cp.subtitle}
                      </span>
                      {cp.abandoned && (
                        <span className="text-[7px] font-bold uppercase text-slate-400 mt-0.5">
                          {t('decision.branch')}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {selected && (
            <div className="px-4 py-3 border-t border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">
                  {selected.abandoned ? t('decision.branchNode') : t('decision.node')}
                </p>
                <p className="text-xs font-semibold text-slate-800 mt-0.5">{selected.label}</p>
                <p className="text-[11px] text-slate-600 line-clamp-2 mt-1">{selected.userPrompt}</p>
                {selected.mentorMessage && (
                  <p className="text-[10px] text-slate-500 italic line-clamp-2 mt-1">
                    {selected.mentorMessage}
                  </p>
                )}
                {selected.abandoned && (
                  <p className="text-[10px] text-slate-500 mt-1">{t('decision.branchHint')}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleRestore(selected)}
                className="shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-800 hover:bg-blue-900 text-white text-[11px] font-bold transition-colors"
              >
                <span className="material-symbols-outlined text-base">history</span>
                {selected.abandoned ? t('decision.restoreFork') : t('decision.restore')}
              </button>
            </div>
          )}

          <div className="px-4 py-2 border-t border-slate-200 bg-slate-100 flex flex-wrap items-center gap-3 text-[10px] text-slate-700 font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-0.5 bg-blue-600 rounded" />
              {t('decision.legendTimeline')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-0.5 border-t-2 border-dashed border-slate-500" />
              {t('decision.legendBranch')}
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="material-symbols-outlined text-[14px]">touch_app</span>
              {t('decision.legendTap')}
            </span>
            {abandonedList.length > 0 && (
              <span className="text-slate-500">
                {t('decision.branchCount', { count: abandonedList.length })}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AuditDecisionNetwork;
