import React, { useEffect, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { fetchBlockchainConfig } from '../blockchain/mintRegistro';
import {
  prepareRegistroMint,
  mintRegistroViaWallet,
  syncMintBackup,
  connectWalletForMint,
} from '../blockchain/walletMint';
import WalletProviderModal from './WalletProviderModal';

const MintRegistroPanel = ({
  messages = [],
  userId = '',
  conversationId = '',
  apiHeaders = () => ({}),
  walletAddress = '',
  onMintSuccess,
  compact = false,
  isProConfirmed = false,
}) => {
  const { t } = useI18n();
  const [config, setConfig] = useState({ enabled: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [prepareData, setPrepareData] = useState(null);

  useEffect(() => {
    fetchBlockchainConfig()
      .then(setConfig)
      .catch(() => setConfig({ enabled: false }));
  }, []);

  const history = messages
    .filter((m) => m.content && !m.isDocAck)
    .map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.fullContent || m.content || '',
    }));

  const runMint = async (injectedProvider) => {
    setPickerOpen(false);
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const prep =
        prepareData ||
        (await prepareRegistroMint(
          {
            wallet: walletAddress.trim(),
            channel: 'Web',
            history,
            user_id: userId,
            conversation_id: conversationId,
          },
          apiHeaders()
        ));
      const { signer, address } = await connectWalletForMint(injectedProvider);
      const data = await mintRegistroViaWallet({
        signer,
        contractAddress: prep.contract_address,
        channel: prep.channel,
        userHash: prep.user_hash,
        conversationText: prep.conversation_text,
      });
      await syncMintBackup(
        {
          wallet: address,
          token_id: data.token_id,
          channel: 'Web',
          kind: 'registro',
          history,
          conversation_id: conversationId,
        },
        apiHeaders()
      );
      setResult(data);
      onMintSuccess?.(data);
    } catch (e) {
      setError(e.response?.data?.detail || e.reason || e.message || t('mint.error'));
    } finally {
      setLoading(false);
      setPrepareData(null);
    }
  };

  const handleMint = async () => {
    const wallet = (walletAddress || '').trim();
    if (!wallet) {
      setError(t('mint.walletRequired'));
      return;
    }
    try {
      const prep = await prepareRegistroMint(
        {
          wallet,
          channel: 'Web',
          history,
          user_id: userId,
          conversation_id: conversationId,
        },
        apiHeaders()
      );
      setPrepareData(prep);
      setPickerOpen(true);
    } catch (e) {
      setError(e.response?.data?.detail || e.message || t('mint.error'));
    }
  };

  if (!isProConfirmed) {
    return null;
  }

  if (!config.enabled) {
    if (compact) return null;
    return (
      <p className="text-[10px] text-slate-500 px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-100">
        {t('mint.notConfigured')}
      </p>
    );
  }

  const boxClass = compact
    ? 'flex flex-wrap items-center gap-2 py-2 px-3 rounded-xl border border-red-200/80 bg-slate-900/5'
    : 'p-4 rounded-xl border border-red-200 bg-gradient-to-br from-slate-900 to-slate-800 text-slate-100';

  return (
    <>
      <WalletProviderModal
        open={pickerOpen}
        title={t('mint.pickerTitle')}
        onSelect={runMint}
        onClose={() => {
          setPickerOpen(false);
          setPrepareData(null);
        }}
      />
      <div className={boxClass}>
        <div className={compact ? 'flex items-center gap-2 min-w-0 flex-1' : 'mb-3'}>
          <span className="material-symbols-outlined text-red-700 text-lg shrink-0">link</span>
          <div className="min-w-0">
            <p className={`font-bold ${compact ? 'text-[11px] text-red-900' : 'text-sm text-red-400'}`}>
              {t('mint.title')}
            </p>
            {!compact && <p className="text-xs text-slate-400 mt-0.5">{t('mint.subtitle')}</p>}
          </div>
        </div>
        {result ? (
          <p className="text-emerald-400 font-semibold text-xs">
            {t('mint.success', { id: result.token_id ?? '—' })}
          </p>
        ) : (
          <button
            type="button"
            disabled={loading || !walletAddress}
            onClick={handleMint}
            className={
              compact
                ? 'text-[10px] px-2.5 py-1 rounded-lg bg-red-800 text-white font-bold'
                : 'text-xs px-3 py-1.5 rounded-lg bg-red-700 text-white font-bold'
            }
          >
            {loading ? t('mint.loading') : t('mint.cta')}
          </button>
        )}
        {error && <p className="text-[10px] text-red-300 mt-1">{error}</p>}
      </div>
    </>
  );
};

export default MintRegistroPanel;
