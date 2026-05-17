import React, { useState } from 'react';
import axios from 'axios';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("React Error Boundary Caught:", error, errorInfo);
    this.setState({ errorInfo });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 bg-red-50 text-red-900 w-full h-full flex flex-col items-start justify-center">
          <h1 className="text-2xl font-bold mb-4">React App Crashed 💥</h1>
          <p className="mb-4">Error details:</p>
          <pre className="bg-white p-4 rounded border border-red-200 overflow-auto max-w-full text-xs">
            {this.state.error?.toString()}
            <br/><br/>
            {this.state.errorInfo?.componentStack}
          </pre>
          <button onClick={() => window.location.reload()} className="mt-6 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Recargar Aplicación</button>
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
  const [messageCount, setMessageCount] = useState(0);
  const FREE_LIMIT = 10;

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleNewChat = () => {
    if (messages.length > 0) {
      const title = messages[0].role === 'user' ? messages[0].content : "Chat sin título";
      setChatHistoryList([{ title: title.substring(0, 30) + '...' }, ...chatHistoryList]);
    }
    setMessages([]);
  };

  // n8n via Vite proxy (sin CORS)
  const API_URL_N8N = '/n8n';
  // FastAPI directo via Vite proxy (sin CORS)
  const API_URL_DIRECT = '/api';

  const handleSendMessage = async (text) => {
    if (!text.trim()) return;

    const userMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);

    const payload = { message: text, history: messages };

    try {
      // Intentar n8n primero (orquestador con blockchain)
      const response = await axios.post(`${API_URL_N8N}/chat`, payload, { timeout: 8000 });
      setMessages([...newMessages, { role: 'bot', content: response.data.response }]);
      setMessageCount(prev => prev + 1);
    } catch (n8nError) {
      // Si n8n no responde, fallback a FastAPI directo
      try {
        const response = await axios.post(`${API_URL_DIRECT}/chat`, payload);
        setMessages([...newMessages, { role: 'bot', content: response.data.response }]);
        setMessageCount(prev => prev + 1);
      } catch (error) {
        console.error("Error calling API:", error);
        setMessages([
          ...newMessages,
          { role: 'bot', content: '❌ Ocurrió un error al procesar tu solicitud. Por favor, asegúrate de que el servidor esté en ejecución.' }
        ]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadFile = async (file, userText) => {
    const formData = new FormData();
    formData.append('file', file);

    // Mostrar mensaje del usuario + badge del archivo
    const userMsgs = [];
    if (userText && userText.trim()) {
      userMsgs.push({ role: 'user', content: userText });
    }
    userMsgs.push({ role: 'user', content: `📄 Documento adjunto: **${file.name}**`, isFile: true });

    const newMessages = [...messages, ...userMsgs];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await axios.post(`${API_URL_DIRECT}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const auditResult = response.data.response;

      try {
        await axios.post(`${API_URL_N8N}/chat`, {
          message: `[REGISTRO BLOCKCHAIN] Auditoría: ${file.name}`,
          history: [], canal: 'web', user_id: 'web_audit'
        });
      } catch (e) {}

      setMessages([...newMessages, { role: 'bot', content: auditResult, isAudit: true, filename: file.name }]);
      setMessageCount(prev => prev + 1);
    } catch (error) {
      console.error("Error uploading file:", error);
      setMessages([
        ...newMessages,
        { role: 'bot', content: '❌ Error al subir y procesar el documento. Verifica el formato del PDF o que el servidor esté disponible.' }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-background text-on-surface h-screen flex overflow-hidden font-body-md text-body-md">
      <ErrorBoundary>
        <Sidebar 
          isOpen={isSidebarOpen} 
          toggleSidebar={toggleSidebar}
          history={chatHistoryList}
          onNewChat={handleNewChat}
        />
      </ErrorBoundary>
      <ErrorBoundary>
        <ChatInterface 
          isSidebarOpen={isSidebarOpen}
          toggleSidebar={toggleSidebar}
          messages={messages}
          isLoading={isLoading}
          onSendMessage={handleSendMessage}
          onUploadFile={handleUploadFile}
          messageCount={messageCount}
          freeLimit={FREE_LIMIT}
        />
      </ErrorBoundary>
    </div>
  );
}

export default App;
