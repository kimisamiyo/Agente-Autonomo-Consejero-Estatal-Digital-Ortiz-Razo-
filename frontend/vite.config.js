import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy para n8n (evita CORS)
      '/n8n': {
        target: 'http://localhost:5678',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/n8n/, '/webhook-test/cedit'),
      },
      // Proxy para FastAPI (evita CORS en descargas/cargas de archivos)
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
