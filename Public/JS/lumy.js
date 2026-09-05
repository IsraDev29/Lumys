/* ===========================================================================
 * Lumy — rig de animación
 * ---------------------------------------------------------------------------
 * Construye el SVG de la mascota con las partes separadas y direccionables, y
 * las deforma según la pose de una emoción.
 *
 *   lumy-emociones.js  → qué es cada emoción (las poses)
 *   lumy-nucleo.js     → cómo una pose se vuelve trazos y matrices
 *   lumy.js  (acá)     → cuándo y sobre qué nodos se aplica
 *
 * PRINCIPIO: la geometría NO se reemplaza, se deforma.
 * Cada coordenada sale de LumyEmociones.GEO, que es una transcripción literal
 * de Public/img/lumys-mascota.svg. En reposo (`neutral`, sin ritmo) el rig
 * dibuja el mismo trazo que el archivo original — mismos paths, mismos radios,
 * mismo gradiente, mismo halo. Ningún rasgo se agrega ni se quita: los
 * párpados son recortes sobre el ojo que ya existía, y el ceño fruncido se
 * hace inclinando ese recorte, no dibujando cejas.
 *
 * Por qué las transformaciones van por `style.transform` y no por el atributo
 * `transform`: con `transform-box: view-box` y `transform-origin: 0 0` las
 * unidades CSS coinciden una a una con las del viewBox, así que sirve la misma
 * aritmética que usaría el atributo, pero además es una propiedad CSS real,
 * animable y compuesta fuera del hilo principal.
 *
 * Uso:
 *     const lumy = Lumy.crear(document.querySelector('#lumy'));
 *     lumy.setEmocion('alegria');
 *     lumy.setEmocion('tristeza', { espejo: true });   // ver banda de seguridad
 *
 * O, sin tocar el HTML existente:
 *     Lumy.mejorar();      // reemplaza los <img src=".../lumys-mascota.svg">
 * =========================================================================== */

const Lumy = (function () {
  'use strict';

  const E = (typeof LumyEmociones !== 'undefined') ? LumyEmociones : null;
  if (!E) throw new Error('Lumy: falta lumy-emociones.js, tiene que cargarse antes.');
  const N = (typeof LumyNucleo !== 'undefined') ? LumyNucleo : null;
  if (!N) throw new Error('Lumy: falta lumy-nucleo.js, tiene que cargarse antes.');

  const { GEO, PALETAS, EMOCIONES } = E;
  const { clamp, mezclarPose, resolver } = N;
  const NS = 'http://www.w3.org/2000/svg';

  let contador = 0;   // sufijo para los ids de <defs>: puede haber varios Lumy por página

  /* =====================================================================
   * Curvas de tiempo
   * =================================================================== */

  /** Cúbica de salida: arranca rápido y asienta. Es la que mejor lee para
   *  gestos de cara — el ojo espera que el gesto llegue y se detenga. */
  const suave = (t) => 1 - Math.pow(1 - t, 3);

  /** Con sobrepaso corto. Solo para emociones de aparición brusca, donde el
   *  rebote es parte de lo que se lee. */
  const rebote = (t) => {
    const c = 1.70158 * 1.2;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  };

  const CON_REBOTE = new Set(['euforia', 'sorpresa', 'asombro', 'alegria', 'admiracion']);

  /* =====================================================================
   * Construcción del SVG
   * ---------------------------------------------------------------------
   * Se escribe como cadena una sola vez y se parsea. Es más legible que
   * cincuenta createElementNS y, al ser una sola operación, no fuerza
   * reflows intermedios.
   * =================================================================== */

  function construirSVG(id) {
    const g = GEO;
    const [dx, dy] = g.desfase;
    const pal = PALETAS.menta;

    const motas = g.motas.map((m) => `<circle cx="${m.cx}" cy="${m.cy}" r="${m.r}"/>`).join('');

    const rubor = g.rubor.map((r, i) =>
      `<ellipse class="lumy-rubor" data-i="${i}" cx="${r.cx}" cy="${r.cy}" rx="${r.rx}" ry="${r.ry}"/>`
    ).join('');

    const chispas = g.chispas.map((c, i) =>
      `<path class="lumy-chispa" data-i="${i}" d="${g.chispaPath}" fill="${c.color}" opacity="${c.op}"/>`
    ).join('');

    // Un ojo. Se instancia dos veces; el lado decide el espejado del párpado.
    const ojo = (lado) => {
      const brillos = g.brillosOjo
        .map((b) => `<circle cx="${b.dx}" cy="${b.dy}" r="${b.r}"/>`).join('');
      return `
      <g class="lumy-ojo" data-lado="${lado}">
        <g class="lumy-ojo__mov">
          <g class="lumy-ojo__abierto" clip-path="url(#lumy-parpado-${lado}-${id})">
            <ellipse class="lumy-ojo__globo" rx="${g.ojos.rx}" ry="${g.ojos.ry}"/>
            <g class="lumy-ojo__brillo" fill="#FFF7ED">${brillos}</g>
          </g>
          <path class="lumy-ojo__arco" fill="none" stroke-width="4" stroke-linecap="round" opacity="0"/>
        </g>
      </g>`;
    };

    return `
<svg class="lumy" viewBox="${g.viewBox}" xmlns="${NS}" role="img" aria-labelledby="lumy-t-${id}">
  <title id="lumy-t-${id}">Lumy</title>
  <defs>
    <radialGradient cx="33%" cy="22%" r="86%" id="lumy-cuerpo-${id}">
      ${pal.cuerpo.map((c, i) => `<stop offset="${[0, 26, 52, 76, 100][i]}%" stop-color="${c}"/>`).join('')}
    </radialGradient>
    <linearGradient x1="0" y1="0.48" x2="0.18" y2="1" id="lumy-rim-${id}">
      <stop class="lumy-s-rim" offset="0%" stop-color="${pal.rim}" stop-opacity="0"/>
      <stop class="lumy-s-rim" offset="100%" stop-color="${pal.rim}" stop-opacity="0.42"/>
    </linearGradient>
    <radialGradient cx="50%" cy="50%" r="50%" id="lumy-core-${id}">
      <stop offset="0%" stop-color="#FFF7ED" stop-opacity="0.62"/>
      <stop offset="100%" stop-color="#FFF7ED" stop-opacity="0"/>
    </radialGradient>
    <radialGradient cx="50%" cy="50%" r="50%" id="lumy-halo-${id}">
      <stop class="lumy-s-halo" offset="52%" stop-color="${pal.halo}" stop-opacity="0.34"/>
      <stop class="lumy-s-halo" offset="100%" stop-color="${pal.halo}" stop-opacity="0"/>
    </radialGradient>
    <filter id="lumy-soft-${id}" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="8"/>
    </filter>
    <filter id="lumy-soft2-${id}" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="4"/>
    </filter>
    <clipPath id="lumy-parpado-izq-${id}"><polygon points="-20,-18 20,-18 20,18 -20,18"/></clipPath>
    <clipPath id="lumy-parpado-der-${id}"><polygon points="-20,-18 20,-18 20,18 -20,18"/></clipPath>
  </defs>

  <g class="lumy-mundo" transform="translate(${dx} ${dy})">

    <g class="lumy-fx lumy-fx--tras"></g>

    <ellipse class="lumy-aura" cx="${g.halo.cx}" cy="${g.halo.cy}" rx="${g.halo.rx}" ry="${g.halo.ry}"
             fill="url(#lumy-halo-${id})"/>

    <g class="lumy-cuerpo">
      <path class="lumy-blob" d="${g.blob}" fill="url(#lumy-cuerpo-${id})"/>
      <path class="lumy-rim"  d="${g.blob}" fill="url(#lumy-rim-${id})"/>
      <ellipse class="lumy-core" cx="${g.core.cx}" cy="${g.core.cy}" rx="${g.core.rx}" ry="${g.core.ry}"
               fill="url(#lumy-core-${id})"/>
      <g class="lumy-brillos">
        <g filter="url(#lumy-soft-${id})" opacity="0.7">
          <ellipse cx="${g.brilloSuave.cx}" cy="${g.brilloSuave.cy}"
                   rx="${g.brilloSuave.rx}" ry="${g.brilloSuave.ry}"
                   transform="rotate(${g.brilloSuave.rot} ${g.brilloSuave.cx} ${g.brilloSuave.cy})"
                   fill="#FFF7ED"/>
        </g>
        <ellipse cx="${g.brilloDuro.cx}" cy="${g.brilloDuro.cy}"
                 rx="${g.brilloDuro.rx}" ry="${g.brilloDuro.ry}"
                 transform="rotate(${g.brilloDuro.rot} ${g.brilloDuro.cx} ${g.brilloDuro.cy})"
                 fill="#FFF7ED" opacity="0.9"/>
        <g class="lumy-motas" fill="#FFF7ED" opacity="0.65">${motas}</g>
      </g>
    </g>

    <g class="lumy-cara">
      <g class="lumy-ruboes" filter="url(#lumy-soft2-${id})" fill="#C2410C" opacity="0.42">${rubor}</g>
      <g class="lumy-ojos">${ojo('izq')}${ojo('der')}</g>
      <path class="lumy-boca" stroke-linecap="round" stroke-linejoin="round"/>
    </g>

    <g class="lumy-chispas">${chispas}</g>

    <g class="lumy-fx lumy-fx--frente"></g>
  </g>
</svg>`;
  }

  /* =====================================================================
   * Capas de efecto
   * ---------------------------------------------------------------------
   * Lágrimas, gotas, espirales, confeti… Son elementos ADICIONALES, no
   * rasgos: viven fuera del cuerpo, en grupos que están vacíos en reposo, y
   * no alteran la silueta. Todos aparecen en las láminas de referencia que
   * definió el equipo de marca.
   * =================================================================== */

  const FX = {
    lagrima: { capa: 'frente', svg: `
      <g fill="#7FC6E8" opacity="0.9">
        <path class="lumy-fx-gota" d="M96 128 c0 0 5.5 8.4 5.5 12.2 a5.5 5.5 0 0 1-11 0 C90.5 136.4 96 128 96 128 Z"/>
        <path class="lumy-fx-gota" d="M144 130 c0 0 4.6 7 4.6 10.2 a4.6 4.6 0 0 1-9.2 0 C139.4 137 144 130 144 130 Z"/>
      </g>` },

    sudor: { capa: 'frente', svg: `
      <g fill="#8ED3EE" opacity="0.92">
        <path class="lumy-fx-gota" d="M168 72 c0 0 6 9.2 6 13.3 a6 6 0 0 1-12 0 C162 81.2 168 72 168 72 Z"/>
      </g>` },

    espiral: { capa: 'frente', svg: `
      <g fill="none" stroke="#0F766E" stroke-width="2.4" stroke-linecap="round" opacity="0.55">
        <path class="lumy-fx-giro" d="M84 78 a7 7 0 1 1-6.4 4.2 a11 11 0 1 0 12.6-6.6"/>
        <path class="lumy-fx-giro" d="M158 82 a5.4 5.4 0 1 1-5 3.2 a8.6 8.6 0 1 0 9.8-5.2"/>
      </g>` },

    confeti: { capa: 'frente', svg: `
      <g class="lumy-fx-confeti">
        <rect x="60"  y="58"  width="5" height="9" rx="2" fill="#C2410C" transform="rotate(24 62 62)"/>
        <rect x="182" y="72"  width="5" height="9" rx="2" fill="#2A9D8C" transform="rotate(-38 184 76)"/>
        <rect x="72"  y="176" width="5" height="9" rx="2" fill="#E2C069" transform="rotate(52 74 180)"/>
        <rect x="176" y="160" width="5" height="9" rx="2" fill="#6FCBBB" transform="rotate(-16 178 164)"/>
        <circle cx="52" cy="112" r="3.1" fill="#E2C069"/>
        <circle cx="196" cy="128" r="2.7" fill="#C2410C"/>
        <circle cx="104" cy="42"  r="2.4" fill="#2A9D8C"/>
      </g>` },

    corazon: { capa: 'frente', svg: `
      <g fill="#E08FA8" opacity="0.85">
        <path class="lumy-fx-corazon" transform="translate(180 78) scale(0.62)"
              d="M0 12 C-14 2-14-10-6-13 C-2-14.6 0-11.6 0-9.4 C0-11.6 2-14.6 6-13 C14-10 14 2 0 12 Z"/>
        <path class="lumy-fx-corazon" transform="translate(196 104) scale(0.4)" opacity="0.7"
              d="M0 12 C-14 2-14-10-6-13 C-2-14.6 0-11.6 0-9.4 C0-11.6 2-14.6 6-13 C14-10 14 2 0 12 Z"/>
      </g>` },

    vapor: { capa: 'tras', svg: `
      <g fill="none" stroke="#DD8B63" stroke-width="3" stroke-linecap="round" opacity="0.55">
        <path class="lumy-fx-vapor" d="M74 50 c-4-6 4-10 0-16"/>
        <path class="lumy-fx-vapor" d="M120 40 c-4-7 4-11 0-18"/>
        <path class="lumy-fx-vapor" d="M166 50 c-4-6 4-10 0-16"/>
      </g>` },

    lineas: { capa: 'tras', svg: `
      <g stroke="#0F766E" stroke-width="3" stroke-linecap="round" opacity="0.4">
        <path d="M32 60 l-11-9"/>  <path d="M120 26 l0-13"/>  <path d="M208 60 l11-9"/>
        <path d="M26 130 l-13 3"/> <path d="M214 130 l13 3"/>
      </g>` },

    // A escala 1 y en su sitio original la nube se sale por arriba del viewBox:
    // el borde superior del blob está a y=15 y no queda hueco. Reducida y
    // corrida a la izquierda entra entera (y 3..39) y además deja de tapar la
    // cara, que es lo que tiene que seguir leyéndose.
    nube: { capa: 'tras', svg: `
      <g opacity="0.75" transform="translate(-26 14) scale(0.8)">
        <path d="M96 30 a15 15 0 0 1 28-6 a13 13 0 0 1 20 10 a11 11 0 0 1-3 21 H100 a13 13 0 0 1-4-25 Z"
              fill="#ABBDD1"/>
        <g stroke="#7095B7" stroke-width="3.4" stroke-linecap="round">
          <path class="lumy-fx-lluvia" d="M108 60 l-3 9"/>
          <path class="lumy-fx-lluvia" d="M124 58 l-3 11"/>
          <path class="lumy-fx-lluvia" d="M140 61 l-3 8"/>
        </g>
      </g>` },
  };

  const CLAVES_FX = Object.keys(FX);

  /* =====================================================================
   * La instancia
   * =================================================================== */

  function crear(contenedor, opciones = {}) {
    if (!contenedor) throw new Error('Lumy.crear: hace falta un contenedor.');

    const id = ++contador;
    contenedor.innerHTML = construirSVG(id);

    const svg = contenedor.querySelector('svg');
    const q = (sel) => svg.querySelector(sel);
    const qa = (sel) => Array.from(svg.querySelectorAll(sel));
    const ojoNodos = (lado) => ({
      g:       q(`.lumy-ojo[data-lado="${lado}"]`),
      mov:     q(`.lumy-ojo[data-lado="${lado}"] .lumy-ojo__mov`),
      abierto: q(`.lumy-ojo[data-lado="${lado}"] .lumy-ojo__abierto`),
      globo:   q(`.lumy-ojo[data-lado="${lado}"] .lumy-ojo__globo`),
      brillo:  q(`.lumy-ojo[data-lado="${lado}"] .lumy-ojo__brillo`),
      arco:    q(`.lumy-ojo[data-lado="${lado}"] .lumy-ojo__arco`),
      parpado: q(`#lumy-parpado-${lado}-${id} polygon`),
    });

    const nodo = {
      svg,
      cuerpo:    q('.lumy-cuerpo'),
      cara:      q('.lumy-cara'),
      aura:      q('.lumy-aura'),
      brillos:   q('.lumy-brillos'),
      ruboes:    q('.lumy-ruboes'),
      rubor:     qa('.lumy-rubor'),
      boca:      q('.lumy-boca'),
      chispasG:  q('.lumy-chispas'),
      chispa:    qa('.lumy-chispa'),
      stops:     qa(`#lumy-cuerpo-${id} stop`),
      stopsRim:  qa('.lumy-s-rim'),
      stopsHalo: qa('.lumy-s-halo'),
      fxTras:    q('.lumy-fx--tras'),
      fxFrente:  q('.lumy-fx--frente'),
      ojo: { izq: ojoNodos('izq'), der: ojoNodos('der') },
      fx: {},
    };

    // Las capas de efecto se crean una sola vez y se controlan por opacidad.
    // Montarlas y desmontarlas en cada cambio provocaría un reflow por gesto.
    for (const clave of CLAVES_FX) {
      const cont = FX[clave].capa === 'tras' ? nodo.fxTras : nodo.fxFrente;
      const env = document.createElementNS(NS, 'g');
      env.setAttribute('class', `lumy-fx__${clave}`);
      env.style.opacity = '0';
      env.style.display = 'none';
      env.innerHTML = FX[clave].svg;
      cont.appendChild(env);
      nodo.fx[clave] = env;
    }

    /* --- Estado ---------------------------------------------------- */
    const inicial = opciones.emocion || 'neutral';
    const est = {
      emocion: inicial,
      desde: resolver(E.pose('neutral')),
      hasta: resolver(E.pose(inicial)),
      actual: resolver(E.pose(inicial)),
      asimetria: (EMOCIONES[inicial] || {}).asimetria || null,
      t0: 0,
      dur: 0,
      curva: suave,
      raf: null,
      vivo: true,
      // Fases desfasadas para que dos Lumy en la misma pantalla no floten en
      // sincronía — eso delata que son un widget y no un personaje.
      fase: Math.random() * 100,
      proxParpadeo: 1.5 + Math.random() * 3,
      parpadeoHasta: -1,
      reposo: opciones.reposo !== false,
    };

    const reducido = () =>
      (typeof LM !== 'undefined' && LM.reduceMotion)
        ? LM.reduceMotion()
        : window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* --- Pintado ---------------------------------------------------- */

    /**
     * Vuelca una pose al DOM. `ritmo` trae los desplazamientos del bucle de
     * reposo (flotado, respiración, temblor, parpadeo), que se suman a la pose
     * sin ensuciarla: la pose es el destino, el ritmo es la vida encima.
     */
    function pintar(p, ritmo) {
      const r = ritmo || N.RITMO_NULO;
      const op = N.opacidades(p);

      nodo.cuerpo.style.transform = N.trCuerpo(p, r, 'px');
      nodo.cara.style.transform = N.trCara(p, r, 'px');

      nodo.aura.style.opacity = op.aura;
      nodo.aura.style.transform = N.trAura(p, 'px');
      nodo.brillos.style.opacity = op.brillos;

      nodo.ruboes.style.opacity = op.rubor;
      nodo.rubor.forEach((el, i) => { el.style.transform = N.trRubor(p, i, 'px'); });

      nodo.chispasG.style.opacity = op.chispas;
      nodo.chispa.forEach((el, i) => el.setAttribute('transform', N.trChispa(p, i)));

      pintarOjo('izq', p, r, op);
      pintarOjo('der', p, r, op);

      nodo.boca.setAttribute('d', N.boca(p));
      nodo.boca.setAttribute('stroke', p.tinta);
      nodo.boca.setAttribute('fill', p.tinta);
      nodo.boca.setAttribute('stroke-width', GEO.boca.grosor * p.bocaGrosor);

      /* Gradientes. El halo y el borde interno siguen a la paleta: si se
         quedaran en el menta y el teal del archivo original, toda emoción que
         no fuera menta arrastraría un aro verde peleando con su propio color.
         Con la paleta `menta` los valores caen exactamente donde estaban. */
      nodo.stops.forEach((s, i) => s.setAttribute('stop-color', p.cuerpo[i]));
      nodo.stopsHalo.forEach((s) => s.setAttribute('stop-color', p.halo));
      nodo.stopsRim.forEach((s) => s.setAttribute('stop-color', p.rim));

      for (const clave of CLAVES_FX) {
        const v = N.valorFx(p, clave);
        const el = nodo.fx[clave];
        // display:none cuando está apagado: un filtro o una animación CSS en
        // un nodo con opacity 0 se sigue componiendo igual.
        el.style.display = v < 0.01 ? 'none' : '';
        el.style.opacity = v;
      }
    }

    function pintarOjo(lado, p, r, op) {
      const o = nodo.ojo[lado];
      o.g.style.transform = N.trOjo(lado, p, 'px');
      o.mov.style.transform = N.trOjoMov(lado, p, est.asimetria, 'px');
      o.parpado.setAttribute('points', N.parpado(lado, p, est.asimetria, r.parpadeo));
      o.globo.setAttribute('fill', p.tinta);
      o.brillo.style.opacity = op.ojoBrillo;
      o.abierto.style.opacity = op.ojoAbierto;
      o.arco.style.opacity = op.ojoArco;
      o.arco.setAttribute('stroke', p.tinta);
      o.arco.setAttribute('d', N.arcoOjo(p));
    }

    /* --- Bucle ------------------------------------------------------- */

    function marco(ahora) {
      if (!est.vivo) return;
      const t = ahora / 1000;

      if (est.dur > 0) {
        const avance = clamp((t - est.t0) / est.dur, 0, 1);
        est.actual = mezclarPose(est.desde, est.hasta, est.curva(avance));
        if (avance >= 1) est.dur = 0;
      }

      const p = est.actual;
      const quieto = reducido() || !est.reposo;
      const f = t + est.fase;
      const ritmo = { y: 0, rot: 0, esc: 1, tx: 0, ty: 0, parpadeo: 1 };

      if (!quieto) {
        const flot = Math.sin((f / p.flotaVel) * Math.PI * 2);
        ritmo.y = -p.flota * flot;
        ritmo.rot = -1.4 * flot * (p.flota / 4.5);
        ritmo.esc = 1 + p.respira * Math.sin((f / p.respiraVel) * Math.PI * 2);

        if (p.tiembla > 0.01) {
          // Dos senos de frecuencias primas entre sí: no se repite a simple
          // vista y evita cargar un generador de ruido.
          ritmo.tx = p.tiembla * Math.sin(f * 41.3);
          ritmo.ty = p.tiembla * 0.6 * Math.sin(f * 57.7);
        }
      }

      /* Parpadeo. Va aparte del temblor porque tiene que seguir ocurriendo con
         movimiento reducido: una cara que no parpadea se lee como inanimada, y
         el parpadeo no es el tipo de movimiento que dispara malestar
         vestibular, que es lo que esa preferencia busca evitar. */
      if (t > est.proxParpadeo && est.parpadeoHasta < 0) est.parpadeoHasta = t + 0.14;
      if (est.parpadeoHasta > 0) {
        if (t > est.parpadeoHasta) {
          est.parpadeoHasta = -1;
          est.proxParpadeo = t + p.parpadeoVel * (0.55 + Math.random() * 0.9);
        } else {
          // Triángulo: cierra y abre en el mismo tiempo.
          const k = 1 - Math.abs((est.parpadeoHasta - t) / 0.07 - 1);
          ritmo.parpadeo = 1 - clamp(k, 0, 1);
        }
      }

      pintar(p, ritmo);
      est.raf = requestAnimationFrame(marco);
    }

    /* --- API de la instancia ---------------------------------------- */

    const api = {
      nodo: svg,

      /**
       * Cambia la emoción.
       *
       * @param {string} clave
       * @param {object} [op]
       * @param {number} [op.duracion]  segundos de transición
       * @param {boolean} [op.espejo]   necesario para las emociones de banda
       *                                'espejo'. Sin esto se rechazan: Lumy no
       *                                se pone triste porque el estudiante lo
       *                                esté. Ver la nota en lumy-emociones.js.
       */
      setEmocion(clave, op = {}) {
        const def = EMOCIONES[clave];
        if (!def) {
          console.warn(`Lumy: emoción desconocida "${clave}", se ignora.`);
          return api;
        }
        if (def.banda === 'espejo' && !op.espejo) {
          console.warn(
            `Lumy: "${clave}" es de banda espejo. Solo se muestra cuando el ` +
            'estudiante nombra su propia emoción; pasá { espejo: true } si ese ' +
            'es el caso. Nunca se activa sola desde el ICVE ni desde el clima.'
          );
          return api;
        }

        est.emocion = clave;
        est.desde = est.actual;
        est.hasta = resolver(E.pose(clave));
        est.asimetria = def.asimetria || null;
        est.t0 = performance.now() / 1000;
        est.dur = op.duracion != null ? op.duracion : (reducido() ? 0.15 : 0.62);
        est.curva = CON_REBOTE.has(clave) && !reducido() ? rebote : suave;

        // Duración cero es "poné esta pose ya", no "no hagas nada". El bucle
        // solo interpola cuando dur > 0, así que sin este salto la pose se
        // quedaría en la anterior para siempre.
        if (est.dur <= 0) { est.actual = est.hasta; est.dur = 0; }
        return api;
      },

      /** La emoción actual. */
      get emocion() { return est.emocion; },

      /** Fuerza un parpadeo (sirve para puntuar un cambio de turno en el chat). */
      parpadear() { est.parpadeoHasta = performance.now() / 1000 + 0.14; return api; },

      /** Dirige la mirada. Rango cómodo: −5..5 en x, −4..4 en y. */
      mirar(x, y) {
        est.actual.ojoX = clamp(x, -6, 6);
        est.actual.ojoY = clamp(y, -5, 5);
        est.hasta.ojoX = est.actual.ojoX;
        est.hasta.ojoY = est.actual.ojoY;
        return api;
      },

      /** Enciende o apaga el bucle de reposo (flotado, respiración, temblor). */
      reposo(activo) { est.reposo = activo !== false; return api; },

      destruir() {
        est.vivo = false;
        if (est.raf) cancelAnimationFrame(est.raf);
        contenedor.innerHTML = '';
      },
    };

    pintar(est.actual, null);
    est.raf = requestAnimationFrame(marco);
    return api;
  }

  /* =====================================================================
   * Reemplazo in situ
   * ---------------------------------------------------------------------
   * El HTML actual usa <img src="img/lumys-mascota.svg"> en nueve lugares. En
   * vez de reescribir cada vista, se buscan esos <img> y se cambian por un rig
   * vivo conservando clases, tamaño y texto alternativo. Si el JS no carga,
   * queda el <img> — que es el mismo dibujo, quieto.
   * =================================================================== */

  function mejorar(raiz = document, opciones = {}) {
    const creados = [];

    for (const img of Array.from(raiz.querySelectorAll('img[src*="lumys-mascota"]'))) {
      const caja = document.createElement('span');
      caja.className = 'lumy-caja ' + (img.className || '');
      // El <img> tomaba su ancho del CSS de alrededor; la caja tiene que
      // heredarlo o las vistas cambian de layout.
      const ancho = img.style.width || getComputedStyle(img).width;
      if (ancho && ancho !== 'auto') caja.style.width = ancho;
      caja.setAttribute('role', 'img');
      caja.setAttribute('aria-label', img.alt || 'Lumy');
      caja.dataset.lumyListo = '1';

      img.replaceWith(caja);
      const lumy = crear(caja, opciones);
      lumy.nodo.setAttribute('aria-hidden', 'true');
      lumy.nodo.removeAttribute('role');
      creados.push(lumy);
    }
    return creados;
  }

  return { crear, mejorar, FX: CLAVES_FX, emociones: EMOCIONES, VERSION: '1.0.0' };
})();

if (typeof window !== 'undefined') window.Lumy = Lumy;
