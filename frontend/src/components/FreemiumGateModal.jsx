import React from 'react';
import { useI18n } from '../i18n/I18nContext';
import {
  ceditBtnPrimaryClass,
  ceditBtnSecondaryClass,
  ceditCardClass,
  ceditIconBoxClass,
} from '../theme/ceditPalette';

const FreemiumGateModal = ({
  mode = 'limit',
  isOpen,
  onClose,
  onConfirmReset,
  onRequestReset,
  onConnectWallet,
  auditCount = 0,
  limit = 10,
}) => {
  const { t } = useI18n();
  if (!isOpen) return null;

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose?.();
  };

  const titles = {
    limit: t('gate.limitTitle'),
    reset: t('gate.resetTitle'),
    maxChats: t('gate.maxChatsTitle'),
  };

  const headerIcon =
    mode === 'reset' ? 'psychology_alt' : mode === 'maxChats' ? 'forum' : 'lock';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm cedit-fade-in"
      onClick={handleBackdrop}
      role="presentation"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200/90 overflow-hidden"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50/80 px-6 py-4 flex items-center gap-3 border-b border-slate-200/80">
          <div className={ceditIconBoxClass('blue', 'w-11 h-11')}>
            <span className="material-symbols-outlined text-white text-xl">{headerIcon}</span>
          </div>
          <div>
            <h2 className="text-slate-800 font-bold text-lg">{titles[mode] || titles.limit}</h2>
            <p className="text-slate-500 text-xs">{t('app.subtitle')}</p>
          </div>
        </div>

        <div className="px-6 py-5 text-slate-700 text-sm leading-relaxed space-y-3 bg-gradient-to-b from-slate-50/90 to-white">
          {mode === 'limit' && (
            <>
              <p>{t('gate.limitBody', { count: auditCount, limit })}</p>
              <ul className="list-disc pl-5 space-y-1 text-slate-600">
                <li>
                  <strong className="text-slate-800">{t('gate.limitWallet')}</strong>
                </li>
                <li>
                  <strong className="text-slate-800">{t('gate.limitReset')}</strong>
                </li>
              </ul>
              <p className={`text-xs px-3 py-2 ${ceditCardClass('gray')}`}>{t('gate.limitWarn')}</p>
            </>
          )}

          {mode === 'reset' && (
            <>
              <p className="text-slate-700">{t('gate.resetBody', { count: auditCount, limit })}</p>
              <p className="text-slate-600">{t('gate.resetBody2')}</p>
              <p className={`text-xs text-slate-600 ${ceditCardClass('gray')}`}>
                {t('gate.resetHint')}
              </p>
            </>
          )}

          {mode === 'maxChats' && <p className="text-slate-700">{t('gate.maxChatsBody')}</p>}
        </div>

        <div className="px-6 pb-6 flex flex-col gap-2 bg-slate-50/50 border-t border-slate-100">
          {mode === 'limit' && (
            <>
              <button
                type="button"
                onClick={onConnectWallet}
                className={`w-full ${ceditBtnPrimaryClass('blue')}`}
              >
                <span className="material-symbols-outlined text-base">account_balance_wallet</span>
                {t('gate.connectWallet')}
              </button>
              <button
                type="button"
                onClick={onRequestReset || onConfirmReset}
                className={`w-full ${ceditBtnSecondaryClass()}`}
              >
                {t('nav.resetMemory')}
              </button>
              <button type="button" onClick={onClose} className={`w-full ${ceditBtnSecondaryClass()} text-slate-500`}>
                {t('gate.closeReappear')}
              </button>
            </>
          )}

          {mode === 'reset' && (
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <button type="button" onClick={onClose} className={ceditBtnSecondaryClass()}>
                {t('gate.cancel')}
              </button>
              <button type="button" onClick={onConfirmReset} className={ceditBtnPrimaryClass('blue')}>
                {t('gate.confirmReset')}
              </button>
            </div>
          )}

          {mode === 'maxChats' && (
            <div className="flex flex-col gap-2">
              <button type="button" onClick={onClose} className={ceditBtnSecondaryClass()}>
                {t('gate.understood')}
              </button>
              <button
                type="button"
                onClick={onRequestReset || onConfirmReset}
                className={ceditBtnPrimaryClass('blue')}
              >
                {t('nav.resetMemory')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FreemiumGateModal;
