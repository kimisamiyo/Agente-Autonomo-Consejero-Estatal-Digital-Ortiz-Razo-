import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import PremiumModal, { STORAGE_WALLET, STORAGE_NAME, STORAGE_PRO } from './components/PremiumModal';

const FREE_LIMIT = 10;

function getUserId() {
  let id = localStorage.getItem('cedit_user_id');
  if (!id) {
    id = `web_${crypto.randomUUID?.() || Date.now()}`;
    localStorage.setItem('cedit_user_id', id);
  }
  return id;
}

function getConversationId() {
  let id = sessionStorage.getItem('cedit_conversation_id');
  if (!id) {
    id = `conv_${crypto.randomUUID?.() || Date.now()}`;
    sessionStorage.setItem('cedit_conversation_id', id);
  }
  return id;
}

function resetConversationId() {
  sessionStorage.removeItem('cedit_conversation_id');
}

const buildApiHeaders = (userId, conversationId, wallet = '') => ({
  headers: {
    'X-User-Id': userId,
    'X-Conversation-Id': conversationId,
    ...(wallet ? { 'X-Wallet-Address': wallet } : {}),
  },
});

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('React Error Boundary:', error, errorInfo);
    this.setState({ errorInfo });
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

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistoryList, setChatHistoryList] = useState([]);
  const [usage, setUsage] = useState({ count: 0, limit: FREE_LIMIT, remaining: FREE_LIMIT });
  const [sessionMode, setSessionMode] = useState('chat');
  const [blockchainHash, setBlockchainHash] = useState(null);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [walletAddress, setWalletAddress] = useState(() => localStorage.getItem(STORAGE_WALLET) || '');
  const [premiumName, setPremiumName] = useState(() => localStorage.getItem(STORAGE_NAME) || '');
  const [isPremium, setIsPremium] = useState(() => localStorage.getItem(STORAGE_PRO) === 'true');
  const userId = getUserId();
  const [conversationId, setConversationId] = useState(getConversationId);

  const apiHeaders = () => buildApiHeaders(userId, conversationId, walletAddress);

  const API_URL_N8N = '/n8n';
  const API_URL_DIRECT = '/api';

  const syncUsage = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL_DIRECT}/usage`, apiHeaders());
      setUsage(data);
      if (data.is_pro) setIsPremium(true);
    } catch {
      /* ignore */
    }
  }, [userId, conversationId, walletAddress]);

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

  const applyBotPayload = (data, extra = {}) => {
    const mode = data.mode || 'chat';
    if (mode === 'audit' || mode === 'plan') setSessionMode(mode);
    if (data.usage) setUsage(data.usage);
    const content = data.display || data.response;
    return {
      role: 'bot',
      content,
      fullContent: data.response,
      mode,
      isAudit: mode === 'audit',
      showPdf: data.show_pdf ?? false,
      opinion: data.opinion,
      strengths: data.strengths,
      ...extra,
    };
  };

  const handleFreemiumError = (error, newMessages) => {
    const detail = error.response?.data?.detail || 'Límite freemium alcanzado.';
    setMessages([
      ...newMessages,
      {
        role: 'bot',
        content: `🔒 **Límite de esta conversación**\n\n${detail}\n\nPulsa **Nuevo Análisis** para reiniciar y recuperar auditorías gratis. Las **Herramientas Pro** no consumen cupo.`,
        mode: 'freemium',
      },
    ]);
    setSessionMode('freemium');
    syncUsage();
  };

  const handleSendMessage = async (text, options = {}) => {
    if (!text.trim()) return;
    if (usage.freemium_exceeded && !isPremium && !options.isPremiumTool) {
      const userMessage = { role: 'user', content: text };
      handleFreemiumError({ response: { data: { detail: '' } } }, [...messages, userMessage]);
      return;
    }

    const userMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);

    const payload = {
      message: text,
      history: messages.map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.fullContent || m.content })),
      canal: 'web',
      user_id: userId,
      conversation_id: conversationId,
    };

    try {
      const response = await axios.post(`${API_URL_N8N}/chat`, payload, { timeout: 12000, ...apiHeaders() });
      setMessages([...newMessages, applyBotPayload(response.data)]);
    } catch {
      try {
        const response = await axios.post(`${API_URL_DIRECT}/chat`, payload, apiHeaders());
        setMessages([...newMessages, applyBotPayload(response.data)]);
      } catch (error) {
        if (error.response?.status === 402) {
          handleFreemiumError(error, newMessages);
        } else {
          setMessages([
            ...newMessages,
            { role: 'bot', content: '❌ Error al procesar. Verifica que `uvicorn api:app --reload` esté activo.' },
          ]);
        }
      }
    } finally {
      setIsLoading(false);
      syncUsage();
    }
  };

  const handleUploadFile = async (file, userText) => {
    if (usage.freemium_exceeded && !isPremium) {
      handleFreemiumError({ response: { data: { detail: '' } } }, messages);
      return;
    }

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

    try {
      const response = await axios.post(`${API_URL_DIRECT}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...apiHeaders().headers,
        },
      });

      try {
        const reg = await axios.post(
          `${API_URL_N8N}/chat`,
          {
            message: response.data.blockchain_payload || `[REGISTRO BLOCKCHAIN] Auditoría: ${file.name}`,
            history: [],
            canal: 'web',
            user_id: userId,
          },
          { timeout: 5000 }
        );
        if (reg.data?.hash) setBlockchainHash(reg.data.hash);
      } catch {
        /* blockchain opcional */
      }

      setMessages([
        ...newMessages,
        applyBotPayload(response.data, { filename: file.name, isAudit: true }),
      ]);
    } catch (error) {
      if (error.response?.status === 402) {
        handleFreemiumError(error, newMessages);
      } else {
        const detail = error.response?.data?.detail;
        const msg = typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? detail.map((d) => d.msg || d).join(', ')
            : 'Error al procesar el PDF.';
        setMessages([
          ...newMessages,
          {
            role: 'bot',
            content: `❌ **No se pudo cargar el PDF**\n\n${msg}\n\nVerifica que el archivo tenga texto (no solo imagen escaneada) y que la API esté activa.`,
          },
        ]);
      }
    } finally {
      setIsLoading(false);
      syncUsage();
    }
  };

  const handleRefinePlan = async (originalContent, userRequest) => {
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
      setMessages([...newMessages, applyBotPayload(response.data, { isRefinement: true })]);
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
    syncUsage();
  };

  const handleNewChat = () => {
    if (messages.length > 0) {
      const title = messages.find((m) => m.role === 'user')?.content || 'Análisis';
      setChatHistoryList([{ title: `${title.substring(0, 28)}...` }, ...chatHistoryList]);
    }
    setMessages([]);
    setSessionMode('chat');
    setBlockchainHash(null);
    resetConversationId();
    setConversationId(getConversationId());
    syncUsage();
  };

  return (
    <div className="bg-background text-on-surface h-screen flex overflow-hidden font-body-md">
      <ErrorBoundary>
        <Sidebar isOpen={isSidebarOpen} toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} history={chatHistoryList} onNewChat={handleNewChat} sessionMode={sessionMode} />
      </ErrorBoundary>
      <ErrorBoundary>
        <ChatInterface
          isSidebarOpen={isSidebarOpen}
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
          freemiumExceeded={usage.freemium_exceeded && !isPremium}
          isPremium={isPremium}
          premiumName={premiumName}
          onOpenPremium={() => setPremiumOpen(true)}
          apiHeaders={apiHeaders()}
        />
      </ErrorBoundary>
      <PremiumModal
        isOpen={premiumOpen}
        onClose={() => setPremiumOpen(false)}
        onActivated={handlePremiumActivated}
        userId={userId}
        apiHeaders={apiHeaders()}
      />
    </div>
  );
}

export default App;
