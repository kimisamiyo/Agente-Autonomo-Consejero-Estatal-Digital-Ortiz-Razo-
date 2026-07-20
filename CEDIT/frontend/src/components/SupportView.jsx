import React from 'react';
import { useI18n } from '../i18n/I18nContext';
import NetworksLinks from './NetworksLinks';
import {
  ceditIconBoxClass,
  ceditSectionTitleClass,
  ceditPanelClass,
} from '../theme/ceditPalette';
import {
  DISCORD_BOT_INVITE,
  TELEGRAM_BOT_URL,
} from '../config/links';

const FAQ = [
  { qKey: 'support.faq1q', aKey: 'support.faq1a', icon: 'assured_workload' },
  { qKey: 'support.faq2q', aKey: 'support.faq2a', icon: 'translate' },
  { qKey: 'support.faq3q', aKey: 'support.faq3a', icon: 'picture_as_pdf' },
  { qKey: 'support.faq4q', aKey: 'support.faq4a', icon: 'workspace_premium' },
];

const CHANNELS = [
  {
    key: 'web',
    icon: 'forum',
    titleKey: 'support.chWeb',
    descKey: 'support.chWebDesc',
    href: null,
    action: 'chat',
  },
  {
    key: 'discord',
    icon: 'smart_toy',
    titleKey: 'support.chDiscord',
    descKey: 'support.chDiscordDesc',
    href: DISCORD_BOT_INVITE,
  },
  {
    key: 'telegram',
    icon: 'send',
    titleKey: 'support.chTelegram',
    descKey: 'support.chTelegramDesc',
    href: TELEGRAM_BOT_URL,
  },
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

const SupportView = ({ onGoChat }) => {
  const { t } = useI18n();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="relative px-5 sm:px-8 py-8 sm:py-10 max-w-3xl mx-auto">
        <header className="cedit-fade-in flex items-start gap-4 mb-10">
          <div className={ceditIconBoxClass('steel', 'w-14 h-14')}>
            <span className="material-symbols-outlined text-white text-3xl">support_agent</span>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--cedit-steel)] mb-1">
              {t('app.subtitle')}
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
              {t('support.title')}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed max-w-xl">
              {t('support.subtitle')}
            </p>
          </div>
        </header>

        <section className="cedit-scale-in mb-10">
          <h2 className={ceditSectionTitleClass()}>
            <span className="material-symbols-outlined text-base text-[var(--cedit-steel)]">
              hub
            </span>
            {t('support.channels')}
            <span className="flex-1 h-px bg-gradient-to-r from-slate-200 dark:from-slate-600 to-transparent" />
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {CHANNELS.map((ch) => {
              const inner = (
                <>
                  <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-700/70 text-slate-600 dark:text-slate-200 flex items-center justify-center mb-3 group-hover:bg-gradient-to-br group-hover:from-slate-600 group-hover:to-slate-900 group-hover:text-white transition-all duration-300">
                    <span className="material-symbols-outlined text-xl">{ch.icon}</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-50 mb-1">
                    {t(ch.titleKey)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">
                    {t(ch.descKey)}
                  </p>
                </>
              );
              const cls =
                'group text-left p-4 rounded-2xl border border-slate-200/80 dark:border-slate-600/50 bg-white/90 dark:bg-slate-800/50 backdrop-blur-sm hover:border-[var(--cedit-border-strong)] dark:hover:border-[color-mix(in_srgb,var(--cedit-steel)_40%,var(--cedit-border))] transition-all duration-300 cedit-card-hover';
              if (ch.action === 'chat') {
                return (
                  <button key={ch.key} type="button" onClick={() => onGoChat?.()} className={cls}>
                    {inner}
                  </button>
                );
              }
              return (
                <a key={ch.key} href={ch.href} target="_blank" rel="noreferrer" className={cls}>
                  {inner}
                </a>
              );
            })}
          </div>
        </section>

        <section className="cedit-fade-in mb-10" style={{ animationDelay: '0.06s' }}>
          <h2 className={ceditSectionTitleClass()}>
            <span className="material-symbols-outlined text-base text-[var(--cedit-steel)]">
              help
            </span>
            {t('support.faq')}
            <span className="flex-1 h-px bg-gradient-to-r from-slate-200 dark:from-slate-600 to-transparent" />
          </h2>
          <div className="space-y-2.5">
            {FAQ.map((item) => (
              <details
                key={item.qKey}
                className="group rounded-2xl border border-slate-200/80 dark:border-slate-600/50 bg-white/95 dark:bg-slate-800/50 open:border-[var(--cedit-border)] dark:open:border-[color-mix(in_srgb,var(--cedit-steel)_30%,var(--cedit-border))] transition-all"
              >
                <summary className="flex items-center gap-3 px-4 py-3.5 cursor-pointer list-none">
                  <span className="w-9 h-9 rounded-lg bg-[var(--cedit-steel-soft)] dark:bg-[var(--cedit-steel-soft)]0/15 text-[var(--cedit-steel)] flex items-center justify-center shrink-0 group-open:bg-gradient-to-br group-open:from-slate-600 group-open:to-slate-900 group-open:text-white transition-colors">
                    <span className="material-symbols-outlined text-lg">{item.icon}</span>
                  </span>
                  <span className="flex-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {t(item.qKey)}
                  </span>
                  <span className="material-symbols-outlined text-slate-400 text-lg group-open:rotate-180 transition-transform">
                    expand_more
                  </span>
                </summary>
                <p className="px-4 pb-4 pl-[3.75rem] text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {t(item.aKey)}
                </p>
              </details>
            ))}
          </div>
        </section>

        <section className="cedit-fade-in mb-10" style={{ animationDelay: '0.1s' }}>
          <h2 className={ceditSectionTitleClass()}>
            <span className="material-symbols-outlined text-base text-[var(--cedit-steel)]">
              account_balance
            </span>
            {t('support.official')}
            <span className="flex-1 h-px bg-gradient-to-r from-slate-200 dark:from-slate-600 to-transparent" />
          </h2>
          <ul className="space-y-2">
            {OFFICIAL.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-slate-200/80 dark:border-slate-600/50 bg-white/90 dark:bg-slate-800/50 hover:bg-[var(--cedit-surface-2)] dark:hover:bg-[var(--cedit-steel-soft)]0/10 hover:border-[var(--cedit-border)] dark:hover:border-[color-mix(in_srgb,var(--cedit-steel)_30%,var(--cedit-border))] transition-colors"
                >
                  <span className="material-symbols-outlined text-[var(--cedit-steel)]">
                    {item.icon}
                  </span>
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    {t(item.labelKey)}
                  </span>
                  <span className="material-symbols-outlined text-slate-400 text-base ml-auto">
                    open_in_new
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className={`cedit-fade-in p-5 ${ceditPanelClass('!overflow-visible')}`}>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
            {t('nav.integrations')}
          </p>
          <NetworksLinks layout="compact" />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-4 leading-relaxed">
            {t('support.disclaimer')}
          </p>
        </section>
      </div>
    </div>
  );
};

export default SupportView;
