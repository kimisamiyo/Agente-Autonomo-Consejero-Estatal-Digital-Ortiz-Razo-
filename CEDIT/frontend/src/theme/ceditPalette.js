/**
 * Paleta CEDIT — grises plata / grafito + acento acero MEF.
 * Clases semánticas en index.css (cedit-tone-*).
 */
export const CEDIT_THEMES = {
  gray: {
    tone: 'gray',
    accent: 'cedit-accent-gray',
    label: 'cedit-label-gray',
  },
  steel: {
    tone: 'steel',
    accent: 'cedit-accent-steel',
    label: 'cedit-label-steel',
  },
  blue: {
    tone: 'blue',
    accent: 'cedit-accent-blue',
    label: 'cedit-label-blue',
  },
};

const THEME_ALIASES = {
  slate: 'gray',
  gray: 'gray',
  mist: 'gray',
  ash: 'gray',
  graphite: 'steel',
  steel: 'steel',
  red: 'blue',
  amber: 'gray',
  emerald: 'steel',
  blue: 'blue',
};

export function resolveTheme(themeKey = 'gray') {
  const key = THEME_ALIASES[themeKey] || themeKey;
  return CEDIT_THEMES[key] || CEDIT_THEMES.gray;
}

export function ceditCardClass(themeKey = 'gray', extra = '') {
  const t = resolveTheme(themeKey);
  return `cedit-tone-card cedit-tone-${t.tone} ${extra}`.trim();
}

export function ceditLabelClass(themeKey = 'gray') {
  const t = resolveTheme(themeKey);
  return `text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 ${t.label}`;
}

export function ceditIconBoxClass(themeKey = 'gray', size = 'w-9 h-9') {
  const t = resolveTheme(themeKey);
  return `cedit-icon-box ${size} rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-slate-900/15 dark:shadow-black/35 ${t.accent}`;
}

export function ceditBtnPrimaryClass(themeKey = 'blue') {
  const t = resolveTheme(themeKey);
  return `cedit-btn-live inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-xs font-bold hover:opacity-95 active:scale-[0.98] transition-all shadow-sm disabled:opacity-50 ${t.accent}`;
}

export function ceditBtnSecondaryClass() {
  return 'cedit-btn-live inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-colors cedit-btn-secondary';
}

export function ceditPanelClass(extra = '') {
  return `rounded-2xl overflow-hidden backdrop-blur-sm cedit-panel ${extra}`.trim();
}

export function ceditSectionTitleClass() {
  return 'flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider mb-3 px-1 cedit-section-title';
}

export function ceditFieldClass(extra = '') {
  return `cedit-field ${extra}`.trim();
}

export function ceditChipClass(active = false) {
  return `cedit-chip${active ? ' is-on' : ''}`;
}
