/* ==========================================================================
   Lumys* — Cliente de la API

   Cada llamada intenta primero el servidor real y, si el endpoint todavía no
   responde, usa el conjunto de datos de demostración (lib/demo.ts) para que la
   interfaz completa sea navegable.

   En desarrollo el proxy de Vite manda `/api/v1/...` al Express del puerto
   5000, así que la ruta es la misma que en producción y no hay una rama
   "si estamos en dev, la URL es otra".
   ========================================================================== */

import * as almacen from './almacen.ts';
import { guardarParaDespues } from './pwa.ts';
import type { Prosodia } from './voz.ts';
import * as DEMO from './demo.ts';
import * as metricas from './metricas.ts';
import * as progreso from './progreso.ts';
import type {
  Capsula, Caso, Cierre, Comunitario, Contacto, DiaConstancia, Entrada,
  Gemelo, Insignia, Institucional, Ipsativa, ModoRed, Componente, OpcionTurno,
  PuntoLinea, RespuestaTurno, Supervision, Turno, Usuario,
} from './tipos.ts';

const BASE = '/api/v1';
const TIMEOUT = 6000;

/* --- Sesión -------------------------------------------------------------- */

export const token = {
  get: (): string | null => almacen.leer<string | null>('token', null),
  set: (t: string) => almacen.guardar('token', t),
  clear: () => almacen.borrar('token'),
};

/* --- Transporte ---------------------------------------------------------- */

export class ErrorApi extends Error {
  status: number;
  datos: unknown;
  constructor(mensaje: string, status: number, datos: unknown) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.status = status;
    this.datos = datos;
  }
}

type Opciones = {
  metodo?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  cuerpo?: unknown;
  auth?: boolean;
};

async function request<T>(ruta: string, { metodo = 'GET', cuerpo, auth = true }: Opciones = {}): Promise<T> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), TIMEOUT);
  const t = token.get();
  try {
    const res = await fetch(`${BASE}${ruta}`, {
      method: metodo,
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(auth && t ? { Authorization: `Bearer ${t}` } : {}),
      },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    const datos = await res.json().catch(() => ({})) as { error?: string };
    if (!res.ok) throw new ErrorApi(datos.error || 'Error de servidor', res.status, datos);
    return datos as T;
  } finally {
    clearTimeout(id);
  }
}

// Errores que sí vienen del negocio y deben mostrarse al usuario.
// Un 404 significa "este módulo todavía no existe": ahí sí usamos el respaldo.
const ERRORES_REALES = [400, 401, 403, 409, 422];

/**
 * Un 401 significa dos cosas muy distintas según si mandamos credenciales.
 *
 *   Con token   → el servidor rechazó ESTA sesión. Es un error real y hay que
 *                 mostrarlo: la sesión venció o el token no vale.
 *   Sin token   → no estamos autenticados y nunca dijimos serlo. No es que el
 *                 servidor rechazara algo; es que el recurso pide login.
 *
 * La distinción importa porque los perfiles de demostración entran sin
 * autenticar. Tratando todo 401 como error de negocio, el respaldo local nunca
 * se activaba y el recorrido completo quedaba en la pantalla de error — que es
 * exactamente lo que el respaldo existe para evitar.
 */
const esDeNegocio = (err: unknown): boolean => {
  if (!(err instanceof ErrorApi)) return false;
  if (err.status === 401 && !token.get()) return false;
  return ERRORES_REALES.includes(err.status);
};

/** Intenta el servidor; si no está disponible, resuelve con datos locales. */
async function conRespaldo<T>(promesa: () => Promise<T>, respaldo: () => T): Promise<T> {
  try {
    return await promesa();
  } catch (err) {
    if (esDeNegocio(err)) throw err;
    return respaldo();
  }
}

/**
 * Igual que `conRespaldo`, pero cae al respaldo pase lo que pase — incluido
 * un 401 por sesión de demostración.
 *
 * Solo para el check-in. Es el único flujo donde propagar el error significa
 * dejar al estudiante con una conversación cortada a la mitad, y eso pesa
 * más que mostrarle el mensaje de error exacto.
 */
async function conRespaldoSiempre<T>(promesa: () => Promise<T>, respaldo: () => T): Promise<T> {
  try {
    return await promesa();
  } catch (err) {
    console.warn('[API] check-in en modo local:', err instanceof ErrorApi ? err.status : err);
    return respaldo();
  }
}

/* ========================================================================
   Respaldo del check-in conversacional

   Solo se usa cuando el backend no responde. No es un guion fijo: es un banco
   por componente del que se elige al azar, así que dos sesiones seguidas no
   traen las mismas preguntas. Peor que el modelo, pero no se siente un
   formulario.
   ======================================================================== */

type PreguntaLocal = {
  pregunta: string;
  formato?: 'escala' | 'texto';
  opciones?: OpcionTurno[];
};

const BANCO_LOCAL: Record<Componente, PreguntaLocal[]> = {
  animo: [
    { pregunta: '¿Qué fue lo último que te hizo reír, aunque haya sido una tontera?',
      opciones: [{ emoji: '😄', etiqueta: 'Algo bueno', valor: 5 }, { emoji: '🙃', etiqueta: 'Nada hoy', valor: 2 }, { emoji: '🤔', etiqueta: 'No me acuerdo', valor: 3 }] },
    { pregunta: 'Si ayer hubiera sido una canción, ¿iba rápida o lenta?',
      opciones: [{ emoji: '⚡', etiqueta: 'Rápida', valor: 4 }, { emoji: '🎧', etiqueta: 'Tranquila', valor: 4 }, { emoji: '🐢', etiqueta: 'Lenta', valor: 2 }] },
  ],
  sueno: [
    { pregunta: '¿Anoche te dormiste de una o le diste vueltas al asunto?',
      opciones: [{ emoji: '😴', etiqueta: 'De una', valor: 5 }, { emoji: '🌙', etiqueta: 'Me costó', valor: 3 }, { emoji: '👀', etiqueta: 'Casi nada', valor: 1 }] },
    { pregunta: 'Cuando sonó la alarma hoy, ¿te levantaste o le diste posponer?',
      opciones: [{ emoji: '☀️', etiqueta: 'Me levanté', valor: 5 }, { emoji: '⏰', etiqueta: 'Un ratito más', valor: 3 }, { emoji: '🛏️', etiqueta: 'No quería', valor: 2 }] },
  ],
  energia: [
    { pregunta: 'Del 1 al 5, ¿cuánta batería traés hoy comparado con tu semana normal?', formato: 'escala' },
  ],
  vinculo: [
    { pregunta: '¿Con quién hablaste ayer que no fuera por obligación?',
      opciones: [{ emoji: '👥', etiqueta: 'Con varios', valor: 5 }, { emoji: '🙋', etiqueta: 'Con uno', valor: 4 }, { emoji: '🎧', etiqueta: 'Con nadie', valor: 2 }] },
    { pregunta: 'En el recreo de ayer, ¿andabas acompañado o en lo tuyo?',
      opciones: [{ emoji: '👥', etiqueta: 'Acompañado', valor: 5 }, { emoji: '🔀', etiqueta: 'Un poco de cada', valor: 4 }, { emoji: '🎧', etiqueta: 'En lo mío', valor: 2 }] },
  ],
  concentracion: [
    { pregunta: 'En clase ayer, ¿se te fue la cabeza a otro lado?',
      opciones: [{ emoji: '🎯', etiqueta: 'Estuve atento', valor: 5 }, { emoji: '🌫️', etiqueta: 'A ratos', valor: 3 }, { emoji: '🛰️', etiqueta: 'Todo el rato', valor: 1 }] },
  ],
  libre: [
    { pregunta: '¿Querés contarme algo más? Escribí lo que sea — o saltá esta parte.', formato: 'texto' },
  ],
};

const COMPONENTES_LOCAL: Componente[] = ['animo', 'sueno', 'energia', 'vinculo', 'concentracion'];
const REACCIONES_LOCAL = ['Anotado.', 'Vale, gracias por decirlo.', 'Listo, lo guardo.', 'Ok, me sirve saberlo.'];

const alAzar = <T,>(lista: readonly T[]): T => lista[Math.floor(Math.random() * lista.length)] as T;

function turnoLocal(sesion: RespuestaTurno[]): Turno {
  const cubiertos = sesion.map((t) => t.componente);
  const pendientes = COMPONENTES_LOCAL.filter((c) => !cubiertos.includes(c));
  const componente: Componente = pendientes[0] ?? 'libre';
  const elegido = alAzar(BANCO_LOCAL[componente]);

  return {
    reaccion: sesion.length === 0 ? '' : alAzar(REACCIONES_LOCAL),
    pregunta: elegido.pregunta,
    componente,
    formato: elegido.formato ?? 'opciones',
    opciones: elegido.opciones ?? [],
    cierre: componente === 'libre',
    generado: false,
    turno: sesion.length + 1,
  };
}

/* ========================================================================
   Endpoints
   ======================================================================== */

export const perfilesDemo = () => DEMO.PERFILES;

export const login = (email: string, password: string) =>
  conRespaldo<{ token: string; usuario: Usuario | null; demo?: boolean }>(
    () => request('/auth/login', { metodo: 'POST', cuerpo: { email, password }, auth: false }),
    () => ({ token: 'demo-token', usuario: null, demo: true }),
  );

export const registrar = (datos: Record<string, unknown>) =>
  conRespaldo<Record<string, unknown>>(
    () => request('/auth/register', { metodo: 'POST', cuerpo: datos, auth: false }),
    () => ({ id: 'demo', ...datos, demo: true }),
  );

/* --- Métricas del estudiante ---------------------------------------------
 *
 * Todo lo que se dibuja sale de acá, y todo lo de acá sale de datos reales
 * mientras el servidor responda. Las respuestas del backend NO tienen la forma
 * que consumen las vistas —manda `serie` donde el gráfico lee `lineaBase`, y
 * el clima como objeto donde se espera una cadena—, así que pasan por
 * `metricas.ts` antes de llegar a la pantalla. Sin ese paso, una sesión real
 * dejaba a `LineaBase` haciendo `.map` sobre `undefined`.
 * ------------------------------------------------------------------------- */

export const gemelo = (): Promise<Gemelo> =>
  conRespaldo<Gemelo>(
    async () => metricas.adaptarGemelo(await request<metricas.GemeloServidor>('/comunitario/gemelo')),
    () => DEMO.GEMELO,
  );

/**
 * El historial crudo del estudiante.
 *
 * Tres métricas distintas se calculan sobre la misma lista —el texto escrito,
 * el calendario de constancia y las insignias— y las vistas las piden juntas
 * en un `Promise.all`. Sin deduplicar, `Historial` disparaba dos veces la misma
 * consulta en el mismo tick. La promesa en vuelo se comparte y se suelta al
 * terminar: no es una caché, así que un check-in nuevo vuelve a pedir.
 */
let registrosEnVuelo: Promise<metricas.RegistroServidor[]> | null = null;

export function registros(): Promise<metricas.RegistroServidor[]> {
  if (!registrosEnVuelo) {
    registrosEnVuelo = conRespaldo<metricas.RegistroServidor[]>(
      () => request('/registros'),
      () => DEMO.REGISTROS,
    ).finally(() => { registrosEnVuelo = null; });
  }
  return registrosEnVuelo;
}

export const ipsativa = async (): Promise<Ipsativa[]> => (await gemelo()).ipsativa;

export const entradas = async (): Promise<Entrada[]> =>
  metricas.adaptarEntradas(await registros());

export const constancia = async (): Promise<DiaConstancia[]> =>
  metricas.constanciaDesde(await registros());

/** La huella de los últimos `dias`, con los puntajes que de verdad se guardaron. */
export const serie = async (dias: number): Promise<PuntoLinea[]> =>
  metricas.serieDesde(await registros(), dias);

/**
 * Las insignias no tienen endpoint, pero sí tienen hechos detrás: la racha y el
 * total de check-ins los calcula el servidor, y las respiraciones, las cápsulas
 * y el tamaño de la red viven en el teléfono porque es donde ocurren.
 */
export const insignias = async (): Promise<Insignia[]> => {
  const [g, red] = await Promise.all([gemelo(), redApoyo()]);
  const local = progreso.leer();
  return metricas.insigniasDesde(g, {
    respiraciones: local.respiraciones,
    capsulas: local.capsulas,
    contactos: metricas.contactosActivos(red),
  });
};

export const capsulas = (): Promise<Capsula[]> => Promise.resolve(DEMO.CAPSULAS);

export const redApoyo = (): Promise<Contacto[]> =>
  Promise.resolve(almacen.leer<Contacto[]>('redApoyo', DEMO.RED_APOYO));
export const guardarRedApoyo = (lista: Contacto[]): Promise<Contacto[]> =>
  Promise.resolve(almacen.guardar('redApoyo', lista));

/**
 * Modo de la red de apoyo.
 *
 * Se guarda aparte de la lista de contactos, y no dentro de ella, por una
 * razón concreta: al pasar a modo anónimo la lista personal NO se borra. Quien
 * se esconde hoy puede querer volver mañana, y obligarlo a escribir de nuevo
 * los nombres de su gente sería castigar el haber pedido privacidad.
 */
export const modoRed = (): Promise<ModoRed> =>
  Promise.resolve(almacen.leer<ModoRed>('modoRed', 'personal'));
export const guardarModoRed = (modo: ModoRed): Promise<ModoRed> =>
  Promise.resolve(almacen.guardar('modoRed', modo));

export const casos = () => conRespaldo<Caso[]>(() => request('/alertas'), () => DEMO.CASOS);
export const supervision = (): Promise<Supervision[]> => Promise.resolve(DEMO.SUPERVISION);

export const comunitario = (): Promise<Comunitario> =>
  conRespaldo<Comunitario>(
    async () => metricas.adaptarComunitario(await request<Parameters<typeof metricas.adaptarComunitario>[0]>('/comunitario/radar')),
    () => DEMO.COMUNITARIO,
  );

/**
 * Indicadores del centro.
 *
 * No hay endpoint que los calcule; se derivan de las alertas y del radar, que
 * sí son reales. El alcance es más estrecho que el del tablero maquetado —la
 * participación por grado no se puede calcular porque el esquema no guarda
 * grado— y la vista lo dice en vez de rellenar el hueco.
 */
export async function institucional(): Promise<Institucional> {
  try {
    const [lista, radar] = await Promise.all([casos(), comunitario().catch(() => null)]);
    return metricas.institucionalDesde(lista, radar);
  } catch {
    return DEMO.INSTITUCIONAL;
  }
}

/**
 * Pide el siguiente intercambio del check-in.
 *
 * Se manda la sesión completa en cada llamada: el backend no guarda estado
 * conversacional, así que este endpoint es idempotente por turno y recargar la
 * página no deja un check-in a medias en la base.
 */
export const turnoCheckin = (sesion: RespuestaTurno[]) =>
  conRespaldoSiempre<Turno>(
    () => request('/ia/checkin/turno', { metodo: 'POST', cuerpo: { sesion } }),
    () => turnoLocal(sesion),
  );

/**
 * Cierra el check-in. El ICVE y el análisis se calculan en el servidor.
 *
 * Si el envío falla por falta de red, el registro NO se pierde: se encola en
 * IndexedDB y se manda solo cuando vuelve la señal. Es el flujo que justifica
 * toda la parte offline de la app — un estudiante que completó su check-in en
 * el recreo, donde el colegio no tiene señal, ya hizo su parte.
 *
 * Se distingue el motivo del fallo. Un 4xx es el servidor rechazando lo que
 * mandamos: reintentarlo daría el mismo error para siempre, así que no se
 * encola. Un fallo de red o un 5xx sí se reintenta.
 */
export type CierreCheckin = {
  turnos: RespuestaTurno[];
  texto_usuario: string | null;
  /** Solo si el estudiante grabó algo. Son números, nunca audio: el
   *  consentimiento va explícito porque el backend lo exige y rechaza el
   *  análisis sin él. Ver lib/voz.ts y src/IA/ia.voz.service.js. */
  voz: { caracteristicas: Prosodia; consentimiento: true } | null;
};

export async function enviarCheckin(payload: CierreCheckin): Promise<Cierre> {
  try {
    return await request<Cierre>('/registros', { metodo: 'POST', cuerpo: payload });
  } catch (err) {
    // El historial local se actualiza siempre, para que la Huella Emocional
    // muestre el registro de hoy sin esperar a la sincronización.
    const historial = almacen.leer<unknown[]>('checkins', []);
    historial.unshift({ ...payload, fecha: new Date().toISOString() });
    almacen.guardar('checkins', historial.slice(0, 60));

    if (!esDeNegocio(err)) {
      await guardarParaDespues('/api/v1/registros', payload, token.get());
      return {
        pendiente: true,
        coach: 'Gracias por aparecer hoy. Lo guardé en tu teléfono y se envía solo cuando vuelva la señal.',
        factores: [],
        contencion: null,
      };
    }

    console.warn('[API] check-in en modo local:', err instanceof ErrorApi ? err.status : err);
    return {
      demo: true,
      coach: 'Gracias por aparecer hoy. Queda guardado.',
      factores: [],
      contencion: null,
    };
  }
}
