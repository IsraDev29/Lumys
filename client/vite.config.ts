import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/* ===========================================================================
 * Lumys* — configuración de Vite
 *
 * El backend de Express sigue siendo el de siempre y no se toca. En desarrollo
 * corren dos procesos: Vite en 5173 y Express en 5000. El proxy hace que el
 * cliente pida `/api/v1/...` a su propio origen, igual que en producción, así
 * que no hay una rama de código "en dev la URL es otra" — y de paso el CORS
 * restringido del servidor no se entera de que existe un segundo puerto.
 * =========================================================================== */

/* `PORT` es el puerto de Vite, no el de la API.
 *
 * Antes esta constante leía `PORT` y lo usaba como destino del proxy, así que
 * dentro de la configuración del cliente esa variable significaba "el puerto del
 * servidor de Express" — y no había forma de mover Vite. Cualquier herramienta
 * que arranque el cliente con un puerto asignado (el arnés de previsualización,
 * un contenedor, un segundo Vite en paralelo) acababa redirigiendo el proxy
 * contra sí mismo.
 *
 * Ahora cada proceso tiene su variable. Si movés Express con `PORT`, decíselo
 * también al cliente con `PUERTO_API`. */
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
