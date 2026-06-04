import axios from 'axios';
import { connectWallet } from './wallet';

/**
 * Web: abre MetaMask/Pali para firmar la autorización del contrato;
 * el backend acuña con onlyOwner (contrato desplegado actual).
 */
export async function connectWalletForMint() {
  const { signer, address, provider } = await connectWallet();
  return { signer, address, provider };
}

export async function prepareRegistroMint(payload, apiHeaders = {}) {
  const { data } = await axios.post('/api/blockchain/prepare-attest-web', payload, apiHeaders);
  return data;
}

export async function preparePdfMint(payload, apiHeaders = {}) {
  const { data } = await axios.post('/api/blockchain/prepare-attest-pdf-web', payload, apiHeaders);
  return data;
}

export async function attestRegistroWithExtension(
  { wallet, channel = 'Web', history = [], userId = '', conversationId = '' },
  apiHeaders = {}
) {
  const prep = await prepareRegistroMint(
    {
      wallet: wallet.trim(),
      channel,
      history,
      user_id: userId,
      conversation_id: conversationId,
    },
    apiHeaders
  );

  const { signer, address } = await connectWalletForMint();
  if (address.toLowerCase() !== wallet.trim().toLowerCase()) {
    throw new Error('La cuenta de la extensión no coincide con su wallet Pro conectada.');
  }

  const signature = await signer.signMessage(prep.sign_message);

  const { data } = await axios.post(
    '/api/blockchain/attest',
    {
      wallet: wallet.trim(),
      channel,
      history,
      user_id: userId,
      conversation_id: conversationId,
      signature,
      issued_at: prep.issued_at,
    },
    apiHeaders
  );
  return data;
}

export async function attestPdfWithExtension(
  { wallet, pdfHash, mefScore, channel = 'Web', conversationId = '', userId = '' },
  apiHeaders = {}
) {
  const prep = await preparePdfMint(
    {
      wallet: wallet.trim(),
      pdf_hash: pdfHash,
      mef_score: mefScore,
      channel,
      conversation_id: conversationId,
      user_id: userId,
    },
    apiHeaders
  );

  const { signer, address } = await connectWalletForMint();
  if (address.toLowerCase() !== wallet.trim().toLowerCase()) {
    throw new Error('La cuenta de la extensión no coincide con su wallet Pro conectada.');
  }

  const signature = await signer.signMessage(prep.sign_message);

  const { data } = await axios.post(
    '/api/blockchain/attest-pdf',
    {
      wallet: wallet.trim(),
      pdf_hash: prep.pdf_hash,
      channel: prep.channel,
      channel_url: prep.channel_url,
      mef_score: prep.mef_score,
      conversation_id: conversationId,
      user_id: userId,
      signature,
      issued_at: prep.issued_at,
    },
    apiHeaders
  );
  return data;
}
