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

/* --------------------------------------------------------------------------
   Geometría del isotipo

   Se comparte con public/img/lumys-isotipo.svg, que es la copia que consumen el
   favicon y los iconos del PWA porque no pueden ser React. Si acá cambia el
   `d`, allá también: son el mismo dibujo en dos formatos, no dos dibujos.

   La silueta es una blob armónica: r(θ) = 296 · (1 + 0.055·cos(5θ − 0.55) +
   0.022·cos(2θ + 1.10)), muestreada en 64 puntos y cerrada con Catmull-Rom. El
   quinto armónico da los cinco lóbulos; el segundo mete una asimetría corta
   para que no parezca una flor regular.

   Se llegó acá después de descartar dos caminos. La geometría original —ocho
   nodos con valles al 80 % del radio— daba un diamante con puntas en las
   diagonales, no una nube. Construirla como unión de círculos daba lóbulos de
   nube de verdad, pero el valle entre dos círculos es una intersección: por
   poco que se separen aparece una muesca en punta, y ajustar seis centros a
   mano es perseguir el propio ruido. Una suma de cosenos no tiene esquinas por
   construcción, así que el contorno sale liso a cualquier tamaño.

   El trazo recorre la paleta en el mismo orden que el degradado de la marca:
   lavanda arriba a la izquierda, celeste bajando por el flanco, sol al llegar a
   la derecha.
   -------------------------------------------------------------------------- */

const SILUETA = 'M0.0,-284.5 C9.3,-287.1 18.9,-289.9 28.7,-291.9 C38.6,-293.9 48.8,-295.7 59.0,-296.5 C69.2,-297.3 79.7,-297.5 89.9,-296.4 C100.1,-295.4 110.5,-293.3 120.2,-290.2 C129.9,-287.0 139.5,-282.7 148.3,-277.4 C157.1,-272.2 165.4,-265.7 172.9,-258.8 C180.5,-251.9 187.3,-244.0 193.6,-235.9 C199.9,-227.9 205.4,-219.2 210.7,-210.7 C216.0,-202.2 220.6,-193.4 225.3,-184.9 C230.0,-176.4 234.3,-167.9 238.8,-159.6 C243.4,-151.3 247.8,-143.1 252.5,-135.0 C257.2,-126.8 262.1,-118.8 267.0,-110.6 C271.9,-102.4 277.1,-94.1 281.9,-85.5 C286.7,-76.9 291.6,-68.1 295.8,-58.8 C299.9,-49.6 303.9,-40.0 306.8,-30.2 C309.6,-20.4 311.9,-10.2 312.8,0.0 C313.8,10.2 313.8,20.7 312.5,30.8 C311.3,40.9 308.7,51.1 305.3,60.7 C301.9,70.4 297.1,79.8 291.9,88.6 C286.7,97.3 280.4,105.7 274.0,113.5 C267.6,121.3 260.4,128.5 253.5,135.5 C246.7,142.5 239.5,149.0 232.7,155.5 C225.8,162.0 219.1,168.1 212.7,174.5 C206.2,181.0 200.1,187.3 194.0,194.0 C187.9,200.7 182.1,207.6 176.1,214.6 C170.0,221.6 164.1,228.9 157.7,236.0 C151.3,243.2 144.7,250.6 137.5,257.3 C130.3,264.1 122.7,270.8 114.6,276.6 C106.4,282.3 97.6,287.7 88.5,291.8 C79.4,296.0 69.7,299.3 60.0,301.4 C50.2,303.5 40.0,304.5 30.0,304.5 C20.0,304.6 9.8,303.4 0.0,301.6 C-9.8,299.8 -19.5,296.8 -28.9,293.8 C-38.3,290.7 -47.4,286.8 -56.3,283.1 C-65.2,279.4 -73.8,275.3 -82.4,271.6 C-91.0,267.8 -99.3,264.0 -107.9,260.5 C-116.5,256.9 -125.0,253.6 -133.8,250.3 C-142.6,247.0 -151.6,243.9 -160.7,240.4 C-169.8,237.0 -179.2,233.6 -188.4,229.6 C-197.7,225.5 -207.2,221.3 -216.1,216.1 C-225.0,210.9 -234.0,205.2 -242.0,198.6 C-250.0,192.0 -257.7,184.6 -264.2,176.5 C-270.7,168.5 -276.4,159.5 -281.0,150.2 C-285.5,140.9 -288.9,130.8 -291.4,120.7 C-293.8,110.6 -295.0,100.0 -295.5,89.6 C-296.0,79.3 -295.4,68.8 -294.5,58.6 C-293.7,48.4 -292.0,38.4 -290.4,28.6 C-288.8,18.8 -286.8,9.4 -285.1,0.0 C-283.4,-9.4 -281.6,-18.4 -280.2,-27.6 C-278.7,-36.8 -277.5,-45.8 -276.3,-55.0 C-275.1,-64.2 -274.3,-73.4 -273.1,-82.8 C-271.9,-92.3 -270.9,-101.9 -269.3,-111.5 C-267.6,-121.1 -265.7,-131.0 -262.9,-140.5 C-260.2,-150.1 -256.9,-159.7 -252.5,-168.7 C-248.2,-177.7 -243.1,-186.6 -237.0,-194.5 C-231.0,-202.5 -224.0,-209.9 -216.4,-216.4 C-208.8,-222.9 -200.3,-228.5 -191.5,-233.4 C-182.8,-238.2 -173.3,-242.1 -164.0,-245.4 C-154.6,-248.7 -144.9,-251.1 -135.4,-253.4 C-126.0,-255.6 -116.5,-257.2 -107.2,-258.9 C-98.0,-260.6 -89.0,-262.0 -80.0,-263.8 C-71.1,-265.6 -62.4,-267.4 -53.6,-269.5 C-44.8,-271.6 -36.2,-274.1 -27.2,-276.6 C-18.3,-279.1 -9.3,-282.0 0.0,-284.5 Z';

/** Marrón de los rasgos. No es negro puro a propósito: sobre un relleno claro,
 *  el negro endurece la cara y la saca del registro amable del resto. */
const TINTA = '#6B4A32';

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
        <linearGradient id={id} x1="8%" y1="8%" x2="94%" y2="82%">
          <stop offset="0%" stopColor="#BFA6F7" />
          <stop offset="26%" stopColor="#A6C8F0" />
          <stop offset="52%" stopColor="#AEE0F6" />
          <stop offset="78%" stopColor="#FFD77A" />
          <stop offset="100%" stopColor="#FFB877" />
        </linearGradient>
      </defs>

      {conFondo && <rect width="1024" height="1024" rx="210" fill="var(--lm-cream-soft)" />}

      <g transform="translate(512 496)" strokeLinecap="round" strokeLinejoin="round">
        {/* El relleno va antes que el trazo para que el borde quede por encima
            y el degradado no se coma medio grosor contra el fondo. */}
        <path d={SILUETA} fill="#FFFDFB" />
        <path d={SILUETA} fill="none" stroke={`url(#${id})`} strokeWidth="34" />

        {/* Rubor. Debajo de los ojos y hacia afuera: puesto al centro parece
            nariz, no mejilla. */}
        <ellipse cx="-166" cy="26" rx="52" ry="30" fill="#F6A9BC" opacity="0.7" />
        <ellipse cx="166" cy="26" rx="52" ry="30" fill="#F6A9BC" opacity="0.7" />

        {/* Ojos cerrados de contento: dos arcos que suben en el medio. Si la
            curvatura se invierte, la cara pasa de feliz a preocupada sin que
            cambie nada más. */}
        <g fill="none" stroke={TINTA} strokeWidth="26">
          <path d="M-158,-44 C-134,-96 -78,-96 -54,-44" />
          <path d="M54,-44 C78,-96 134,-96 158,-44" />
        </g>

        {/* La boca abierta: tapa recta arriba y medio óvalo hacia abajo. */}
        <path d="M-86,44 L86,44 A86,72 0 0 1 -86,44 Z" fill={TINTA} />
        {/* La lengua descansa dentro, sin tocar el borde de la boca. */}
        <ellipse cx="0" cy="92" rx="48" ry="22" fill="#F0788C" />
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

