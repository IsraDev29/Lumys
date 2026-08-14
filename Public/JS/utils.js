/* ==========================================================================
   Lumys* — Utilidades compartidas
   ========================================================================== */

const LM = (() => {
  /* --- Selección de elementos -------------------------------------------- */
  const qs = (sel, ctx = document) => ctx.querySelector(sel);
  const qsa = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /** Crea un elemento con atributos e hijos. */
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? '' : v);
    });
    (Array.isArray(children) ? children : [children])
      .filter(Boolean)
      .forEach((c) => node.append(c.nodeType ? c : document.createTextNode(c)));
    return node;
  }

  /** Escapa texto que viene del usuario antes de inyectarlo como HTML. */
  const escape = (str = '') =>
    String(str).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* --- Fechas en español nicaragüense ------------------------------------- */
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const DIAS_CORTO = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  const capitalizar = (s = '') => s.charAt(0).toUpperCase() + s.slice(1);

  function fechaLarga(fecha = new Date()) {
    const d = new Date(fecha);
    return `${capitalizar(DIAS[d.getDay()])} ${d.getDate()} de ${MESES[d.getMonth()]}`;
  }

  function fechaCorta(fecha = new Date()) {
    const d = new Date(fecha);
    return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}`;
  }

  function diaCorto(fecha = new Date()) {
    return DIAS_CORTO[new Date(fecha).getDay()];
  }

  /** "hace 3 días", "ayer", "hoy" — lenguaje cercano, nunca técnico. */
  function haceCuanto(fecha) {
    const dias = Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000);
    if (dias <= 0) return 'hoy';
    if (dias === 1) return 'ayer';
    if (dias < 7) return `hace ${dias} días`;
    if (dias < 30) return `hace ${Math.floor(dias / 7)} semana${dias >= 14 ? 's' : ''}`;
    return `hace ${Math.floor(dias / 30)} mes${dias >= 60 ? 'es' : ''}`;
  }

  const saludo = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  };

  /* --- Almacenamiento local ------------------------------------------------ */
  const store = {
    get(clave, porDefecto = null) {
      try {
        const raw = localStorage.getItem(`lumys:${clave}`);
        return raw ? JSON.parse(raw) : porDefecto;
      } catch { return porDefecto; }
    },
    set(clave, valor) {
      try { localStorage.setItem(`lumys:${clave}`, JSON.stringify(valor)); } catch { /* modo privado */ }
      return valor;
    },
    remove(clave) {
      try { localStorage.removeItem(`lumys:${clave}`); } catch { /* modo privado */ }
    },
  };

  /* --- Avisos emergentes --------------------------------------------------- */
  function toast(mensaje, { tipo = 'info', icono, duracion = 3600 } = {}) {
    let cont = qs('.lm-toasts');
    if (!cont) {
      cont = el('div', { class: 'lm-toasts', role: 'status', 'aria-live': 'polite' });
      document.body.append(cont);
    }
    const iconos = { info: 'bi-info-circle', ok: 'bi-check-circle', logro: 'bi-stars', aviso: 'bi-bell' };
    const nodo = el('div', { class: `lm-toast${tipo === 'logro' ? ' lm-toast--logro' : ''}` }, [
      el('i', { class: `bi ${icono || iconos[tipo] || iconos.info}` }),
      el('span', { text: mensaje }),
    ]);
    cont.append(nodo);
    setTimeout(() => {
      nodo.classList.add('is-out');
      nodo.addEventListener('animationend', () => nodo.remove(), { once: true });
    }, duracion);
    return nodo;
  }

  /* --- Animaciones --------------------------------------------------------- */
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const espera = (ms) => new Promise((r) => setTimeout(r, reduceMotion() ? Math.min(ms, 60) : ms));

  /** Anima un número de 0 al valor final. */
  function contar(nodo, valor, { duracion = 900, sufijo = '' } = {}) {
    if (reduceMotion()) { nodo.textContent = `${valor}${sufijo}`; return; }
    const inicio = performance.now();
    const paso = (t) => {
      const p = Math.min((t - inicio) / duracion, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      nodo.textContent = `${Math.round(valor * eased)}${sufijo}`;
      if (p < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  }

  /** Aplica anchos/alturas diferidos para que las barras se animen al entrar. */
  function animarBarras(ctx = document) {
    requestAnimationFrame(() => {
      qsa('[data-ancho]', ctx).forEach((n) => { n.style.width = n.dataset.ancho; });
      qsa('[data-alto]', ctx).forEach((n) => { n.style.height = n.dataset.alto; });
    });
  }

  function debounce(fn, ms = 220) {
    let id;
    return (...args) => { clearTimeout(id); id = setTimeout(() => fn(...args), ms); };
  }

  /* --- Ayudas de dominio ---------------------------------------------------- */
  const NIVELES = {
    1: { nombre: 'Conversar', descripcion: 'Cambio leve pero sostenido. El orientador busca al estudiante para hablar.' },
    2: { nombre: 'Acompañar', descripcion: 'Cambio claro o varias señales juntas. Seguimiento estructurado y revisión con el psicólogo.' },
    3: { nombre: 'Derivar', descripcion: 'Señales de riesgo importante. Derivación clínica y evaluación de seguridad del receptor.' },
  };

  const CLIMAS = {
    despejado: { titulo: 'Despejado', sub: 'Mejor que tu semana normal' },
    parcial: { titulo: 'Parcialmente despejado', sub: 'Muy parecido a tu semana normal' },
    nublado: { titulo: 'Nublado, pero estable', sub: 'Parecido a tu semana normal' },
    lluvia: { titulo: 'Con lluvia', sub: 'Más pesado que tu semana normal' },
  };

  const iniciales = (nombre = '') =>
    nombre.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

  return {
    qs, qsa, el, escape,
    fechaLarga, fechaCorta, diaCorto, haceCuanto, saludo, capitalizar,
    store, toast, espera, contar, animarBarras, debounce, reduceMotion,
    NIVELES, CLIMAS, iniciales,
    DIAS, DIAS_CORTO, MESES,
  };
})();

window.LM = LM;
