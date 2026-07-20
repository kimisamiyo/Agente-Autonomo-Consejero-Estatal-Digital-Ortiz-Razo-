/**
 * Asigna a cada Material Symbol un estilo de movimiento distinto.
 */
const MOTION_BY_ICON = {
  add: 'burst',
  close: 'shrink',
  menu: 'wave',
  settings: 'gear',
  tune: 'gear',
  search: 'pulse',
  forum: 'bob',
  history: 'tilt',
  folder_open: 'lift',
  description: 'lift',
  menu_book: 'flip',
  support_agent: 'wiggle',
  psychology_alt: 'wiggle',
  account_balance_wallet: 'jingle',
  account_balance: 'rise',
  assured_workload: 'rise',
  fact_check: 'check',
  picture_as_pdf: 'drop',
  attach_file: 'drop',
  construction: 'hammer',
  terminal: 'blink',
  keyboard: 'tap',
  auto_awesome: 'spark',
  diamond: 'spark',
  lightbulb: 'glow',
  translate: 'slide',
  diversity_3: 'fan',
  groups: 'fan',
  hub: 'orbit',
  library_books: 'flip',
  domain: 'rise',
  gavel: 'hammer',
  policy: 'flip',
  open_in_new: 'slide',
  arrow_forward: 'nudge',
  chevron_right: 'nudge',
  check_circle: 'check',
  verified: 'check',
  lock: 'shake',
  bolt: 'zap',
  hourglass_top: 'spin',
  restart_alt: 'spin',
  build: 'hammer',
  edit_note: 'tilt',
  person: 'bob',
  smart_toy: 'wiggle',
  send: 'nudge',
  gradient: 'orbit',
  palette: 'fan',
  accessibility_new: 'wave',
  format_size: 'pulse',
  contrast: 'flip',
  mouse: 'tap',
  horizontal_rule: 'slide',
  text_fields: 'tilt',
  format_line_spacing: 'wave',
  motion_photos_off: 'shrink',
  link: 'nudge',
  density_small: 'pulse',
  cloud: 'bob',
  architecture: 'rise',
};

const DEFAULT_CYCLE = ['pop', 'bob', 'tilt', 'pulse', 'wiggle', 'lift', 'nudge', 'spark'];

function normalizeIconName(el) {
  return (el.textContent || '').trim().replace(/\s+/g, '_').toLowerCase();
}

export function resolveIconMotion(iconName, fallbackIndex = 0) {
  const key = String(iconName || '')
    .trim()
    .replace(/\s+/g, '_')
    .toLowerCase();
  return MOTION_BY_ICON[key] || DEFAULT_CYCLE[fallbackIndex % DEFAULT_CYCLE.length];
}

export function tagIconElement(el, index = 0) {
  if (!el || el.nodeType !== 1) return;
  if (!el.classList?.contains('material-symbols-outlined')) return;
  const name = normalizeIconName(el);
  if (!name) return;
  el.dataset.ceditMotion = resolveIconMotion(name, index);
  el.dataset.ceditIcon = name;
}

export function tagAllIcons(root = document) {
  const nodes = root.querySelectorAll?.('.material-symbols-outlined') || [];
  nodes.forEach((el, i) => tagIconElement(el, i));
}

export function startIconMotionObserver() {
  if (typeof window === 'undefined' || typeof MutationObserver === 'undefined') {
    return () => {};
  }

  tagAllIcons(document);

  let scheduled = false;
  const flush = () => {
    scheduled = false;
    tagAllIcons(document);
  };

  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(flush);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  return () => observer.disconnect();
}
