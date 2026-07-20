import React from 'react';
import { useI18n } from '../i18n/I18nContext';

/**
 * Bienvenida — tarjetas de acceso rápido.
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

const WelcomeConstellation = ({ onSendMessage, onPickPdf }) => {
  const { t } = useI18n();

  return (
    <div className="cedit-welcome-hero flex flex-col items-center text-center mt-6 sm:mt-10 w-full">
      <div className="cedit-constellation">
        {INTENTS.map((intent, i) => (
          <button
            key={intent.id}
            type="button"
            className="cedit-intent-card cedit-intent-card-live cedit-fade-in"
            style={{ animationDelay: `${i * 0.08}s` }}
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
    </div>
  );
};

export default WelcomeConstellation;
