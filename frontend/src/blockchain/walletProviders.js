/** Detecta MetaMask, Pali, Rabby, etc. (EIP-6963 + providers[]) */

export function listInjectedProviders() {
  if (typeof window === 'undefined') return [];
  const eth = window.ethereum;
  if (!eth) return [];

  const seen = new Set();
  const out = [];

  const add = (provider, label) => {
    if (!provider || seen.has(provider)) return;
    seen.add(provider);
    out.push({ provider, label });
  };

  if (eth.providers && Array.isArray(eth.providers)) {
    eth.providers.forEach((p) => {
      let label = 'Wallet';
      if (p.isMetaMask && !p.isRabby) label = 'MetaMask';
      else if (p.isRabby) label = 'Rabby';
      else if (p.isPali || p.isSyscoin) label = 'Pali';
      else if (p.isBraveWallet) label = 'Brave';
      add(p, label);
    });
  }

  if (out.length === 0) {
    let label = 'Wallet del navegador';
    if (eth.isMetaMask && !eth.isRabby) label = 'MetaMask';
    else if (eth.isRabby) label = 'Rabby';
    else if (eth.isPali || eth.isSyscoin) label = 'Pali';
    add(eth, label);
  }

  return out;
}

export function hasAnyWalletProvider() {
  return listInjectedProviders().length > 0;
}
