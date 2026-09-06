/* ===========================================================================
 * Lumys* — punto de entrada
 * ---------------------------------------------------------------------------
 * El orden de los proveedores importa: los avisos envuelven a la sesión porque
 * cerrar sesión emite un aviso, y el enrutador envuelve a todo porque tanto la
 * sesión (para redirigir al entrar) como los avisos se usan dentro de rutas.
 * =========================================================================== */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import './estilos/variables.css';
import './estilos/movimiento.css';
import './estilos/identidad.css';
import './estilos/base.css';
import './estilos/components.css';
import './estilos/checkin.css';
import './estilos/dashboard.css';
import './estilos/inicio.css';
import './estilos/historial.css';
import './estilos/comunitario.css';
import './estilos/red.css';
import './estilos/lumy.css';
/* La capa de Stitch va la última a propósito. Sus utilidades y las clases de
   Bootstrap son ambas selectores de una sola clase, así que entre iguales gana
   la que se declara después; y las hojas de arriba tienen que poder ser
   sobrescritas por una vista ya portada, no al revés. */
import './estilos/stitch.css';

import { App } from './App.tsx';
import { ProveedorAvisos } from './lib/avisos.tsx';
import { ProveedorSesion } from './lib/sesion.tsx';
import { AvisoConexion } from './componentes/AvisoConexion.tsx';
import { iniciarPwa } from './lib/pwa.ts';

iniciarPwa();

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('Lumys: falta el nodo #raiz en index.html');

createRoot(raiz).render(
  <StrictMode>
    <BrowserRouter>
      <ProveedorAvisos>
        <ProveedorSesion>
          <App />
          <AvisoConexion />
        </ProveedorSesion>
      </ProveedorAvisos>
    </BrowserRouter>
  </StrictMode>,
);
