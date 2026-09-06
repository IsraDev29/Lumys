/* ===========================================================================
 * Lumys* — línea base de los últimos siete días
 * ---------------------------------------------------------------------------
 * Siete barras y una línea punteada: el promedio del propio estudiante. Es el
 * gráfico que sostiene la idea central del producto — la medida es ipsativa,
 * cada quien se compara consigo mismo y nunca con el resto del salón.
 *
 * El alto va en píxeles y no en porcentaje porque la línea del promedio tiene
 * que caer exactamente sobre las barras, y el alto disponible depende de
 * cuánto ocupe la fila de etiquetas de los días. Por eso hace falta medir el
 * contenedor ya pintado, y por eso hay un ResizeObserver: al rotar el teléfono
 * el reparto cambia y la línea quedaría desalineada.
 * =========================================================================== */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { diaCorto, fechaCorta, haceCuanto, reduceMotion } from '../lib/formato.ts';
import type { PuntoLinea } from '../lib/tipos.ts';

export function LineaBase({ datos, promedio }: { datos: PuntoLinea[]; promedio: number }) {
  const caja = useRef<HTMLDivElement>(null);
  const [medidas, setMedidas] = useState<{ reserva: number; util: number } | null>(null);

  const max = Math.max(...datos.map((d) => d.valor), promedio) * 1.12;

  useLayoutEffect(() => {
    const medir = () => {
      const cont = caja.current;
      if (!cont) return;
      const etiqueta = cont.querySelector<HTMLElement>('.lm-baseline__day');
      const reserva = (etiqueta?.offsetHeight || 16) + 8;
      const util = Math.max(cont.clientHeight - reserva - 12, 40);
      setMedidas((previo) =>
        previo?.reserva === reserva && previo.util === util ? previo : { reserva, util });
    };

    medir();

    if (!window.ResizeObserver) return;
    let pendiente = 0;
    const ro = new ResizeObserver(() => {
      clearTimeout(pendiente);
      pendiente = window.setTimeout(medir, 200);
    });
    if (caja.current) ro.observe(caja.current);
    return () => { clearTimeout(pendiente); ro.disconnect(); };
  }, [datos, promedio]);

  return (
    <div className="lm-baseline" ref={caja}>
      {datos.map((d, i) => {
        const esHoy = i === datos.length - 1;
        // El ICVE va de 0 a 100 y más alto es MÁS carga, así que el día que
        // merece atención es el que se despega hacia arriba. Esta comparación
        // estaba al revés (`< promedio * 0.7`): pintaba de color de lluvia los
        // días más livianos del estudiante, es decir, marcaba como preocupantes
        // exactamente sus mejores días.
        const pesado = d.valor > promedio * 1.3;
        const alto = medidas ? Math.max((d.valor / max) * medidas.util, 8) : 0;
        return (
          <div className="lm-baseline__col" key={d.fecha}>
            <BarraDia
              alto={alto}
              className={`lm-baseline__bar${esHoy ? ' lm-baseline__bar--hoy' : ''}${pesado && !esHoy ? ' lm-baseline__bar--bajo' : ''}`}
              titulo={`${fechaCorta(d.fecha)} · ${esHoy ? 'hoy' : haceCuanto(d.fecha)}`}
              etiqueta={`${fechaCorta(d.fecha)}: ${d.valor > promedio ? 'más pesado' : 'más liviano'} que tu propio promedio`}
            />
            <span className="lm-baseline__day">{diaCorto(d.fecha)}</span>
          </div>
        );
      })}

      {medidas && (
        <div
          className="lm-baseline__avg"
          style={{ bottom: `${medidas.reserva + (promedio / max) * medidas.util}px` }}
        >
          <span>tu promedio</span>
        </div>
      )}
    </div>
  );
}

/** El alto se aplica tras el primer pintado para que la transición de CSS
 *  tenga de dónde salir; con movimiento reducido se pone directo. */
function BarraDia({
  alto, className, titulo, etiqueta,
}: { alto: number; className: string; titulo: string; etiqueta: string }) {
  const nodo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = nodo.current;
    if (!el || !alto) return;
    if (reduceMotion()) { el.style.height = `${alto}px`; return; }
    const marco = requestAnimationFrame(() => { el.style.height = `${alto}px`; });
    return () => cancelAnimationFrame(marco);
  }, [alto]);

  return (
    <div
      ref={nodo}
      className={className}
      title={titulo}
      tabIndex={0}
      role="img"
      aria-label={etiqueta}
      style={{ height: 0 }}
    />
  );
}
