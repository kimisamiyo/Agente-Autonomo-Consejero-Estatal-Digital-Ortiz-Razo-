import React from 'react';
import { NORMATIVAS_ITEMS } from '../data/normativasCatalog';
import { useI18n } from '../i18n/I18nContext';
import { ceditBtnPrimaryClass, ceditCardClass, ceditIconBoxClass } from '../theme/ceditPalette';

const NormativasView = ({ onConsultNormativa }) => {
  const { t } = useI18n();

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 w-full">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 cedit-fade-in">
          <div className="flex items-center gap-3 mb-3">
            <div className={ceditIconBoxClass('steel', 'w-12 h-12')}>
              <span className="material-symbols-outlined text-white text-2xl" style={{ fontVariationSettings: '"FILL" 1' }}>
                menu_book
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--cedit-text)]">{t('norms.title')}</h1>
              <p className="text-sm text-[var(--cedit-text-muted)] mt-1">{t('norms.subtitle')}</p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
          {NORMATIVAS_ITEMS.map((item) => {
            const prefix = item.i18nPrefix;
            return (
              <article
                key={item.id}
                className={`p-5 hover:shadow-md transition-shadow flex flex-col h-full min-h-0 ${ceditCardClass(item.theme)}`}
              >
                <div className="flex items-center gap-3 mb-3 min-h-[2.75rem]">
                  <div className={ceditIconBoxClass(item.theme, 'w-11 h-11')}>
                    <span className="material-symbols-outlined text-white text-xl">{item.icon}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-bold text-[var(--cedit-text)] text-base leading-snug line-clamp-2 min-h-[2.5rem]">
                      {t(`${prefix}.title`)}
                    </h2>
                    <p className="text-[10px] uppercase tracking-wide text-[var(--cedit-text-faint)] mt-1 font-semibold truncate">
                      {item.officialHost}
                    </p>
                  </div>
                </div>

                <p className="text-sm text-[var(--cedit-text-muted)] leading-relaxed mb-4 min-h-[4.5rem]">
                  {t(`${prefix}.desc`)}
                </p>

                <ul className="text-xs text-[var(--cedit-text-muted)] space-y-1 mb-4 list-disc pl-4 flex-1 min-h-[4.5rem]">
                  {(t(`${prefix}.bullets`) || '')
                    .split('|')
                    .filter(Boolean)
                    .map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                </ul>

                <div className="flex flex-col gap-2 mt-auto pt-1">
                  <a
                    href={item.officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-[var(--cedit-border)] bg-[var(--cedit-surface)] text-[var(--cedit-text)] text-xs font-semibold hover:bg-[var(--cedit-surface-2)] transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">open_in_new</span>
                    {t('norms.officialLink')}
                  </a>
                  <button
                    type="button"
                    onClick={() => onConsultNormativa?.(t(`${prefix}.prompt`))}
                    className={`w-full ${ceditBtnPrimaryClass(item.theme === 'blue' ? 'steel' : item.theme)}`}
                  >
                    <span className="material-symbols-outlined text-sm">forum</span>
                    {t('norms.askCedit')}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default NormativasView;
