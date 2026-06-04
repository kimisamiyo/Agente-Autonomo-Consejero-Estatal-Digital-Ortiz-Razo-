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

function persist(list) {
  localStorage.setItem(STORE_KEY, JSON.stringify(list));
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
    pdfKeccak: entry.pdfKeccak || '',
    conversationId: entry.conversationId || '',
    firmaPending: Boolean(entry.firmaPending),
    pdfFirmaTokenId: entry.pdfFirmaTokenId ?? null,
    pdfFirmaTx: entry.pdfFirmaTx || '',
    pdfFirmaExplorerTx: entry.pdfFirmaExplorerTx || '',
    pdfFirmaContract: entry.pdfFirmaContract || '',
    createdAt: entry.createdAt || new Date().toISOString(),
    pdfLanguage: entry.pdfLanguage || 'es',
  };
  const filtered = list.filter((e) => e.id !== item.id);
  const next = [item, ...filtered].slice(0, 50);
  persist(next);
  return item;
}

export function updateExpedienteFirma(id, firma) {
  const list = loadExpedientes();
  let updated = null;
  const next = list.map((e) => {
    if (e.id !== id) return e;
    updated = {
      ...e,
      firmaPending: false,
      pdfFirmaTokenId: firma.token_id ?? firma.pdfFirmaTokenId ?? null,
      pdfFirmaTx: firma.tx_hash || firma.pdfFirmaTx || '',
      pdfFirmaExplorerTx: firma.explorer_tx || firma.pdfFirmaExplorerTx || '',
      pdfFirmaContract: firma.contract_address || firma.pdfFirmaContract || '',
    };
    return updated;
  });
  if (updated) persist(next);
  return updated;
}

export function listQualifiedExpedientes(minScore = MEF_THRESHOLD) {
  return loadExpedientes()
    .filter((e) => (e.score ?? 0) >= minScore)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function needsPdfFirma(exp) {
  return Boolean(exp?.pdfKeccak && exp?.firmaPending && !exp?.pdfFirmaTokenId);
}
