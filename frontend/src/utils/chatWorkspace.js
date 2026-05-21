/** Workspace gratuito: hasta 2 chats en cookie, cupo de auditorías compartido (vía userId en API). */
export const FREE_CHAT_SLOTS = 2;
const COOKIE_NAME = 'cedit_web_workspace';
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
    isDocAck: m.isDocAck,
    isFreemiumBlock: m.isFreemiumBlock,
  };
}

export function deriveChatTitle(messages = []) {
  const userMsg = messages.find(
    (m) => m.role === 'user' && !String(m.content || '').startsWith('📄 Documento adjunto')
  );
  if (!userMsg) {
    const fileMsg = messages.find((m) => m.role === 'user' && (m.isFile || m.content?.includes('.pdf')));
    if (fileMsg) {
      const match = String(fileMsg.content || '').match(/\*\*([^*]+\.pdf)\*\*/i);
      if (match) return match[1].slice(0, 48);
    }
    return 'Nuevo análisis';
  }
  let raw = String(userMsg.content || '')
    .replace(/[#*`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (raw.length > 48) raw = `${raw.slice(0, 45)}…`;
  return raw || 'Nuevo análisis';
}

export function createEmptyChat(id) {
  return {
    id,
    title: 'Nuevo análisis',
    messages: [],
    sessionMode: 'chat',
    blockchainHash: null,
    updatedAt: Date.now(),
  };
}

function trimChat(chat) {
  return {
    id: chat.id,
    title: (chat.title || 'Nuevo análisis').slice(0, 56),
    messages: (chat.messages || []).slice(-MAX_MESSAGES).map(trimMessage),
    sessionMode: chat.sessionMode || 'chat',
    blockchainHash: chat.blockchainHash || null,
    updatedAt: chat.updatedAt || Date.now(),
  };
}

export function loadWebWorkspace() {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
    if (!match) return null;
    const data = JSON.parse(decodeURIComponent(match[1]));
    if (!data?.activeChatId) return null;
    if (Date.now() - (data.savedAt || 0) > MAX_AGE_SEC * 1000) {
      clearWebWorkspace();
      return null;
    }
    data.chats = (data.chats || []).slice(0, FREE_CHAT_SLOTS).map(trimChat);
    return data;
  } catch {
    return null;
  }
}

export function saveWebWorkspace({ chats, activeChatId }) {
  try {
    const payload = {
      chats: (chats || []).slice(0, FREE_CHAT_SLOTS).map(trimChat),
      activeChatId,
      savedAt: Date.now(),
    };
    let json = JSON.stringify(payload);
    while (json.length > 3900 && payload.chats.length > 1) {
      payload.chats.pop();
      json = JSON.stringify(payload);
    }
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(json)}; path=/; max-age=${MAX_AGE_SEC}; SameSite=Lax`;
  } catch (e) {
    console.warn('cedit workspace cookie', e);
  }
}

function deleteCookie(name) {
  const base = `${name}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
  document.cookie = base;
  if (typeof window !== 'undefined' && window.location?.hostname) {
    document.cookie = `${base}; domain=${window.location.hostname}`;
  }
}

/** Borra todas las cookies de sesión/chats del workspace web. */
export function clearWebWorkspace() {
  deleteCookie(COOKIE_NAME);
  deleteCookie('cedit_web_session');
}

/** Tras reiniciar memoria: un solo chat vacío en cookie (sin historial lateral). */
export function saveFreshWorkspace(chat) {
  const single = trimChat(chat);
  saveWebWorkspace({ chats: [single], activeChatId: single.id });
  return single;
}

export function packActiveChat({ conversationId, messages, sessionMode, blockchainHash, title }) {
  return trimChat({
    id: conversationId,
    title: title || deriveChatTitle(messages),
    messages,
    sessionMode,
    blockchainHash,
    updatedAt: Date.now(),
  });
}
