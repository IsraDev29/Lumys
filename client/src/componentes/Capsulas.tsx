/* ===========================================================================
 * Lumys* — rejilla de cápsulas
 * ---------------------------------------------------------------------------
 * Se usa en el inicio (las cuatro de la semana) y en la vista completa. Era
 * `Estudiante.pintarCapsulas`, que recibía un contenedor y le volcaba HTML.
 * =========================================================================== */

import { useAvisos } from '../lib/avisos.tsx';
import type { Capsula } from '../lib/tipos.ts';

export function RejillaCapsulas({ capsulas }: { capsulas: Capsula[] }) {
  const avisar = useAvisos();

  // Deliberadamente NO suma a `progreso.capsulas`. El video todavía no existe,
  // así que esto abre un aviso, no una cápsula: contarlo daría la insignia por
  // tocar una tarjeta vacía. El contador ya está listo en lib/progreso.ts para
  // el día que haya algo que ver.
  const abrir = () =>
    avisar('Las cápsulas en video llegan en la Fase 3 del roadmap.', { tipo: 'info' });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
      {capsulas.map((c, i) => (
        // Es un <button> de verdad y no un div con role: así llega el foco, el
        // teclado y el lector de pantalla sin tener que reimplementar nada.
        <button
          key={`${c.titulo}-${i}`}
          type="button"
          onClick={abrir}
          className={`group text-left p-space-md rounded-2xl min-h-[168px] flex flex-col justify-between transition-all hover:-translate-y-1 hover:shadow-[0_12px_28px_-6px_rgba(28,45,90,0.14)] ${
            c.tono === 'calido'
              ? 'bg-tertiary-fixed/60 text-on-tertiary-fixed'
              : 'bg-primary-fixed/50 text-on-primary-fixed'
          }`}
        >
          <span className="inline-flex self-start items-center px-space-xs py-0.5 rounded-full bg-surface-container-lowest/70 font-label-sm text-label-sm">
            {c.tag}
          </span>

          <span className="font-headline-sm text-headline-sm leading-snug my-space-sm">
            {c.titulo}
          </span>

          <span className="flex items-center gap-space-2xs font-label-sm text-label-sm opacity-80">
            <span className="material-symbols-outlined text-[16px] group-hover:translate-x-0.5 transition-transform" aria-hidden="true">
              play_circle
            </span>
            {c.duracion} · sin sermón
          </span>
        </button>
      ))}
    </div>
  );
}
