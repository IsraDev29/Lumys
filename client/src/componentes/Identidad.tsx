/* ===========================================================================
 * Lumys* — Identidad de marca
 * ---------------------------------------------------------------------------
 * El isotipo y el logotipo, como componentes.
 *
 * Podrían ser dos archivos .svg en public/ y cargarse con <img>, y de hecho el
 * isotipo también existe así (public/img/lumys-isotipo.svg) porque el favicon y
 * los iconos del PWA no pueden ser React. Pero el logotipo NO puede vivir en un
 * <img>: un SVG cargado como imagen no carga fuentes web, así que "Lumys" se
 * dibujaría con la tipografía por defecto del navegador en vez de con Fredoka.
 * Las alternativas serían convertir el texto a curvas —y perder el texto
 * seleccionable, el ajuste de color y los kilobytes— o renderizarlo en línea.
 *
 * En línea, además, el degradado de la "y" y el celeste de la "s" salen de los
 * mismos tokens que el resto de la interfaz: si la marca se retoca, el logotipo
 * se retoca con ella.
 * =========================================================================== */

import { useId } from 'react';

/** `useId` devuelve algo con dos puntos (`:r1:`), que no vale como id dentro de
 *  `url(#…)` en todos los navegadores. Se limpia. */
function useIdEstable() {
  return useId().replace(/[^a-zA-Z0-9]/g, '');
}

type PropsIsotipo = {
  /** Lado en píxeles. Es cuadrado. */
  tamano?: number;
  /** Dibuja el fondo redondeado del icono de aplicación. Suelto se ve mejor
   *  sobre superficies que ya tienen color. */
  conFondo?: boolean;
  /** Respira despacio, como en el hub de la mascota. */
  animado?: boolean;
  className?: string;
};

/**
 * La forma orgánica de trazo iridiscente. Curva cerrada de ocho nodos con
 * radios alternos: lóbulos a 1.0, valles a 0.80. Ver el comentario extenso en
 * public/img/lumys-isotipo.svg, donde está la misma geometría.
 */
export function Isotipo({ tamano = 40, conFondo = false, animado = false, className = '' }: PropsIsotipo) {
  // Cada instancia necesita su propio id de degradado: dos <svg> en la misma
  // página con el mismo id hacen que el segundo herede el primero.
  const id = `lm-iris-${useIdEstable()}`;

  return (
    <svg
      className={`lm-isotipo${animado ? ' lm-isotipo--respira' : ''} ${className}`}
      width={tamano}
      height={tamano}
      viewBox="0 0 1024 1024"
      role="img"
      aria-label="Lumys"
    >
      <defs>
        <linearGradient id={id} x1="18%" y1="4%" x2="86%" y2="96%">
          <stop offset="0%" stopColor="#CDB2FF" />
          <stop offset="34%" stopColor="#F0B9D8" />
          <stop offset="62%" stopColor="#FFD77A" />
          <stop offset="100%" stopColor="#AEE0F6" />
        </linearGradient>
      </defs>

      {conFondo && <rect width="1024" height="1024" rx="210" fill="var(--lm-cream-soft)" />}

      <g transform="translate(512 496)" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path
          stroke={`url(#${id})`}
          strokeWidth="46"
          d="M0.00,-300.00 C109.26,-300.00 111.95,-240.19 176.07,-176.07 C240.19,-111.95 300.00,-109.26 300.00,0.00 C300.00,109.26 231.51,107.90 169.71,169.71 C107.90,231.51 102.70,282.00 0.00,282.00 C-102.70,282.00 -107.90,231.51 -169.71,169.71 C-231.51,107.90 -300.00,109.26 -300.00,0.00 C-300.00,-109.26 -240.19,-111.95 -176.07,-176.07 C-111.95,-240.19 -109.26,-300.00 0.00,-300.00 Z"
        />
        {/* La sonrisa. `linecap` redondo no es un detalle: con extremos planos
            el arco deja de leerse como una sonrisa y parece un ceño. */}
        <path stroke="#FFC24D" strokeWidth="44" d="M-118,60 C-72,140 72,140 118,60" />
      </g>
    </svg>
  );
}

/* -------------------------------------------------------------------------- */

type PropsLogotipo = {
  /** Altura de la palabra "Lumys" en píxeles. Todo lo demás escala con ella. */
  tamano?: number;
  /** Añade "Luz · Mente · Salud" debajo, como en el logotipo completo. */
  conBajada?: boolean;
  /** Antepone el isotipo. */
  conIsotipo?: boolean;
  /** Sobre navy: "Lum" pasa de tinta oscura a clara. */
  invertido?: boolean;
  className?: string;
};

/**
 * El logotipo: "Lum" en navy, la "y" recorriendo el degradado de marca y la "s"
 * en celeste. Es el mismo gesto del isotipo —lavanda hacia sol hacia celeste—
 * llevado a la palabra.
 */
export function Logotipo({
  tamano = 34, conBajada = false, conIsotipo = false, invertido = false, className = '',
}: PropsLogotipo) {
  return (
    <span
      className={`lm-logotipo${invertido ? ' lm-logotipo--inv' : ''} ${className}`}
      style={{ '--lm-logo-size': `${tamano}px` } as React.CSSProperties}
    >
      {conIsotipo && <Isotipo tamano={tamano * 1.15} className="lm-logotipo__iso" />}

      <span className="lm-logotipo__texto">
        {/* aria-label en el contenedor y las partes ocultas: si no, el lector de
            pantalla deletrea "Lum", "y", "s" como tres palabras sueltas. */}
        <span className="lm-logotipo__palabra" role="img" aria-label="Lumys">
          <span className="lm-logotipo__lum" aria-hidden="true">Lum</span>
          <span className="lm-logotipo__y" aria-hidden="true">y</span>
          <span className="lm-logotipo__s" aria-hidden="true">s</span>
        </span>

        {conBajada && (
          <span className="lm-logotipo__bajada" aria-hidden="true">
            <em className="lm-bj-celeste">Luz</em>
            <em className="lm-bj-lavanda">Mente</em>
            <em className="lm-bj-sol">Y</em>
            <em className="lm-bj-celeste">Salud</em>
          </span>
        )}
      </span>
    </span>
  );
}

