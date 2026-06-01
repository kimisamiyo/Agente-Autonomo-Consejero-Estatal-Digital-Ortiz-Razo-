import React from 'react';
import { useI18n } from '../i18n/I18nContext';
import {
  DISCORD_BOT_INVITE,
  DISCORD_SERVER_INVITE,
  TELEGRAM_BOT_URL,
  WEB_APP_URL,
} from '../config/links';

const DiscordIcon = () => (
  <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
  </svg>
);

const TelegramIcon = () => (
  <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
  </svg>
);

const NetworksLinks = ({ layout = 'sidebar' }) => {
  const { t } = useI18n();
  const isCompact = layout === 'compact';

  const itemClass = isCompact
    ? 'inline-flex items-center gap-2 py-2 px-3 rounded-xl text-sm font-medium border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors'
    : 'flex items-center gap-3 py-2 px-3 rounded-lg text-slate-600 transition-colors border border-transparent w-full';

  const discordBotClass = isCompact
    ? `${itemClass} hover:border-[#5865F2] hover:text-[#5865F2]`
    : `${itemClass} hover:bg-[#5865F2] hover:text-white hover:border-[#5865F2] group`;
  const telegramClass = isCompact
    ? `${itemClass} hover:border-[#229ED9] hover:text-[#229ED9]`
    : `${itemClass} hover:bg-[#229ED9] hover:text-white hover:border-[#229ED9] group`;
  const serverClass = isCompact
    ? `${itemClass} hover:border-[#5865F2] hover:text-[#5865F2]`
    : `${itemClass} hover:bg-[#5865F2] hover:text-white hover:border-[#5865F2] group`;

  const wrapperClass = isCompact
    ? 'flex flex-wrap items-center justify-center gap-2'
    : 'space-y-2';

  return (
    <div>
      {!isCompact && (
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">
          {t('nav.integrations')}
        </p>
      )}
      <div className={wrapperClass}>
        <a className={discordBotClass} href={DISCORD_BOT_INVITE} target="_blank" rel="noreferrer">
          <DiscordIcon />
          <span className="text-sm font-medium">{t('nav.discordBot')}</span>
        </a>
        <a className={telegramClass} href={TELEGRAM_BOT_URL} target="_blank" rel="noreferrer">
          <TelegramIcon />
          <span className="text-sm font-medium">{t('nav.telegram')}</span>
        </a>
        <a className={serverClass} href={DISCORD_SERVER_INVITE} target="_blank" rel="noreferrer">
          <span
            className={`material-symbols-outlined text-[18px] shrink-0 ${
              isCompact ? 'text-[#5865F2]' : 'text-[#5865F2] group-hover:text-white'
            }`}
          >
            groups
          </span>
          <span className="text-sm font-medium">{t('nav.discordServer')}</span>
        </a>
      </div>
      {!isCompact && (
        WEB_APP_URL ? (
          <a
            className={`${itemClass} mt-2 hover:bg-slate-800 hover:text-white hover:border-slate-800`}
            href={WEB_APP_URL}
            target="_blank"
            rel="noreferrer"
          >
            <span className="material-symbols-outlined text-[18px] shrink-0">language</span>
            <span className="text-sm font-medium">{t('nav.webApp')}</span>
          </a>
        ) : (
          <p className="text-xs text-slate-400 mt-3 px-2">{t('nav.webComingSoon')}</p>
        )
      )}
    </div>
  );
};

export default NetworksLinks;
