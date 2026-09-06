/* ===========================================================================
 * Lumys* — gráficos
 * ---------------------------------------------------------------------------
 * Tres SVG dibujados a mano y sin librería: la línea de la huella emocional, el
 * radar del gemelo comunitario y el calendario de constancia.
 *
 * Se quedan sin librería a propósito. Son tres formas concretas, con reglas
 * propias —la banda del promedio propio, el eje que se oculta con menos de diez
 * registros—, y cualquier librería de gráficos pesa más que los tres juntos y
 * pelea con el sistema de diseño. Antes eran plantillas de cadena que se
 * inyectaban con innerHTML; ahora son JSX, que es lo mismo pero comprobado.
 *
 * TODO lo de acá es ipsativo: la referencia es el propio estudiante o el propio
 * centro, nunca un corte poblacional.
 * =========================================================================== */

import { diaCorto, fechaCorta } from '../lib/formato.ts';
import type { DiaConstancia, Ipsativa, PuntoLinea } from '../lib/tipos.ts';

/* --- Línea de la huella emocional ---------------------------------------- */

export function GraficoLinea({ datos, promedio }: { datos: PuntoLinea[]; promedio: number }) {
  const W = 720, H = 240;
  const M = { top: 18, right: 16, bottom: 30, left: 16 };
  const ancho = W - M.left - M.right;
  const alto = H - M.top - M.bottom;

  const max = Math.max(...datos.map((d) => d.valor), promedio) * 1.15;
  const x = (i: number) =>
    M.left + (datos.length === 1 ? ancho / 2 : (i * ancho) / (datos.length - 1));
  const y = (v: number) => M.top + alto - (v / max) * alto;

  const puntos = datos.map((d, i) => `${x(i)},${y(d.valor)}`).join(' ');
  const area = `M ${x(0)},${M.top + alto} L ${puntos.split(' ').join(' L ')} `
             + `L ${x(datos.length - 1)},${M.top + alto} Z`;

  const cadaCuantas = Math.ceil(datos.length / 8);

  return (
    <svg
      className="lm-linechart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Evolución de los últimos ${datos.length} días comparada con tu propio promedio`}
    >
      {[0.25, 0.5, 0.75, 1].map((p) => (
        <line key={p} className="grid"
              x1={M.left} y1={M.top + alto * p} x2={W - M.right} y2={M.top + alto * p} />
      ))}

      <path className="area" d={area} />
      <polyline className="line" points={puntos} />

      <line className="avg" x1={M.left} y1={y(promedio)} x2={W - M.right} y2={y(promedio)} />
      <text className="label" x={W - M.right} y={y(promedio) - 8} textAnchor="end"
            style={{ fill: 'var(--lm-terracotta)', fontWeight: 600 }}>
        tu promedio
      </text>

      {datos.map((d, i) => (
        <circle
          key={d.fecha}
          className={`dot${i === datos.length - 1 ? ' dot--hoy' : ''}`}
          cx={x(i)} cy={y(d.valor)} r={datos.length > 12 ? 3.5 : 5.5}
        >
          <title>{fechaCorta(d.fecha)}</title>
        </circle>
      ))}

      {datos.map((d, i) =>
        (datos.length <= 10 || i % cadaCuantas === 0) ? (
          <text key={`e-${d.fecha}`} className="label" x={x(i)} y={H - 8} textAnchor="middle">
            {diaCorto(d.fecha)}
          </text>
        ) : null)}
    </svg>
  );
}

/* --- Radar del gemelo comunitario ----------------------------------------- */

export function GraficoRadar({
  ejes, promedio, actual,
}: { ejes: string[]; promedio: number[]; actual: number[] }) {
  const size = 380;
  const c = size / 2;
  const r = c - 54;
  const n = ejes.length;

  const punto = (valor: number, i: number): [number, number] => {
    const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
    const d = (valor / 100) * r;
    return [c + Math.cos(ang) * d, c + Math.sin(ang) * d];
  };

  const poligono = (datos: number[]) =>
    datos.map((v, i) => punto(v, i).join(',')).join(' ');

  return (
    <svg
      className="lm-radar"
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="Radar del centro comparado con su propio promedio"
    >
      {[0.25, 0.5, 0.75, 1].map((p) => (
        <circle key={p} className="ring" cx={c} cy={c} r={r * p} />
      ))}

      {ejes.map((eje, i) => {
        const [x, y] = punto(100, i);
        return <line key={eje} className="spoke" x1={c} y1={c} x2={x} y2={y} />;
      })}

      <polygon className="shape-avg" points={poligono(promedio)} />
      <polygon className="shape-now" points={poligono(actual)} />

      {ejes.map((eje, i) => {
        const [x, y] = punto(122, i);
        const anclaje = Math.abs(x - c) < 12 ? 'middle' : (x > c ? 'start' : 'end');
        return (
          <text key={`t-${eje}`} className="axis-label" x={x} y={y + 4} textAnchor={anclaje}>
            {eje}
          </text>
        );
      })}
    </svg>
  );
}

/* --- Calendario de constancia ---------------------------------------------
 * Mide APARECER, nunca el ánimo. Un día en verde oscuro no significa "estuvo
 * bien": significa "estuvo". Es la diferencia que hace que la racha no premie
 * fingirse contento.
 * ------------------------------------------------------------------------- */

export function Constancia({ dias }: { dias: DiaConstancia[] }) {
  return (
    <div className="lm-heatmap">
      {dias.map((d, i) => (
        <div
          key={d.fecha}
          className={`lm-heatmap__cell${i === dias.length - 1 ? ' is-hoy' : ''}`}
          data-nivel={String(d.nivel)}
          title={`${fechaCorta(d.fecha)} · ${d.nivel ? 'registraste' : 'sin registro'}`}
        >
          {new Date(d.fecha).getDate()}
        </div>
      ))}
    </div>
  );
}

/* --- Comparativa ipsativa --------------------------------------------------- */

export function ListaIpsativa({ items }: { items: Ipsativa[] }) {
  return (
    <div className="lm-ipsativa">
      {items.map((item) => (
        <div className="lm-ipsativa__item" key={item.etiqueta}>
          <i className={`bi ${item.icono} lm-ipsativa__icon`} />
          <p className="lm-ipsativa__value mb-0 mt-2">{item.valor}</p>
          <p className="lm-caption mb-1">{item.etiqueta}</p>
          <p className="lm-ipsativa__delta mb-0">{item.delta}</p>
        </div>
      ))}
    </div>
  );
}
