/* ===========================================================================
 * Lumys* — formato y vocabulario de dominio
 * ---------------------------------------------------------------------------
 * Lo que quedó de utils.js una vez que React se hizo cargo del DOM. `qs`,
 * `qsa` y `el` desaparecieron porque JSX es exactamente eso; `escape` también,
 * porque React escapa el texto por defecto y dejar la función invitaría a
 * escapar dos veces.
 * =========================================================================== */

/* --- Fechas en español nicaragüense ------------------------------------- */

export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const DIAS_CORTO = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export const capitalizar = (s = ''): string => s.charAt(0).toUpperCase() + s.slice(1);

export type Fecha = string | number | Date;

export function fechaLarga(fecha: Fecha = new Date()): string {
  const d = new Date(fecha);
  return `${capitalizar(DIAS[d.getDay()] ?? '')} ${d.getDate()} de ${MESES[d.getMonth()] ?? ''}`;
}

export function fechaCorta(fecha: Fecha = new Date()): string {
  const d = new Date(fecha);
  return `${d.getDate()} ${(MESES[d.getMonth()] ?? '').slice(0, 3)}`;
}

export function diaCorto(fecha: Fecha = new Date()): string {
  return DIAS_CORTO[new Date(fecha).getDay()] ?? '';
}

/** "hace 3 días", "ayer", "hoy" — lenguaje cercano, nunca técnico. */
export function haceCuanto(fecha: Fecha): string {
  const dias = Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 7) return `hace ${dias} días`;
  if (dias < 30) return `hace ${Math.floor(dias / 7)} semana${dias >= 14 ? 's' : ''}`;
  return `hace ${Math.floor(dias / 30)} mes${dias >= 60 ? 'es' : ''}`;
}

export const saludo = (): string => {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
};

export const iniciales = (nombre = ''): string =>
  nombre.trim().split(/\s+/).slice(0, 2).map((p) => p[0] ?? '').join('').toUpperCase();

/* --- Movimiento ---------------------------------------------------------- */

export const reduceMotion = (): boolean =>
  typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const espera = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, reduceMotion() ? Math.min(ms, 60) : ms));

/* --- Vocabulario de dominio ---------------------------------------------- */

export type Nivel = 1 | 2 | 3;

export const NIVELES: Record<Nivel, { nombre: string; descripcion: string }> = {
  1: { nombre: 'Conversar', descripcion: 'Cambio leve pero sostenido. El orientador busca al estudiante para hablar.' },
  2: { nombre: 'Acompañar', descripcion: 'Cambio claro o varias señales juntas. Seguimiento estructurado y revisión con el psicólogo.' },
  3: { nombre: 'Derivar', descripcion: 'Señales de riesgo importante. Derivación clínica y evaluación de seguridad del receptor.' },
};

/** Los cuatro climas del gemelo. Coinciden con `Clima` de lumy/emociones.ts,
 *  que es lo que permite mapear clima → emoción sin una tabla de traducción. */
export const CLIMAS = {
  despejado: { titulo: 'Despejado', sub: 'Mejor que tu semana normal' },
  parcial: { titulo: 'Parcialmente despejado', sub: 'Muy parecido a tu semana normal' },
  nublado: { titulo: 'Nublado, pero estable', sub: 'Parecido a tu semana normal' },
  lluvia: { titulo: 'Con lluvia', sub: 'Más pesado que tu semana normal' },
};
