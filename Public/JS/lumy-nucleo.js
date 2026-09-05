/* ===========================================================================
 * Lumy — núcleo geométrico
 * ---------------------------------------------------------------------------
 * Toda la aritmética que convierte una pose en trazos y matrices. Sin DOM,
 * sin navegador: solo entra un objeto de pose y salen cadenas.
 *
 * Existe para que haya UNA sola implementación. La consumen dos cosas:
 *
 *   - Public/JS/lumy.js        → la aplica sobre nodos SVG, 60 veces por segundo
 *   - tools/lumy-exportar-svg  → la interpola en una plantilla, una vez
 *
 * Si estuviera duplicada, el día que alguien corrigiera el párpado en el rig
 * los SVG que se importan a Rive quedarían distintos de lo que ve el
 * estudiante, y nadie se enteraría hasta mucho después. Con el núcleo
 * compartido, el archivo exportado y el cuadro que dibuja el navegador salen
 * de la misma cuenta.
 * =========================================================================== */

(function (raiz, fabrica) {
  const emociones = (typeof module === 'object' && module.exports)
    ? require('./lumy-emociones.js')
    : raiz.LumyEmociones;
  const api = fabrica(emociones);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else raiz.LumyNucleo = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (E) {
  'use strict';

  const { GEO, PALETAS, BASE } = E;

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
  const n = (v) => Number(v.toFixed(3));

  /* --- Color ---------------------------------------------------------- */

  function hexARgb(hex) {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function rgbAHex(c) {
    return '#' + c.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  }
  /**
   * Los extremos se cortocircuitan a propósito. Sin eso, `t = 0` devolvería el
   * color de origen pasado por RGB y de vuelta: mismo color, pero reescrito en
   * minúsculas y expuesto a un redondeo. Al terminar una transición hacia
   * `neutral` los valores tienen que caer EXACTAMENTE en los del archivo
   * original, no en algo equivalente. Es lo que sostiene la garantía de que el
   * reposo del rig es el SVG que ya está en producción.
   */
  function mezclarColor(a, b, t) {
    if (a === b || t <= 0) return a;
    if (t >= 1) return b;
    const x = hexARgb(a), y = hexARgb(b);
    return rgbAHex([lerp(x[0], y[0], t), lerp(x[1], y[1], t), lerp(x[2], y[2], t)]);
  }

  /* --- Poses ---------------------------------------------------------- */

  /** Expande la clave de paleta a colores concretos. */
  function resolver(pose) {
    const out = Object.assign({}, pose);
    const p = PALETAS[pose.paleta] || PALETAS.menta;
    out.cuerpo = p.cuerpo.slice();
    out.tinta = p.tinta;
    out.halo = p.halo;
    out.rim = p.rim;
    return out;
  }

  /** Interpola dos poses ya resueltas. */
  function mezclarPose(a, b, t) {
    const out = {};
    for (const k in BASE) {
      if (k === 'paleta') continue;
      out[k] = lerp(a[k], b[k], t);
    }
    const pa = PALETAS[a.paleta] || PALETAS.menta;
    const pb = PALETAS[b.paleta] || PALETAS.menta;
    out.cuerpo = pa.cuerpo.map((c, i) => mezclarColor(c, pb.cuerpo[i], t));
    out.tinta = mezclarColor(pa.tinta, pb.tinta, t);
    out.halo = mezclarColor(pa.halo, pb.halo, t);
    out.rim = mezclarColor(pa.rim, pb.rim, t);
    return out;
  }

  /** El bucle de reposo en reposo: lo que usa el exportador y el primer cuadro. */
  const RITMO_NULO = Object.freeze({ y: 0, rot: 0, esc: 1, tx: 0, ty: 0, parpadeo: 1 });

  /* --- Matrices -------------------------------------------------------
   * Todas hornean el pivote dentro de la propia matriz (T · P · R · S · P⁻¹).
   * Así el resultado vale igual como atributo `transform` que como propiedad
   * CSS con `transform-box: view-box; transform-origin: 0 0`, que es lo que
   * permite que el rig y el exportador compartan estas funciones.
   * ------------------------------------------------------------------- */

  /**
   * @param unidad 'px' para la propiedad CSS `transform`; '' (o nada) para el
   *   atributo `transform` del SVG. No es solo cosmético: la propiedad CSS
   *   exige unidad en las longitudes y ángulo con `deg`, mientras que el
   *   atributo los quiere pelados y falla en silencio si le llega `deg`. El
   *   rig usa 'px' y el exportador '' — misma cuenta, dos gramáticas.
   */
  function matriz(x, y, px, py, rot, sx, sy, unidad) {
    const u = unidad || '';
    const ang = u === 'px' ? `${n(rot)}deg` : `${n(rot)}`;
    return `translate(${n(x)}${u}, ${n(y)}${u}) translate(${px}${u}, ${py}${u}) `
         + `rotate(${ang}) scale(${n(sx)}, ${n(sy)}) translate(${-px}${u}, ${-py}${u})`;
  }

  /** Cuerpo. El pivote viaja entre el centro del blob y su base: el pivote
   *  bajo es lo que hace que la tristeza se desinfle en vez de encogerse. */
  function trCuerpo(p, r, unidad) {
    r = r || RITMO_NULO;
    const px = GEO.centroCuerpo[0];
    const py = lerp(GEO.centroCuerpo[1], GEO.baseCuerpo[1], p.cuerpoPivote);
    return matriz(p.cuerpoX + r.tx, p.cuerpoY + r.y + r.ty, px, py,
                  p.cuerpoRot + r.rot, p.cuerpoSX * r.esc, p.cuerpoSY * r.esc, unidad);
  }

  /** Cara. Hereda una fracción del cuerpo: al 100 % los ojos se deformarían
   *  con cada squash y el personaje se vuelve de goma; al 0 % la cara flota
   *  despegada. 50 % de la traslación y 35 % de la escala es donde deja de
   *  notarse cualquiera de las dos cosas. */
  function trCara(p, r, unidad) {
    r = r || RITMO_NULO;
    const cx = p.cuerpoX + r.tx;
    const cy = p.cuerpoY + r.y + r.ty;
    const sx = p.cuerpoSX * r.esc;
    const sy = p.cuerpoSY * r.esc;
    return matriz(cx * 0.5 + p.caraX, cy * 0.5 + p.caraY, 120, 124,
                  (p.cuerpoRot + r.rot) * 0.4 + p.caraRot,
                  (1 + (sx - 1) * 0.35) * p.caraS,
                  (1 + (sy - 1) * 0.35) * p.caraS, unidad);
  }

  function trAura(p, unidad) {
    return matriz(0, 0, GEO.halo.cx, GEO.halo.cy, 0, p.auraS, p.auraS, unidad);
  }

  function trRubor(p, i, unidad) {
    const b = GEO.rubor[i];
    return matriz(0, 0, b.cx, b.cy, 0, p.ruborS, p.ruborS, unidad);
  }

  /** Las chispas de marca se emiten como atributo, no como CSS: son el
   *  asterisco del logo y su escala base ya vive en el path. */
  function trChispa(p, i) {
    const c = GEO.chispas[i];
    return `translate(${c.x} ${c.y}) scale(${n(c.s * p.chispasS)})`;
  }

  /* --- Ojos ------------------------------------------------------------ */

  /** Los tres valores que dependen del lado y de la asimetría, en un solo
   *  lugar: `confusion` es la única emoción que despareja los ojos. */
  function ojoLado(lado, p, asimetria, parpadeo) {
    const a = asimetria || {};
    const der = lado === 'der';
    return {
      abre: (der && a.ojoAbreDer != null ? a.ojoAbreDer : p.ojoAbre) * (parpadeo == null ? 1 : parpadeo),
      y:    p.ojoY + (der && a.ojoYDer != null ? a.ojoYDer : 0),
      sy:   p.ojoSY * (der && a.ojoSYDer != null ? a.ojoSYDer : 1),
    };
  }

  function trOjo(lado, p, unidad) {
    const u = unidad || '';
    const base = GEO.ojos[lado];
    const sep = lado === 'izq' ? -p.ojoSep : p.ojoSep;
    return `translate(${n(base[0] + sep)}${u}, ${base[1]}${u})`;
  }

  function trOjoMov(lado, p, asimetria, unidad) {
    const u = unidad || '';
    const l = ojoLado(lado, p, asimetria, 1);
    return `translate(${n(p.ojoX)}${u}, ${n(l.y)}${u}) scale(${n(p.ojoSX)}, ${n(l.sy)})`;
  }

  /**
   * El párpado, como polígono de recorte.
   *
   * Es un RECORTE, no un dibujo: al cerrarse deja ver el gradiente del cuerpo
   * que ya estaba debajo, que es exactamente lo que hace un párpado sobre un
   * personaje translúcido. Por eso Lumy puede cerrar los ojos sin que haya que
   * inventarle un color de piel.
   *
   * `ojoAng` inclina el borde superior: baja la esquina interna y sube la
   * externa. Ese gesto es el que lee como ceño fruncido SIN que exista una
   * ceja — Lumy no tiene y no se le agrega ninguna. Con el signo invertido da
   * la ceja preocupada de la tristeza y el miedo.
   */
  function parpado(lado, p, asimetria, parpadeo) {
    const l = ojoLado(lado, p, asimetria, parpadeo);
    const arriba = -18 + (1 - clamp(l.abre, 0, 1)) * 32;
    const abajo = 18 - p.ojoAbajo * 30;
    const interno = n(arriba + p.ojoAng * 1.2);
    const externo = n(arriba - p.ojoAng * 0.4);
    return lado === 'izq'
      ? `-20,${externo} 20,${interno} 20,${n(abajo)} -20,${n(abajo)}`
      : `-20,${interno} 20,${externo} 20,${n(abajo)} -20,${n(abajo)}`;
  }

  /** Ojo cerrado en arco: ∩ contento con `ojoArcoC` positivo, ∪ triste con
   *  negativo. Se funde con el ojo abierto mediante `ojoArco`. */
  function arcoOjo(p) {
    return `M -11 2 Q 0 ${n(2 - 11 * p.ojoArcoC)} 11 2`;
  }

  /* --- Boca ------------------------------------------------------------ */

  /**
   * La boca se emite como cadena de cuadráticas en vez de una sola, para que
   * `bocaOnda` (el temblor de los nervios) pueda deformar el trazo sin cambiar
   * de tipo de path a mitad de una transición.
   *
   * Partirla no cuesta precisión. Para una cuadrática de control P0,P1,P2 la
   * forma polar es
   *
   *     f(u,v) = P0(1−u)(1−v) + P1[(1−u)v + u(1−v)] + P2·u·v
   *
   * y la subcurva sobre [t0,t1] tiene extremos f(t0,t0), f(t1,t1) y control
   * f(t0,t1). Es una identidad, no una aproximación: con `bocaOnda` en 0 el
   * trazo es exactamente "M109 136 Q120 147.5 131 136", el del archivo
   * original. Verificado con un diff de píxeles a 2x.
   *
   * El path siempre cierra. Con `bocaAbre` en 0 el borde inferior cae encima
   * del superior, el área es nula y no se ve relleno: una sola forma sirve
   * para la boca cerrada y para la abierta.
   */
  function boca(p) {
    const g = GEO.boca;
    const cx = 120 + p.bocaX;
    const semi = 11 * p.bocaAncho;
    const y = g.y + p.bocaY;
    const ctrl = y + g.ctrl * p.bocaCurva;

    const P0 = [cx - semi, y], P1 = [cx, ctrl], P2 = [cx + semi, y];
    const f = (u, v) => [
      P0[0] * (1 - u) * (1 - v) + P1[0] * ((1 - u) * v + u * (1 - v)) + P2[0] * u * v,
      P0[1] * (1 - u) * (1 - v) + P1[1] * ((1 - u) * v + u * (1 - v)) + P2[1] * u * v,
    ];
    // Tres medios ciclos a lo ancho: suficiente para leer "temblor" sin que
    // se vuelva un zigzag de dientes de sierra.
    const onda = (pt, t) =>
      `${n(pt[0])} ${n(pt[1] + p.bocaOnda * 2.6 * Math.sin(t * Math.PI * 3))}`;

    const N = 6;
    const inicio = onda(f(0, 0), 0);
    let d = `M ${inicio}`;
    for (let i = 0; i < N; i++) {
      const t0 = i / N, t1 = (i + 1) / N;
      d += ` Q ${onda(f(t0, t1), (t0 + t1) / 2)} ${onda(f(t1, t1), t1)}`;
    }
    return `${d} Q ${n(cx)} ${n(ctrl + p.bocaAbre * 26)} ${inicio} Z`;
  }

  /* --- Opacidades derivadas -------------------------------------------- */

  /** Las que no son un canal directo sino un canal por un valor del archivo
   *  original (el rubor va al 0.42 que traía el SVG, por ejemplo). */
  function opacidades(p) {
    return {
      rubor: clamp(0.42 * p.ruborOp, 0, 1),
      chispas: clamp(p.chispasOp, 0, 1),
      aura: clamp(p.auraOp, 0, 1.5),
      brillos: clamp(p.brilloOp, 0, 1),
      ojoBrillo: clamp(p.ojoBrillo, 0, 1.5),
      ojoAbierto: 1 - clamp(p.ojoArco, 0, 1),
      ojoArco: clamp(p.ojoArco, 0, 1),
    };
  }

  /** Valor de una capa de efecto a partir del nombre corto ('lagrima' → fxLagrima). */
  function valorFx(p, clave) {
    return clamp(p['fx' + clave[0].toUpperCase() + clave.slice(1)] || 0, 0, 1);
  }

  return {
    lerp, clamp, mezclarColor, mezclarPose, resolver,
    RITMO_NULO, matriz,
    trCuerpo, trCara, trAura, trRubor, trChispa,
    trOjo, trOjoMov, ojoLado, parpado, arcoOjo,
    boca, opacidades, valorFx,
    VERSION: '1.0.0',
  };
});
