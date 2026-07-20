import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import SettingsView from './components/SettingsView';
import ExpedientesView from './components/ExpedientesView';
import NormativasView from './components/NormativasView';
import SupportView from './components/SupportView';
import { loadSettings, applySettingsToDocument } from './utils/userSettings';
import { I18nProvider } from './i18n/I18nContext';
import FreemiumGateModal from './components/FreemiumGateModal';
import PremiumModal, {
  STORAGE_WALLET,
  STORAGE_NAME,
  STORAGE_PRO,
  activatePremiumWallet,
} from './components/PremiumModal';
import { fetchRestoredConversation, saveSavedTokenId } from './blockchain/conversationRestore';
import { setupWalletListeners, getLinkedAccount } from './blockchain/wallet';
import {
  loadWebWorkspace,
  saveWebWorkspace,
  clearWebWorkspace,
  saveFreshWorkspace,
  createEmptyChat,
  packActiveChat,
  deriveChatTitle,
  FREE_CHAT_SLOTS,
  PREMIUM_CHAT_MAX,
  loadPremiumWorkspace,
  savePremiumWorkspace,
} from './utils/chatWorkspace';
import { postChatMessage, formatChatError } from './utils/chatApi';
import {
  appendCheckpoint,
  ensureDecisionCheckpoints,
  forkCheckpointsAt,
  shouldCreateCheckpoint,
  trimCheckpointForStorage,
} from './utils/auditDecisionPoints';
import CommandPalette from './components/CommandPalette';
import JewelFab from './components/JewelFab';
import ShortcutsGuide from './components/ShortcutsGuide';
import ToolsDrawer from './components/ToolsDrawer';
import { startIconMotionObserver } from './utils/iconMotion';

const FREE_LIMIT = 10;

function getUserId() {
  let id = localStorage.getItem('cedit_user_id');
  if (!id) {
    id = `web_${crypto.randomUUID?.() || Date.now()}`;
    localStorage.setItem('cedit_user_id', id);
  }
  return id;
}

function newConversationId() {
  return `conv_${crypto.randomUUID?.() || Date.now()}`;
}

const buildApiHeaders = (userId, usageScopeId, wallet = '', locale = 'es') => ({
  headers: {
    'X-User-Id': userId,
    'X-Conversation-Id': usageScopeId,
    'X-Locale': locale,
    ...(wallet ? { 'X-Wallet-Address': wallet } : {}),
  },
});

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('React Error Boundary:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 bg-red-50 text-red-900 w-full h-full flex flex-col items-start justify-center">
          <h1 className="text-2xl font-bold mb-4">React App Crashed</h1>
          <pre className="bg-white p-4 rounded border text-xs overflow-auto max-w-full">
            {this.state.error?.toString()}
          </pre>
          <button type="button" onClick={() => window.location.reload()} className="mt-6 px-4 py-2 bg-red-600 text-white rounded">
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function hydrateChat(chat) {
  const decisionCheckpoints = ensureDecisionCheckpoints(chat);
  return { ...chat, decisionCheckpoints };
}

function initWorkspace() {
  const saved = loadWebWorkspace();
  if (saved?.chats?.length && saved.activeChatId) {
    const chats = saved.chats.map(hydrateChat);
    const active = chats.find((c) => c.id === saved.activeChatId) || chats[0];
    const lastCp = [...(active.decisionCheckpoints || [])].filter((c) => !c.abandoned).pop();
    return { chats, active, activeCheckpointId: lastCp?.id || null };
  }
  const id = newConversationId();
  const chat = createEmptyChat(id);
  return { chats: [chat], active: chat, activeCheckpointId: null };
}

function App() {
  const initial = useRef(initWorkspace());
  const skipWorkspaceSyncRef = useRef(false);
  const [chats, setChats] = useState(initial.current.chats);
  const [conversationId, setConversationId] = useState(initial.current.active.id);
  const [messages, setMessages] = useState(initial.current.active.messages || []);
  const [sessionMode, setSessionMode] = useState(initial.current.active.sessionMode || 'chat');
  const [blockchainHash, setBlockchainHash] = useState(initial.current.active.blockchainHash || null);
  const [decisionCheckpoints, setDecisionCheckpoints] = useState(
    initial.current.active.decisionCheckpoints || []
  );
  const [nodePositions, setNodePositions] = useState(initial.current.active.nodePositions || {});
  const [activeCheckpointId, setActiveCheckpointId] = useState(
    initial.current.activeCheckpointId || null
  );

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [canBriefing, setCanBriefing] = useState(false);
  const [usage, setUsage] = useState({ count: 0, limit: FREE_LIMIT, remaining: FREE_LIMIT });
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [gateModal, setGateModal] = useState({ open: false, mode: 'limit' });
  const [walletAddress, setWalletAddress] = useState(() => localStorage.getItem(STORAGE_WALLET) || '');
  const [premiumName, setPremiumName] = useState(() => localStorage.getItem(STORAGE_NAME) || '');
  const [isPremium, setIsPremium] = useState(false);
  const [activeView, setActiveView] = useState('chat');
  const [expedientesRefreshKey, setExpedientesRefreshKey] = useState(0);
  const [highlightExpId, setHighlightExpId] = useState('');
  const [userSettings, setUserSettings] = useState(() => loadSettings());

  const userId = getUserId();

  useEffect(() => {
    applySettingsToDocument(userSettings);
  }, [userSettings]);

  useEffect(() => startIconMotionObserver(), []);

  const API_URL_DIRECT = '/api';

  /** Plan Pro confirmado por API (activate + /usage con is_pro) */
  const proActive = Boolean(walletAddress?.trim()) && isPremium;

  const handlePdfExpedienteSaved = useCallback((exp) => {
    setExpedientesRefreshKey((k) => k + 1);
    setHighlightExpId(exp?.id || '');
    setActiveView('expedientes');
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  }, []);

  const linkWalletSession = useCallback(
    async (address) => {
      const w = (address || '').trim();
      if (!w) {
        setWalletAddress('');
        setIsPremium(false);
        localStorage.removeItem(STORAGE_WALLET);
        localStorage.removeItem(STORAGE_PRO);
        return null;
      }
      setWalletAddress(w);
      localStorage.setItem(STORAGE_WALLET, w);
      try {
        const data = await activatePremiumWallet({
          wallet: w,
          userId,
          apiHeaders: buildApiHeaders(userId, conversationId, w, userSettings.locale || 'es'),
        });
        setPremiumName(data.display_name);
        setIsPremium(true);
        localStorage.setItem(STORAGE_PRO, 'true');
        return data;
      } catch (err) {
        console.warn('Plan Pro no confirmado:', err);
        setIsPremium(false);
        localStorage.removeItem(STORAGE_PRO);
        return null;
      }
    },
    [userId, conversationId, userSettings.locale]
  );

  const usageScopeId = proActive ? conversationId : userId;
  const apiHeaders = () => buildApiHeaders(userId, usageScopeId, walletAddress, userSettings.locale || 'es');

  const freemiumBlocked = usage.freemium_exceeded && !proActive;

  const chatSlotCap = proActive ? PREMIUM_CHAT_MAX : FREE_CHAT_SLOTS;

  const persistWorkspace = useCallback(
    (nextChats, activeId) => {
      if (proActive && walletAddress) {
        savePremiumWorkspace({ chats: nextChats, activeChatId: activeId, wallet: walletAddress });
      } else {
        saveWebWorkspace({ chats: nextChats, activeChatId: activeId });
      }
    },
    [proActive, walletAddress]
  );

  const syncChatsWithActive = useCallback(
    (override = {}) => {
      const packed = packActiveChat({
        conversationId: override.conversationId ?? conversationId,
        messages: override.messages ?? messages,
        sessionMode: override.sessionMode ?? sessionMode,
        blockchainHash: override.blockchainHash ?? blockchainHash,
        decisionCheckpoints: override.decisionCheckpoints ?? decisionCheckpoints,
        nodePositions: override.nodePositions ?? nodePositions,
      });
      setChats((prev) => {
        const idx = prev.findIndex((c) => c.id === packed.id);
        let next = [...prev];
        if (idx >= 0) next[idx] = packed;
        else next = [packed, ...next].slice(0, chatSlotCap);
        persistWorkspace(next, packed.id);
        return next;
      });
    },
    [conversationId, messages, sessionMode, blockchainHash, decisionCheckpoints, nodePositions, persistWorkspace, chatSlotCap]
  );

  useEffect(() => {
    if (skipWorkspaceSyncRef.current) {
      skipWorkspaceSyncRef.current = false;
      return;
    }
    syncChatsWithActive();
  }, [messages, sessionMode, conversationId, blockchainHash, decisionCheckpoints, nodePositions, syncChatsWithActive]);

  const syncUsage = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL_DIRECT}/usage`, apiHeaders());
      setUsage(data);
      if (walletAddress) {
        const confirmed = data.is_pro === true;
        setIsPremium(confirmed);
        if (confirmed) localStorage.setItem(STORAGE_PRO, 'true');
        else localStorage.removeItem(STORAGE_PRO);
      } else {
        setIsPremium(false);
        localStorage.removeItem(STORAGE_PRO);
      }
      if (data.freemium_exceeded && !proActive) setSessionMode('freemium');
    } catch {
      /* ignore */
    }
  }, [userId, usageScopeId, walletAddress, isPremium, proActive]);

  const applyChainRestore = useCallback(
    async (wallet) => {
      try {
        const data = await fetchRestoredConversation(
          wallet,
          buildApiHeaders(userId, conversationId, wallet, userSettings.locale || 'es')
        );
        if (!data?.messages?.length) return false;
        const restoredChat = packActiveChat({
          conversationId: newConversationId(),
          messages: data.messages.map((m) => ({
            role: m.role,
            content: m.content,
            fullContent: m.content,
            mode: m.mode || 'chat',
          })),
          sessionMode: 'chat',
          blockchainHash: data.user_hash || null,
        });
        restoredChat.title = deriveChatTitle(restoredChat.messages);
        skipWorkspaceSyncRef.current = true;
        setChats([restoredChat]);
        setConversationId(restoredChat.id);
        setMessages(restoredChat.messages);
        setSessionMode('chat');
        setBlockchainHash(data.user_hash || null);
        setDecisionCheckpoints([]);
        setNodePositions({});
        if (data.token_id != null) saveSavedTokenId(wallet, data.token_id);
        persistWorkspace([restoredChat], restoredChat.id);
        return true;
      } catch (err) {
        if (err.response?.status !== 404) console.warn('restore conversation', err);
        return false;
      }
    },
    [userId, conversationId, userSettings.locale, persistWorkspace]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let w = localStorage.getItem(STORAGE_WALLET) || '';
      const linked = await getLinkedAccount();
      if (linked) w = linked;
      if (!w || cancelled) return;

      const data = await linkWalletSession(w);
      if (cancelled) return;
      if (!data) return;

      const walletKey = data.wallet || w;
      const premiumWs = loadPremiumWorkspace(walletKey);
      if (premiumWs?.chats?.length) {
        skipWorkspaceSyncRef.current = true;
        const hydratedChats = premiumWs.chats.map(hydrateChat);
        const active = hydratedChats.find((c) => c.id === premiumWs.activeChatId) || hydratedChats[0];
        const lastCp = [...(active.decisionCheckpoints || [])].filter((c) => !c.abandoned).pop();
        setChats(hydratedChats);
        setConversationId(active.id);
        setMessages(active.messages || []);
        setSessionMode(active.sessionMode || 'chat');
        setBlockchainHash(active.blockchainHash || null);
        setDecisionCheckpoints(active.decisionCheckpoints || []);
        setNodePositions(active.nodePositions || {});
        setActiveCheckpointId(lastCp?.id || null);
      } else {
        await applyChainRestore(walletKey);
      }
      syncUsage();
    })();
    return () => {
      cancelled = true;
    };
  }, [linkWalletSession, applyChainRestore]);

  useEffect(() => {
    try {
      setupWalletListeners((addr) => {
        if (addr) linkWalletSession(addr);
        else {
          setWalletAddress('');
          setIsPremium(false);
          localStorage.removeItem(STORAGE_WALLET);
          localStorage.removeItem(STORAGE_PRO);
        }
      });
    } catch {
      /* ignore */
    }
  }, [linkWalletSession]);

  useEffect(() => {
    syncUsage();
  }, [syncUsage]);

  /** Si Pali/MetaMask conectó el sitio después de cargar la página */
  useEffect(() => {
    if (proActive) return undefined;
    const poll = setInterval(async () => {
      const linked = await getLinkedAccount();
      if (linked) await linkWalletSession(linked);
    }, 2000);
    const stop = setTimeout(() => clearInterval(poll), 20000);
    const onFocus = async () => {
      const linked = await getLinkedAccount();
      if (linked) linkWalletSession(linked);
    };
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(poll);
      clearTimeout(stop);
      window.removeEventListener('focus', onFocus);
    };
  }, [proActive, isPremium, linkWalletSession]);

  const openLimitGate = useCallback(() => {
    setGateModal({ open: true, mode: 'limit' });
  }, []);

  const blockIfFreemium = useCallback(() => {
    if (freemiumBlocked) {
      openLimitGate();
      return true;
    }
    return false;
  }, [freemiumBlocked, openLimitGate]);

  const loadChat = useCallback(
    (chat) => {
      const hydrated = hydrateChat(chat);
      const lastCp = [...(hydrated.decisionCheckpoints || [])].filter((c) => !c.abandoned).pop();
      setConversationId(hydrated.id);
      setMessages(hydrated.messages || []);
      setSessionMode(hydrated.sessionMode || 'chat');
      setBlockchainHash(hydrated.blockchainHash || null);
      setDecisionCheckpoints(hydrated.decisionCheckpoints || []);
      setNodePositions(hydrated.nodePositions || {});
      setActiveCheckpointId(lastCp?.id || null);
      persistWorkspace(chats, hydrated.id);
    },
    [chats, persistWorkspace]
  );

  const applyBotPayload = (data, extra = {}) => {
    const mode = data.mode || 'chat';
    const inputMode = data.input_mode || mode;
    const mentorMode = inputMode === 'audit' || inputMode === 'plan' || mode === 'audit' || mode === 'plan';
    const billable = data.consumes_audit_credit === true;
    if (billable) setSessionMode(inputMode === 'plan' ? 'plan' : 'audit');
    else if (mode === 'freemium') setSessionMode('freemium');
    if (data.usage) setUsage(data.usage);
    const content = data.display || data.response || '';
    return {
      role: 'bot',
      content,
      fullContent: data.response,
      mode: mentorMode ? inputMode : mode,
      isAudit: mentorMode,
      showPdf: data.show_pdf ?? false,
      opinion: data.opinion,
      strengths: data.strengths,
      dictamen: data.dictamen,
      sourceExcerpt: data.source_excerpt,
      needsMoreInfo: data.needs_more_info,
      pageCount: data.page_count,
      charCount: data.char_count,
      consumesAuditCredit: billable,
      mefScore: data.mef_score,
      guideGraph: data.guide_graph,
      guidePhase: data.guide_phase,
      guideCompleteness: data.guide_completeness,
      mentorActivity: data.mentor_activity || '',
      monitoringFigures: data.monitoring_figures || [],
      ...extra,
    };
  };

  const registerAuditCheckpoint = useCallback(
    (fullMessages, botMsg, modeHint) => {
      if (!shouldCreateCheckpoint(botMsg)) return botMsg;
      const idx = fullMessages.length - 1;
      let latestCp = null;
      setDecisionCheckpoints((prev) => {
        const cps = appendCheckpoint(prev, fullMessages, idx, botMsg, modeHint || sessionMode);
        latestCp = cps[cps.length - 1];
        return cps.map(trimCheckpointForStorage);
      });
      if (latestCp) setActiveCheckpointId(latestCp.id);
      return latestCp ? { ...botMsg, checkpointId: latestCp.id } : botMsg;
    },
    [sessionMode]
  );

  const restoreToCheckpoint = useCallback(
    (cp) => {
      if (!cp || cp.messageIndex == null) return;
      // Rama abandonada: vuelve al punto de bifurcación sin borrar otras ramas
      const target =
        cp.abandoned && cp.forkFromId
          ? decisionCheckpoints.find((c) => c.id === cp.forkFromId) || cp
          : cp;
      if (target.abandoned) return;

      const trimmed = messages.slice(0, target.messageIndex + 1);
      setMessages(trimmed);
      setSessionMode(target.sessionMode || 'audit');
      const forked = forkCheckpointsAt(decisionCheckpoints, target).map(trimCheckpointForStorage);
      setDecisionCheckpoints(forked);
      setActiveCheckpointId(target.id);
      syncChatsWithActive({
        messages: trimmed,
        sessionMode: target.sessionMode || 'audit',
        decisionCheckpoints: forked,
      });
    },
    [messages, decisionCheckpoints, syncChatsWithActive]
  );

  const handleNodePositionChange = useCallback((cpId, pos) => {
    setNodePositions((prev) => ({ ...prev, [cpId]: pos }));
  }, []);

  const performFullReset = useCallback(async () => {
    try {
      await axios.post(`${API_URL_DIRECT}/reset-freemium`, {}, apiHeaders());
    } catch {
      /* ignore */
    }

    clearWebWorkspace();

    const id = newConversationId();
    const chat = saveFreshWorkspace(createEmptyChat(id));

    skipWorkspaceSyncRef.current = true;
    setChats([chat]);
    setConversationId(chat.id);
    setMessages([]);
    setSessionMode('chat');
    setBlockchainHash(null);
    setDecisionCheckpoints([]);
    setNodePositions({});
    setActiveCheckpointId(null);
    setActiveView('chat');
    setGateModal({ open: false, mode: 'limit' });
    syncUsage();
  }, [apiHeaders, syncUsage]);

  const handleFreemiumError = (error, newMessages) => {
    const detail = error.response?.data?.detail || 'Ha alcanzado el límite de 10 auditorías.';
    setMessages([
      ...newMessages,
      {
        role: 'bot',
        content: `🔒 **Límite (${usage.count ?? 10}/10 auditorías compartidas)**\n\n${detail}`,
        mode: 'freemium',
        isFreemiumBlock: true,
      },
    ]);
    setSessionMode('freemium');
    syncUsage();
    openLimitGate();
  };

  const requestNewChat = () => {
    if (blockIfFreemium()) return;

    const packed = packActiveChat({
      conversationId,
      messages,
      sessionMode,
      blockchainHash,
      decisionCheckpoints,
      nodePositions,
    });
    let nextChats = chats.map((c) => (c.id === conversationId ? packed : c));
    if (!nextChats.some((c) => c.id === conversationId) && messages.length > 0) {
      nextChats = [packed, ...nextChats];
    }
    if (!proActive) nextChats = nextChats.slice(0, FREE_CHAT_SLOTS);

    if (!proActive && nextChats.length >= FREE_CHAT_SLOTS) {
      setChats(nextChats);
      persistWorkspace(nextChats, conversationId);
      setGateModal({ open: true, mode: 'maxChats' });
      return;
    }

    const newId = newConversationId();
    const newChat = createEmptyChat(newId);
    const finalChats = proActive
      ? [...nextChats, newChat].slice(0, PREMIUM_CHAT_MAX)
      : [...nextChats, newChat].slice(0, FREE_CHAT_SLOTS);

    setChats(finalChats);
    loadChat(newChat);
    persistWorkspace(finalChats, newId);
  };

  const handleSelectChat = (chatId) => {
    if (chatId === conversationId) return;
    if (blockIfFreemium()) return;

    const packed = packActiveChat({
      conversationId,
      messages,
      sessionMode,
      blockchainHash,
      decisionCheckpoints,
      nodePositions,
    });
    let nextChats = chats.map((c) => (c.id === conversationId ? packed : c));
    if (!nextChats.find((c) => c.id === conversationId) && messages.length > 0) {
      nextChats = [packed, ...nextChats].slice(0, chatSlotCap);
    }
    const target = nextChats.find((c) => c.id === chatId);
    if (!target) return;
    setChats(nextChats);
    loadChat(target);
    persistWorkspace(nextChats, chatId);
  };

  const handleSendMessage = async (text, options = {}) => {
    if (!text.trim()) return;
    if (blockIfFreemium() && !options.isPremiumTool) return;

    const userMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);

    const payload = {
      message: text,
      history: messages.map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.fullContent || m.content,
      })),
      canal: 'web',
      user_id: userId,
      conversation_id: conversationId,
      locale: userSettings.locale || 'es',
      session_mode: sessionMode,
    };

    try {
      const { data } = await postChatMessage(payload, apiHeaders());
      const botRaw = applyBotPayload(data);
      const bot = registerAuditCheckpoint([...newMessages, botRaw], botRaw, data.input_mode);
      setMessages([...newMessages, bot]);
    } catch (error) {
      if (error.response?.status === 402) handleFreemiumError(error, newMessages);
      else {
        const hint = formatChatError(error, { n8nAttempted: error.n8nAttempted !== false });
        setMessages([
          ...newMessages,
          {
            role: 'bot',
            content: `❌ **No se pudo obtener respuesta**\n\n${hint}`,
            mode: 'chat',
          },
        ]);
      }
    } finally {
      setIsLoading(false);
      syncUsage();
    }
  };

  const handleUploadFile = async (file, userText) => {
    if (blockIfFreemium()) return;

    const userMsgs = [];
    if (userText?.trim()) userMsgs.push({ role: 'user', content: userText });
    userMsgs.push({ role: 'user', content: `📄 Documento adjunto: **${file.name}**`, isFile: true });

    const newMessages = [...messages, ...userMsgs];
    setMessages(newMessages);
    setIsLoading(true);
    setSessionMode('audit');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('user_text', userText || '');
    formData.append('canal', 'web');
    formData.append('locale', userSettings.locale || 'es');

    try {
      const response = await axios.post(`${API_URL_DIRECT}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data', ...apiHeaders().headers },
      });

      const docAck = {
        role: 'bot',
        content:
          `📄 **Documento recibido**\n\n¡He recibido tu archivo exitosamente!\n\n` +
          `**Archivo:** \`${file.name}\`\n` +
          (response.data.page_count != null
            ? `**Páginas:** ${response.data.page_count}\n**Caracteres:** ${Number(response.data.char_count || 0).toLocaleString()}\n\n`
            : '') +
          'Revisando expediente según normativa **MEF / Invierte.pe**…',
        mode: 'audit',
        isDocAck: true,
      };

      const botRaw = applyBotPayload(response.data, { filename: file.name, isAudit: true });
      const withAck = [...newMessages, docAck, botRaw];
      const bot = registerAuditCheckpoint(withAck, botRaw, 'audit');
      setMessages([...newMessages, docAck, bot]);
    } catch (error) {
      if (error.response?.status === 402) handleFreemiumError(error, newMessages);
      else {
        const detail = error.response?.data?.detail;
        const msg = typeof detail === 'string' ? detail : 'Error al procesar el PDF.';
        setMessages([...newMessages, { role: 'bot', content: `❌ **No se pudo cargar el PDF**\n\n${msg}` }]);
      }
    } finally {
      setIsLoading(false);
      syncUsage();
    }
  };

  const handleRefinePlan = async (originalContent, userRequest) => {
    if (blockIfFreemium()) return;

    const userMessage = { role: 'user', content: userRequest };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await axios.post(
        `${API_URL_DIRECT}/refine-plan`,
        {
          original_content: originalContent,
          user_request: userRequest,
          history: messages.map((m) => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.fullContent || m.content,
          })),
          user_id: userId,
        },
        apiHeaders()
      );
      const botRaw = applyBotPayload(response.data, { isRefinement: true });
      const bot = registerAuditCheckpoint([...newMessages, botRaw], botRaw, 'plan');
      setMessages([...newMessages, bot]);
      setSessionMode('plan');
    } catch (error) {
      if (error.response?.status === 402) handleFreemiumError(error, newMessages);
      else setMessages([...newMessages, { role: 'bot', content: '❌ No se pudo corregir el plan.' }]);
    } finally {
      setIsLoading(false);
      syncUsage();
    }
  };

  const handlePremiumActivated = async ({ wallet, displayName }) => {
    const data = await linkWalletSession(wallet);
    if (!data) return;
    if (displayName) setPremiumName(displayName);
    setSessionMode((m) => (m === 'freemium' ? 'chat' : m));
    setGateModal({ open: false, mode: 'limit' });
    setUsage({ count: 0, limit: '∞', remaining: '∞', freemium_exceeded: false, is_pro: true });
    const premiumWs = loadPremiumWorkspace(data.wallet || wallet);
    if (premiumWs?.chats?.length) {
      skipWorkspaceSyncRef.current = true;
      const active = premiumWs.chats.find((c) => c.id === premiumWs.activeChatId) || premiumWs.chats[0];
      setChats(premiumWs.chats);
      loadChat(active);
    } else {
      const restored = await applyChainRestore(data.wallet || wallet);
      if (!restored) persistWorkspace(chats, conversationId);
    }
    syncUsage();
  };

  const recentChats = chats.map((c) => ({
    id: c.id,
    title: c.id === conversationId ? deriveChatTitle(messages) || c.title : c.title,
  }));

  const canCreateNewChat = proActive || chats.length < FREE_CHAT_SLOTS;

  useEffect(() => {
    const onKey = (e) => {
      const meta = e.metaKey || e.ctrlKey;
      const tag = (e.target?.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || e.target?.isContentEditable;
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdkOpen(true);
        return;
      }
      if (meta && e.key === '/') {
        e.preventDefault();
        setKeysOpen(true);
        return;
      }
      if (e.key === 'Escape' && !typing) {
        setCmdkOpen(false);
        setKeysOpen(false);
        setToolsOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const openToolsFromJewel = useCallback(() => {
    setActiveView('chat');
    setToolsOpen(true);
    setCmdkOpen(false);
  }, []);

  const openBriefingFromJewel = useCallback(() => {
    setActiveView('chat');
    setBriefingOpen(true);
    setCmdkOpen(false);
  }, []);

  return (
    <I18nProvider locale={userSettings.locale || 'es'}>
    <div className="cedit-app-shell bg-background text-on-surface h-screen flex overflow-hidden font-body-md">
      <ErrorBoundary>
        <Sidebar
          isOpen={isSidebarOpen}
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          recentChats={recentChats}
          activeChatId={conversationId}
          activeView={activeView}
          onNavigateView={(view) => {
            setActiveView(view);
            if (window.innerWidth < 768) setIsSidebarOpen(false);
          }}
          onSelectChat={(chatId) => {
            setActiveView('chat');
            handleSelectChat(chatId);
          }}
          onNewChat={() => {
            setActiveView('chat');
            requestNewChat();
          }}
          onResetMemory={() => setGateModal({ open: true, mode: 'reset' })}
          sessionMode={sessionMode}
          usage={usage}
          canCreateNewChat={canCreateNewChat}
          isPremium={proActive}
        />
      </ErrorBoundary>
      <ErrorBoundary>
        {activeView === 'settings' && (
          <SettingsView settings={userSettings} onSettingsChange={setUserSettings} />
        )}
        {activeView === 'expedientes' && (
          <ExpedientesView
            refreshKey={expedientesRefreshKey}
            highlightExpId={highlightExpId}
            walletAddress={walletAddress}
            isPremium={proActive}
            userId={userId}
            apiHeaders={apiHeaders}
            onOpenPremium={() => {
              setPremiumOpen(true);
            }}
            onGoChat={() => setActiveView('chat')}
          />
        )}
        {activeView === 'normativas' && (
          <NormativasView
            onConsultNormativa={(prompt) => {
              setActiveView('chat');
              if (prompt?.trim()) handleSendMessage(prompt);
            }}
          />
        )}
        {activeView === 'support' && (
          <SupportView onGoChat={() => setActiveView('chat')} />
        )}
        {activeView === 'chat' && (
          <ChatInterface
            toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            messages={messages}
            isLoading={isLoading}
            onSendMessage={handleSendMessage}
            onUploadFile={handleUploadFile}
            onRefinePlan={handleRefinePlan}
            usage={usage}
            sessionMode={sessionMode}
            blockchainHash={blockchainHash}
            conversationId={conversationId}
            walletAddress={walletAddress}
            onMintSuccess={async (data) => {
              const h = data?.user_hash || data?.user_hash_preview;
              if (h) setBlockchainHash(h);
              const w = data?.recipient || walletAddress;
              if (data?.token_id != null && w) saveSavedTokenId(w, data.token_id);
              if (w && !proActive) {
                try {
                  const entry = await activatePremiumWallet({
                    wallet: w,
                    userId,
                    apiHeaders: apiHeaders(),
                  });
                  await handlePremiumActivated({
                    wallet: entry.wallet,
                    displayName: entry.display_name,
                    isPro: true,
                  });
                } catch {
                  setWalletAddress(w);
                }
              }
            }}
            onConversationSaved={(data) => {
              const h = data?.user_hash;
              if (h) setBlockchainHash(h);
              if (data?.token_id != null && walletAddress) {
                saveSavedTokenId(walletAddress, data.token_id);
              }
              if (data?.token_id != null) {
                setMessages((prev) => [
                  ...prev,
                  {
                    role: 'bot',
                    content: `✅ **Conversación guardada en blockchain** — NFT #${data.token_id}`,
                    mode: 'chat',
                    isDocAck: true,
                  },
                ]);
              }
            }}
            userId={userId}
            uiLocale={userSettings.locale || 'es'}
            freemiumExceeded={freemiumBlocked}
            isPremium={proActive}
            premiumName={premiumName}
            onOpenPremium={() => {
              setGateModal({ open: false, mode: 'limit' });
              setPremiumOpen(true);
            }}
            onRequestResetMemory={() => setGateModal({ open: true, mode: 'reset' })}
            apiHeaders={apiHeaders}
            onPdfExpedienteSaved={handlePdfExpedienteSaved}
            decisionCheckpoints={decisionCheckpoints}
            nodePositions={nodePositions}
            activeCheckpointId={activeCheckpointId}
            onRestoreCheckpoint={restoreToCheckpoint}
            onNodePositionChange={handleNodePositionChange}
            onOpenCmdk={() => setCmdkOpen(true)}
            briefingOpen={briefingOpen}
            onBriefingClose={() => setBriefingOpen(false)}
            onBriefingAvailability={setCanBriefing}
          />
        )}
      </ErrorBoundary>
      <JewelFab
        hidden={cmdkOpen || keysOpen || toolsOpen || briefingOpen || premiumOpen || gateModal.open}
        onOpenCmdk={() => setCmdkOpen(true)}
        onOpenTools={openToolsFromJewel}
        onOpenKeys={() => setKeysOpen(true)}
      />
      <CommandPalette
        open={cmdkOpen}
        onClose={() => setCmdkOpen(false)}
        onNavigate={(view) => {
          setActiveView(view);
          setCmdkOpen(false);
        }}
        onNewChat={() => {
          setActiveView('chat');
          requestNewChat();
        }}
        onOpenTools={openToolsFromJewel}
        onOpenShortcuts={() => {
          setCmdkOpen(false);
          setKeysOpen(true);
        }}
        onOpenBriefing={openBriefingFromJewel}
        canBriefing={canBriefing}
      />
      <ShortcutsGuide
        open={keysOpen}
        onClose={() => setKeysOpen(false)}
        onOpenCmdk={() => {
          setKeysOpen(false);
          setCmdkOpen(true);
        }}
      />
      <ToolsDrawer
        open={toolsOpen}
        onClose={() => setToolsOpen(false)}
        disabled={isLoading}
        onSelectTool={(prompt) => {
          setActiveView('chat');
          if (prompt?.trim()) handleSendMessage(prompt, { isPremiumTool: true });
        }}
      />
      <PremiumModal
        isOpen={premiumOpen}
        onClose={() => setPremiumOpen(false)}
        onActivated={handlePremiumActivated}
        userId={userId}
        apiHeaders={apiHeaders()}
      />
      <FreemiumGateModal
        mode={gateModal.mode}
        isOpen={gateModal.open}
        onClose={() => setGateModal({ open: false, mode: gateModal.mode })}
        onConfirmReset={() => {
          if (gateModal.mode === 'reset') performFullReset();
        }}
        onRequestReset={() => setGateModal({ open: true, mode: 'reset' })}
        onConnectWallet={() => {
          setGateModal({ open: false, mode: 'limit' });
          setPremiumOpen(true);
        }}
        auditCount={usage.count ?? 0}
        limit={typeof usage.limit === 'number' ? usage.limit : FREE_LIMIT}
      />
    </div>
    </I18nProvider>
  );
}

export default App;
