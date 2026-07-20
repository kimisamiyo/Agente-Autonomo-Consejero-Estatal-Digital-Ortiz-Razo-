import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import GuideGraphTrail from './GuideGraphTrail';
import { useI18n } from '../i18n/I18nContext';
import { ceditPanelClass } from '../theme/ceditPalette';

/**
 * Panel colapsable: expediente, grafo y datos PDF.
 * La opinión conversacional va siempre en el chat.
 */
const MentorInsightPanel = ({
  panelMarkdown = '',
  guideGraph = null,
  mefScore = null,
  guidePhase = '',
  messageKey = 0,
  expanded: expandedProp,
  onExpandedChange,
}) => {
  const { t } = useI18n();
  const [expandedInternal, setExpandedInternal] = useState(false);
  const [pulse, setPulse] = useState(false);
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

  const phase = guidePhase || guideGraph?.phase_name || '';
  const expedientePct = guideGraph?.completeness_pct ?? mefScore?.document_only_index ?? 0;
  const mentorLine = (guideGraph?.mentor_message || '').slice(0, 110);
  const hasPanelBody = Boolean(panelMarkdown?.trim() || guideGraph);

  useEffect(() => {
    setPulse(true);
    const id = window.setTimeout(() => setPulse(false), 2200);
    return () => window.clearTimeout(id);
  }, [messageKey]);

  if (!hasPanelBody) return null;

  return (
    <div
      className={`${ceditPanelClass('flex flex-col')} ${
        pulse ? 'cedit-network-pulse-light' : ''
      }`}
    >
      <button
        type="button"
        onClick={toggleExpanded}
        className="w-full flex items-center justify-between gap-2 px-4 py-3.5 border-b border-slate-100/90 bg-gradient-to-r from-slate-50 via-white to-slate-100/40 hover:from-slate-100/80 hover:to-slate-100/60 transition-colors text-left min-h-[60px]"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="w-9 h-9 rounded-xl cedit-accent-steel text-white flex items-center justify-center shrink-0 shadow-sm">
            <span className="material-symbols-outlined text-[18px]">account_tree</span>
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-900 tracking-wide truncate">
              {t('chat.mentorPanelShort')}
            </p>
            <p className="text-[10px] text-slate-500 truncate mt-0.5">
              {mentorLine || t('chat.mentorPanelSummary', { phase: phase || '—', pct: expedientePct })}
            </p>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {typeof expedientePct === 'number' && (
            <span className="hidden sm:inline-flex text-[10px] font-bold tabular-nums text-[var(--cedit-text)] bg-[var(--cedit-steel-soft)] border border-[var(--cedit-border)] px-2 py-0.5 rounded-md">
              {expedientePct}%
            </span>
          )}
          {phase && (
            <span className="text-[10px] font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-sm">
              {phase}
            </span>
          )}
          <span
            className={`material-symbols-outlined text-slate-400 text-lg transition-transform duration-300 ${
              expanded ? 'rotate-180' : ''
            }`}
          >
            expand_more
          </span>
        </div>
      </button>

      {expanded && (
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 max-h-[min(70vh,540px)] bg-gradient-to-b from-white to-slate-50/80 border-t border-slate-100 cedit-fade-in">
          {panelMarkdown?.trim() && (
            <div className="rounded-xl p-3.5 prose prose-sm max-w-none text-slate-800 border border-slate-200/80 bg-white shadow-sm">
              <ReactMarkdown>{panelMarkdown}</ReactMarkdown>
            </div>
          )}
          {guideGraph && <GuideGraphTrail graph={guideGraph} className="!shadow-none" />}
          {mefScore && (
            <p className="text-[10px] text-slate-600 px-3 py-2 rounded-xl bg-[var(--cedit-steel-soft)] border border-[var(--cedit-border)] font-medium">
              {t('mef.title')}: {mefScore.document_only_index ?? 0}%
              {mefScore.risk_index != null ? ` · riesgo ${mefScore.risk_index}%` : ''}
              {phase ? ` · ${t('guide.phase')} ${phase}` : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default MentorInsightPanel;
