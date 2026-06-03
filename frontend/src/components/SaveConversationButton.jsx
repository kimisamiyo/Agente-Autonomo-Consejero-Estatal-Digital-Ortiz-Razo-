import React, { useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { fetchBlockchainConfig } from '../blockchain/mintRegistro';
import { saveSavedTokenId } from '../blockchain/conversationRestore';
import {
  prepareRegistroMint,
  mintRegistroViaWallet,
  syncMintBackup,
} from '../blockchain/walletMint';
import { ceditBtnSecondaryClass } from '../theme/ceditPalette';
import WalletProviderModal from './WalletProviderModal';

const SaveConversationButton = ({
  walletAddress,
  messages = [],
  userId,
  conversationId,
  apiHeaders,
  onSaved,
  disabled = false,
  isProConfirmed = false,
}) => {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [prepareData, setPrepareData] = useState(null);

  const history = messages
    .filter((m) => m.content && !m.isDocAck)
    .map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.fullContent || m.content || '',
    }));

  if (!isProConfirmed) {
    return null;
  }

  const runMint = async (injectedProvider) => {
    setPickerOpen(false);
    setLoading(true);
    setError('');
    try {
      const cfg = await fetchBlockchainConfig();
      if (!cfg.enabled) {
        setError(t('saveConv.notConfigured'));
        return;
      }
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
      const { connectWalletForMint } = await import('../blockchain/walletMint');
      const { signer, address } = await connectWalletForMint(injectedProvider);
      if (address.toLowerCase() !== walletAddress.trim().toLowerCase()) {
        setError(t('walletPicker.wrongAccount'));
        return;
      }
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
        },
        apiHeaders()
      );
      if (data.token_id != null) {
        saveSavedTokenId(address, data.token_id);
      }
      onSaved?.(data);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(detail || err.reason || err.message || t('saveConv.error'));
    } finally {
      setLoading(false);
      setPrepareData(null);
    }
  };

  const handleSave = async () => {
    if (!walletAddress?.trim()) {
      setError(t('saveConv.needWallet'));
      return;
    }
    if (history.length < 1) {
      setError(t('saveConv.empty'));
      return;
    }
    try {
      const prep = await prepareRegistroMint(
        {
          wallet: walletAddress.trim(),
          channel: 'Web',
          history,
          user_id: userId,
          conversation_id: conversationId,
        },
        apiHeaders()
      );
      setPrepareData(prep);
      setPickerOpen(true);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || t('saveConv.error'));
    }
  };

  return (
    <>
      <WalletProviderModal
        open={pickerOpen}
        title={t('saveConv.pickerTitle')}
        onSelect={runMint}
        onClose={() => {
          setPickerOpen(false);
          setPrepareData(null);
        }}
      />
      <div className="flex flex-col gap-1">
        <button
          type="button"
          disabled={disabled || loading || history.length < 1}
          onClick={handleSave}
          className={`${ceditBtnSecondaryClass()} !py-1.5 !px-2.5 text-[10px]`}
          title={t('saveConv.hint')}
        >
          <span className="material-symbols-outlined text-sm">save</span>
          {loading ? t('saveConv.loading') : t('saveConv.cta')}
        </button>
        {error && <p className="text-[10px] text-red-700 max-w-[200px]">{error}</p>}
      </div>
    </>
  );
};

export default SaveConversationButton;
