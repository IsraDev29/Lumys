/* ========================================================================
   Lumys* — conjunto de datos de demostración

   El backend expone hoy /api/v1/auth y parte de los demás módulos; el resto
   está en construcción. Cuando un endpoint todavía no responde, la interfaz
   cae acá para que la aplicación completa sea navegable (requisito del video
   de ejecución del hackathon).

   Vive separado del cliente de la API a propósito: así se ve de un vistazo
   cuánto de lo que se muestra en pantalla es real y cuánto es maqueta, y el
   día que un endpoint entre en producción se borra su entrada de este archivo
   y nada más.
   ======================================================================== */

import type { RegistroServidor } from './metricas.ts';
import type {
  Capsula, Caso, Comunitario, Contacto, Gemelo,
  Institucional, Ipsativa, Perfil, Supervision, Usuario,
} from './tipos.ts';

const hoy = new Date();
const diasAtras = (n: number): string => new Date(hoy.getTime() - n * 86400000).toISOString();

export const PERFILES: Record<Perfil, Usuario> = {
  estudiante: { id: 'u-001', nombre: 'Kevin Ortega', perfil: 'estudiante', rol: 'USUARIO', grado: '9no B', centro: 'Instituto Nacional Rubén Darío' },
  orientador: { id: 'u-020', nombre: 'Karla Mendoza', perfil: 'orientador', rol: 'USUARIO', centro: 'Instituto Nacional Rubén Darío' },
  psicologo: { id: 'u-030', nombre: 'Dr. Elías Sequeira', perfil: 'psicologo', rol: 'USUARIO', centro: 'Red de apoyo distrital' },
  admin: { id: 'u-040', nombre: 'Equipo Lumys', perfil: 'admin', rol: 'ADMIN', centro: 'Auditoría del sistema' },
};

/* --- Estudiante ------------------------------------------------------ */

export const IPSATIVA: Ipsativa[] = [
  { icono: 'bi-moon-stars', simbolo: 'bedtime', etiqueta: 'Sueño', valor: 'Bajo', delta: '−1.2 vs. tu promedio', tendencia: 'baja' },
  { icono: 'bi-battery-half', simbolo: 'battery_charging_full', etiqueta: 'Energía', valor: 'Medio', delta: 'Igual que tu promedio', tendencia: 'igual' },
  { icono: 'bi-people', simbolo: 'group', etiqueta: 'Tiempo con gente', valor: 'Bajo', delta: '−1.5 vs. tu promedio', tendencia: 'baja' },
  { icono: 'bi-lightning-charge', simbolo: 'target', etiqueta: 'Concentración', valor: 'Medio', delta: '+1.1 vs. tu promedio', tendencia: 'sube' },
];

export const GEMELO: Gemelo = {
  clima: 'nublado',
  sinDatos: false,
  nombre: 'Kevin',
  titular: 'Hoy pesa un poco más que tu promedio de las últimas semanas.',
  racha: 12,
  totalRegistros: 24,
  checkinHoy: false,
  demo: true,
  mensaje: 'Llevas doce días seguidos apareciendo. Eso ya es constancia.',
  ipsativa: IPSATIVA,
  // Escala del ICVE: 0-100, más alto es más carga. Por eso el día de hoy en 42
  // contra un promedio de 72 es una buena noticia, no una mala.
  lineaBase: [
    { fecha: diasAtras(6), valor: 64 },
    { fecha: diasAtras(5), valor: 83 },
    { fecha: diasAtras(4), valor: 53 },
    { fecha: diasAtras(3), valor: 100 },
    { fecha: diasAtras(2), valor: 76 },
    { fecha: diasAtras(1), valor: 89 },
    { fecha: diasAtras(0), valor: 42 },
  ],
  promedioPropio: 72,
};

/**
 * El historial, con la forma exacta que devuelve `GET /registros`.
 *
 * Es la única fuente de la maqueta para el estudiante: de acá salen el texto
 * escrito, el calendario de constancia y las insignias, por las mismas
 * funciones de `metricas.ts` que procesan los datos reales. Antes cada una
 * tenía su propia constante y se contradecían entre sí —el gemelo declaraba
 * una racha de doce días mientras el calendario, generado con un seno, dejaba
 * huecos en esos mismos doce días—. Con una sola fuente eso no puede pasar, y
 * además el camino de la demo ejercita el mismo código que el de producción.
 *
 * Los últimos doce días están completos, que es lo que sostiene la racha.
 */
const TEXTOS: { dia: number; texto: string; etiquetas: string[] }[] = [
  { dia: 0, texto: 'Hoy me costó levantarme. No pasó nada malo, solo no tenía ganas.', etiquetas: ['sueño corto', 'poca energía'] },
  { dia: 1, texto: 'Salí a jugar con los del barrio. Estuvo tranquilo.', etiquetas: ['tiempo con gente'] },
  { dia: 2, texto: 'Discutí con mi mamá por lo del colegio. Ya se pasó.', etiquetas: ['tensión en casa'] },
  { dia: 4, texto: 'Me fue bien en el examen de mate. No me lo esperaba.', etiquetas: ['logro'] },
];

export const REGISTROS: RegistroServidor[] = [
  // Doce días seguidos hasta hoy.
  ...Array.from({ length: 12 }, (_, dia) => dia),
  // Antes de eso, aparecía casi todos los días pero no todos.
  ...[13, 14, 15, 17, 18, 19, 21, 22, 24, 25, 26, 28, 30, 31, 33],
].map((dia) => {
  const escrito = TEXTOS.find((t) => t.dia === dia);
  return {
    id: `r-${dia}`,
    fecha: diasAtras(dia),
    // Escala del ICVE: más alto es más carga.
    icve: [42, 89, 76, 100, 53, 83, 64, 71, 58, 66, 74, 61][dia % 12] ?? 60,
    texto: escrito?.texto ?? null,
    coach: null,
    etiquetas: escrito?.etiquetas ?? [],
    sentimiento: null,
    // Los días con texto son check-ins completos; el resto, más cortos.
    cobertura: escrito ? 1 : [0.4, 0.6, 0.8, 1][dia % 4] ?? 0.6,
  };
});

export const RED_APOYO: Contacto[] = [
  { id: 'c1', nombre: 'Doña Marta Ortega', relacion: 'Mamá', orden: 1, excluido: false, canal: 'WhatsApp' },
  { id: 'c2', nombre: 'Prof. Karla Mendoza', relacion: 'Orientadora del colegio', orden: 2, excluido: false, canal: 'Sistema' },
  { id: 'c3', nombre: 'Tío Bayardo', relacion: 'Tío / entrenador de fútbol', orden: 3, excluido: false, canal: 'WhatsApp' },
  { id: 'c4', nombre: 'Papá', relacion: 'Papá', orden: 4, excluido: true, canal: '—' },
];

export const CAPSULAS: Capsula[] = [
  { titulo: 'Dormir poco te cambia el día entero', tag: 'Esta semana', duracion: '45 s', tono: 'frio' },
  { titulo: 'Cómo se le dice a alguien que no estás bien', tag: 'Conversar', duracion: '1 min', tono: 'frio' },
  { titulo: 'Aburrirse también es parte de crecer', tag: 'Sin drama', duracion: '38 s', tono: 'calido' },
  { titulo: 'Cuando un amigo te cuenta algo pesado', tag: 'Entre pares', duracion: '55 s', tono: 'frio' },
];

/* --- Orientador ------------------------------------------------------ */

export const CASOS: Caso[] = [
  {
    id: 'CS-114', alias: 'Estudiante · 9no B', nivel: 1, estado: 'abierto', desde: diasAtras(2),
    señales: ['Menos tareas entregadas que lo habitual', 'Dejó el equipo de fútbol', 'Check-ins más cortos'],
    semanas: 3, ultimoContacto: diasAtras(2), responsable: 'Karla Mendoza',
    linea: [
      { t: diasAtras(2), texto: 'Señal detectada. Cambio sostenido 3 semanas.', tipo: 'sistema' },
      { t: diasAtras(1), texto: 'Karla busca al estudiante para conversar.', tipo: 'accion' },
    ],
  },
  {
    id: 'CS-108', alias: 'Estudiante · 10mo A', nivel: 2, estado: 'seguimiento', desde: diasAtras(9),
    señales: ['Autorreporte más bajo que su promedio', 'Dos rachas de evasión', 'Tono del texto más plano'],
    semanas: 4, ultimoContacto: diasAtras(1), responsable: 'Karla Mendoza',
    linea: [
      { t: diasAtras(9), texto: 'Señal detectada. Dos componentes coinciden.', tipo: 'sistema' },
      { t: diasAtras(7), texto: 'Primera conversación. Plan de seguimiento abierto.', tipo: 'accion' },
      { t: diasAtras(3), texto: 'Revisión con el psicólogo. Se mantiene en Nivel 2.', tipo: 'accion' },
      { t: diasAtras(1), texto: 'Segunda conversación. Reporta dormir mejor.', tipo: 'accion' },
    ],
  },
  {
    id: 'CS-097', alias: 'Estudiante · 11mo B', nivel: 3, estado: 'derivado', desde: diasAtras(16),
    señales: ['Lenguaje de riesgo explícito en texto libre', 'Evaluación de seguridad del receptor completada'],
    semanas: 2, ultimoContacto: diasAtras(4), responsable: 'Dr. Elías Sequeira',
    linea: [
      { t: diasAtras(16), texto: 'Derivación inmediata activada, sin esperar sostenimiento.', tipo: 'alerta' },
      { t: diasAtras(15), texto: 'Contacto con receptor seguro verificado.', tipo: 'accion' },
      { t: diasAtras(9), texto: 'Confirmación a 7 días: la atención ocurrió.', tipo: 'accion' },
    ],
  },
  {
    id: 'CS-090', alias: 'Estudiante · 8vo A', nivel: 1, estado: 'cerrado', desde: diasAtras(38),
    señales: ['Cambio leve sostenido, ya recuperado'],
    semanas: 3, ultimoContacto: diasAtras(12), responsable: 'Karla Mendoza',
    linea: [
      { t: diasAtras(38), texto: 'Señal detectada.', tipo: 'sistema' },
      { t: diasAtras(12), texto: 'Alta explícita. El estudiante ya no necesita seguimiento.', tipo: 'accion' },
    ],
  },
];

export const SUPERVISION: Supervision[] = [
  { caso: 'CS-108', pregunta: '¿Se sostiene en Nivel 2 o baja a Nivel 1?', desde: diasAtras(3), orientador: 'Karla Mendoza' },
  { caso: 'CS-097', pregunta: 'Confirmación de atención a 30 días pendiente.', desde: diasAtras(2), orientador: 'Karla Mendoza' },
];

/* --- Institución / auditoría ----------------------------------------- */

export const INSTITUCIONAL: Institucional = {
  derivado: false,
  demo: true,
  kpis: [
    { valor: 214, etiqueta: 'Estudiantes con cuenta activa', delta: '+18 este mes', tipo: 'up' },
    { valor: 78, etiqueta: '% de check-ins completados', delta: 'meta: 70%', tipo: 'up', sufijo: '%' },
    { valor: 3, etiqueta: 'Días de la señal a la conversación', delta: 'antes: 11 días', tipo: 'up' },
    { valor: 86, etiqueta: '% de derivaciones confirmadas', delta: 'a los 7 y 30 días', tipo: 'up', sufijo: '%' },
  ],
  niveles: [
    { etiqueta: 'Nivel 1 · Conversar', valor: 9, max: 14 },
    { etiqueta: 'Nivel 2 · Acompañar', valor: 4, max: 14 },
    { etiqueta: 'Nivel 3 · Derivar', valor: 1, max: 14 },
  ],
  grados: [
    { etiqueta: '7mo grado', participacion: 71 },
    { etiqueta: '8vo grado', participacion: 84 },
    { etiqueta: '9no grado', participacion: 79 },
    { etiqueta: '10mo grado', participacion: 66 },
    { etiqueta: '11mo grado', participacion: 58 },
  ],
  cierre: [
    { etiqueta: 'Casos cerrados con alta', valor: 12 },
    { etiqueta: 'Casos activos', valor: 14 },
    { etiqueta: 'Horas protegidas del orientador', valor: 8 },
  ],
};

/* --- Gemelo digital comunitario --------------------------------------- */

export const COMUNITARIO: Comunitario = {
  clima: 'parcial',
  titular: 'El clima del centro se parece a su propio promedio de marzo',
  suficiente: true,
  minimo: 10,
  registros: 111,
  demo: true,
  radar: {
    ejes: ['Sueño', 'Energía', 'Concentración', 'Apoyo social', 'Ánimo', 'Constancia'],
    promedio: [62, 58, 60, 70, 61, 74],
    actual: [54, 55, 58, 72, 57, 81],
  },
  grupos: [
    { nombre: '7mo A', clima: 'despejado', registros: 28, nota: 'Estable respecto a su propio promedio' },
    { nombre: '8vo B', clima: 'parcial', registros: 31, nota: 'Ligero cambio en constancia' },
    { nombre: '9no B', clima: 'nublado', registros: 26, nota: 'Menos participación esta semana' },
    { nombre: '10mo A', clima: 'parcial', registros: 22, nota: 'Estable' },
    { nombre: '11mo C', clima: 'oculto', registros: 4, nota: 'Menos de 10 registros: no se muestra' },
  ],
  federado: [
    { centro: 'Centro A · este colegio', icve: 'Línea base propia', registros: 1180 },
    { centro: 'Centro B', icve: 'Solo parámetros agregados', registros: 940 },
    { centro: 'Centro C', icve: 'Solo parámetros agregados', registros: 610 },
  ],
};
