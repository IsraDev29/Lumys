/* ===========================================================================
 * Lumys* — tipos del dominio
 * ---------------------------------------------------------------------------
 * Describen lo que viaja entre el backend y las vistas. Se escriben acá una
 * sola vez para que el respaldo de demostración y la respuesta real del
 * servidor no puedan divergir en silencio: si el backend cambia una forma, el
 * `demo.ts` deja de compilar.
 * =========================================================================== */

import type { Clima } from '../lumy/emociones.ts';
import type { Nivel } from './formato.ts';

export type { Clima, Nivel };

export type Perfil = 'estudiante' | 'orientador' | 'psicologo' | 'admin';

export type Usuario = {
  id: string;
  nombre: string;
  perfil: Perfil;
  rol: 'USUARIO' | 'ADMIN';
  centro: string;
  grado?: string;
};

/* --- Estudiante ---------------------------------------------------------- */

export type PuntoLinea = { fecha: string; valor: number };

export type Gemelo = {
  clima: Clima;
  /** No hay todavía con qué calcular un clima. `clima` trae el más neutro para
   *  que la mascota tenga algo que dibujar, pero la vista tiene que decir que
   *  no sabe en vez de afirmar un estado sobre alguien que recién llega. */
  sinDatos: boolean;
  nombre: string | null;
  /** La frase que compara el día de hoy contra el propio promedio. */
  titular: string;
  racha: number;
  totalRegistros: number;
  checkinHoy: boolean;
  mensaje: string;
  /** Los últimos días, comparados contra el promedio del propio estudiante.
   *  Nunca contra el de otros: la medida es ipsativa. */
  lineaBase: PuntoLinea[];
  promedioPropio: number;
  ipsativa: Ipsativa[];
  /** Los datos son de maqueta porque el servidor no respondió. */
  demo?: boolean;
};

export type Tendencia = 'baja' | 'igual' | 'sube';

export type Ipsativa = {
  /** Bootstrap Icons, para las vistas que todavía no se portaron. */
  icono: string;
  /** Ligadura de Material Symbols, que es lo que usan las pantallas de Stitch. */
  simbolo: string;
  etiqueta: string;
  valor: string;
  delta: string;
  tendencia: Tendencia;
};

export type Animo = 'pesado' | 'normal' | 'bien';

export type Entrada = {
  fecha: string;
  animo: Animo;
  texto: string;
  etiquetas: string[];
};

export type DiaConstancia = { fecha: string; nivel: 0 | 1 | 2 | 3 | 4 };

export type Insignia = { nombre: string; icono: string; obtenida: boolean; detalle: string };

export type Contacto = {
  id: string;
  nombre: string;
  relacion: string;
  orden: number;
  excluido: boolean;
  canal: string;
};

/**
 * Cómo quiere el estudiante que lo acompañen.
 *
 *   `personal`  Una lista de gente suya —la mamá, un tío, una entrenadora—.
 *               Quien recibe el aviso tiene nombre y cara.
 *   `anonima`   El equipo de Lumys, que no sabe quién es. Nadie de su entorno
 *               se entera. Es la salida para quien no tiene un adulto de
 *               confianza a mano y, sobre todo, para quien su propia casa es
 *               el problema.
 *
 * En los dos casos los canales oficiales —MIFAN 133 y Policía Nacional 118—
 * siguen disponibles. No son parte de la elección: son el piso que no se puede
 * quitar, y por eso no viven en este tipo sino en CANALES_OFICIALES.
 */
export type ModoRed = 'personal' | 'anonima';

export type Capsula = { titulo: string; tag: string; duracion: string; tono: 'frio' | 'calido' };

/* --- Acompañamiento ------------------------------------------------------ */

export type EstadoCaso = 'abierto' | 'seguimiento' | 'derivado' | 'cerrado';
export type HitoTipo = 'sistema' | 'accion' | 'alerta';

export type Caso = {
  id: string;
  alias: string;
  nivel: Nivel;
  estado: EstadoCaso;
  desde: string;
  señales: string[];
  semanas: number;
  /** Null mientras la señal no tenga caso: todavía no hay contacto ni
   *  responsable asignado, y el servidor lo manda explícito en vez de
   *  omitirlo para que el tablero no tenga que adivinar. */
  ultimoContacto: string | null;
  responsable: string | null;
  linea: { t: string; texto: string; tipo: HitoTipo }[];

  /* --- Explicabilidad --------------------------------------------------
   * Lo que `GET /alertas` ya devolvía y el cliente tiraba a la basura por no
   * tenerlo en el tipo. Es lo que convierte el tablero en algo defendible:
   * cuando alguien pregunte por qué se abrió este caso, la respuesta son
   * estos números y no la memoria de nadie. Opcionales porque el respaldo de
   * demostración no los trae. */
  motivo?: string | null;
  /** Qué componentes se movieron y cuánto respecto a lo habitual de ESE
   *  estudiante. Escala 1-5, donde 5 es la mejor situación. */
  componentes?: {
    componente: string;
    habitual: number;
    hoy: number;
    delta: number;
    direccion: 'empeora' | 'mejora';
  }[];
  icve?: number | null;
  lineaBase?: number | null;
  deltaIcve?: number | null;
  riesgoExplicito?: boolean;
  /** Paráfrasis del análisis. Nunca el texto literal del estudiante. */
  nota?: string | null;
  factores?: Factor[];
  senalId?: number;
};

export type Supervision = { caso: string; pregunta: string; desde: string; orientador: string };

/* --- Institución --------------------------------------------------------- */

export type Kpi = { valor: number; etiqueta: string; delta: string; tipo: 'up' | 'down'; sufijo?: string };

export type Institucional = {
  /** Los indicadores se derivaron de las alertas y del radar reales, no de un
   *  endpoint propio. La vista lo dice, porque el alcance es más estrecho que
   *  el de un tablero completo. */
  derivado: boolean;
  kpis: Kpi[];
  niveles: { etiqueta: string; valor: number; max: number }[];
  /** Vacío mientras el esquema no guarde grado ni sección: la participación
   *  por grado no se puede calcular y no se inventa. */
  grados: { etiqueta: string; participacion: number }[];
  cierre: { etiqueta: string; valor: number }[];
  demo?: boolean;
};

/* --- Gemelo comunitario --------------------------------------------------- */

/** 'oculto' no es un clima: es lo que se muestra cuando un grupo tiene menos
 *  de diez registros. Con menos, el agregado deja de ser anónimo. */
export type ClimaGrupo = Clima | 'oculto';

export type Comunitario = {
  clima: Clima;
  titular: string;
  /** Si el centro llegó al mínimo de registros para que un promedio no
   *  identifique a nadie. Por debajo, el radar no se dibuja. */
  suficiente: boolean;
  minimo: number;
  registros: number;
  /** Los valores del radar vienen normalizados a 0-100. El servidor los manda
   *  en la escala 1-5 de los componentes; la conversión vive en metricas.ts. */
  radar: { ejes: string[]; promedio: number[]; actual: number[] };
  grupos: { nombre: string; clima: ClimaGrupo; registros: number; nota: string }[];
  federado: { centro: string; icve: string; registros: number }[];
  demo?: boolean;
};

/* --- Check-in conversacional ---------------------------------------------- */

export type Componente = 'animo' | 'sueno' | 'energia' | 'vinculo' | 'concentracion' | 'libre';
export type FormatoTurno = 'opciones' | 'escala' | 'texto';

export type OpcionTurno = { emoji: string; etiqueta: string; valor: number };

export type Turno = {
  reaccion: string;
  pregunta: string;
  componente: Componente;
  formato: FormatoTurno;
  opciones: OpcionTurno[];
  cierre: boolean;
  /** `false` significa que la pregunta salió del banco local y no del modelo.
   *  Es el dato que delata que la clave de IA se quedó sin saldo. */
  generado: boolean;
  turno: number;
  /** La racha llega con cada turno, calculada en el servidor sobre los
   *  check-ins guardados. */
  racha?: number;
};

/** Lo que el estudiante respondió en un turno, tal como se manda al cierre. */
export type RespuestaTurno = {
  componente: Componente;
  pregunta: string;
  respuesta: string;
  valor?: number;
};

/** Por qué el sistema leyó el día así. Es la parte explicable del ICVE: sin
 *  esto el estudiante ve un número que sube y baja sin motivo. */
export type Factor = { factor: string; direccion: 'protege' | 'riesgo' };

export type Cierre = {
  coach: string;
  factores: Factor[];
  contencion: string | null;
  /** La racha calculada en el servidor sobre los check-ins guardados. No se
   *  cuenta en el cliente para que no dependa del reloj del teléfono. */
  racha?: number;
  /** El registro quedó en la cola de IndexedDB y se enviará al volver la señal. */
  pendiente?: boolean;
  demo?: boolean;
};
