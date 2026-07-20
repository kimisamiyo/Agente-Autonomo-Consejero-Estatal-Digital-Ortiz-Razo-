import React, { useMemo } from 'react';
import { useI18n } from '../i18n/I18nContext';
import NetworksLinks from './NetworksLinks';
import { ceditBtnPrimaryClass } from '../theme/ceditPalette';

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
      audit: { text: t('badge.auditActive'), tone: 'audit' },
      plan: { text: t('badge.planMef'), tone: 'plan' },
      freemium: { text: t('badge.limitReached'), tone: 'limit' },
    };
    return map[sessionMode];
  }, [sessionMode, t]);

  const sharedLabel = !isPremium ? t('nav.shared') : '';

  const sectionLabel = 'cedit-side-faint text-[10px] font-bold uppercase tracking-[0.14em] mb-2.5 px-2';

  const NavBtn = ({ view, icon, label, onClick, active }) => (
    <button
      type="button"
      onClick={onClick}
      className={`cedit-nav-item group flex items-center gap-3 py-2.5 px-3 rounded-xl w-full text-left transition-colors duration-200 ${
        active ? 'is-active' : ''
      }`}
    >
      <span className="material-symbols-outlined text-[18px] shrink-0 cedit-icon-lead">{icon}</span>
      <span className="text-sm truncate">{label}</span>
    </button>
  );

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-[3px] z-40 md:hidden cedit-fade-in"
          onClick={toggleSidebar}
          aria-hidden
        />
      )}

      <aside
        className={`
        cedit-sidebar fixed md:relative top-0 left-0 h-screen w-[17.5rem]
        flex flex-col py-6 px-4 z-50
        transition-transform duration-300 ease-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}
      >
        <button
          type="button"
          className="md:hidden absolute top-3 right-3 cedit-side-muted rounded-lg p-1.5 hover:opacity-80"
          onClick={toggleSidebar}
          aria-label="Cerrar menú"
        >
          <span className="material-symbols-outlined">close</span>
        </button>

        <div className="mb-5 px-1">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg shadow-slate-900/25 shrink-0 cedit-accent-steel cedit-brand-float">
              <span
                className="material-symbols-outlined text-white text-[22px]"
                style={{ fontVariationSettings: '"FILL" 1' }}
              >
                assured_workload
              </span>
            </div>
            <div className="min-w-0">
              <h1 className="cedit-side-title text-[1.35rem] font-bold tracking-tight leading-none">
                CEDIT
              </h1>
              <p className="cedit-side-muted text-[10px] uppercase tracking-[0.14em] font-semibold mt-1.5">
                {t('app.digitalGov')}
              </p>
              {modeBadge && (
                <span
                  className={`inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    modeBadge.tone === 'audit'
                      ? 'bg-[var(--cedit-steel-soft)] text-[var(--cedit-text)] border-[color-mix(in_srgb,var(--cedit-steel)_35%,var(--cedit-border))]'
                      : 'bg-white/5 text-[var(--cedit-text)] border-[var(--cedit-border)]'
                  }`}
                >
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
            className={`w-full ${ceditBtnPrimaryClass('blue')} !py-3 !text-sm !rounded-xl`}
          >
            <span className="material-symbols-outlined text-sm">add</span>
            {t('nav.newAnalysis')}
          </button>
          {!canCreateNewChat && !isPremium && (
            <p className="cedit-side-faint mt-1.5 text-[10px] text-center">{t('nav.maxChatsFree')}</p>
          )}

          <button
            type="button"
            onClick={() => {
              onResetMemory?.();
              if (window.innerWidth < 768) toggleSidebar();
            }}
            className="cedit-side-btn-ghost mt-2 w-full py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-opacity hover:opacity-90"
          >
            <span className="material-symbols-outlined text-sm">psychology_alt</span>
            {t('nav.resetMemory')}
          </button>

          {isPremium ? (
            <p className="mt-2 text-[10px] text-center font-semibold text-[var(--cedit-text)] bg-[var(--cedit-steel-soft)] border border-[color-mix(in_srgb,var(--cedit-steel)_30%,var(--cedit-border))] rounded-lg px-2 py-1.5">
              {t('nav.proActive')}
            </p>
          ) : (
            <p className="cedit-side-muted mt-2 text-[10px] text-center">
              {t('nav.audits', {
                count: usage.count ?? 0,
                limit: usage.limit ?? 10,
                shared: sharedLabel,
              })}
            </p>
          )}
          {usage.freemium_exceeded && !isPremium && (
            <p className="mt-1 text-[10px] text-[var(--cedit-text)] bg-[var(--cedit-surface-3)] border border-[var(--cedit-border-strong)] rounded-lg px-2 py-1.5 text-center">
              {t('nav.quotaExhausted')}
            </p>
          )}
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto pr-0.5">
          <p className={sectionLabel}>
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
                className={`cedit-nav-item flex items-center gap-3 py-2.5 px-3 rounded-xl w-full text-left ${
                  chat.id === activeChatId ? 'is-active' : ''
                }`}
              >
                <span className="material-symbols-outlined text-[18px] shrink-0">history</span>
                <span className="text-sm truncate">{chat.title}</span>
              </button>
            ))
          ) : (
            <div className="cedit-nav-item flex items-center gap-3 py-2.5 px-3 rounded-xl opacity-70">
              <span className="material-symbols-outlined text-[18px]">history</span>
              <span className="text-sm">{t('nav.noRecent')}</span>
            </div>
          )}

          <div className="pt-5">
            <p className={sectionLabel}>{t('nav.management')}</p>
          </div>
          <NavBtn
            view="normativas"
            icon="search"
            label={t('nav.exploreNorms')}
            active={activeView === 'normativas'}
            onClick={() => onNavigateView?.('normativas')}
          />
          <NavBtn
            view="expedientes"
            icon="folder_open"
            label={t('nav.myFiles')}
            active={activeView === 'expedientes'}
            onClick={() => onNavigateView?.('expedientes')}
          />

          <div className="pt-5">
            <p className={sectionLabel}>{t('nav.system')}</p>
          </div>
          <NavBtn
            view="settings"
            icon="settings"
            label={t('nav.settings')}
            active={activeView === 'settings'}
            onClick={() => onNavigateView?.('settings')}
          />
          <NavBtn
            view="support"
            icon="help_center"
            label={t('nav.support')}
            active={activeView === 'support'}
            onClick={() => onNavigateView?.('support')}
          />
        </nav>

        <div className="mt-auto border-t border-[var(--cedit-border)] pt-4">
          <NetworksLinks layout="sidebar" />
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
