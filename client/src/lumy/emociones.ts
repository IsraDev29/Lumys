/* ===========================================================================
 * Lumy — catálogo de emociones
 * ---------------------------------------------------------------------------
 * Fuente de verdad única. De este archivo salen cuatro cosas:
 *
 *   1. El rig que corre en la PWA          (src/lumy/Lumy.tsx)
 *   2. Los SVG por emoción para importar   (tools/lumy-exportar-svg.js)
 *   3. La especificación del rig de Rive   (docs/lumy-rive-spec.md)
 *   4. Las pruebas de fidelidad            (test/lumy.test.js)
 *
 * Si una emoción se retoca acá, las cuatro salidas cambian juntas. No hay
 * valores de pose duplicados en ningún otro lugar del proyecto.
 *
 * El exportador y las pruebas corren en Node y leen este .ts directamente:
 * Node 24 le borra los tipos al vuelo. Por eso el archivo se mantiene dentro
 * de la "sintaxis borrable" — nada de enum ni namespace. El tsconfig lo exige
 * con `erasableSyntaxOnly`, así que no hay forma de romperlo sin enterarse.
 *
 * ---------------------------------------------------------------------------
 * MODELO
 *
 * Se usa la rueda de Plutchik: ocho emociones básicas, cada una en tres
 * intensidades (24 estados). Se eligió Plutchik y no las seis de Ekman porque
 * las intensidades graduadas son justamente lo que un adolescente necesita
 * para nombrar lo que le pasa: la distancia entre "fastidio" y "furia" es la
 * alfabetización emocional entera.
 *
 * A eso se suman ocho estados que Plutchik no cubre y que en 12-18 años pesan
 * más que varias de las básicas: vergüenza, culpa, orgullo, soledad, agobio,
 * esperanza, empatía y confusión. Son emociones autoconscientes y sociales —
 * aparecen con la teoría de la mente y se vuelven dominantes en la
 * adolescencia temprana.
 *
 * Total: 33 estados (32 + neutral).
 *
 * ---------------------------------------------------------------------------
 * LA REGLA DE SEGURIDAD:  `banda`
 *
 * Lumy NUNCA refleja de vuelta la emoción negativa del estudiante. Si alguien
 * reporta angustia y la mascota se pone angustiada, se valida el afecto pero
 * se amplifica: es contagio emocional, no acompañamiento. La app tiene que ser
 * el elemento regulado de la conversación.
 *
 *   banda: 'apoyo'  → Lumy la puede adoptar sola, reaccionando al estudiante.
 *   banda: 'espejo' → SOLO se muestra cuando el estudiante nombra su propia
 *                     emoción y la ve dibujada. Nunca se activa automáticamente
 *                     desde el ICVE ni desde el clima.
 *
 * Al pasar a TypeScript esto dejó de ser solo una convención vigilada por los
 * tests: `EmocionApoyo` se deriva del propio catálogo, y las funciones
 * automáticas (`porIcve`, `POR_CLIMA`) están tipadas para devolver únicamente
 * emociones de esa banda. Mapear `lluvia` a `tristeza` ahora no compila.
 * =========================================================================== */

/* ---------------------------------------------------------------------
 * Geometría original de lumys-mascota.svg. NO se toca: el rig deforma
 * estos números, nunca los reemplaza. La silueta en reposo es idéntica
 * al SVG que ya está en producción.
 * ------------------------------------------------------------------- */

export type Punto = readonly [number, number];
export type Elipse = { cx: number; cy: number; rx: number; ry: number };
export type Circulo = { cx: number; cy: number; r: number };

export const GEO = {
  viewBox: '0 0 207 176',
  // El grupo raíz del SVG original lleva translate(-17,-30). Todo lo de
  // abajo está en el sistema de coordenadas de ADENTRO de ese grupo.
  desfase: [-17, -30] as Punto,

  blob: 'M204.80 116.00 C203.67 132.59 187.31 151.18 173.17 162.79 C159.04 174.41 '
      + '139.14 184.45 120.00 185.70 C100.86 186.94 70.74 181.88 58.34 170.26 '
      + 'C45.94 158.64 44.37 133.01 45.60 116.00 C46.83 98.99 53.29 80.06 65.69 68.21 '
      + 'C78.09 56.36 100.96 45.73 120.00 44.90 C139.04 44.07 165.83 51.38 179.96 63.23 '
      + 'C194.10 75.08 205.93 99.41 204.80 116.00 Z',
  centroCuerpo: [125, 115] as Punto,   // centro del bounding box del blob
  baseCuerpo:   [125, 186] as Punto,   // borde inferior: pivote para squash con "pie" fijo

  halo:  { cx: 120, cy: 118, rx: 96, ry: 81 },
  core:  { cx: 112, cy: 128, rx: 58, ry: 46 },

  brilloSuave: { cx: 88, cy: 70, rx: 30, ry: 18, rot: -24 },
  brilloDuro:  { cx: 99, cy: 61, rx: 10, ry: 5.2, rot: -24 },

  motas: [ { cx: 163, cy: 90, r: 2.6 }, { cx: 63, cy: 150, r: 2.2 },
           { cx: 150, cy: 163, r: 1.8 } ] as readonly Circulo[],

  // Tupla y no lista: los índices son 0 (izquierda) y 1 (derecha), y tiparlo
  // así deja que `trRubor` los use sin comprobar que existan.
  rubor: [ { cx: 76, cy: 134, rx: 13, ry: 7.5 },
           { cx: 164, cy: 134, rx: 13, ry: 7.5 } ] as readonly [Elipse, Elipse],

  ojos: { izq: [96, 113] as Punto, der: [144, 113] as Punto, rx: 12, ry: 14 },
  // Desplazamientos de los brillos respecto al centro del ojo. Idénticos en
  // ambos ojos en el SVG original, así que el ojo se dibuja una sola vez.
  brillosOjo: [ { dx: -4.2, dy: -5.6, r: 4.4 }, { dx: 4.4, dy: 5.2, r: 2.2 } ],

  boca: { x0: 109, x1: 131, y: 136, ctrl: 11.5, grosor: 4.8 },

  // El asterisco de marca. Es el mismo path del logo, no un dibujo nuevo.
  chispaPath: 'M0,-1 C0.14,-0.4 0.4,-0.14 1,0 C0.4,0.14 0.14,0.4 0,1 '
            + 'C-0.14,0.4 -0.4,0.14 -1,0 C-0.4,-0.14 -0.14,-0.4 0,-1 Z',
  chispas: [ { x: 206, y: 64,  s: 10.5, color: '#FFD77A', op: 1   },
             { x: 32,  y: 82,  s: 6,    color: '#CDB2FF', op: 1   },
             { x: 196, y: 172, s: 5,    color: '#FFD77A', op: 0.5 } ] as readonly
             [ChispaGeo, ChispaGeo, ChispaGeo],
};

export type ChispaGeo = { x: number; y: number; s: number; color: string; op: number };

/* ---------------------------------------------------------------------
 * Paletas. Por cada una: las cinco paradas del gradiente radial del cuerpo,
 * el color de tinta (ojos y boca), el halo exterior y el borde interno.
 * Todas mantienen la misma rampa de luminancia que la original, así que el
 * personaje se lee igual aunque cambie el matiz: lo que comunica la emoción
 * es la POSE, el color solo la acompaña.
 *
 * `halo` y `rim` van declarados y no derivados de `cuerpo` porque en el
 * archivo original no son paradas del gradiente del cuerpo: son #93DDD1 y
 * #0F766E, dos valores propios. `menta` los conserva al dígito — es lo que
 * garantiza que el reposo siga siendo idéntico al SVG en producción.
 * ------------------------------------------------------------------- */

/** Las cinco paradas del gradiente radial del cuerpo, del centro al borde. */
export type RampaCuerpo = readonly [string, string, string, string, string];
export type Paleta = { cuerpo: RampaCuerpo; tinta: string; halo: string; rim: string };

export const PALETAS = {
  /* La paleta de reposo: la que lleva Lumy cuando no reacciona a nada, que es
     la mayor parte del tiempo. Sigue al isotipo — cuerpo casi blanco con una
     insinuación de lavanda, borde lavanda tinta y ojos en navy. Es la única
     paleta que existe para parecerse a la identidad y no para acompañar a una
     emoción concreta. */
  marca:    { cuerpo: ['#FDFCFF', '#F3EEFE', '#E0D3FA', '#C0A6F0', '#8E6BD4'], tinta: '#152B63', halo: '#CDB2FF', rim: '#6C4BC1' },

  /* `menta` es el registro del SVG original (public/img/lumys-mascota.svg) y
     por eso conserva los dígitos exactos de la identidad anterior: hay una
     prueba en test/lumy.test.js que la compara contra ese archivo parada por
     parada. No se retoca al cambiar de marca — se retoca el día que se vuelva
     a exportar el SVG, y ese día la prueba avisa. */
  menta:    { cuerpo: ['#F3FDFB', '#DCF6F1', '#B9EBE2', '#6FCBBB', '#2A9D8C'], tinta: '#065F46', halo: '#93DDD1', rim: '#0F766E' },
  celesteVivo:{ cuerpo: ['#FAFEFF', '#DFF6FD', '#B5E9F8', '#6FD0EE', '#1E9BC7'], tinta: '#0A4A61', halo: '#9EE0F5', rim: '#1580A6' },
  oro:      { cuerpo: ['#FFFDF4', '#FDF3D8', '#F6E3AE', '#E2C069', '#B8892A'], tinta: '#5A4212', halo: '#F2D89B', rim: '#8A6318' },
  cielo:    { cuerpo: ['#F4FCFF', '#DEF2FB', '#B8E1F2', '#71B8D8', '#3082AA'], tinta: '#0C4A63', halo: '#9CD3EC', rim: '#1E6285' },
  indigo:   { cuerpo: ['#EFF6FB', '#D8E8F3', '#B2CDE2', '#7095B7', '#3E6186'], tinta: '#1E3A56', halo: '#A9C6DE', rim: '#2C4A69' },
  lluvia:   { cuerpo: ['#EDF2F7', '#D3DFEA', '#ABBDD1', '#6B84A0', '#3A5070'], tinta: '#22364F', halo: '#9DB2C8', rim: '#24405F' },
  lavanda:  { cuerpo: ['#F7F5FE', '#E6E0F7', '#CABEEA', '#9C89CD', '#6C57A2'], tinta: '#3D2C66', halo: '#BDAEE2', rim: '#513C82' },
  // Los medios van más saturados que en las demás: sobre fondo crema, una
  // terracota clara se lava y el enojo pierde toda su temperatura.
  terracota:{ cuerpo: ['#FFF6F0', '#FBDCCB', '#EFB393', '#D4794D', '#A64518'], tinta: '#6B2C0C', halo: '#EEB295', rim: '#8E4118' },
  ceniza:   { cuerpo: ['#FAF9FB', '#EFECF2', '#D8D2DF', '#ADA3BB', '#786C8A'], tinta: '#3A3247', halo: '#C9C1D5', rim: '#5B4F70' },
  cian:     { cuerpo: ['#F2FEFF', '#D8F8FC', '#AFECF3', '#6ED4E0', '#299FB0'], tinta: '#08505C', halo: '#9CE4EE', rim: '#157F90' },
  rosa:     { cuerpo: ['#FFF6F8', '#FCE3EA', '#F5C2D1', '#E08FA8', '#B45573'], tinta: '#6E2038', halo: '#EEB5C8', rim: '#8E3A56' },
  arena:    { cuerpo: ['#FAF8F4', '#EDE7DC', '#D6CCBB', '#A99B85', '#75674F'], tinta: '#3E3527', halo: '#CFC4B2', rim: '#5A4D39' },
  amanecer: { cuerpo: ['#FFFBFD', '#FDEBF4', '#F9D2E6', '#EFA6CD', '#C56A9E'], tinta: '#5E2044', halo: '#F5C4DE', rim: '#94517A' },
} satisfies Record<string, Paleta>;

export type ClavePaleta = keyof typeof PALETAS;

/* ---------------------------------------------------------------------
 * Canales del rig. Cualquier pose es un punto en este espacio; una
 * transición es una interpolación entre dos puntos. Estos 34 canales son
 * exactamente los que se traducen a inputs del state machine de Rive.
 * ------------------------------------------------------------------- */
export type Canales = {
  // --- Cuerpo -------------------------------------------------------
  cuerpoX: number; cuerpoY: number;   // traslación, unidades de usuario
  cuerpoSX: number; cuerpoSY: number; // squash / stretch
  cuerpoRot: number;                  // grados
  cuerpoPivote: number;               // 0 = centro del blob, 1 = base del blob

  // --- Cara (grupo entero: rubor + ojos + boca) ----------------------
  caraX: number; caraY: number; caraRot: number; caraS: number;

  // --- Ojos ---------------------------------------------------------
  ojoSX: number; ojoSY: number;       // tamaño del ojo
  ojoAbre: number;                    // párpado superior. 1 abierto, 0 cerrado
  ojoAbajo: number;                   // párpado inferior (entrecerrar)
  ojoAng: number;                     // inclinación del párpado. + enojo, − preocupación
  ojoX: number; ojoY: number;         // dirección de la mirada
  ojoSep: number;                     // separación extra entre ojos
  ojoArco: number;                    // 0..1 fundido al ojo cerrado en arco
  ojoArcoC: number;                   // curvatura del arco. +1 feliz (∩), −1 triste (∪)
  ojoBrillo: number;                  // opacidad de los reflejos

  // --- Boca ---------------------------------------------------------
  bocaCurva: number;                  // 1 = la sonrisa original. 0 recta, − hacia abajo
  bocaAncho: number;
  bocaAbre: number;                   // 0..1 apertura (boca rellena)
  bocaOnda: number;                   // 0..1 temblor / zigzag
  bocaX: number; bocaY: number;
  bocaGrosor: number;

  // --- Detalles -----------------------------------------------------
  ruborOp: number; ruborS: number;
  chispasOp: number; chispasS: number;
  auraOp: number; auraS: number;
  brilloOp: number;                   // brillos especulares del cuerpo

  // --- Ritmo (bucle de reposo) --------------------------------------
  flota: number;                      // amplitud vertical del flotado, en unidades
  flotaVel: number;                   // segundos por ciclo
  tiembla: number;                    // amplitud del temblor
  respira: number;                    // amplitud del "respirado" (escala)
  respiraVel: number;                 // segundos por ciclo
  parpadeoVel: number;                // segundos promedio entre parpadeos

  // --- Capas de efecto (todas 0 en reposo) ---------------------------
  fxLagrima: number;                  // lágrimas
  fxSudor: number;                    // gota de nervios
  fxEspiral: number;                  // espirales de confusión
  fxConfeti: number;                  // celebración
  fxCorazon: number;                  // empatía / cariño
  fxVapor: number;                    // vapor de enojo / agobio
  fxLineas: number;                   // líneas de impacto (sorpresa)
  fxNube: number;                     // nubecita de lluvia

  paleta: ClavePaleta;
};

/** Todos los canales menos `paleta`: los que se interpolan con una resta. */
export type CanalNumerico = Exclude<keyof Canales, 'paleta'>;

export const BASE: Canales = {
  cuerpoX: 0, cuerpoY: 0,
  cuerpoSX: 1, cuerpoSY: 1,
  cuerpoRot: 0,
  cuerpoPivote: 0,

  caraX: 0, caraY: 0, caraRot: 0, caraS: 1,

  ojoSX: 1, ojoSY: 1,
  ojoAbre: 1,
  ojoAbajo: 0,
  ojoAng: 0,
  ojoX: 0, ojoY: 0,
  ojoSep: 0,
  ojoArco: 0,
  ojoArcoC: 1,
  ojoBrillo: 1,

  bocaCurva: 1,
  bocaAncho: 1,
  bocaAbre: 0,
  bocaOnda: 0,
  bocaX: 0, bocaY: 0,
  bocaGrosor: 1,

  ruborOp: 1, ruborS: 1,
  chispasOp: 1, chispasS: 1,
  auraOp: 1, auraS: 1,
  brilloOp: 1,

  flota: 4.5,
  flotaVel: 5.5,
  tiembla: 0,
  respira: 0.012,
  respiraVel: 4,
  parpadeoVel: 5.2,

  fxLagrima: 0,
  fxSudor: 0,
  fxEspiral: 0,
  fxConfeti: 0,
  fxCorazon: 0,
  fxVapor: 0,
  fxLineas: 0,
  fxNube: 0,

  paleta: 'marca',
};

/** Los canales numéricos, en una lista, calculada una sola vez. Es sobre esta
 *  lista que itera la interpolación: `for…in` sobre BASE obligaría a convencer
 *  al compilador de que la clave es válida en cada vuelta. */
export const CANALES_NUMERICOS: readonly CanalNumerico[] =
  (Object.keys(BASE) as (keyof Canales)[])
    .filter((k): k is CanalNumerico => k !== 'paleta');

/** Los ocho efectos, por su nombre corto. El canal que les corresponde se
 *  resuelve por tabla y no concatenando 'fx' + nombre: así el compilador
 *  comprueba que la capa existe. */
export const CANAL_FX = {
  lagrima: 'fxLagrima',
  sudor: 'fxSudor',
  espiral: 'fxEspiral',
  confeti: 'fxConfeti',
  corazon: 'fxCorazon',
  vapor: 'fxVapor',
  lineas: 'fxLineas',
  nube: 'fxNube',
} satisfies Record<string, CanalNumerico>;

export type ClaveFx = keyof typeof CANAL_FX;
export const CLAVES_FX = Object.keys(CANAL_FX) as readonly ClaveFx[];

/* --------------------------------------------------------------------- */

export type Banda = 'apoyo' | 'espejo';
export type ClaveFamilia =
  | 'alegria' | 'confianza' | 'miedo' | 'sorpresa'
  | 'tristeza' | 'aversion' | 'enojo' | 'anticipacion'
  | 'social' | 'base';

/** Ojos desparejos. Solo `confusion` la usa. */
export type Asimetria = { ojoAbreDer?: number; ojoYDer?: number; ojoSYDer?: number };

/**
 * Cada emoción declara SOLO lo que se aparta de BASE.
 *
 *   familia     — rama de Plutchik, o 'social' / 'base'
 *   intensidad  — 1 leve · 2 media · 3 alta. null en las no graduadas
 *   banda       — 'apoyo' | 'espejo'  (ver la nota de seguridad arriba)
 *   nombre      — etiqueta que ve el estudiante
 *   pista       — cómo se siente, en palabras de un chavalo de 12-18.
 *                 Se usa en el selector de emociones del check-in.
 */
export type DefinicionEmocion = {
  nombre: string;
  familia: ClaveFamilia;
  intensidad: 1 | 2 | 3 | null;
  banda: Banda;
  pista: string;
  pose: Partial<Canales>;
  asimetria?: Asimetria;
};

export const EMOCIONES = {

  /* === Base ========================================================= */
  neutral: {
    nombre: 'Tranquilo', familia: 'base', intensidad: null, banda: 'apoyo',
    pista: 'Ni bien ni mal. Acá nomás.',
    pose: {},
  },

  /* === 1. ALEGRÍA =================================================== */
  serenidad: {
    nombre: 'Calma', familia: 'alegria', intensidad: 1, banda: 'apoyo',
    pista: 'En paz. El cuerpo suelto.',
    pose: {
      paleta: 'cielo', ojoArco: 1, ojoArcoC: 1, bocaCurva: 0.85, bocaAncho: 0.92,
      cuerpoSX: 1.03, cuerpoSY: 0.97, ruborOp: 0.7,
      flota: 3, flotaVel: 7.5, respira: 0.022, respiraVel: 6, auraS: 1.06,
    },
  },
  alegria: {
    nombre: 'Alegría', familia: 'alegria', intensidad: 2, banda: 'apoyo',
    pista: 'Contento de verdad.',
    pose: {
      paleta: 'celesteVivo', ojoAbajo: 0.32, ojoSY: 0.92, bocaCurva: 1.45,
      bocaAncho: 1.15, bocaAbre: 0.18, ruborOp: 1.2, ruborS: 1.1,
      chispasOp: 1.3, chispasS: 1.15, cuerpoSY: 1.04, cuerpoY: -3,
      flota: 6.5, flotaVel: 3.6, auraOp: 1.25,
    },
  },
  euforia: {
    nombre: 'Celebración', familia: 'alegria', intensidad: 3, banda: 'apoyo',
    pista: '¡Lo lograste! No te cabe en el pecho.',
    pose: {
      paleta: 'oro', ojoArco: 1, ojoArcoC: 1, ojoSX: 1.1,
      bocaCurva: 1.6, bocaAncho: 1.3, bocaAbre: 0.62,
      ruborOp: 1.3, chispasOp: 1.6, chispasS: 1.4,
      cuerpoSX: 0.94, cuerpoSY: 1.1, cuerpoY: -9, cuerpoRot: -3,
      flota: 10, flotaVel: 1.6, auraOp: 1.5, auraS: 1.14, fxConfeti: 1,
    },
  },

  /* === 2. CONFIANZA ================================================= */
  aceptacion: {
    nombre: 'Aceptación', familia: 'confianza', intensidad: 1, banda: 'apoyo',
    pista: 'Está bien así. No hay que pelear con esto.',
    pose: {
      ojoAbajo: 0.2, ojoSY: 0.95, bocaCurva: 0.95, ruborOp: 0.85,
      cuerpoSX: 1.02, cuerpoSY: 0.98, flota: 3.4, flotaVel: 6.4, respira: 0.018,
    },
  },
  confianza: {
    nombre: 'Confianza', familia: 'confianza', intensidad: 2, banda: 'apoyo',
    pista: 'Podés contar con esto.',
    pose: {
      ojoSX: 1.06, ojoSY: 1.04, ojoBrillo: 1.15, bocaCurva: 1.2, bocaAncho: 1.05,
      ruborOp: 1.15, ruborS: 1.08, cuerpoSY: 1.02, caraY: -1,
      flota: 4, flotaVel: 5, auraOp: 1.15,
    },
  },
  admiracion: {
    nombre: 'Admiración', familia: 'confianza', intensidad: 3, banda: 'apoyo',
    pista: 'Wow. Respeto genuino por alguien.',
    pose: {
      paleta: 'amanecer', ojoSX: 1.18, ojoSY: 1.18, ojoBrillo: 1.3, ojoY: -2,
      bocaCurva: 1.25, bocaAbre: 0.3, bocaAncho: 0.9,
      ruborOp: 1.25, chispasOp: 1.45, chispasS: 1.25,
      cuerpoSY: 1.05, cuerpoY: -5, auraOp: 1.35, auraS: 1.1, flota: 5.5, flotaVel: 4.2,
    },
  },

  /* === 3. MIEDO ===================================================== */
  inquietud: {
    nombre: 'Inquietud', familia: 'miedo', intensidad: 1, banda: 'espejo',
    pista: 'Algo no te termina de cerrar.',
    pose: {
      paleta: 'lavanda', ojoAng: -2.2, ojoSY: 1.06, ojoX: -1.5,
      bocaCurva: 0.15, bocaAncho: 0.86, bocaOnda: 0.3,
      ruborOp: 0.6, chispasOp: 0.85,
      flota: 3, flotaVel: 4.2, tiembla: 0.35, fxSudor: 0.4,
    },
  },
  miedo: {
    nombre: 'Miedo', familia: 'miedo', intensidad: 2, banda: 'espejo',
    pista: 'Tenés miedo. Es una señal, no una debilidad.',
    pose: {
      paleta: 'lavanda', ojoSX: 1.22, ojoSY: 1.28, ojoAng: -4, ojoY: 1.5,
      ojoBrillo: 1.2, ojoSep: 1.5,
      bocaCurva: -0.5, bocaAncho: 0.78, bocaAbre: 0.28, bocaOnda: 0.5, bocaY: 2,
      ruborOp: 0.35, chispasOp: 0.6, auraOp: 0.75,
      cuerpoSX: 0.95, cuerpoSY: 1.03, cuerpoY: 2,
      flota: 1.8, flotaVel: 2.6, tiembla: 1.1, respira: 0.03, respiraVel: 1.8,
      fxSudor: 1, parpadeoVel: 2.4,
    },
  },
  terror: {
    nombre: 'Terror', familia: 'miedo', intensidad: 3, banda: 'espejo',
    pista: 'Pánico. El cuerpo entero en alerta.',
    pose: {
      paleta: 'lavanda', ojoSX: 1.4, ojoSY: 1.5, ojoAng: -6, ojoY: 2.5,
      ojoBrillo: 1.4, ojoSep: 3, ojoAbre: 1,
      bocaCurva: -0.9, bocaAncho: 0.68, bocaAbre: 0.75, bocaOnda: 0.7, bocaY: 4,
      ruborOp: 0.1, chispasOp: 0.35, auraOp: 0.5, brilloOp: 0.7,
      cuerpoSX: 0.9, cuerpoSY: 1.09, cuerpoY: 3,
      flota: 1, flotaVel: 2, tiembla: 2.4, respira: 0.045, respiraVel: 1.2,
      fxSudor: 1, fxLineas: 0.8, parpadeoVel: 1.6,
    },
  },

  /* === 4. SORPRESA ================================================== */
  distraccion: {
    nombre: 'Distracción', familia: 'sorpresa', intensidad: 1, banda: 'espejo',
    pista: 'Se te fue la cabeza a otro lado.',
    pose: {
      ojoX: 3.5, ojoY: -1.5, ojoAbajo: 0.15, bocaCurva: 0.35, bocaAncho: 0.9, bocaX: 2,
      chispasOp: 0.85, flota: 4, flotaVel: 6, cuerpoRot: 1.5,
    },
  },
  sorpresa: {
    nombre: 'Sorpresa', familia: 'sorpresa', intensidad: 2, banda: 'apoyo',
    pista: '¡No te lo esperabas!',
    pose: {
      paleta: 'cian', ojoSX: 1.28, ojoSY: 1.3, ojoBrillo: 1.25, ojoSep: 2,
      bocaCurva: -0.1, bocaAncho: 0.6, bocaAbre: 0.55,
      cuerpoSX: 0.96, cuerpoSY: 1.06, cuerpoY: -4,
      chispasOp: 1.25, chispasS: 1.2, auraOp: 1.2,
      flota: 2.5, flotaVel: 3, fxLineas: 0.65, parpadeoVel: 7,
    },
  },
  asombro: {
    nombre: 'Asombro', familia: 'sorpresa', intensidad: 3, banda: 'apoyo',
    pista: 'Te dejó sin palabras.',
    pose: {
      paleta: 'cian', ojoSX: 1.45, ojoSY: 1.48, ojoBrillo: 1.4, ojoSep: 3.5,
      bocaCurva: 0.2, bocaAncho: 0.55, bocaAbre: 0.85,
      cuerpoSX: 0.93, cuerpoSY: 1.1, cuerpoY: -7,
      chispasOp: 1.5, chispasS: 1.35, auraOp: 1.4, auraS: 1.12,
      flota: 3, flotaVel: 2.4, fxLineas: 1, parpadeoVel: 9,
    },
  },

  /* === 5. TRISTEZA ================================================== */
  melancolia: {
    nombre: 'Melancolía', familia: 'tristeza', intensidad: 1, banda: 'espejo',
    pista: 'Un bajón suave, sin motivo claro.',
    pose: {
      paleta: 'indigo', ojoAng: -1.6, ojoY: 1.5, ojoAbre: 0.82, ojoBrillo: 0.85,
      bocaCurva: 0.1, bocaAncho: 0.88, bocaY: 1,
      cuerpoSX: 1.03, cuerpoSY: 0.96, cuerpoY: 3, ruborOp: 0.6, chispasOp: 0.7,
      flota: 2.2, flotaVel: 8, respira: 0.016, respiraVel: 6.5, auraOp: 0.85,
    },
  },
  tristeza: {
    nombre: 'Tristeza', familia: 'tristeza', intensidad: 2, banda: 'espejo',
    pista: 'Estás triste. Tiene sentido estarlo.',
    pose: {
      paleta: 'indigo', ojoAng: -3.4, ojoY: 2.5, ojoAbre: 0.66, ojoBrillo: 1.2,
      ojoSY: 1.05,
      bocaCurva: -0.75, bocaAncho: 0.82, bocaY: 2,
      cuerpoSX: 1.07, cuerpoSY: 0.9, cuerpoY: 7, cuerpoPivote: 1,
      caraY: 2, ruborOp: 0.45, chispasOp: 0.45, chispasS: 0.85,
      auraOp: 0.7, brilloOp: 0.85,
      flota: 1.6, flotaVel: 9, respira: 0.02, respiraVel: 7.5,
      fxLagrima: 0.8, parpadeoVel: 6.5,
    },
  },
  pena: {
    nombre: 'Pena honda', familia: 'tristeza', intensidad: 3, banda: 'espejo',
    pista: 'Duele fuerte. No tenés que aguantarlo solo.',
    pose: {
      paleta: 'lluvia', ojoAng: -5, ojoY: 3.5, ojoAbre: 0.5, ojoBrillo: 1.35,
      bocaCurva: -1.1, bocaAncho: 0.75, bocaAbre: 0.2, bocaOnda: 0.35, bocaY: 3,
      cuerpoSX: 1.12, cuerpoSY: 0.84, cuerpoY: 12, cuerpoPivote: 1,
      caraY: 3.5, ruborOp: 0.3, chispasOp: 0.25, chispasS: 0.75,
      auraOp: 0.55, brilloOp: 0.7,
      flota: 1, flotaVel: 10, respira: 0.026, respiraVel: 9,
      fxLagrima: 1, fxNube: 0.9, parpadeoVel: 8,
    },
  },

  /* === 6. AVERSIÓN ================================================== */
  aburrimiento: {
    nombre: 'Aburrimiento', familia: 'aversion', intensidad: 1, banda: 'espejo',
    pista: 'Nada te llama. Todo da igual.',
    pose: {
      paleta: 'arena', ojoAbre: 0.6, ojoAbajo: 0.1, ojoX: -3, ojoBrillo: 0.6,
      bocaCurva: -0.15, bocaAncho: 0.8, bocaX: -2,
      cuerpoSX: 1.05, cuerpoSY: 0.95, cuerpoY: 3, cuerpoRot: -2,
      chispasOp: 0.5, auraOp: 0.8,
      flota: 1.8, flotaVel: 9.5, respira: 0.01, parpadeoVel: 8,
    },
  },
  aversion: {
    nombre: 'Rechazo', familia: 'aversion', intensidad: 2, banda: 'espejo',
    pista: 'Algo te da cosa. Querés alejarte.',
    pose: {
      paleta: 'ceniza', ojoAbre: 0.52, ojoAng: 1.8, ojoSY: 0.85, ojoX: -2.5,
      bocaCurva: -0.6, bocaAncho: 0.72, bocaOnda: 0.55, bocaX: -3, bocaY: 1,
      cuerpoSX: 1.04, cuerpoSY: 0.96, cuerpoRot: -4, cuerpoX: -3,
      caraRot: -2, ruborOp: 0.4, chispasOp: 0.55, brilloOp: 0.85,
      flota: 2.4, flotaVel: 6,
    },
  },
  repulsion: {
    nombre: 'Repulsión', familia: 'aversion', intensidad: 3, banda: 'espejo',
    pista: 'Asco fuerte. No lo querés ni cerca.',
    pose: {
      paleta: 'ceniza', ojoAbre: 0.4, ojoAng: 3, ojoSY: 0.72, ojoX: -3.5,
      bocaCurva: -0.95, bocaAncho: 0.66, bocaAbre: 0.3, bocaOnda: 0.8, bocaX: -4, bocaY: 2,
      cuerpoSX: 1.02, cuerpoSY: 0.97, cuerpoRot: -7, cuerpoX: -7,
      caraRot: -4, ruborOp: 0.25, chispasOp: 0.4, brilloOp: 0.7, auraOp: 0.8,
      flota: 2, flotaVel: 5, tiembla: 0.5,
    },
  },

  /* === 7. ENOJO ====================================================
   * Sin cejas: Lumy no tiene y no se le agregan. El enojo se construye
   * con la INCLINACIÓN del párpado superior (`ojoAng` positivo), que es
   * la solución clásica para personajes sin ceja. Tampoco se usa rojo
   * saturado — en una app de salud mental el rojo de alarma está
   * reservado para el nivel 3 de derivación. Se usa la terracota de marca.
   * ================================================================= */
  fastidio: {
    nombre: 'Fastidio', familia: 'enojo', intensidad: 1, banda: 'espejo',
    pista: 'Te está molestando algo, chiquito pero constante.',
    pose: {
      ojoAng: 2.2, ojoAbre: 0.82, ojoSY: 0.92, ojoX: -2,
      bocaCurva: -0.3, bocaAncho: 0.84, bocaX: -2.5,
      cuerpoSX: 1.02, cuerpoRot: -1.5, chispasOp: 0.8,
      flota: 3, flotaVel: 4.5,
    },
  },
  enojo: {
    nombre: 'Enojo', familia: 'enojo', intensidad: 2, banda: 'espejo',
    pista: 'Estás enojado. El enojo también se puede nombrar.',
    pose: {
      paleta: 'terracota', ojoAng: 4.5, ojoAbre: 0.66, ojoSY: 0.85, ojoSX: 1.05,
      ojoBrillo: 0.6, ojoY: 1,
      bocaCurva: -0.8, bocaAncho: 0.8, bocaAbre: 0.15, bocaY: 1,
      cuerpoSX: 1.06, cuerpoSY: 1.02, cuerpoPivote: 1,
      ruborOp: 0.9, chispasOp: 0.9, auraOp: 1.1,
      flota: 2.2, flotaVel: 2.8, tiembla: 0.7, respira: 0.028, respiraVel: 2.2,
      fxVapor: 0.75, parpadeoVel: 4,
    },
  },
  furia: {
    nombre: 'Furia', familia: 'enojo', intensidad: 3, banda: 'espejo',
    pista: 'Rabia que quema. Antes de actuar, respirá.',
    pose: {
      paleta: 'terracota', ojoAng: 7, ojoAbre: 0.5, ojoSY: 0.78, ojoSX: 1.12,
      ojoBrillo: 0.25, ojoY: 1.5, ojoSep: -1.5,
      bocaCurva: -1.15, bocaAncho: 0.9, bocaAbre: 0.5, bocaY: 2, bocaGrosor: 1.15,
      cuerpoSX: 1.1, cuerpoSY: 1.05, cuerpoPivote: 1, cuerpoY: -2,
      ruborOp: 1.1, chispasOp: 1, auraOp: 1.35, auraS: 1.08,
      flota: 2, flotaVel: 1.8, tiembla: 1.8, respira: 0.038, respiraVel: 1.4,
      fxVapor: 1, fxLineas: 0.5, parpadeoVel: 3,
    },
  },

  /* === 8. ANTICIPACIÓN ============================================== */
  interes: {
    nombre: 'Curiosidad', familia: 'anticipacion', intensidad: 1, banda: 'apoyo',
    pista: 'Algo te llamó la atención.',
    pose: {
      ojoSX: 1.1, ojoSY: 1.12, ojoX: 3, ojoBrillo: 1.15,
      bocaCurva: 0.9, bocaAncho: 0.85, bocaX: 1.5, bocaAbre: 0.12,
      cuerpoRot: 4, caraRot: 2.5, caraX: 2,
      chispasOp: 1.1, flota: 4.5, flotaVel: 4.4,
    },
  },
  anticipacion: {
    nombre: 'Expectativa', familia: 'anticipacion', intensidad: 2, banda: 'apoyo',
    pista: 'Estás esperando algo, con ganas.',
    pose: {
      paleta: 'celesteVivo', ojoSX: 1.14, ojoSY: 1.16, ojoY: -1.5, ojoBrillo: 1.2,
      bocaCurva: 1.15, bocaAncho: 0.95, bocaAbre: 0.2,
      cuerpoSY: 1.04, cuerpoY: -4, ruborOp: 1.1,
      chispasOp: 1.2, chispasS: 1.1, auraOp: 1.15,
      flota: 5.5, flotaVel: 3.2,
    },
  },
  vigilancia: {
    nombre: 'Alerta', familia: 'anticipacion', intensidad: 3, banda: 'espejo',
    pista: 'No podés bajar la guardia.',
    pose: {
      ojoSX: 1.18, ojoSY: 1.05, ojoAbajo: 0.28, ojoAng: 1.2, ojoBrillo: 1.1,
      bocaCurva: 0.05, bocaAncho: 0.8,
      cuerpoSX: 0.97, cuerpoSY: 1.04, cuerpoY: -2,
      chispasOp: 1, auraOp: 1.1,
      flota: 2, flotaVel: 2.4, tiembla: 0.4, respira: 0.024, respiraVel: 2.6,
      parpadeoVel: 3.2,
    },
  },

  /* === Sociales y autoconscientes ==================================
   * No están en Plutchik. Son las que más aparecen entre los 12 y 18:
   * dependen de la mirada del otro, y esa mirada es justo lo que se
   * vuelve central en la adolescencia.
   * ================================================================= */
  verguenza: {
    nombre: 'Vergüenza', familia: 'social', intensidad: null, banda: 'espejo',
    pista: 'Te querés esconder. A todos nos pasa.',
    pose: {
      paleta: 'rosa', ojoAbre: 0.55, ojoAng: -2, ojoY: 3, ojoX: -2.5, ojoBrillo: 0.9,
      bocaCurva: -0.35, bocaAncho: 0.7, bocaOnda: 0.3, bocaY: 1,
      cuerpoSX: 1.08, cuerpoSY: 0.9, cuerpoY: 6, cuerpoPivote: 1,
      caraY: 2, caraRot: -3,
      ruborOp: 2.1, ruborS: 1.35, chispasOp: 0.5, auraOp: 0.85,
      flota: 1.8, flotaVel: 5.5, tiembla: 0.3, fxSudor: 0.35, parpadeoVel: 3.6,
    },
  },
  culpa: {
    nombre: 'Culpa', familia: 'social', intensidad: null, banda: 'espejo',
    pista: 'Sentís que la embarraste. Se puede reparar.',
    pose: {
      paleta: 'indigo', ojoAbre: 0.6, ojoAng: -2.6, ojoY: 3.5, ojoX: -3,
      ojoBrillo: 1.05,
      bocaCurva: -0.55, bocaAncho: 0.76, bocaY: 2, bocaX: -1.5,
      cuerpoSX: 1.06, cuerpoSY: 0.91, cuerpoY: 8, cuerpoPivote: 1, cuerpoRot: -2,
      caraY: 3, caraRot: -2,
      ruborOp: 1.2, chispasOp: 0.4, auraOp: 0.7, brilloOp: 0.85,
      flota: 1.4, flotaVel: 8, fxSudor: 0.3,
    },
  },
  orgullo: {
    nombre: 'Orgullo', familia: 'social', intensidad: null, banda: 'apoyo',
    pista: 'Hiciste algo que vale. Reconocelo.',
    pose: {
      paleta: 'oro', ojoArco: 0.75, ojoArcoC: 1, ojoSX: 1.05, ojoY: -1,
      bocaCurva: 1.35, bocaAncho: 1.08,
      cuerpoSX: 0.97, cuerpoSY: 1.07, cuerpoY: -7, cuerpoRot: -1,
      caraY: -1.5, ruborOp: 1.25, chispasOp: 1.4, chispasS: 1.2,
      auraOp: 1.3, auraS: 1.08, flota: 5, flotaVel: 4.6,
    },
  },
  soledad: {
    nombre: 'Soledad', familia: 'social', intensidad: null, banda: 'espejo',
    pista: 'Te sentís aparte, aunque haya gente.',
    pose: {
      paleta: 'lluvia', ojoAbre: 0.72, ojoAng: -2, ojoY: 2, ojoX: -4, ojoBrillo: 1.1,
      bocaCurva: -0.4, bocaAncho: 0.78, bocaY: 1.5,
      cuerpoSX: 1.04, cuerpoSY: 0.93, cuerpoY: 5, cuerpoPivote: 1,
      ruborOp: 0.35, chispasOp: 0.15, chispasS: 0.7,
      auraOp: 0.45, auraS: 0.9, brilloOp: 0.8,
      flota: 1.6, flotaVel: 9.5, respira: 0.018, respiraVel: 8,
    },
  },
  agobio: {
    nombre: 'Estrés', familia: 'social', intensidad: null, banda: 'espejo',
    pista: 'Demasiadas cosas encima. No te da el cuerpo.',
    pose: {
      paleta: 'arena', ojoAbre: 0.58, ojoAng: -3.2, ojoSY: 1.08, ojoSep: 1,
      ojoBrillo: 0.9,
      bocaCurva: -0.5, bocaAncho: 0.72, bocaOnda: 0.65, bocaY: 1.5,
      cuerpoSX: 0.93, cuerpoSY: 1.02, cuerpoY: 2,
      ruborOp: 0.5, chispasOp: 0.6, auraOp: 0.75, brilloOp: 0.85,
      flota: 1.4, flotaVel: 2.2, tiembla: 1.3, respira: 0.034, respiraVel: 1.6,
      fxSudor: 0.85, fxVapor: 0.45, parpadeoVel: 2.8,
    },
  },
  esperanza: {
    nombre: 'Esperanza', familia: 'social', intensidad: null, banda: 'apoyo',
    pista: 'Algo puede mejorar. Vale sostenerlo.',
    pose: {
      paleta: 'amanecer', ojoSX: 1.08, ojoSY: 1.1, ojoY: -2, ojoBrillo: 1.25,
      bocaCurva: 1.05, bocaAncho: 0.95,
      cuerpoSY: 1.03, cuerpoY: -4, ruborOp: 1.05,
      chispasOp: 1.3, chispasS: 1.15, auraOp: 1.25, auraS: 1.06,
      flota: 4.8, flotaVel: 5.2, respira: 0.02, respiraVel: 5,
    },
  },
  empatia: {
    nombre: 'Empatía', familia: 'social', intensidad: null, banda: 'apoyo',
    pista: 'Te acompaño. No estás solo en esto.',
    pose: {
      ojoArco: 0.55, ojoArcoC: 0.4, ojoAng: -1.4, ojoSY: 1.04, ojoBrillo: 1.15,
      bocaCurva: 0.7, bocaAncho: 0.88,
      cuerpoSX: 1.04, cuerpoSY: 0.97, cuerpoRot: 3, caraRot: 2,
      ruborOp: 1.4, ruborS: 1.15, auraOp: 1.1, auraS: 1.05,
      flota: 2.8, flotaVel: 6.8, respira: 0.02, respiraVel: 5.5,
      fxCorazon: 0.8,
    },
  },
  confusion: {
    nombre: 'Confusión', familia: 'social', intensidad: null, banda: 'apoyo',
    pista: 'No entendés qué está pasando. Está bien preguntar.',
    pose: {
      ojoSX: 1.05, ojoAbre: 0.85, ojoY: -1, ojoSep: 1,
      // Ojos desparejos: el truco más barato y más legible para "no entiendo".
      bocaCurva: -0.2, bocaAncho: 0.7, bocaOnda: 0.7, bocaX: 2.5,
      cuerpoRot: -5, cuerpoSX: 1.03, caraRot: -3, caraX: -1.5,
      chispasOp: 0.9, flota: 3.2, flotaVel: 5,
      fxEspiral: 1, parpadeoVel: 3.8,
    },
    // Asimetría explícita: solo confusión la usa.
    asimetria: { ojoAbreDer: 0.55, ojoYDer: 1.5, ojoSYDer: 0.85 },
  },

  // `satisfies` y no `:` a propósito. Con una anotación de tipo, `banda`
  // quedaría como el tipo ancho `Banda` y se perdería saber cuál es cuál;
  // con `satisfies` se comprueba la forma PERO se conservan los literales,
  // que es lo que permite derivar `EmocionApoyo` más abajo.
} satisfies Record<string, DefinicionEmocion>;

export type ClaveEmocion = keyof typeof EMOCIONES;

/**
 * Las emociones que Lumy puede adoptar por su cuenta, derivadas del catálogo.
 *
 * Este tipo es la regla de seguridad hecha comprobación de compilación. Toda
 * ruta automática hacia una emoción —el clima del gemelo, el ICVE, la reacción
 * a un turno del check-in— se tipa contra `EmocionApoyo`. Si alguien mañana
 * mapea la lluvia a `tristeza`, no falla en producción ni en la revisión: no
 * compila.
 */
export type EmocionApoyo = {
  [K in ClaveEmocion]: (typeof EMOCIONES)[K]['banda'] extends 'apoyo' ? K : never
}[ClaveEmocion];

/** Las que exigen que el estudiante las haya nombrado él mismo. */
export type EmocionEspejo = Exclude<ClaveEmocion, EmocionApoyo>;

/* ---------------------------------------------------------------------
 * Agrupaciones derivadas. Se calculan una vez, para que la UI no ande
 * filtrando el catálogo en cada render.
 * ------------------------------------------------------------------- */
export const CLAVES = Object.keys(EMOCIONES) as readonly ClaveEmocion[];

export const FAMILIAS = {
  alegria:      { nombre: 'Alegría',      opuesta: 'tristeza'  },
  confianza:    { nombre: 'Confianza',    opuesta: 'aversion'  },
  miedo:        { nombre: 'Miedo',        opuesta: 'enojo'     },
  sorpresa:     { nombre: 'Sorpresa',     opuesta: 'anticipacion' },
  tristeza:     { nombre: 'Tristeza',     opuesta: 'alegria'   },
  aversion:     { nombre: 'Rechazo',      opuesta: 'confianza' },
  enojo:        { nombre: 'Enojo',        opuesta: 'miedo'     },
  anticipacion: { nombre: 'Anticipación', opuesta: 'sorpresa'  },
  social:       { nombre: 'Sociales',     opuesta: null        },
  base:         { nombre: 'Base',         opuesta: null        },
} satisfies Record<ClaveFamilia, { nombre: string; opuesta: ClaveFamilia | null }>;

/** Las que Lumy puede adoptar por su cuenta. Ver la nota de seguridad. */
export const APOYO = CLAVES.filter(
  (c): c is EmocionApoyo => EMOCIONES[c].banda === 'apoyo',
);

/** Verificación en tiempo de ejecución, para el código que recibe una clave
 *  desde fuera (una respuesta de la API, el hash de la URL) y todavía no sabe
 *  de qué banda es. */
export function esApoyo(clave: ClaveEmocion): clave is EmocionApoyo {
  return EMOCIONES[clave].banda === 'apoyo';
}

export function esClaveEmocion(valor: unknown): valor is ClaveEmocion {
  return typeof valor === 'string' && Object.hasOwn(EMOCIONES, valor);
}

/**
 * Pose completa de una emoción: BASE + sus deltas. Devuelve un objeto nuevo
 * cada vez, así nadie muta el catálogo por accidente.
 */
export function pose(clave: ClaveEmocion): Canales {
  const e = EMOCIONES[clave];
  if (!e) throw new Error(`Lumy: no existe la emoción "${clave}"`);
  return { ...BASE, ...e.pose };
}

export function asimetria(clave: ClaveEmocion): Asimetria {
  const e = EMOCIONES[clave];
  return 'asimetria' in e ? e.asimetria : {};
}

export type Clima = 'despejado' | 'parcial' | 'nublado' | 'lluvia';

/**
 * Qué muestra Lumy según el clima del gemelo emocional.
 *
 * Ojo con el mapeo: 'lluvia' NO devuelve tristeza. Cuando al estudiante le
 * está yendo peor es justo cuando la mascota tiene que sostener, no
 * hundirse con él. Por eso lluvia → empatía y nublado → aceptación.
 *
 * El tipo `Record<Clima, EmocionApoyo>` es lo que hace que eso sea una regla
 * y no un acuerdo entre caballeros.
 */
export const POR_CLIMA: Record<Clima, EmocionApoyo> = {
  despejado: 'alegria',
  parcial:   'serenidad',
  nublado:   'aceptacion',
  lluvia:    'empatia',
};

/**
 * Igual que POR_CLIMA pero desde el ICVE crudo (0-100, más alto = más
 * vulnerable). Misma lógica: el tramo alto da acompañamiento, no espejo.
 */
export function porIcve(icve: number | null | undefined): EmocionApoyo {
  if (icve == null || !Number.isFinite(icve)) return 'neutral';
  if (icve < 25) return 'alegria';
  if (icve < 45) return 'serenidad';
  if (icve < 65) return 'aceptacion';
  return 'empatia';
}

export const VERSION = '2.0.0';
