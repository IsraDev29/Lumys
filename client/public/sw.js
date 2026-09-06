/* ==========================================================================
   Lumys* — Service Worker

   Lumys se usa en centros educativos donde la señal va y viene. La regla que
   ordena todo este archivo: perder un check-in que el estudiante ya se tomó el
   trabajo de completar es el peor resultado posible. Todo lo demás — ver el
   historial actualizado, una pregunta más ingeniosa — es negociable.

   Tres estrategias, según qué se pide:

   - El shell (HTML, CSS, JS, iconos) va cache-first. Es lo que hace que la app
     abra estando sin señal, y cambia solo cuando se despliega una versión.
   - La API va network-first con copia en caché. Los datos frescos ganan
     siempre; la copia existe para que abrir el historial sin señal muestre lo
     de ayer en vez de un error.
   - Los envíos (POST) no se cachean nunca. Si fallan por falta de red, se
     encolan en IndexedDB y los reintenta pwa.js. Ver ese archivo.

   Lo que este worker NO hace: cachear las respuestas de /ia/. Una pregunta de
   check-in servida desde caché sería la misma pregunta de ayer, que es
   exactamente lo que el módulo de IA existe para evitar.
   ========================================================================== */

// Subir la versión invalida las dos cachés y fuerza la recarga del shell. Es el
// único paso obligatorio al desplegar cambios de frontend.
const VERSION = 'lumys-v1';

const CACHE_SHELL = `${VERSION}-shell`;
const CACHE_DATOS = `${VERSION}-datos`;

// Lo mínimo para que la app arranque y sea navegable sin red. Las vistas se
// suman porque el router las carga con fetch: sin ellas la app abre pero no
// muestra nada.
const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',

  '/CSS/variables.css',
  '/CSS/base.css',
  '/CSS/components.css',
  '/CSS/checkin.css',
  '/CSS/dashboard.css',
  '/CSS/historial.css',
  '/CSS/comunitario.css',

  '/JS/utils.js',
  '/JS/api.js',
  '/JS/app.js',
  '/JS/pwa.js',
  '/JS/voz.js',
  '/JS/auth.js',
  '/JS/inicio.js',
  '/JS/checkin.js',
  '/JS/historial.js',
  '/JS/dashboard.js',
  '/JS/comunitario.js',

  '/vistas/bienvenida.html',
  '/vistas/acceso.html',
  '/vistas/inicio.html',
  '/vistas/checkin.html',
  '/vistas/historial.html',
  '/vistas/respirar.html',
  '/vistas/perfil.html',
  '/vistas/red.html',
  '/vistas/logros.html',
  '/vistas/capsulas.html',
  '/vistas/comunitario.html',
  '/vistas/institucional.html',
  '/vistas/orientador.html',
  '/vistas/psicologo.html',
  '/vistas/marca.html',

  '/img/lumys-app-icon.svg',
  '/img/lumys-mascota.svg',
  '/img/lumys-mascota-oficial.svg',
  '/img/lumys-mascota-oficial-transparente.svg',
  '/img/lumys-mascota-oficial.png',
  '/img/lumys-mascota-plana.svg',
  '/img/lumys-logo-horizontal.svg',
  '/img/lumys-logo-reverse.svg',
  '/img/lumys-wordmark.svg',
  '/img/icon-192.png',
  '/img/icon-512.png',
];

// ---------------------------------------------------------------------------
// Instalación y activación
// ---------------------------------------------------------------------------

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_SHELL);

      // Se agrega de a uno en vez de con addAll(): addAll es atómico y si UN
      // archivo falla (un typo en la lista, una vista que todavía no existe) no
      // se cachea NADA y la PWA queda sin shell sin decir por qué.
      await Promise.all(
        SHELL.map((ruta) =>
          cache.add(new Request(ruta, { cache: 'reload' })).catch((error) => {
            console.warn('[SW] no se pudo precachear', ruta, error.message);
          }),
        ),
      );

      // Activar de inmediato en vez de esperar a que se cierren las pestañas.
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      const nombres = await caches.keys();
      await Promise.all(
        nombres
          .filter((n) => !n.startsWith(VERSION))
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

// ---------------------------------------------------------------------------
// Intercepción
// ---------------------------------------------------------------------------

/** Red primero, caché de respaldo. Para datos que conviene tener frescos. */
async function redPrimero(peticion) {
  try {
    const respuesta = await fetch(peticion);

    if (respuesta.ok) {
      const cache = await caches.open(CACHE_DATOS);
      cache.put(peticion, respuesta.clone());
    }

    return respuesta;
  } catch (error) {
    const cacheada = await caches.match(peticion);
    if (cacheada) {
      // Se marca la respuesta para que la interfaz pueda avisar que lo que se
      // ve es de la última vez que hubo señal. Mostrar datos viejos como si
      // fueran de ahora es peor que no mostrarlos.
      const cabeceras = new Headers(cacheada.headers);
      cabeceras.set('X-Lumys-Origen', 'cache');
      return new Response(await cacheada.blob(), {
        status: cacheada.status,
        headers: cabeceras,
      });
    }

    return new Response(
      JSON.stringify({ error: 'Sin conexión y sin copia guardada', offline: true }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

/** Caché primero, red de respaldo. Para el shell, que cambia solo al desplegar. */
async function cachePrimero(peticion) {
  const cacheada = await caches.match(peticion);
  if (cacheada) return cacheada;

  try {
    const respuesta = await fetch(peticion);
    if (respuesta.ok) {
      const cache = await caches.open(CACHE_SHELL);
      cache.put(peticion, respuesta.clone());
    }
    return respuesta;
  } catch (error) {
    // Navegación sin red y sin copia: se devuelve el index para que el router
    // del cliente se encargue. Sin esto el navegador muestra su propia página
    // de error y la PWA parece rota.
    if (peticion.mode === 'navigate') {
      const index = await caches.match('/index.html');
      if (index) return index;
    }
    throw error;
  }
}

self.addEventListener('fetch', (evento) => {
  const { request } = evento;

  if (request.method !== 'GET') return; // Los POST los maneja la cola de pwa.js.

  const url = new URL(request.url);

  // Nada de otros orígenes: Bootstrap y las fuentes vienen de un CDN y sus
  // respuestas son opacas. Cachearlas a ciegas llena la caché con cosas que no
  // se pueden inspeccionar ni invalidar.
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    // Las respuestas del módulo de IA no se guardan: una pregunta servida
    // desde caché sería la misma de ayer, justo lo que se quiere evitar.
    if (url.pathname.includes('/ia/')) {
      return evento.respondWith(
        fetch(request).catch(
          () =>
            new Response(JSON.stringify({ error: 'Sin conexión', offline: true }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            }),
        ),
      );
    }

    return evento.respondWith(redPrimero(request));
  }

  evento.respondWith(cachePrimero(request));
});

// ---------------------------------------------------------------------------
// Sincronización en segundo plano
//
// Cuando el navegador la soporta (Chrome/Android), el sistema despierta al
// worker al recuperar la conexión aunque la app esté cerrada. Donde no —
// Safari/iOS, que es buena parte del parque — pwa.js reintenta al volver la
// señal con la app abierta. Por eso la cola vive en IndexedDB y no en memoria.
// ---------------------------------------------------------------------------

self.addEventListener('sync', (evento) => {
  if (evento.tag === 'lumys-checkins') {
    evento.waitUntil(avisarALosClientes());
  }
});

/**
 * El worker no vacía la cola por su cuenta: el token de sesión vive en el
 * cliente y no acá. Se le avisa a las pestañas abiertas para que sincronicen
 * ellas, que son las que pueden autenticar la petición.
 */
async function avisarALosClientes() {
  const clientes = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
  for (const cliente of clientes) {
    cliente.postMessage({ tipo: 'lumys:sincronizar' });
  }
}

self.addEventListener('message', (evento) => {
  if (evento.data?.tipo === 'lumys:saltar-espera') self.skipWaiting();
});
