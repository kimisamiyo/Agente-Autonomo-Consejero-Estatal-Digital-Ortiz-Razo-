import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import SettingsView from './components/SettingsView';
import ExpedientesView from './components/ExpedientesView';
import NormativasView from './components/NormativasView';
import { loadSettings, applySettingsToDocument } from './utils/userSettings';
import { I18nProvider } from './i18n/I18nContext';
import FreemiumGateModal from './components/FreemiumGateModal';
import PremiumModal, { STORAGE_WALLET, STORAGE_NAME, STORAGE_PRO } from './components/PremiumModal';
import {
  loadWebWorkspace,
  saveWebWorkspace,
  clearWebWorkspace,
  saveFreshWorkspace,
  createEmptyChat,
  packActiveChat,
  deriveChatTitle,
  FREE_CHAT_SLOTS,
} from './utils/chatWorkspace';
import { postChatMessage, formatChatError } from './utils/chatApi';
import {
  appendCheckpoint,
  pruneCheckpointsAfter,
  shouldCreateCheckpoint,
  trimCheckpointForStorage,
} from './utils/auditDecisionPoints';

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

function initWorkspace() {
  const saved = loadWebWorkspace();
  if (saved?.chats?.length && saved.activeChatId) {
    const active = saved.chats.find((c) => c.id === saved.activeChatId) || saved.chats[0];
    return { chats: saved.chats, active };
  }
  const id = newConversationId();
  const chat = createEmptyChat(id);
  return { chats: [chat], active: chat };
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
  const [activeCheckpointId, setActiveCheckpointId] = useState(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [usage, setUsage] = useState({ count: 0, limit: FREE_LIMIT, remaining: FREE_LIMIT });
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [gateModal, setGateModal] = useState({ open: false, mode: 'limit' });
  const [walletAddress, setWalletAddress] = useState(() => localStorage.getItem(STORAGE_WALLET) || '');
  const [premiumName, setPremiumName] = useState(() => localStorage.getItem(STORAGE_NAME) || '');
  const [isPremium, setIsPremium] = useState(() => localStorage.getItem(STORAGE_PRO) === 'true');
  const [activeView, setActiveView] = useState('chat');
  const [userSettings, setUserSettings] = useState(() => loadSettings());

  const userId = getUserId();
  const usageScopeId = isPremium ? conversationId : userId;
  const apiHeaders = () => buildApiHeaders(userId, usageScopeId, walletAddress, userSettings.locale || 'es');

  useEffect(() => {
    applySettingsToDocument(userSettings);
  }, [userSettings]);

  const API_URL_DIRECT = '/api';

  const freemiumBlocked = usage.freemium_exceeded && !isPremium;

  const persistWorkspace = useCallback(
    (nextChats, activeId) => {
      if (!isPremium) {
        saveWebWorkspace({ chats: nextChats, activeChatId: activeId });
      }
    },
    [isPremium]
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
        else next = [packed, ...next].slice(0, FREE_CHAT_SLOTS);
        persistWorkspace(next, packed.id);
        return next;
      });
    },
    [conversationId, messages, sessionMode, blockchainHash, decisionCheckpoints, nodePositions, persistWorkspace]
  );

  useEffect(() => {
    if (skipWorkspaceSyncRef.current) {
      skipWorkspaceSyncRef.current = false;
      return;
    }
    if (!isPremium) syncChatsWithActive();
  }, [messages, sessionMode, conversationId, blockchainHash, decisionCheckpoints, nodePositions, isPremium, syncChatsWithActive]);

  const syncUsage = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL_DIRECT}/usage`, apiHeaders());
      setUsage(data);
      if (data.is_pro) setIsPremium(true);
      if (data.freemium_exceeded && !data.is_pro) setSessionMode('freemium');
    } catch {
      /* ignore */
    }
  }, [userId, usageScopeId, walletAddress, isPremium]);

  useEffect(() => {
    const w = localStorage.getItem(STORAGE_WALLET);
    if (w && localStorage.getItem(STORAGE_PRO) === 'true') {
      axios.post(`${API_URL_DIRECT}/premium/connect`, { wallet: w }, apiHeaders())
        .then(({ data }) => {
          setPremiumName(data.display_name);
          setIsPremium(true);
        })
        .catch(() => {
          localStorage.removeItem(STORAGE_PRO);
          setIsPremium(false);
        });
    }
  }, []);

  useEffect(() => {
    syncUsage();
  }, [syncUsage]);

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
      setConversationId(chat.id);
      setMessages(chat.messages || []);
      setSessionMode(chat.sessionMode || 'chat');
      setBlockchainHash(chat.blockchainHash || null);
      setDecisionCheckpoints(chat.decisionCheckpoints || []);
      setNodePositions(chat.nodePositions || {});
      setActiveCheckpointId(null);
      persistWorkspace(chats, chat.id);
    },
    [chats, persistWorkspace]
  );

  const applyBotPayload = (data, extra = {}) => {
    const mode = data.mode || 'chat';
    const billable = data.consumes_audit_credit === true;
    if (billable) setSessionMode(data.input_mode === 'plan' ? 'plan' : 'audit');
    else if (mode === 'freemium') setSessionMode('freemium');
    if (data.usage) setUsage(data.usage);
    const content = data.display || data.response || '';
    return {
      role: 'bot',
      content,
      fullContent: data.response,
      mode,
      isAudit: mode === 'audit',
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
      const trimmed = messages.slice(0, cp.messageIndex + 1);
      setMessages(trimmed);
      setSessionMode(cp.sessionMode || 'audit');
      setDecisionCheckpoints((prev) =>
        pruneCheckpointsAfter(prev, cp.messageIndex).map(trimCheckpointForStorage)
      );
      setActiveCheckpointId(cp.id);
      syncChatsWithActive({
        messages: trimmed,
        sessionMode: cp.sessionMode || 'audit',
        decisionCheckpoints: pruneCheckpointsAfter(decisionCheckpoints, cp.messageIndex),
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
    nextChats = nextChats.slice(0, FREE_CHAT_SLOTS);

    if (!isPremium && nextChats.length >= FREE_CHAT_SLOTS) {
      setChats(nextChats);
      persistWorkspace(nextChats, conversationId);
      setGateModal({ open: true, mode: 'maxChats' });
      return;
    }

    const newId = newConversationId();
    const newChat = createEmptyChat(newId);
    const finalChats = [...nextChats, newChat].slice(0, FREE_CHAT_SLOTS);

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
      nextChats = [packed, ...nextChats].slice(0, FREE_CHAT_SLOTS);
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

  const handlePremiumActivated = ({ wallet, displayName, isPro }) => {
    setWalletAddress(wallet);
    setPremiumName(displayName);
    setIsPremium(isPro);
    setGateModal({ open: false, mode: 'limit' });
    syncUsage();
  };

  const recentChats = chats.map((c) => ({
    id: c.id,
    title: c.id === conversationId ? deriveChatTitle(messages) || c.title : c.title,
  }));

  const canCreateNewChat = isPremium || chats.length < FREE_CHAT_SLOTS;

  return (
    <I18nProvider locale={userSettings.locale || 'es'}>
    <div className="bg-background text-on-surface h-screen flex overflow-hidden font-body-md">
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
          isPremium={isPremium}
        />
      </ErrorBoundary>
      <ErrorBoundary>
        {activeView === 'settings' && (
          <SettingsView settings={userSettings} onSettingsChange={setUserSettings} />
        )}
        {activeView === 'expedientes' && <ExpedientesView />}
        {activeView === 'normativas' && (
          <NormativasView
            onConsultNormativa={(prompt) => {
              setActiveView('chat');
              if (prompt?.trim()) handleSendMessage(prompt);
            }}
          />
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
            userId={userId}
            uiLocale={userSettings.locale || 'es'}
            freemiumExceeded={freemiumBlocked}
            isPremium={isPremium}
            premiumName={premiumName}
            onOpenPremium={() => {
              setGateModal({ open: false, mode: 'limit' });
              setPremiumOpen(true);
            }}
            onRequestResetMemory={() => setGateModal({ open: true, mode: 'reset' })}
            apiHeaders={apiHeaders}
            decisionCheckpoints={decisionCheckpoints}
            nodePositions={nodePositions}
            activeCheckpointId={activeCheckpointId}
            onRestoreCheckpoint={restoreToCheckpoint}
            onNodePositionChange={handleNodePositionChange}
          />
        )}
      </ErrorBoundary>
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
