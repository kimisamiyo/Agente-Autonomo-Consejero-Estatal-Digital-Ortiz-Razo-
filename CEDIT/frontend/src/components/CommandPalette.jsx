import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';

/**
 * Joya 1 — Paleta de comandos (Ctrl/Cmd+K)
 */
const CommandPalette = ({
  open,
  onClose,
  onNavigate,
  onNewChat,
  onOpenTools,
  onOpenShortcuts,
  onOpenBriefing,
}) => {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  const items = useMemo(() => {
    const all = [
      { id: 'new', icon: 'add', label: t('jewel.cmd.new'), kbd: 'N', run: onNewChat },
      {
        id: 'brief',
        icon: 'auto_awesome',
        label: t('jewel.cmd.briefing'),
        run: onOpenBriefing,
      },
      { id: 'chat', icon: 'forum', label: t('jewel.cmd.chat'), run: () => onNavigate('chat') },
      { id: 'support', icon: 'support_agent', label: t('jewel.cmd.support'), run: () => onNavigate('support') },
      { id: 'settings', icon: 'settings', label: t('jewel.cmd.settings'), run: () => onNavigate('settings') },
      { id: 'norms', icon: 'menu_book', label: t('jewel.cmd.norms'), run: () => onNavigate('normativas') },
      { id: 'files', icon: 'folder_open', label: t('jewel.cmd.files'), run: () => onNavigate('expedientes') },
      { id: 'tools', icon: 'construction', label: t('jewel.cmd.tools'), run: onOpenTools },
      { id: 'keys', icon: 'keyboard', label: t('jewel.cmd.keys'), run: onOpenShortcuts },
    ];
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((i) => i.label.toLowerCase().includes(needle));
  }, [q, t, onNavigate, onNewChat, onOpenTools, onOpenShortcuts, onOpenBriefing]);

  useEffect(() => {
    if (!open) return undefined;
    setQ('');
    setActive(0);
    const tmr = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(tmr);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((i) => Math.min(i + 1, Math.max(items.length - 1, 0)));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && items[active]) {
        e.preventDefault();
        items[active].run?.();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, items, active, onClose]);

  if (!open) return null;

  return (
    <div className="cedit-overlay flex items-start justify-center pt-[12vh] px-4" onClick={onClose} role="presentation">
      <div className="cedit-cmdk" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('jewel.cmd.title')}>
        <div className="flex items-center gap-2 px-3 border-b border-[var(--cedit-border)]">
          <span className="material-symbols-outlined text-[var(--cedit-text-faint)] pl-2">search</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            placeholder={t('jewel.cmd.placeholder')}
          />
          <kbd className="kbd mr-2 text-[10px] font-bold text-[var(--cedit-text-faint)] border border-[var(--cedit-border)] rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>
        <div className="py-2 max-h-[50vh] overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-[var(--cedit-text-muted)]">{t('jewel.cmd.empty')}</p>
          ) : (
            items.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                className={`cedit-cmdk-item ${idx === active ? 'is-active' : ''}`}
                onMouseEnter={() => setActive(idx)}
                onClick={() => {
                  item.run?.();
                  onClose();
                }}
              >
                <span className="material-symbols-outlined text-[var(--cedit-primary)]">{item.icon}</span>
                <span className="text-sm font-medium">{item.label}</span>
                {item.kbd && <span className="kbd">{item.kbd}</span>}
              </button>
            ))
          )}
        </div>
        <div className="px-4 py-2.5 border-t border-[var(--cedit-border)] text-[10px] text-[var(--cedit-text-faint)] font-semibold tracking-wide uppercase">
          {t('jewel.cmd.hint')}
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
