import axios from 'axios';
import { connectWalletForMint, fetchBlockchainConfig } from './mintRegistro';

export async function requestMintFirmaPdf({
  wallet,
  pdfHash,
  mefScore,
  channel = 'Web',
  channelUrl = '',
  conversationId = '',
  userId = '',
  apiHeaders = {},
}) {
  const { data } = await axios.post(
    '/api/blockchain/attest-pdf',
    {
      wallet: wallet.trim(),
      pdf_hash: pdfHash,
      mef_score: mefScore,
      channel,
      channel_url: channelUrl || undefined,
      conversation_id: conversationId,
      user_id: userId,
    },
    apiHeaders
  );
  return data;
}

export { fetchBlockchainConfig, connectWalletForMint };

export function explorerPdfTokenUrl(contractAddress, tokenId, blockExplorerUrl) {
  const base = (blockExplorerUrl || 'https://explorer-zk.tanenbaum.io/').replace(/\/$/, '');
  if (!contractAddress || tokenId == null) return base;
  return `${base}/token/${contractAddress}?a=${tokenId}`;
}
