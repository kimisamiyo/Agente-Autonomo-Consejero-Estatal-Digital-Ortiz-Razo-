import React from 'react';
import { useI18n } from '../i18n/I18nContext';

/**
 * Joya 6 (complemento) — FAB de joyas: comandos / herramientas / atajos
 */
const JewelFab = ({ onOpenCmdk, onOpenTools, onOpenKeys, hidden }) => {
  const { t } = useI18n();
  if (hidden) return null;

  return (
    <div className="cedit-jewel-fab md:bottom-6 md:right-6">
      <button type="button" onClick={onOpenKeys} title={t('jewel.fab.keys')} aria-label={t('jewel.fab.keys')}>
        <span className="material-symbols-outlined">keyboard</span>
      </button>
      <button type="button" onClick={onOpenTools} title={t('jewel.fab.tools')} aria-label={t('jewel.fab.tools')}>
        <span className="material-symbols-outlined">construction</span>
      </button>
      <button type="button" onClick={onOpenCmdk} title={t('jewel.fab.cmd')} aria-label={t('jewel.fab.cmd')}>
        <span className="material-symbols-outlined">terminal</span>
      </button>
    </div>
  );
};

export default JewelFab;
