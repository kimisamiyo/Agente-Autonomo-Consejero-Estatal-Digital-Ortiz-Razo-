import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import GuideGraphTrail from './GuideGraphTrail';
import { useI18n } from '../i18n/I18nContext';

/**
 * Panel colapsable en el header (junto a la red de decisiones): expediente, grafo y datos PDF.
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
  const mentorLine = (guideGraph?.mentor_message || '').slice(0, 100);
  const hasPanelBody = Boolean(panelMarkdown?.trim() || guideGraph);

  useEffect(() => {
    setPulse(true);
    const id = window.setTimeout(() => setPulse(false), 2000);
    return () => window.clearTimeout(id);
  }, [messageKey]);

  if (!hasPanelBody) return null;

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col ${
        pulse ? 'cedit-network-pulse-light' : ''
      }`}
    >
      <button
        type="button"
        onClick={toggleExpanded}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/80 hover:bg-slate-100 transition-colors text-left min-h-[56px]"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="material-symbols-outlined text-slate-600 text-lg shrink-0">account_tree</span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-800 tracking-wide truncate">
              {t('chat.mentorPanelShort')}
            </p>
            <p className="text-[10px] text-slate-500 truncate mt-0.5">
              {mentorLine || t('chat.mentorPanelSummary', { phase: phase || '—', pct: expedientePct })}
            </p>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {phase && (
            <span className="text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
              {phase}
            </span>
          )}
          <span className="text-slate-400 text-sm leading-none">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 max-h-[min(70vh,520px)] bg-white border-t border-slate-100">
          {panelMarkdown?.trim() && (
            <div className="rounded-lg p-3 prose prose-sm max-w-none text-slate-800 border border-slate-200 bg-slate-50/40">
              <ReactMarkdown>{panelMarkdown}</ReactMarkdown>
            </div>
          )}
          {guideGraph && <GuideGraphTrail graph={guideGraph} className="!p-3" />}
          {mefScore && (
            <p className="text-[10px] text-slate-500 px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-100">
              {t('mef.title')}: {mefScore.document_only_index ?? 0}%
              {mefScore.risk_index != null ? ` · riesgo ${mefScore.risk_index}%` : ''}
              {phase ? ` · ${t('guide.phase')} ${phase}` : ''}
            </p>
          )}
          {!panelMarkdown?.trim() && !guideGraph && !mefScore && (
            <p className="text-[11px] text-slate-500 px-2 py-4 text-center">
              {t('chat.mentorPanelExpand')}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default MentorInsightPanel;
