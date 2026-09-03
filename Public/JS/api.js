/* ==========================================================================
   Lumys* — Cliente de la API

   El backend expone hoy /api/v1/auth; el resto de módulos está en construcción.
   Cada llamada intenta primero el servidor real y, si el endpoint todavía no
   responde, usa el conjunto de datos de demostración para que la interfaz
   completa sea navegable (requisito del video de ejecución).
   ========================================================================== */

const API = (() => {
  const BASE = '/api/v1';
  const TIMEOUT = 6000;

  const token = {
    get: () => LM.store.get('token'),
    set: (t) => LM.store.set('token', t),
    clear: () => LM.store.remove('token'),
  };

  async function request(ruta, { metodo = 'GET', cuerpo, auth = true } = {}) {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), TIMEOUT);
    try {
      const res = await fetch(`${BASE}${ruta}`, {
        method: metodo,
        signal: ctrl.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(auth && token.get() ? { Authorization: `Bearer ${token.get()}` } : {}),
        },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      });
      const datos = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(datos.error || 'Error de servidor'), { status: res.status, datos });
      return datos;
    } finally {
      clearTimeout(id);
    }
  }

  // Errores que sí vienen del negocio y deben mostrarse al usuario.
  // Un 404 significa "este módulo todavía no existe": ahí sí usamos el respaldo.
  const ERRORES_REALES = [400, 401, 403, 409, 422];

  /** Intenta el servidor; si no está disponible, resuelve con datos locales. */
  async function conRespaldo(promesa, respaldo) {
    try {
      return await promesa();
    } catch (err) {
      if (ERRORES_REALES.includes(err.status)) throw err;
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
  async function conRespaldoSiempre(promesa, respaldo) {
    try {
      return await promesa();
    } catch (err) {
      console.warn('[API] check-in en modo local:', err.status || err.message);
      return respaldo();
    }
  }

  /* ========================================================================
     Datos de demostración — un solo colegio, Fase 2 del roadmap
     ======================================================================== */

  const hoy = new Date();
  const diasAtras = (n) => new Date(hoy.getTime() - n * 86400000).toISOString();

  const DEMO = {
    perfiles: {
      estudiante: { id: 'u-001', nombre: 'Kevin Ortega', perfil: 'estudiante', rol: 'USUARIO', grado: '9no B', centro: 'Instituto Nacional Rubén Darío' },
      orientador: { id: 'u-020', nombre: 'Karla Mendoza', perfil: 'orientador', rol: 'USUARIO', centro: 'Instituto Nacional Rubén Darío' },
      psicologo: { id: 'u-030', nombre: 'Dr. Elías Sequeira', perfil: 'psicologo', rol: 'USUARIO', centro: 'Red de apoyo distrital' },
      admin: { id: 'u-040', nombre: 'Equipo Lumys', perfil: 'admin', rol: 'ADMIN', centro: 'Auditoría del sistema' },
    },

    /* --- Estudiante ------------------------------------------------------ */
    gemelo: {
      clima: 'nublado',
      racha: 12,
      insignias: 3,
      checkinHoy: false,
      mensaje: 'Llevas doce días seguidos apareciendo. Eso ya es constancia.',
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
    },

    ipsativa: [
      { icono: 'bi-moon-stars', etiqueta: 'Sueño', valor: '6.2 h', delta: '−0.8 h vs. tu promedio', tendencia: 'baja' },
      { icono: 'bi-battery-half', etiqueta: 'Energía', valor: 'Media', delta: 'Igual que tu promedio', tendencia: 'igual' },
      { icono: 'bi-people', etiqueta: 'Tiempo con gente', valor: 'Bajo', delta: '3 días seguidos', tendencia: 'baja' },
      { icono: 'bi-lightning-charge', etiqueta: 'Concentración', valor: 'Media', delta: '+1 vs. la semana pasada', tendencia: 'sube' },
    ],

    entradas: [
      { fecha: diasAtras(0), animo: 'pesado', texto: 'Hoy me costó levantarme. No pasó nada malo, solo no tenía ganas.', etiquetas: ['sueño corto', 'poca energía'] },
      { fecha: diasAtras(1), animo: 'normal', texto: 'Salí a jugar con los del barrio. Estuvo tranquilo.', etiquetas: ['tiempo con gente'] },
      { fecha: diasAtras(2), animo: 'pesado', texto: 'Discutí con mi mamá por lo del colegio. Ya se pasó.', etiquetas: ['tensión en casa'] },
      { fecha: diasAtras(4), animo: 'bien', texto: 'Me fue bien en el examen de mate. No me lo esperaba.', etiquetas: ['logro'] },
    ],

    constancia: Array.from({ length: 35 }, (_, i) => {
      const fecha = new Date(hoy.getTime() - (34 - i) * 86400000);
      const nivel = [0, 1, 2, 3, 4][Math.floor(Math.abs(Math.sin(i * 1.7)) * 4.99)];
      return { fecha: fecha.toISOString(), nivel: i > 32 && nivel === 0 ? 2 : nivel };
    }),

    insignias: [
      { nombre: 'Primera vez', icono: 'bi-flag', obtenida: true, detalle: 'Tu primer check-in' },
      { nombre: 'Siete seguidos', icono: 'bi-calendar-check', obtenida: true, detalle: 'Una semana completa' },
      { nombre: 'Respiro', icono: 'bi-wind', obtenida: true, detalle: '5 ejercicios de respiración' },
      { nombre: 'Red armada', icono: 'bi-diagram-3', obtenida: false, detalle: 'Definí a 3 personas de confianza' },
      { nombre: 'Un mes', icono: 'bi-award', obtenida: false, detalle: '30 días de constancia' },
      { nombre: 'Cápsulas', icono: 'bi-collection-play', obtenida: false, detalle: 'Viste 10 cápsulas semanales' },
    ],

    redApoyo: [
      { id: 'c1', nombre: 'Doña Marta Ortega', relacion: 'Mamá', orden: 1, excluido: false, canal: 'WhatsApp' },
      { id: 'c2', nombre: 'Prof. Karla Mendoza', relacion: 'Orientadora del colegio', orden: 2, excluido: false, canal: 'Sistema' },
      { id: 'c3', nombre: 'Tío Bayardo', relacion: 'Tío / entrenador de fútbol', orden: 3, excluido: false, canal: 'WhatsApp' },
      { id: 'c4', nombre: 'Papá', relacion: 'Papá', orden: 4, excluido: true, canal: '—' },
    ],

    capsulas: [
      { titulo: 'Dormir poco te cambia el día entero', tag: 'Esta semana', duracion: '45 s', tono: 'frio' },
      { titulo: 'Cómo se le dice a alguien que no estás bien', tag: 'Conversar', duracion: '1 min', tono: 'frio' },
      { titulo: 'Aburrirse también es parte de crecer', tag: 'Sin drama', duracion: '38 s', tono: 'calido' },
      { titulo: 'Cuando un amigo te cuenta algo pesado', tag: 'Entre pares', duracion: '55 s', tono: 'frio' },
    ],

    /* --- Orientador ------------------------------------------------------ */
    casos: [
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
    ],

    supervision: [
      { caso: 'CS-108', pregunta: '¿Se sostiene en Nivel 2 o baja a Nivel 1?', desde: diasAtras(3), orientador: 'Karla Mendoza' },
      { caso: 'CS-097', pregunta: 'Confirmación de atención a 30 días pendiente.', desde: diasAtras(2), orientador: 'Karla Mendoza' },
    ],

    /* --- Institución / auditoría ----------------------------------------- */
    institucional: {
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
    },

    /* --- Gemelo digital comunitario --------------------------------------- */
    comunitario: {
      clima: 'parcial',
      titular: 'El clima del centro se parece a su propio promedio de marzo',
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
    },
  };

  /* ========================================================================
     Respaldo del check-in conversacional

     Solo se usa cuando el backend no responde. No es el guion fijo de antes:
     es un banco por componente del que se elige al azar, así que dos sesiones
     seguidas no traen las mismas preguntas. Peor que el modelo, pero no se
     siente un formulario.
     ======================================================================== */

  const BANCO_LOCAL = {
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

  const COMPONENTES_LOCAL = ['animo', 'sueno', 'energia', 'vinculo', 'concentracion'];
  const REACCIONES_LOCAL = ['Anotado.', 'Vale, gracias por decirlo.', 'Listo, lo guardo.', 'Ok, me sirve saberlo.'];
  const alAzar = (lista) => lista[Math.floor(Math.random() * lista.length)];

  function turnoLocal(sesion) {
    const cubiertos = sesion.map((t) => t.componente);
    const pendientes = COMPONENTES_LOCAL.filter((c) => !cubiertos.includes(c));
    const componente = pendientes.length ? pendientes[0] : 'libre';
    const elegido = alAzar(BANCO_LOCAL[componente]);

    return {
      reaccion: sesion.length === 0 ? '' : alAzar(REACCIONES_LOCAL),
      pregunta: elegido.pregunta,
      componente,
      formato: elegido.formato || 'opciones',
      opciones: elegido.opciones || [],
      cierre: componente === 'libre',
      generado: false,
      turno: sesion.length + 1,
    };
  }

  /* ========================================================================
     Endpoints
     ======================================================================== */

  return {
    token,

    async login(email, password) {
      return conRespaldo(
        () => request('/auth/login', { metodo: 'POST', cuerpo: { email, password }, auth: false }),
        () => ({ token: 'demo-token', usuario: null, demo: true }),
      );
    },

    async registrar(datos) {
      return conRespaldo(
        () => request('/auth/register', { metodo: 'POST', cuerpo: datos, auth: false }),
        () => ({ id: 'demo', ...datos, demo: true }),
      );
    },

    perfilesDemo: () => DEMO.perfiles,

    gemelo: () => conRespaldo(() => request('/comunitario/gemelo'), () => DEMO.gemelo),
    ipsativa: () => Promise.resolve(DEMO.ipsativa),
    entradas: () => conRespaldo(() => request('/registros'), () => DEMO.entradas),
    constancia: () => Promise.resolve(DEMO.constancia),
    insignias: () => Promise.resolve(DEMO.insignias),
    capsulas: () => Promise.resolve(DEMO.capsulas),

    redApoyo: () => Promise.resolve(LM.store.get('redApoyo') || DEMO.redApoyo),
    guardarRedApoyo: (lista) => Promise.resolve(LM.store.set('redApoyo', lista)),

    casos: () => conRespaldo(() => request('/alertas'), () => DEMO.casos),
    supervision: () => Promise.resolve(DEMO.supervision),
    institucional: () => Promise.resolve(DEMO.institucional),
    comunitario: () => conRespaldo(() => request('/comunitario/radar'), () => DEMO.comunitario),

    /**
     * Pide el siguiente intercambio del check-in.
     *
     * Se manda la sesión completa en cada llamada: el backend no guarda estado
     * conversacional, así que este endpoint es idempotente por turno y
     * recargar la página no deja un check-in a medias en la base.
     */
    async turnoCheckin(sesion) {
      return conRespaldoSiempre(
        () => request('/ia/checkin/turno', { metodo: 'POST', cuerpo: { sesion } }),
        () => turnoLocal(sesion),
      );
    },

    /** Cierra el check-in. El ICVE y el análisis se calculan en el servidor. */
    async enviarCheckin(payload) {
      return conRespaldoSiempre(
        () => request('/registros', { metodo: 'POST', cuerpo: payload }),
        () => {
          const historial = LM.store.get('checkins', []);
          historial.unshift({ ...payload, fecha: new Date().toISOString() });
          LM.store.set('checkins', historial.slice(0, 60));
          return {
            demo: true,
            coach: 'Gracias por aparecer hoy. Queda guardado.',
            factores: [],
            contencion: null,
          };
        },
      );
    },
  };
})();

window.API = API;
