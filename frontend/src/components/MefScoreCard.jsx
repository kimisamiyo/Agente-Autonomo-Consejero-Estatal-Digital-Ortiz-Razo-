import React from 'react';
import { useI18n } from '../i18n/I18nContext';
import { resolveTheme } from '../theme/ceditPalette';

const MefScoreCard = ({ score, className = '' }) => {
  const { t } = useI18n();
  if (!score) return null;
  const doc = score.document_only_index ?? 0;
  const est = score.estimated_with_official_plan ?? score.approval_index ?? 0;
  const meets = score.meets_expediente_threshold;
  const gray = resolveTheme('gray');
  const blue = resolveTheme('blue');

  return (
    <div className={`cedit-fade-in ${className}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1">
        <span className="material-symbols-outlined text-sm text-blue-800">analytics</span>
        {t('mef.title')}
      </p>

      {/* Mini cuadros de porcentaje */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div
          className={`rounded-xl border-2 ${gray.statBorder} ${gray.statBg} p-4 text-center shadow-sm min-h-[88px] flex flex-col justify-center`}
        >
          <p className={`text-3xl font-bold tabular-nums ${gray.stat}`}>{doc}%</p>
          <p className="text-[11px] text-slate-600 font-semibold mt-1 leading-tight">{t('mef.currentDoc')}</p>
        </div>
        <div
          className={`rounded-xl border-2 ${meets ? blue.statBorder : 'border-blue-200'} ${blue.statBg} p-4 text-center shadow-sm min-h-[88px] flex flex-col justify-center ${meets ? 'ring-1 ring-blue-300' : ''}`}
        >
          <p className={`text-3xl font-bold tabular-nums ${blue.stat}`}>{est}%</p>
          <p className="text-[11px] text-blue-800 font-semibold mt-1 leading-tight">{t('mef.withPlan')}</p>
        </div>
      </div>

      {meets && (
        <p className="text-[10px] text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-3 text-center font-medium">
          {t('mef.meetsThreshold')}
        </p>
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
          <p className="text-xs font-semibold text-blue-900 mb-1">{t('mef.missing')}</p>
          <ul className="text-xs text-slate-700 list-disc pl-4 space-y-0.5">
            {score.missing_points.slice(0, 5).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      {score.recommendations?.length > 0 && (
        <div className="p-3 rounded-xl border border-blue-100 bg-blue-50/50">
          <p className="text-xs font-semibold text-blue-900 mb-1">{t('mef.recommend')}</p>
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
