import { ethers } from 'ethers';

export const NETWORK_CONFIG = {
  chainId: 57057,
  chainIdHex: '0xdee1',
  chainName: 'zkTanenbaum Testnet',
  nativeCurrency: {
    name: 'TSYS',
    symbol: 'TSYS',
    decimals: 18,
  },
  rpcUrl: 'https://rpc-zk.tanenbaum.io/',
  blockExplorerUrl: 'https://explorer-zk.tanenbaum.io/',
  blockExplorerUrls: ['https://explorer-zk.tanenbaum.io/'],
};

export function getProvider() {
  if (!window.ethereum) {
    throw new Error('No Ethereum provider found');
  }
  return window.ethereum;
}

async function switchToZkSys(provider) {
  const currentChainId = await provider.request({
    method: 'eth_chainId',
  });
  if (currentChainId === NETWORK_CONFIG.chainIdHex) return;
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: NETWORK_CONFIG.chainIdHex }],
    });
  } catch (error) {
    if (error.code === 4902) {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: NETWORK_CONFIG.chainIdHex,
            chainName: NETWORK_CONFIG.chainName,
            nativeCurrency: NETWORK_CONFIG.nativeCurrency,
            rpcUrls: [NETWORK_CONFIG.rpcUrl],
            blockExplorerUrls: NETWORK_CONFIG.blockExplorerUrls,
          },
        ],
      });
    } else {
      throw error;
    }
  }
}

export async function connectWallet(injectedProvider = null) {
  const externalProvider = injectedProvider || getProvider();
  const accounts = await externalProvider.request({
    method: 'eth_requestAccounts',
  });
  if (!accounts || accounts.length === 0) {
    throw new Error('No accounts available');
  }
  await switchToZkSys(externalProvider);
  const ethersProvider = new ethers.providers.Web3Provider(externalProvider, 'any');
  const signer = ethersProvider.getSigner();
  const address = await signer.getAddress();
  try {
    const balance = await ethersProvider.getBalance(address);
    console.log('Balance TSYS:', ethers.utils.formatEther(balance));
  } catch (e) {
    console.warn('No se pudo verificar el balance:', e);
  }
  return {
    provider: ethersProvider,
    signer,
    address,
  };
}

/** Cuenta ya autorizada para este sitio (MetaMask, Pali, Rabby…). */
export async function getLinkedAccount() {
  if (typeof window === 'undefined' || !window.ethereum) return null;
  try {
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    return accounts?.[0] || null;
  } catch {
    return null;
  }
}

export function setupWalletListeners(onAccountChange) {
  if (typeof window === 'undefined' || !window.ethereum) return;
  const provider = window.ethereum;
  const handleAccounts = (accounts) => {
    const addr = accounts?.[0] || null;
    if (onAccountChange) onAccountChange(addr);
    else window.location.reload();
  };
  provider.on('accountsChanged', handleAccounts);
  provider.on('chainChanged', () => {
    if (!onAccountChange) window.location.reload();
  });
  provider.on('connect', () => {
    getLinkedAccount().then((addr) => {
      if (addr && onAccountChange) onAccountChange(addr);
    });
  });
}

export function hasWalletProvider() {
  return typeof window !== 'undefined' && Boolean(window.ethereum);
}

/** @deprecated use hasWalletProvider */
export function hasMetaMask() {
  return hasWalletProvider();
}
