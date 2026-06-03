import axios from 'axios';

export async function fetchRestoredConversation(wallet, apiHeaders = {}) {
  const { data } = await axios.get('/api/blockchain/restore', {
    params: { wallet: wallet.trim() },
    ...apiHeaders,
  });
  return data;
}

export function storageKeySavedToken(wallet) {
  return `cedit_saved_token_${(wallet || '').toLowerCase()}`;
}

export function saveSavedTokenId(wallet, tokenId) {
  if (!wallet || tokenId == null) return;
  localStorage.setItem(storageKeySavedToken(wallet), String(tokenId));
}
