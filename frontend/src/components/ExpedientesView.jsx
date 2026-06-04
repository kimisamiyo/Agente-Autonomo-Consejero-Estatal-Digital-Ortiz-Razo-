import React, { useEffect, useMemo, useState } from 'react';
import {
  listQualifiedExpedientes,
  MEF_THRESHOLD,
  needsPdfFirma,
  updateExpedienteFirma,
} from '../utils/expedientesStore';
import { useI18n } from '../i18n/I18nContext';
import { ceditCardClass, ceditIconBoxClass, ceditLabelClass } from '../theme/ceditPalette';
import FirmaPdfPanel from './FirmaPdfPanel';
import TanenbaumRecordBlock from './TanenbaumRecordBlock';
import { fetchBlockchainConfig } from '../blockchain/mintRegistro';

const ExpedientesView = ({
  refreshKey = 0,
  highlightExpId = '',
  walletAddress = '',
  isPremium = false,
  userId = '',
  apiHeaders = () => ({}),
  onOpenPremium,
}) => {
  const { t } = useI18n();
  const [items, setItems] = useState(() => listQualifiedExpedientes(MEF_THRESHOLD));
  const [config, setConfig] = useState({});

  useEffect(() => {
    setItems(listQualifiedExpedientes(MEF_THRESHOLD));
  }, [refreshKey]);

  useEffect(() => {
    fetchBlockchainConfig().then(setConfig).catch(() => ({}));
  }, []);

  useEffect(() => {
    if (!highlightExpId) return;
    const el = document.getElementById(`exp-${highlightExpId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightExpId, items]);

  const pendingCount = useMemo(() => items.filter(needsPdfFirma).length, [items]);

  const handleFirmaSuccess = (expId, data) => {
    updateExpedienteFirma(expId, data);
    setItems(listQualifiedExpedientes(MEF_THRESHOLD));
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 max-w-3xl mx-auto w-full">
      <header className="flex items-center gap-3 mb-2">
        <div className={ceditIconBoxClass('blue', 'w-12 h-12')}>
          <span className="material-symbols-outlined text-white text-2xl">folder_open</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('expedientes.title')}</h1>
          <p className="text-sm text-slate-600 mt-1">{t('expedientes.desc', { threshold: MEF_THRESHOLD })}</p>
          {pendingCount > 0 && (
            <p className="text-xs text-blue-800 font-semibold mt-1">{t('expedientes.firmaPending', { count: pendingCount })}</p>
          )}
        </div>
      </header>

      <div className="mb-8" />

      {items.length === 0 ? (
        <div className={`p-8 text-center text-slate-500 text-sm border-dashed ${ceditCardClass('gray')}`}>
          {t('expedientes.empty', { threshold: MEF_THRESHOLD })}
        </div>
      ) : (
        <ul className="space-y-4">
          {items.map((exp) => {
            const highlighted = exp.id === highlightExpId;
            const showFirma = needsPdfFirma(exp);
            const signed = Boolean(exp.pdfFirmaTokenId);

            return (
              <li
                key={exp.id}
                id={`exp-${exp.id}`}
                className={`p-5 ${ceditCardClass('blue')} hover:shadow-md transition-shadow ${
                  highlighted ? 'ring-2 ring-blue-500 ring-offset-2' : ''
                }`}
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex gap-3 min-w-0">
                    <div className={ceditIconBoxClass('blue', 'w-10 h-10 shrink-0')}>
                      <span className="material-symbols-outlined text-white text-lg">description</span>
                    </div>
                    <div className="min-w-0">
                      <h2 className="font-bold text-slate-800 truncate">{exp.title}</h2>
                      {exp.projectName && <p className="text-sm text-slate-600 mt-1">{exp.projectName}</p>}
                      <p className="text-xs text-slate-500 mt-2">
                        {new Date(exp.createdAt).toLocaleString('es-PE')}
                        {exp.pdfLanguage && exp.pdfLanguage !== 'es' ? ` · PDF: ${exp.pdfLanguage}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 rounded-xl border-2 border-blue-300 bg-blue-50 px-3 py-2 min-w-[72px]">
                    <p className="text-2xl font-bold text-blue-800 tabular-nums">{exp.score}%</p>
                    <p className={ceditLabelClass('blue')}>{t('expedientes.mefIndex')}</p>
                  </div>
                </div>

                {exp.hash && (
                  <p className="text-[10px] text-slate-400 mt-3 font-mono truncate pl-[52px]" title={exp.hash}>
                    SHA: {exp.hash}
                  </p>
                )}
                {exp.pdfKeccak && !signed && (
                  <div className="mt-3 pl-[52px]">
                    <TanenbaumRecordBlock
                      config={config}
                      pdfHash={exp.pdfKeccak}
                      contractAddress={config.pdf_contract_address}
                      compact
                    />
                  </div>
                )}

                {signed && (
                  <div className="pl-[52px]">
                    <TanenbaumRecordBlock
                      config={config}
                      pdfHash={exp.pdfKeccak}
                      tokenId={exp.pdfFirmaTokenId}
                      txHash={exp.pdfFirmaTx}
                      explorerTx={exp.pdfFirmaExplorerTx}
                      contractAddress={exp.pdfFirmaContract}
                    />
                  </div>
                )}

                {showFirma && (
                  <div className="mt-4 pl-[52px]">
                    {!isPremium ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        <p>{t('expedientes.firmaNeedPro')}</p>
                        {onOpenPremium && (
                          <button
                            type="button"
                            onClick={onOpenPremium}
                            className="mt-2 text-[11px] font-bold underline text-blue-800"
                          >
                            {t('chat.connectWallet')}
                          </button>
                        )}
                      </div>
                    ) : (
                      <FirmaPdfPanel
                        embedded
                        pdfAttestation={{ pdfHash: exp.pdfKeccak, mefScore: exp.score }}
                        conversationId={exp.conversationId}
                        userId={userId}
                        apiHeaders={apiHeaders}
                        walletAddress={walletAddress}
                        isProConfirmed={isPremium}
                        onFirmaSuccess={(data) => handleFirmaSuccess(exp.id, data)}
                      />
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default ExpedientesView;
