import React from 'react';
import { useI18n } from '../i18n/I18nContext';
import {
  ceditBtnPrimaryClass,
  ceditBtnSecondaryClass,
  ceditCardClass,
  ceditIconBoxClass,
} from '../theme/ceditPalette';

/**
 * Modal freemium / reinicio / max chats — superficie 100% tokens CEDIT
 * (legible en claro y oscuro, sin azul chillón).
 */
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
      className="cedit-overlay flex items-center justify-center p-4 z-[100]"
      onClick={handleBackdrop}
      role="presentation"
    >
      <div
        className="cedit-modal-sheet w-full max-w-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cedit-gate-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-6 py-4 flex items-center gap-3 border-b border-[var(--cedit-border)]"
          style={{
            background:
              'linear-gradient(135deg, color-mix(in srgb, var(--cedit-steel) 14%, var(--cedit-surface)), var(--cedit-surface) 70%)',
          }}
        >
          <div className={ceditIconBoxClass('steel', 'w-11 h-11')}>
            <span className="material-symbols-outlined text-white text-xl">{headerIcon}</span>
          </div>
          <div className="min-w-0">
            <h2
              id="cedit-gate-title"
              className="font-bold text-lg tracking-tight"
              style={{ color: 'var(--cedit-text)' }}
            >
              {titles[mode] || titles.limit}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--cedit-text-muted)' }}>
              {t('app.subtitle')}
            </p>
          </div>
        </div>

        <div
          className="px-6 py-5 text-sm leading-relaxed space-y-3 cedit-readable overflow-y-auto"
          style={{ color: 'var(--cedit-text)', background: 'var(--cedit-surface)' }}
        >
          {mode === 'limit' && (
            <>
              <p style={{ color: 'var(--cedit-text)' }}>
                {t('gate.limitBody', { count: auditCount, limit })}
              </p>
              <ul className="list-disc pl-5 space-y-1.5" style={{ color: 'var(--cedit-text-muted)' }}>
                <li>
                  <strong style={{ color: 'var(--cedit-text)' }}>{t('gate.limitWallet')}</strong>
                </li>
                <li>
                  <strong style={{ color: 'var(--cedit-text)' }}>{t('gate.limitReset')}</strong>
                </li>
              </ul>
              <p className={`text-xs px-3 py-2 ${ceditCardClass('steel')}`} style={{ color: 'var(--cedit-text-muted)' }}>
                {t('gate.limitWarn')}
              </p>
            </>
          )}

          {mode === 'reset' && (
            <>
              <p style={{ color: 'var(--cedit-text)' }}>
                {t('gate.resetBody', { count: auditCount, limit })}
              </p>
              <p style={{ color: 'var(--cedit-text-muted)' }}>{t('gate.resetBody2')}</p>
              <p className={`text-xs px-3 py-2.5 ${ceditCardClass('gray')}`} style={{ color: 'var(--cedit-text-muted)' }}>
                {t('gate.resetHint')}
              </p>
            </>
          )}

          {mode === 'maxChats' && (
            <p style={{ color: 'var(--cedit-text)' }}>{t('gate.maxChatsBody')}</p>
          )}
        </div>

        <div
          className="px-6 py-4 flex flex-col gap-2 border-t border-[var(--cedit-border)]"
          style={{ background: 'var(--cedit-surface-2)' }}
        >
          {mode === 'limit' && (
            <>
              <button
                type="button"
                onClick={onConnectWallet}
                className={`w-full ${ceditBtnPrimaryClass('steel')}`}
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
              <button type="button" onClick={onClose} className={`w-full ${ceditBtnSecondaryClass()}`}>
                {t('gate.closeReappear')}
              </button>
            </>
          )}

          {mode === 'reset' && (
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <button type="button" onClick={onClose} className={ceditBtnSecondaryClass()}>
                {t('gate.cancel')}
              </button>
              <button type="button" onClick={onConfirmReset} className={ceditBtnPrimaryClass('steel')}>
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
                className={ceditBtnPrimaryClass('steel')}
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
