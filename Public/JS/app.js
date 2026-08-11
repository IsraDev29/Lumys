/* ==========================================================================
   Lumys* — Shell de la aplicación

   index.html es el único punto de entrada: monta la navegación y carga cada
   vista desde su propio archivo en Public/vistas/. Cada vista registra su
   controlador en App.controladores y recibe el contenedor ya inyectado.
   ========================================================================== */

const App = (() => {
  const { qs, qsa, el, store } = LM;

  /* --- Mapa de vistas ------------------------------------------------------ */
  const RUTAS = {
    // Públicas (sin barra lateral)
    'bienvenida': { archivo: 'bienvenida', publica: true, titulo: 'Lumys*' },
    'acceso': { archivo: 'acceso', publica: true, titulo: 'Entrar a Lumys*' },
    'marca': { archivo: 'marca', publica: true, titulo: 'Mini manual de marca' },

    // Estudiante
    'inicio': { archivo: 'inicio', perfiles: ['estudiante'], titulo: 'Tu espacio', sub: 'Gemelo digital · clima de hoy' },
    'checkin': { archivo: 'checkin', perfiles: ['estudiante'], titulo: 'Check-in de hoy', sub: 'Menos de un minuto' },
    'historial': { archivo: 'historial', perfiles: ['estudiante'], titulo: 'Tu huella', sub: 'Comparada contigo mismo' },
    'red': { archivo: 'red', perfiles: ['estudiante'], titulo: 'Mi red de confianza', sub: 'Vos decidís quién y cuándo' },
    'logros': { archivo: 'logros', perfiles: ['estudiante'], titulo: 'Constancia', sub: 'Se premia aparecer, no el ánimo' },
    'respirar': { archivo: 'respirar', perfiles: ['estudiante'], titulo: 'Respirar', sub: 'Un minuto, sin apuro' },
    'capsulas': { archivo: 'capsulas', perfiles: ['estudiante'], titulo: 'Cápsulas', sub: 'Cosas cortas que sirven' },

    // Acompañamiento
    'orientador': { archivo: 'orientador', perfiles: ['orientador'], titulo: 'Casos activos', sub: 'Señales, no diagnósticos' },
    'psicologo': { archivo: 'psicologo', perfiles: ['psicologo'], titulo: 'Supervisión', sub: 'Decidir junto al orientador' },

    // Institución y auditoría
    'institucional': { archivo: 'institucional', perfiles: ['admin', 'psicologo'], titulo: 'Panel de bienestar', sub: 'Métricas agregadas y anónimas' },
    'comunitario': { archivo: 'comunitario', perfiles: ['admin', 'psicologo', 'orientador'], titulo: 'Gemelo comunitario', sub: 'Nunca una persona: siempre un grupo' },

    // Transversales
    'perfil': { archivo: 'perfil', perfiles: ['estudiante', 'orientador', 'psicologo', 'admin'], titulo: 'Tu cuenta', sub: 'Qué se comparte y con quién' },
  };

  const NAV = {
    estudiante: [
      { grupo: 'Tu día', items: [
        { ruta: 'inicio', icono: 'bi-house-heart', texto: 'Inicio' },
        { ruta: 'checkin', icono: 'bi-chat-heart', texto: 'Check-in', destacado: true },
        { ruta: 'historial', icono: 'bi-graph-up', texto: 'Tu huella' },
      ] },
      { grupo: 'Tu gente', items: [
        { ruta: 'red', icono: 'bi-diagram-3', texto: 'Red de confianza' },
        { ruta: 'capsulas', icono: 'bi-collection-play', texto: 'Cápsulas' },
      ] },
      { grupo: 'Para vos', items: [
        { ruta: 'logros', icono: 'bi-stars', texto: 'Constancia' },
        { ruta: 'respirar', icono: 'bi-wind', texto: 'Respirar' },
        { ruta: 'perfil', icono: 'bi-person-gear', texto: 'Tu cuenta' },
      ] },
    ],
    orientador: [
      { grupo: 'Acompañamiento', items: [
        { ruta: 'orientador', icono: 'bi-clipboard-heart', texto: 'Casos activos', badge: 3 },
        { ruta: 'comunitario', icono: 'bi-people', texto: 'Clima del centro' },
      ] },
      { grupo: 'Cuenta', items: [
        { ruta: 'perfil', icono: 'bi-person-gear', texto: 'Tu cuenta' },
      ] },
    ],
    psicologo: [
      { grupo: 'Supervisión', items: [
        { ruta: 'psicologo', icono: 'bi-shield-check', texto: 'Casos a revisar', badge: 2 },
        { ruta: 'comunitario', icono: 'bi-people', texto: 'Clima del centro' },
        { ruta: 'institucional', icono: 'bi-bar-chart', texto: 'Panel del centro' },
      ] },
      { grupo: 'Cuenta', items: [
        { ruta: 'perfil', icono: 'bi-person-gear', texto: 'Tu cuenta' },
      ] },
    ],
    admin: [
      { grupo: 'Sistema', items: [
        { ruta: 'institucional', icono: 'bi-bar-chart', texto: 'Panel institucional' },
        { ruta: 'comunitario', icono: 'bi-people', texto: 'Gemelo comunitario' },
      ] },
      { grupo: 'Cuenta', items: [
        { ruta: 'perfil', icono: 'bi-person-gear', texto: 'Tu cuenta' },
      ] },
    ],
  };

  // Accesos directos de la barra inferior en móvil (máximo 5 píldoras)
  const NAV_MOVIL = {
    estudiante: ['inicio', 'checkin', 'historial', 'red', 'perfil'],
    orientador: ['orientador', 'comunitario', 'perfil'],
    psicologo: ['psicologo', 'comunitario', 'institucional', 'perfil'],
    admin: ['institucional', 'comunitario', 'perfil'],
  };

  const ICONO_RUTA = Object.fromEntries(
    Object.values(NAV).flat().flatMap((g) => g.items).map((i) => [i.ruta, i]),
  );

  /* --- Sesión --------------------------------------------------------------- */
  const sesion = {
    get: () => store.get('sesion'),
    set: (s) => store.set('sesion', s),
    salir() {
      store.remove('sesion');
      API.token.clear();
      location.hash = '#/bienvenida';
    },
  };

  const controladores = {};
  const cacheVistas = new Map();
  let rutaActual = null;

  /* --- Carga de vistas ------------------------------------------------------ */
  async function cargarVista(archivo) {
    if (cacheVistas.has(archivo)) return cacheVistas.get(archivo);
    const res = await fetch(`vistas/${archivo}.html`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`No se pudo cargar la vista "${archivo}"`);
    const html = await res.text();
    cacheVistas.set(archivo, html);
    return html;
  }

  /* --- Navegación ----------------------------------------------------------- */
  function pintarNav(perfil, ruta) {
    const nav = qs('#lm-nav');
    const grupos = NAV[perfil] || NAV.estudiante;
    nav.innerHTML = '';

    grupos.forEach((g) => {
      const cont = el('div', { class: 'lm-nav-group' }, [
        el('p', { class: 'lm-nav-group__title', text: g.grupo }),
      ]);
      const lista = el('div', { class: 'lm-nav' });
      g.items.forEach((item) => {
        lista.append(el('a', {
          class: `lm-nav__link${item.ruta === ruta ? ' is-active' : ''}`,
          href: `#/${item.ruta}`,
          'aria-current': item.ruta === ruta ? 'page' : null,
        }, [
          el('i', { class: `bi ${item.icono}`, 'aria-hidden': 'true' }),
          el('span', { text: item.texto }),
          item.badge ? el('span', { class: 'lm-nav__badge', text: String(item.badge) }) : null,
        ]));
      });
      cont.append(lista);
      nav.append(cont);
    });
  }

  function pintarNavMovil(perfil, ruta) {
    const cont = qs('#lm-bottomnav');
    const rutas = NAV_MOVIL[perfil] || NAV_MOVIL.estudiante;
    cont.innerHTML = '';
    rutas.forEach((r) => {
      const item = ICONO_RUTA[r] || { icono: 'bi-circle', texto: r };
      cont.append(el('a', {
        class: `lm-bottomnav__link${r === ruta ? ' is-active' : ''}`,
        href: `#/${r}`,
        'aria-label': item.texto,
        'aria-current': r === ruta ? 'page' : null,
      }, [
        el('i', { class: `bi ${item.icono}`, 'aria-hidden': 'true' }),
        el('span', { text: item.texto }),
      ]));
    });
  }

  function pintarCabecera(def, usuario) {
    qs('#lm-titulo').textContent = def.titulo;
    qs('#lm-subtitulo').textContent = def.sub || '';
    const chip = qs('#lm-perfil-chip');
    chip.innerHTML = '';
    chip.append(
      el('span', { class: 'lm-avatar', text: LM.iniciales(usuario.nombre) }),
      el('span', { class: 'd-none d-md-block text-start lh-1' }, [
        el('span', { class: 'd-block fw-semibold', style: 'font-size:.86rem', text: usuario.nombre.split(' ')[0] }),
        el('span', { class: 'lm-caption', text: LM.capitalizar(usuario.perfil) }),
      ]),
    );
  }

  function cerrarMenu() {
    qs('#lm-sidebar')?.classList.remove('is-open');
    qs('#lm-scrim')?.classList.remove('is-open');
  }

  /* --- Enrutador ------------------------------------------------------------ */
  async function enrutar() {
    // Los anclas internas (#como-funciona) no son rutas: las resuelve el navegador
    if (location.hash && !location.hash.startsWith('#/')) return;

    const hash = location.hash.replace(/^#\/?/, '') || '';
    const nombre = hash.split('?')[0] || (sesion.get() ? rutaInicial(sesion.get().perfil) : 'bienvenida');
    const def = RUTAS[nombre];

    if (!def) { location.hash = '#/bienvenida'; return; }

    const usuario = sesion.get();

    // Vista privada sin sesión → al acceso
    if (!def.publica && !usuario) { location.hash = '#/acceso'; return; }

    // Vista fuera del perfil actual → a su inicio
    if (def.perfiles && usuario && !def.perfiles.includes(usuario.perfil)) {
      location.hash = `#/${rutaInicial(usuario.perfil)}`;
      return;
    }

    const shell = qs('#lm-shell');
    const publico = qs('#lm-public');
    const contenedor = def.publica ? publico : qs('#lm-view');

    shell.hidden = def.publica;
    publico.hidden = !def.publica;
    cerrarMenu();

    contenedor.innerHTML = '<div class="lm-loader"><img src="img/lumys-mascota.svg" alt=""><p>Un segundo…</p></div>';

    try {
      const html = await cargarVista(def.archivo);
      contenedor.innerHTML = `<div class="lm-view__inner">${html}</div>`;
    } catch (err) {
      contenedor.innerHTML = `<div class="lm-empty"><img src="img/lumys-mascota.svg" alt="">
        <h2>No pudimos abrir esta parte</h2>
        <p class="lm-muted">${LM.escape(err.message)}</p>
        <a class="lm-btn mt-3" href="#/${usuario ? rutaInicial(usuario.perfil) : 'bienvenida'}">Volver al inicio</a></div>`;
      return;
    }

    if (!def.publica) {
      pintarNav(usuario.perfil, nombre);
      pintarNavMovil(usuario.perfil, nombre);
      pintarCabecera(def, usuario);
    }

    document.title = `${def.titulo} · Lumys*`;
    rutaActual = nombre;

    const ctrl = controladores[nombre];
    if (typeof ctrl === 'function') {
      try { await ctrl(contenedor, { usuario, ruta: nombre }); }
      catch (err) { console.error(`[Lumys] Falló el controlador "${nombre}"`, err); }
    }

    LM.animarBarras(contenedor);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  const rutaInicial = (perfil) => ({
    estudiante: 'inicio',
    orientador: 'orientador',
    psicologo: 'psicologo',
    admin: 'institucional',
  }[perfil] || 'inicio');

  /** Entra con uno de los perfiles de demostración. */
  function entrarComo(perfil) {
    const usuario = API.perfilesDemo()[perfil];
    if (!usuario) return;
    sesion.set(usuario);
    location.hash = `#/${rutaInicial(perfil)}`;
    LM.toast(`Entraste como ${usuario.nombre}`, { tipo: 'ok' });
  }

  /* --- Arranque -------------------------------------------------------------- */
  function iniciar() {
    // Menú lateral en móvil
    qs('#lm-burger')?.addEventListener('click', () => {
      qs('#lm-sidebar').classList.toggle('is-open');
      qs('#lm-scrim').classList.toggle('is-open');
    });
    qs('#lm-scrim')?.addEventListener('click', cerrarMenu);

    qs('#lm-salir')?.addEventListener('click', () => {
      sesion.salir();
      LM.toast('Cerraste sesión. Tus datos siguen siendo tuyos.', { tipo: 'info' });
    });

    document.addEventListener('click', (e) => {
      // Cambio rápido de perfil (solo para la demostración del hackathon)
      const demo = e.target.closest('[data-entrar-como]');
      if (demo) {
        e.preventDefault();
        entrarComo(demo.dataset.entrarComo);
        return;
      }
      // Volver a ejecutar el controlador si se pulsa la ruta ya activa
      const link = e.target.closest('a[href^="#/"]');
      if (link && link.getAttribute('href') === location.hash) {
        e.preventDefault();
        enrutar();
      }
    });

    window.addEventListener('hashchange', enrutar);
    enrutar();
  }

  return { controladores, sesion, enrutar, iniciar, entrarComo, rutaInicial, RUTAS };
})();

window.App = App;
document.addEventListener('DOMContentLoaded', App.iniciar);
