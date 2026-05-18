import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import axios from 'axios';
import ToolsDropdown from './ToolsDropdown';

const MODE_CONFIG = {
  chat: { label: 'Consulta normativa', icon: 'forum', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  audit: { label: 'Modo auditoría MEF', icon: 'fact_check', color: 'bg-red-50 text-red-900 border-red-200' },
  plan: { label: 'Plan de inversión', icon: 'architecture', color: 'bg-amber-50 text-amber-900 border-amber-200' },
  freemium: { label: 'Límite freemium', icon: 'lock', color: 'bg-amber-50 text-amber-800 border-amber-300' },
};

const ChatInterface = ({
  messages,
  isLoading,
  onSendMessage,
  onUploadFile,
  onRefinePlan,
  toggleSidebar,
  usage = { count: 0, limit: 10 },
  sessionMode = 'chat',
  blockchainHash,
  userId,
  freemiumExceeded,
  isPremium = false,
  premiumName = '',
  onOpenPremium,
  apiHeaders,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [refineTarget, setRefineTarget] = useState(null);
  const [generatingPdf, setGeneratingPdf] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const messageCount = usage.count ?? 0;
  const freeLimit = usage.limit ?? 10;
  const isPremiumSession = sessionMode === 'audit' || sessionMode === 'plan' || messages.some((m) => m.isAudit || m.showPdf);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const shouldShowPdfButton = (msg) => {
    if (msg.showPdf) return true;
    if (msg.isAudit) return true;
    return false;
  };

  const handleSend = () => {
    if ((!inputValue.trim() && !selectedFile) || isLoading) return;

    if (refineTarget && inputValue.trim() && onRefinePlan) {
      onRefinePlan(refineTarget, inputValue.trim());
      setRefineTarget(null);
      setInputValue('');
      return;
    }

    if (selectedFile) {
      onUploadFile(selectedFile, inputValue);
      setSelectedFile(null);
    } else {
      onSendMessage(inputValue);
    }
    setInputValue('');
    const ta = document.getElementById('chat-textarea');
    if (ta) ta.style.height = 'auto';
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e) => {
    setInputValue(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file?.type === 'application/pdf') {
      setSelectedFile(file);
      if (!inputValue.trim()) {
        setInputValue(`Audita este plan de proyecto para aprobación en el MEF: ${file.name}`);
      }
    } else if (file) alert('Solo archivos PDF.');
  };

  const handleGeneratePDF = async (msg, index) => {
    setGeneratingPdf(index);
    try {
      const content = msg.fullContent || msg.content;
      const history = messages.map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.fullContent || m.content,
      }));
      const response = await axios.post(
        '/api/generate-pdf',
        {
          content,
          title: msg.filename ? `Plan MEF — ${msg.filename}` : 'Plan Técnico Oficial CEDIT',
          project_name: 'Proyecto de Inversión Pública',
          history,
          user_id: userId,
        },
        { responseType: 'blob', ...(apiHeaders ? apiHeaders() : { headers: { 'X-User-Id': userId } }) }
      );
      const hash = response.headers['x-blockchain-hash'];
      if (hash) {
        /* parent could read via callback; optional */
      }
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `CEDIT_Plan_${Date.now()}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : 'Error al generar el PDF.';
      if (err.response?.status === 402) alert('Límite freemium alcanzado en esta conversación.');
      else alert(msg);
    } finally {
      setGeneratingPdf(null);
    }
  };

  const startRefine = (msg) => {
    setRefineTarget(msg.fullContent || msg.content);
    setInputValue('Corrije el plan: ');
    document.getElementById('chat-textarea')?.focus();
  };

  const modeCfg = MODE_CONFIG[sessionMode] || MODE_CONFIG.chat;

  return (
    <main className="flex-1 relative flex flex-col h-full w-full bg-background overflow-hidden">
      <header className="md:hidden sticky top-0 z-30 bg-surface-container-lowest border-b border-border-gray flex justify-between items-center px-4 h-16">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-slate-800" style={{ fontVariationSettings: '"FILL" 1' }}>assured_workload</span>
          <h1 className="font-bold text-slate-800">CEDIT</h1>
        </div>
        <button type="button" className="p-2 rounded-lg text-slate-600" onClick={toggleSidebar}>
          <span className="material-symbols-outlined">menu</span>
        </button>
      </header>

      {/* Modo sesión */}
      {sessionMode !== 'chat' && (
        <div className={`shrink-0 border-b px-4 py-2 flex justify-center cedit-mode-enter ${modeCfg.color} border`}>
          <div className="max-w-[850px] w-full flex items-center gap-2 text-xs font-semibold">
            <span className="material-symbols-outlined text-base">{modeCfg.icon}</span>
            {modeCfg.label}
            {sessionMode === 'audit' && (
              <span className="text-[10px] font-normal opacity-80 ml-2">— Opinión + puntos fuertes + dictamen</span>
            )}
          </div>
        </div>
      )}

      {/* Freemium */}
      {(isPremiumSession || isPremium) && (
        <div className="shrink-0 w-full bg-white/90 backdrop-blur border-b border-border-gray px-4 py-2 flex justify-center z-10">
          <div className="w-full max-w-[850px] flex items-center gap-3">
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">bolt</span>
              {messageCount}/{freeLimit} auditorías
            </span>
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  freemiumExceeded ? 'bg-red-500' : messageCount >= freeLimit - 2 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min((messageCount / freeLimit) * 100, 100)}%` }}
              />
            </div>
            {isPremium ? (
              <>
                <span className="text-xs font-semibold text-amber-800 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">diamond</span>
                  Premium · {premiumName}
                </span>
                <span className="text-[10px] text-slate-500">Auditorías ilimitadas</span>
              </>
            ) : freemiumExceeded ? (
              <button
                type="button"
                onClick={onOpenPremium}
                className="text-[11px] font-bold text-white bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-1 rounded-full hover:opacity-90 flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[12px]">account_balance_wallet</span>
                Activar modo Premium
              </button>
            ) : (
              <button type="button" onClick={onOpenPremium} className="text-[10px] text-slate-500 hover:text-amber-700">
                Premium
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto w-full px-4 md:px-gutter py-6 flex justify-center">
        <div className="w-full max-w-[850px] flex flex-col gap-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center text-center mt-12 cedit-fade-in">
              <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center shadow-lg mb-6 cedit-float">
                <span className="material-symbols-outlined text-white text-3xl" style={{ fontVariationSettings: '"FILL" 1' }}>assured_workload</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-3">Consejero Estatal Digital</h2>
              <p className="text-slate-600 max-w-2xl mb-10">
                Chat normativo, auditoría de planes PDF y documentos MEF — misma experiencia que en Discord.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                {[
                  { t: 'Servidores Públicos', d: 'Registrar proyecto en Invierte.pe', action: () => onSendMessage('¿Cuáles son los pasos para registrar un proyecto en Invierte.pe?') },
                  { t: 'Auditoría MEF', d: 'Sube tu plan en PDF', action: () => fileInputRef.current?.click() },
                  { t: 'Ciudadanos', d: 'Derechos administrativos', action: () => onSendMessage('¿Qué derechos tengo si una entidad pública no responde mi solicitud?') },
                  { t: 'Conceptos', d: 'Perfil vs expediente técnico', action: () => onSendMessage('Explícame la diferencia entre perfil y expediente técnico.') },
                ].map((card) => (
                  <button
                    key={card.t}
                    type="button"
                    className="text-left bg-white border border-border-gray p-5 rounded-xl hover:border-red-300 hover:shadow-md transition-all duration-300 cedit-card-hover"
                    onClick={card.action}
                  >
                    <h3 className="text-sm font-bold text-slate-800 mb-1">{card.t}</h3>
                    <p className="text-sm text-slate-600">{card.d}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={index}
                className={`flex w-full cedit-message-enter ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                style={{ animationDelay: `${Math.min(index * 40, 200)}ms` }}
              >
                {msg.role === 'user' ? (
                  <div className="bg-white border border-border-gray p-5 rounded-2xl rounded-tr-md max-w-[85%] shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-slate-400 text-sm">person</span>
                      <span className="text-xs text-slate-500">Tú</span>
                    </div>
                    <div className="prose prose-sm max-w-none text-slate-800">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                ) : (
                  <div className="w-full max-w-[95%] flex flex-col gap-2">
                    <div className="flex items-center gap-2 ml-2">
                      <div className="w-6 h-6 bg-slate-800 rounded-md flex items-center justify-center">
                        <span className="material-symbols-outlined text-white text-[12px]" style={{ fontVariationSettings: '"FILL" 1' }}>assured_workload</span>
                      </div>
                      <span className="text-xs font-semibold text-slate-700">CEDIT Asesor</span>
                      {msg.mode === 'audit' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-bold uppercase">Auditoría</span>
                      )}
                    </div>

                    <div className={`bg-white border p-6 sm:p-8 rounded-2xl rounded-tl-md shadow-sm ${msg.isAudit ? 'cedit-audit-glow border-red-100' : 'border-border-gray'}`}>
                      {msg.isAudit && msg.opinion && (
                        <div className="mb-4 p-4 rounded-xl bg-gradient-to-br from-red-50 to-amber-50 border border-red-100 cedit-fade-in">
                          <p className="text-[10px] font-bold uppercase text-red-800 mb-2 flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">favorite</span>
                            Mi opinión (para guiarte)
                          </p>
                          <div className="prose prose-sm text-slate-800">
                            <ReactMarkdown>{msg.opinion || msg.content.split('##')[0]}</ReactMarkdown>
                          </div>
                        </div>
                      )}

                      <div className="prose prose-sm max-w-none text-slate-800">
                        <ReactMarkdown>{msg.isAudit && msg.opinion ? (msg.strengths ? `### Puntos fuertes\n${msg.strengths}` : '') : msg.content}</ReactMarkdown>
                        {msg.isAudit && msg.opinion && msg.content.includes('## Dictamen') && (
                          <details className="mt-4 group">
                            <summary className="cursor-pointer text-sm font-semibold text-slate-700 hover:text-red-800 transition-colors">
                              Ver dictamen técnico completo
                            </summary>
                            <div className="mt-2 pt-2 border-t">
                              <ReactMarkdown>{msg.fullContent || msg.content}</ReactMarkdown>
                            </div>
                          </details>
                        )}
                      </div>

                      {shouldShowPdfButton(msg) && (
                        <div className="mt-6 bg-gradient-to-r from-red-50 to-amber-50 rounded-xl p-5 border border-red-100 text-center cedit-pdf-cta">
                          <p className="text-xs font-bold text-slate-800 uppercase mb-1">Documento para el MEF</p>
                          <p className="text-[11px] text-slate-600 mb-4 max-w-md mx-auto">
                            El botón genera el <strong>plan técnico oficial</strong> con estructura Invierte.pe. La opinión y puntos fuertes ya están arriba.
                          </p>
                          <div className="flex flex-wrap gap-2 justify-center">
                            <button
                              type="button"
                              onClick={() => handleGeneratePDF(msg, index)}
                              disabled={generatingPdf === index || freemiumExceeded}
                              className="px-5 py-2.5 text-xs font-bold text-white rounded-full bg-gradient-to-r from-red-700 to-red-600 shadow-md hover:scale-[1.03] transition-all disabled:opacity-50 cedit-pulse-btn"
                            >
                              {generatingPdf === index ? 'Generando PDF...' : 'Generar Plan Técnico Oficial (PDF)'}
                            </button>
                            <button
                              type="button"
                              onClick={() => startRefine(msg)}
                              className="px-4 py-2.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-full hover:border-blue-400 transition-all"
                            >
                              Corregir plan
                            </button>
                          </div>
                        </div>
                      )}

                      {(msg.isAudit || messages[index - 1]?.isFile) && (
                        <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3 cedit-fade-in">
                          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                          <p className="text-xs text-slate-600 font-mono">
                            Syscoin: {blockchainHash || 'registro pendiente'}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between px-2">
                      <button type="button" className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1" onClick={() => navigator.clipboard.writeText(msg.fullContent || msg.content)}>
                        <span className="material-symbols-outlined text-[16px]">content_copy</span> Copiar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}

          {isLoading && (
            <div className="cedit-message-enter flex gap-2 ml-2">
              <div className="bg-white border border-border-gray p-6 rounded-2xl">
                <div className="flex gap-1.5">
                  {[0, 150, 300].map((d) => (
                    <div key={d} className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="shrink-0 border-t border-border-gray bg-background px-4 py-4 flex justify-center">
        <div className="w-full max-w-[850px]">
          {refineTarget && (
            <p className="text-[11px] text-blue-800 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mb-2 cedit-fade-in">
              Modo corrección: describe los cambios y pulsa Analizar (llama a /api/refine-plan).
            </p>
          )}
          {selectedFile && (
            <div className="mb-2 flex items-center gap-2 text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2 cedit-fade-in">
              <span className="material-symbols-outlined text-red-600">picture_as_pdf</span>
              <span className="truncate flex-1 font-medium">{selectedFile.name}</span>
              <button type="button" onClick={() => setSelectedFile(null)} className="text-slate-400 hover:text-slate-800">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          )}
          <div className="bg-white border border-border-gray rounded-xl shadow-sm focus-within:ring-1 focus-within:ring-slate-400 overflow-hidden transition-shadow">
            <textarea
              id="chat-textarea"
              className="w-full border-0 focus:ring-0 resize-none py-4 px-5 text-slate-800 placeholder:text-slate-400 min-h-[60px] bg-transparent"
              placeholder={refineTarget ? 'Ej: Aumenta el presupuesto de supervisión al 8%...' : 'Consulta normativa o adjunta plan PDF para auditoría MEF...'}
              rows={1}
              value={inputValue}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
            <div className="flex justify-between items-center px-3 py-2 bg-slate-50 border-t border-border-gray">
              <div className="flex gap-1 items-center">
                <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />
                <button type="button" className="p-2 text-slate-500 hover:bg-slate-200 rounded-lg text-xs" onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
                  <span className="material-symbols-outlined text-sm">attach_file</span>
                </button>
                <ToolsDropdown
                  disabled={isLoading}
                  onSelectTool={(prompt) => onSendMessage(prompt, { isPremiumTool: true })}
                />
              </div>
              <button
                type="button"
                className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-slate-900 transition-colors"
                onClick={handleSend}
                disabled={(!inputValue.trim() && !selectedFile) || isLoading}
              >
                {refineTarget ? 'Aplicar corrección' : 'Analizar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default ChatInterface;
