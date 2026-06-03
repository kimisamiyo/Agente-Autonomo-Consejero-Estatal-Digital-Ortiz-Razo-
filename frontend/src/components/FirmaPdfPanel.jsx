import React, { useEffect, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { fetchBlockchainConfig } from '../blockchain/mintRegistro';
import {
  preparePdfMint,
  mintFirmaPdfViaWallet,
  syncMintBackup,
  connectWalletForMint,
} from '../blockchain/walletMint';
import { explorerPdfTokenUrl } from '../blockchain/mintFirmaPdf';
import WalletProviderModal from './WalletProviderModal';

const FirmaPdfPanel = ({
  pdfAttestation,
  conversationId = '',
  userId = '',
  apiHeaders = () => ({}),
  walletAddress = '',
  isProConfirmed = false,
  onFirmaSuccess,
}) => {
  const { t } = useI18n();
  const [config, setConfig] = useState({ pdf_enabled: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [prepareData, setPrepareData] = useState(null);

  useEffect(() => {
    fetchBlockchainConfig()
      .then(setConfig)
      .catch(() => setConfig({ pdf_enabled: false }));
  }, []);

  if (!isProConfirmed || !pdfAttestation?.pdfHash || !pdfAttestation?.mefScore) {
    return null;
  }

  if (!config.pdf_enabled) {
    return (
      <p className="text-[10px] text-slate-500 px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-100">
        {t('pdfFirma.notConfigured')}
      </p>
    );
  }

  const runFirma = async (injectedProvider) => {
    setPickerOpen(false);
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const prep =
        prepareData ||
        (await preparePdfMint(
          {
            wallet: walletAddress.trim(),
            pdf_hash: pdfAttestation.pdfHash,
            mef_score: pdfAttestation.mefScore,
            channel: 'Web',
            conversation_id: conversationId,
            user_id: userId,
          },
          apiHeaders()
        ));
      const { signer, address } = await connectWalletForMint(injectedProvider);
      if (address.toLowerCase() !== walletAddress.trim().toLowerCase()) {
        setError(t('walletPicker.wrongAccount'));
        return;
      }
      const data = await mintFirmaPdfViaWallet({
        signer,
        contractAddress: prep.contract_address,
        pdfHash: prep.pdf_hash,
        channelUrl: prep.channel_url,
        channel: prep.channel,
        mefScore: prep.mef_score,
      });
      await syncMintBackup(
        {
          wallet: address,
          token_id: data.token_id,
          channel: 'Web',
          kind: 'pdf_firma',
          pdf_hash: data.pdf_hash,
          mef_score: prep.mef_score,
          conversation_id: conversationId,
        },
        apiHeaders()
      );
      setResult(data);
      onFirmaSuccess?.(data);
    } catch (e) {
      setError(e.response?.data?.detail || e.reason || e.message || t('pdfFirma.error'));
    } finally {
      setLoading(false);
      setPrepareData(null);
    }
  };

  const handleFirma = async () => {
    if (!walletAddress?.trim()) {
      setError(t('pdfFirma.walletRequired'));
      return;
    }
    try {
      const prep = await preparePdfMint(
        {
          wallet: walletAddress.trim(),
          pdf_hash: pdfAttestation.pdfHash,
          mef_score: pdfAttestation.mefScore,
          channel: 'Web',
          conversation_id: conversationId,
          user_id: userId,
        },
        apiHeaders()
      );
      setPrepareData(prep);
      setPickerOpen(true);
    } catch (e) {
      setError(e.response?.data?.detail || e.message || t('pdfFirma.error'));
    }
  };

  return (
    <>
      <WalletProviderModal
        open={pickerOpen}
        title={t('pdfFirma.pickerTitle')}
        onSelect={runFirma}
        onClose={() => {
          setPickerOpen(false);
          setPrepareData(null);
        }}
      />
      <div className="flex flex-wrap items-center gap-2 py-2 px-3 rounded-xl border border-blue-200/90 bg-blue-50/80">
        <span className="material-symbols-outlined text-blue-800 text-lg shrink-0">draw</span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-[11px] text-blue-900">{t('pdfFirma.title')}</p>
          <p className="text-[10px] text-slate-600 truncate font-mono">{pdfAttestation.pdfHash}</p>
          {config.pdf_contract_explorer_url && (
            <a
              href={config.pdf_contract_explorer_url}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] text-blue-800 underline"
            >
              {t('pdfFirma.contractLink')}
            </a>
          )}
        </div>
        {result ? (
          <div className="w-full text-xs space-y-1">
            <p className="text-emerald-700 font-semibold">
              {t('pdfFirma.success', { id: result.token_id ?? '—' })}
            </p>
            <div className="flex flex-wrap gap-2">
              {result.explorer_tx && (
                <a href={result.explorer_tx} target="_blank" rel="noreferrer" className="text-[10px] underline text-blue-800">
                  {t('pdfFirma.viewTx')}
                </a>
              )}
              {result.token_id != null && result.contract_address && (
                <a
                  href={explorerPdfTokenUrl(result.contract_address, result.token_id, config.block_explorer)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] underline text-blue-800"
                >
                  {t('pdfFirma.viewNft')}
                </a>
              )}
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={loading || !walletAddress}
            onClick={handleFirma}
            className="text-[10px] px-2.5 py-1 rounded-lg bg-blue-800 text-white font-bold hover:bg-blue-900 disabled:opacity-50"
          >
            {loading ? t('pdfFirma.loading') : t('pdfFirma.cta')}
          </button>
        )}
        {error && <p className="text-[10px] text-red-700 w-full">{error}</p>}
      </div>
    </>
  );
};

export default FirmaPdfPanel;
