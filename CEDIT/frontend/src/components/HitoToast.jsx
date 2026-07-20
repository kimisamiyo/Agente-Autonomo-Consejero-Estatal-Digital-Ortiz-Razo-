import React, { useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext';

/**
 * Joya 4 — Toast de hitos (fase / umbral MEF)
 */
const HitoToast = ({ hito, onDismiss }) => {
  const { t } = useI18n();

  useEffect(() => {
    if (!hito) return undefined;
    const id = window.setTimeout(() => onDismiss?.(), 4200);
    return () => window.clearTimeout(id);
  }, [hito, onDismiss]);

  if (!hito) return null;

  const title =
    hito.type === 'threshold'
      ? t('jewel.hito.thresholdTitle')
      : hito.type === 'phase'
        ? t('jewel.hito.phaseTitle', { phase: hito.phase || '' })
        : t('jewel.hito.genericTitle');

  const body =
    hito.type === 'threshold'
      ? t('jewel.hito.thresholdBody', { pct: hito.pct ?? 80 })
      : hito.message || t('jewel.hito.genericBody');

  return (
    <div className="cedit-hito-toast" role="status" aria-live="polite">
      <span className="material-symbols-outlined text-2xl shrink-0" style={{ fontVariationSettings: '"FILL" 1' }}>
        {hito.type === 'threshold' ? 'verified' : 'emoji_events'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold leading-snug">{title}</p>
        <p className="text-xs opacity-90 mt-0.5 leading-relaxed">{body}</p>
      </div>
      <button type="button" onClick={onDismiss} className="opacity-80 hover:opacity-100 p-0.5" aria-label="Cerrar">
        <span className="material-symbols-outlined text-lg">close</span>
      </button>
    </div>
  );
};

export default HitoToast;
