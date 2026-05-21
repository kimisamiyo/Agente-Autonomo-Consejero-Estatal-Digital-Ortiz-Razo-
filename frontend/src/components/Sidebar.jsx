import React, { useMemo } from 'react';
import { useI18n } from '../i18n/I18nContext';

const DISCORD_BOT_INVITE =
  'https://discord.com/oauth2/authorize?client_id=1503228806406733844&permissions=2147601408&integration_type=0&scope=bot+applications.commands';
const DISCORD_SERVER_INVITE = 'https://discord.gg/QANgqeZuJU';
const TELEGRAM_LINK = 'https://t.me/placeholder';

const Sidebar = ({
  isOpen,
  toggleSidebar,
  recentChats = [],
  activeChatId,
  onSelectChat,
  onNewChat,
  onNavigateView,
  activeView = 'chat',
  onResetMemory,
  sessionMode = 'chat',
  usage = {},
  canCreateNewChat = true,
  isPremium = false,
}) => {
  const { t } = useI18n();

  const modeBadge = useMemo(() => {
    const map = {
      audit: { text: t('badge.auditActive'), className: 'bg-blue-100 text-blue-900' },
      plan: { text: t('badge.planMef'), className: 'bg-slate-100 text-slate-800' },
      freemium: { text: t('badge.limitReached'), className: 'bg-slate-200 text-slate-800' },
    };
    return map[sessionMode];
  }, [sessionMode, t]);

  const sharedLabel = !isPremium ? t('nav.shared') : '';

  const navLinkClass =
    'flex items-center gap-3 py-2.5 px-3 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors duration-200 w-full text-left';

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={toggleSidebar} />
      )}

      <aside
        className={`
        fixed md:relative top-0 left-0 h-screen w-72 
        bg-surface-container-lowest border-r border-border-gray 
        flex flex-col py-8 px-6 z-50 shadow-sm
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}
      >
        <button
          type="button"
          className="md:hidden absolute top-4 right-4 text-slate-500 hover:text-slate-800"
          onClick={toggleSidebar}
        >
          <span className="material-symbols-outlined">close</span>
        </button>

        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: '"FILL" 1' }}>
                assured_workload
              </span>
            </div>
            <div>
              <h1 className="text-headline-md font-headline-md font-bold text-slate-800 tracking-tight">CEDIT</h1>
              <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">{t('app.digitalGov')}</p>
              {modeBadge && (
                <span className={`inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${modeBadge.className}`}>
                  {modeBadge.text}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            disabled={!canCreateNewChat}
            onClick={() => {
              if (canCreateNewChat) onNewChat();
              if (window.innerWidth < 768) toggleSidebar();
            }}
            className="mt-8 w-full bg-slate-800 text-white py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-label-lg text-label-lg hover:bg-slate-900 transition-colors shadow-sm border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            {t('nav.newAnalysis')}
          </button>
          {!canCreateNewChat && !isPremium && (
            <p className="mt-1 text-[10px] text-center text-slate-500">{t('nav.maxChatsFree')}</p>
          )}

          <button
            type="button"
            onClick={() => {
              onResetMemory?.();
              if (window.innerWidth < 768) toggleSidebar();
            }}
            className="mt-2 w-full bg-white text-slate-700 py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-sm font-medium hover:bg-slate-50 hover:text-slate-900 border border-slate-200 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">psychology_alt</span>
            {t('nav.resetMemory')}
          </button>

          {!isPremium && (
            <p className="mt-2 text-[10px] text-slate-500 text-center">
              {t('nav.audits', { count: usage.count ?? 0, limit: usage.limit ?? 10, shared: sharedLabel })}
            </p>
          )}
          {usage.freemium_exceeded && !isPremium && (
            <p className="mt-1 text-[10px] text-blue-900 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1.5 text-center">
              {t('nav.quotaExhausted')}
            </p>
          )}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto pr-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">
            {t('nav.recentChats')}
            {!isPremium && t('nav.recentMax')}
          </p>

          {recentChats.length > 0 ? (
            recentChats.map((chat) => (
              <button
                key={chat.id}
                type="button"
                onClick={() => {
                  onSelectChat?.(chat.id);
                  if (window.innerWidth < 768) toggleSidebar();
                }}
                className={`${navLinkClass} ${
                  chat.id === activeChatId
                    ? 'text-slate-800 font-medium bg-slate-100 border border-slate-200'
                    : ''
                }`}
              >
                <span className="material-symbols-outlined text-slate-500 text-sm shrink-0">history</span>
                <span className="text-sm truncate">{chat.title}</span>
              </button>
            ))
          ) : (
            <span className={`${navLinkClass} text-slate-500 cursor-default hover:bg-transparent`}>
              <span className="material-symbols-outlined text-slate-500 text-sm">history</span>
              <span className="text-sm">{t('nav.noRecent')}</span>
            </span>
          )}

          <div className="pt-4 pb-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">{t('nav.management')}</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateView?.('normativas')}
            className={`${navLinkClass} ${activeView === 'normativas' ? 'text-slate-800 font-medium bg-slate-100 border border-slate-200' : ''}`}
          >
            <span className="material-symbols-outlined text-slate-500 text-sm">search</span>
            <span className="text-sm">{t('nav.exploreNorms')}</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateView?.('expedientes')}
            className={`${navLinkClass} ${activeView === 'expedientes' ? 'text-slate-800 font-medium bg-slate-100 border border-slate-200' : ''}`}
          >
            <span className="material-symbols-outlined text-slate-500 text-sm">folder_open</span>
            <span className="text-sm">{t('nav.myFiles')}</span>
          </button>

          <div className="pt-6 pb-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">{t('nav.system')}</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateView?.('settings')}
            className={`${navLinkClass} ${activeView === 'settings' ? 'text-slate-800 font-medium bg-slate-100 border border-slate-200' : ''}`}
          >
            <span className="material-symbols-outlined text-slate-500 text-sm">settings</span>
            <span className="text-sm">{t('nav.settings')}</span>
          </button>
          <a className={navLinkClass} href="#">
            <span className="material-symbols-outlined text-slate-500 text-sm">help_center</span>
            <span className="text-sm">{t('nav.support')}</span>
          </a>
        </nav>

        <div className="mt-auto border-t border-border-gray pt-6">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">{t('nav.integrations')}</p>
          <div className="space-y-2">
            <a
              className="flex items-center gap-3 py-2 px-3 rounded-lg text-slate-600 hover:bg-[#5865F2] hover:text-white transition-colors border border-transparent hover:border-[#5865F2] group"
              href={DISCORD_BOT_INVITE}
              target="_blank"
              rel="noreferrer"
            >
              <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
              </svg>
              <span className="text-sm font-medium">{t('nav.discordBot')}</span>
            </a>
            <a
              className="flex items-center gap-3 py-2 px-3 rounded-lg text-slate-600 hover:bg-[#229ED9] hover:text-white transition-colors border border-transparent hover:border-[#229ED9] group"
              href={TELEGRAM_LINK}
              target="_blank"
              rel="noreferrer"
            >
              <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
              <span className="text-sm font-medium">{t('nav.telegram')}</span>
            </a>
            <a
              className="flex items-center gap-3 py-2 px-3 rounded-lg text-slate-600 hover:bg-[#5865F2] hover:text-white transition-colors border border-transparent hover:border-[#5865F2] group"
              href={DISCORD_SERVER_INVITE}
              target="_blank"
              rel="noreferrer"
            >
              <span className="material-symbols-outlined text-[18px] text-[#5865F2] group-hover:text-white">groups</span>
              <span className="text-sm font-medium">{t('nav.discordServer')}</span>
            </a>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
