import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import {
  buildNetworkEdges,
  defaultNodePosition,
} from '../utils/auditDecisionPoints';

const NODE_W = 88;
const NODE_H = 56;

const phaseColors = {
  DESCUBRIR: { ring: '#f59e0b', fill: '#fffbeb', glow: 'rgba(245,158,11,0.35)' },
  DIAGNOSTICAR: { ring: '#3b82f6', fill: '#eff6ff', glow: 'rgba(59,130,246,0.35)' },
  RECOPILAR: { ring: '#6366f1', fill: '#eef2ff', glow: 'rgba(99,102,241,0.35)' },
  EVALUAR_RIESGO: { ring: '#dc2626', fill: '#fef2f2', glow: 'rgba(220,38,38,0.35)' },
  ORIENTAR: { ring: '#0d9488', fill: '#f0fdfa', glow: 'rgba(13,148,136,0.35)' },
  CONSOLIDAR: { ring: '#1d4ed8', fill: '#dbeafe', glow: 'rgba(29,78,216,0.45)' },
};

function getPhaseStyle(phase) {
  const key = (phase || '').toUpperCase().replace(/\s/g, '_');
  return phaseColors[key] || phaseColors.DIAGNOSTICAR;
}

const AuditDecisionNetwork = ({
  checkpoints = [],
  positions = {},
  activeCheckpointId = null,
  onRestore,
  onPositionChange,
  expanded: expandedProp,
  onExpandedChange,
  className = '',
}) => {
  const { t } = useI18n();
  const containerRef = useRef(null);
  const [size, setSize] = useState({ w: 640, h: 320 });
  const [dragging, setDragging] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
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

  const sorted = useMemo(
    () => [...checkpoints].sort((a, b) => a.messageIndex - b.messageIndex),
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

  const resolvedPositions = useMemo(() => {
    const out = { ...positions };
    sorted.forEach((cp, i) => {
      if (!out[cp.id]) {
        out[cp.id] = cp.position || defaultNodePosition(i, sorted.length, size.w, size.h);
      }
    });
    return out;
  }, [sorted, positions, size.w, size.h]);

  const edges = useMemo(
    () => buildNetworkEdges(sorted, resolvedPositions),
    [sorted, resolvedPositions]
  );

  const handlePointerDown = useCallback((e, cpId) => {
    e.preventDefault();
    e.stopPropagation();
    const pos = resolvedPositions[cpId];
    setDragging({
      id: cpId,
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
    });
  }, [resolvedPositions]);

  useEffect(() => {
    if (!dragging) return undefined;
    const onMove = (e) => {
      const dx = e.clientX - dragging.startX;
      const dy = e.clientY - dragging.startY;
      const nx = Math.max(8, Math.min(size.w - NODE_W - 8, dragging.origX + dx));
      const ny = Math.max(8, Math.min(size.h - NODE_H - 8, dragging.origY + dy));
      onPositionChange?.(dragging.id, { x: nx, y: ny });
    };
    const onUp = () => setDragging(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging, onPositionChange, size.w, size.h]);

  if (!sorted.length) return null;

  const latest = sorted[sorted.length - 1];

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden h-full flex flex-col ${
        !expanded ? 'cedit-network-pulse-light' : ''
      } ${className}`}
    >
      <button
        type="button"
        onClick={toggleExpanded}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/80 hover:bg-slate-100 transition-colors text-left min-h-[56px]"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="material-symbols-outlined text-slate-600 text-lg shrink-0">hub</span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-800 tracking-wide">{t('decision.title')}</p>
            <p className="text-[10px] text-slate-500 truncate mt-0.5">
              {expanded ? t('decision.subtitle') : t('decision.collapsedHint', { count: sorted.length, phase: latest?.label || '—' })}
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
            ref={containerRef}
            className="relative w-full h-[min(240px,32vh)] min-h-[200px] max-h-[320px] select-none touch-none bg-slate-50"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 30%, rgba(148,163,184,0.2) 0%, transparent 45%), radial-gradient(circle at 80% 70%, rgba(203,213,225,0.25) 0%, transparent 40%)',
            }}
          >
            {/* Grid neuronal */}
            <svg className="absolute inset-0 w-full h-full opacity-30 pointer-events-none">
              <defs>
                <pattern id="cedit-neural-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                  <circle cx="1" cy="1" r="0.6" fill="rgba(129,140,248,0.5)" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#cedit-neural-grid)" />
            </svg>

            {/* Conexiones sinápticas */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
              <defs>
                <linearGradient id="edge-time" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#818cf8" stopOpacity="0.2" />
                  <stop offset="50%" stopColor="#a5b4fc" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.3" />
                </linearGradient>
                <linearGradient id="edge-lat" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.1" />
                  <stop offset="100%" stopColor="#818cf8" stopOpacity="0.4" />
                </linearGradient>
              </defs>
              {edges.map((edge) => {
                const mx = (edge.x1 + edge.x2) / 2;
                const my = (edge.y1 + edge.y2) / 2 - 30;
                const d = `M ${edge.x1} ${edge.y1} Q ${mx} ${my} ${edge.x2} ${edge.y2}`;
                const isLat = edge.kind === 'lateral';
                const isActive =
                  activeCheckpointId &&
                  (edge.from === activeCheckpointId || edge.to === activeCheckpointId);
                return (
                  <g key={edge.id}>
                    <path
                      d={d}
                      fill="none"
                      stroke={isActive ? '#fbbf24' : isLat ? 'url(#edge-lat)' : 'url(#edge-time)'}
                      strokeWidth={isActive ? 2.5 : isLat ? 1 : 1.8}
                      strokeDasharray={isLat ? '4 6' : 'none'}
                      className={isActive ? 'animate-pulse' : ''}
                      opacity={isLat ? 0.5 : 0.85}
                    />
                    {isActive && (
                      <circle r="3" fill="#fbbf24" className="animate-pulse">
                        <animateMotion dur="2s" repeatCount="indefinite" path={d} />
                      </circle>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Nodos */}
            {sorted.map((cp, index) => {
              const pos = resolvedPositions[cp.id] || { x: 0, y: 0 };
              const style = getPhaseStyle(cp.phase);
              const isActive = activeCheckpointId === cp.id;
              const isHover = hoveredId === cp.id;
              const isLatest = index === sorted.length - 1;

              return (
                <div
                  key={cp.id}
                  role="button"
                  tabIndex={0}
                  className={`absolute cursor-grab active:cursor-grabbing transition-shadow duration-200 ${
                    dragging?.id === cp.id ? 'z-30' : 'z-10'
                  }`}
                  style={{
                    left: pos.x,
                    top: pos.y,
                    width: NODE_W,
                    height: NODE_H,
                    boxShadow: isActive || isHover
                      ? `0 0 16px ${style.glow}, 0 4px 12px rgba(15,23,42,0.12)`
                      : '0 2px 8px rgba(15,23,42,0.08)',
                  }}
                  onPointerDown={(e) => handlePointerDown(e, cp.id)}
                  onMouseEnter={() => setHoveredId(cp.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onRestore?.(cp);
                  }}
                >
                  <div
                    className={`w-full h-full rounded-xl border-2 flex flex-col items-center justify-center px-1 text-center transition-transform ${
                      isActive ? 'scale-110 ring-2 ring-amber-400' : isHover ? 'scale-105' : ''
                    } ${isLatest ? 'animate-pulse' : ''}`}
                    style={{
                      borderColor: style.ring,
                      backgroundColor: style.fill,
                    }}
                  >
                    <span className="text-[9px] font-black uppercase tracking-tight text-black leading-none">
                      {cp.label?.slice(0, 12)}
                    </span>
                    <span className="text-[8px] font-semibold text-slate-900 mt-0.5 leading-tight line-clamp-2">
                      {cp.subtitle}
                    </span>
                  </div>

                  {(isHover || isActive) && (
                    <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-40 w-[200px]">
                      <div className="rounded-xl border border-slate-200 bg-white text-slate-800 p-2.5 shadow-lg">
                        <p className="text-[9px] text-slate-500 font-bold uppercase">{t('decision.node')}</p>
                        <p className="text-[10px] mt-1 line-clamp-2">{cp.userPrompt}</p>
                        {cp.mentorMessage && (
                          <p className="text-[9px] text-slate-500 mt-1 italic line-clamp-2">{cp.mentorMessage}</p>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRestore?.(cp);
                          }}
                          className="mt-2 w-full py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 text-[10px] font-bold flex items-center justify-center gap-1"
                        >
                          <span className="material-symbols-outlined text-sm">history</span>
                          {t('decision.restore')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-100 flex flex-wrap items-center gap-3 text-[10px] text-slate-800 font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-slate-600 rounded" />
              {t('decision.legendTimeline')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 border-t-2 border-dashed border-slate-500" />
              {t('decision.legendLateral')}
            </span>
            <span className="flex items-center gap-1.5 text-slate-800">
              <span className="material-symbols-outlined text-[14px] text-slate-700">drag_indicator</span>
              {t('decision.legendDrag')}
            </span>
          </div>
        </>
      )}
    </div>
  );
};

export default AuditDecisionNetwork;
