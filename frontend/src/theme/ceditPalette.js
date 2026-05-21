/**
 * Paleta CEDIT: azules institucionales + grises (sin rojo/verde/ámbar en UI).
 */
export const CEDIT_THEMES = {
  gray: {
    accent: 'from-slate-600 to-slate-800',
    border: 'border-slate-200',
    bg: 'bg-slate-50/90',
    label: 'text-slate-800',
    stat: 'text-slate-800',
    statBg: 'bg-slate-50',
    statBorder: 'border-slate-300',
  },
  blue: {
    accent: 'from-blue-700 to-blue-900',
    border: 'border-blue-200',
    bg: 'bg-blue-50/70',
    label: 'text-blue-900',
    stat: 'text-blue-800',
    statBg: 'bg-blue-50',
    statBorder: 'border-blue-400',
  },
};

/** Compatibilidad con claves antiguas (red/amber/emerald → azul/gris). */
const THEME_ALIASES = {
  slate: 'gray',
  gray: 'gray',
  red: 'blue',
  amber: 'gray',
  emerald: 'blue',
  blue: 'blue',
};

export function resolveTheme(themeKey = 'gray') {
  const key = THEME_ALIASES[themeKey] || themeKey;
  return CEDIT_THEMES[key] || CEDIT_THEMES.gray;
}

export function ceditCardClass(themeKey = 'gray', extra = '') {
  const t = resolveTheme(themeKey);
  return `rounded-2xl border ${t.border} ${t.bg} shadow-sm ${extra}`.trim();
}

export function ceditLabelClass(themeKey = 'gray') {
  const t = resolveTheme(themeKey);
  return `text-[10px] font-bold uppercase tracking-wide ${t.label} flex items-center gap-1`;
}

export function ceditIconBoxClass(themeKey = 'gray', size = 'w-9 h-9') {
  const t = resolveTheme(themeKey);
  return `${size} rounded-xl bg-gradient-to-br ${t.accent} flex items-center justify-center shrink-0 shadow-sm`;
}

export function ceditBtnPrimaryClass(themeKey = 'blue') {
  const t = resolveTheme(themeKey);
  return `inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r ${t.accent} text-white text-xs font-bold hover:opacity-95 transition-opacity shadow-sm disabled:opacity-50`;
}

export function ceditBtnSecondaryClass() {
  return 'inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs font-semibold hover:bg-slate-50 transition-colors';
}
