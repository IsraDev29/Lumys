/* ===========================================================================
 * Lumys* — piezas compartidas
 * ---------------------------------------------------------------------------
 * Cargador, estado vacío, barras que crecen al entrar y números que suben.
 * En la versión anterior esto vivía repartido: el cargador era una plantilla
 * de cadena dentro del enrutador, las barras eran `LM.animarBarras()` leyendo
 * `data-ancho` del DOM ya pintado, y el contador era `LM.contar(nodo, valor)`.
 * Todas dependían de que alguien las llamara en el momento justo después de
 * inyectar el HTML. Como componentes, ese momento es su propio montaje.
 * =========================================================================== */

import { useEffect, useRef, useState, type ReactNode } from 'react';

import { Lumy } from '../lumy/Lumy.tsx';
import { reduceMotion } from '../lib/formato.ts';

/* --- Cargador ------------------------------------------------------------ */

export function Cargador({ texto = 'Un segundo…' }: { texto?: string }) {
  return (
    <div className="lm-loader">
      <Lumy emocion="serenidad" etiqueta={null} />
      <p>{texto}</p>
    </div>
  );
}

/* --- Estado vacío / error ------------------------------------------------ */

export function Vacio({
  titulo, detalle, emocion = 'confusion', children,
}: {
  titulo: string;
  detalle?: string;
  emocion?: 'confusion' | 'serenidad' | 'empatia' | 'esperanza';
  children?: ReactNode;
}) {
  return (
    <div className="lm-empty">
      <Lumy emocion={emocion} etiqueta={null} />
      <h2>{titulo}</h2>
      {detalle && <p className="lm-muted">{detalle}</p>}
      {children}
    </div>
  );
}

/* --- Barra que crece al entrar ------------------------------------------- */

/**
 * El ancho se aplica en un efecto, no en el primer render. Poner el valor
 * final de entrada haría que el navegador pintara la barra ya completa y la
 * transición de CSS no tendría de dónde partir.
 */
export function Barra({
  valor, max = 100, className = 'lm-bar__fill', titulo, vertical = false,
}: {
  valor: number;
  max?: number;
  className?: string;
  titulo?: string;
  vertical?: boolean;
}) {
  const nodo = useRef<HTMLDivElement>(null);
  const porcentaje = `${Math.round((valor / max) * 100)}%`;

  useEffect(() => {
    const el = nodo.current;
    if (!el) return;
    if (reduceMotion()) {
      if (vertical) el.style.height = porcentaje; else el.style.width = porcentaje;
      return;
    }
    const marco = requestAnimationFrame(() => {
      if (vertical) el.style.height = porcentaje; else el.style.width = porcentaje;
    });
    return () => cancelAnimationFrame(marco);
  }, [porcentaje, vertical]);

  return (
    <div
      ref={nodo}
      className={className}
      title={titulo}
      style={vertical ? { height: 0 } : { width: 0 }}
      role="progressbar"
      aria-valuenow={valor}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={titulo}
    />
  );
}

/* --- Número que sube ------------------------------------------------------ */

export function Contador({
  valor, sufijo = '', duracion = 900,
}: { valor: number; sufijo?: string; duracion?: number }) {
  const [visible, setVisible] = useState(() => (reduceMotion() ? valor : 0));

  useEffect(() => {
    if (reduceMotion()) { setVisible(valor); return; }

    const inicio = performance.now();
    let marco = 0;
    const paso = (t: number) => {
      const p = Math.min((t - inicio) / duracion, 1);
      const suavizado = 1 - Math.pow(1 - p, 3);
      setVisible(Math.round(valor * suavizado));
      if (p < 1) marco = requestAnimationFrame(paso);
    };
    marco = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(marco);
  }, [valor, duracion]);

  return <>{visible}{sufijo}</>;
}
