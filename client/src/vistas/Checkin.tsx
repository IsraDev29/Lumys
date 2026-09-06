/* ==========================================================================
   Lumys* — Check-in conversacional

   Cada intercambio lo genera el modelo en /ia/checkin/turno, con lo que se dijo
   en esta sesión y una paráfrasis de los días anteriores como contexto. La
   pantalla no sabe cuántas preguntas van a venir ni cuáles: solo pinta lo que
   llega y devuelve lo que el estudiante contesta.

   Lo único que sigue siendo fijo es la aritmética. Cada opción trae un `valor`
   de 1 a 5 que viaja al backend y alimenta el ICVE ahí, con una fórmula. La
   conversación cambia todos los días; la forma de medirla, no.

   --------------------------------------------------------------------------
   QUÉ ES ESTADO Y QUÉ ES REFERENCIA

   La conversación es un flujo asíncrono largo (pedir turno → esperar → pintar →
   esperar respuesta → repetir), y en React eso obliga a separar dos cosas:

     - Estado  → lo que se dibuja: mensajes, turno actual, si está pensando.
     - Ref     → lo que la lógica necesita leer sin provocar un repintado, y
                 sobre todo sin quedar congelado en una clausura vieja: la
                 sesión acumulada, el texto libre, la prosodia, la racha.

   Si `sesion` fuera estado, la función que envía el cierre leería el valor que
   tenía cuando se creó, no el que hay ahora, y se mandaría un check-in
   incompleto. Es el error clásico de esta clase de flujo.

   --------------------------------------------------------------------------
   SOBRE EL MARCADO

   Es la pantalla `check_in_conversacional_ia_lumys_estilo_chat` de Stitch. Se
   portó su forma —el chat de mensajería a ocho columnas y la columna de apoyo a
   cuatro— y no su contenido: el mockup afirma cifrado extremo a extremo, una
   llave RSA-4096 y un "65% de tensión" calculado sobre una conversación de
   ejemplo. Nada de eso existe todavía, y ponerlo en pantalla sería prometerle a
   un adolescente una garantía que no se le puede cumplir. El medidor de esta
   versión se calcula con las respuestas que la persona ya dio en esta sesión, y
   la tarjeta de privacidad dice lo que de verdad pasa con sus datos.

   La cabecera fija del mockup tampoco se porta: la navegación de Lumys va abajo
   y en un solo sitio. Su botón de ayuda vive en la barra del chat, que es parte
   del contenido y no una segunda barra de navegación.
   ========================================================================== */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Lumy, type ManejadorLumy } from '../lumy/Lumy.tsx';
import { Isotipo } from '../componentes/Identidad.tsx';
import { A } from '../componentes/A.tsx';
import { useAvisos } from '../lib/avisos.tsx';
import { espera } from '../lib/formato.ts';
import { useSesion } from '../lib/sesion.tsx';
import * as api from '../lib/api.ts';
import * as voz from '../lib/voz.ts';
import type { Cierre, RespuestaTurno, Turno } from '../lib/tipos.ts';
import type { EmocionApoyo } from '../lumy/emociones.ts';

/** Tope superior de intercambios. El backend también lo aplica; acá sirve solo
 *  para dibujar la barra de progreso, que necesita un total aunque la
 *  conversación sea de largo variable. */
const MAX_TURNOS = 6;

type Mensaje = { id: number; texto: string; quien: 'bot' | 'user' | 'sistema'; hora: string };

/** Respuesta puntuable ya dada. Alimenta el medidor de la columna derecha. */
type Respondido = { componente: string; valor: number };

/**
 * Qué cara pone Lumy según el componente que está preguntando.
 *
 * Todas son de banda 'apoyo' — el tipo `EmocionApoyo` lo obliga. Lumy acompaña
 * la conversación, no espeja lo que el estudiante le cuenta: si alguien reporta
 * que durmió mal y la mascota se pone triste, se valida el afecto pero se
 * amplifica.
 */
const CARA_POR_COMPONENTE: Record<string, EmocionApoyo> = {
  animo: 'interes',
  sueno: 'serenidad',
  energia: 'anticipacion',
  vinculo: 'confianza',
  concentracion: 'interes',
  libre: 'empatia',
};

const ETIQUETA_COMPONENTE: Record<string, string> = {
  animo: 'Ánimo',
  sueno: 'Sueño',
  energia: 'Energía',
  vinculo: 'Tiempo con gente',
  concentracion: 'Concentración',
  libre: 'Lo que quisiste contar',
};

const ahora = () =>
  new Date().toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' });

/** Icono de Material Symbols. Se repite lo suficiente como para tener nombre. */
function Icono({ nombre, className = '' }: { nombre: string; className?: string }) {
  return (
    <span className={`material-symbols-outlined ${className}`} aria-hidden="true">
      {nombre}
    </span>
  );
}

export function Checkin() {
  const avisar = useAvisos();
  const { usuario } = useSesion();
  const lumy = useRef<ManejadorLumy>(null);
  const cuerpo = useRef<HTMLDivElement>(null);

  /* --- Lo que se dibuja --------------------------------------------------- */
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [turno, setTurno] = useState<Turno | null>(null);
  const [pensando, setPensando] = useState(false);
  const [resultado, setResultado] = useState<Cierre | null>(null);
  const [completados, setCompletados] = useState(0);
  const [respondidos, setRespondidos] = useState<Respondido[]>([]);
  const [grabando, setGrabando] = useState(false);
  const [borrador, setBorrador] = useState('');
  const [cara, setCara] = useState<EmocionApoyo>('serenidad');

  /* --- Lo que la lógica lee ------------------------------------------------ */
  const sesion = useRef<RespuestaTurno[]>([]);
  const textoLibre = useRef<string | null>(null);
  const prosodia = useRef<voz.Prosodia | null>(null);
  const racha = useRef(0);
  const cerrado = useRef(false);
  const idMensaje = useRef(0);
  const arrancado = useRef(false);

  const agregar = useCallback((texto: string, quien: Mensaje['quien']) => {
    setMensajes((previos) => [...previos, { id: idMensaje.current++, texto, quien, hora: ahora() }]);
  }, []);

  /** El indicador de escritura cumple dos funciones: dar ritmo humano a la
   *  conversación y cubrir la latencia real de la llamada al modelo. */
  const mensajeBot = useCallback(async (texto: string) => {
    setPensando(true);
    await espera(420 + Math.min(texto.length * 8, 600));
    setPensando(false);
    agregar(texto, 'bot');
  }, [agregar]);

  // El registro baja solo con cada mensaje nuevo, como cualquier chat.
  useEffect(() => {
    const c = cuerpo.current;
    if (c) c.scrollTop = c.scrollHeight;
  }, [mensajes, pensando, turno]);

  /* --- Flujo --------------------------------------------------------------- */

  const cerrar = useCallback(async () => {
    if (cerrado.current) return;
    cerrado.current = true;
    setTurno(null);
    setCara('empatia');

    await mensajeBot('Listo. Eso es todo por hoy.');

    setPensando(true);
    let cierre: Cierre;
    try {
      cierre = await api.enviarCheckin({
        turnos: sesion.current,
        texto_usuario: textoLibre.current,
        voz: prosodia.current
          ? { caracteristicas: prosodia.current, consentimiento: true }
          : null,
      });
    } finally {
      setPensando(false);
    }

    // Riesgo explícito: el mensaje de contención lo escribe el backend con
    // texto fijo y los contactos que mantiene la institución, no el modelo.
    if (cierre.contencion) {
      cierre.contencion.split('\n').forEach((linea) => agregar(linea, 'bot'));
    } else if (cierre.coach) {
      await mensajeBot(cierre.coach);
    }

    agregar('Check-in guardado · solo vos ves el detalle', 'sistema');
    setResultado(cierre);
    avisar('Check-in guardado. Nos vemos mañana.', { tipo: 'logro' });
  }, [agregar, avisar, mensajeBot]);

  const siguiente = useCallback(async () => {
    setPensando(true);
    let proximo: Turno;
    try {
      proximo = await api.turnoCheckin(sesion.current);
    } finally {
      setPensando(false);
    }

    if (typeof proximo.racha === 'number') racha.current = proximo.racha;

    if (proximo.reaccion) await mensajeBot(proximo.reaccion);
    await mensajeBot(proximo.pregunta);

    // Cuando la IA no estuvo disponible se dice, en vez de disimularlo. El
    // estudiante tiene derecho a saber si le está escribiendo un modelo o una
    // lista local, sobre todo en una app que le pide que cuente cómo está.
    if (proximo.generado === false) {
      setMensajes((previos) =>
        previos.some((m) => m.quien === 'sistema')
          ? previos
          : [...previos, {
              id: idMensaje.current++,
              quien: 'sistema',
              hora: ahora(),
              texto: 'Hoy ando con preguntas de repuesto — la conexión no está fina.',
            }]);
    }

    setCara(CARA_POR_COMPONENTE[proximo.componente] ?? 'interes');
    // Un parpadeo marca el cambio de turno: es el gesto más barato para que la
    // conversación se sienta atendida y no encolada.
    lumy.current?.parpadear();
    setTurno(proximo);
  }, [mensajeBot]);

  const responder = useCallback(async (actual: Turno, texto: string, valor: number | null) => {
    setTurno(null);
    agregar(texto, 'user');

    sesion.current = [...sesion.current, {
      pregunta: actual.pregunta,
      respuesta: texto,
      componente: actual.componente,
      ...(valor != null ? { valor } : {}),
    }];
    setCompletados(sesion.current.length);
    // Solo lo puntuable alimenta el medidor: el texto libre no tiene número y
    // meterlo como neutro inventaría una lectura que nadie dio.
    if (valor != null) {
      setRespondidos((previos) => [...previos, { componente: actual.componente, valor }]);
    }

    if (actual.cierre || sesion.current.length >= MAX_TURNOS) return cerrar();
    return siguiente();
  }, [agregar, cerrar, siguiente]);

  /** Saltar no registra el turno: un componente sin respuesta se excluye del
   *  ICVE y los pesos se renormalizan. Guardar un valor neutro inventado
   *  ensuciaría la serie histórica con la que se compara al estudiante. */
  const saltar = useCallback((actual: Turno) => {
    setTurno(null);
    return actual.cierre ? cerrar() : siguiente();
  }, [cerrar, siguiente]);

  /* --- Nota de voz ---------------------------------------------------------- */

  /**
   * Graba y para, como el botón de audio de cualquier app de mensajería.
   *
   * Lo que se guarda al soltar son seis números — duración, pausas, variación de
   * tono, ritmo, energía —, nunca el audio. Se le dice al estudiante de forma
   * explícita: es lo que hace que apretar el micrófono no sea una decisión a
   * ciegas sobre sus propios datos.
   */
  const alternarGrabacion = useCallback(async () => {
    if (!voz.soportado()) {
      avisar('Este navegador no permite grabar notas de voz.', { tipo: 'info' });
      return;
    }

    if (voz.grabando()) {
      setGrabando(false);
      prosodia.current = voz.detener();
      avisar(
        prosodia.current
          ? 'Listo. Solo guardé el ritmo de tu voz, no el audio.'
          : 'Muy corto, no alcancé a escuchar. Probá de nuevo.',
        { tipo: prosodia.current ? 'ok' : 'info' },
      );
      return;
    }

    try {
      await voz.grabar();
      setGrabando(true);
      avisar('Te escucho. El audio no sale de tu teléfono.', { tipo: 'info' });
    } catch {
      // El caso normal acá es que el estudiante haya dicho que no al permiso del
      // micrófono. No es un error que haya que arreglar: es una respuesta.
      setGrabando(false);
      avisar('No se pudo usar el micrófono. Podés escribir igual.', { tipo: 'info' });
    }
  }, [avisar]);

  // Si el estudiante se va a otra vista con el micrófono abierto, se suelta.
  useEffect(() => () => { if (voz.grabando()) voz.cancelar(); }, []);

  /* --- Arranque ------------------------------------------------------------- */

  const reiniciar = useCallback(() => {
    setMensajes([]);
    setTurno(null);
    setResultado(null);
    setCompletados(0);
    setRespondidos([]);
    setBorrador('');
    setCara('serenidad');
    sesion.current = [];
    textoLibre.current = null;
    prosodia.current = null;
    cerrado.current = false;
    void siguiente();
  }, [siguiente]);

  useEffect(() => {
    // React 19 en modo estricto monta los efectos dos veces en desarrollo. Sin
    // este candado la conversación arrancaría por duplicado y se verían las
    // dos primeras preguntas encimadas.
    if (arrancado.current) return;
    arrancado.current = true;
    void siguiente();
  }, [siguiente]);

  /* --- Pintado --------------------------------------------------------------- */

  const nombre = usuario?.nombre?.split(' ')[0] ?? '';

  return (
    <section className="w-full pt-space-lg max-w-[1200px] mx-auto px-margin-mobile md:px-margin-desktop">
      <div className="relative">
        {/* Los orbes son decorativos y sobresalen a propósito de los márgenes.
            Van dentro de un contenedor con `overflow-hidden` propio: sueltos
            ensanchan el documento y aparece una barra de desplazamiento
            horizontal en el teléfono. Recortar acá y no en el contenedor de la
            rejilla evita comerse la sombra de las tarjetas. */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="absolute -top-24 -left-32 w-96 h-96 bg-primary-container/20 rounded-full blur-3xl" />
          <div className="absolute top-48 -right-32 w-96 h-96 bg-secondary-fixed/30 rounded-full blur-3xl" />
        </div>

        <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">

          {/* ================= Conversación ================= */}
          <section className="lg:col-span-8 flex flex-col bg-surface-container-lowest rounded-lg shadow-[0_12px_36px_-6px_rgba(28,45,90,0.06),0_4px_16px_rgba(189,164,243,0.14)] overflow-hidden">

            <header className="bg-surface-container-low px-space-md py-space-sm flex flex-col sm:flex-row items-center justify-between gap-space-sm">
              <div className="flex items-center gap-space-sm w-full sm:w-auto">
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-surface-container-lowest shadow-[0_0_18px_rgba(189,164,243,0.4)] ring-2 ring-primary-container flex items-center justify-center">
                    <Lumy ref={lumy} emocion={cara} ancho={44} etiqueta={null} />
                  </div>
                  <span
                    className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-secondary-container ring-2 ring-surface-container-lowest rounded-full flex items-center justify-center"
                    title="Escucha activa"
                  >
                    <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                  </span>
                </div>

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-space-2xs">
                    <h1 className="font-headline-sm text-headline-sm text-on-surface truncate">Lumy</h1>
                    <span className="px-space-2xs py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm text-label-sm">
                      {pensando ? 'escribiendo…' : 'en línea'}
                    </span>
                  </div>
                  <p className="font-label-sm text-label-sm text-secondary font-medium flex items-center gap-1 truncate">
                    <Icono nombre="lock" className="text-[14px]" />
                    Nadie del colegio lee esto palabra por palabra
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-space-xs self-end sm:self-auto shrink-0">
                <button
                  className="p-space-xs rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant transition-colors flex items-center justify-center"
                  type="button"
                  title="Empezar de nuevo"
                  aria-label="Empezar de nuevo"
                  onClick={reiniciar}
                >
                  <Icono nombre="restart_alt" className="text-[18px]" />
                </button>

                <A
                  className="inline-flex items-center gap-space-2xs px-space-sm py-space-2xs rounded-full bg-secondary-container text-on-secondary-container hover:bg-secondary-fixed transition-all font-label-md text-label-md"
                  href="#/respirar"
                >
                  <Icono nombre="air" className="text-[18px]" />
                  <span className="hidden md:inline">Respirar</span>
                </A>

                {/* El SOS del mockup. Marca a la línea de verdad, no abre un
                    modal: si alguien lo aprieta, es porque lo necesita ahora. */}
                <a
                  className="inline-flex items-center gap-space-2xs px-space-sm py-space-2xs rounded-full bg-error-container text-on-error-container hover:brightness-95 transition-all font-label-md text-label-md font-semibold shadow-sm"
                  href="tel:133"
                >
                  <Icono nombre="support_agent" className="text-[18px]" />
                  <span>Ayuda ya</span>
                </a>
              </div>
            </header>

            <div
              className="p-space-md md:p-space-lg flex flex-col gap-space-md bg-surface/50 overflow-y-auto min-h-[320px] max-h-[560px]"
              ref={cuerpo}
              role="log"
              aria-live="polite"
              aria-label="Conversación del check-in"
            >
              <div className="flex justify-center">
                <div className="flex items-center gap-space-xs px-space-md py-space-2xs bg-surface-container-high/80 backdrop-blur-md rounded-full text-on-surface-variant text-center shadow-sm">
                  <Icono nombre="verified_user" className="text-[16px] text-primary" />
                  <span className="font-label-sm text-label-sm">
                    Ningún profesor, orientador/a ni compañero ve estos mensajes.
                  </span>
                </div>
              </div>

              {mensajes.map((m) => <Burbuja key={m.id} mensaje={m} />)}

              {pensando && (
                <div className="flex items-start gap-space-sm max-w-[90%] md:max-w-[80%]">
                  <Isotipo tamano={32} conFondo className="shrink-0 mt-1" />
                  <div className="bg-surface-container-lowest px-space-md py-space-sm rounded-2xl rounded-tl-sm shadow-[0_4px_18px_rgba(28,45,90,0.05)] flex items-center gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-2 h-2 rounded-full bg-outline animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                    <span className="sr-only">Lumy está escribiendo</span>
                  </div>
                </div>
              )}
            </div>

            <footer className="p-space-sm md:p-space-md bg-surface-container-lowest border-t border-outline-variant/40">
              {/* Progreso: la conversación es de largo variable, así que esto es
                  una orientación y no una promesa de cuántas faltan. */}
              <div className="flex items-center gap-space-2xs mb-space-sm" aria-hidden="true">
                {Array.from({ length: MAX_TURNOS }, (_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      i < completados ? 'bg-primary-container' : 'bg-surface-container-high'
                    }`}
                  />
                ))}
              </div>

              {resultado
                ? <Cerrado resultado={resultado} racha={racha.current + 1} />
                : turno
                  ? (
                    <Controles
                      turno={turno}
                      borrador={borrador}
                      setBorrador={setBorrador}
                      grabando={grabando}
                      onGrabar={alternarGrabacion}
                      onResponder={responder}
                      onSaltar={saltar}
                      onTextoLibre={(t) => { textoLibre.current = t; }}
                    />
                  )
                  : null}

              <div className="mt-space-sm flex items-center justify-center gap-1.5 text-center text-on-surface-variant font-label-sm text-label-sm">
                <Icono nombre="shield" className="text-[14px] text-secondary" />
                <span>Lumy acompaña. No diagnostica ni reemplaza a una persona.</span>
              </div>
            </footer>
          </section>

          {/* ================= Columna de apoyo ================= */}
          <aside className="lg:col-span-4 flex flex-col gap-space-md w-full">
            <ResumenDelMomento respondidos={respondidos} nombre={nombre} />

            <article className="bg-surface-container-lowest rounded-lg p-space-md shadow-[0_8px_24px_-4px_rgba(189,164,243,0.1)] flex flex-col gap-space-xs">
              <div className="flex items-center gap-space-xs">
                <span className="p-space-2xs rounded-lg bg-tertiary-fixed text-on-tertiary-fixed">
                  <Icono nombre="visibility_lock" className="text-[20px]" />
                </span>
                <h2 className="font-headline-sm text-headline-sm text-on-surface">Qué pasa con esto</h2>
              </div>

              {/* El mockup prometía cifrado extremo a extremo y una llave
                  RSA-4096. No existen. Lo que sí es cierto —y es bastante— es
                  cómo se usa lo que escribe, así que eso es lo que se dice. */}
              <ul className="flex flex-col gap-space-xs mt-space-2xs">
                {[
                  { icono: 'lock', texto: 'Lo que escribís no se comparte palabra por palabra con nadie.' },
                  { icono: 'monitoring', texto: 'Se compara con tu propio promedio, nunca con el de tu salón.' },
                  { icono: 'calendar_month', texto: 'Un mal día no activa nada. Se miran cambios de dos o tres semanas.' },
                  { icono: 'diversity_3', texto: 'Si algo se sostiene, se avisa a quien vos elegiste. A nadie más.' },
                ].map((item) => (
                  <li key={item.icono} className="flex items-start gap-space-xs">
                    <Icono nombre={item.icono} className="text-[18px] text-secondary shrink-0 mt-0.5" />
                    <span className="font-body-sm text-body-sm text-on-surface-variant">{item.texto}</span>
                  </li>
                ))}
              </ul>

              <A
                className="mt-space-xs font-label-md text-label-md text-primary font-semibold hover:underline"
                href="#/perfil"
              >
                Ver y cambiar qué se comparte
              </A>
            </article>

            <div className="bg-error-container/60 rounded-lg p-space-md flex items-start gap-space-xs">
              <Icono nombre="call" className="text-[20px] text-on-error-container shrink-0 mt-0.5" />
              <p className="font-body-sm text-body-sm text-on-error-container">
                ¿Necesitás hablar ya? <a className="font-semibold underline" href="tel:133">Línea 133</a>,
                gratis las 24 horas, desde cualquier teléfono.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

/* --- Burbujas ---------------------------------------------------------------- */

function Burbuja({ mensaje }: { mensaje: Mensaje }) {
  if (mensaje.quien === 'sistema') {
    return (
      <div className="flex justify-center">
        <span className="px-space-md py-space-2xs bg-surface-container-high/80 backdrop-blur-md rounded-full font-label-sm text-label-sm text-on-surface-variant text-center">
          {mensaje.texto}
        </span>
      </div>
    );
  }

  if (mensaje.quien === 'user') {
    return (
      <div className="flex flex-col items-end max-w-[88%] md:max-w-[78%] self-end">
        <div className="bg-primary-container text-on-primary-container p-space-md rounded-2xl rounded-tr-sm shadow-[0_6px_20px_rgba(189,164,243,0.28)]">
          <p className="font-body-md text-body-md leading-relaxed">{mensaje.texto}</p>
        </div>
        <div className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant mt-1 pr-1">
          <span>{mensaje.hora}</span>
          <Icono nombre="done_all" className="text-[16px] text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-space-sm max-w-[90%] md:max-w-[80%]">
      <Isotipo tamano={32} conFondo className="shrink-0 mt-1" />
      <div className="flex flex-col gap-space-2xs">
        <div className="bg-surface-container-lowest p-space-md rounded-2xl rounded-tl-sm shadow-[0_4px_18px_rgba(28,45,90,0.05)] text-on-surface">
          <p className="font-body-md text-body-md leading-relaxed">{mensaje.texto}</p>
        </div>
        <div className="flex items-center gap-space-2xs text-on-surface-variant font-label-sm text-label-sm pl-space-xs">
          <span>Lumy</span><span>•</span><span>{mensaje.hora}</span>
        </div>
      </div>
    </div>
  );
}

/* --- Resumen en vivo ---------------------------------------------------------
 * El mockup mostraba "Sobrecarga Mental · 65% tensión" sobre una conversación de
 * ejemplo. Acá el número sale de las respuestas que la persona acaba de dar: los
 * valores van de 1 a 5 con 5 como la mejor situación, así que la carga es la
 * distancia al 5, que es la misma inversión que hace `icve.service` en el
 * servidor. No es el ICVE —ese se calcula al cerrar, con pesos por componente—
 * y por eso no se presenta como un puntaje sino como lo que llevás dicho.
 * --------------------------------------------------------------------------- */

function ResumenDelMomento({ respondidos, nombre }: { respondidos: Respondido[]; nombre: string }) {
  const carga = useMemo(() => {
    if (!respondidos.length) return null;
    const media = respondidos.reduce((s, r) => s + r.valor, 0) / respondidos.length;
    return Math.round(((5 - media) / 4) * 100);
  }, [respondidos]);

  return (
    <article className="bg-surface-container-lowest rounded-lg p-space-md shadow-[0_8px_24px_-4px_rgba(189,164,243,0.1)]">
      <div className="flex items-center justify-between pb-space-xs">
        <div className="flex items-center gap-space-xs">
          <span className="p-space-2xs rounded-lg bg-primary-fixed text-on-primary-fixed">
            <Icono nombre="psychology" className="text-[20px]" />
          </span>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">
            {nombre ? `Lo que llevás, ${nombre}` : 'Lo que llevás dicho'}
          </h2>
        </div>
        <span className="px-space-xs py-0.5 rounded-full bg-surface-container font-label-sm text-label-sm text-on-surface-variant">
          En vivo
        </span>
      </div>

      {carga === null ? (
        <p className="font-body-sm text-body-sm text-on-surface-variant p-space-sm rounded-xl bg-surface-container-low">
          Todavía no respondiste nada. Esto se va llenando solo mientras conversan — y solo con lo
          que vos digas.
        </p>
      ) : (
        <>
          <div className="my-space-sm p-space-sm rounded-xl bg-surface-container-low flex flex-col gap-space-xs">
            <div className="flex items-center justify-between font-label-md text-label-md">
              <span className="text-on-surface font-semibold">Cómo viene el día</span>
              <span className="text-primary font-bold">
                {carga >= 60 ? 'Viene pesando' : carga >= 35 ? 'Con altibajos' : 'Viene liviano'}
              </span>
            </div>

            <div className="mt-space-2xs flex items-center gap-space-sm">
              <div className="flex-1 bg-surface-container-high h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-primary-container h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${carga}%` }}
                />
              </div>
              <span className="font-label-sm text-label-sm text-on-surface-variant shrink-0">
                {carga}%
              </span>
            </div>

            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Sobre {respondidos.length} {respondidos.length === 1 ? 'respuesta' : 'respuestas'} de
              hoy. El puntaje que se guarda se calcula al terminar y pesa cada parte distinto.
            </p>
          </div>

          <ul className="flex flex-col gap-space-2xs">
            {respondidos.map((r, i) => (
              <li
                key={`${r.componente}-${i}`}
                className="flex items-center justify-between px-space-sm py-space-2xs rounded-lg bg-surface-container-low font-label-md text-label-md"
              >
                <span className="text-on-surface-variant">
                  {ETIQUETA_COMPONENTE[r.componente] ?? r.componente}
                </span>
                <span className="flex items-center gap-0.5" aria-label={`${r.valor} de 5`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span
                      key={n}
                      className={`w-1.5 h-4 rounded-full ${
                        n <= r.valor ? 'bg-primary-container' : 'bg-surface-container-high'
                      }`}
                      aria-hidden="true"
                    />
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </article>
  );
}

/* --- Controles según el formato que pidió el modelo ------------------------ */

function Controles({
  turno, borrador, setBorrador, grabando, onGrabar, onResponder, onSaltar, onTextoLibre,
}: {
  turno: Turno;
  borrador: string;
  setBorrador: (v: string) => void;
  grabando: boolean;
  onGrabar: () => void;
  onResponder: (turno: Turno, texto: string, valor: number | null) => void;
  onSaltar: (turno: Turno) => void;
  onTextoLibre: (texto: string) => void;
}) {
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => { if (turno.formato === 'texto') campo.current?.focus(); }, [turno]);

  if (turno.formato === 'opciones') {
    return (
      <div className="flex flex-wrap gap-space-xs">
        {turno.opciones.map((op) => (
          <button
            key={op.etiqueta}
            className="inline-flex items-center gap-1.5 px-space-sm py-space-xs rounded-full bg-surface-container-low hover:bg-primary-fixed hover:text-on-primary-fixed text-on-surface font-label-md text-label-md transition-all"
            type="button"
            onClick={() => onResponder(turno, `${op.emoji} ${op.etiqueta}`, op.valor)}
          >
            <span>{op.emoji}</span> {op.etiqueta}
          </button>
        ))}
      </div>
    );
  }

  if (turno.formato === 'escala') {
    return (
      <>
        <div className="flex items-center gap-space-xs">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              className="flex-1 py-space-sm rounded-xl bg-surface-container-low hover:bg-primary-container hover:text-on-primary-container font-headline-sm text-headline-sm text-on-surface transition-all"
              type="button"
              aria-label={`${n} de 5`}
              onClick={() => onResponder(turno, `${n} de 5`, n)}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="mt-space-xs font-body-sm text-body-sm text-on-surface-variant text-center">
          1 es mucho menos que tu normal, 5 es mucho más.
        </p>
      </>
    );
  }

  const enviar = () => {
    const valor = borrador.trim();
    if (!valor) return onSaltar(turno);
    onTextoLibre(valor);
    onResponder(turno, valor, null);
  };

  return (
    <>
      <div className="flex items-center gap-space-xs">
        <button
          className={`p-space-xs rounded-full shrink-0 flex items-center justify-center transition-colors ${
            grabando
              ? 'bg-error-container text-on-error-container animate-pulse'
              : 'text-secondary hover:bg-secondary-container'
          }`}
          type="button"
          aria-label={grabando ? 'Detener la nota de voz' : 'Grabar una nota de voz'}
          aria-pressed={grabando}
          onClick={onGrabar}
        >
          <Icono nombre={grabando ? 'stop_circle' : 'mic'} className="text-[22px]" />
        </button>

        <div className="relative flex-1">
          <input
            ref={campo}
            className="w-full py-space-xs px-space-md bg-surface-container-low rounded-full font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none focus:bg-surface-container focus:shadow-[0_0_0_2px_rgba(189,164,243,0.4)] transition-all"
            placeholder="Escribí lo que quieras…"
            aria-label="Escribí tu respuesta"
            type="text"
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); enviar(); } }}
          />
        </div>

        <button
          className="w-11 h-11 rounded-full bg-primary hover:bg-on-primary-container text-on-primary flex items-center justify-center transition-all shadow-[0_4px_14px_rgba(104,82,154,0.3)] hover:scale-105 shrink-0"
          type="button"
          aria-label="Enviar"
          onClick={enviar}
        >
          <Icono nombre="send" className="text-[20px]" />
        </button>
      </div>

      <button
        className="mt-space-xs font-label-md text-label-md text-on-surface-variant hover:text-on-surface underline"
        type="button"
        onClick={() => onSaltar(turno)}
      >
        Saltar esta parte
      </button>
    </>
  );
}

/* --- Cierre ----------------------------------------------------------------- */

function Cerrado({ resultado, racha }: { resultado: Cierre; racha: number }) {
  const factores = resultado.factores ?? [];

  return (
    <div className="flex flex-col gap-space-md">
      {/* El check-in de hoy ya suma: la racha que trajo el turno es la de antes
          de guardar este registro. */}
      {racha > 1 && (
        <div className="flex items-center gap-space-sm p-space-md rounded-xl bg-tertiary-fixed/40">
          <span className="w-11 h-11 rounded-full bg-tertiary-fixed-dim text-on-tertiary-fixed flex items-center justify-center shrink-0">
            <Icono nombre="local_fire_department" className="text-[22px]" />
          </span>
          <div>
            <p className="font-headline-sm text-headline-sm text-on-surface">{racha} días</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              seguidos apareciendo. Se premia la constancia, no el ánimo.
            </p>
          </div>
        </div>
      )}

      {factores.length > 0 && (
        <div className="p-space-md rounded-xl bg-secondary-container/30">
          <p className="font-label-md text-label-md text-on-surface font-semibold mb-space-2xs">
            Qué se tomó en cuenta
          </p>
          <ul className="flex flex-col gap-space-2xs">
            {factores.map((f) => (
              <li key={f.factor} className="flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface-variant">
                <Icono
                  nombre={f.direccion === 'protege' ? 'trending_up' : 'trending_down'}
                  className={`text-[16px] ${f.direccion === 'protege' ? 'text-secondary' : 'text-primary'}`}
                />
                {f.factor}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-xs">
        <div className="p-space-sm rounded-xl bg-surface-container-low">
          <p className="font-label-md text-label-md text-on-surface font-semibold">Qué se guarda</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Tus respuestas y tu texto, en tu cuenta.
          </p>
        </div>
        <div className="p-space-sm rounded-xl bg-surface-container-low">
          <p className="font-label-md text-label-md text-on-surface font-semibold">Qué no se comparte</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Nadie lee lo que escribiste palabra por palabra.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-space-xs">
        <A
          className="inline-flex items-center gap-space-2xs px-space-md py-space-xs rounded-full bg-primary text-on-primary font-label-md text-label-md font-semibold hover:bg-on-primary-container transition-all"
          href="#/inicio"
        >
          <Icono nombre="cottage" className="text-[18px]" /> Volver al inicio
        </A>
        <A
          className="inline-flex items-center gap-space-2xs px-space-md py-space-xs rounded-full bg-secondary-container text-on-secondary-container font-label-md text-label-md font-semibold hover:bg-secondary-fixed transition-all"
          href="#/respirar"
        >
          <Icono nombre="mindfulness" className="text-[18px]" /> Respirar un minuto
        </A>
      </div>
    </div>
  );
}

export default Checkin;
