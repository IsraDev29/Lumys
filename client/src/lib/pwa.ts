/* ==========================================================================
   Lumys* — Instalación, estado de conexión y cola de check-ins

   El caso que este archivo resuelve: un estudiante termina su check-in en el
   recreo, el colegio no tiene señal, y el POST falla. Sin una cola, ese registro
   se pierde y con él la constancia que la plataforma le viene pidiendo.

   Por qué IndexedDB y no localStorage: la cola tiene que sobrevivir a que el
   navegador cierre la pestaña, y el service worker necesita poder leerla — cosa
   que con localStorage no puede, porque no tiene acceso.

   Lo que NO se encola: los turnos de la conversación. Un turno sin respuesta del
   modelo no sirve de nada guardado para después; ahí el cliente usa su propio
   banco local de preguntas y el estudiante ni se entera. Se encola el cierre,
   que es el que trae los datos.

   Al pasar a React, la única parte que se fue de acá es el cartel de "sin
   conexión": era el módulo creando un div a mano y metiéndole estilos en línea.
   Ahora es <AvisoConexion/>, alimentado por el hook `useConexion`. La cola, la
   sincronización y el prompt de instalación siguen siendo lo que eran, porque
   nada de eso es interfaz.
   ========================================================================== */

const BD = 'lumys';
const ALMACEN = 'pendientes';

export type Pendiente = {
  id: number;
  ruta: string;
  cuerpo: unknown;
  token?: string | null;
  encoladoEn: string;
};

/* -------------------------------------------------------------------------
   IndexedDB
   ------------------------------------------------------------------------- */

function abrirBd(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const peticion = indexedDB.open(BD, 1);

    peticion.onupgradeneeded = () => {
      const bd = peticion.result;
      if (!bd.objectStoreNames.contains(ALMACEN)) {
        bd.createObjectStore(ALMACEN, { keyPath: 'id', autoIncrement: true });
      }
    };

    peticion.onsuccess = () => resolve(peticion.result);
    peticion.onerror = () => reject(peticion.error);
  });
}

function conAlmacen<T>(
  modo: IDBTransactionMode,
  operacion: (almacen: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return abrirBd().then(
    (bd) =>
      new Promise<T>((resolve, reject) => {
        const transaccion = bd.transaction(ALMACEN, modo);
        const peticion = operacion(transaccion.objectStore(ALMACEN));
        peticion.onsuccess = () => resolve(peticion.result);
        peticion.onerror = () => reject(peticion.error);
      }),
  );
}

const encolar = (registro: Omit<Pendiente, 'id' | 'encoladoEn'>) =>
  conAlmacen('readwrite', (almacen) =>
    almacen.add({ ...registro, encoladoEn: new Date().toISOString() }),
  );

const listarPendientes = () => conAlmacen<Pendiente[]>('readonly', (almacen) => almacen.getAll());
const borrarPendiente = (id: number) => conAlmacen('readwrite', (almacen) => almacen.delete(id));

/* -------------------------------------------------------------------------
   Sincronización
   ------------------------------------------------------------------------- */

let sincronizando = false;

/** Se avisa por evento para que la interfaz (el contador de pendientes del
 *  perfil, el toast de "se enviaron tus check-ins") reaccione sin que este
 *  módulo tenga que conocerla. */
export const EVENTO_SINCRONIZADO = 'lumys:sincronizado';

/**
 * Vacía la cola contra el servidor. Se llama al recuperar la conexión, al
 * abrir la app y cuando el service worker avisa.
 *
 * El candado evita la doble sincronización: si vuelve la señal justo cuando la
 * app se abre, los dos disparadores llegan casi juntos y el mismo check-in se
 * guardaría dos veces.
 */
export async function sincronizar(): Promise<{ enviados: number }> {
  if (sincronizando || !navigator.onLine) return { enviados: 0 };
  sincronizando = true;

  try {
    const pendientes = await listarPendientes();
    let enviados = 0;

    for (const pendiente of pendientes) {
      try {
        const respuesta = await fetch(pendiente.ruta, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(pendiente.token ? { Authorization: `Bearer ${pendiente.token}` } : {}),
          },
          body: JSON.stringify(pendiente.cuerpo),
        });

        // 4xx significa que el servidor lo rechazó por lo que trae dentro:
        // reintentarlo daría el mismo error para siempre y la cola nunca se
        // vaciaría. Se descarta y se sigue. 5xx y los fallos de red sí se
        // reintentan, porque ahí el problema es del otro lado.
        if (respuesta.ok || (respuesta.status >= 400 && respuesta.status < 500)) {
          await borrarPendiente(pendiente.id);
          if (respuesta.ok) enviados += 1;
          else console.warn('[PWA] check-in descartado por el servidor:', respuesta.status);
        }
      } catch {
        // Sigue sin red: se deja en la cola y se corta el ciclo, no tiene
        // sentido intentar los demás.
        break;
      }
    }

    if (enviados > 0) {
      document.dispatchEvent(new CustomEvent(EVENTO_SINCRONIZADO, { detail: { enviados } }));
    }

    return { enviados };
  } finally {
    sincronizando = false;
  }
}

/** El registro del service worker con `sync`, que TypeScript todavía no
 *  declara porque la Background Sync API no está en todos los navegadores. */
type RegistroConSync = ServiceWorkerRegistration & {
  sync?: { register(etiqueta: string): Promise<void> };
};

/**
 * Guarda un check-in para enviarlo después y pide sincronización en segundo
 * plano si el navegador la soporta.
 */
export async function guardarParaDespues(
  ruta: string, cuerpo: unknown, token?: string | null,
): Promise<void> {
  // Lo que de verdad importa es esto: el check-in ya está a salvo en disco.
  await encolar({ ruta, cuerpo, token });

  // Lo de abajo es mejora, no requisito, y por eso no puede bloquear.
  //
  // `serviceWorker.ready` NO rechaza cuando no hay worker registrado: se queda
  // pendiente para siempre. Un `.catch()` no lo cubre, porque nunca hay error
  // que atrapar. Sin la carrera contra el temporizador, un estudiante que
  // termina su check-in sin conexión y sin worker activo (modo desarrollo,
  // navegación privada, contexto sin HTTPS) se queda mirando el indicador de
  // escritura sin que la conversación cierre nunca.
  const registro = await Promise.race([
    navigator.serviceWorker?.ready.catch(() => null),
    new Promise<null>((r) => setTimeout(() => r(null), 1500)),
  ]) as RegistroConSync | null;

  if (registro?.sync) {
    // En Chrome/Android el sistema despierta al worker al volver la señal
    // aunque la app esté cerrada. En Safari no existe, y ahí queda el
    // reintento al abrir la app.
    await registro.sync.register('lumys-checkins').catch(() => {});
  }
}

export const contarPendientes = (): Promise<number> =>
  listarPendientes().then((p) => p.length);

/* -------------------------------------------------------------------------
   Instalación
   ------------------------------------------------------------------------- */

type EventoInstalacion = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let promptInstalacion: EventoInstalacion | null = null;

export const EVENTO_INSTALABLE = 'lumys:instalable';

function prepararInstalacion() {
  window.addEventListener('beforeinstallprompt', (evento) => {
    // Sin esto Chrome muestra su propia barra, que aparece en mal momento y
    // con un texto que no explica por qué conviene instalar.
    evento.preventDefault();
    promptInstalacion = evento as EventoInstalacion;
    document.dispatchEvent(new CustomEvent(EVENTO_INSTALABLE));
  });

  window.addEventListener('appinstalled', () => {
    promptInstalacion = null;
  });
}

export async function instalar(): Promise<boolean> {
  if (!promptInstalacion) return false;

  await promptInstalacion.prompt();
  const { outcome } = await promptInstalacion.userChoice;
  promptInstalacion = null;
  return outcome === 'accepted';
}

export const sePuedeInstalar = (): boolean => promptInstalacion !== null;

export const estaInstalada = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches
  || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/* -------------------------------------------------------------------------
   Arranque
   ------------------------------------------------------------------------- */

let iniciado = false;

export function iniciarPwa(): void {
  // React 19 en modo estricto monta los efectos dos veces en desarrollo. Sin
  // este candado se registrarían dos veces los escuchadores de `online`.
  if (iniciado) return;
  iniciado = true;

  prepararInstalacion();

  if ('serviceWorker' in navigator) {
    // En desarrollo NO se registra. El worker cachea el shell y en dev eso
    // significa servir módulos viejos: se edita un archivo, Vite recompila, y
    // el navegador sigue ejecutando la copia del caché. Cuesta horas darse
    // cuenta porque el código en disco está bien y el que corre no.
    //
    // Además se desregistra cualquiera que haya quedado de una sesión anterior,
    // porque un worker instalado sobrevive a que se quite este registro.
    if (import.meta.env.DEV) {
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => void r.unregister());
      });
      void caches?.keys().then((claves) => {
        claves.filter((c) => c.startsWith('lumys-')).forEach((c) => void caches.delete(c));
      });
      return;
    }

    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then(() => sincronizar())
        .catch((error: Error) => console.warn('[PWA] no se registró el service worker:', error.message));
    });

    navigator.serviceWorker.addEventListener('message', (evento: MessageEvent) => {
      if (evento.data?.tipo === 'lumys:sincronizar') void sincronizar();
    });
  }

  window.addEventListener('online', () => { void sincronizar(); });
}
