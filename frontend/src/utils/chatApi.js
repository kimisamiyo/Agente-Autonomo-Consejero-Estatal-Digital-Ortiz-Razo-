import axios from 'axios';

/** Respuesta válida de /api/chat o del webhook n8n (misma forma). */
export function unwrapChatPayload(data) {
  if (!data || typeof data !== 'object') return null;
  if (data.body && typeof data.body === 'object') {
    return data.body;
  }
  return data;
}

export function isValidChatPayload(data) {
  const d = unwrapChatPayload(data);
  if (!d) return false;
  const text = d.display ?? d.response;
  return typeof text === 'string' && text.trim().length > 0;
}

export function formatChatError(error, { n8nAttempted = false } = {}) {
  const st = error?.response?.status;
  const detail = error?.response?.data?.detail;
  const detailStr =
    typeof detail === 'string' ? detail : detail != null ? JSON.stringify(detail) : '';

  if (error?.code === 'ECONNABORTED') {
    return 'La consulta tardó demasiado. Compruebe que **uvicorn** siga activo e intente de nuevo.';
  }
  if (error?.code === 'ECONNREFUSED' || error?.message?.includes('Network Error')) {
    return 'No hay conexión con el servidor. Inicie **uvicorn api:app --reload** en la carpeta `CEDIT` (puerto **8000**).';
  }
  if (st === 404 && n8nAttempted) {
    return (
      'El webhook de n8n no está registrado. En n8n: importe **CEDIT 01**, pulse **Save** y active el interruptor **Active** (verde). ' +
      'La app ya intentó la API directa en `/api/chat`.'
    );
  }
  if (st === 502) {
    return (
      'El servidor API no respondió (502). Inicie uvicorn **desde la carpeta CEDIT** (donde está api.py): ' +
      '`cd C:\\Users\\mayro\\Downloads\\CEDIT\\CEDIT` y luego `python -m uvicorn api:app --reload --port 8000`. ' +
      'Compruebe http://127.0.0.1:8000/docs'
    );
  }
  if (st === 500 && detailStr) {
    return `Error del servidor: ${detailStr}`;
  }
  if (detailStr) return detailStr;
  if (error?.message) return error.message;
  return 'Verifique **uvicorn** (puerto 8000). n8n (5678) es opcional si el flujo 01 está activo.';
}

/**
 * Envía el chat: primero API directa (fiable), luego n8n si hace falta.
 */
export async function postChatMessage(payload, headerConfig) {
  const opts = { timeout: 180000, ...headerConfig };
  const n8nOpts = { timeout: 8000, ...headerConfig };

  let directErr = null;

  try {
    const direct = await axios.post('/api/chat', payload, opts);
    if (isValidChatPayload(direct.data)) {
      return { data: unwrapChatPayload(direct.data), via: 'api' };
    }
    directErr = new Error('La API respondió sin texto de chat.');
  } catch (e) {
    directErr = e;
  }

  let n8nErr = null;
  try {
    const n8n = await axios.post('/n8n/chat', payload, n8nOpts);
    if (isValidChatPayload(n8n.data)) {
      return { data: unwrapChatPayload(n8n.data), via: 'n8n' };
    }
    n8nErr = new Error('n8n respondió sin contenido de chat.');
  } catch (e) {
    n8nErr = e;
  }

  const err = directErr || n8nErr || new Error('Sin respuesta');
  err.n8nAttempted = true;
  err.directAttempted = true;
  throw err;
}
