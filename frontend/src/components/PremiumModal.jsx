import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { connectWallet, hasWalletProvider, getLinkedAccount } from '../blockchain/wallet';
import { useI18n } from '../i18n/I18nContext';
import {
  ceditBtnPrimaryClass,
  ceditBtnSecondaryClass,
  ceditCardClass,
  ceditIconBoxClass,
} from '../theme/ceditPalette';

const STORAGE_WALLET = 'cedit_wallet';
const STORAGE_NAME = 'cedit_display_name';
const STORAGE_PRO = 'cedit_premium_active';

async function activatePremiumWallet({ wallet, userId, apiHeaders }) {
  const { data } = await axios.post(
    '/api/premium/activate',
    { wallet: wallet.trim(), user_id: userId },
    apiHeaders
  );
  return data;
}

const PremiumModal = ({ isOpen, onClose, onActivated, userId, apiHeaders }) => {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [linkedHint, setLinkedHint] = useState('');

  const finishActivation = useCallback(
    (entry) => {
      localStorage.setItem(STORAGE_WALLET, entry.wallet);
      localStorage.setItem(STORAGE_NAME, entry.display_name);
      localStorage.setItem(STORAGE_PRO, 'true');
      onActivated({
        wallet: entry.wallet,
        displayName: entry.display_name,
        isPro: true,
      });
      onClose();
    },
    [onActivated, onClose]
  );

  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;
    (async () => {
      const linked = await getLinkedAccount();
      if (cancelled || !linked) return;
      setLinkedHint(`${linked.slice(0, 6)}…${linked.slice(-4)}`);
      setLoading(true);
      setError('');
      try {
        const entry = await activatePremiumWallet({ wallet: linked, userId, apiHeaders });
        if (!cancelled) finishActivation(entry);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.detail || err.message || t('premium.error'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      setLinkedHint('');
    };
  }, [isOpen, userId, apiHeaders, t, finishActivation]);

  const handleConnect = async () => {
    if (!hasWalletProvider()) {
      setError(t('premium.noWallet'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { address } = await connectWallet();
      const entry = await activatePremiumWallet({ wallet: address, userId, apiHeaders });
      finishActivation(entry);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || t('premium.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget && !loading) onClose?.();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm cedit-fade-in"
      onClick={handleBackdrop}
      role="presentation"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200/90 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="premium-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50/80 px-6 py-4 flex items-center gap-3 border-b border-slate-200/80">
          <div className={ceditIconBoxClass('blue', 'w-11 h-11')}>
            <span className="material-symbols-outlined text-white text-xl">account_balance_wallet</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-800">{t('premium.badge')}</p>
            <h2 id="premium-modal-title" className="text-slate-800 font-bold text-lg leading-tight">
              {t('premium.title')}
            </h2>
            <p className="text-slate-500 text-xs">{t('app.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none shrink-0 disabled:opacity-40"
            aria-label={t('gate.cancel')}
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5 text-slate-700 text-sm leading-relaxed space-y-3 bg-gradient-to-b from-slate-50/90 to-white">
          <p>{t('premium.body')}</p>
          <ul className={`text-xs space-y-2 ${ceditCardClass('blue', 'px-3 py-3')}`}>
            <li className="flex items-start gap-2 text-slate-700">
              <span className="material-symbols-outlined text-blue-700 text-base shrink-0">check_circle</span>
              {t('premium.benefit1')}
            </li>
            <li className="flex items-start gap-2 text-slate-700">
              <span className="material-symbols-outlined text-blue-700 text-base shrink-0">check_circle</span>
              {t('premium.benefit2')}
            </li>
            <li className="flex items-start gap-2 text-slate-700">
              <span className="material-symbols-outlined text-blue-700 text-base shrink-0">check_circle</span>
              {t('premium.benefit3')}
            </li>
          </ul>
          {linkedHint && loading && (
            <p className={`text-xs text-blue-800 ${ceditCardClass('blue')}`}>
              {t('premium.syncing', { wallet: linkedHint })}
            </p>
          )}
          {error && (
            <p className={`text-xs text-slate-700 ${ceditCardClass('gray')}`} role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="px-6 pb-6 flex flex-col gap-2 bg-slate-50/50 border-t border-slate-100">
          <button
            type="button"
            disabled={loading}
            onClick={handleConnect}
            className={`w-full ${ceditBtnPrimaryClass('blue')}`}
          >
            <span className="material-symbols-outlined text-base">account_balance_wallet</span>
            {loading ? t('premium.loading') : t('premium.connect')}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className={`w-full ${ceditBtnSecondaryClass()} text-slate-500`}
          >
            {t('gate.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PremiumModal;
export { STORAGE_WALLET, STORAGE_NAME, STORAGE_PRO, activatePremiumWallet };
