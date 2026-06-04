import React, { useMemo } from 'react';
import { useI18n } from '../i18n/I18nContext';
import NetworksLinks from './NetworksLinks';

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

          {isPremium ? (
            <p className="mt-2 text-[10px] text-center font-semibold text-blue-900 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1.5">
              {t('nav.proActive')}
            </p>
          ) : (
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
          <NetworksLinks layout="sidebar" />
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
