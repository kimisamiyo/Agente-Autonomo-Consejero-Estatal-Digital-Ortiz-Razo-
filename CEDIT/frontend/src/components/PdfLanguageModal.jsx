import React from 'react';
import { useI18n } from '../i18n/I18nContext';

const PdfLanguageModal = ({ isOpen, uiLocale, onClose, onConfirm }) => {
  const { t } = useI18n();
  if (!isOpen || uiLocale === 'es') return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 p-6 cedit-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-slate-800 mb-2">{t('pdfLang.title')}</h3>
        <p className="text-sm text-slate-600 mb-4">{t('pdfLang.desc')}</p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => onConfirm('es')}
            className="w-full py-3 px-4 rounded-xl bg-slate-800 text-white text-sm font-bold hover:bg-slate-900"
          >
            {t('pdfLang.es')}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(uiLocale)}
            className="w-full py-3 px-4 rounded-xl border border-slate-200 text-slate-800 text-sm font-semibold hover:bg-slate-50"
          >
            {t(`locale.${uiLocale}`)}
          </button>
          <button type="button" onClick={onClose} className="text-xs text-slate-500 mt-2 hover:text-slate-800">
            {t('pdfLang.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PdfLanguageModal;
