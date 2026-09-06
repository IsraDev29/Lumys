import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const PUERTO_VITE = Number(process.env.PORT) || 5173;
const PUERTO_API = Number(process.env.PUERTO_API) || 5000;

export default defineConfig({
  plugins: [react()],

  server: {
    port: PUERTO_VITE,
    proxy: {
      '/api': {
        target: `http://localhost:${PUERTO_API}`,
        changeOrigin: true,
      },
      // El backend expone /health fuera de /api y la vista institucional lo usa
      // para el semáforo de estado del sistema.
      '/health': `http://localhost:${PUERTO_API}`,
    },
  },

  build: {
    outDir: 'dist',
    // Los assets llevan hash en el nombre; el service worker cachea por
    // navegación, no por lista fija de archivos, así que no le molesta.
    sourcemap: true,
  },
});
