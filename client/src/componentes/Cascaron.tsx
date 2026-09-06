/* ===========================================================================
 * Lumys* — cáscara de la aplicación
 * ---------------------------------------------------------------------------
 * Contenedor de vista y dock inferior. Nada más.
 *
 * Antes había una barra lateral con la navegación agrupada y una cabecera con
 * el título, el timbre de avisos y el desplegable de cuenta. Las dos se han ido:
 * la navegación de Lumys vive abajo y en un solo sitio, en escritorio igual que
 * en teléfono. Cada vista trae su propia cabecera —el saludo del estudiante, el
 * encabezado de casos del orientador—, así que el título de la barra superior
 * era una segunda cabecera compitiendo con la de la pantalla.
 *
 * ── Qué vivía en las barras y a dónde se fue ───────────────────────────────
 *   · Navegación agrupada  → el dock (BarraInferior) muestra todos los destinos
 *                            del rol, sin niveles escondidos.
 *   · Timbre de avisos     → última píldora del dock.
 *   · Cerrar sesión,
 *     cambio de perfil y
 *     teléfonos de auxilio → la vista `perfil`, que ya se llamaba "Tu cuenta".
 *
 * Sigue siendo una ruta de diseño (`layout route`): las vistas privadas se
 * dibujan en su <Outlet/>, así que el dock no se desmonta al navegar.
 * =========================================================================== */

import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import { useSesion } from '../lib/sesion.tsx';
import { ICONO_RUTA, NAV, RUTAS } from './navegacion.ts';
import { PanelAvisos } from './PanelAvisos.tsx';
import { BarraInferior } from './BarraInferior.tsx';

export function Cascaron() {
  const { usuario } = useSesion();
  const { pathname } = useLocation();

  const [avisosAbierto, setAvisosAbierto] = useState(false);

  const ruta = pathname.replace(/^\//, '').split('/')[0] ?? '';
  const def = RUTAS[ruta];

  useEffect(() => {
    document.title = def ? `${def.titulo} · Lumys*` : 'Lumys*';
  }, [def]);

  // Cada vista empieza desde arriba, como en cualquier navegación de verdad.
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'auto' }); }, [pathname]);

  if (!usuario) return null;   // <Protegida> ya redirigió; esto es por el tipo.

  /* El dock lleva todos los destinos del rol, no un subconjunto: al no haber
     barra lateral, lo que no esté acá no se puede alcanzar. `NAV_MOVIL` se
     quedó sin uso por eso mismo. */
  const items = (NAV[usuario.perfil] ?? NAV.estudiante)
    .flatMap((g) => g.items)
    .map((i) => ICONO_RUTA[i.ruta] ?? i);

  return (
    <>
      {/* `pb-32` reserva el alto del dock flotante: sin ese hueco, la última
          tarjeta de cada vista queda debajo de la píldora y no se puede tocar. */}
      <div className="stitch bg-background font-body-md text-on-surface antialiased min-h-screen flex flex-col">
        <main className="flex-1 w-full pb-32" id="lm-view" tabIndex={-1}>
          {/* La `key` es lo que hace que la vista entre animada: sin ella el
              contenedor no se desmonta al navegar, la animación de entrada no
              se vuelve a disparar y el cambio de vista se ve como un corte. */}
          <div className="lm-view__inner" key={pathname}>
            <Outlet />
          </div>
        </main>

        <BarraInferior
          items={items}
          pendiente={usuario.perfil === 'estudiante' ? 'checkin' : undefined}
          avisos={{ sinLeer: 0, onAbrir: () => setAvisosAbierto(true) }}
        />
      </div>

      <PanelAvisos abierto={avisosAbierto} onCerrar={() => setAvisosAbierto(false)} />
    </>
  );
}
