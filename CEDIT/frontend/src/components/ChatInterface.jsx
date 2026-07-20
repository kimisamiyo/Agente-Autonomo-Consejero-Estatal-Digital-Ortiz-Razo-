import React, { useState, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import axios from 'axios';
import ToolsDropdown from './ToolsDropdown';
import MefScoreCard from './MefScoreCard';
import MentorInsightPanel from './MentorInsightPanel';
import GuideGraphTrail from './GuideGraphTrail';
import AuditDecisionNetwork from './AuditDecisionNetwork';
import WelcomeConstellation from './WelcomeConstellation';
import MentorBriefingModal from './MentorBriefingModal';
import HitoToast from './HitoToast';
import { canShowPdfOffer, isEarlyGuidePhase } from '../utils/pdfEligibility';
import { getMentorLoadingLabel } from '../utils/mentorActivity';
import { isAuditSession } from '../utils/auditDecisionPoints';
import PdfLanguageModal from './PdfLanguageModal';
import SaveConversationButton from './SaveConversationButton';
import { saveExpediente } from '../utils/expedientesStore';
import { attestPdfWithExtension } from '../blockchain/walletMint';
import { fetchBlockchainConfig } from '../blockchain/mintRegistro';
import { useI18n } from '../i18n/I18nContext';
import {
  ceditCardClass,
  ceditIconBoxClass,
  ceditLabelClass,
  ceditBtnPrimaryClass,
  ceditBtnSecondaryClass,
} from '../theme/ceditPalette';
import { stripMefIndexMarkdown } from '../utils/stripMefMarkdown';
import { splitOpinionContent, buildMentorPanelMarkdown } from '../utils/splitOpinionContent';

function BotMessageHeader({ mode, subtitle, modeBadge }) {
  const badge = modeBadge[mode] || modeBadge.chat;
  return (
    <div className="flex items-center gap-2 ml-2 flex-wrap">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shadow-sm cedit-accent-steel cedit-brand-float">
        <span className="material-symbols-outlined text-white text-[14px]" style={{ fontVariationSettings: '"FILL" 1' }}>
          assured_workload
        </span>
      </div>
      <span className="text-xs font-semibold text-[var(--cedit-text)]">CEDIT</span>
      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${badge.className}`}>
        {badge.label}
      </span>
      {subtitle && <span className="text-[10px] text-slate-400 w-full sm:w-auto">{subtitle}</span>}
    </div>
  );
}

const ChatInterface = ({
  messages,
  isLoading,
  onSendMessage,
  onUploadFile,
  onRefinePlan,
  toggleSidebar,
  usage = { count: 0, limit: 10 },
  sessionMode = 'chat',
  conversationId = '',
  walletAddress = '',
  onConversationSaved,
  userId,
  freemiumExceeded,
  isPremium = false,
  premiumName = '',
  onOpenPremium,
  onRequestResetMemory,
  apiHeaders,
  onPdfExpedienteSaved,
  uiLocale = 'es',
  decisionCheckpoints = [],
  nodePositions = {},
  activeCheckpointId = null,
  onRestoreCheckpoint,
  onNodePositionChange,
  briefingOpen = false,
  onBriefingClose,
}) => {
  const { t } = useI18n();

  const modeConfig = useMemo(
    () => ({
      chat: { label: t('chat.mode.chat'), icon: 'forum', color: `${ceditCardClass('gray')} text-[var(--cedit-text)]` },
      audit: { label: t('chat.mode.audit'), icon: 'fact_check', color: `${ceditCardClass('steel')} text-[var(--cedit-text)]` },
      plan: { label: t('chat.mode.plan'), icon: 'architecture', color: `${ceditCardClass('gray')} text-[var(--cedit-text)]` },
      freemium: { label: t('chat.mode.freemium'), icon: 'lock', color: `${ceditCardClass('gray')} text-[var(--cedit-text-muted)]` },
    }),
    [t]
  );

  const modeBadge = useMemo(
    () => ({
      audit: { label: t('chat.badge.audit'), className: 'bg-[var(--cedit-primary-soft)] text-[var(--cedit-primary-deep)] border border-[color-mix(in_srgb,var(--cedit-primary)_30%,var(--cedit-border))]' },
      plan: { label: t('chat.badge.plan'), className: 'bg-[var(--cedit-surface-2)] text-[var(--cedit-text)] border border-[var(--cedit-border)]' },
      freemium: { label: t('chat.badge.limit'), className: 'bg-[var(--cedit-surface-3)] text-[var(--cedit-text)] border border-[var(--cedit-border-strong)]' },
      chat: { label: t('chat.badge.chat'), className: 'bg-[var(--cedit-surface-2)] text-[var(--cedit-text-muted)] border border-[var(--cedit-border)]' },
    }),
    [t]
  );

  const [inputValue, setInputValue] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [refineTarget, setRefineTarget] = useState(null);
  const [generatingPdf, setGeneratingPdf] = useState(null);
  const [pdfGenPhase, setPdfGenPhase] = useState(null);
  const [pdfLangModal, setPdfLangModal] = useState({ open: false, msg: null, index: null });
  /** Ambos paneles pueden estar abiertos a la vez */
  const [networkExpanded, setNetworkExpanded] = useState(false);
  const [mentorExpanded, setMentorExpanded] = useState(false);
  const [hito, setHito] = useState(null);
  const [localBriefing, setLocalBriefing] = useState(false);
  const hitoSeenRef = useRef({ phase: '', threshold: false });
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const mentorPanelRef = useRef(null);

  const messageCount = usage.count ?? 0;
  const freeLimit = usage.limit ?? 10;

  const showDecisionNetwork =
    isAuditSession(sessionMode, messages) && decisionCheckpoints.length > 0;

  const checkpointByMessageIndex = useMemo(() => {
    const map = {};
    decisionCheckpoints.forEach((cp) => {
      map[cp.messageIndex] = cp;
    });
    return map;
  }, [decisionCheckpoints]);

  const handleRestoreCheckpoint = (cp) => {
    if (!cp || !onRestoreCheckpoint) return;
    if (typeof window !== 'undefined' && !window.confirm(t('decision.confirmRestore'))) return;
    onRestoreCheckpoint(cp);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const lastUserText = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'user') return messages[i].content || '';
    }
    return '';
  }, [messages]);

  const loadingStatusText = useMemo(() => {
    if (!isLoading) return '';
    return getMentorLoadingLabel(lastUserText, t);
  }, [isLoading, lastUserText, t]);

  const latestMentorInsight = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      if (m.role !== 'assistant' && m.role !== 'bot') continue;
      if (m.isDocAck) continue;
      if (!m.isAudit && m.mode !== 'audit' && m.mode !== 'plan') continue;
      if (m.opinion || m.guideGraph) {
        const panelMarkdown = buildMentorPanelMarkdown(m.opinion);
        const { chat: chatOpinion } = splitOpinionContent(m.opinion || '');
        return { index: i, msg: m, chatOpinion, panelMarkdown };
      }
    }
    return null;
  }, [messages]);

  const showMentorHeader =
    Boolean(latestMentorInsight?.panelMarkdown || latestMentorInsight?.msg?.guideGraph);
  const showPlanHeader = showDecisionNetwork || showMentorHeader;

  const guideGraph = latestMentorInsight?.msg?.guideGraph || null;
  const mefScore = latestMentorInsight?.msg?.mefScore || null;
  const pulsePct =
    guideGraph?.completeness_pct ?? mefScore?.document_only_index ?? mefScore?.index ?? 0;
  const briefingIsOpen = briefingOpen || localBriefing;

  useEffect(() => {
    setNetworkExpanded(false);
    setMentorExpanded(false);
  }, [latestMentorInsight?.index]);

  useEffect(() => {
    if (!guideGraph && !mefScore) return;
    const phase = guideGraph?.phase_name || '';
    const pct = Number(pulsePct) || 0;
    if (phase && phase !== hitoSeenRef.current.phase) {
      const prev = hitoSeenRef.current.phase;
      hitoSeenRef.current.phase = phase;
      if (prev) setHito({ type: 'phase', phase });
    }
    if (pct >= 80 && !hitoSeenRef.current.threshold) {
      hitoSeenRef.current.threshold = true;
      setHito({ type: 'threshold', pct: Math.round(pct) });
    }
  }, [guideGraph, mefScore, pulsePct]);

  const closeBriefing = () => {
    setLocalBriefing(false);
    onBriefingClose?.();
  };

  const getPdfLockReason = (msg) => {
    const gate = canShowPdfOffer(msg);
    if (gate.show) return null;
    if (gate.reason === 'score') {
      return t('chat.pdfLockedScore', { threshold: 80, est: gate.est ?? 0 });
    }
    if (gate.reason === 'risk') {
      return t('chat.pdfLockedRisk', { risk: gate.risk ?? 0 });
    }
    return t('chat.pdfLockedPhase');
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
        setInputValue(`${t('chat.uploadAuditPrefix')} ${file.name}`);
      }
    } else if (file) alert(t('chat.pdfOnly'));
  };

  const triggerPdfDownload = (blob) => {
    const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `CEDIT_Plan_${Date.now()}.pdf`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const runGeneratePDF = async (msg, index, pdfOutputLanguage = 'es') => {
    if (!canShowPdfOffer(msg).show) return;
    setGeneratingPdf(index);
    setPdfGenPhase('build');
    try {
      const content = msg.fullContent || msg.content;
      const history = messages.map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.fullContent || m.content,
      }));
      const headersConfig =
        typeof apiHeaders === 'function'
          ? apiHeaders()
          : apiHeaders || { headers: { 'X-User-Id': userId, 'X-Locale': uiLocale } };
      const hdrs = headersConfig.headers || {};
      if (conversationId) hdrs['X-Conversation-Id'] = conversationId;
      headersConfig.headers = hdrs;

      const response = await axios.post(
        '/api/generate-pdf',
        {
          content: msg.fullContent || content,
          title: msg.filename ? `Plan MEF — ${msg.filename}` : 'Plan Técnico Oficial CEDIT',
          project_name: msg.filename ? msg.filename.replace(/\.pdf$/i, '') : 'Proyecto de Inversión Pública',
          history,
          user_id: userId,
          audit_opinion: msg.opinion || '',
          audit_dictamen: msg.dictamen || '',
          source_document: msg.sourceExcerpt || '',
          is_audit: Boolean(msg.isAudit || msg.showPdf),
          pdf_output_language: pdfOutputLanguage,
        },
        { responseType: 'blob', timeout: 300000, ...headersConfig }
      );
      const hash = response.headers['x-blockchain-hash'] || '';
      const pdfKeccak = response.headers['x-pdf-hash-keccak'] || '';
      const mefScore = parseInt(response.headers['x-mef-score'] || '0', 10);
      const meets = response.headers['x-mef-meets-threshold'] === '1';
      const requiresPdfFirma = meets && mefScore >= 80 && Boolean(pdfKeccak);

      if (requiresPdfFirma) {
        if (!isPremium || !walletAddress?.trim()) {
          alert(t('chat.genPdfNeedPro'));
          onOpenPremium?.();
          return;
        }
        const cfg = await fetchBlockchainConfig();
        if (!cfg.pdf_enabled) {
          alert(t('pdfFirma.notConfigured'));
          return;
        }

        setPdfGenPhase('sign');
        let firmaData;
        try {
          firmaData = await attestPdfWithExtension(
            {
              wallet: walletAddress.trim(),
              pdfHash: pdfKeccak,
              mefScore,
              channel: 'Web',
              conversationId,
              userId,
            },
            headersConfig
          );
        } catch (firmaErr) {
          if (firmaErr.code === 4001 || firmaErr.code === 'ACTION_REJECTED') {
            alert(t('chat.genPdfFirmaRejected'));
          } else {
            alert(firmaErr.response?.data?.detail || firmaErr.message || t('pdfFirma.error'));
          }
          return;
        }

        triggerPdfDownload(response.data);

        const saved = saveExpediente({
          title: msg.filename ? `Plan MEF — ${msg.filename}` : 'Plan Técnico Oficial CEDIT',
          projectName: msg.filename?.replace(/\.pdf$/i, '') || '',
          score: mefScore,
          docScore: msg.mefScore?.document_only_index,
          hash,
          pdfKeccak,
          conversationId,
          firmaPending: false,
          pdfFirmaTokenId: firmaData.token_id ?? null,
          pdfFirmaTx: firmaData.tx_hash || '',
          pdfFirmaExplorerTx: firmaData.explorer_tx || '',
          pdfFirmaContract: firmaData.contract_address || '',
          pdfLanguage: pdfOutputLanguage,
        });
        onPdfExpedienteSaved?.(saved);
        return;
      }

      if (meets && mefScore >= 80) {
        saveExpediente({
          title: msg.filename ? `Plan MEF — ${msg.filename}` : 'Plan Técnico Oficial CEDIT',
          projectName: msg.filename?.replace(/\.pdf$/i, '') || '',
          score: mefScore,
          docScore: msg.mefScore?.document_only_index,
          hash,
          pdfKeccak: pdfKeccak || '',
          conversationId,
          firmaPending: false,
          pdfLanguage: pdfOutputLanguage,
        });
      }
      triggerPdfDownload(response.data);
    } catch (err) {
      if (!err.response) {
        // Error de red, conexión o excepción local de JavaScript en el navegador
        alert('Error en cliente/conexión: ' + err.message);
      } else if (err.response.data instanceof Blob) {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const errorObj = JSON.parse(reader.result);
            alert(errorObj?.detail || 'Error al generar el PDF.');
          } catch (e) {
            alert('Error del Servidor (Raw): ' + reader.result.substring(0, 250));
          }
        };
        reader.readAsText(err.response.data);
      } else {
        const detail = err.response?.data?.detail;
        const msg = typeof detail === 'string' ? detail : 'Error al generar el PDF.';
        if (err.response?.status === 402) alert('Límite freemium alcanzado en esta conversación.');
        else alert(msg);
      }
    } finally {
      setGeneratingPdf(null);
      setPdfGenPhase(null);
    }
  };

  const handleGeneratePDF = (msg, index) => {
    if (uiLocale && uiLocale !== 'es') {
      setPdfLangModal({ open: true, msg, index });
      return;
    }
    runGeneratePDF(msg, index, 'es');
  };

  const startRefine = (msg) => {
    setRefineTarget(msg.fullContent || msg.content);
    setInputValue(`${t('chat.refinePlan')}: `);
    document.getElementById('chat-textarea')?.focus();
  };

  const modeCfg = modeConfig[sessionMode] || modeConfig.chat;

  return (
    <main className="flex-1 relative flex flex-col h-full w-full bg-background overflow-hidden">
      <header className="md:hidden sticky top-0 z-30 bg-surface-container-lowest border-b border-border-gray flex justify-between items-center px-4 h-16">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-slate-800" style={{ fontVariationSettings: '"FILL" 1' }}>assured_workload</span>
          <h1 className="font-bold text-slate-800">CEDIT</h1>
        </div>
        <button type="button" className="p-2 rounded-lg text-slate-600" onClick={toggleSidebar} aria-label={t('common.close')}>
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
              <span className="text-[10px] font-normal opacity-80 ml-2">{t('chat.auditSubtitle')}</span>
            )}
          </div>
        </div>
      )}

      {freemiumExceeded && !isPremium && (
        <div className={`shrink-0 w-full border-b px-4 py-3 flex justify-center z-20 cedit-mode-enter ${ceditCardClass('steel', 'rounded-none border-x-0 border-t-0')}`}>
          <div className="w-full max-w-[850px] flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
            <div className="flex-1 text-sm text-[var(--cedit-text)]">
              <strong>{t('chat.limitBanner', { count: messageCount, limit: freeLimit })}</strong>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              <button
                type="button"
                onClick={onRequestResetMemory}
                className={ceditBtnSecondaryClass().replace('rounded-xl', 'rounded-full').replace('text-xs font-semibold', 'text-xs font-bold')}
              >
                {t('chat.resetMemory')}
              </button>
              <button
                type="button"
                onClick={onOpenPremium}
                className={ceditBtnPrimaryClass('steel').replace('rounded-xl', 'rounded-full')}
              >
                {t('chat.premiumPlan')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPlanHeader && (
        <div className="shrink-0 w-full px-3 sm:px-5 py-2.5 border-b border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[var(--cedit-surface)] z-10">
          <div
            className={`w-full max-w-[min(1440px,100%)] mx-auto flex gap-3 items-start min-h-[56px] ${
              showDecisionNetwork && showMentorHeader ? 'flex-col lg:flex-row' : 'flex-col'
            }`}
          >
            {showDecisionNetwork && (
              <div className={showMentorHeader ? 'lg:flex-1 min-w-0 w-full' : 'w-full'}>
                <AuditDecisionNetwork
                  checkpoints={decisionCheckpoints}
                  positions={nodePositions}
                  activeCheckpointId={activeCheckpointId}
                  onRestore={handleRestoreCheckpoint}
                  onPositionChange={onNodePositionChange}
                  expanded={networkExpanded}
                  onExpandedChange={setNetworkExpanded}
                />
              </div>
            )}
            {showMentorHeader && (
              <div
                ref={mentorPanelRef}
                className={showDecisionNetwork ? 'lg:flex-1 min-w-0 w-full' : 'w-full'}
              >
                <MentorInsightPanel
                  messageKey={latestMentorInsight.index}
                  panelMarkdown={latestMentorInsight.panelMarkdown}
                  guideGraph={latestMentorInsight.msg.guideGraph}
                  mefScore={latestMentorInsight.msg.mefScore}
                  guidePhase={latestMentorInsight.msg.guidePhase}
                  expanded={mentorExpanded}
                  onExpandedChange={setMentorExpanded}
                />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto w-full px-4 md:px-gutter py-6 flex justify-center">
        <div className="w-full max-w-[850px] flex flex-col gap-4">
          {messages.length === 0 ? (
            <WelcomeConstellation
              onSendMessage={onSendMessage}
              onPickPdf={() => fileInputRef.current?.click()}
            />
          ) : (
            messages.map((msg, index) => {
              const isLatestMentorInsight =
                latestMentorInsight?.index === index &&
                msg.role !== 'user' &&
                (msg.opinion || msg.guideGraph);
              const chatOpinionText = isLatestMentorInsight
                ? latestMentorInsight.chatOpinion || msg.opinion
                : msg.opinion;
              return (
              <div
                key={index}
                className={`flex w-full cedit-message-enter ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                style={{ animationDelay: `${Math.min(index * 40, 200)}ms` }}
              >
                {msg.role === 'user' ? (
                  <div className="bg-white border border-border-gray p-3 rounded-2xl rounded-tr-md max-w-[85%] shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-slate-400 text-sm">person</span>
                      <span className="text-xs text-slate-500">{t('chat.you')}</span>
                    </div>
                    <div className="cedit-readable prose prose-sm max-w-none text-slate-800 dark:text-slate-100">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                ) : (
                  <div className="w-full max-w-[95%] flex flex-col gap-2">
                    <BotMessageHeader
                      mode={msg.mode || (msg.isAudit ? 'audit' : 'chat')}
                      subtitle={msg.isDocAck ? t('chat.docReceived') : null}
                      modeBadge={modeBadge}
                    />

                    <div
                      className={`p-3 sm:p-4 rounded-2xl rounded-tl-md transition-shadow duration-300 ${
                        msg.isAudit || msg.isDocAck
                          ? 'bg-white border border-slate-200 shadow-sm'
                          : msg.mode === 'freemium'
                            ? ceditCardClass('gray')
                            : `${ceditCardClass('gray')} hover:shadow-md`
                      }`}
                    >
                      {msg.isDocAck && (
                        <div className={`mb-4 p-4 ${ceditCardClass('gray')} cedit-fade-in flex gap-3`}>
                          <div className={ceditIconBoxClass('gray', 'w-9 h-9')}>
                            <span className="material-symbols-outlined text-white text-lg">description</span>
                          </div>
                          <div className="cedit-readable prose prose-sm max-w-none text-slate-800 dark:text-slate-100 flex-1">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        </div>
                      )}

                      {msg.isAudit && chatOpinionText && !msg.isDocAck && (
                        <div className="mb-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50 cedit-fade-in">
                          <div className="flex items-center gap-2 mb-2">
                            <div className={ceditIconBoxClass('gray', 'w-8 h-8')}>
                              <span className="material-symbols-outlined text-white text-base">favorite</span>
                            </div>
                            <p className={ceditLabelClass('gray')}>{t('chat.myOpinion')}</p>
                            {isLatestMentorInsight && showMentorHeader && (
                              <button
                                type="button"
                                onClick={() => {
                                  setMentorExpanded(true);
                                  mentorPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                }}
                                className="ml-auto text-[10px] font-semibold text-slate-600 hover:text-slate-900 underline"
                              >
                                {t('chat.mentorPanelLink')}
                              </button>
                            )}
                          </div>
                          <div className="cedit-readable prose prose-sm max-w-none text-slate-800 dark:text-slate-100">
                            <ReactMarkdown>{chatOpinionText}</ReactMarkdown>
                          </div>
                        </div>
                      )}

                      {msg.guideGraph &&
                        !msg.isDocAck &&
                        (msg.isAudit || msg.mode === 'audit' || msg.mode === 'plan') &&
                        !isLatestMentorInsight && (
                          <GuideGraphTrail graph={msg.guideGraph} className="mb-4" />
                        )}

                      {msg.mefScore && !msg.isDocAck && !isEarlyGuidePhase(msg) && (
                        <MefScoreCard score={msg.mefScore} className="mb-4 p-4 rounded-2xl border border-slate-200 bg-white" />
                      )}
                      {msg.mefScore &&
                        !msg.isDocAck &&
                        isEarlyGuidePhase(msg) &&
                        !isLatestMentorInsight && (
                        <p className="mb-3 text-[10px] text-slate-500 px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-100">
                          {t('mef.title')}: {msg.mefScore.document_only_index ?? 0}% · {t('guide.phase')}{' '}
                          {msg.guidePhase || msg.guideGraph?.phase_name}
                        </p>
                      )}

                      {!msg.isDocAck && (
                        <div className="cedit-readable prose prose-sm max-w-none text-slate-800 dark:text-slate-100">
                          {msg.isAudit && msg.opinion ? (
                            msg.strengths ? (
                              <>
                                <div className={`mb-4 p-4 ${ceditCardClass('gray')}`}>
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className={ceditIconBoxClass('gray', 'w-8 h-8')}>
                                      <span className="material-symbols-outlined text-white text-base">check_circle</span>
                                    </div>
                                    <p className={`${ceditLabelClass('gray')} not-prose`}>{t('chat.strengths')}</p>
                                  </div>
                                  <div className="cedit-readable prose prose-sm max-w-none text-slate-800 dark:text-slate-100">
                                    <ReactMarkdown>{msg.strengths}</ReactMarkdown>
                                  </div>
                                </div>
                              </>
                            ) : null
                          ) : (
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          )}
                        </div>
                      )}

                      {msg.isAudit && msg.opinion && !msg.isDocAck && !isEarlyGuidePhase(msg) && (msg.content?.includes('## Dictamen') || msg.fullContent?.includes('## Dictamen')) && (
                        <details className="mt-4 group cedit-fade-in">
                          <summary className="cursor-pointer text-sm font-semibold text-slate-700 hover:text-[var(--cedit-steel)] transition-colors list-none flex items-center gap-1">
                            <span className="material-symbols-outlined text-base group-open:rotate-90 transition-transform">chevron_right</span>
                            {t('chat.fullDictamen')}
                          </summary>
                          <div className="mt-3 pt-3 border-t border-slate-100 cedit-readable prose prose-sm max-w-none text-slate-800 dark:text-slate-100">
                            <ReactMarkdown>
                              {stripMefIndexMarkdown(msg.fullContent || msg.content)}
                            </ReactMarkdown>
                          </div>
                        </details>
                      )}

                      {msg.isFreemiumBlock && (
                        <div className="mt-4 flex flex-wrap gap-2 cedit-fade-in">
                          <button
                            type="button"
                            onClick={onRequestResetMemory}
                            className={ceditBtnPrimaryClass('steel').replace('rounded-xl', 'rounded-full')}
                          >
                            {t('chat.resetMemory')}
                          </button>
                          <button
                            type="button"
                            onClick={onOpenPremium}
                            className={ceditBtnPrimaryClass('steel').replace('rounded-xl', 'rounded-full')}
                          >
                            {t('chat.connectWallet')}
                          </button>
                        </div>
                      )}
                    </div>

                      {(msg.isAudit || msg.showPdf) && !msg.isDocAck && (canShowPdfOffer(msg).show || (!isEarlyGuidePhase(msg) && msg.mefScore)) && (
                        <div className="mt-2 px-2">
                          {canShowPdfOffer(msg).show ? (
                            <div className="flex flex-wrap items-center gap-2 py-2 px-3 rounded-xl border border-[var(--cedit-border)] bg-[var(--cedit-surface-2)]">
                              <span className="material-symbols-outlined text-[var(--cedit-steel)] text-lg">picture_as_pdf</span>
                              <span className="text-[11px] font-semibold text-[var(--cedit-text)] flex-1 min-w-[120px]">
                                {t('chat.pdfCompactHint')}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleGeneratePDF(msg, index)}
                                disabled={generatingPdf === index || freemiumExceeded}
                                className={`${ceditBtnPrimaryClass('steel')} !py-1.5 !px-3 !text-[11px] !rounded-lg`}
                              >
                                <span className="material-symbols-outlined text-sm">download</span>
                                {generatingPdf === index
                                  ? pdfGenPhase === 'sign'
                                    ? t('chat.genPdfSign')
                                    : t('chat.genPdfLoading')
                                  : t('chat.genPdf')}
                              </button>
                              <button
                                type="button"
                                onClick={() => startRefine(msg)}
                                className={`${ceditBtnSecondaryClass()} !py-1.5 !px-2 !text-[10px]`}
                              >
                                {t('chat.refinePlan')}
                              </button>
                            </div>
                          ) : (
                            <p className="text-[10px] text-slate-500 flex items-start gap-1.5 py-1.5 px-2 rounded-lg bg-slate-50 border border-slate-100">
                              <span className="material-symbols-outlined text-[14px] text-slate-400 shrink-0">lock</span>
                              <span>{getPdfLockReason(msg)}</span>
                            </p>
                          )}
                        </div>
                      )}

                    <div className="flex justify-between flex-wrap gap-2 px-2 mt-1">
                      {checkpointByMessageIndex[index] && onRestoreCheckpoint && (
                        <button
                          type="button"
                          onClick={() => handleRestoreCheckpoint(checkpointByMessageIndex[index])}
                          className={`text-xs font-bold flex items-center gap-1 px-2.5 py-1 rounded-full border transition-colors ${
                            activeCheckpointId === checkpointByMessageIndex[index].id
                              ? 'bg-amber-100 border-amber-400 text-amber-900'
                              : 'bg-indigo-50 border-indigo-200 text-indigo-900 hover:bg-amber-50 hover:border-amber-300'
                          }`}
                          title={t('decision.restoreHint')}
                        >
                          <span className="material-symbols-outlined text-[16px]">history</span>
                          {t('decision.restoreShort')}
                        </button>
                      )}
                      <button
                        type="button"
                        className="text-slate-500 hover:text-slate-800 flex items-center ml-auto p-1 rounded-md hover:bg-slate-100 transition-colors"
                        title={t('chat.copy')}
                        aria-label={t('chat.copy')}
                        onClick={() => navigator.clipboard.writeText(msg.fullContent || msg.content)}
                      >
                        <span className="material-symbols-outlined text-[18px]">content_copy</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
            })
          )}

          {isLoading && (
            <div className="cedit-message-enter flex flex-col gap-2 w-full max-w-[95%]">
              <BotMessageHeader
                mode={sessionMode === 'audit' ? 'audit' : sessionMode === 'plan' ? 'plan' : 'chat'}
                modeBadge={modeBadge}
              />
              <div className="bg-[var(--cedit-surface)] border border-[var(--cedit-border)] p-3 sm:p-4 rounded-2xl rounded-tl-md shadow-sm flex items-center gap-3">
                <div className="flex gap-1.5">
                  {[0, 150, 300].map((d) => (
                    <div
                      key={d}
                      className="w-2 h-2 rounded-full bg-[var(--cedit-steel)] animate-bounce"
                      style={{ animationDelay: `${d}ms` }}
                    />
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--cedit-text)] font-medium">{loadingStatusText}</p>
                  <div className="mt-2 h-1.5 rounded-full overflow-hidden bg-[var(--cedit-surface-3)]">
                    <div className="h-full w-2/3 cedit-shimmer-bar rounded-full" />
                  </div>
                  <p className="text-[10px] text-[var(--cedit-text-faint)] mt-1.5">
                    {sessionMode === 'audit' ? t('chat.reviewing') : t('chat.consulting')}
                  </p>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-200/80 dark:border-slate-700/80 bg-transparent px-4 py-4 flex justify-center">
        <div className="w-full max-w-[850px]">
          {refineTarget && (
            <p className={`text-[11px] rounded-xl px-3 py-2 mb-2 cedit-fade-in ${ceditCardClass('gray')}`}>
              {t('chat.refineMode')}
            </p>
          )}
          {selectedFile && (
            <div className={`mb-2 flex items-center gap-2 text-sm rounded-xl px-3 py-2 cedit-fade-in ${ceditCardClass('steel')}`}>
              <div className={ceditIconBoxClass('steel', 'w-7 h-7')}>
                <span className="material-symbols-outlined text-white text-sm">picture_as_pdf</span>
              </div>
              <span className="truncate flex-1 font-medium">{selectedFile.name}</span>
              <button type="button" onClick={() => setSelectedFile(null)} className="text-slate-400 hover:text-slate-800 dark:hover:text-white">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          )}
          <div className="cedit-composer cedit-composer-jewel">
            <textarea
              id="chat-textarea"
              className="w-full border-0 focus:ring-0 resize-none py-4 px-5 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 min-h-[60px] bg-transparent"
              placeholder={refineTarget ? t('chat.placeholderRefine') : t('chat.placeholder')}
              rows={1}
              value={inputValue}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
            <div className="flex justify-between items-center px-3 py-2 bg-[color-mix(in_srgb,var(--cedit-surface-2)_88%,transparent)] border-t border-[var(--cedit-border)]">
              <div className="flex gap-1 items-center">
                <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />
                <button type="button" className="p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-xs transition-colors" onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
                  <span className="material-symbols-outlined text-sm">attach_file</span>
                </button>
                <ToolsDropdown
                  disabled={isLoading}
                  onSelectTool={(prompt) => onSendMessage(prompt, { isPremiumTool: true })}
                />
                {isPremium && walletAddress && (
                  <SaveConversationButton
                    isProConfirmed={isPremium}
                    walletAddress={walletAddress}
                    messages={messages}
                    userId={userId}
                    conversationId={conversationId}
                    apiHeaders={apiHeaders}
                    onSaved={onConversationSaved}
                    disabled={isLoading}
                  />
                )}
                {!isPremium && (
                  <span
                    className={`cedit-quota-ring ml-1 ${
                      freemiumExceeded ? 'is-empty' : messageCount >= freeLimit - 2 ? 'is-warn' : ''
                    }`}
                  >
                    {t('jewel.composer.quota', { count: messageCount, limit: freeLimit })}
                  </span>
                )}
              </div>
              <button
                type="button"
                className={`cedit-analyze-btn ${isLoading ? 'is-loading' : ''}`}
                onClick={handleSend}
                disabled={
                  (!inputValue.trim() && !selectedFile) ||
                  isLoading ||
                  (freemiumExceeded && !isPremium && !refineTarget)
                }
              >
                {refineTarget ? t('chat.applyFix') : t('chat.analyze')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <HitoToast hito={hito} onDismiss={() => setHito(null)} />

      <MentorBriefingModal
        open={briefingIsOpen}
        onClose={closeBriefing}
        guideGraph={guideGraph}
        mefScore={mefScore}
        onFocusMentor={() => {
          setMentorExpanded(true);
          mentorPanelRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
        }}
      />

      <PdfLanguageModal
        isOpen={pdfLangModal.open}
        uiLocale={uiLocale}
        onClose={() => setPdfLangModal({ open: false, msg: null, index: null })}
        onConfirm={(lang) => {
          const { msg, index } = pdfLangModal;
          setPdfLangModal({ open: false, msg: null, index: null });
          if (msg != null && index != null) runGeneratePDF(msg, index, lang);
        }}
      />
    </main>
  );
};

export default ChatInterface;
