import React, { useMemo, useState } from 'react';
import { NORMATIVAS_ITEMS } from '../data/normativasCatalog';
import { useI18n } from '../i18n/I18nContext';
import { ceditBtnPrimaryClass, ceditCardClass, ceditIconBoxClass } from '../theme/ceditPalette';

const NormativasView = ({ onConsultNormativa }) => {
  const { t } = useI18n();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NORMATIVAS_ITEMS;
    return NORMATIVAS_ITEMS.filter((item) => {
      const prefix = item.i18nPrefix;
      const hay = [
        t(`${prefix}.title`),
        t(`${prefix}.desc`),
        t(`${prefix}.bullets`),
        item.officialHost,
        item.id,
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [query, t]);

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 w-full">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 cedit-fade-in">
          <div className="flex items-center gap-3 mb-3">
            <div className={ceditIconBoxClass('steel', 'w-12 h-12')}>
              <span className="material-symbols-outlined text-white text-2xl" style={{ fontVariationSettings: '"FILL" 1' }}>
                search
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--cedit-text)]">{t('norms.title')}</h1>
              <p className="text-sm text-[var(--cedit-text-muted)] mt-1">{t('norms.subtitle')}</p>
            </div>
          </div>
          <p className={`text-xs text-[var(--cedit-text-muted)] px-4 py-3 mb-4 ${ceditCardClass('gray')}`}>
            {t('norms.disclaimer')}
          </p>
          <label className="cedit-field">
            <span className="cedit-field-label">{t('norms.searchLabel')}</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('norms.searchPlaceholder')}
              className="bg-transparent border-0 outline-none text-sm text-[var(--cedit-text)] placeholder:text-[var(--cedit-text-faint)]"
            />
          </label>
        </header>

        {filtered.length === 0 ? (
          <div className={`p-8 text-center ${ceditCardClass('gray')}`}>
            <span className="material-symbols-outlined text-3xl text-[var(--cedit-text-faint)] mb-2">search_off</span>
            <p className="text-sm text-[var(--cedit-text-muted)]">{t('norms.emptySearch')}</p>
            <button type="button" className="cedit-chip is-on mt-3" onClick={() => setQuery('')}>
              {t('norms.clearSearch')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filtered.map((item, idx) => {
              const prefix = item.i18nPrefix;
              return (
                <article
                  key={item.id}
                  className={`p-5 hover:shadow-md transition-shadow cedit-fade-in ${ceditCardClass(item.theme)}`}
                  style={{ animationDelay: `${idx * 60}ms` }}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className={ceditIconBoxClass(item.theme, 'w-11 h-11')}>
                      <span className="material-symbols-outlined text-white text-xl">{item.icon}</span>
                    </div>
                    <div className="min-w-0">
                      <h2 className="font-bold text-[var(--cedit-text)] text-base leading-tight">{t(`${prefix}.title`)}</h2>
                      <p className="text-[10px] uppercase tracking-wide text-[var(--cedit-text-faint)] mt-1 font-semibold">
                        {item.officialHost}
                      </p>
                    </div>
                  </div>

                  <p className="text-sm text-[var(--cedit-text-muted)] leading-relaxed mb-4">{t(`${prefix}.desc`)}</p>

                  <ul className="text-xs text-[var(--cedit-text-muted)] space-y-1 mb-4 list-disc pl-4">
                    {(t(`${prefix}.bullets`) || '')
                      .split('|')
                      .filter(Boolean)
                      .map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                  </ul>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <a
                      href={item.officialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-[var(--cedit-border)] bg-[var(--cedit-surface)] text-[var(--cedit-text)] text-xs font-semibold hover:bg-[var(--cedit-surface-2)] transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">open_in_new</span>
                      {t('norms.officialLink')}
                    </a>
                    <button
                      type="button"
                      onClick={() => onConsultNormativa?.(t(`${prefix}.prompt`))}
                      className={`flex-1 ${ceditBtnPrimaryClass(item.theme === 'blue' ? 'steel' : item.theme)}`}
                    >
                      <span className="material-symbols-outlined text-sm">forum</span>
                      {t('norms.askCedit')}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default NormativasView;
