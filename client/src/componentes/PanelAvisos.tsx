/* ===========================================================================
 * Lumys* — panel lateral de avisos
 * ---------------------------------------------------------------------------
 * El `offcanvas` de Bootstrap, sin su JavaScript. Las clases son las mismas,
 * así que la animación de entrada y el fondo oscurecido los sigue pintando la
 * hoja de Bootstrap.
 *
 * El primer aviso lo da Lumy en persona, y lo da tranquila: es la vista donde
 * un estudiante entra esperando malas noticias.
 * =========================================================================== */

import { useEffect } from 'react';

import { Lumy } from '../lumy/Lumy.tsx';

type Aviso = { icono: string; calido?: boolean; titulo: string; cuando: string };

const AVISOS: Aviso[] = [
  { icono: 'bi-stars', calido: true, titulo: 'Llegaste a 12 días seguidos', cuando: 'Hoy · insignia desbloqueada' },
  { icono: 'bi-collection-play', titulo: 'Cápsula nueva de la semana', cuando: 'Ayer · 45 segundos' },
  { icono: 'bi-diagram-3', titulo: 'Tu red de confianza está incompleta', cuando: 'Hace 3 días · te falta 1 persona' },
];

export function PanelAvisos({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  useEffect(() => {
    if (!abierto) return;
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [abierto, onCerrar]);

  return (
    <>
      {abierto && <div className="offcanvas-backdrop fade show" onClick={onCerrar} />}

      <div
        className={`offcanvas offcanvas-end lm-drawer${abierto ? ' show' : ''}`}
        style={{ visibility: abierto ? 'visible' : 'hidden' }}
        tabIndex={-1}
        role="dialog"
        aria-modal={abierto || undefined}
        aria-hidden={!abierto}
        aria-labelledby="lm-avisos-titulo"
      >
        <div className="offcanvas-header">
          <h2 className="offcanvas-title h5 mb-0" id="lm-avisos-titulo">Avisos</h2>
          <button type="button" className="btn-close" aria-label="Cerrar" onClick={onCerrar} />
        </div>

        <div className="offcanvas-body">
          <div className="lm-lumy-bubble mb-4">
            <Lumy emocion="serenidad" ancho={56} etiqueta={null} />
            <p>Nada urgente por acá. Lo importante siempre te lo decimos de frente.</p>
          </div>

          <ul className="lm-list">
            {AVISOS.map((a) => (
              <li className="lm-list__item" key={a.titulo}>
                <span className={`lm-avatar${a.calido ? ' lm-avatar--warm' : ''}`}>
                  <i className={`bi ${a.icono}`} />
                </span>
                <span>
                  <span className="d-block fw-semibold" style={{ fontSize: '.94rem' }}>{a.titulo}</span>
                  <span className="lm-caption">{a.cuando}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
