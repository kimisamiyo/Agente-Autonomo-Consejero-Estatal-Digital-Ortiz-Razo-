import React from 'react';
import { useI18n } from '../i18n/I18nContext';

/**
 * Botón flotante único — Briefing del mentor
 */
const JewelFab = ({ onOpenBriefing, hidden }) => {
  const { t } = useI18n();
  if (hidden) return null;

  return (
    <div className="cedit-jewel-fab md:bottom-6 md:right-6">
      <button
        type="button"
        onClick={onOpenBriefing}
        title={t('jewel.cmd.briefing')}
        aria-label={t('jewel.cmd.briefing')}
      >
        <span className="material-symbols-outlined">auto_awesome</span>
      </button>
    </div>
  );
};

export default JewelFab;
