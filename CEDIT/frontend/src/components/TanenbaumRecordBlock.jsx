import React, { useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { explorerPdfTokenUrl } from '../blockchain/mintFirmaPdf';

function shortAddr(addr) {
  if (!addr || addr.length < 12) return addr || '—';
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

const TanenbaumRecordBlock = ({
  config = {},
  pdfHash = '',
  tokenId = null,
  txHash = '',
  explorerTx = '',
  contractAddress = '',
  compact = false,
}) => {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const explorerBase = (config.block_explorer || config.blockExplorer || 'https://explorer-zk.tanenbaum.io').replace(
    /\/$/,
    ''
  );
  const chainName = config.chain_name || 'zkTanenbaum Testnet';
  const chainId = config.chain_id || 57057;
  const txUrl = explorerTx || (txHash ? `${explorerBase}/tx/${txHash.replace(/^0x/, '0x')}` : '');
  const nftUrl =
    tokenId != null && contractAddress
      ? explorerPdfTokenUrl(contractAddress, tokenId, explorerBase)
      : '';
  const contractUrl = contractAddress ? `${explorerBase}/address/${contractAddress}` : config.pdf_contract_explorer_url;

  const copyHash = async () => {
    if (!pdfHash) return;
    try {
      await navigator.clipboard.writeText(pdfHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const box = compact
    ? 'text-xs space-y-2'
    : 'mt-3 rounded-xl border border-emerald-300 bg-emerald-50/90 px-3 py-3 text-xs space-y-2.5';

  return (
    <div className={box}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-white text-[10px] font-bold">
          <span className="material-symbols-outlined text-[12px]">link</span>
          {chainName}
        </span>
        <span className="text-[10px] text-slate-600">chainId {chainId}</span>
        <a
          href={explorerBase}
          target="_blank"
          rel="noreferrer"
          className="text-[10px] font-semibold text-[var(--cedit-steel)] underline ml-auto"
        >
          {t('expedientes.openExplorer')}
        </a>
      </div>

      {pdfHash && (
        <div>
          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">{t('expedientes.pdfHashLabel')}</p>
          <div className="flex items-start gap-2 mt-0.5">
            <code className="flex-1 text-[10px] font-mono text-slate-800 break-all leading-relaxed">{pdfHash}</code>
            <button
              type="button"
              onClick={copyHash}
              className="shrink-0 text-[10px] px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50"
            >
              {copied ? t('expedientes.copied') : t('expedientes.copyHash')}
            </button>
          </div>
        </div>
      )}

      {tokenId != null && (
        <p className="text-emerald-800 font-semibold">{t('expedientes.firmaDone', { id: tokenId })}</p>
      )}

      {contractAddress && (
        <p className="text-[10px] text-slate-600">
          {t('expedientes.contractLabel')}:{' '}
          <a href={contractUrl} target="_blank" rel="noreferrer" className="font-mono text-[var(--cedit-steel)] underline">
            {shortAddr(contractAddress)}
          </a>
        </p>
      )}

      {(txHash || txUrl) && (
        <div>
          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">{t('expedientes.txHashLabel')}</p>
          {txHash && (
            <code className="block text-[10px] font-mono text-slate-700 break-all mt-0.5">{txHash}</code>
          )}
          {txUrl && (
            <a href={txUrl} target="_blank" rel="noreferrer" className="inline-block mt-1 text-[11px] font-bold text-[var(--cedit-steel)] underline">
              {t('expedientes.viewTxTanenbaum')}
            </a>
          )}
        </div>
      )}

      {nftUrl && (
        <a href={nftUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--cedit-steel)] underline">
          <span className="material-symbols-outlined text-sm">token</span>
          {t('expedientes.viewNftTanenbaum')}
        </a>
      )}
    </div>
  );
};

export default TanenbaumRecordBlock;
