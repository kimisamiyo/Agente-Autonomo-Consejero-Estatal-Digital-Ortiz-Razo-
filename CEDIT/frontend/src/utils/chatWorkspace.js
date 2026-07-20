import { slimGuideGraph } from './auditDecisionPoints';

/** Workspace gratuito: hasta 2 chats; persistencia en localStorage (cookies solo migración). */
export const FREE_CHAT_SLOTS = 2;
/** Plan Pro (wallet conectada): chats recientes en localStorage, sin tope de 2. */
export const PREMIUM_CHAT_MAX = 50;
const PREMIUM_LS_PREFIX = 'cedit_premium_workspace_';
const LS_WORKSPACE_KEY = 'cedit_web_workspace';
const COOKIE_NAME = 'cedit_web_workspace';
const MAX_AGE_SEC = 7 * 24 * 60 * 60;
const MAX_MESSAGES = 24;
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
    guidePhase: m.guidePhase,
    guideCompleteness: m.guideCompleteness,
    // Conserva nodes/critical_items para que el panel «Expediente y recorrido» no quede vacío al recargar
    guideGraph: slimGuideGraph(m.guideGraph) || undefined,
    consumesAuditCredit: m.consumesAuditCredit,
    checkpointId: m.checkpointId,
    mefScore: m.mefScore
      ? {
          document_only_index: m.mefScore.document_only_index,
          estimated_with_official_plan: m.mefScore.estimated_with_official_plan,
          risk_index: m.mefScore.risk_index,
          risk_level: m.mefScore.risk_level,
        }
      : undefined,
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
    decisionCheckpoints: [],
    nodePositions: {},
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
    decisionCheckpoints: (chat.decisionCheckpoints || []).slice(-48),
    nodePositions: chat.nodePositions || {},
    updatedAt: chat.updatedAt || Date.now(),
  };
}

function parseWorkspacePayload(raw) {
  const data = JSON.parse(raw);
  if (!data?.activeChatId) return null;
  if (Date.now() - (data.savedAt || 0) > MAX_AGE_SEC * 1000) return null;
  data.chats = (data.chats || []).slice(0, FREE_CHAT_SLOTS).map(trimChat);
  return data;
}

export function loadWebWorkspace() {
  try {
    const fromLs = localStorage.getItem(LS_WORKSPACE_KEY);
    if (fromLs) {
      const data = parseWorkspacePayload(fromLs);
      if (data) return data;
      localStorage.removeItem(LS_WORKSPACE_KEY);
    }
    const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
    if (!match) return null;
    const data = parseWorkspacePayload(decodeURIComponent(match[1]));
    if (data) {
      localStorage.setItem(LS_WORKSPACE_KEY, JSON.stringify({
        chats: data.chats,
        activeChatId: data.activeChatId,
        savedAt: Date.now(),
      }));
      deleteCookie(COOKIE_NAME);
    }
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
    localStorage.setItem(LS_WORKSPACE_KEY, JSON.stringify(payload));
    deleteCookie(COOKIE_NAME);
  } catch (e) {
    console.warn('cedit workspace localStorage', e);
    try {
      const payload = {
        chats: (chats || []).slice(0, 1).map(trimChat),
        activeChatId,
        savedAt: Date.now(),
      };
      let json = JSON.stringify(payload);
      while (json.length > 3900 && payload.chats[0]?.messages?.length > 2) {
        payload.chats[0].messages.shift();
        json = JSON.stringify(payload);
      }
      document.cookie = `${COOKIE_NAME}=${encodeURIComponent(json)}; path=/; max-age=${MAX_AGE_SEC}; SameSite=Lax`;
    } catch (e2) {
      console.warn('cedit workspace cookie fallback', e2);
    }
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
  try {
    localStorage.removeItem(LS_WORKSPACE_KEY);
  } catch {
    /* ignore */
  }
}

/** Tras reiniciar memoria: un solo chat vacío en cookie (sin historial lateral). */
export function saveFreshWorkspace(chat) {
  const single = trimChat(chat);
  saveWebWorkspace({ chats: [single], activeChatId: single.id });
  return single;
}

export function loadPremiumWorkspace(wallet) {
  if (!wallet) return null;
  try {
    const key = PREMIUM_LS_PREFIX + wallet.toLowerCase();
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.activeChatId) return null;
    data.chats = (data.chats || []).slice(0, PREMIUM_CHAT_MAX).map(trimChat);
    return data;
  } catch {
    return null;
  }
}

export function savePremiumWorkspace({ chats, activeChatId, wallet }) {
  if (!wallet) return;
  try {
    const key = PREMIUM_LS_PREFIX + wallet.toLowerCase();
    const payload = {
      chats: (chats || []).slice(0, PREMIUM_CHAT_MAX).map(trimChat),
      activeChatId,
      savedAt: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch (e) {
    console.warn('cedit premium workspace', e);
  }
}

export function packActiveChat({
  conversationId,
  messages,
  sessionMode,
  blockchainHash,
  title,
  decisionCheckpoints,
  nodePositions,
}) {
  return trimChat({
    id: conversationId,
    title: title || deriveChatTitle(messages),
    messages,
    sessionMode,
    blockchainHash,
    decisionCheckpoints,
    nodePositions,
    updatedAt: Date.now(),
  });
}
