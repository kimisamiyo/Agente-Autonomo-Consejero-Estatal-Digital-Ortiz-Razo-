import { ethers } from 'ethers';
import axios from 'axios';
import { connectWallet, NETWORK_CONFIG } from './wallet';
import { CEDIT_REGISTROS_ABI } from './ceditRegistrosAbi';
import { CEDIT_FIRMAS_PDF_ABI } from './ceditFirmasPdfAbi';

function parseTokenIdFromReceipt(receipt, contract) {
  for (const log of receipt.logs || []) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed.name === 'RegistroAcunado' || parsed.name === 'FirmaPdfAcunada') {
        const tid = parsed.args.tokenId ?? parsed.args[0];
        return tid?.toNumber?.() ?? parseInt(String(tid), 10);
      }
    } catch {
      /* skip unrelated logs */
    }
  }
  return null;
}

export async function connectWalletForMint(injectedProvider = null) {
  const { signer, address, provider } = await connectWallet(injectedProvider);
  return { signer, address, provider };
}

export async function prepareRegistroMint(payload, apiHeaders = {}) {
  const { data } = await axios.post('/api/blockchain/prepare-attest-web', payload, apiHeaders);
  return data;
}

export async function mintRegistroViaWallet({
  signer,
  contractAddress,
  channel,
  userHash,
  conversationText,
}) {
  const contract = new ethers.Contract(contractAddress, CEDIT_REGISTROS_ABI, signer);
  const tx = await contract.mintRegistroSelf(channel, userHash, conversationText);
  const receipt = await tx.wait();
  const tokenId = parseTokenIdFromReceipt(receipt, contract, 'RegistroAcunado');
  const txHash = receipt.transactionHash;
  return {
    ok: true,
    token_id: tokenId,
    tx_hash: txHash,
    explorer_tx: `${NETWORK_CONFIG.blockExplorerUrl}tx/${txHash}`,
    explorer_nft:
      tokenId != null
        ? `${NETWORK_CONFIG.blockExplorerUrl}token/${contractAddress}?a=${tokenId}`
        : null,
    contract_address: contractAddress,
    user_hash: userHash,
    channel,
  };
}

export async function preparePdfMint(payload, apiHeaders = {}) {
  const { data } = await axios.post('/api/blockchain/prepare-attest-pdf-web', payload, apiHeaders);
  return data;
}

export async function mintFirmaPdfViaWallet({
  signer,
  contractAddress,
  pdfHash,
  channelUrl,
  channel,
  mefScore,
}) {
  const hashBytes = pdfHash.startsWith('0x') ? pdfHash : `0x${pdfHash}`;
  const contract = new ethers.Contract(contractAddress, CEDIT_FIRMAS_PDF_ABI, signer);
  const tx = await contract.mintFirmaPdfSelf(hashBytes, channelUrl, channel, mefScore);
  const receipt = await tx.wait();
  const tokenId = parseTokenIdFromReceipt(receipt, contract, 'FirmaPdfAcunada');
  const txHash = receipt.transactionHash;
  return {
    ok: true,
    kind: 'pdf_firma',
    token_id: tokenId,
    pdf_hash: hashBytes,
    tx_hash: txHash,
    explorer_tx: `${NETWORK_CONFIG.blockExplorerUrl}tx/${txHash}`,
    explorer_nft:
      tokenId != null
        ? `${NETWORK_CONFIG.blockExplorerUrl}token/${contractAddress}?a=${tokenId}`
        : null,
    contract_address: contractAddress,
    channel,
  };
}

export async function syncMintBackup(payload, apiHeaders = {}) {
  const { data } = await axios.post('/api/blockchain/sync-backup', payload, apiHeaders);
  return data;
}
