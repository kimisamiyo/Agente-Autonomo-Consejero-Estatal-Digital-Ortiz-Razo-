import React from 'react';
import { useI18n } from '../i18n/I18nContext';
import { ceditBtnPrimaryClass, ceditBtnSecondaryClass, ceditCardClass, ceditIconBoxClass } from '../theme/ceditPalette';

/**
 * Modal legado de reinicio — misma hoja tokenizada que FreemiumGateModal.
 */
const ResetMemoryModal = ({ isOpen, onClose, onConfirm, auditCount = 0, limit = 10 }) => {
  const { t } = useI18n();
  if (!isOpen) return null;

  return (
    <div
      className="cedit-overlay flex items-center justify-center p-4 z-[100]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      role="presentation"
    >
      <div
        className="cedit-modal-sheet w-full max-w-md"
        role="dialog"
        aria-labelledby="reset-memory-title"
        aria-modal="true"
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
            <span className="material-symbols-outlined text-white text-xl">psychology_alt</span>
          </div>
          <div>
            <h2
              id="reset-memory-title"
              className="font-bold text-lg tracking-tight"
              style={{ color: 'var(--cedit-text)' }}
            >
              {t('gate.resetTitle')}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--cedit-text-muted)' }}>
              {t('app.subtitle')}
            </p>
          </div>
        </div>

        <div className="px-6 py-5 text-sm leading-relaxed space-y-3 cedit-readable" style={{ background: 'var(--cedit-surface)' }}>
          <p style={{ color: 'var(--cedit-text)' }}>
            {t('gate.resetBody', { count: auditCount, limit })}
          </p>
          <p style={{ color: 'var(--cedit-text-muted)' }}>{t('gate.resetBody2')}</p>
          <p className={`text-xs px-3 py-2.5 ${ceditCardClass('gray')}`} style={{ color: 'var(--cedit-text-muted)' }}>
            {t('gate.resetHint')}
          </p>
        </div>

        <div
          className="px-6 py-4 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end border-t border-[var(--cedit-border)]"
          style={{ background: 'var(--cedit-surface-2)' }}
        >
          <button type="button" onClick={onClose} className={ceditBtnSecondaryClass()}>
            {t('gate.cancel')}
          </button>
          <button type="button" onClick={onConfirm} className={ceditBtnPrimaryClass('steel')}>
            {t('gate.confirmReset')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResetMemoryModal;
