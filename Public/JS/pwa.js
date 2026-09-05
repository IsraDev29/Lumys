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
   ========================================================================== */

const PWA = (() => {
  const BD = 'lumys';
  const ALMACEN = 'pendientes';

  // -------------------------------------------------------------------------
  // IndexedDB
  // -------------------------------------------------------------------------

  function abrirBd() {
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

  function conAlmacen(modo, operacion) {
    return abrirBd().then(
      (bd) =>
        new Promise((resolve, reject) => {
          const transaccion = bd.transaction(ALMACEN, modo);
          const peticion = operacion(transaccion.objectStore(ALMACEN));
          peticion.onsuccess = () => resolve(peticion.result);
          peticion.onerror = () => reject(peticion.error);
        }),
    );
  }

  const encolar = (registro) =>
    conAlmacen('readwrite', (almacen) =>
      almacen.add({ ...registro, encoladoEn: new Date().toISOString() }),
    );

  const listarPendientes = () => conAlmacen('readonly', (almacen) => almacen.getAll());
  const borrarPendiente = (id) => conAlmacen('readwrite', (almacen) => almacen.delete(id));

  // -------------------------------------------------------------------------
  // Sincronización
  // -------------------------------------------------------------------------

  let sincronizando = false;

  /**
   * Vacía la cola contra el servidor. Se llama al recuperar la conexión, al
   * abrir la app y cuando el service worker avisa.
   *
   * El candado evita la doble sincronización: si vuelve la señal justo cuando la
   * app se abre, los dos disparadores llegan casi juntos y el mismo check-in se
   * guardaría dos veces.
   */
  async function sincronizar() {
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
        } catch (error) {
          // Sigue sin red: se deja en la cola y se corta el ciclo, no tiene
          // sentido intentar los demás.
          break;
        }
      }

      if (enviados > 0) {
        document.dispatchEvent(new CustomEvent('lumys:sincronizado', { detail: { enviados } }));
      }

      return { enviados };
    } finally {
      sincronizando = false;
    }
  }

  /**
   * Guarda un check-in para enviarlo después y pide sincronización en segundo
   * plano si el navegador la soporta.
   */
  async function guardarParaDespues(ruta, cuerpo, token) {
    await encolar({ ruta, cuerpo, token });

    const registro = await navigator.serviceWorker?.ready.catch(() => null);
    if (registro?.sync) {
      // En Chrome/Android el sistema despierta al worker al volver la señal
      // aunque la app esté cerrada. En Safari no existe, y ahí queda el
      // reintento al abrir la app.
      await registro.sync.register('lumys-checkins').catch(() => {});
    }
  }

  const contarPendientes = () => listarPendientes().then((p) => p.length);

  // -------------------------------------------------------------------------
  // Estado de conexión
  // -------------------------------------------------------------------------

  function mostrarEstado(enLinea) {
    let aviso = document.getElementById('lm-offline');

    if (enLinea) {
      aviso?.remove();
      return;
    }

    if (aviso) return;

    aviso = document.createElement('div');
    aviso.id = 'lm-offline';
    aviso.setAttribute('role', 'status');
    aviso.style.cssText =
      'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom) + 76px);' +
      'z-index:1080;background:#065F46;color:#FDFBF7;padding:.5rem 1rem;border-radius:999px;' +
      'font-size:.85rem;box-shadow:0 4px 16px rgba(0,0,0,.2);display:flex;align-items:center;gap:.5rem';
    // Se dice qué sigue funcionando, no solo que no hay internet: el estudiante
    // necesita saber que puede hacer su check-in igual.
    aviso.innerHTML =
      '<i class="bi bi-wifi-off" aria-hidden="true"></i>' +
      '<span>Sin conexión · tu check-in se guarda y se envía solo</span>';

    document.body.appendChild(aviso);
  }

  // -------------------------------------------------------------------------
  // Instalación
  // -------------------------------------------------------------------------

  let promptInstalacion = null;

  function prepararInstalacion() {
    window.addEventListener('beforeinstallprompt', (evento) => {
      // Sin esto Chrome muestra su propia barra, que aparece en mal momento y
      // con un texto que no explica por qué conviene instalar.
      evento.preventDefault();
      promptInstalacion = evento;
      document.dispatchEvent(new CustomEvent('lumys:instalable'));
    });

    window.addEventListener('appinstalled', () => {
      promptInstalacion = null;
    });
  }

  async function instalar() {
    if (!promptInstalacion) return false;

    promptInstalacion.prompt();
    const { outcome } = await promptInstalacion.userChoice;
    promptInstalacion = null;
    return outcome === 'accepted';
  }

  const sePuedeInstalar = () => promptInstalacion !== null;

  const estaInstalada = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  // -------------------------------------------------------------------------
  // Arranque
  // -------------------------------------------------------------------------

  function iniciar() {
    prepararInstalacion();

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then(() => sincronizar())
          .catch((error) => console.warn('[PWA] no se registró el service worker:', error.message));
      });

      navigator.serviceWorker.addEventListener('message', (evento) => {
        if (evento.data?.tipo === 'lumys:sincronizar') sincronizar();
      });
    }

    window.addEventListener('online', () => {
      mostrarEstado(true);
      sincronizar();
    });
    window.addEventListener('offline', () => mostrarEstado(false));

    mostrarEstado(navigator.onLine);
  }

  return {
    iniciar,
    sincronizar,
    guardarParaDespues,
    contarPendientes,
    instalar,
    sePuedeInstalar,
    estaInstalada,
  };
})();

PWA.iniciar();
