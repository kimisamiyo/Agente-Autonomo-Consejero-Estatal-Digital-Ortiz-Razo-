import React, { useMemo } from 'react';
import { listQualifiedExpedientes, MEF_THRESHOLD } from '../utils/expedientesStore';
import { useI18n } from '../i18n/I18nContext';
import { ceditCardClass, ceditIconBoxClass, ceditLabelClass } from '../theme/ceditPalette';

const ExpedientesView = () => {
  const { t } = useI18n();
  const items = useMemo(() => listQualifiedExpedientes(MEF_THRESHOLD), []);

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 max-w-3xl mx-auto w-full">
      <header className="flex items-center gap-3 mb-2">
        <div className={ceditIconBoxClass('blue', 'w-12 h-12')}>
          <span className="material-symbols-outlined text-white text-2xl">folder_open</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('expedientes.title')}</h1>
          <p className="text-sm text-slate-600 mt-1">{t('expedientes.desc', { threshold: MEF_THRESHOLD })}</p>
        </div>
      </header>

      <div className="mb-8" />

      {items.length === 0 ? (
        <div className={`p-8 text-center text-slate-500 text-sm border-dashed ${ceditCardClass('gray')}`}>
          {t('expedientes.empty', { threshold: MEF_THRESHOLD })}
        </div>
      ) : (
        <ul className="space-y-4">
          {items.map((exp) => (
            <li key={exp.id} className={`p-5 ${ceditCardClass('blue')} hover:shadow-md transition-shadow`}>
              <div className="flex justify-between items-start gap-4">
                <div className="flex gap-3 min-w-0">
                  <div className={ceditIconBoxClass('blue', 'w-10 h-10 shrink-0')}>
                    <span className="material-symbols-outlined text-white text-lg">description</span>
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-bold text-slate-800 truncate">{exp.title}</h2>
                    {exp.projectName && <p className="text-sm text-slate-600 mt-1">{exp.projectName}</p>}
                    <p className="text-xs text-slate-500 mt-2">
                      {new Date(exp.createdAt).toLocaleString('es-PE')}
                      {exp.pdfLanguage && exp.pdfLanguage !== 'es' ? ` · PDF: ${exp.pdfLanguage}` : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 rounded-xl border-2 border-blue-300 bg-blue-50 px-3 py-2 min-w-[72px]">
                  <p className="text-2xl font-bold text-blue-800 tabular-nums">{exp.score}%</p>
                  <p className={ceditLabelClass('blue')}>{t('expedientes.mefIndex')}</p>
                </div>
              </div>
              {exp.hash && (
                <p className="text-[10px] text-slate-400 mt-3 font-mono truncate pl-[52px]" title={exp.hash}>
                  Hash: {exp.hash}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ExpedientesView;
