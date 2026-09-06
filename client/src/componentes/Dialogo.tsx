/* ===========================================================================
 * Lumys* — Diálogo
 * ---------------------------------------------------------------------------
 * La versión anterior repetía la maqueta de `.modal` de Bootstrap a mano en
 * cada vista que necesitaba uno, con el `backdrop`, el `aria-modal` y el cierre
 * con Escape copiados cada vez. Acá está una sola vez, con las tres cosas que
 * un diálogo tiene que hacer bien y que son fáciles de olvidar:
 *
 *   1. Cerrarse con Escape.
 *   2. Devolver el foco a donde estaba al cerrarse. Si no, quien navega con
 *      teclado vuelve al principio de la página cada vez.
 *   3. Bloquear el scroll de detrás. En iOS, sin esto, el fondo se desplaza
 *      bajo el diálogo y se pierde el sitio.
 *
 * El foco no se atrapa dentro del diálogo: para eso está `<dialog>` nativo, y
 * migrar a él es la mejora pendiente. Lo que sí se hace es llevar el foco al
 * panel al abrir, que es lo que evita que el lector de pantalla siga leyendo la
 * página de detrás.
 * =========================================================================== */

import { useEffect, useId, useRef, type ReactNode } from 'react';

import { useEntrada } from '../lib/movimiento.ts';

type Props = {
  abierto: boolean;
  titulo: string;
  /** Texto bajo el título. Se enlaza con `aria-describedby`. */
  descripcion?: ReactNode;
  children?: ReactNode;
  /** Botones del pie. Se dibujan en el orden recibido. */
  acciones?: ReactNode;
  /** Refuerza visualmente que la acción tiene consecuencias. */
  tono?: 'normal' | 'atencion';
  onCerrar: () => void;
};

export function Dialogo({
  abierto, titulo, descripcion, children, acciones, tono = 'normal', onCerrar,
}: Props) {
  const idTitulo = useId();
  const idDesc = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const focoPrevio = useRef<HTMLElement | null>(null);
  const entrado = useEntrada(abierto);

  useEffect(() => {
    if (!abierto) return;

    focoPrevio.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const alPulsar = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    document.addEventListener('keydown', alPulsar);

    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', alPulsar);
      document.body.style.overflow = overflowPrevio;
      focoPrevio.current?.focus?.();
    };
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  return (
    <div className="lm-dialogo" role="presentation">
      <div
        className={`lm-dialogo__fondo${entrado ? ' is-dentro' : ''}`}
        onClick={onCerrar}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        className={`lm-dialogo__panel${entrado ? ' is-dentro' : ''}${tono === 'atencion' ? ' is-atencion' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={descripcion ? idDesc : undefined}
        tabIndex={-1}
      >
        <div className="lm-dialogo__head">
          <h2 id={idTitulo}>{titulo}</h2>
          <button
            type="button"
            className="lm-icon-btn lm-icon-btn--sm"
            aria-label="Cerrar"
            onClick={onCerrar}
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>

        {descripcion ? <p className="lm-dialogo__desc" id={idDesc}>{descripcion}</p> : null}

        {children ? <div className="lm-dialogo__cuerpo">{children}</div> : null}

        {acciones ? <div className="lm-dialogo__pie">{acciones}</div> : null}
      </div>
    </div>
  );
}
