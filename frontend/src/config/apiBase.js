/**
 * En producción (Cloudflare/Vercel) define VITE_API_BASE_URL=https://tu-api.fly.dev
 * En local, vacío → las peticiones van a /api y el proxy de Vite usa el puerto 8001.
 */
export const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export function configureApiClient(axios) {
  if (API_BASE) {
    axios.defaults.baseURL = API_BASE;
  }
}
