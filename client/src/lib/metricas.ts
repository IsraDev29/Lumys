/* ===========================================================================
 * Lumys* — de la respuesta del servidor a la métrica que se dibuja
 * ---------------------------------------------------------------------------
 * Este archivo existe porque el cliente y el servidor NO hablan la misma forma,
 * y hasta ahora nadie lo notaba: los perfiles de demostración entran sin
 * autenticar, el servidor respondía 401, `conRespaldo` caía a `demo.ts` y la
 * pantalla se veía perfecta. El día que la sesión es real, `gemelo.lineaBase`
 * llega `undefined` y `LineaBase` revienta en su primer `datos.map`.
 *
 * Las diferencias que hay que salvar, una por una:
 *
 *   · `serie`  →  `lineaBase`. Mismo contenido, otro nombre.
 *   · `clima` es un objeto `{ id, titulo, mensaje, mascota }`, no una cadena.
 *   · el backend dice `tormenta` donde la mascota dice `lluvia`, y tiene un
 *     `sin_datos` que no es un clima sino la ausencia de uno.
 *   · `promedioPropio` y `mensaje` pueden venir en null: un estudiante nuevo
 *     todavía no tiene línea base.
 *   · `insignias` no existe en el servidor.
 *
 * Y las métricas que ningún endpoint calcula —el calendario de constancia, las
 * insignias, los indicadores del centro— se DERIVAN acá de datos reales
 * (`/registros`, `/alertas`, `/comunitario/radar`) en vez de salir de `demo.ts`.
 * Derivar de lo real y maquetar son cosas distintas, y la diferencia se nota en
 * que estas funciones son puras y se pueden comprobar.
 *
 * Regla del ICVE que gobierna medio archivo: la escala va de 0 a 100 y MÁS ALTO
 * es MÁS VULNERABILIDAD (ver src/Emocional/icve.service.js). En los componentes
 * sueltos es al revés: 5 es la mejor situación. Confundir los dos signos le
 * diría a un estudiante que mejoró justo el día que empeoró.
 * =========================================================================== */

import type {
  Caso, Clima, Comunitario, Contacto, DiaConstancia, Entrada, Gemelo,
  Insignia, Institucional, Ipsativa, PuntoLinea, Tendencia,
} from './tipos.ts';

/* ===========================================================================
 * Contratos reales del servidor
 *
 * Se escriben acá, y no en `tipos.ts`, a propósito: `tipos.ts` describe lo que
 * las vistas consumen. Esto describe lo que llega por el cable. Mezclarlos es
 * justo cómo se coló la divergencia que este archivo viene a arreglar.
 * ======================================================================== */

type ClimaServidor = 'despejado' | 'parcial' | 'nublado' | 'tormenta' | 'sin_datos';

type LecturaServidor = {
  componente: string;
  etiqueta: string;
  hoy: number;
  habitual: number | null;
  delta: number | null;
  tendencia: Tendencia;
  nota: string;
};

export type GemeloServidor = {
  nombre: string | null;
  clima: { id: ClimaServidor; titulo: string; mensaje: string; mascota: string };
  titular: string;
  racha: number;
  totalRegistros: number;
  checkinHoy: boolean;
  serie: { fecha: string; valor: number }[];
  promedioPropio: number | null;
  ipsativa: LecturaServidor[];
  mensaje: string | null;
};

export type RegistroServidor = {
  id: string;
  fecha: string;
  icve: number | null;
  texto: string | null;
  coach: string | null;
  etiquetas: string[];
  sentimiento: string | null;
  cobertura: number | null;
};

type RadarServidor = {
  suficiente: boolean;
  minimo: number;
  registros: number;
  clima: { id: ClimaServidor; titulo: string; mensaje: string; mascota: string };
  titular: string;
  ejes: string[];
  claves: string[];
  actual: (number | null)[] | null;
  promedio: (number | null)[] | null;
  grupos: {
    nombre: string; propia: boolean; registros: number; suficiente: boolean;
    clima: { id: ClimaServidor } | null; nota: string;
  }[];
  federado: { centro: string; aporte: string; registros: number }[];
};

/* ===========================================================================
 * Piezas compartidas
 * ======================================================================== */

const DIA = 86400000;

/** El backend tiene cinco ids de clima; la mascota entiende cuatro. */
const CLIMA_CLIENTE: Record<ClimaServidor, Clima> = {
  despejado: 'despejado',
  parcial: 'parcial',
  nublado: 'nublado',
  tormenta: 'lluvia',
  // No es un clima: es que todavía no hay con qué calcularlo. Se traduce al
  // más neutro de los cuatro y se marca aparte con `sinDatos`, para que la
  // vista pueda decir "todavía no sé cómo venís" en vez de afirmar un estado.
  sin_datos: 'parcial',
};

const aMedianoche = (f: string | Date): number => {
  const d = new Date(f);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Redondea a un decimal sin arrastrar la basura del punto flotante. */
const un = (n: number): number => Math.round(n * 10) / 10;

/* ===========================================================================
 * Gemelo
 * ======================================================================== */

export function adaptarGemelo(bruto: GemeloServidor): Gemelo {
  const idClima = bruto.clima?.id ?? 'sin_datos';

  // Sin línea base propia, el promedio del gráfico sale de la serie que sí
  // tenemos. Es peor referencia que la media móvil del servidor —no suaviza—
  // pero es real, y dibujar la línea en cero la pondría en el piso del gráfico
  // haciendo que todos los días parezcan pésimos.
  const serie = bruto.serie ?? [];
  const promedio = bruto.promedioPropio ?? (
    serie.length ? Math.round(serie.reduce((s, p) => s + p.valor, 0) / serie.length) : 0
  );

  return {
    clima: CLIMA_CLIENTE[idClima] ?? 'parcial',
    sinDatos: idClima === 'sin_datos',
    nombre: bruto.nombre ?? null,
    titular: bruto.titular ?? '',
    racha: bruto.racha ?? 0,
    totalRegistros: bruto.totalRegistros ?? serie.length,
    checkinHoy: Boolean(bruto.checkinHoy),
    mensaje: bruto.mensaje ?? bruto.clima?.mensaje ?? '',
    lineaBase: serie,
    promedioPropio: promedio,
    ipsativa: adaptarIpsativa(bruto.ipsativa ?? []),
  };
}

/* ===========================================================================
 * Lectura ipsativa
 *
 * El servidor manda el componente crudo (1 a 5) y su distancia al patrón
 * habitual del propio estudiante. Acá se convierte en las tres líneas que
 * muestra la tarjeta, sin inventar ninguna: `valor` sale de `hoy` y `delta` de
 * la resta que ya hizo el servidor.
 * ======================================================================== */

const ICONO: Record<string, { bi: string; simbolo: string }> = {
  animo: { bi: 'bi-emoji-smile', simbolo: 'mood' },
  sueno: { bi: 'bi-moon-stars', simbolo: 'bedtime' },
  energia: { bi: 'bi-battery-half', simbolo: 'battery_charging_full' },
  vinculo: { bi: 'bi-people', simbolo: 'group' },
  concentracion: { bi: 'bi-lightning-charge', simbolo: 'target' },
};

/** Un 1-5 en palabras. El número crudo no significa nada para quien lo lee. */
function enPalabras(valor: number): string {
  if (valor >= 4.5) return 'Muy alto';
  if (valor >= 3.5) return 'Alto';
  if (valor >= 2.5) return 'Medio';
  if (valor >= 1.5) return 'Bajo';
  return 'Muy bajo';
}

export function adaptarIpsativa(lecturas: LecturaServidor[]): Ipsativa[] {
  return lecturas.map((l) => {
    const icono = ICONO[l.componente] ?? { bi: 'bi-circle', simbolo: 'circle' };
    const delta = l.delta === null
      ? l.nota
      : `${l.delta > 0 ? '+' : ''}${un(l.delta)} vs. tu promedio`;

    return {
      icono: icono.bi,
      simbolo: icono.simbolo,
      etiqueta: l.etiqueta,
      valor: enPalabras(l.hoy),
      delta,
      tendencia: l.tendencia,
    };
  });
}

/* ===========================================================================
 * Historial escrito
 * ======================================================================== */

/**
 * El servidor no manda `animo`: manda el ICVE, que es de donde salía el ánimo
 * en primer lugar. Se usan los mismos cortes que `avatar.service.js` para que
 * la carita del historial y el clima del inicio no puedan contradecirse.
 */
export function adaptarEntradas(registros: RegistroServidor[]): Entrada[] {
  return registros
    .filter((r) => r.texto)
    .map((r) => ({
      fecha: r.fecha,
      animo: r.icve === null ? 'normal' : r.icve <= 25 ? 'bien' : r.icve <= 75 ? 'normal' : 'pesado',
      texto: r.texto ?? '',
      etiquetas: r.etiquetas ?? [],
    }));
}

/* ===========================================================================
 * Calendario de constancia
 *
 * Mide APARECER, nunca el ánimo, así que el nivel NO puede salir del ICVE: si
 * saliera, un día pesado se pintaría más claro que uno bueno y la cuadrícula
 * estaría premiando sentirse bien, que es justo lo que no debe hacer. Sale de
 * la cobertura — cuánto del check-in se llegó a cubrir.
 * ======================================================================== */

const DIAS_CALENDARIO = 35;

export function constanciaDesde(
  registros: RegistroServidor[],
  dias = DIAS_CALENDARIO,
): DiaConstancia[] {
  // Cobertura máxima por día: alguien puede registrar dos veces el mismo día y
  // lo que cuenta es el más completo de los dos.
  const porDia = new Map<number, number>();
  for (const r of registros) {
    const clave = aMedianoche(r.fecha);
    const cobertura = typeof r.cobertura === 'number' ? r.cobertura : 0.5;
    porDia.set(clave, Math.max(porDia.get(clave) ?? 0, cobertura));
  }

  const hoy = aMedianoche(new Date());

  return Array.from({ length: dias }, (_, i) => {
    const fecha = new Date(hoy - (dias - 1 - i) * DIA);
    const cobertura = porDia.get(fecha.getTime());

    // Nivel 0 es "no apareció". Los otros cuatro reparten la cobertura, con un
    // piso en 1: si hay registro, el día se pinta, por corto que haya sido.
    const nivel = cobertura === undefined
      ? 0
      : (Math.min(4, Math.max(1, Math.ceil(cobertura * 4))) as 1 | 2 | 3 | 4);

    return { fecha: fecha.toISOString(), nivel };
  });
}

/* ===========================================================================
 * Serie larga de la huella emocional
 *
 * El gemelo solo trae catorce días, que es lo que necesita el inicio. Para el
 * rango de 30 días la vista se inventaba los valores que le faltaban con un
 * seno sobre el nivel de constancia. Los puntajes están en el historial: se
 * leen de ahí.
 * ======================================================================== */

export function serieDesde(registros: RegistroServidor[], dias: number): PuntoLinea[] {
  const corte = aMedianoche(new Date()) - (dias - 1) * DIA;

  return registros
    .filter((r) => typeof r.icve === 'number' && aMedianoche(r.fecha) >= corte)
    .map((r) => ({ fecha: r.fecha, valor: r.icve as number }))
    .sort((a, b) => +new Date(a.fecha) - +new Date(b.fecha));
}

/* ===========================================================================
 * Insignias
 *
 * Todas se resuelven contra hechos comprobables del propio estudiante. Las que
 * dependen de algo que solo vive en el teléfono —cuántas respiraciones hizo,
 * a cuánta gente puso en su red— reciben ese dato por parámetro en vez de
 * leerlo acá, para que estas funciones sigan siendo puras.
 * ======================================================================== */

export type ProgresoLocal = { respiraciones: number; capsulas: number; contactos: number };

export function insigniasDesde(gemelo: Gemelo, local: ProgresoLocal): Insignia[] {
  return [
    { nombre: 'Primera vez', icono: 'bi-flag', detalle: 'Tu primer check-in',
      obtenida: gemelo.totalRegistros >= 1 },
    { nombre: 'Siete seguidos', icono: 'bi-calendar-check', detalle: 'Una semana completa',
      obtenida: gemelo.racha >= 7 },
    { nombre: 'Respiro', icono: 'bi-wind', detalle: '5 ejercicios de respiración',
      obtenida: local.respiraciones >= 5 },
    { nombre: 'Red armada', icono: 'bi-diagram-3', detalle: 'Definí a 3 personas de confianza',
      obtenida: local.contactos >= 3 },
    { nombre: 'Un mes', icono: 'bi-award', detalle: '30 días de constancia',
      obtenida: gemelo.racha >= 30 },
    { nombre: 'Cápsulas', icono: 'bi-collection-play', detalle: 'Viste 10 cápsulas semanales',
      obtenida: local.capsulas >= 10 },
  ];
}

/** Cuántas personas de confianza tiene realmente activas. */
export const contactosActivos = (red: Contacto[]): number =>
  red.filter((c) => !c.excluido).length;

/* ===========================================================================
 * Gemelo comunitario
 * ======================================================================== */

/**
 * El radar dibuja los vértices como porcentaje del radio, pero el servidor
 * manda promedios de componente en escala 1-5. Sin convertir, un centro con
 * ánimo 4 se dibujaba al 4% del radio: el polígono colapsaba a un punto en el
 * centro y parecía que el colegio entero estaba en cero.
 */
const aPorcentaje = (valores: (number | null)[] | null, ejes: number): number[] =>
  Array.from({ length: ejes }, (_, i) => {
    const v = valores?.[i];
    if (typeof v !== 'number') return 0;
    return Math.round(((v - 1) / 4) * 100);
  });

export function adaptarComunitario(bruto: RadarServidor): Comunitario {
  const ejes = bruto.ejes ?? [];

  return {
    clima: CLIMA_CLIENTE[bruto.clima?.id ?? 'sin_datos'] ?? 'parcial',
    titular: bruto.titular ?? '',
    suficiente: bruto.suficiente,
    minimo: bruto.minimo,
    registros: bruto.registros,
    radar: {
      ejes,
      actual: aPorcentaje(bruto.actual, ejes.length),
      promedio: aPorcentaje(bruto.promedio, ejes.length),
    },
    grupos: (bruto.grupos ?? []).map((g) => ({
      nombre: g.nombre,
      // Por debajo del umbral el servidor manda `clima: null`. Eso no es un
      // clima desconocido: es la negativa deliberada a promediar un grupo tan
      // chico que el promedio identificaría a sus miembros.
      clima: g.clima ? (CLIMA_CLIENTE[g.clima.id] ?? 'parcial') : 'oculto',
      registros: g.registros,
      nota: g.nota,
    })),
    federado: (bruto.federado ?? []).map((f) => ({
      centro: f.centro,
      icve: f.aporte,
      registros: f.registros,
    })),
  };
}

/* ===========================================================================
 * Indicadores del centro
 *
 * No hay endpoint que los calcule, así que se derivan de las alertas reales y
 * del radar. Lo que NO se puede derivar se devuelve vacío y la vista lo dice:
 * el esquema no guarda grado ni sección (ver federado.service.js), así que la
 * participación por grado no existe. Rellenarla con números plausibles sería
 * exactamente el problema que este archivo vino a resolver.
 * ======================================================================== */

export function institucionalDesde(casos: Caso[], radar: Comunitario | null): Institucional {
  const porNivel = (n: number) => casos.filter((c) => c.nivel === n).length;
  const abiertos = casos.filter((c) => c.estado !== 'cerrado');

  // Cuánto lleva esperando la señal más vieja sin atender. Es el indicador que
  // de verdad le importa a una dirección: no cuántas alertas hay, sino cuánto
  // tarda una en llegar a una conversación.
  const esperas = abiertos.map((c) => Math.floor((Date.now() - new Date(c.desde).getTime()) / DIA));
  const esperaMax = esperas.length ? Math.max(...esperas) : 0;

  const registros = radar?.registros ?? 0;
  const maxNivel = Math.max(porNivel(1), porNivel(2), porNivel(3), 1);

  return {
    derivado: true,
    kpis: [
      { valor: registros, etiqueta: 'Check-ins del último mes', delta: 'en todo el centro', tipo: 'up' },
      { valor: abiertos.length, etiqueta: 'Señales sin atender', delta: `${casos.length} en total`, tipo: abiertos.length ? 'down' : 'up' },
      { valor: esperaMax, etiqueta: 'Días de la señal más antigua', delta: 'sin conversación todavía', tipo: esperaMax > 7 ? 'down' : 'up' },
      { valor: porNivel(3), etiqueta: 'Señales de nivel 3', delta: 'derivación inmediata', tipo: porNivel(3) ? 'down' : 'up' },
    ],
    niveles: [
      { etiqueta: 'Nivel 1 · Conversar', valor: porNivel(1), max: maxNivel },
      { etiqueta: 'Nivel 2 · Acompañar', valor: porNivel(2), max: maxNivel },
      { etiqueta: 'Nivel 3 · Derivar', valor: porNivel(3), max: maxNivel },
    ],
    // El esquema no tiene grado ni sección. Vacío y honesto.
    grados: [],
    cierre: [
      { etiqueta: 'Casos cerrados', valor: casos.filter((c) => c.estado === 'cerrado').length },
      { etiqueta: 'Casos activos', valor: abiertos.length },
      { etiqueta: 'Grupos con datos suficientes', valor: (radar?.grupos ?? []).filter((g) => g.clima !== 'oculto').length },
    ],
  };
}
