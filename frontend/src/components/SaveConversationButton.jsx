import React, { useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { fetchBlockchainConfig } from '../blockchain/mintRegistro';
import { saveSavedTokenId } from '../blockchain/conversationRestore';
import { attestRegistroWithExtension } from '../blockchain/walletMint';
import { ceditBtnSecondaryClass } from '../theme/ceditPalette';

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

  const history = messages
    .filter((m) => m.content && !m.isDocAck)
    .map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.fullContent || m.content || '',
    }));

  if (!isProConfirmed) {
    return null;
  }

  const handleSave = async () => {
    if (!walletAddress?.trim()) {
      setError(t('saveConv.needWallet'));
      return;
    }
    if (history.length < 1) {
      setError(t('saveConv.empty'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const cfg = await fetchBlockchainConfig();
      if (!cfg.enabled) {
        setError(t('saveConv.notConfigured'));
        return;
      }
      const data = await attestRegistroWithExtension(
        {
          wallet: walletAddress.trim(),
          channel: 'Web',
          history,
          userId,
          conversationId,
        },
        apiHeaders()
      );
      if (data.token_id != null) {
        saveSavedTokenId(walletAddress, data.token_id);
      }
      onSaved?.(data);
    } catch (err) {
      if (err.code === 4001 || err.code === 'ACTION_REJECTED') {
        setError(t('saveConv.rejected'));
      } else {
        setError(err.response?.data?.detail || err.message || t('saveConv.error'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
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
  );
};

export default SaveConversationButton;
