import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import {
  buildNetworkEdges,
  defaultNodePosition,
} from '../utils/auditDecisionPoints';

const NODE_W = 88;
const NODE_H = 56;

/** Fases en escala acero / grafito (CEDIT). */
const phaseColors = {
  DESCUBRIR: { ring: '#64748b', fill: '#f1f5f9', glow: 'rgba(100,116,139,0.35)' },
  DIAGNOSTICAR: { ring: '#5b6b7f', fill: '#eef1f5', glow: 'rgba(91,107,127,0.4)' },
  RECOPILAR: { ring: '#3f5f8a', fill: '#e8ecf1', glow: 'rgba(63,95,138,0.35)' },
  EVALUAR_RIESGO: { ring: '#3a4556', fill: '#e2e6ec', glow: 'rgba(58,69,86,0.4)' },
  ORIENTAR: { ring: '#1a222e', fill: '#f1f5f9', glow: 'rgba(26,34,46,0.3)' },
  CONSOLIDAR: { ring: '#2c4466', fill: '#e6eaef', glow: 'rgba(44,68,102,0.45)' },
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
      className={`rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)] overflow-hidden h-full flex flex-col ${
        !expanded ? 'cedit-network-pulse-light' : ''
      } ${className}`}
    >
      <button
        type="button"
        onClick={toggleExpanded}
        className="w-full flex items-center justify-between gap-2 px-4 py-3.5 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-slate-100/50 hover:to-slate-100 transition-colors text-left min-h-[60px]"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 text-white flex items-center justify-center shrink-0 shadow-sm">
            <span className="material-symbols-outlined text-[18px]">hub</span>
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-900 tracking-wide">{t('decision.title')}</p>
            <p className="text-[10px] text-slate-500 truncate mt-0.5">
              {expanded ? t('decision.subtitle') : t('decision.collapsedHint', { count: sorted.length, phase: latest?.label || '—' })}
            </p>
          </div>
        </div>
        <span className="shrink-0 text-[10px] font-semibold text-[var(--cedit-text)] px-2.5 py-1 rounded-lg border border-[var(--cedit-border)] bg-[var(--cedit-steel-soft)]">
          {expanded ? t('decision.collapse') : t('decision.expand')}
        </span>
      </button>

      {expanded && (
        <>
          <div
            ref={containerRef}
            className="relative w-full h-[min(260px,34vh)] min-h-[210px] max-h-[340px] select-none touch-none"
            style={{
              backgroundImage:
                'radial-gradient(ellipse at 15% 20%, rgba(91,107,127,0.1) 0%, transparent 50%), radial-gradient(ellipse at 85% 75%, rgba(100,116,139,0.1) 0%, transparent 45%), linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
            }}
          >
            <svg className="absolute inset-0 w-full h-full opacity-40 pointer-events-none">
              <defs>
                <pattern id="cedit-neural-grid" width="28" height="28" patternUnits="userSpaceOnUse">
                  <circle cx="1" cy="1" r="0.7" fill="rgba(59,130,246,0.45)" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#cedit-neural-grid)" />
            </svg>

            <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
              <defs>
                <linearGradient id="edge-time" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.25" />
                  <stop offset="50%" stopColor="#5b6b7f" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#3f5f8a" stopOpacity="0.35" />
                </linearGradient>
                <linearGradient id="edge-lat" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#5b6b7f" stopOpacity="0.45" />
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
                      stroke={isActive ? '#3f5f8a' : isLat ? 'url(#edge-lat)' : 'url(#edge-time)'}
                      strokeWidth={isActive ? 2.6 : isLat ? 1 : 1.9}
                      strokeDasharray={isLat ? '4 6' : 'none'}
                      className={isActive ? 'animate-pulse' : ''}
                      opacity={isLat ? 0.55 : 0.9}
                    />
                    {isActive && (
                      <circle r="3.5" fill="#3f5f8a" className="animate-pulse">
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
                    className={`w-full h-full rounded-xl border-2 flex flex-col items-center justify-center px-1 text-center transition-transform backdrop-blur-sm ${
                      isActive ? 'scale-110 ring-2 ring-slate-400' : isHover ? 'scale-105' : ''
                    } ${isLatest ? 'cedit-node-pulse' : ''}`}
                    style={{
                      borderColor: style.ring,
                      backgroundColor: style.fill,
                    }}
                  >
                    <span className="text-[9px] font-black uppercase tracking-tight text-slate-900 leading-none">
                      {cp.label?.slice(0, 12)}
                    </span>
                    <span className="text-[8px] font-semibold text-slate-700 mt-0.5 leading-tight line-clamp-2">
                      {cp.subtitle}
                    </span>
                  </div>

                  {(isHover || isActive) && (
                    <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-40 w-[210px]">
                      <div className="rounded-xl border border-slate-200 bg-white/95 backdrop-blur text-slate-800 p-2.5 shadow-xl shadow-slate-900/10">
                        <p className="text-[9px] text-[var(--cedit-steel)] font-bold uppercase tracking-wide">{t('decision.node')}</p>
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
                          className="mt-2 w-full py-1.5 rounded-lg bg-gradient-to-r from-slate-600 to-slate-900 hover:opacity-95 text-white text-[10px] font-bold flex items-center justify-center gap-1 shadow-sm"
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
