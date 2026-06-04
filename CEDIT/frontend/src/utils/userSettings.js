const SETTINGS_KEY = 'cedit_user_settings';

export const LOCALES = [
  { id: 'es', label: 'Español' },
  { id: 'qu', label: 'Quechua' },
  { id: 'ay', label: 'Aymara' },
];

export const DEFAULT_SETTINGS = {
  locale: 'es',
  textSize: 1,
  contrast: 0,
  cursor: 0,
  readingMask: 0,
  dyslexia: 0,
  lineSpacing: 0,
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, ...settings }));
  applySettingsToDocument({ ...DEFAULT_SETTINGS, ...settings });
}

export function applySettingsToDocument(settings = loadSettings()) {
  const root = document.documentElement;
  const sizes = ['100%', '112.5%', '125%', '137.5%'];
  root.style.fontSize = sizes[settings.textSize] || sizes[0];
  root.classList.toggle('cedit-high-contrast', settings.contrast >= 2);
  root.classList.toggle('cedit-contrast-mid', settings.contrast === 1);
  root.classList.toggle('cedit-large-cursor', settings.cursor >= 1);
  root.classList.toggle('cedit-reading-mask', settings.readingMask >= 1);
  root.classList.toggle('cedit-dyslexia', settings.dyslexia >= 1);
  const spacing = ['1.5', '1.65', '1.8', '2'];
  root.style.setProperty('--cedit-line-height', spacing[settings.lineSpacing] || spacing[0]);
  root.dataset.ceditLocale = settings.locale || 'es';
}
