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
      className="cedit-overlay flex items-center justify-center p-4 z-[100]"
      onClick={handleBackdrop}
      role="presentation"
    >
      <div
        className="cedit-modal-sheet w-full max-w-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="premium-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-6 py-4 flex items-center gap-3 border-b border-[var(--cedit-border)]"
          style={{
            background:
              'linear-gradient(135deg, color-mix(in srgb, var(--cedit-steel) 14%, var(--cedit-surface)), var(--cedit-surface) 70%)',
          }}
        >
          <div className={ceditIconBoxClass('steel', 'w-11 h-11')}>
            <span className="material-symbols-outlined text-white text-xl">account_balance_wallet</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--cedit-steel)' }}>
              {t('premium.badge')}
            </p>
            <h2
              id="premium-modal-title"
              className="font-bold text-lg leading-tight"
              style={{ color: 'var(--cedit-text)' }}
            >
              {t('premium.title')}
            </h2>
            <p className="text-xs" style={{ color: 'var(--cedit-text-muted)' }}>
              {t('app.subtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1 rounded-lg disabled:opacity-40"
            style={{ color: 'var(--cedit-text-faint)' }}
            aria-label={t('common.close')}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div
          className="px-6 py-5 text-sm leading-relaxed space-y-3 cedit-readable"
          style={{ color: 'var(--cedit-text)', background: 'var(--cedit-surface)' }}
        >
          <p>{t('premium.body')}</p>
          <ul className={`text-xs space-y-2 ${ceditCardClass('steel', 'px-3 py-3')}`}>
            {[1, 2, 3].map((n) => (
              <li key={n} className="flex items-start gap-2" style={{ color: 'var(--cedit-text)' }}>
                <span className="material-symbols-outlined text-[var(--cedit-steel)] text-base shrink-0">
                  check_circle
                </span>
                {t(`premium.benefit${n}`)}
              </li>
            ))}
          </ul>
          {linkedHint && loading && (
            <p className={`text-xs px-3 py-2 ${ceditCardClass('steel')}`} style={{ color: 'var(--cedit-text-muted)' }}>
              {t('premium.syncing', { wallet: linkedHint })}
            </p>
          )}
          {error && (
            <p className={`text-xs px-3 py-2 ${ceditCardClass('gray')}`} role="alert" style={{ color: 'var(--cedit-text)' }}>
              {error}
            </p>
          )}
        </div>

        <div
          className="px-6 py-4 flex flex-col gap-2 border-t border-[var(--cedit-border)]"
          style={{ background: 'var(--cedit-surface-2)' }}
        >
          <button
            type="button"
            disabled={loading}
            onClick={handleConnect}
            className={`w-full ${ceditBtnPrimaryClass('steel')}`}
          >
            <span className="material-symbols-outlined text-base">account_balance_wallet</span>
            {loading ? t('premium.loading') : t('premium.connect')}
          </button>
          <button type="button" disabled={loading} onClick={onClose} className={`w-full ${ceditBtnSecondaryClass()}`}>
            {t('gate.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PremiumModal;
export { STORAGE_WALLET, STORAGE_NAME, STORAGE_PRO, activatePremiumWallet };
