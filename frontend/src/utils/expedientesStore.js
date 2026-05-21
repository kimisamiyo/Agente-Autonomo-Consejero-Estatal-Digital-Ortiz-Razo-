const STORE_KEY = 'cedit_expedientes';
export const MEF_THRESHOLD = 80;

export function loadExpedientes() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveExpediente(entry) {
  const list = loadExpedientes();
  const item = {
    id: entry.id || `exp_${Date.now()}`,
    title: entry.title || 'Plan MEF',
    projectName: entry.projectName || '',
    score: entry.score ?? 0,
    docScore: entry.docScore ?? 0,
    hash: entry.hash || '',
    createdAt: entry.createdAt || new Date().toISOString(),
    pdfLanguage: entry.pdfLanguage || 'es',
  };
  const filtered = list.filter((e) => e.id !== item.id);
  const next = [item, ...filtered].slice(0, 50);
  localStorage.setItem(STORE_KEY, JSON.stringify(next));
  return item;
}

export function listQualifiedExpedientes(minScore = MEF_THRESHOLD) {
  return loadExpedientes()
    .filter((e) => (e.score ?? 0) >= minScore)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
