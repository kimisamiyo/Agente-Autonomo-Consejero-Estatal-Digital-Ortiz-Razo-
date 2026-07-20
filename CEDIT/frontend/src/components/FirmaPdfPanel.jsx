import React, { useEffect, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { fetchBlockchainConfig } from '../blockchain/mintRegistro';
import { attestPdfWithExtension } from '../blockchain/walletMint';
import TanenbaumRecordBlock from './TanenbaumRecordBlock';

const FirmaPdfPanel = ({
  pdfAttestation,
  conversationId = '',
  userId = '',
  apiHeaders = () => ({}),
  walletAddress = '',
  isProConfirmed = false,
  onFirmaSuccess,
  embedded = false,
  initialSigned = null,
}) => {
  const { t } = useI18n();
  const [config, setConfig] = useState({ pdf_enabled: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(initialSigned);

  useEffect(() => {
    fetchBlockchainConfig()
      .then(setConfig)
      .catch(() => setConfig({ pdf_enabled: false }));
  }, []);

  if (!pdfAttestation?.pdfHash || !pdfAttestation?.mefScore) {
    return null;
  }

  if (!isProConfirmed) {
    return null;
  }

  if (!config.pdf_enabled) {
    return (
      <p className="text-[10px] text-slate-500 px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-100">
        {t('pdfFirma.notConfigured')}
      </p>
    );
  }

  const handleFirma = async () => {
    if (!walletAddress?.trim()) {
      setError(t('pdfFirma.walletRequired'));
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await attestPdfWithExtension(
        {
          wallet: walletAddress.trim(),
          pdfHash: pdfAttestation.pdfHash,
          mefScore: pdfAttestation.mefScore,
          channel: 'Web',
          conversationId,
          userId,
        },
        apiHeaders()
      );
      setResult(data);
      onFirmaSuccess?.(data);
    } catch (e) {
      if (e.code === 4001 || e.code === 'ACTION_REJECTED') {
        setError(t('pdfFirma.rejected'));
      } else {
        setError(e.response?.data?.detail || e.message || t('pdfFirma.error'));
      }
    } finally {
      setLoading(false);
    }
  };

  const boxClass = embedded
    ? 'flex flex-col gap-2 rounded-xl border border-[var(--cedit-border-strong)] bg-[var(--cedit-steel-soft)] p-3'
    : 'flex flex-wrap items-center gap-2 py-2 px-3 rounded-xl border border-[var(--cedit-border)] bg-[var(--cedit-steel-soft)]';

  return (
    <div className={boxClass}>
      {embedded && (
        <p className="text-[11px] text-[var(--cedit-text)] font-medium">{t('expedientes.firmaPrompt')}</p>
      )}
      <div className="min-w-0 flex-1">
        <p className="font-bold text-[11px] text-[var(--cedit-text)]">{t('pdfFirma.title')}</p>
      </div>
      {!result && pdfAttestation.pdfHash && (
        <TanenbaumRecordBlock
          config={config}
          pdfHash={pdfAttestation.pdfHash}
          contractAddress={config.pdf_contract_address}
          compact
        />
      )}
      {result ? (
        <TanenbaumRecordBlock
          config={config}
          pdfHash={result.pdf_hash || pdfAttestation.pdfHash}
          tokenId={result.token_id}
          txHash={result.tx_hash}
          explorerTx={result.explorer_tx}
          contractAddress={result.contract_address}
          compact
        />
      ) : (
        <button
          type="button"
          disabled={loading || !walletAddress}
          onClick={handleFirma}
          className="text-[10px] px-2.5 py-1 rounded-lg cedit-accent-steel text-white font-bold hover:opacity-95 disabled:opacity-50"
        >
          {loading ? t('pdfFirma.loading') : t('pdfFirma.cta')}
        </button>
      )}
      {error && <p className="text-[10px] text-red-700 w-full">{error}</p>}
    </div>
  );
};

export default FirmaPdfPanel;
