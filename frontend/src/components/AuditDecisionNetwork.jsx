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
  className = '',
}) => {
  const { t } = useI18n();
  const containerRef = useRef(null);
  const [size, setSize] = useState({ w: 640, h: 320 });
  const [dragging, setDragging] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [expanded, setExpanded] = useState(true);

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

  return (
    <div
      className={`rounded-2xl border-2 border-indigo-200/80 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 shadow-xl overflow-hidden ${className}`}
    >
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-indigo-500/30 bg-black/20">
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-indigo-300 text-lg">hub</span>
          <div>
            <p className="text-xs font-bold text-indigo-100 tracking-wide">{t('decision.title')}</p>
            <p className="text-[10px] text-indigo-300/90 truncate">{t('decision.subtitle')}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-[10px] font-semibold text-indigo-200 hover:text-white px-2 py-1 rounded-lg border border-indigo-500/40"
        >
          {expanded ? t('decision.collapse') : t('decision.expand')}
        </button>
      </div>

      {expanded && (
        <>
          <div
            ref={containerRef}
            className="relative w-full h-[min(340px,42vh)] min-h-[240px] select-none touch-none"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 30%, rgba(99,102,241,0.15) 0%, transparent 45%), radial-gradient(circle at 80% 70%, rgba(59,130,246,0.12) 0%, transparent 40%)',
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
                      ? `0 0 24px ${style.glow}, 0 8px 20px rgba(0,0,0,0.4)`
                      : '0 4px 12px rgba(0,0,0,0.35)',
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
                    <span className="text-[8px] font-black uppercase tracking-tighter text-slate-800 leading-none">
                      {cp.label?.slice(0, 12)}
                    </span>
                    <span className="text-[7px] text-slate-600 mt-0.5 leading-tight">{cp.subtitle}</span>
                  </div>

                  {(isHover || isActive) && (
                    <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-40 w-[200px]">
                      <div className="rounded-xl border border-indigo-400/50 bg-slate-900/95 text-indigo-50 p-2.5 shadow-2xl backdrop-blur-sm">
                        <p className="text-[9px] text-indigo-300 font-bold uppercase">{t('decision.node')}</p>
                        <p className="text-[10px] mt-1 line-clamp-2">{cp.userPrompt}</p>
                        {cp.mentorMessage && (
                          <p className="text-[9px] text-indigo-200/80 mt-1 italic line-clamp-2">{cp.mentorMessage}</p>
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

          <div className="px-4 py-2.5 border-t border-indigo-500/20 bg-black/25 flex flex-wrap items-center gap-2 text-[9px] text-indigo-300">
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-indigo-400 rounded" />
              {t('decision.legendTimeline')}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 border-t border-dashed border-cyan-400" />
              {t('decision.legendLateral')}
            </span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[12px]">drag_indicator</span>
              {t('decision.legendDrag')}
            </span>
          </div>
        </>
      )}
    </div>
  );
};

export default AuditDecisionNetwork;
