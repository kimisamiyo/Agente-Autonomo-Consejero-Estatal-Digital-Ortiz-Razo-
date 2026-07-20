import React from 'react';
import { useI18n } from '../i18n/I18nContext';
import { resolveTheme } from '../theme/ceditPalette';

const riskTheme = (level) => {
  const lvl = (level || '').toUpperCase();
  if (lvl === 'CRÍTICO' || lvl === 'CRITICO') {
    return { border: 'border-red-400', bg: 'bg-red-50', text: 'text-red-800', ring: 'ring-red-300' };
  }
  if (lvl === 'ALTO') {
    return { border: 'border-orange-300', bg: 'bg-orange-50', text: 'text-orange-900', ring: '' };
  }
  if (lvl === 'MEDIO') {
    return { border: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-900', ring: '' };
  }
  return { border: 'border-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-800', ring: '' };
};

const MefScoreCard = ({ score, className = '' }) => {
  const { t } = useI18n();
  if (!score) return null;
  const doc = score.document_only_index ?? 0;
  const est = score.estimated_with_official_plan ?? score.approval_index ?? 0;
  const risk = score.risk_index ?? 50;
  const riskLevel = score.risk_level ?? 'MEDIO';
  const meets = score.meets_expediente_threshold;
  const gray = resolveTheme('gray');
  const blue = resolveTheme('blue');
  const riskStyle = riskTheme(riskLevel);

  return (
    <div className={`cedit-fade-in ${className}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1">
        <span className="material-symbols-outlined text-sm text-[var(--cedit-steel)]">analytics</span>
        {t('mef.title')}
      </p>

      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
        <div
          className={`rounded-xl border-2 ${gray.statBorder} ${gray.statBg} p-3 sm:p-4 text-center shadow-sm min-h-[80px] flex flex-col justify-center`}
        >
          <p className={`text-2xl sm:text-3xl font-bold tabular-nums ${gray.stat}`}>{doc}%</p>
          <p className="text-[10px] sm:text-[11px] text-slate-600 font-semibold mt-1 leading-tight">{t('mef.currentDoc')}</p>
        </div>
        <div
          className={`rounded-xl border-2 ${meets ? blue.statBorder : 'border-[var(--cedit-border)]'} ${blue.statBg} p-3 sm:p-4 text-center shadow-sm min-h-[80px] flex flex-col justify-center ${meets ? 'ring-1 ring-blue-300' : ''}`}
        >
          <p className={`text-2xl sm:text-3xl font-bold tabular-nums ${blue.stat}`}>{est}%</p>
          <p className="text-[10px] sm:text-[11px] text-[var(--cedit-steel)] font-semibold mt-1 leading-tight">{t('mef.withPlan')}</p>
        </div>
        <div
          className={`rounded-xl border-2 ${riskStyle.border} ${riskStyle.bg} p-3 sm:p-4 text-center shadow-sm min-h-[80px] flex flex-col justify-center ${riskStyle.ring ? `ring-1 ${riskStyle.ring}` : ''}`}
        >
          <p className={`text-2xl sm:text-3xl font-bold tabular-nums ${riskStyle.text}`}>{risk}%</p>
          <p className={`text-[10px] sm:text-[11px] font-semibold mt-1 leading-tight ${riskStyle.text}`}>
            {t('mef.riskIndex')}
          </p>
          <p className={`text-[9px] font-bold uppercase tracking-wide mt-0.5 ${riskStyle.text}`}>{riskLevel}</p>
        </div>
      </div>

      {meets && (
        <p className="text-[10px] text-[var(--cedit-steel)] bg-[var(--cedit-steel-soft)] border border-[var(--cedit-border)] rounded-lg px-3 py-2 mb-3 text-center font-medium">
          {t('mef.meetsThreshold')}
        </p>
      )}

      {score.worst_case_scenarios?.length > 0 && (
        <div className="mb-3 p-3 rounded-xl border border-red-200 bg-red-50/80">
          <p className="text-xs font-semibold text-red-900 mb-1">{t('mef.worstCase')}</p>
          <ul className="text-xs text-red-900/90 list-disc pl-4 space-y-0.5">
            {score.worst_case_scenarios.slice(0, 3).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {score.strengths?.length > 0 && (
        <div className="mb-3 p-3 rounded-xl border border-slate-200 bg-slate-50/80">
          <p className="text-xs font-semibold text-slate-800 mb-1">{t('mef.strengths')}</p>
          <ul className="text-xs text-slate-700 list-disc pl-4 space-y-0.5">
            {score.strengths.slice(0, 5).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      {score.missing_points?.length > 0 && (
        <div className="mb-3 p-3 rounded-xl border border-slate-200 bg-white">
          <p className="text-xs font-semibold text-[var(--cedit-text)] mb-1">{t('mef.missing')}</p>
          <ul className="text-xs text-slate-700 list-disc pl-4 space-y-0.5">
            {score.missing_points.slice(0, 5).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      {score.recommendations?.length > 0 && (
        <div className="p-3 rounded-xl border border-[var(--cedit-border)] bg-[var(--cedit-steel-soft)]">
          <p className="text-xs font-semibold text-[var(--cedit-text)] mb-1">{t('mef.recommend')}</p>
          <ul className="text-xs text-slate-700 list-disc pl-4 space-y-0.5">
            {score.recommendations.slice(0, 4).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default MefScoreCard;
