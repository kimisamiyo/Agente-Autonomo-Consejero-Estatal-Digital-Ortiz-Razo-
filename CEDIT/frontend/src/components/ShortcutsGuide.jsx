import React from 'react';
import { useI18n } from '../i18n/I18nContext';
import { ceditBtnPrimaryClass } from '../theme/ceditPalette';

const ROWS = [
  { keys: '⌘ K / Ctrl K', actionKey: 'jewel.keys.palette' },
  { keys: '⌘ /', actionKey: 'jewel.keys.this' },
  { keys: 'Enter', actionKey: 'jewel.keys.send' },
  { keys: 'Shift+Enter', actionKey: 'jewel.keys.newline' },
  { keys: 'Esc', actionKey: 'jewel.keys.esc' },
];

/**
 * Joya 8 — Guía de atajos y complementos
 */
const ShortcutsGuide = ({ open, onClose, onOpenCmdk }) => {
  const { t } = useI18n();
  if (!open) return null;

  return (
    <div className="cedit-overlay flex items-center justify-center p-4" onClick={onClose} role="presentation">
      <div
        className="cedit-modal-sheet w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cedit-keys-title"
      >
        <div className="px-5 pt-5 pb-3 border-b border-[var(--cedit-border)] flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl cedit-accent-steel text-white flex items-center justify-center">
            <span className="material-symbols-outlined">keyboard</span>
          </span>
          <div>
            <h2 id="cedit-keys-title" className="text-lg font-bold text-[var(--cedit-text)]">
              {t('jewel.keys.title')}
            </h2>
            <p className="text-xs text-[var(--cedit-text-muted)]">{t('jewel.keys.subtitle')}</p>
          </div>
          <button type="button" className="ml-auto p-1 text-[var(--cedit-text-faint)]" onClick={onClose} aria-label="Cerrar">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="px-5 py-4 space-y-2">
          {ROWS.map((row) => (
            <div
              key={row.actionKey}
              className="flex items-center justify-between gap-3 rounded-xl border border-[var(--cedit-border)] px-3.5 py-2.5 bg-[var(--cedit-surface-2)]"
            >
              <span className="text-sm text-[var(--cedit-text)]">{t(row.actionKey)}</span>
              <kbd className="text-[11px] font-bold tracking-wide text-[var(--cedit-primary)] border border-[var(--cedit-border)] bg-[var(--cedit-surface)] rounded-lg px-2 py-1 whitespace-nowrap">
                {row.keys}
              </kbd>
            </div>
          ))}
        </div>

        <div className="px-5 pb-5 flex justify-end gap-2">
          <button
            type="button"
            className={ceditBtnPrimaryClass('blue')}
            onClick={() => {
              onClose();
              onOpenCmdk?.();
            }}
          >
            <span className="material-symbols-outlined text-sm">terminal</span>
            {t('jewel.keys.openPalette')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShortcutsGuide;
