/* ===========================================================================
 * Lumy — núcleo geométrico
 * ---------------------------------------------------------------------------
 * Toda la aritmética que convierte una pose en trazos y matrices. Sin DOM,
 * sin React, sin navegador: solo entra un objeto de pose y salen cadenas.
 *
 * Existe para que haya UNA sola implementación. La consumen tres cosas:
 *
 *   - src/lumy/Lumy.tsx        → la aplica sobre nodos SVG, 60 veces por segundo
 *   - tools/lumy-exportar-svg  → la interpola en una plantilla, una vez
 *   - test/lumy.test.js        → la compara contra el archivo original
 *
 * Si estuviera duplicada, el día que alguien corrigiera el párpado en el rig
 * los SVG que se importan a Rive quedarían distintos de lo que ve el
 * estudiante, y nadie se enteraría hasta mucho después. Con el núcleo
 * compartido, el archivo exportado y el cuadro que dibuja el navegador salen
 * de la misma cuenta.
 * =========================================================================== */

import {
  GEO, PALETAS, CANALES_NUMERICOS, CANAL_FX,
  type Canales, type CanalNumerico, type ClavePaleta, type ClaveFx,
  type Asimetria,
} from './emociones.ts';

/** Una pose de la que solo interesan los canales numéricos. Tanto `Canales`
 *  como `PoseResuelta` encajan acá, así que la geometría no necesita saber si
 *  le llegó una pose del catálogo o una ya mezclada. */
export type PoseNumerica = Record<CanalNumerico, number>;

export type Colores = { cuerpo: string[]; tinta: string; halo: string; rim: string };

/** Pose con la paleta ya expandida a colores concretos. */
export type PoseResuelta = PoseNumerica & Colores & { paleta?: ClavePaleta };

export type Lado = 'izq' | 'der';

/** 'px' para la propiedad CSS `transform`; '' para el atributo del SVG. */
export type Unidad = 'px' | '';

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const clamp = (v: number, min: number, max: number): number =>
  (v < min ? min : v > max ? max : v);

const n = (v: number): number => Number(v.toFixed(3));

/* --- Color ---------------------------------------------------------- */

function hexARgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbAHex(c: readonly number[]): string {
  return '#' + c.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
}

/**
 * Los extremos se cortocircuitan a propósito. Sin eso, `t = 0` devolvería el
 * color de origen pasado por RGB y de vuelta: mismo color, pero reescrito en
 * minúsculas y expuesto a un redondeo. Al terminar una transición hacia
 * `neutral` los valores tienen que caer EXACTAMENTE en los del archivo
 * original, no en algo equivalente. Es lo que sostiene la garantía de que el
 * reposo del rig es el SVG que ya está en producción.
 */
export function mezclarColor(a: string, b: string, t: number): string {
  if (a === b || t <= 0) return a;
  if (t >= 1) return b;
  const x = hexARgb(a);
  const y = hexARgb(b);
  return rgbAHex([lerp(x[0], y[0], t), lerp(x[1], y[1], t), lerp(x[2], y[2], t)]);
}

/* --- Poses ---------------------------------------------------------- */

/** Expande la clave de paleta a colores concretos. */
export function resolver(pose: Canales): PoseResuelta {
  const p = PALETAS[pose.paleta] ?? PALETAS.menta;
  return {
    ...pose,
    cuerpo: [...p.cuerpo],
    tinta: p.tinta,
    halo: p.halo,
    rim: p.rim,
  };
}

/**
 * Interpola dos poses ya resueltas.
 *
 * Los colores se mezclan desde los COLORES de cada pose, no volviendo a mirar
 * su clave de paleta. La diferencia importa cuando se interrumpe una
 * transición a mitad de camino: el punto de partida de la nueva es una pose
 * mezclada, que ya no corresponde a ninguna paleta del catálogo. Releyendo la
 * clave, ese estado intermedio se perdería y el color pegaría un salto.
 */
export function mezclarPose(a: PoseResuelta, b: PoseResuelta, t: number): PoseResuelta {
  const out = {} as PoseResuelta;
  for (const k of CANALES_NUMERICOS) out[k] = lerp(a[k], b[k], t);

  // El `?? c` no llega a dispararse —ambas rampas tienen cinco paradas— pero
  // deja explícito qué pasaría si alguna vez no las tuvieran: se sostiene el
  // color de origen en vez de dejar un hueco en el gradiente.
  out.cuerpo = a.cuerpo.map((c, i) => mezclarColor(c, b.cuerpo[i] ?? c, t));
  out.tinta = mezclarColor(a.tinta, b.tinta, t);
  out.halo = mezclarColor(a.halo, b.halo, t);
  out.rim = mezclarColor(a.rim, b.rim, t);
  return out;
}

/* --- Ritmo ----------------------------------------------------------- */

export type Ritmo = {
  y: number; rot: number; esc: number;
  tx: number; ty: number; parpadeo: number;
};

/** El bucle de reposo en reposo: lo que usa el exportador y el primer cuadro. */
export const RITMO_NULO: Readonly<Ritmo> =
  Object.freeze({ y: 0, rot: 0, esc: 1, tx: 0, ty: 0, parpadeo: 1 });

/* --- Matrices -------------------------------------------------------
 * Todas hornean el pivote dentro de la propia matriz (T · P · R · S · P⁻¹).
 * Así el resultado vale igual como atributo `transform` que como propiedad
 * CSS con `transform-box: view-box; transform-origin: 0 0`, que es lo que
 * permite que el rig y el exportador compartan estas funciones.
 * ------------------------------------------------------------------- */

/**
 * @param unidad 'px' para la propiedad CSS `transform`; '' (o nada) para el
 *   atributo `transform` del SVG. No es solo cosmético: la propiedad CSS
 *   exige unidad en las longitudes y ángulo con `deg`, mientras que el
 *   atributo los quiere pelados y falla en silencio si le llega `deg`. El
 *   rig usa 'px' y el exportador '' — misma cuenta, dos gramáticas.
 */
export function matriz(
  x: number, y: number, px: number, py: number,
  rot: number, sx: number, sy: number, unidad: Unidad = '',
): string {
  const u = unidad;
  const ang = u === 'px' ? `${n(rot)}deg` : `${n(rot)}`;
  return `translate(${n(x)}${u}, ${n(y)}${u}) translate(${px}${u}, ${py}${u}) `
       + `rotate(${ang}) scale(${n(sx)}, ${n(sy)}) translate(${-px}${u}, ${-py}${u})`;
}

/** Cuerpo. El pivote viaja entre el centro del blob y su base: el pivote
 *  bajo es lo que hace que la tristeza se desinfle en vez de encogerse. */
export function trCuerpo(p: PoseNumerica, r: Ritmo = RITMO_NULO, unidad: Unidad = ''): string {
  const px = GEO.centroCuerpo[0];
  const py = lerp(GEO.centroCuerpo[1], GEO.baseCuerpo[1], p.cuerpoPivote);
  return matriz(p.cuerpoX + r.tx, p.cuerpoY + r.y + r.ty, px, py,
                p.cuerpoRot + r.rot, p.cuerpoSX * r.esc, p.cuerpoSY * r.esc, unidad);
}

/** Cara. Hereda una fracción del cuerpo: al 100 % los ojos se deformarían
 *  con cada squash y el personaje se vuelve de goma; al 0 % la cara flota
 *  despegada. 50 % de la traslación y 35 % de la escala es donde deja de
 *  notarse cualquiera de las dos cosas. */
export function trCara(p: PoseNumerica, r: Ritmo = RITMO_NULO, unidad: Unidad = ''): string {
  const cx = p.cuerpoX + r.tx;
  const cy = p.cuerpoY + r.y + r.ty;
  const sx = p.cuerpoSX * r.esc;
  const sy = p.cuerpoSY * r.esc;
  return matriz(cx * 0.5 + p.caraX, cy * 0.5 + p.caraY, 120, 124,
                (p.cuerpoRot + r.rot) * 0.4 + p.caraRot,
                (1 + (sx - 1) * 0.35) * p.caraS,
                (1 + (sy - 1) * 0.35) * p.caraS, unidad);
}

export function trAura(p: PoseNumerica, unidad: Unidad = ''): string {
  return matriz(0, 0, GEO.halo.cx, GEO.halo.cy, 0, p.auraS, p.auraS, unidad);
}

export function trRubor(p: PoseNumerica, i: 0 | 1, unidad: Unidad = ''): string {
  const b = GEO.rubor[i];
  return matriz(0, 0, b.cx, b.cy, 0, p.ruborS, p.ruborS, unidad);
}

/** Las chispas de marca se emiten como atributo, no como CSS: son el
 *  asterisco del logo y su escala base ya vive en el path. */
export function trChispa(p: PoseNumerica, i: 0 | 1 | 2): string {
  const c = GEO.chispas[i];
  return `translate(${c.x} ${c.y}) scale(${n(c.s * p.chispasS)})`;
}

/* --- Ojos ------------------------------------------------------------ */

/** Los tres valores que dependen del lado y de la asimetría, en un solo
 *  lugar: `confusion` es la única emoción que despareja los ojos. */
export function ojoLado(
  lado: Lado, p: PoseNumerica, asimetria?: Asimetria | null, parpadeo = 1,
): { abre: number; y: number; sy: number } {
  // `?? {}` y no un parámetro por defecto: el valor por defecto solo cubre
  // `undefined`, y acá llega `null` de verdad — el catálogo solo le pone
  // `asimetria` a `confusion`, así que las otras 32 emociones lo pasan vacío.
  const a = asimetria ?? {};
  const der = lado === 'der';
  return {
    abre: (der && a.ojoAbreDer != null ? a.ojoAbreDer : p.ojoAbre) * parpadeo,
    y:    p.ojoY + (der && a.ojoYDer != null ? a.ojoYDer : 0),
    sy:   p.ojoSY * (der && a.ojoSYDer != null ? a.ojoSYDer : 1),
  };
}

export function trOjo(lado: Lado, p: PoseNumerica, unidad: Unidad = ''): string {
  const u = unidad;
  const base = GEO.ojos[lado];
  const sep = lado === 'izq' ? -p.ojoSep : p.ojoSep;
  return `translate(${n(base[0] + sep)}${u}, ${base[1]}${u})`;
}

export function trOjoMov(
  lado: Lado, p: PoseNumerica, asimetria?: Asimetria | null, unidad: Unidad = '',
): string {
  const u = unidad;
  const l = ojoLado(lado, p, asimetria, 1);
  return `translate(${n(p.ojoX)}${u}, ${n(l.y)}${u}) scale(${n(p.ojoSX)}, ${n(l.sy)})`;
}

/**
 * El párpado, como polígono de recorte.
 *
 * Es un RECORTE, no un dibujo: al cerrarse deja ver el gradiente del cuerpo
 * que ya estaba debajo, que es exactamente lo que hace un párpado sobre un
 * personaje translúcido. Por eso Lumy puede cerrar los ojos sin que haya que
 * inventarle un color de piel.
 *
 * `ojoAng` inclina el borde superior: baja la esquina interna y sube la
 * externa. Ese gesto es el que lee como ceño fruncido SIN que exista una
 * ceja — Lumy no tiene y no se le agrega ninguna. Con el signo invertido da
 * la ceja preocupada de la tristeza y el miedo.
 */
export function parpado(
  lado: Lado, p: PoseNumerica, asimetria?: Asimetria | null, parpadeo = 1,
): string {
  const l = ojoLado(lado, p, asimetria, parpadeo);
  const arriba = -18 + (1 - clamp(l.abre, 0, 1)) * 32;
  const abajo = 18 - p.ojoAbajo * 30;
  const interno = n(arriba + p.ojoAng * 1.2);
  const externo = n(arriba - p.ojoAng * 0.4);
  return lado === 'izq'
    ? `-20,${externo} 20,${interno} 20,${n(abajo)} -20,${n(abajo)}`
    : `-20,${interno} 20,${externo} 20,${n(abajo)} -20,${n(abajo)}`;
}

/** Ojo cerrado en arco: ∩ contento con `ojoArcoC` positivo, ∪ triste con
 *  negativo. Se funde con el ojo abierto mediante `ojoArco`. */
export function arcoOjo(p: PoseNumerica): string {
  return `M -11 2 Q 0 ${n(2 - 11 * p.ojoArcoC)} 11 2`;
}

/* --- Boca ------------------------------------------------------------ */

/**
 * La boca se emite como cadena de cuadráticas en vez de una sola, para que
 * `bocaOnda` (el temblor de los nervios) pueda deformar el trazo sin cambiar
 * de tipo de path a mitad de una transición.
 *
 * Partirla no cuesta precisión. Para una cuadrática de control P0,P1,P2 la
 * forma polar es
 *
 *     f(u,v) = P0(1−u)(1−v) + P1[(1−u)v + u(1−v)] + P2·u·v
 *
 * y la subcurva sobre [t0,t1] tiene extremos f(t0,t0), f(t1,t1) y control
 * f(t0,t1). Es una identidad, no una aproximación: con `bocaOnda` en 0 el
 * trazo es exactamente "M109 136 Q120 147.5 131 136", el del archivo
 * original. Verificado con un diff de píxeles a 2x.
 *
 * El path siempre cierra. Con `bocaAbre` en 0 el borde inferior cae encima
 * del superior, el área es nula y no se ve relleno: una sola forma sirve
 * para la boca cerrada y para la abierta.
 */
export function boca(p: PoseNumerica): string {
  const g = GEO.boca;
  const cx = 120 + p.bocaX;
  const semi = 11 * p.bocaAncho;
  const y = g.y + p.bocaY;
  const ctrl = y + g.ctrl * p.bocaCurva;

  const P0: Punto = [cx - semi, y];
  const P1: Punto = [cx, ctrl];
  const P2: Punto = [cx + semi, y];

  const f = (u: number, v: number): Punto => [
    P0[0] * (1 - u) * (1 - v) + P1[0] * ((1 - u) * v + u * (1 - v)) + P2[0] * u * v,
    P0[1] * (1 - u) * (1 - v) + P1[1] * ((1 - u) * v + u * (1 - v)) + P2[1] * u * v,
  ];

  // Tres medios ciclos a lo ancho: suficiente para leer "temblor" sin que
  // se vuelva un zigzag de dientes de sierra.
  const onda = (pt: Punto, t: number): string =>
    `${n(pt[0])} ${n(pt[1] + p.bocaOnda * 2.6 * Math.sin(t * Math.PI * 3))}`;

  const N = 6;
  const inicio = onda(f(0, 0), 0);
  let d = `M ${inicio}`;
  for (let i = 0; i < N; i++) {
    const t0 = i / N;
    const t1 = (i + 1) / N;
    d += ` Q ${onda(f(t0, t1), (t0 + t1) / 2)} ${onda(f(t1, t1), t1)}`;
  }
  return `${d} Q ${n(cx)} ${n(ctrl + p.bocaAbre * 26)} ${inicio} Z`;
}

type Punto = [number, number];

/* --- Opacidades derivadas -------------------------------------------- */

export type Opacidades = {
  rubor: number; chispas: number; aura: number; brillos: number;
  ojoBrillo: number; ojoAbierto: number; ojoArco: number;
};

/** Las que no son un canal directo sino un canal por un valor del archivo
 *  original (el rubor va al 0.42 que traía el SVG, por ejemplo). */
export function opacidades(p: PoseNumerica): Opacidades {
  return {
    rubor: clamp(0.42 * p.ruborOp, 0, 1),
    chispas: clamp(p.chispasOp, 0, 1),
    aura: clamp(p.auraOp, 0, 1.5),
    brillos: clamp(p.brilloOp, 0, 1),
    ojoBrillo: clamp(p.ojoBrillo, 0, 1.5),
    ojoAbierto: 1 - clamp(p.ojoArco, 0, 1),
    ojoArco: clamp(p.ojoArco, 0, 1),
  };
}

/** Valor de una capa de efecto a partir de su nombre corto. La tabla
 *  `CANAL_FX` reemplaza al `'fx' + clave` de la versión anterior: concatenar
 *  el nombre del canal funcionaba, pero el compilador no podía comprobar que
 *  la capa existiera y un error de tipeo daba 0 en silencio. */
export function valorFx(p: PoseNumerica, clave: ClaveFx): number {
  return clamp(p[CANAL_FX[clave]] || 0, 0, 1);
}

export const VERSION = '2.0.0';
