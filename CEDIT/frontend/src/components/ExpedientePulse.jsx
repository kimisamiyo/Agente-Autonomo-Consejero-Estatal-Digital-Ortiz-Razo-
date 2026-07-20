import React from 'react';
import { useI18n } from '../i18n/I18nContext';

/**
 * Joya 2 — Pulso del expediente (cinta viva de fase + %)
 */
const ExpedientePulse = ({
  phase = '',
  pct = 0,
  mentorLine = '',
  onOpenBriefing,
  visible = false,
}) => {
  const { t } = useI18n();
  if (!visible) return null;

  return (
    <div className="w-full flex justify-center px-3 sm:px-5 py-2">
      <button
        type="button"
        onClick={onOpenBriefing}
        className="cedit-pulse-ribbon max-w-[850px] w-full text-left hover:border-[color-mix(in_srgb,var(--cedit-primary)_40%,var(--cedit-border))] transition-colors"
        title={t('jewel.pulse.openBrief')}
      >
        <span className="cedit-pulse-orb shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--cedit-text-faint)]">
              {t('jewel.pulse.label')}
            </span>
            {phase && (
              <span className="text-[11px] font-bold text-[var(--cedit-primary)] truncate">{phase}</span>
            )}
            <span className="text-[11px] font-bold tabular-nums text-[var(--cedit-text)] ml-auto">
              {Math.round(pct)}%
            </span>
          </div>
          {mentorLine && (
            <p className="text-[11px] text-[var(--cedit-text-muted)] truncate mt-0.5">{mentorLine}</p>
          )}
          <div className="mt-1.5 h-1 rounded-full overflow-hidden bg-[var(--cedit-surface-2)]">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(100, Math.max(0, pct))}%`,
                background: 'linear-gradient(90deg, var(--cedit-primary), var(--cedit-primary-deep))',
              }}
            />
          </div>
        </div>
        <span className="material-symbols-outlined text-[var(--cedit-primary)] text-lg shrink-0">
          auto_awesome
        </span>
      </button>
    </div>
  );
};

export default ExpedientePulse;
