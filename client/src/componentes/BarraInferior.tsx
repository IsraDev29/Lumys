/* ===========================================================================
 * Lumys* — dock de navegación
 * ---------------------------------------------------------------------------
 * Es la ÚNICA navegación de la aplicación: no hay barra lateral ni cabecera.
 * En un teléfono sostenido con una mano, la parte de abajo de la pantalla es la
 * única zona que el pulgar alcanza sin recolocar el agarre; un menú arriba
 * obliga a un gesto que, en el momento en que alguien entra a pedir ayuda, es
 * un obstáculo de más. En escritorio se queda igual —flotando abajo y centrado—
 * en vez de mudarse al lateral, para que la app se use igual en los dos sitios.
 *
 * La forma es la del dock de las pantallas de Stitch: píldora flotante con
 * fondo translúcido y desenfoque, y la pestaña activa rellena en lavanda. La
 * versión anterior marcaba el activo con un indicador absoluto que había que
 * medir en el DOM; con el relleno de Stitch eso deja de hacer falta y se van
 * con él tres `useLayoutEffect` (medición, ResizeObserver y espera de fuentes).
 *
 * ── Sobre el desbordamiento ────────────────────────────────────────────────
 * El estudiante tiene ocho destinos y a 375 px no caben ocho píldoras. Las
 * etiquetas se ocultan por debajo de `md` —como en el mockup— y el dock se
 * desplaza en horizontal si aun así no entran. Se prefiere eso a un menú "más":
 * todo lo que se puede visitar está siempre a la vista, sin un nivel escondido.
 * =========================================================================== */

import { NavLink, useLocation } from 'react-router-dom';

import type { ItemNav } from './navegacion.ts';

type Props = {
  items: ItemNav[];
  /** Ruta que pide atención (check-in sin hacer hoy). Recibe un punto que late. */
  pendiente?: string;
  /** Acción de avisos. Va en el dock porque, sin cabecera, no tiene otro sitio
   *  desde el que alcanzarse con el pulgar. */
  avisos?: { sinLeer: number; onAbrir: () => void };
};

export function BarraInferior({ items, pendiente, avisos }: Props) {
  const { pathname } = useLocation();
  const rutaActiva = pathname.replace(/^\//, '').split('/')[0] ?? '';

  return (
    <aside className="stitch fixed bottom-5 left-0 right-0 z-50 pointer-events-none flex justify-center px-margin-mobile">
      <nav
        aria-label="Navegación principal"
        className="pointer-events-auto flex items-center gap-space-2xs p-space-2xs bg-surface-container-lowest/90 backdrop-blur-2xl rounded-full shadow-[0_12px_36px_-6px_rgba(28,45,90,0.12),0_4px_16px_rgba(174,224,246,0.25)] max-w-full overflow-x-auto sin-scrollbar"
      >
        {items.map((item) => {
          const activo = rutaActiva === item.ruta;
          return (
            <NavLink
              key={item.ruta}
              to={`/${item.ruta}`}
              /* La etiqueta visible se oculta por debajo de `md`; el nombre
                 accesible se queda con el completo, que es el que da contexto a
                 quien navega por voz o con lector de pantalla. */
              aria-label={item.texto}
              className={`relative shrink-0 flex items-center gap-space-xs px-space-md py-space-xs rounded-full transition-all font-label-md text-label-md ${
                activo
                  ? 'bg-primary-container text-on-primary-container font-semibold shadow-[0_4px_16px_rgba(189,164,243,0.3)]'
                  : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                {item.simbolo}
              </span>
              <span className="hidden md:inline">{item.corto ?? item.texto}</span>

              {pendiente === item.ruta && !activo && (
                <span
                  className="absolute top-1 right-1 h-2 w-2 rounded-full bg-tertiary-container animate-pulse"
                  aria-hidden="true"
                />
              )}
              {item.badge ? (
                <>
                  <span
                    className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-error text-on-error text-[10px] font-bold flex items-center justify-center"
                    aria-hidden="true"
                  >
                    {item.badge}
                  </span>
                  <span className="sr-only">{item.badge} sin revisar</span>
                </>
              ) : null}
            </NavLink>
          );
        })}

        {avisos && (
          <>
            <span className="w-px h-6 bg-outline-variant/30 shrink-0 mx-space-2xs" aria-hidden="true" />
            <button
              type="button"
              onClick={avisos.onAbrir}
              aria-label={avisos.sinLeer ? `Avisos, ${avisos.sinLeer} sin leer` : 'Avisos'}
              className="relative shrink-0 flex items-center gap-space-xs px-space-md py-space-xs rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all font-label-md text-label-md"
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                notifications
              </span>
              {avisos.sinLeer > 0 && (
                <span
                  className="absolute top-1 right-1 h-2 w-2 rounded-full bg-error animate-pulse"
                  aria-hidden="true"
                />
              )}
            </button>
          </>
        )}
      </nav>
    </aside>
  );
}
