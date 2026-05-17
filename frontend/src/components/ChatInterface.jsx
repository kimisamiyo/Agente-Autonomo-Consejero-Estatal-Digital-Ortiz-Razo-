import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import axios from 'axios';

const ChatInterface = ({ messages, isLoading, onSendMessage, onUploadFile, toggleSidebar, isSidebarOpen, messageCount = 0, freeLimit = 10 }) => {
  const [inputValue, setInputValue] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = () => {
    if ((inputValue.trim() || selectedFile) && !isLoading) {
      if (selectedFile) {
        // Enviar archivo + texto del usuario
        onUploadFile(selectedFile, inputValue);
        setSelectedFile(null);
      } else {
        onSendMessage(inputValue);
      }
      setInputValue('');
      
      const textarea = document.getElementById('chat-textarea');
      if(textarea) {
        textarea.style.height = 'auto';
      }
    }
  };

  // Detectar si la respuesta merece botón de PDF (solo planes estructurados técnicos)
  const shouldShowPdfButton = (msg) => {
    if (msg.isAudit) return true;
    if (msg.role !== 'bot') return false;
    
    const content = msg.content || '';
    
    // Solo si el bot responde con estructura markdown formal (encabezados ## o ###)
    const hasHeadings = content.includes('## ') || content.includes('### ');
    if (!hasHeadings) return false;
    
    const t = content.toLowerCase();
    const technicalKeywords = [
      'plan de', 'expediente', 'dictamen', 'presupuesto', 
      'invierte.pe', 'viabilidad', 'brechas', 'reestructurac'
    ];
    
    return technicalKeywords.some(keyword => t.includes(keyword));
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
    e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px'; // Max height 8rem (32 Tailwind)
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      // Solo prellenamos si el input estaba vacío, de lo contrario respetamos lo que el usuario escribió
      if (!inputValue.trim()) {
        setInputValue(`Por favor, analiza y audita el archivo adjunto: ${file.name}`);
      }
    } else if (file) {
      alert("Por favor selecciona un archivo PDF.");
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Helper to check if a bot message should have the blockchain badge
  const isAuditResponse = (index) => {
    if (index > 0 && messages[index - 1]?.content?.includes('📄 Documento adjunto')) {
      return true;
    }
    return false;
  };

  const [generatingPdf, setGeneratingPdf] = useState(null);

  const handleGeneratePDF = async (content, index) => {
    setGeneratingPdf(index);
    try {
      // Mapear el historial acumulado en el chat para nutrir la versión final del plan
      const formattedHistory = messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));

      const response = await axios.post('/api/generate-pdf', {
        content: content,
        title: messages[index]?.filename ? `Auditoría - ${messages[index].filename}` : 'Plan Estructurado MEF',
        project_name: '',
        history: formattedHistory
      }, { responseType: 'blob' });

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `CEDIT_${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error al generar el PDF.');
    } finally {
      setGeneratingPdf(null);
    }
  };

  const handleModifyPlan = (content) => {
    setInputValue(`Modifica el plan anterior: `);
    const textarea = document.getElementById('chat-textarea');
    if (textarea) textarea.focus();
  };

  return (
    <main className="flex-1 relative flex flex-col h-full w-full max-w-full bg-background overflow-hidden">
      
      {/* TopAppBar Component (Mobile) */}
      <header className="docked full-width top-0 sticky z-30 md:hidden bg-surface-container-lowest border-b border-border-gray shadow-sm flex justify-between items-center w-full px-4 h-16">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-slate-800" style={{ fontVariationSettings: '"FILL" 1' }}>
            assured_workload
          </span>
          <h1 className="text-headline-md font-headline-md font-bold text-slate-800">CEDIT</h1>
        </div>
        <div className="flex gap-4">
          <button 
            className="text-slate-600 hover:bg-slate-100 transition-colors p-2 rounded-lg"
            onClick={toggleSidebar}
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
        </div>
      </header>

      {/* Freemium Progress Bar - Solo aparece en modo auditoría/plan */}
      {messages.some(m => m.isAudit || m.isFile || shouldShowPdfButton(m)) && (
        <div className="shrink-0 w-full bg-white/80 backdrop-blur-sm border-b border-border-gray px-4 md:px-gutter py-2 flex justify-center z-10">
          <div className="w-full max-w-[850px] flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <span className="material-symbols-outlined text-[14px]">bolt</span>
              <span>{messageCount}/{freeLimit} auditorías</span>
            </div>
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  messageCount >= freeLimit ? 'bg-red-500' : messageCount >= freeLimit - 2 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min((messageCount / freeLimit) * 100, 100)}%` }}
              />
            </div>
            {messageCount >= freeLimit ? (
              <button className="text-[11px] font-bold text-white bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-1 rounded-full hover:opacity-90 transition-opacity flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">diamond</span>
                Conectar Wallet
              </button>
            ) : (
              <span className="text-[10px] font-medium text-slate-400">Plan Gratuito</span>
            )}
          </div>
        </div>
      )}

      {/* Chat Scroll Area */}
      <div className="flex-1 overflow-y-auto w-full px-4 md:px-gutter py-6 pb-6 flex justify-center">
        <div className="w-full max-w-[850px] flex flex-col gap-6">
          
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center mt-12 mb-12">
              <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center shadow-lg mb-6">
                <span className="material-symbols-outlined text-white text-3xl" style={{ fontVariationSettings: '"FILL" 1' }}>
                  assured_workload
                </span>
              </div>
              <h2 className="text-headline-lg font-headline-lg text-slate-800 mb-4">Consejero Estatal Digital</h2>
              <p className="text-body-lg text-slate-600 max-w-2xl mb-12">
                Asesor público virtual al servicio del Perú. Te ayudo a entender tus derechos o a revisar tus planes de inversión ante el MEF.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                <div 
                  className="bg-surface-container-lowest border border-border-gray p-5 rounded-xl hover:border-slate-400 hover:shadow-md transition-all cursor-pointer text-left group"
                  onClick={() => onSendMessage("¿Cuáles son los pasos para registrar un proyecto en Invierte.pe?")}
                >
                  <h3 className="text-sm font-bold text-slate-800 mb-1 group-hover:text-peru-red transition-colors">Servidores Públicos</h3>
                  <p className="text-sm text-slate-600">Pasos para registrar un proyecto en Invierte.pe</p>
                </div>
                <div 
                  className="bg-surface-container-lowest border border-border-gray p-5 rounded-xl hover:border-slate-400 hover:shadow-md transition-all cursor-pointer text-left group"
                  onClick={() => triggerFileInput()}
                >
                  <h3 className="text-sm font-bold text-slate-800 mb-1 group-hover:text-peru-red transition-colors">Auditoría de Expedientes</h3>
                  <p className="text-sm text-slate-600">Sube un PDF para verificar cumplimiento MEF</p>
                </div>
                <div 
                  className="bg-surface-container-lowest border border-border-gray p-5 rounded-xl hover:border-slate-400 hover:shadow-md transition-all cursor-pointer text-left group"
                  onClick={() => onSendMessage("¿Qué derechos tengo si una entidad pública no responde mi solicitud?")}
                >
                  <h3 className="text-sm font-bold text-slate-800 mb-1 group-hover:text-peru-red transition-colors">Ciudadanos</h3>
                  <p className="text-sm text-slate-600">Derechos ante el silencio administrativo</p>
                </div>
                <div 
                  className="bg-surface-container-lowest border border-border-gray p-5 rounded-xl hover:border-slate-400 hover:shadow-md transition-all cursor-pointer text-left group"
                  onClick={() => onSendMessage("Explícame la diferencia entre un perfil y un expediente técnico de forma sencilla.")}
                >
                  <h3 className="text-sm font-bold text-slate-800 mb-1 group-hover:text-peru-red transition-colors">Conceptos Claros</h3>
                  <p className="text-sm text-slate-600">Diferencia entre perfil y expediente técnico</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              {messages.map((msg, index) => (
                <div key={index} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'user' ? (
                    // User Message Block
                    <div className="bg-surface-container-lowest border border-border-gray p-5 rounded-2xl rounded-tr-md max-w-[85%] md:max-w-[75%] shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-slate-400 text-sm">person</span>
                        <span className="text-xs font-medium text-slate-500">Tú</span>
                      </div>
                      <div className="text-body-md font-body-md text-slate-800 prose prose-sm max-w-none">
                        <ReactMarkdown>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  ) : (
                    // AI Response Block
                    <div className="w-full max-w-[95%] md:max-w-[90%] flex flex-col gap-2">
                      <div className="flex items-center gap-2 ml-2">
                        <div className="w-6 h-6 bg-slate-800 rounded-md flex items-center justify-center">
                          <span className="material-symbols-outlined text-white text-[12px]" style={{ fontVariationSettings: '"FILL" 1' }}>
                            assured_workload
                          </span>
                        </div>
                        <span className="text-xs font-semibold text-slate-700">CEDIT Asesor</span>
                      </div>
                      
                      <div className="bg-surface-container-lowest border border-border-gray p-6 sm:p-8 rounded-2xl rounded-tl-md shadow-sm">
                        <div className="text-body-md font-body-md text-slate-800 leading-relaxed prose prose-sm max-w-none mb-5">
                          <ReactMarkdown>
                            {msg.content}
                          </ReactMarkdown>
                        </div>

                        {/* Premium Call-to-Action for PDF Generation */}
                        {shouldShowPdfButton(msg) && (
                          <div className="mt-6 bg-gradient-to-r from-red-50 to-amber-50 rounded-xl p-5 border border-red-100 flex flex-col items-center text-center gap-3 shadow-sm">
                            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-700 animate-bounce">
                              <span className="material-symbols-outlined text-[24px]">description</span>
                            </div>
                            <div className="max-w-md">
                              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-1">Plan Técnico Listo para Formular</h4>
                              <p className="text-[11px] text-slate-600 leading-relaxed">
                                Cedit ha diseñado los lineamientos. ¿Deseas formular y estructurar el **Documento Técnico de Reestructuración Oficial** bajo la normativa de **Invierte.pe** del MEF para su presentación?
                              </p>
                            </div>
                            <button
                              onClick={() => handleGeneratePDF(msg.content, index)}
                              disabled={generatingPdf === index}
                              className={`relative px-5 py-2.5 font-bold text-xs text-white rounded-full bg-gradient-to-r from-red-700 to-red-600 shadow-md hover:shadow-lg hover:from-red-800 transition-all duration-300 flex items-center gap-2 ${
                                generatingPdf === index ? 'opacity-85 cursor-wait' : 'hover:scale-[1.03]'
                              }`}
                              style={{
                                animation: generatingPdf === index ? 'none' : 'ce-pulse 1.8s infinite'
                              }}
                            >
                              <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
                              {generatingPdf === index ? 'Formulando Documento...' : 'Generar Plan Técnico Oficial'}
                            </button>
                            
                            <style>{`
                              @keyframes ce-pulse {
                                0% {
                                  box-shadow: 0 0 0 0 rgba(185, 28, 28, 0.4);
                                }
                                70% {
                                  box-shadow: 0 0 0 8px rgba(185, 28, 28, 0);
                                }
                                100% {
                                  box-shadow: 0 0 0 0 rgba(185, 28, 28, 0);
                                }
                              }
                            `}</style>
                          </div>
                        )}
                        
                        {/* Blockchain & Reference Block (Conditional) */}
                        {isAuditResponse(index) && (
                          <div className="mt-6 bg-slate-50 rounded-xl p-5 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5">
                                <span className="material-symbols-outlined text-slate-500 text-lg">link</span>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">Verificación Blockchain</p>
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                  <p className="text-code-sm font-code-sm text-slate-500 text-xs">Syscoin Network: 0x7f8b9...c3a4</p>
                                </div>
                              </div>
                            </div>
                            <a className="flex items-center gap-2 px-4 py-2 border border-border-gray rounded-lg bg-white hover:bg-slate-50 hover:border-peru-red transition-all text-sm font-medium text-slate-700 hover:text-peru-red shadow-sm" href="#">
                              <span className="material-symbols-outlined text-sm">gavel</span>
                              Directiva N° 001-2019-EF
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Feedback Block */}
                      <div className="flex items-center justify-between px-2 w-full max-w-[850px] mx-auto mt-1">
                        <div className="flex items-center gap-1">
                          <button 
                            className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-200 px-2 py-1.5 rounded-md transition-colors" 
                            title="Copiar respuesta"
                            onClick={() => navigator.clipboard.writeText(msg.content)}
                          >
                            <span className="material-symbols-outlined text-[16px]">content_copy</span> Copiar
                          </button>
                          {shouldShowPdfButton(msg) && (
                            <>
                              <div className="w-px h-4 bg-slate-300 mx-1"></div>
                              <button 
                                className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-blue-700 hover:bg-blue-50 px-2 py-1.5 rounded-md transition-colors"
                                title="Pedir cambios al plan"
                                onClick={() => handleModifyPlan(msg.content)}
                              >
                                <span className="material-symbols-outlined text-[16px]">edit_note</span> Modificar Plan
                              </button>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1 bg-surface-container-lowest border border-border-gray rounded-lg p-1 shadow-sm">
                          <button className="text-slate-400 hover:text-green-600 hover:bg-green-50 transition-colors p-1.5 rounded-md flex items-center justify-center" title="Respuesta útil">
                            <span className="material-symbols-outlined text-[18px]">thumb_up</span>
                          </button>
                          <button className="text-slate-400 hover:text-peru-red hover:bg-red-50 transition-colors p-1.5 rounded-md flex items-center justify-center" title="Respuesta no útil">
                            <span className="material-symbols-outlined text-[18px]">thumb_down</span>
                          </button>
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex justify-start w-full">
              <div className="w-full max-w-[95%] md:max-w-[90%] flex flex-col gap-2">
                <div className="flex items-center gap-2 ml-2">
                  <div className="w-6 h-6 bg-slate-800 rounded-md flex items-center justify-center">
                    <span className="material-symbols-outlined text-white text-[12px]" style={{ fontVariationSettings: '"FILL" 1' }}>
                      assured_workload
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-slate-700">CEDIT Asesor</span>
                </div>
                <div className="bg-surface-container-lowest border border-border-gray p-6 sm:p-8 rounded-2xl rounded-tl-md shadow-sm w-fit">
                  <div className="flex gap-1.5 items-center">
                    <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Bottom Input Bar Block */}
      <div className="shrink-0 w-full bg-background pt-3 pb-4 px-4 md:px-gutter flex flex-col items-center z-20 border-t border-border-gray">
        <div className="w-full max-w-[850px] relative">
          
          {selectedFile && (
            <div className="absolute -top-12 left-0 bg-white border border-slate-200 rounded-lg px-4 py-2 flex items-center gap-3 shadow-sm text-sm">
              <span className="material-symbols-outlined text-red-500">picture_as_pdf</span>
              <span className="text-slate-700 font-medium truncate max-w-[200px] sm:max-w-xs">{selectedFile.name}</span>
              <button 
                className="ml-2 text-slate-400 hover:text-slate-800 flex items-center justify-center"
                onClick={() => { setSelectedFile(null); }}
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          )}

          <div className="flex flex-col bg-surface-container-lowest border border-border-gray rounded-xl shadow-sm focus-within:border-slate-400 focus-within:ring-1 focus-within:ring-slate-400 transition-all overflow-hidden">
            <textarea 
              id="chat-textarea"
              className="w-full bg-transparent border-none focus:ring-0 resize-none py-4 px-5 text-body-md font-body-md text-slate-800 placeholder:text-slate-400 min-h-[60px]" 
              placeholder="Redacte su consulta normativa o adjunte un expediente..." 
              rows="1"
              value={inputValue}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
            <div className="flex justify-between items-center px-3 py-2 bg-slate-50 border-t border-border-gray">
              <div className="flex gap-1">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  style={{ display: 'none' }} 
                  accept="application/pdf"
                  onChange={handleFileChange}
                />
                <button 
                  className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors rounded-lg flex items-center gap-2 text-xs font-medium"
                  onClick={triggerFileInput}
                  disabled={isLoading}
                >
                  <span className="material-symbols-outlined text-sm">attach_file</span>
                  <span className="hidden sm:inline">Adjuntar</span>
                </button>
                <button className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors rounded-lg flex items-center gap-2 text-xs font-medium">
                  <span className="material-symbols-outlined text-sm">mic</span>
                </button>
              </div>
              <button 
                className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors flex items-center gap-2 text-sm font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleSend}
                disabled={(!inputValue.trim() && !selectedFile) || isLoading}
              >
                <span className="">Analizar</span>
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: '"FILL" 1' }}>send</span>
              </button>
            </div>
          </div>
          
          <div className="flex justify-between items-center mt-3 px-1">
            <p className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">info</span>
              CEDIT provee análisis basado en normativa oficial vigente.
            </p>
            <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-slate-400">
              <span className="">Secured by</span>
              <span className="text-slate-600">Syscoin</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default ChatInterface;
