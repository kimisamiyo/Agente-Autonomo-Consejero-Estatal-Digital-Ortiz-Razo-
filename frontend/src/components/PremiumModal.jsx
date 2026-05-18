import React, { useState, useEffect } from 'react';
import axios from 'axios';

const STORAGE_WALLET = 'cedit_wallet';
const STORAGE_NAME = 'cedit_display_name';
const STORAGE_PRO = 'cedit_premium_active';

const PremiumModal = ({ isOpen, onClose, onActivated, userId, apiHeaders }) => {
  const [mode, setMode] = useState('login');
  const [wallet, setWallet] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const savedWallet = localStorage.getItem(STORAGE_WALLET) || '';
    const savedName = localStorage.getItem(STORAGE_NAME) || '';
    setWallet(savedWallet);
    setDisplayName(savedName);
    setMode(savedWallet ? 'login' : 'register');
    setError('');
    setHint(savedWallet ? 'Wallet guardada. Pulse «Cargar usuario» o actualice la dirección.' : '');
  }, [isOpen]);

  const saveLocal = (entry) => {
    localStorage.setItem(STORAGE_WALLET, entry.wallet);
    localStorage.setItem(STORAGE_NAME, entry.display_name);
    localStorage.setItem(STORAGE_PRO, 'true');
    onActivated({
      wallet: entry.wallet,
      displayName: entry.display_name,
      isPro: true,
    });
    onClose();
  };

  const handleLookup = async () => {
    if (!wallet.trim()) {
      setError('Ingrese su wallet.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.get('/api/premium/lookup', {
        params: { wallet: wallet.trim() },
        ...apiHeaders,
      });
      setDisplayName(data.display_name);
      setHint(`Usuario encontrado: ${data.display_name}`);
      setMode('login');
    } catch {
      setHint('');
      setMode('register');
      setError('Wallet nueva. Complete su nombre para registrarse.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!wallet.trim() || !displayName.trim()) {
      setError('Wallet y nombre de usuario son obligatorios.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.post(
        '/api/premium/register',
        { wallet: wallet.trim(), display_name: displayName.trim(), user_id: userId },
        apiHeaders
      );
      saveLocal(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo registrar.');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!wallet.trim()) {
      setError('Ingrese su wallet.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.post(
        '/api/premium/connect',
        { wallet: wallet.trim() },
        apiHeaders
      );
      saveLocal(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Wallet no registrada. Use registro primero.');
      setMode('register');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 cedit-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-red-100 overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-red-800 to-red-700 text-white">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs uppercase tracking-wider opacity-90">Plan Premium</p>
              <h2 className="text-lg font-bold">Activar modo Premium</h2>
            </div>
            <button type="button" onClick={onClose} className="text-white/80 hover:text-white text-xl leading-none">
              ×
            </button>
          </div>
          <p className="text-[11px] mt-2 opacity-90">
            Vincule su wallet Syscoin y guarde su perfil para auditorías ilimitadas.
          </p>
        </div>

        <div className="p-6 space-y-4">
          {mode === 'register' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre de usuario</label>
              <input
                type="text"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-red-500 focus:border-red-400"
                placeholder="Ej: María R. — Servidor MEF"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
              <p className="text-[10px] text-slate-400 mt-1">Primera vez: elija cómo aparecerá en CEDIT.</p>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Usuario vinculado</p>
              <p className="text-sm font-bold text-slate-800">{displayName || '—'}</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Dirección wallet</label>
            <input
              type="text"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:ring-1 focus:ring-red-500"
              placeholder="0x… o dirección Syscoin"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
            />
          </div>

          {hint && <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">{hint}</p>}
          {error && <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex flex-col gap-2 pt-2">
            {mode === 'register' ? (
              <button
                type="button"
                disabled={loading}
                onClick={handleRegister}
                className="w-full py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm font-bold hover:opacity-95 disabled:opacity-50"
              >
                {loading ? 'Registrando…' : 'Registrar y activar Premium'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleConnect}
                  className="w-full py-2.5 rounded-lg bg-gradient-to-r from-red-700 to-red-600 text-white text-sm font-bold hover:opacity-95 disabled:opacity-50"
                >
                  {loading ? 'Cargando…' : 'Cargar usuario'}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleLookup}
                  className="w-full py-2 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Buscar nombre por wallet
                </button>
              </>
            )}
            <button
              type="button"
              className="text-xs text-slate-500 hover:text-slate-800"
              onClick={() => {
                setMode(mode === 'register' ? 'login' : 'register');
                setError('');
              }}
            >
              {mode === 'register' ? '¿Ya tiene wallet? Cargar usuario' : '¿Primera vez? Registrar cuenta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PremiumModal;
export { STORAGE_WALLET, STORAGE_NAME, STORAGE_PRO };
