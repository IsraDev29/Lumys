/* ===========================================================================
 * Lumys* — Movimiento
 * ---------------------------------------------------------------------------
 * La parte de JavaScript del sistema de animación. Es deliberadamente pequeña:
 * el movimiento lo dibuja CSS (ver estilos/movimiento.css), y de acá sale solo
 * lo que CSS no puede saber por su cuenta —si un elemento entró en pantalla, o
 * cuánto vale un número que está subiendo—.
 *
 * Por qué no una librería de animación: el paquete más liviano de los usuales
 * añade unos 35 KB comprimidos y mueve los fotogramas desde el hilo principal.
 * Lumys se instala como PWA y se usa sin conexión en teléfonos de gama baja;
 * ahí esos 35 KB son medio segundo de arranque, y el hilo principal ya lo
 * ocupan el rig de la mascota y los gráficos. Las animaciones declaradas en
 * CSS las corre el compositor, que sigue yendo fluido aunque React esté
 * ocupado renderizando.
 * =========================================================================== */

import { useCallback, useEffect, useState } from 'react';

/** Lee la preferencia del sistema. Se consulta en cada uso y no se cachea:
 *  en Android y iOS se puede activar el ahorro de movimiento sin recargar. */
export function prefiereMenosMovimiento(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/* ---------------------------------------------------------------------------
 * Revelado al hacer scroll
 * ------------------------------------------------------------------------- */

type OpcionesRevelar = {
  /** Cuánto del elemento tiene que verse para disparar. 0.15 evita que algo
   *  alto (una tarjeta larga) espere a estar entero en pantalla. */
  umbral?: number;
  /** Adelanta el disparo: el elemento empieza a entrar antes de asomar, así el
   *  movimiento termina justo cuando queda a la vista y no después. */
  margen?: string;
  /** Por defecto se revela una sola vez. Volver a ocultar algo al salir de
   *  pantalla marea al desplazarse hacia arriba. */
  repetir?: boolean;
};

/**
 * Devuelve una `ref` para el contenedor. Todos los hijos con la clase
 * `.lm-revelar` que haya dentro se revelan al entrar en pantalla.
 *
 * Se observa a los hijos desde un único observador por contenedor en vez de
 * montar un hook por tarjeta: una lista de veinte elementos crearía veinte
 * observadores, y el navegador los evalúa a todos en cada scroll.
 *
 *   const ref = useRevelar<HTMLDivElement>();
 *   <section ref={ref}>
 *     <article className="lm-revelar" style={{ '--i': 0 }}>…</article>
 *     <article className="lm-revelar" style={{ '--i': 1 }}>…</article>
 *   </section>
 *
 * ── Por qué una ref de callback y no `useRef` ──────────────────────────────
 * Casi todas las vistas de Lumys piden datos antes de dibujarse y devuelven un
 * <Cargador/> mientras tanto. Con un `useRef` normal, el efecto corre una sola
 * vez al montar —cuando lo que hay en pantalla es el cargador y el contenedor
 * todavía no existe—, sale por el `return` temprano y no se vuelve a ejecutar
 * nunca: el contenido llega después y se queda con `opacity: 0` para siempre.
 * La página entera queda en blanco.
 *
 * Con una ref de callback, React la invoca en el momento en que el nodo entra
 * en el DOM. Guardarlo en estado dispara el efecto justo entonces, con los
 * hijos ya presentes.
 */
export function useRevelar<T extends HTMLElement>(opciones: OpcionesRevelar = {}) {
  const { umbral = 0.15, margen = '0px 0px -8% 0px', repetir = false } = opciones;
  const [raiz, setRaiz] = useState<T | null>(null);

  const ref = useCallback((nodo: T | null) => setRaiz(nodo), []);

  useEffect(() => {
    if (!raiz) return;

    const objetivos = raiz.querySelectorAll<HTMLElement>('.lm-revelar');
    if (objetivos.length === 0) return;

    // Sin soporte o con el movimiento desactivado, se muestra todo de una vez.
    // El contenido nunca depende de que la animación llegue a correr.
    if (typeof IntersectionObserver === 'undefined' || prefiereMenosMovimiento()) {
      objetivos.forEach((el) => el.setAttribute('data-visible', 'si'));
      return;
    }

    const observador = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((entrada) => {
          const el = entrada.target as HTMLElement;
          if (entrada.isIntersecting) {
            el.setAttribute('data-visible', 'si');
            if (!repetir) observador.unobserve(el);
          } else if (repetir) {
            el.setAttribute('data-visible', 'no');
          }
        });
      },
      { threshold: umbral, rootMargin: margen },
    );

    objetivos.forEach((el) => observador.observe(el));
    return () => observador.disconnect();
  }, [raiz, umbral, margen, repetir]);

  return ref;
}

/* ---------------------------------------------------------------------------
 * Contador animado
 * ------------------------------------------------------------------------- */

/**
 * Sube un número desde 0 hasta `valor`. Se usa en las métricas del panel y en
 * la racha de constancia: ver el número crecer hace que se lea como un logro y
 * no como un dato.
 *
 * Va sobre `requestAnimationFrame` y no sobre `setInterval` porque rAF se
 * sincroniza con el refresco de la pantalla y se detiene solo cuando la
 * pestaña pasa a segundo plano. Con `setInterval`, al volver a la pestaña, el
 * navegador acumula los disparos pendientes y el número da un salto.
 *
 * La curva es `easeOutCubic`: arranca rápido y frena al final, que es como se
 * espera que se detenga algo que cuenta.
 */
export function useContador(valor: number, duracion = 900): number {
  const [actual, setActual] = useState(() => (prefiereMenosMovimiento() ? valor : 0));

  useEffect(() => {
    if (prefiereMenosMovimiento()) {
      setActual(valor);
      return;
    }

    let cuadro = 0;
    let inicio: number | null = null;

    const paso = (ahora: number) => {
      inicio ??= ahora;
      const avance = Math.min((ahora - inicio) / duracion, 1);
      const suavizado = 1 - Math.pow(1 - avance, 3);

      setActual(Math.round(valor * suavizado));

      if (avance < 1) cuadro = requestAnimationFrame(paso);
    };

    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [valor, duracion]);

  return actual;
}

/* ---------------------------------------------------------------------------
 * Transición entre vistas
 * ------------------------------------------------------------------------- */

type ConVistaTransicion = Document & {
  startViewTransition?: (cb: () => void) => { finished: Promise<void> };
};

/**
 * Envuelve un cambio de estado en la View Transitions API para que el
 * navegador funda la pantalla anterior con la nueva.
 *
 * Donde no existe la API —o donde el movimiento está desactivado— se ejecuta
 * el callback tal cual. La transición es un adorno: si falta, la navegación
 * sigue funcionando igual.
 */
export function conTransicion(cambio: () => void): void {
  const doc = document as ConVistaTransicion;

  if (typeof doc.startViewTransition !== 'function' || prefiereMenosMovimiento()) {
    cambio();
    return;
  }

  doc.startViewTransition(cambio);
}

/* ---------------------------------------------------------------------------
 * Montaje diferido
 * ------------------------------------------------------------------------- */

/**
 * Devuelve `false` en el primer render y `true` en el siguiente cuadro.
 *
 * Sirve para animar algo que aparece con estado —un diálogo, una hoja
 * inferior—: hay que pintarlo primero en su posición de partida para que el
 * navegador tenga desde dónde interpolar. Si se monta ya con la clase final,
 * no hay transición, solo un salto.
 */
export function useEntrada(activo: boolean): boolean {
  const [entrado, setEntrado] = useState(false);

  useEffect(() => {
    if (!activo) {
      setEntrado(false);
      return;
    }
    const cuadro = requestAnimationFrame(() => setEntrado(true));
    return () => cancelAnimationFrame(cuadro);
  }, [activo]);

  return entrado;
}

/**
 * Índice escalonado para listas. Evita repetir el objeto de estilo en línea en
 * cada `map` y deja claro en el sitio de uso que ese número es un retardo.
 *
 *   {items.map((it, i) => <li key={it.id} style={escalon(i)}>…</li>)}
 */
export function escalon(indice: number): React.CSSProperties {
  return { '--i': indice } as React.CSSProperties;
}
