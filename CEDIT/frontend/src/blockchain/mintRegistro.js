import axios from 'axios';
import { connectWallet, hasWalletProvider, NETWORK_CONFIG } from './wallet';

/**
 * Pide al backend acuñar el NFT (onlyOwner en contrato).
 * La wallet conectada es el destinatario del token.
 */
export async function requestMintRegistro({
  wallet,
  channel = 'Web',
  history = [],
  userId = '',
  conversationId = '',
  apiHeaders = {},
}) {
  const { data } = await axios.post(
    '/api/blockchain/attest',
    {
      wallet: wallet.trim(),
      channel,
      history,
      user_id: userId,
      conversation_id: conversationId,
    },
    apiHeaders
  );
  return data;
}

export async function fetchBlockchainConfig() {
  const { data } = await axios.get('/api/blockchain/config');
  return data;
}

/** Conecta MetaMask en Tanenbaum y devuelve la dirección. */
export async function connectWalletForMint() {
  if (!hasWalletProvider()) {
    throw new Error('Instale MetaMask o Rabby para conectar su wallet.');
  }
  const { address } = await connectWallet();
  return address;
}

export function explorerTxUrl(txHash) {
  if (!txHash) return NETWORK_CONFIG.blockExplorerUrl;
  return `${NETWORK_CONFIG.blockExplorerUrl}tx/${txHash}`;
}

export function explorerTokenUrl(contractAddress, tokenId) {
  if (!contractAddress || tokenId == null) return NETWORK_CONFIG.blockExplorerUrl;
  return `${NETWORK_CONFIG.blockExplorerUrl}token/${contractAddress}?a=${tokenId}`;
}
