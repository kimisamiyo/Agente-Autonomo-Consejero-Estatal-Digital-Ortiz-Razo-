import React from 'react';
import { useI18n } from '../i18n/I18nContext';
import {
  ceditIconBoxClass,
  ceditSectionTitleClass,
  ceditCardClass,
} from '../theme/ceditPalette';

const FAQ = [
  { qKey: 'support.faq1q', aKey: 'support.faq1a', icon: 'assured_workload' },
  { qKey: 'support.faq2q', aKey: 'support.faq2a', icon: 'translate' },
  { qKey: 'support.faq3q', aKey: 'support.faq3a', icon: 'picture_as_pdf' },
  { qKey: 'support.faq4q', aKey: 'support.faq4a', icon: 'workspace_premium' },
];

const OFFICIAL = [
  {
    href: 'https://www.invierte.pe/',
    labelKey: 'support.offInvierte',
    icon: 'account_balance',
  },
  {
    href: 'https://www.gob.pe/mef',
    labelKey: 'support.offMef',
    icon: 'domain',
  },
  {
    href: 'https://www.gob.pe/institucion/mef/normas-legales',
    labelKey: 'support.offNorms',
    icon: 'library_books',
  },
];

const SupportView = () => {
  const { t } = useI18n();

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 w-full">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 cedit-fade-in">
          <div className="flex items-center gap-3 mb-3">
            <div className={ceditIconBoxClass('steel', 'w-12 h-12')}>
              <span
                className="material-symbols-outlined text-white text-2xl"
                style={{ fontVariationSettings: '"FILL" 1' }}
              >
                support_agent
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--cedit-text)]">{t('support.title')}</h1>
              <p className="text-sm text-[var(--cedit-text-muted)] mt-1">{t('support.subtitle')}</p>
            </div>
          </div>
        </header>

        <section className="cedit-fade-in mb-10">
          <h2 className={ceditSectionTitleClass()}>
            <span className="material-symbols-outlined text-base text-[var(--cedit-steel)]">help</span>
            {t('support.faq')}
            <span className="flex-1 h-px bg-gradient-to-r from-slate-200 dark:from-slate-600 to-transparent" />
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {FAQ.map((item) => (
              <details
                key={item.qKey}
                className={`group h-full open:border-[var(--cedit-border)] dark:open:border-[color-mix(in_srgb,var(--cedit-steel)_30%,var(--cedit-border))] transition-all ${ceditCardClass('gray')}`}
              >
                <summary className="flex items-center gap-3 px-4 py-3.5 cursor-pointer list-none">
                  <span className="w-9 h-9 rounded-lg bg-[var(--cedit-steel-soft)] text-[var(--cedit-steel)] flex items-center justify-center shrink-0 group-open:bg-gradient-to-br group-open:from-slate-600 group-open:to-slate-900 group-open:text-white transition-colors">
                    <span className="material-symbols-outlined text-lg">{item.icon}</span>
                  </span>
                  <span className="flex-1 text-sm font-semibold text-[var(--cedit-text)]">
                    {t(item.qKey)}
                  </span>
                  <span className="material-symbols-outlined text-[var(--cedit-text-faint)] text-lg group-open:rotate-180 transition-transform">
                    expand_more
                  </span>
                </summary>
                <p className="px-4 pb-4 pl-[3.75rem] text-sm text-[var(--cedit-text-muted)] leading-relaxed">
                  {t(item.aKey)}
                </p>
              </details>
            ))}
          </div>
        </section>

        <section className="cedit-fade-in mb-10">
          <h2 className={ceditSectionTitleClass()}>
            <span className="material-symbols-outlined text-base text-[var(--cedit-steel)]">
              account_balance
            </span>
            {t('support.official')}
            <span className="flex-1 h-px bg-gradient-to-r from-slate-200 dark:from-slate-600 to-transparent" />
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
            {OFFICIAL.map((item) => (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className={`p-5 flex flex-col h-full hover:shadow-md transition-shadow ${ceditCardClass('gray')}`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={ceditIconBoxClass('steel', 'w-11 h-11')}>
                    <span className="material-symbols-outlined text-white text-xl">{item.icon}</span>
                  </div>
                  <p className="font-bold text-[var(--cedit-text)] text-base leading-snug flex-1 min-w-0">
                    {t(item.labelKey)}
                  </p>
                </div>
                <span className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-[var(--cedit-steel)]">
                  <span className="material-symbols-outlined text-sm">open_in_new</span>
                  {t('norms.officialLink')}
                </span>
              </a>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default SupportView;
