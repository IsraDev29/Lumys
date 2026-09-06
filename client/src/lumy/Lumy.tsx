/* ===========================================================================
 * Lumy — rig de animación
 * ---------------------------------------------------------------------------
 *   lumy/emociones.ts  → qué es cada emoción (las poses)
 *   lumy/nucleo.ts     → cómo una pose se vuelve trazos y matrices
 *   lumy/Lumy.tsx (acá)→ cuándo y sobre qué nodos se aplica
 *
 * PRINCIPIO: la geometría NO se reemplaza, se deforma.
 * Cada coordenada sale de GEO, que es una transcripción literal de
 * client/public/img/lumys-mascota.svg. En reposo (`neutral`, sin ritmo) el rig dibuja
 * el mismo trazo que el archivo original — mismos paths, mismos radios, mismo
 * gradiente, mismo halo. Ningún rasgo se agrega ni se quita: los párpados son
 * recortes sobre el ojo que ya existía, y el ceño fruncido se hace inclinando
 * ese recorte, no dibujando cejas.
 *
 * ---------------------------------------------------------------------------
 * POR QUÉ EL BUCLE NO PASA POR EL ESTADO DE REACT
 *
 * El rig repinta 60 veces por segundo. Si cada cuadro fuera un `setState`,
 * React reconciliaría el árbol entero 60 veces por segundo y por cada Lumy en
 * pantalla — y en la rejilla del laboratorio hay 33 a la vez.
 *
 * El reparto es: React posee la ESTRUCTURA (el SVG se declara en JSX y se monta
 * una sola vez, porque nunca cambia de forma) y el bucle posee los NÚMEROS (los
 * escribe por referencia directa sobre los nodos). No se pisan: ningún atributo
 * que muta el bucle está declarado en el JSX, así que React no tiene un valor
 * previo con el que "corregirlo" en el siguiente render.
 *
 * Uso:
 *     <Lumy emocion="alegria" />
 *     <Lumy emocion="tristeza" espejo />     // ver banda de seguridad
 *
 *     const lumy = useRef<ManejadorLumy>(null);
 *     lumy.current?.parpadear();
 * =========================================================================== */

import { useEffect, useId, useImperativeHandle, useRef, type CSSProperties, type Ref } from 'react';

import {
  GEO, PALETAS, EMOCIONES, CLAVES_FX, pose, asimetria as asimetriaDe,
  type Asimetria, type ClaveEmocion, type ClaveFx, type EmocionApoyo,
} from './emociones.ts';
import {
  RITMO_NULO, arcoOjo, boca, clamp, mezclarPose, opacidades, parpado, resolver,
  trAura, trCara, trChispa, trCuerpo, trOjo, trOjoMov, trRubor, valorFx,
  type Lado, type PoseResuelta, type Ritmo,
} from './nucleo.ts';
import { EFECTOS } from './efectos.tsx';

/* =====================================================================
 * Curvas de tiempo
 * =================================================================== */

/** Cúbica de salida: arranca rápido y asienta. Es la que mejor lee para
 *  gestos de cara — el ojo espera que el gesto llegue y se detenga. */
const suave = (t: number): number => 1 - Math.pow(1 - t, 3);

/** Con sobrepaso corto. Solo para emociones de aparición brusca, donde el
 *  rebote es parte de lo que se lee. */
const rebote = (t: number): number => {
  const c = 1.70158 * 1.2;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

const CON_REBOTE = new Set<ClaveEmocion>(['euforia', 'sorpresa', 'asombro', 'alegria', 'admiracion']);

/** Se consulta una vez y se escucha el cambio, en vez de preguntar por
 *  `matchMedia` en cada uno de los 60 cuadros por segundo. */
const consultaMovimiento = typeof window !== 'undefined'
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : null;
const reducido = (): boolean => consultaMovimiento?.matches ?? false;

/** Las cinco paradas del gradiente radial del cuerpo, en porcentaje. */
const PARADAS = [0, 26, 52, 76, 100];

/* =====================================================================
 * Nodos direccionables
 * =================================================================== */

type NodosOjo = {
  g: SVGGElement | null;
  mov: SVGGElement | null;
  abierto: SVGGElement | null;
  globo: SVGEllipseElement | null;
  brillo: SVGGElement | null;
  arco: SVGPathElement | null;
  parpado: SVGPolygonElement | null;
};

type Nodos = {
  cuerpo: SVGGElement | null;
  cara: SVGGElement | null;
  aura: SVGEllipseElement | null;
  brillos: SVGGElement | null;
  ruboes: SVGGElement | null;
  rubor: (SVGEllipseElement | null)[];
  boca: SVGPathElement | null;
  chispasG: SVGGElement | null;
  chispa: (SVGPathElement | null)[];
  stops: (SVGStopElement | null)[];
  stopsRim: (SVGStopElement | null)[];
  stopsHalo: (SVGStopElement | null)[];
  ojo: Record<Lado, NodosOjo>;
  fx: Partial<Record<ClaveFx, SVGGElement | null>>;
};

const nodosVacios = (): Nodos => ({
  cuerpo: null, cara: null, aura: null, brillos: null, ruboes: null,
  rubor: [], boca: null, chispasG: null, chispa: [],
  stops: [], stopsRim: [], stopsHalo: [],
  ojo: {
    izq: { g: null, mov: null, abierto: null, globo: null, brillo: null, arco: null, parpado: null },
    der: { g: null, mov: null, abierto: null, globo: null, brillo: null, arco: null, parpado: null },
  },
  fx: {},
});

type Estado = {
  emocion: ClaveEmocion;
  desde: PoseResuelta;
  hasta: PoseResuelta;
  actual: PoseResuelta;
  asimetria: Asimetria | null;
  t0: number;
  dur: number;
  curva: (t: number) => number;
  raf: number | null;
  vivo: boolean;
  fase: number;
  proxParpadeo: number;
  parpadeoHasta: number;
  reposo: boolean;
};

/* =====================================================================
 * Props
 * =================================================================== */

export type ManejadorLumy = {
  /** Fuerza un parpadeo (sirve para puntuar un cambio de turno en el chat). */
  parpadear(): void;
  /** Dirige la mirada. Rango cómodo: −5..5 en x, −4..4 en y. */
  mirar(x: number, y: number): void;
  readonly emocion: ClaveEmocion;
  readonly nodo: SVGSVGElement | null;
};

type PropsComunes = {
  /** Bucle de reposo: flotado, respiración, temblor. Por defecto encendido. */
  reposo?: boolean;
  /** Segundos de transición. 0 aplica la pose de inmediato. */
  duracion?: number;
  className?: string;
  style?: CSSProperties;
  /** Ancho de la caja. Si se omite lo decide el CSS de alrededor. */
  ancho?: number | string;
  /** Texto alternativo. `null` marca la mascota como decorativa. */
  etiqueta?: string | null;
  ref?: Ref<ManejadorLumy>;
};

/**
 * La banda de seguridad, como restricción de tipos.
 *
 * Sin `espejo`, `emocion` solo acepta las de banda 'apoyo' — las que Lumy puede
 * adoptar por su cuenta. Para mostrar una emoción negativa hay que escribir
 * `espejo` explícitamente, que es la forma de declarar en el sitio de uso "esto
 * lo nombró el estudiante, no lo dedujo la app".
 *
 * En la versión anterior esto era una comprobación en tiempo de ejecución que
 * emitía un aviso por consola y seguía. Ahora `<Lumy emocion="tristeza" />` no
 * compila. La comprobación en ejecución igual se conserva más abajo, porque una
 * clave puede llegar desde la API sin pasar por el compilador.
 */
export type PropsLumy = PropsComunes & (
  | { emocion?: EmocionApoyo; espejo?: false }
  | { emocion: ClaveEmocion; espejo: true }
);

/* =====================================================================
 * Componente
 * =================================================================== */

export function Lumy({
  emocion = 'neutral',
  espejo = false,
  reposo = true,
  duracion,
  className = '',
  style,
  ancho,
  etiqueta = 'Lumy',
  ref,
}: PropsLumy) {
  // `useId` trae dos puntos, que son legales en un id pero rompen el
  // `url(#…)` de los gradientes. Se limpian.
  const id = useId().replace(/:/g, '');

  const svgRef = useRef<SVGSVGElement>(null);
  const nodos = useRef<Nodos>(nodosVacios());

  const estado = useRef<Estado | null>(null);
  if (estado.current === null) {
    const inicial = resolver(pose(emocion));
    estado.current = {
      emocion,
      desde: inicial,
      hasta: inicial,
      actual: inicial,
      asimetria: asimetriaDe(emocion),
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
      reposo,
    };
  }

  // El bucle lee `reposo` de la referencia, no de la clausura: así cambiarlo no
  // obliga a desmontar y rearmar el rAF.
  estado.current.reposo = reposo;

  /* --- Pintado ---------------------------------------------------- */

  /**
   * Vuelca una pose al DOM. `ritmo` trae los desplazamientos del bucle de
   * reposo (flotado, respiración, temblor, parpadeo), que se suman a la pose
   * sin ensuciarla: la pose es el destino, el ritmo es la vida encima.
   */
  const pintar = (p: PoseResuelta, ritmo: Ritmo) => {
    const nd = nodos.current;
    const op = opacidades(p);

    if (nd.cuerpo) nd.cuerpo.style.transform = trCuerpo(p, ritmo, 'px');
    if (nd.cara) nd.cara.style.transform = trCara(p, ritmo, 'px');

    if (nd.aura) {
      nd.aura.style.opacity = String(op.aura);
      nd.aura.style.transform = trAura(p, 'px');
    }
    if (nd.brillos) nd.brillos.style.opacity = String(op.brillos);

    if (nd.ruboes) nd.ruboes.style.opacity = String(op.rubor);
    nd.rubor.forEach((el, i) => {
      if (el) el.style.transform = trRubor(p, i as 0 | 1, 'px');
    });

    if (nd.chispasG) nd.chispasG.style.opacity = String(op.chispas);
    nd.chispa.forEach((el, i) => {
      if (el) el.setAttribute('transform', trChispa(p, i as 0 | 1 | 2));
    });

    pintarOjo('izq', p, ritmo, op.ojoBrillo, op.ojoAbierto, op.ojoArco);
    pintarOjo('der', p, ritmo, op.ojoBrillo, op.ojoAbierto, op.ojoArco);

    if (nd.boca) {
      nd.boca.setAttribute('d', boca(p));
      nd.boca.setAttribute('stroke', p.tinta);
      nd.boca.setAttribute('fill', p.tinta);
      nd.boca.setAttribute('stroke-width', String(GEO.boca.grosor * p.bocaGrosor));
    }

    /* Gradientes. El halo y el borde interno siguen a la paleta: si se
       quedaran en el menta y el teal del archivo original, toda emoción que
       no fuera menta arrastraría un aro verde peleando con su propio color.
       Con la paleta `menta` los valores caen exactamente donde estaban. */
    nd.stops.forEach((s, i) => {
      const c = p.cuerpo[i];
      if (s && c) s.setAttribute('stop-color', c);
    });
    nd.stopsHalo.forEach((s) => s?.setAttribute('stop-color', p.halo));
    nd.stopsRim.forEach((s) => s?.setAttribute('stop-color', p.rim));

    for (const clave of CLAVES_FX) {
      const v = valorFx(p, clave);
      const el = nd.fx[clave];
      if (!el) continue;
      // display:none cuando está apagado: un filtro o una animación CSS en
      // un nodo con opacity 0 se sigue componiendo igual.
      el.style.display = v < 0.01 ? 'none' : '';
      el.style.opacity = String(v);
    }
  };

  const pintarOjo = (
    lado: Lado, p: PoseResuelta, r: Ritmo,
    opBrillo: number, opAbierto: number, opArco: number,
  ) => {
    const o = nodos.current.ojo[lado];
    const asim = estado.current?.asimetria;
    if (o.g) o.g.style.transform = trOjo(lado, p, 'px');
    if (o.mov) o.mov.style.transform = trOjoMov(lado, p, asim, 'px');
    if (o.parpado) o.parpado.setAttribute('points', parpado(lado, p, asim, r.parpadeo));
    if (o.globo) o.globo.setAttribute('fill', p.tinta);
    if (o.brillo) o.brillo.style.opacity = String(opBrillo);
    if (o.abierto) o.abierto.style.opacity = String(opAbierto);
    if (o.arco) {
      o.arco.style.opacity = String(opArco);
      o.arco.setAttribute('stroke', p.tinta);
      o.arco.setAttribute('d', arcoOjo(p));
    }
  };

  /* --- Bucle ------------------------------------------------------- */

  useEffect(() => {
    const est = estado.current;
    if (!est) return;
    est.vivo = true;

    const marco = (ahora: number) => {
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
      const ritmo: Ritmo = { y: 0, rot: 0, esc: 1, tx: 0, ty: 0, parpadeo: 1 };

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
    };

    // Primer cuadro sincrónico: sin esto el SVG aparece con la geometría
    // declarada en el JSX (sin transformaciones ni boca) durante un cuadro.
    pintar(est.actual, RITMO_NULO);
    est.raf = requestAnimationFrame(marco);

    return () => {
      est.vivo = false;
      if (est.raf !== null) cancelAnimationFrame(est.raf);
    };
    // Se monta una vez por instancia. Todo lo que cambia entre renders lo lee
    // el bucle desde `estado.current`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --- Cambio de emoción -------------------------------------------- */

  useEffect(() => {
    const est = estado.current;
    if (!est || est.emocion === emocion) return;

    const def = EMOCIONES[emocion];
    if (!def) {
      console.warn(`Lumy: emoción desconocida "${emocion}", se ignora.`);
      return;
    }

    // El tipo de las props ya impide llegar acá con una emoción de espejo sin
    // permiso, pero la clave puede venir de una respuesta de la API y entrar
    // por un `as`. La comprobación en ejecución se queda.
    if (def.banda === 'espejo' && !espejo) {
      console.warn(
        `Lumy: "${emocion}" es de banda espejo. Solo se muestra cuando el `
        + 'estudiante nombra su propia emoción; pasá la prop `espejo` si ese '
        + 'es el caso. Nunca se activa sola desde el ICVE ni desde el clima.',
      );
      return;
    }

    est.emocion = emocion;
    est.desde = est.actual;
    est.hasta = resolver(pose(emocion));
    est.asimetria = asimetriaDe(emocion);
    est.t0 = performance.now() / 1000;
    est.dur = duracion != null ? duracion : (reducido() ? 0.15 : 0.62);
    est.curva = CON_REBOTE.has(emocion) && !reducido() ? rebote : suave;

    // Duración cero es "poné esta pose ya", no "no hagas nada". El bucle solo
    // interpola cuando dur > 0, así que sin este salto la pose se quedaría en
    // la anterior para siempre.
    if (est.dur <= 0) {
      est.actual = est.hasta;
      est.dur = 0;
      pintar(est.actual, RITMO_NULO);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emocion, espejo, duracion]);

  /* --- Mando imperativo --------------------------------------------- */

  useImperativeHandle(ref, (): ManejadorLumy => ({
    parpadear() {
      const est = estado.current;
      if (est) est.parpadeoHasta = performance.now() / 1000 + 0.14;
    },
    mirar(x, y) {
      const est = estado.current;
      if (!est) return;
      est.actual.ojoX = clamp(x, -6, 6);
      est.actual.ojoY = clamp(y, -5, 5);
      est.hasta.ojoX = est.actual.ojoX;
      est.hasta.ojoY = est.actual.ojoY;
    },
    get emocion() { return estado.current?.emocion ?? 'neutral'; },
    get nodo() { return svgRef.current; },
  }), []);

  /* --- Estructura ---------------------------------------------------- */

  const [dx, dy] = GEO.desfase;
  const pal = PALETAS.menta;

  const ojo = (lado: Lado) => {
    const o = nodos.current.ojo[lado];
    return (
      <g className="lumy-ojo" data-lado={lado} ref={(el) => { o.g = el; }}>
        <g className="lumy-ojo__mov" ref={(el) => { o.mov = el; }}>
          <g
            className="lumy-ojo__abierto"
            clipPath={`url(#lumy-parpado-${lado}-${id})`}
            ref={(el) => { o.abierto = el; }}
          >
            <ellipse
              className="lumy-ojo__globo"
              rx={GEO.ojos.rx}
              ry={GEO.ojos.ry}
              ref={(el) => { o.globo = el; }}
            />
            <g className="lumy-ojo__brillo" fill="#FDFCFF" ref={(el) => { o.brillo = el; }}>
              {GEO.brillosOjo.map((b, i) => (
                <circle key={i} cx={b.dx} cy={b.dy} r={b.r} />
              ))}
            </g>
          </g>
          {/* Sin `d`, `stroke` ni opacidad declarados: los escribe el bucle. Si
              estuvieran acá, React los restauraría en cada render. */}
          <path
            className="lumy-ojo__arco"
            fill="none"
            strokeWidth="4"
            strokeLinecap="round"
            ref={(el) => { o.arco = el; }}
          />
        </g>
      </g>
    );
  };

  const capa = (cual: 'tras' | 'frente') => (
    <g className={`lumy-fx lumy-fx--${cual}`}>
      {CLAVES_FX.filter((c) => EFECTOS[c].capa === cual).map((c) => (
        <g
          key={c}
          className={`lumy-fx__${c}`}
          style={{ opacity: 0, display: 'none' }}
          ref={(el) => { nodos.current.fx[c] = el; }}
        >
          {EFECTOS[c].contenido}
        </g>
      ))}
    </g>
  );

  const estiloCaja: CSSProperties = { ...style };
  if (ancho !== undefined) estiloCaja.width = typeof ancho === 'number' ? `${ancho}px` : ancho;

  return (
    <span
      className={`lumy-caja ${className}`.trim()}
      style={estiloCaja}
      role={etiqueta ? 'img' : undefined}
      aria-label={etiqueta ?? undefined}
      aria-hidden={etiqueta ? undefined : true}
      data-lumy-listo="1"
      data-emocion={emocion}
    >
      <svg className="lumy" viewBox={GEO.viewBox} xmlns="http://www.w3.org/2000/svg" ref={svgRef} aria-hidden="true">
        <defs>
          <radialGradient cx="33%" cy="22%" r="86%" id={`lumy-cuerpo-${id}`}>
            {pal.cuerpo.map((c, i) => (
              <stop
                key={i}
                offset={`${PARADAS[i]}%`}
                stopColor={c}
                ref={(el) => { nodos.current.stops[i] = el; }}
              />
            ))}
          </radialGradient>

          <linearGradient x1="0" y1="0.48" x2="0.18" y2="1" id={`lumy-rim-${id}`}>
            <stop className="lumy-s-rim" offset="0%" stopColor={pal.rim} stopOpacity="0"
                  ref={(el) => { nodos.current.stopsRim[0] = el; }} />
            <stop className="lumy-s-rim" offset="100%" stopColor={pal.rim} stopOpacity="0.42"
                  ref={(el) => { nodos.current.stopsRim[1] = el; }} />
          </linearGradient>

          <radialGradient cx="50%" cy="50%" r="50%" id={`lumy-core-${id}`}>
            <stop offset="0%" stopColor="#FDFCFF" stopOpacity="0.62" />
            <stop offset="100%" stopColor="#FDFCFF" stopOpacity="0" />
          </radialGradient>

          <radialGradient cx="50%" cy="50%" r="50%" id={`lumy-halo-${id}`}>
            <stop className="lumy-s-halo" offset="52%" stopColor={pal.halo} stopOpacity="0.34"
                  ref={(el) => { nodos.current.stopsHalo[0] = el; }} />
            <stop className="lumy-s-halo" offset="100%" stopColor={pal.halo} stopOpacity="0"
                  ref={(el) => { nodos.current.stopsHalo[1] = el; }} />
          </radialGradient>

          <filter id={`lumy-soft-${id}`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="8" />
          </filter>
          <filter id={`lumy-soft2-${id}`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="4" />
          </filter>

          <clipPath id={`lumy-parpado-izq-${id}`}>
            <polygon points="-20,-18 20,-18 20,18 -20,18"
                     ref={(el) => { nodos.current.ojo.izq.parpado = el; }} />
          </clipPath>
          <clipPath id={`lumy-parpado-der-${id}`}>
            <polygon points="-20,-18 20,-18 20,18 -20,18"
                     ref={(el) => { nodos.current.ojo.der.parpado = el; }} />
          </clipPath>
        </defs>

        {/* Arte oficial de Lumys: la animacion vive en el contenedor para
            conservar intacta la ilustracion original. */}
        <image
          className="lumy-oficial"
          href="/img/lumys-mascota-oficial.png"
          x="0"
          y="0"
          width="207"
          height="176"
          preserveAspectRatio="xMidYMid slice"
        />

        <g className="lumy-mundo" transform={`translate(${dx} ${dy})`}>

          {capa('tras')}

          <ellipse
            className="lumy-aura"
            cx={GEO.halo.cx} cy={GEO.halo.cy} rx={GEO.halo.rx} ry={GEO.halo.ry}
            fill={`url(#lumy-halo-${id})`}
            ref={(el) => { nodos.current.aura = el; }}
          />

          <g className="lumy-cuerpo" ref={(el) => { nodos.current.cuerpo = el; }}>
            <path className="lumy-blob" d={GEO.blob} fill={`url(#lumy-cuerpo-${id})`} />
            <path className="lumy-rim" d={GEO.blob} fill={`url(#lumy-rim-${id})`} />
            <ellipse
              className="lumy-core"
              cx={GEO.core.cx} cy={GEO.core.cy} rx={GEO.core.rx} ry={GEO.core.ry}
              fill={`url(#lumy-core-${id})`}
            />
            <g className="lumy-brillos" ref={(el) => { nodos.current.brillos = el; }}>
              <g filter={`url(#lumy-soft-${id})`} opacity="0.7">
                <ellipse
                  cx={GEO.brilloSuave.cx} cy={GEO.brilloSuave.cy}
                  rx={GEO.brilloSuave.rx} ry={GEO.brilloSuave.ry}
                  transform={`rotate(${GEO.brilloSuave.rot} ${GEO.brilloSuave.cx} ${GEO.brilloSuave.cy})`}
                  fill="#FDFCFF"
                />
              </g>
              <ellipse
                cx={GEO.brilloDuro.cx} cy={GEO.brilloDuro.cy}
                rx={GEO.brilloDuro.rx} ry={GEO.brilloDuro.ry}
                transform={`rotate(${GEO.brilloDuro.rot} ${GEO.brilloDuro.cx} ${GEO.brilloDuro.cy})`}
                fill="#FDFCFF" opacity="0.9"
              />
              <g className="lumy-motas" fill="#FDFCFF" opacity="0.65">
                {GEO.motas.map((m, i) => <circle key={i} cx={m.cx} cy={m.cy} r={m.r} />)}
              </g>
            </g>
          </g>

          <g className="lumy-cara" ref={(el) => { nodos.current.cara = el; }}>
            <g
              className="lumy-ruboes"
              filter={`url(#lumy-soft2-${id})`}
              fill="#FFD77A"
              opacity="0.42"
              ref={(el) => { nodos.current.ruboes = el; }}
            >
              {GEO.rubor.map((r, i) => (
                <ellipse
                  key={i} className="lumy-rubor" data-i={i}
                  cx={r.cx} cy={r.cy} rx={r.rx} ry={r.ry}
                  ref={(el) => { nodos.current.rubor[i] = el; }}
                />
              ))}
            </g>

            <g className="lumy-ojos">{ojo('izq')}{ojo('der')}</g>

            {/* Sin `d`: la boca la calcula el núcleo en el primer cuadro. */}
            <path
              className="lumy-boca"
              strokeLinecap="round"
              strokeLinejoin="round"
              ref={(el) => { nodos.current.boca = el; }}
            />
          </g>

          <g className="lumy-chispas" ref={(el) => { nodos.current.chispasG = el; }}>
            {GEO.chispas.map((c, i) => (
              <path
                key={i} className="lumy-chispa" data-i={i}
                d={GEO.chispaPath} fill={c.color} opacity={c.op}
                ref={(el) => { nodos.current.chispa[i] = el; }}
              />
            ))}
          </g>

          {capa('frente')}
        </g>
      </svg>
    </span>
  );
}

export default Lumy;
