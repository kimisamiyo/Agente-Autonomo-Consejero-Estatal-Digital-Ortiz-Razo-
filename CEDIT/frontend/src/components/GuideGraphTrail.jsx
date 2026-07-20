import React from 'react';
import { useI18n } from '../i18n/I18nContext';
import { ensureGuideGraphNodes, GUIDE_PIPELINE_NODES } from '../utils/auditDecisionPoints';

const MAIN_NODE_IDS = GUIDE_PIPELINE_NODES.map((n) => n.id);

const statusStyles = {
  completed: {
    dot: 'bg-gradient-to-br from-slate-600 to-slate-900 border-slate-700 text-white shadow-md shadow-slate-900/20',
    line: 'bg-gradient-to-r from-slate-500 to-slate-300',
    label: 'text-[var(--cedit-text)] font-semibold',
  },
  current: {
    dot: 'bg-gradient-to-br from-slate-500 to-slate-800 border-slate-500 text-white ring-[3px] ring-slate-300/80 shadow-lg shadow-slate-600/25 cedit-node-pulse',
    line: 'bg-[var(--cedit-border)]',
    label: 'text-[var(--cedit-ink)] font-bold',
  },
  active: {
    dot: 'bg-slate-500 border-slate-600 text-white',
    line: 'bg-slate-200',
    label: 'text-slate-700 font-medium',
  },
  pending: {
    dot: 'bg-white border-slate-300 text-slate-400',
    line: 'bg-slate-100',
    label: 'text-slate-400',
  },
};

const GuideGraphTrail = ({ graph, className = '' }) => {
  const { t } = useI18n();
  if (!graph) return null;

  const nodes = ensureGuideGraphNodes(graph);
  if (!nodes.length && graph.completeness_pct == null && !graph.mentor_message) return null;

  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const mainNodes = MAIN_NODE_IDS.map((id) => nodeMap[id]).filter(Boolean);
  const criticalItems = graph.critical_items || [];
  const profileItems = graph.profile?.items || [];
  const collectedCritical = criticalItems.filter((i) => i.collected).length;
  const collectedProfile = profileItems.filter((i) => i.collected).length;
  const currentIdx = mainNodes.findIndex((n) => n.status === 'current');

  return (
    <div
      className={`cedit-fade-in relative rounded-2xl border border-slate-200/90 overflow-hidden ${className}`}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
        style={{
          background:
            'linear-gradient(135deg, rgba(248,250,252,0.98) 0%, rgba(238,241,245,0.9) 45%, rgba(241,245,249,0.95) 100%)',
        }}
      />
      <div
        className="absolute -top-16 -right-16 w-48 h-48 rounded-full pointer-events-none opacity-40"
        style={{ background: 'radial-gradient(circle, rgba(91,107,127,0.16), transparent 70%)' }}
        aria-hidden
      />

      <div className="relative p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--cedit-text)] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">account_tree</span>
              {t('guide.title')}
            </p>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{graph.mentor_message}</p>
          </div>
          <div className="shrink-0 text-right rounded-xl border border-[var(--cedit-border)] bg-white/80 px-3 py-2 shadow-sm">
            <p className="text-[9px] uppercase tracking-wide text-slate-500 font-semibold">
              {t('guide.phase')}
            </p>
            <p className="text-xs font-bold text-[var(--cedit-text)] mt-0.5">{graph.phase_name}</p>
          </div>
        </div>

        {/* Pipeline */}
        <div className="overflow-x-auto pb-3 -mx-1 px-1">
          <div className="flex items-center min-w-[540px] gap-0 relative">
            {mainNodes.map((node, idx) => {
              const st = statusStyles[node.status] || statusStyles.pending;
              const isLast = idx === mainNodes.length - 1;
              const lineDone = currentIdx < 0 ? true : idx < currentIdx;
              return (
                <React.Fragment key={node.id}>
                  <div className="flex flex-col items-center w-[74px] shrink-0 group/node">
                    <div
                      className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-transform duration-300 group-hover/node:scale-110 ${st.dot}`}
                      title={node.description}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {node.icon || 'circle'}
                      </span>
                    </div>
                    <p
                      className={`text-[9px] text-center mt-1.5 leading-tight max-w-[70px] ${st.label}`}
                    >
                      {node.label}
                    </p>
                  </div>
                  {!isLast && (
                    <div
                      className={`h-[3px] flex-1 min-w-[10px] max-w-[28px] rounded-full ${
                        lineDone || node.status === 'completed'
                          ? statusStyles.completed.line
                          : st.line
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {criticalItems.length > 0 && (
          <details className="mt-3.5 group" open={graph.phase_name === 'RECOPILAR'}>
            <summary className="cursor-pointer text-[10px] font-bold text-slate-600 uppercase tracking-wide list-none flex items-center gap-2 hover:text-[var(--cedit-text)]">
              <span className="material-symbols-outlined text-sm group-open:rotate-90 transition-transform text-[var(--cedit-steel)] shrink-0">
                chevron_right
              </span>
              <span className="min-w-0 flex-1 truncate">{t('guide.criticalData')}</span>
              <span className="shrink-0 text-[9px] normal-case tracking-normal font-semibold tabular-nums text-[var(--cedit-text)]">
                {collectedCritical}/{criticalItems.length || 7}
              </span>
            </summary>
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {criticalItems.map((item) => (
                <span
                  key={item.id}
                  className={`text-[9px] px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                    item.collected
                      ? 'bg-[var(--cedit-surface-3)] border-[var(--cedit-border-strong)] text-[var(--cedit-ink)]'
                      : graph.nodes_active?.includes(`data_${item.id}`)
                        ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-500'
                  }`}
                >
                  {item.collected ? '✓ ' : ''}
                  {item.label.split('(')[0].trim().slice(0, 28)}
                  {(item.label.length > 28 || item.label.includes('(')) && '…'}
                </span>
              ))}
            </div>
          </details>
        )}

        {profileItems.length > 0 && (
          <details className="mt-2.5 group">
            <summary className="cursor-pointer text-[10px] font-bold text-slate-600 uppercase tracking-wide list-none flex items-center gap-2 hover:text-[var(--cedit-text)]">
              <span className="material-symbols-outlined text-sm group-open:rotate-90 transition-transform text-slate-600 shrink-0">
                chevron_right
              </span>
              <span className="min-w-0 flex-1 truncate">{t('guide.userProfile')}</span>
              <span className="shrink-0 text-[9px] normal-case tracking-normal font-semibold tabular-nums text-slate-800">
                {collectedProfile}/{profileItems.length || 7}
              </span>
            </summary>
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {profileItems.map((item) => (
                <span
                  key={item.id}
                  title={item.question}
                  className={`text-[9px] px-2.5 py-1 rounded-lg border font-medium ${
                    item.collected
                      ? 'bg-slate-100 border-slate-300 text-slate-900'
                      : 'bg-white border-slate-200 text-slate-500'
                  }`}
                >
                  {item.collected ? '✓ ' : ''}
                  {item.label}
                </span>
              ))}
            </div>
          </details>
        )}

        {graph.recommended_programs?.length > 0 && (
          <details className="mt-3.5 group" open={graph.phase >= 4}>
            <summary className="cursor-pointer text-[10px] font-bold text-slate-600 uppercase tracking-wide list-none flex items-center gap-1 hover:text-[var(--cedit-text)]">
              <span className="material-symbols-outlined text-sm group-open:rotate-90 transition-transform text-[var(--cedit-steel)]">
                chevron_right
              </span>
              {t('guide.programs')}
            </summary>
            <div className="mt-2.5 space-y-2">
              {graph.recommended_programs.map((prog) => (
                <div
                  key={prog.id}
                  className="flex items-start gap-2.5 rounded-xl border border-[var(--cedit-border)] bg-gradient-to-r from-white to-slate-100/50 px-3 py-2.5 shadow-sm"
                >
                  <span className="w-8 h-8 rounded-lg bg-[var(--cedit-surface-3)] text-[var(--cedit-steel)] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[18px]">
                      {prog.icon || 'rocket_launch'}
                    </span>
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-[var(--cedit-ink)] leading-tight">{prog.label}</p>
                    <p className="text-[10px] text-slate-600 leading-snug mt-0.5">{prog.hint}</p>
                    {prog.url && (
                      <a
                        href={prog.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-semibold text-[var(--cedit-steel)] hover:underline mt-1 inline-flex items-center gap-0.5"
                      >
                        {t('guide.viewProgram')}
                        <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
                      </a>
                    )}
                  </div>
                  <span
                    className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${
                      prog.relevance_score >= 3
                        ? 'cedit-accent-steel'
                        : prog.relevance_score >= 2
                          ? 'bg-slate-500'
                          : 'bg-slate-300'
                    }`}
                    title={t('guide.relevance', { score: prog.relevance_score })}
                  />
                </div>
              ))}
            </div>
          </details>
        )}

        {graph.pdf_ready && (
          <p className="mt-4 text-[11px] font-semibold text-center text-white bg-gradient-to-r from-slate-600 to-slate-900 rounded-xl py-2.5 shadow-md shadow-slate-900/20 cedit-pulse-btn">
            {t('guide.pdfReady')}
          </p>
        )}

        <p className="mt-3 text-[9px] text-slate-400 text-center tracking-wide">
          {t('guide.trail')}: {graph.trail?.slice(-4).join(' → ')}
        </p>
      </div>
    </div>
  );
};

export default GuideGraphTrail;
