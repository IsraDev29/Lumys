/* ===========================================================================
 * Lumys* — mapa de rutas
 * ---------------------------------------------------------------------------
 * Reemplaza al `enrutar()` de app.js, que leía `location.hash`, buscaba la
 * vista en un mapa, la traía con `fetch`, la inyectaba con `innerHTML` y
 * después llamaba a mano al controlador que le tocara.
 *
 * Dos cambios de fondo:
 *
 *   1. Rutas de verdad (`/inicio`) en vez de hash (`#/inicio`). Se pueden
 *      compartir, el navegador las indexa y el botón de atrás se comporta como
 *      la gente espera. El servidor devuelve index.html para cualquier ruta que
 *      no empiece por /api, que es lo que hace falta para que funcionen.
 *   2. Las vistas privadas se cargan en diferido. La portada y el acceso —lo
 *      único que ve alguien que entra por primera vez— no arrastran el panel
 *      institucional ni el laboratorio de emociones.
 * =========================================================================== */

import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';

import { Cascaron } from './componentes/Cascaron.tsx';
import { Protegida } from './componentes/Protegida.tsx';
import { Cargador } from './componentes/comunes.tsx';
import { rutaInicial, useSesion } from './lib/sesion.tsx';

import { Bienvenida } from './vistas/Bienvenida.tsx';
import { Acceso } from './vistas/Acceso.tsx';

const Marca = lazy(() => import('./vistas/Marca.tsx'));
const Inicio = lazy(() => import('./vistas/Inicio.tsx'));
const Checkin = lazy(() => import('./vistas/Checkin.tsx'));
const Historial = lazy(() => import('./vistas/Historial.tsx'));
const Red = lazy(() => import('./vistas/Red.tsx'));
const Logros = lazy(() => import('./vistas/Logros.tsx'));
const Respirar = lazy(() => import('./vistas/Respirar.tsx'));
const Capsulas = lazy(() => import('./vistas/Capsulas.tsx'));
const Orientador = lazy(() => import('./vistas/Orientador.tsx'));
const Psicologo = lazy(() => import('./vistas/Psicologo.tsx'));
const Institucional = lazy(() => import('./vistas/Institucional.tsx'));
const Comunitario = lazy(() => import('./vistas/Comunitario.tsx'));
const Perfil = lazy(() => import('./vistas/Perfil.tsx'));
const Laboratorio = lazy(() => import('./vistas/Laboratorio.tsx'));

/**
 * Los enlaces de la versión anterior eran `#/inicio`. Si alguien tiene uno
 * guardado o pegado en un chat, esto lo lleva a donde esperaba en vez de
 * dejarlo en la portada sin explicación.
 */
function RedirigirHashViejo() {
  const navegar = useNavigate();
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#/')) {
      const destino = hash.slice(1).split('?')[0] ?? '/';
      window.history.replaceState(null, '', window.location.pathname);
      navegar(destino, { replace: true });
    }
  }, [navegar]);
  return null;
}

/** La raíz manda a la portada o al inicio del perfil, según haya sesión. */
function Raiz() {
  const { usuario } = useSesion();
  return <Navigate to={usuario ? rutaInicial(usuario.perfil) : '/bienvenida'} replace />;
}

export function App() {
  return (
    <>
      <RedirigirHashViejo />
      <a className="lm-skip" href="#lm-view">Saltar al contenido</a>

      <Suspense fallback={<Cargador />}>
        <Routes>
          <Route path="/" element={<Raiz />} />

          {/* Públicas: a pantalla completa, sin cáscara */}
          <Route path="/bienvenida" element={<Bienvenida />} />
          <Route path="/acceso" element={<Acceso />} />
          <Route path="/marca" element={<Marca />} />

          {/* Privadas: dentro de la cáscara y filtradas por perfil */}
          <Route element={<Protegida><Cascaron /></Protegida>}>
            <Route path="/inicio" element={<Inicio />} />
            <Route path="/checkin" element={<Checkin />} />
            <Route path="/historial" element={<Historial />} />
            <Route path="/red" element={<Red />} />
            <Route path="/logros" element={<Logros />} />
            <Route path="/respirar" element={<Respirar />} />
            <Route path="/capsulas" element={<Capsulas />} />
            <Route path="/orientador" element={<Orientador />} />
            <Route path="/psicologo" element={<Psicologo />} />
            <Route path="/institucional" element={<Institucional />} />
            <Route path="/comunitario" element={<Comunitario />} />
            <Route path="/perfil" element={<Perfil />} />
            <Route path="/lab" element={<Laboratorio />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}
