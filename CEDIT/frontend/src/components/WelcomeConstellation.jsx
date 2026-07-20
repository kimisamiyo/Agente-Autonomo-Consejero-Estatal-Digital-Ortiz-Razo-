import React from 'react';
import { useI18n } from '../i18n/I18nContext';
import NetworksLinks from './NetworksLinks';

/**
 * Bienvenida — núcleo clásico con movimiento suave (icono, anillos, tarjetas).
 */
const INTENTS = [
  {
    id: 'public',
    icon: 'account_balance',
    titleKey: 'chat.card.public',
    descKey: 'chat.card.publicDesc',
    promptKey: 'chat.prompt.invierte',
    tone: 'deep',
  },
  {
    id: 'audit',
    icon: 'fact_check',
    titleKey: 'chat.card.audit',
    descKey: 'chat.card.auditDesc',
    action: 'pdf',
    tone: 'primary',
  },
  {
    id: 'citizen',
    icon: 'diversity_3',
    titleKey: 'chat.card.citizen',
    descKey: 'chat.card.citizenDesc',
    promptKey: 'chat.prompt.citizen',
    tone: 'soft',
  },
  {
    id: 'concepts',
    icon: 'menu_book',
    titleKey: 'chat.card.concepts',
    descKey: 'chat.card.conceptsDesc',
    promptKey: 'chat.prompt.concepts',
    tone: 'soft',
  },
];

const WelcomeConstellation = ({ onSendMessage, onPickPdf, onOpenCmdk }) => {
  const { t } = useI18n();

  return (
    <div className="cedit-welcome-hero flex flex-col items-center text-center mt-6 sm:mt-10 w-full">
      <div className="cedit-welcome-mark relative mb-7 cedit-scale-in">
        <div className="cedit-welcome-aura" aria-hidden />
        <div className="cedit-welcome-ring" aria-hidden />
        <div className="cedit-welcome-ring cedit-welcome-ring-delayed" aria-hidden />
        <span className="cedit-welcome-spark cedit-welcome-spark-a" aria-hidden />
        <span className="cedit-welcome-spark cedit-welcome-spark-b" aria-hidden />
        <span className="cedit-welcome-spark cedit-welcome-spark-c" aria-hidden />
        <div className="cedit-welcome-icon cedit-float relative w-[4.5rem] h-[4.5rem] rounded-[1.35rem] bg-gradient-to-br from-slate-500 via-slate-700 to-slate-900 flex items-center justify-center shadow-xl shadow-slate-900/30">
          <span
            className="material-symbols-outlined text-white text-4xl"
            style={{ fontVariationSettings: '"FILL" 1' }}
          >
            assured_workload
          </span>
        </div>
      </div>

      <p
        className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--cedit-steel)] mb-2 cedit-fade-in"
        style={{ animationDelay: '0.08s' }}
      >
        {t('app.digitalGov')}
      </p>
      <h2
        className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--cedit-text)] mb-2 cedit-fade-in"
        style={{ animationDelay: '0.14s' }}
      >
        {t('chat.welcomeTitle')}
      </h2>
      <p
        className="text-sm font-medium text-[var(--cedit-text-muted)] mb-3 cedit-fade-in"
        style={{ animationDelay: '0.2s' }}
      >
        {t('app.subtitle')}
      </p>
      <p
        className="cedit-readable text-[15px] leading-relaxed text-[var(--cedit-text)] max-w-2xl mb-2 cedit-fade-in"
        style={{ animationDelay: '0.26s' }}
      >
        {t('chat.welcomeRole')}
      </p>
      <p
        className="cedit-readable text-sm text-[var(--cedit-text-muted)] max-w-2xl mb-10 leading-relaxed cedit-fade-in"
        style={{ animationDelay: '0.32s' }}
      >
        {t('chat.welcomeHint')}
      </p>

      <div className="cedit-constellation mb-8">
        {INTENTS.map((intent, i) => (
          <button
            key={intent.id}
            type="button"
            className="cedit-intent-card cedit-intent-card-live cedit-fade-in"
            style={{ animationDelay: `${0.38 + i * 0.08}s` }}
            onClick={() => {
              if (intent.action === 'pdf') onPickPdf?.();
              else if (intent.promptKey) onSendMessage?.(t(intent.promptKey));
            }}
          >
            <div className="relative flex items-start gap-3">
              <div
                className={`cedit-intent-icon w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-md ${
                  intent.tone === 'primary'
                    ? 'bg-gradient-to-br from-slate-600 to-slate-900 text-white'
                    : intent.tone === 'deep'
                      ? 'bg-gradient-to-br from-slate-700 to-slate-950 text-white'
                      : 'bg-[var(--cedit-surface-2)] text-[var(--cedit-steel)] border border-[var(--cedit-border)]'
                }`}
              >
                <span className="material-symbols-outlined text-[22px]">{intent.icon}</span>
              </div>
              <div className="min-w-0 text-left flex-1">
                <h3 className="text-sm font-bold text-[var(--cedit-text)] mb-1">{t(intent.titleKey)}</h3>
                <p className="text-[13px] text-[var(--cedit-text-muted)] leading-snug">{t(intent.descKey)}</p>
              </div>
              <span className="cedit-intent-arrow material-symbols-outlined text-[var(--cedit-text-faint)] text-lg ml-auto mt-1">
                arrow_forward
              </span>
            </div>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onOpenCmdk}
        className="cedit-welcome-cmdk mb-8 inline-flex items-center gap-2 text-xs font-semibold text-[var(--cedit-text-muted)] border border-[var(--cedit-border)] rounded-full px-3.5 py-2 hover:border-[var(--cedit-steel)] hover:text-[var(--cedit-steel)] transition-colors bg-[var(--cedit-surface)] cedit-fade-in"
        style={{ animationDelay: '0.72s' }}
      >
        <span className="material-symbols-outlined text-base cedit-welcome-cmdk-icon">terminal</span>
        {t('jewel.welcome.cmdHint')}
        <kbd className="text-[10px] border border-[var(--cedit-border)] rounded px-1.5 py-0.5 font-bold">⌘K</kbd>
      </button>

      <div className="w-full max-w-2xl cedit-fade-in" style={{ animationDelay: '0.8s' }}>
        <NetworksLinks layout="welcome" />
      </div>
    </div>
  );
};

export default WelcomeConstellation;
