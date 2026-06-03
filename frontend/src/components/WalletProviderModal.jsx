import React, { useMemo } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { listInjectedProviders } from '../blockchain/walletProviders';
import { ceditBtnPrimaryClass, ceditBtnSecondaryClass } from '../theme/ceditPalette';

const WalletProviderModal = ({ open, title, onSelect, onClose }) => {
  const { t } = useI18n();
  const providers = useMemo(() => listInjectedProviders(), [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5 border border-slate-200">
        <h3 className="text-sm font-bold text-slate-800 mb-1">
          {title || t('walletPicker.title')}
        </h3>
        <p className="text-xs text-slate-500 mb-4">{t('walletPicker.subtitle')}</p>
        {providers.length === 0 ? (
          <p className="text-xs text-red-700 mb-3">{t('walletPicker.none')}</p>
        ) : (
          <ul className="space-y-2 mb-4">
            {providers.map(({ provider, label }) => (
              <li key={label}>
                <button
                  type="button"
                  className={`${ceditBtnPrimaryClass('blue')} w-full justify-center !text-sm`}
                  onClick={() => onSelect(provider)}
                >
                  <span className="material-symbols-outlined text-base">account_balance_wallet</span>
                  {label}
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className={`${ceditBtnSecondaryClass()} w-full !text-xs`} onClick={onClose}>
          {t('walletPicker.cancel')}
        </button>
      </div>
    </div>
  );
};

export default WalletProviderModal;
