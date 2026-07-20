import React from 'react';
import { useI18n } from '../i18n/I18nContext';
import { ceditBtnPrimaryClass, ceditBtnSecondaryClass } from '../theme/ceditPalette';

/**
 * Joya 3 — Briefing del mentor (popup solemne)
 */
const MentorBriefingModal = ({ open, onClose, guideGraph, mefScore, onFocusMentor }) => {
  const { t } = useI18n();
  if (!open) return null;

  const phase = guideGraph?.phase_name || '—';
  const pct = guideGraph?.completeness_pct ?? mefScore?.document_only_index ?? 0;
  const profile = guideGraph?.profile_completeness_pct ?? 0;
  const msg = guideGraph?.mentor_message || t('jewel.brief.fallback');
  const critical = (guideGraph?.critical_items || []).filter((i) => !i.collected).slice(0, 4);

  return (
    <div className="cedit-overlay flex items-center justify-center p-4" onClick={onClose} role="presentation">
      <div
        className="cedit-modal-sheet w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cedit-brief-title"
      >
        <div
          className="px-5 pt-5 pb-4 border-b border-[var(--cedit-border)]"
          style={{
            background:
              'linear-gradient(135deg, color-mix(in srgb, var(--cedit-primary) 16%, transparent), transparent 70%)',
          }}
        >
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl cedit-accent-steel flex items-center justify-center shadow-lg shrink-0">
              <span className="material-symbols-outlined text-white text-2xl" style={{ fontVariationSettings: '"FILL" 1' }}>
                auto_awesome
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--cedit-primary)] mb-1">
                {t('jewel.brief.eyebrow')}
              </p>
              <h2 id="cedit-brief-title" className="text-xl font-bold text-[var(--cedit-text)] tracking-tight">
                {t('jewel.brief.title')}
              </h2>
              <p className="text-sm text-[var(--cedit-text-muted)] mt-1">{t('jewel.brief.phase')}: <strong className="text-[var(--cedit-primary)]">{phase}</strong></p>
            </div>
            <button type="button" onClick={onClose} className="ml-auto text-[var(--cedit-text-faint)] hover:text-[var(--cedit-text)] p-1" aria-label="Cerrar">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        <div className="px-5 py-4 overflow-y-auto cedit-readable flex-1 space-y-4">
          <p className="text-sm leading-relaxed text-[var(--cedit-text)]">{msg}</p>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-[var(--cedit-border)] bg-[var(--cedit-surface-2)] p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--cedit-text-faint)]">{t('jewel.brief.expediente')}</p>
              <p className="text-2xl font-bold tabular-nums text-[var(--cedit-primary)] mt-1">{Math.round(pct)}%</p>
            </div>
            <div className="rounded-xl border border-[var(--cedit-border)] bg-[var(--cedit-surface-2)] p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--cedit-text-faint)]">{t('jewel.brief.profile')}</p>
              <p className="text-2xl font-bold tabular-nums text-[var(--cedit-text)] mt-1">{Math.round(profile)}%</p>
            </div>
          </div>

          {critical.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--cedit-text-muted)] mb-2">
                {t('jewel.brief.pending')}
              </p>
              <ul className="space-y-1.5">
                {critical.map((item) => (
                  <li
                    key={item.id}
                    className="text-sm flex items-start gap-2 text-[var(--cedit-text)] rounded-lg border border-[var(--cedit-border)] px-3 py-2 bg-[var(--cedit-surface)]"
                  >
                    <span className="material-symbols-outlined text-[var(--cedit-primary)] text-base mt-0.5">radio_button_unchecked</span>
                    <span>{item.label?.split('(')[0]?.trim() || item.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-[var(--cedit-border)] flex flex-wrap gap-2 justify-end">
          <button type="button" className={ceditBtnSecondaryClass()} onClick={onClose}>
            {t('jewel.brief.close')}
          </button>
          <button
            type="button"
            className={ceditBtnPrimaryClass('steel')}
            onClick={() => {
              onFocusMentor?.();
              onClose();
            }}
          >
            <span className="material-symbols-outlined text-sm">account_tree</span>
            {t('jewel.brief.openGraph')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MentorBriefingModal;
