import React from 'react';
import { useI18n } from '../i18n/I18nContext';
import { ensureGuideGraphNodes, GUIDE_PIPELINE_NODES } from '../utils/auditDecisionPoints';

const MAIN_NODE_IDS = GUIDE_PIPELINE_NODES.map((n) => n.id);

const statusStyles = {
  completed: {
    dot: 'bg-blue-800 border-blue-800 text-white',
    line: 'bg-blue-300',
    label: 'text-blue-900 font-semibold',
    card: 'border-blue-200 bg-blue-50/60',
  },
  current: {
    dot: 'bg-amber-500 border-amber-600 text-white ring-4 ring-amber-200 animate-pulse',
    line: 'bg-amber-200',
    label: 'text-amber-900 font-bold',
    card: 'border-amber-300 bg-amber-50 ring-2 ring-amber-200',
  },
  active: {
    dot: 'bg-slate-400 border-slate-500 text-white',
    line: 'bg-slate-200',
    label: 'text-slate-700 font-medium',
    card: 'border-slate-200 bg-slate-50',
  },
  pending: {
    dot: 'bg-white border-slate-300 text-slate-400',
    line: 'bg-slate-100',
    label: 'text-slate-400',
    card: 'border-slate-100 bg-white opacity-70',
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

  return (
    <div className={`cedit-fade-in rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50/40 p-4 ${className}`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-blue-900 flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">account_tree</span>
            {t('guide.title')}
          </p>
          <p className="text-xs text-slate-600 mt-0.5">{graph.mentor_message}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] text-slate-500">{t('guide.phase')}</p>
          <p className="text-xs font-bold text-blue-900">{graph.phase_name}</p>
        </div>
      </div>

      {/* Pipeline principal del grafo */}
      <div className="overflow-x-auto pb-2 -mx-1 px-1">
        <div className="flex items-center min-w-[520px] gap-0">
          {mainNodes.map((node, idx) => {
            const st = statusStyles[node.status] || statusStyles.pending;
            const isLast = idx === mainNodes.length - 1;
            return (
              <React.Fragment key={node.id}>
                <div className="flex flex-col items-center w-[72px] shrink-0">
                  <div
                    className={`w-9 h-9 rounded-full border-2 flex items-center justify-center shadow-sm ${st.dot}`}
                    title={node.description}
                  >
                    <span className="material-symbols-outlined text-base">{node.icon || 'circle'}</span>
                  </div>
                  <p className={`text-[9px] text-center mt-1 leading-tight max-w-[68px] ${st.label}`}>
                    {node.label}
                  </p>
                </div>
                {!isLast && (
                  <div className={`h-0.5 flex-1 min-w-[12px] max-w-[24px] rounded ${st.line}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Barras duales: expediente + perfil */}
      <div className="grid grid-cols-2 gap-2 mt-3">
        <div className="rounded-lg border border-slate-200 bg-white/80 p-2">
          <p className="text-[9px] font-bold text-slate-500 uppercase">{t('guide.expediente')}</p>
          <div className="h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
            <div
              className="h-full bg-blue-700 rounded-full transition-all duration-500"
              style={{ width: `${graph.completeness_pct ?? 0}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-600 mt-1">
            {collectedCritical}/{criticalItems.length || 7} · {graph.completeness_pct}%
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white/80 p-2">
          <p className="text-[9px] font-bold text-slate-500 uppercase">{t('guide.profile')}</p>
          <div className="h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
            <div
              className="h-full bg-emerald-600 rounded-full transition-all duration-500"
              style={{ width: `${graph.profile_completeness_pct ?? 0}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-600 mt-1">
            {collectedProfile}/{profileItems.length || 7} · {graph.profile_completeness_pct}%
          </p>
        </div>
      </div>

      {/* Sub-nodos: datos críticos (F2) */}
      {criticalItems.length > 0 && (
        <details className="mt-3 group" open={graph.phase_name === 'RECOPILAR'}>
          <summary className="cursor-pointer text-[10px] font-bold text-slate-600 uppercase list-none flex items-center gap-1">
            <span className="material-symbols-outlined text-sm group-open:rotate-90 transition-transform">
              chevron_right
            </span>
            {t('guide.criticalData')}
          </summary>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {criticalItems.map((item) => (
              <span
                key={item.id}
                className={`text-[9px] px-2 py-1 rounded-full border ${
                  item.collected
                    ? 'bg-blue-100 border-blue-300 text-blue-900'
                    : graph.nodes_active?.includes(`data_${item.id}`)
                      ? 'bg-amber-100 border-amber-400 text-amber-900 ring-1 ring-amber-300'
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

      {/* Sub-nodos: perfil usuario */}
      {profileItems.length > 0 && (
        <details className="mt-2 group">
          <summary className="cursor-pointer text-[10px] font-bold text-slate-600 uppercase list-none flex items-center gap-1">
            <span className="material-symbols-outlined text-sm group-open:rotate-90 transition-transform">
              chevron_right
            </span>
            {t('guide.userProfile')}
          </summary>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {profileItems.map((item) => (
              <span
                key={item.id}
                title={item.question}
                className={`text-[9px] px-2 py-1 rounded-full border ${
                  item.collected
                    ? 'bg-emerald-100 border-emerald-400 text-emerald-900'
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

      {/* Programas impulsadores recomendados */}
      {graph.recommended_programs?.length > 0 && (
        <details className="mt-3 group" open={graph.phase >= 4}>
          <summary className="cursor-pointer text-[10px] font-bold text-slate-600 uppercase list-none flex items-center gap-1">
            <span className="material-symbols-outlined text-sm group-open:rotate-90 transition-transform">
              chevron_right
            </span>
            {t('guide.programs')}
          </summary>
          <div className="mt-2 space-y-1.5">
            {graph.recommended_programs.map((prog) => (
              <div
                key={prog.id}
                className="flex items-start gap-2 rounded-lg border border-indigo-100 bg-indigo-50/60 px-2.5 py-1.5"
              >
                <span className="material-symbols-outlined text-sm text-indigo-700 mt-0.5">
                  {prog.icon || 'rocket_launch'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-indigo-900 leading-tight">{prog.label}</p>
                  <p className="text-[9px] text-slate-600 leading-tight mt-0.5">{prog.hint}</p>
                  {prog.url && (
                    <a
                      href={prog.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[9px] text-indigo-600 hover:underline mt-0.5 inline-block"
                    >
                      Ver programa →
                    </a>
                  )}
                </div>
                <div className="shrink-0">
                  <span className={`inline-block w-2 h-2 rounded-full ${
                    prog.relevance_score >= 3 ? 'bg-green-500' :
                    prog.relevance_score >= 2 ? 'bg-amber-500' : 'bg-slate-300'
                  }`} title={`Relevancia: ${prog.relevance_score}`} />
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {graph.pdf_ready && (
        <p className="mt-3 text-[10px] font-semibold text-center text-blue-800 bg-blue-100 border border-blue-200 rounded-lg py-2">
          {t('guide.pdfReady')}
        </p>
      )}

      <p className="mt-2 text-[9px] text-slate-400 text-center">
        {t('guide.trail')}: {graph.trail?.slice(-4).join(' → ')}
      </p>
    </div>
  );
};

export default GuideGraphTrail;
