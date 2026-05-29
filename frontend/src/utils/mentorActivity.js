const ENTITY_PATTERNS = [
  ['SUNEDU', /\bsunedu\b|superintendencia\s+nacional\s+de\s+educaci[oó]n/i],
  ['MEF', /\bmef\b|ministerio\s+de\s+econom[ií]a\s+y\s+finanzas/i],
  ['PRONIED', /\bpronied\b|infraestructura\s+educativa/i],
  ['Invierte.pe', /\binvierte\.pe\b|\bsnip\b|\bcui\b/i],
  ['OSCE', /\bosce\b|organismo\s+de\s+supervisi[oó]n/i],
  ['PROCOMPITE', /\bprocompite\b/i],
  ['FONIPREL', /\bfoniprel\b/i],
  ['MIDAGRI', /\bmidagri\b|ministerio\s+de\s+desarrollo\s+agrario/i],
  ['ProInversión', /\bproinversi[oó]n\b|obras\s+por\s+impuestos|\boxi\b/i],
  ['INDECOPI', /\bindecopi\b/i],
  ['Contraloría', /\bcontralor[ií]a\b/i],
];

/** Cargos públicos — espejo simplificado del backend */
const FIGURE_PATTERNS = [
  ['Gobernador regional', /gobernador(?:a)?\s+regional(?:\s+de\s+|\s+)([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,3})?/i],
  ['Gobernador regional', /\bgobernador(?:a)?\s+regional\b/i],
  ['Alcalde', /alcalde(?:sa)?\s+(?:provincial|distrital)?(?:\s+de\s+|\s+)([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,3})/i],
  ['Prefecto', /prefecto(?:a)?\s+(?:de\s+)?([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,3})/i],
  ['Ministro', /ministro(?:a)?\s+de\s+([\wáéíóúñ\s]{3,40})/i],
  ['Regidor', /regidor(?:a)?\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,2})/i],
  ['Vicegobernador', /vicegobernador(?:a)?\s+(?:de\s+)?([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,3})/i],
  ['Servidor público', /servidor(?:a)?\s+p[uú]blico(?:a)?\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,3})/i],
];

const SKIP_NAMES = new Set(['de', 'la', 'el', 'los', 'las', 'del', 'regional', 'provincial', 'distrital']);

export function detectMonitoringEntities(text = '') {
  const blob = (text || '').toLowerCase();
  const found = [];
  for (const [label, pattern] of ENTITY_PATTERNS) {
    if (pattern.test(blob)) found.push(label);
  }
  return found;
}

export function detectPublicFigures(text = '') {
  const blob = text || '';
  const figures = [];
  const seen = new Set();

  for (const [role, pattern] of FIGURE_PATTERNS) {
    const m = blob.match(pattern);
    if (!m) continue;
    let name = '';
    if (m[1] && m[1].trim().length >= 3) {
      const n = m[1].trim();
      if (!SKIP_NAMES.has(n.toLowerCase())) name = n;
    }
    const label = name ? `${role} ${name}` : role;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    figures.push({ role, name, label });
    if (figures.length >= 2) break;
  }
  return figures;
}

const SECTOR_HINTS = [
  ['educación', /educaci|colegio|universidad|sunedu|ugel/i],
  ['salud', /salud|hospital|essalud|posta/i],
  ['vialidad', /vial|carretera|puente|trocha/i],
  ['agua', /agua|saneamiento|riego/i],
  ['productivo', /productivo|procompite|emprendimiento/i],
];

function detectSectorHint(text = '') {
  const blob = (text || '').toLowerCase();
  for (const [label, pattern] of SECTOR_HINTS) {
    if (pattern.test(blob)) return label;
  }
  return '';
}

/**
 * Etiqueta de carga mientras el agente responde.
 */
export function getMentorLoadingLabel(text, t, serverActivity = '') {
  if (serverActivity) return serverActivity;

  const entities = detectMonitoringEntities(text);
  const figures = detectPublicFigures(text);
  const sector = detectSectorHint(text);

  if (entities.length && figures.length) {
    return t('chat.mentorSearchingBoth', {
      entity: entities[0],
      person: figures[0].label,
    });
  }
  if (figures.length) {
    return t('chat.mentorSearchingPerson', { person: figures[0].label });
  }
  if (entities.length) {
    return t('chat.mentorSearching', { entity: entities[0] });
  }
  if (sector) {
    return t('chat.mentorSearchingSector', { sector });
  }
  return t('chat.mentorThinking');
}
