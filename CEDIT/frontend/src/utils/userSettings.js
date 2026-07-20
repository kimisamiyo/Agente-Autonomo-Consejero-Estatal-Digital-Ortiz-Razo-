/**
 * Preferencias CEDIT: idioma, tema y accesibilidad (niveles 0–3).
 */
const SETTINGS_KEY = 'cedit_user_settings';

export const LOCALES = [
  { id: 'es', label: 'Español' },
  { id: 'qu', label: 'Quechua' },
  { id: 'ay', label: 'Aymara' },
];

export const COLOR_MODES = [
  { id: 'light', icon: 'light_mode' },
  { id: 'dark', icon: 'dark_mode' },
];

export const PALETTE_TONES = [
  { id: 'mist', icon: 'cloud' },
  { id: 'steel', icon: 'architecture' },
  { id: 'graphite', icon: 'contrast' },
];

export const DEFAULT_SETTINGS = {
  locale: 'es',
  colorMode: 'light',
  paletteTone: 'mist',
  textSize: 1,
  contrast: 0,
  cursor: 0,
  readingMask: 0,
  dyslexia: 0,
  lineSpacing: 0,
  reduceMotion: 0,
  linkEmphasis: 0,
  uiDensity: 0,
};

const TEXT_SIZES = ['100%', '112.5%', '125%', '140%'];
const LINE_HEIGHTS = ['1.5', '1.7', '1.9', '2.2'];
const DENSITY = ['1', '0.92', '0.84', '0.76'];
const MASK_SLOTS = [
  null,
  { top: 44, bottom: 56 },
  { top: 38, bottom: 62 },
  { top: 30, bottom: 70 },
];
const DYSLEXIA_STRENGTH = [
  null,
  { letter: '0.03em', word: '0.08em', weight: '400' },
  { letter: '0.06em', word: '0.14em', weight: '500' },
  { letter: '0.09em', word: '0.2em', weight: '600' },
];

let _maskMoveHandler = null;

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    const colorMode = parsed.colorMode === 'dark' ? 'dark' : 'light';
    const paletteTone = PALETTE_TONES.some((p) => p.id === parsed.paletteTone)
      ? parsed.paletteTone
      : 'mist';
    return { ...DEFAULT_SETTINGS, ...parsed, colorMode, paletteTone };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, ...settings }));
  applySettingsToDocument({ ...DEFAULT_SETTINGS, ...settings });
}

function clearReadingMaskFollow() {
  if (_maskMoveHandler) {
    window.removeEventListener('pointermove', _maskMoveHandler);
    _maskMoveHandler = null;
  }
  document.documentElement.style.removeProperty('--cedit-mask-top');
  document.documentElement.style.removeProperty('--cedit-mask-bottom');
}

function setupReadingMaskFollow(level) {
  clearReadingMaskFollow();
  const slot = MASK_SLOTS[level];
  if (!slot) return;
  const half = (slot.bottom - slot.top) / 2;
  const applyAt = (yPct) => {
    const top = Math.max(0, Math.min(100 - (slot.bottom - slot.top), yPct - half));
    const bottom = top + (slot.bottom - slot.top);
    document.documentElement.style.setProperty('--cedit-mask-top', `${top}%`);
    document.documentElement.style.setProperty('--cedit-mask-bottom', `${bottom}%`);
  };
  applyAt((slot.top + slot.bottom) / 2);
  _maskMoveHandler = (e) => {
    applyAt((e.clientY / window.innerHeight) * 100);
  };
  window.addEventListener('pointermove', _maskMoveHandler, { passive: true });
}

function stripPrefix(root, prefix) {
  [...root.classList].forEach((c) => {
    if (c.startsWith(prefix)) root.classList.remove(c);
  });
}

export function applySettingsToDocument(settings = loadSettings()) {
  const root = document.documentElement;
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const dark = s.colorMode === 'dark';

  root.classList.toggle('dark', dark);
  root.dataset.theme = dark ? 'dark' : 'light';
  root.style.colorScheme = dark ? 'dark' : 'light';

  const tone = PALETTE_TONES.some((p) => p.id === s.paletteTone) ? s.paletteTone : 'mist';
  root.dataset.palette = tone;

  root.style.fontSize = TEXT_SIZES[s.textSize] || TEXT_SIZES[0];
  root.style.setProperty('--cedit-line-height', LINE_HEIGHTS[s.lineSpacing] || LINE_HEIGHTS[0]);
  root.style.setProperty('--cedit-density', DENSITY[s.uiDensity] || DENSITY[0]);

  stripPrefix(root, 'cedit-contrast-');
  root.classList.add(`cedit-contrast-${s.contrast || 0}`);

  stripPrefix(root, 'cedit-cursor-');
  root.classList.remove('cedit-large-cursor');
  if (s.cursor >= 1) {
    root.classList.add('cedit-large-cursor', `cedit-cursor-${s.cursor}`);
  }

  stripPrefix(root, 'cedit-dyslexia');
  root.classList.remove('cedit-dyslexia');
  const dys = DYSLEXIA_STRENGTH[s.dyslexia];
  if (dys) {
    root.classList.add('cedit-dyslexia', `cedit-dyslexia-${s.dyslexia}`);
    root.style.setProperty('--cedit-dys-letter', dys.letter);
    root.style.setProperty('--cedit-dys-word', dys.word);
    root.style.setProperty('--cedit-dys-weight', dys.weight);
  } else {
    root.style.removeProperty('--cedit-dys-letter');
    root.style.removeProperty('--cedit-dys-word');
    root.style.removeProperty('--cedit-dys-weight');
  }

  stripPrefix(root, 'cedit-mask-');
  root.classList.remove('cedit-reading-mask');
  if (s.readingMask >= 1) {
    root.classList.add('cedit-reading-mask', `cedit-mask-${s.readingMask}`);
    setupReadingMaskFollow(s.readingMask);
  } else {
    clearReadingMaskFollow();
  }

  stripPrefix(root, 'cedit-motion-');
  root.classList.add(`cedit-motion-${s.reduceMotion || 0}`);

  stripPrefix(root, 'cedit-links-');
  root.classList.add(`cedit-links-${s.linkEmphasis || 0}`);

  stripPrefix(root, 'cedit-density-');
  root.classList.add(`cedit-density-${s.uiDensity || 0}`);

  root.dataset.ceditLocale = s.locale || 'es';
}
