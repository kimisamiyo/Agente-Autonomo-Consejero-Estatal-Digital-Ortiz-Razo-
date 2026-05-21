/** Sesión gratuita en cookie (7 días) — mensajes, modo y conversationId */
const COOKIE_NAME = 'cedit_web_session';
const MAX_AGE_SEC = 7 * 24 * 60 * 60;
const MAX_MESSAGES = 16;
const MAX_CONTENT = 3500;
const MAX_FULL = 5000;

function trimMessage(m) {
  return {
    role: m.role,
    content: (m.content || '').slice(0, MAX_CONTENT),
    fullContent: (m.fullContent || m.content || '').slice(0, MAX_FULL),
    mode: m.mode,
    isAudit: m.isAudit,
    showPdf: m.showPdf,
    opinion: (m.opinion || '').slice(0, 1500),
    strengths: (m.strengths || '').slice(0, 1500),
    dictamen: (m.dictamen || '').slice(0, 2000),
    filename: m.filename,
    sourceExcerpt: (m.sourceExcerpt || '').slice(0, 2000),
    isFile: m.isFile,
  };
}

export function saveWebSession({ conversationId, messages, sessionMode }) {
  try {
    const payload = {
      conversationId,
      sessionMode: sessionMode || 'chat',
      messages: (messages || []).slice(-MAX_MESSAGES).map(trimMessage),
      savedAt: Date.now(),
    };
    let json = JSON.stringify(payload);
    while (json.length > 3800 && payload.messages.length > 2) {
      payload.messages.shift();
      json = JSON.stringify(payload);
    }
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(json)}; path=/; max-age=${MAX_AGE_SEC}; SameSite=Lax`;
  } catch (e) {
    console.warn('cedit session cookie', e);
  }
}

export function loadWebSession() {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
    if (!match) return null;
    const data = JSON.parse(decodeURIComponent(match[1]));
    if (!data?.conversationId) return null;
    const age = Date.now() - (data.savedAt || 0);
    if (age > MAX_AGE_SEC * 1000) {
      clearWebSession();
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function clearWebSession() {
  const base = `${COOKIE_NAME}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
  document.cookie = base;
}
