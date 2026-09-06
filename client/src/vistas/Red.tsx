/* ==========================================================================
   Lumys* — Mi red de confianza

   La vista donde el estudiante decide quién se entera si algo se sostiene en el
   tiempo. Es, de todo el ecosistema, la pantalla donde más se juega la
   confianza: si acá se siente vigilado, deja de hacer check-in y el resto del
   producto da igual.

   ── Los dos modos ────────────────────────────────────────────────────────────
   El diseño anterior daba por hecho que todo estudiante tiene un adulto de
   confianza al que avisar. Muchos no lo tienen, y para algunos el problema está
   justamente en su casa. Obligarlos a nombrar a alguien los empuja a una de dos
   salidas: poner un nombre falso, o dejar de usar la aplicación.

   Por eso hay dos modos, y cambiar de uno a otro es reversible y no cuesta nada:

     · personal  — su gente, en el orden que él decida.
     · anónima   — el equipo de Lumys, que no sabe quién es.

   La lista personal NO se borra al pasar a anónimo. Se guarda apagada. Quien se
   esconde hoy puede querer volver mañana.

   ── Lo que no se puede apagar ────────────────────────────────────────────────
   MIFAN (133) y la Policía Nacional (118) están en los dos modos y no tienen
   interruptor. No son contactos de la red: son el piso legal. Se muestran como
   información —teléfonos que puede marcar cuando quiera— y no como algo que la
   aplicación vaya a activar a sus espaldas. La diferencia es todo: uno es una
   herramienta que se le da, el otro sería una amenaza.

   ── Sobre el marcado ─────────────────────────────────────────────────────────
   Es `red_de_confianza_apoyo_institucional`. Se portó completo salvo el envío
   directo: el mockup manda el mensaje al contacto desde la app, y no hay canal
   de mensajería conectado. Las plantillas se copian al portapapeles, que es lo
   que sí se puede cumplir hoy y deja al estudiante mandándolo por donde ya
   habla con esa persona.
   ========================================================================== */

import { useEffect, useState } from 'react';

import { Cargador, Vacio } from '../componentes/comunes.tsx';
import { Dialogo } from '../componentes/Dialogo.tsx';
import { Lumy } from '../lumy/Lumy.tsx';
import { useAvisos } from '../lib/avisos.tsx';
import { iniciales } from '../lib/formato.ts';
import { escalon, useRevelar } from '../lib/movimiento.ts';
import * as api from '../lib/api.ts';
import type { Contacto, ModoRed } from '../lib/tipos.ts';

/* --------------------------------------------------------------------------
   Datos fijos

   Viven acá y no en demo.ts a propósito: no son datos de demostración que un
   endpoint vaya a reemplazar algún día, son las líneas oficiales de Nicaragua.
   Si alguna cambia, se cambia acá y en ningún otro sitio.
   -------------------------------------------------------------------------- */

const CANALES_OFICIALES = [
  {
    id: 'mifan',
    nombre: 'MIFAN',
    detalle: 'Ministerio de la Familia, Adolescencia y Niñez',
    telefono: '133',
    descripcion:
      'Atienden situaciones de niñez y adolescencia. Podés llamar vos, sin que nadie más lo sepa y sin dar tu nombre si no querés.',
    simbolo: 'family_restroom',
    tono: 'bg-tertiary-fixed/50 text-on-tertiary-fixed',
    boton: 'bg-tertiary-fixed-dim text-on-tertiary-fixed hover:brightness-95',
  },
  {
    id: 'policia',
    nombre: 'Policía Nacional',
    detalle: 'Comisaría de la Mujer, la Niñez y la Adolescencia',
    telefono: '118',
    descripcion:
      'Para cuando hay riesgo inmediato: violencia en casa, alguien que te amenaza, una situación que no puede esperar.',
    simbolo: 'local_police',
    tono: 'bg-secondary-fixed/50 text-on-secondary-fixed',
    boton: 'bg-secondary-fixed-dim text-on-secondary-fixed hover:brightness-95',
  },
];

const EQUIPO_LUMYS = [
  {
    simbolo: 'visibility_off',
    titulo: 'No saben quién sos',
    texto: 'Ven un código, no tu nombre, ni tu grado, ni tu colegio. Nadie de tu centro participa.',
  },
  {
    simbolo: 'schedule',
    titulo: 'Hay alguien de turno siempre',
    texto: 'Psicólogos y orientadores del equipo Lumys, rotando. No dependés de que una persona esté disponible.',
  },
  {
    simbolo: 'forum',
    titulo: 'Empiezan conversando',
    texto: 'La primera respuesta es un mensaje para vos, no un aviso para otro. Vos decidís si seguís.',
  },
];

/** Frases para arrancar una conversación difícil. Se copian, no se envían: la
 *  app no tiene canal de mensajería y mandarlo por WhatsApp desde el teléfono
 *  del estudiante es más honesto que fingir un envío. */
const PLANTILLAS = [
  {
    etiqueta: 'Silencio amigable',
    color: 'text-primary',
    hover: 'hover:bg-primary-fixed/30',
    texto: 'No estoy pasando un buen día. ¿Podrías hacerme compañía un ratito? No hace falta que hablemos.',
  },
  {
    etiqueta: 'Distracción ligera',
    color: 'text-secondary',
    hover: 'hover:bg-secondary-fixed/30',
    texto: 'Tengo la cabeza muy cargada y no logro concentrarme. ¿Tenés cinco minutos para hablar de cualquier tontera?',
  },
  {
    etiqueta: 'Necesito que me escuchen',
    color: 'text-tertiary',
    hover: 'hover:bg-tertiary-fixed/40',
    texto: 'Me pasó algo que me preocupó. Necesito que me escuchés y me ayudés a pensar qué hacer.',
  },
];

function Icono({ nombre, className = '' }: { nombre: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`} aria-hidden="true">{nombre}</span>;
}

/* -------------------------------------------------------------------------- */

export function Red() {
  const avisar = useAvisos();
  const revelar = useRevelar<HTMLElement>();

  const [contactos, setContactos] = useState<Contacto[] | null>(null);
  const [modo, setModo] = useState<ModoRed | null>(null);

  /** Modo que el estudiante tocó y todavía no confirmó. */
  const [modoPendiente, setModoPendiente] = useState<ModoRed | null>(null);
  const [agregando, setAgregando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [relacion, setRelacion] = useState('');
  const [copiada, setCopiada] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    void Promise.all([api.redApoyo(), api.modoRed()]).then(([lista, m]) => {
      if (!activo) return;
      setContactos(lista);
      setModo(m);
    });
    return () => { activo = false; };
  }, []);

  /** Se reordena y se renumera en cada guardado: el `orden` que ve el
   *  estudiante y el que se persiste no pueden separarse. */
  const guardar = (lista: Contacto[]) => {
    const ordenada = [...lista]
      .sort((a, b) => a.orden - b.orden)
      .map((c, i) => ({ ...c, orden: i + 1 }));
    setContactos(ordenada);
    void api.guardarRedApoyo(ordenada);
  };

  const alternar = (id: string, incluir: boolean) => {
    if (!contactos) return;
    const c = contactos.find((x) => x.id === id);
    if (!c) return;
    guardar(contactos.map((x) => (x.id === id ? { ...x, excluido: !incluir } : x)));
    avisar(
      incluir
        ? `${c.nombre.split(' ')[0]} vuelve a tu red.`
        : `${c.nombre.split(' ')[0]} ya no va a recibir avisos.`,
      { tipo: 'ok' },
    );
  };

  const agregar = () => {
    if (nombre.trim().length < 2) {
      avisar('Escribí al menos el nombre.', { tipo: 'aviso' });
      return;
    }
    guardar([...(contactos ?? []), {
      id: `c${Date.now()}`,
      nombre: nombre.trim(),
      relacion: relacion.trim() || 'Persona de confianza',
      orden: (contactos?.length ?? 0) + 1,
      excluido: false,
      canal: 'WhatsApp',
    }]);
    avisar(`${nombre.trim().split(' ')[0]} está en tu red.`, { tipo: 'logro' });
    setNombre('');
    setRelacion('');
    setAgregando(false);
  };

  const confirmarModo = () => {
    if (!modoPendiente) return;
    setModo(modoPendiente);
    void api.guardarModoRed(modoPendiente);
    avisar(
      modoPendiente === 'anonima'
        ? 'Listo. A partir de ahora te acompaña el equipo Lumys, en anónimo.'
        : 'Listo. Volvés a tu red personal, tal como la tenías.',
      { tipo: 'ok' },
    );
    setModoPendiente(null);
  };

  const copiar = async (etiqueta: string, texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiada(etiqueta);
      avisar('Copiado. Pegalo donde ya hablás con esa persona.', { tipo: 'ok' });
      setTimeout(() => setCopiada(null), 2500);
    } catch {
      // El portapapeles necesita contexto seguro (https o localhost). Sin él la
      // promesa se rechaza y hay que decirlo, no tragarse el error.
      avisar('No se pudo copiar. Podés seleccionar el texto a mano.', { tipo: 'info' });
    }
  };

  if (!contactos || !modo) return <Cargador />;

  const activos = contactos.filter((c) => !c.excluido);

  return (
    <>
      <section
        className="relative w-full pt-space-lg max-w-[1200px] mx-auto px-margin-mobile md:px-margin-desktop flex flex-col gap-space-lg"
        ref={revelar}
      >
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="absolute -top-24 -left-32 w-96 h-96 bg-primary-container/20 rounded-full blur-3xl" />
          <div className="absolute top-96 -right-32 w-96 h-96 bg-secondary-fixed/25 rounded-full blur-3xl" />
        </div>

        {/* ================= Encabezado ================= */}
        <header
          className="relative lm-revelar flex flex-col md:flex-row md:items-center justify-between gap-space-md"
          style={escalon(0)}
        >
          <div className="space-y-space-2xs max-w-[60ch]">
            <h1 className="font-headline-xl-mobile text-headline-xl-mobile md:font-headline-xl md:text-headline-xl text-on-surface">
              Tu red de confianza
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant">
              Si algo se sostiene en el tiempo, Lumys busca que alguien converse con vos.
              <strong className="text-on-surface"> Vos elegís quién.</strong> Podés cambiarlo cuando
              quieras, y nadie recibe un aviso sin que esta pantalla lo diga primero.
            </p>
          </div>

          <div className="flex items-center gap-space-sm p-space-sm rounded-2xl bg-surface-container-lowest shadow-[0_8px_24px_-4px_rgba(189,164,243,0.15)] shrink-0">
            <Lumy emocion="confianza" ancho={64} etiqueta={null} />
            <p className="font-body-sm text-body-sm text-on-surface-variant max-w-[22ch]">
              Esta lista es tuya. Nadie más la ve, ni siquiera tu orientador/a.
            </p>
          </div>
        </header>

        {/* ================= Garantía ================= */}
        <div
          className="relative lm-revelar flex items-start gap-space-sm p-space-md rounded-2xl bg-secondary-container/40"
          style={escalon(1)}
        >
          <Icono nombre="verified_user" className="text-[22px] text-on-secondary-container shrink-0 mt-0.5" />
          <div>
            <h2 className="font-label-lg text-label-lg text-on-secondary-container">
              Garantía de autonomía
            </h2>
            <p className="font-body-sm text-body-sm text-on-secondary-container">
              Ningún aviso sale sin que vos lo hayas configurado acá. Sacar a alguien de la lista es
              inmediato y no le llega ninguna notificación de que lo sacaste.
            </p>
          </div>
        </div>

        {/* ================= Modo ================= */}
        <div className="relative lm-revelar" style={escalon(2)}>
          <p className="font-label-md text-label-md uppercase tracking-wider text-primary font-semibold mb-space-xs">
            ¿Cómo preferís que te acompañen?
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
            <TarjetaModo
              activo={modo === 'personal'}
              simbolo="groups"
              titulo="Mi red personal"
              gancho="Gente que vos elegís"
              texto="Tu mamá, un tío, una entrenadora, tu orientador/a. Reciben un mensaje y te buscan para conversar."
              onElegir={() => setModoPendiente('personal')}
              pie={
                modo === 'personal'
                  ? `${activos.length} ${activos.length === 1 ? 'persona activa' : 'personas activas'}`
                  : contactos.length > 0
                    ? `${contactos.length} guardadas, sin usar`
                    : 'Sin nadie todavía'
              }
            />
            <TarjetaModo
              activo={modo === 'anonima'}
              simbolo="visibility_off"
              titulo="Red anónima Lumys"
              gancho="Nadie de tu entorno se entera"
              texto="Te acompaña el equipo de Lumys sin saber quién sos. Para cuando no hay un adulto de confianza cerca — o cuando el problema está en casa."
              onElegir={() => setModoPendiente('anonima')}
              pie="Siempre hay alguien de turno"
            />
          </div>
        </div>

        {/* ================= Contenido del modo ================= */}
        {modo === 'personal' ? (
          <article
            className="relative lm-revelar bg-surface-container-lowest rounded-3xl p-space-lg md:p-space-xl shadow-[0_8px_24px_-4px_rgba(189,164,243,0.1)] flex flex-col gap-space-md"
            style={escalon(3)}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-xs">
              <div>
                <h2 className="font-headline-md text-headline-md text-on-surface">Tu lista, en orden</h2>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  Si la primera persona no responde, se busca a la segunda. Y así.
                </p>
              </div>
              <button
                className="inline-flex items-center gap-space-2xs px-space-md py-space-xs rounded-full bg-primary text-on-primary font-label-md text-label-md font-semibold hover:bg-on-primary-container transition-all shrink-0"
                type="button"
                onClick={() => setAgregando(true)}
              >
                <Icono nombre="person_add" className="text-[18px]" /> Agregar
              </button>
            </div>

            <div className="flex items-start gap-space-sm p-space-md rounded-2xl bg-surface-container-low">
              <Icono nombre="info" className="text-[20px] text-secondary shrink-0 mt-0.5" />
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                <strong className="text-on-surface">No tiene que ser un profesional.</strong> Puede
                ser un tío, una prima, un entrenador, un líder religioso. Lo que importa es que sea
                alguien con quien te sentís tranquilo hablando.
              </p>
            </div>

            {contactos.length === 0 ? (
              <Vacio
                titulo="Todavía no armaste tu red"
                detalle="Agregá al menos a una persona con la que te sientas tranquilo hablando. Si no se te ocurre nadie, la red anónima existe para eso."
                emocion="esperanza"
              />
            ) : (
              <ul className="flex flex-col gap-space-sm">
                {contactos.map((c, i) => (
                  <li
                    key={c.id}
                    className={`flex items-center gap-space-sm p-space-md rounded-2xl transition-all ${
                      c.excluido ? 'bg-surface-container-low opacity-60' : 'bg-surface-container-low'
                    }`}
                  >
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center font-label-md text-label-md shrink-0 ${
                      c.excluido
                        ? 'bg-surface-container-high text-outline'
                        : 'bg-primary text-on-primary'
                    }`}>
                      {c.excluido ? '—' : i + 1}
                    </span>

                    <span className={`w-11 h-11 rounded-full flex items-center justify-center font-label-lg text-label-lg shrink-0 ${
                      c.excluido
                        ? 'bg-surface-container-high text-on-surface-variant'
                        : 'bg-primary-fixed text-on-primary-fixed'
                    }`}>
                      {iniciales(c.nombre)}
                    </span>

                    <div className="flex-1 min-w-0">
                      <p className="font-label-lg text-label-lg text-on-surface truncate">{c.nombre}</p>
                      <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                        {c.relacion} · {c.excluido ? 'no recibe avisos' : c.canal}
                      </p>
                    </div>

                    {/* Un checkbox de verdad: llega el foco y el lector lo
                        anuncia como casilla, sin reimplementar el patrón. */}
                    <label className="relative shrink-0 cursor-pointer">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={!c.excluido}
                        aria-label={`${c.excluido ? 'Incluir a' : 'Excluir a'} ${c.nombre}`}
                        onChange={(e) => alternar(c.id, e.target.checked)}
                      />
                      <span className="block w-11 h-6 rounded-full bg-surface-container-high peer-checked:bg-primary transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2" />
                      <span className="absolute top-1 left-1 w-4 h-4 rounded-full bg-surface-container-lowest transition-transform peer-checked:translate-x-5" />
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </article>
        ) : (
          <article
            className="relative lm-revelar bg-on-background rounded-3xl p-space-lg md:p-space-xl flex flex-col gap-space-md"
            style={escalon(3)}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-xs">
              <div>
                <h2 className="font-headline-md text-headline-md text-inverse-on-surface">
                  Te acompaña el equipo Lumys
                </h2>
                <p className="font-body-md text-body-md text-inverse-on-surface/70">
                  Sin nombres. Sin tu colegio. Sin que nadie de tu entorno lo sepa.
                </p>
              </div>
              <span className="inline-flex items-center gap-space-2xs px-space-md py-space-xs rounded-full bg-inverse-primary/25 text-inverse-on-surface font-label-md text-label-md font-semibold shrink-0">
                <Icono nombre="shield_lock" className="text-[18px]" /> Anónimo
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
              {EQUIPO_LUMYS.map((item, i) => (
                <div
                  className="p-space-md rounded-2xl bg-inverse-on-surface/10 flex flex-col gap-space-2xs lm-revelar"
                  key={item.titulo}
                  style={escalon(i)}
                >
                  <span className="w-10 h-10 rounded-lg bg-inverse-primary/30 text-inverse-on-surface flex items-center justify-center">
                    <Icono nombre={item.simbolo} className="text-[20px]" />
                  </span>
                  <h3 className="font-label-lg text-label-lg text-inverse-on-surface">{item.titulo}</h3>
                  <p className="font-body-sm text-body-sm text-inverse-on-surface/70">{item.texto}</p>
                </div>
              ))}
            </div>

            {contactos.length > 0 && (
              <div className="flex items-start gap-space-sm p-space-md rounded-2xl bg-inverse-on-surface/10">
                <Icono nombre="bookmark" className="text-[20px] text-inverse-on-surface shrink-0 mt-0.5" />
                <p className="font-body-sm text-body-sm text-inverse-on-surface/80">
                  <strong className="text-inverse-on-surface">Tu lista personal sigue guardada.</strong>{' '}
                  Las {contactos.length} personas que habías agregado no se borraron y nadie las
                  está avisando. Si algún día querés volver, están ahí.
                </p>
              </div>
            )}
          </article>
        )}

        {/* ================= Plantillas ================= */}
        <article
          className="relative lm-revelar p-space-lg rounded-3xl bg-surface-container-low"
          style={escalon(4)}
        >
          <div className="flex items-center gap-space-xs mb-space-2xs">
            <Icono nombre="auto_awesome" className="text-[20px] text-primary" />
            <h2 className="font-headline-sm text-headline-sm text-on-surface">
              ¿No sabés cómo empezar a hablar?
            </h2>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant mb-space-md">
            Tocá una y se copia. Después la pegás donde ya hablás con esa persona — Lumys no manda
            el mensaje por vos.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm">
            {PLANTILLAS.map((p) => (
              <button
                key={p.etiqueta}
                type="button"
                onClick={() => copiar(p.etiqueta, p.texto)}
                className={`group text-left p-space-md rounded-2xl bg-surface-container-lowest shadow-sm transition-all ${p.hover}`}
              >
                <span className={`font-label-sm text-label-sm uppercase font-bold tracking-wider ${p.color}`}>
                  {p.etiqueta}
                </span>
                <p className="font-body-sm text-body-sm text-on-surface mt-space-2xs">“{p.texto}”</p>
                <span className="mt-space-xs flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
                  <Icono nombre={copiada === p.etiqueta ? 'check' : 'content_copy'} className="text-[14px]" />
                  {copiada === p.etiqueta ? 'Copiado' : 'Tocá para copiar'}
                </span>
              </button>
            ))}
          </div>
        </article>

        {/* ================= Canales oficiales ================= */}
        <article className="relative lm-revelar flex flex-col gap-space-md" style={escalon(5)}>
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface">
              Líneas oficiales, siempre disponibles
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Estén como estén tus otras opciones, estos dos teléfonos son tuyos. Son gratis,
              atienden las 24 horas y no necesitás la aplicación para usarlos.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
            {CANALES_OFICIALES.map((canal, i) => (
              <div
                className={`p-space-lg rounded-3xl flex flex-col gap-space-sm lm-revelar ${canal.tono}`}
                key={canal.id}
                style={escalon(i)}
              >
                <div className="flex items-center gap-space-sm">
                  <span className="w-12 h-12 rounded-full bg-surface-container-lowest/60 flex items-center justify-center shrink-0">
                    <Icono nombre={canal.simbolo} className="text-[24px]" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-headline-sm text-headline-sm">{canal.nombre}</p>
                    <p className="font-body-sm text-body-sm opacity-80">{canal.detalle}</p>
                  </div>
                </div>

                <p className="font-body-md text-body-md">{canal.descripcion}</p>

                {/* `tel:` de verdad: en un teléfono abre el marcador con el
                    número puesto. En escritorio no hace nada visible, y por eso
                    el número también se lee en el propio botón. */}
                <a
                  className={`mt-auto inline-flex items-center justify-center gap-space-2xs w-full py-space-sm rounded-full font-label-lg text-label-lg font-semibold transition-all ${canal.boton}`}
                  href={`tel:${canal.telefono}`}
                >
                  <Icono nombre="call" className="text-[20px]" />
                  Llamar al {canal.telefono}
                </a>
              </div>
            ))}
          </div>
        </article>

        {/* ================= Escalera ================= */}
        <article
          className="relative lm-revelar bg-surface-container-lowest rounded-3xl p-space-lg md:p-space-xl shadow-[0_8px_24px_-4px_rgba(189,164,243,0.1)] flex flex-col gap-space-md"
          style={escalon(6)}
        >
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface">Qué pasa, paso a paso</h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Nada de esto ocurre de golpe ni a tus espaldas. Siempre empieza por vos.
            </p>
          </div>

          <ol className="flex flex-col gap-space-sm">
            <Paso
              numero="1"
              tono="bg-primary-fixed text-on-primary-fixed"
              titulo="Primero, Lumys habla con vos"
              texto="Te dice qué notó y te pregunta. Si decís que estás bien, ahí queda."
            />
            <Paso
              numero="2"
              tono="bg-secondary-fixed text-on-secondary-fixed"
              titulo={modo === 'personal'
                ? 'Después, la primera persona de tu lista'
                : 'Después, el equipo Lumys de turno'}
              texto={modo === 'personal'
                ? 'Recibe una descripción de lo que cambió, nunca una etiqueta. Si no responde, sigue la siguiente.'
                : 'Te escriben a vos. Nadie de tu colegio ni de tu familia se entera de nada.'}
            />
            <Paso
              numero="3"
              tono="bg-error-container text-on-error-container"
              titulo="Solo si hay riesgo para tu vida"
              texto={`Se recurre a MIFAN (133) o a la Policía Nacional (118).${
                modo === 'personal'
                  ? ' Si tu casa no es un lugar seguro, se va directo acá sin insistir con tu familia.'
                  : ' Tu anonimato se mantiene hasta donde la ley lo permite.'
              }`}
            />
          </ol>
        </article>

        {/* ================= Transparencia ================= */}
        <article
          className="relative lm-revelar bg-surface-container-lowest rounded-3xl p-space-lg md:p-space-xl shadow-[0_8px_24px_-4px_rgba(189,164,243,0.1)]"
          style={escalon(7)}
        >
          <h2 className="font-headline-md text-headline-md text-on-surface mb-space-md">
            Lo que reciben — y lo que no
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
            <div className="p-space-md rounded-2xl bg-secondary-container/40">
              <p className="flex items-center gap-space-2xs font-label-lg text-label-lg text-on-secondary-container mb-space-2xs">
                <Icono nombre="check_circle" className="text-[18px]" /> Sí reciben
              </p>
              <p className="font-body-sm text-body-sm text-on-secondary-container">
                “En las últimas tres semanas ha entregado menos tareas de lo habitual y dejó el
                equipo de fútbol. No sabemos la causa. Sería bueno conversar con él esta semana,
                sin presionarlo.”
              </p>
            </div>
            <div className="p-space-md rounded-2xl bg-error-container/50">
              <p className="flex items-center gap-space-2xs font-label-lg text-label-lg text-on-error-container mb-space-2xs">
                <Icono nombre="cancel" className="text-[18px]" /> Nunca reciben
              </p>
              <p className="font-body-sm text-body-sm text-on-error-container">
                “Presenta síntomas depresivos y riesgo moderado.” Ni puntajes, ni etiquetas, ni lo
                que escribiste palabra por palabra.
              </p>
            </div>
          </div>
        </article>
      </section>

      {/* --- Confirmar cambio de modo ------------------------------------- */}
      <Dialogo
        abierto={modoPendiente !== null && modoPendiente !== modo}
        tono="atencion"
        titulo={
          modoPendiente === 'anonima'
            ? '¿Pasar a la red anónima?'
            : '¿Volver a tu red personal?'
        }
        descripcion={
          modoPendiente === 'anonima' ? (
            <>
              A partir de ahora te acompaña el equipo de Lumys, que no sabe quién sos.
              <strong> Las personas de tu lista dejan de recibir avisos</strong>, pero no se
              borran: siguen guardadas por si querés volver.
            </>
          ) : (
            <>
              Volvés a tu lista de siempre, en el mismo orden que la tenías.
              <strong> Las personas que estaban activas vuelven a poder recibir un aviso</strong>
              {' '}si algo se sostiene en el tiempo.
            </>
          )
        }
        onCerrar={() => setModoPendiente(null)}
        acciones={
          <>
            <button className="lm-btn lm-btn--ghost" type="button" onClick={() => setModoPendiente(null)}>
              Mejor no
            </button>
            <button className="lm-btn" type="button" onClick={confirmarModo}>
              Sí, cambiar
            </button>
          </>
        }
      >
        <div className="lm-note lm-note--teal">
          <i className="bi bi-shield-check" aria-hidden="true" />
          <div>
            <p className="lm-caption mb-0">
              MIFAN (133) y la Policía Nacional (118) siguen disponibles en los dos modos.
              Eso no cambia nunca.
            </p>
          </div>
        </div>
      </Dialogo>

      {/* --- Agregar contacto -------------------------------------------- */}
      <Dialogo
        abierto={agregando}
        titulo="Agregar a alguien de confianza"
        descripcion="Solo vos ves esta lista. Podés sacar a cualquiera en cualquier momento."
        onCerrar={() => setAgregando(false)}
        acciones={
          <>
            <button className="lm-btn lm-btn--ghost" type="button" onClick={() => setAgregando(false)}>
              Cancelar
            </button>
            <button className="lm-btn" type="button" onClick={agregar}>
              Agregar a mi red
            </button>
          </>
        }
      >
        <div className="lm-field">
          <label className="lm-label" htmlFor="contacto-nombre">¿Cómo se llama?</label>
          <input
            className="lm-input" type="text" id="contacto-nombre" placeholder="Tía Lucía"
            value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') agregar(); }}
          />
        </div>
        <div className="lm-field mb-0">
          <label className="lm-label" htmlFor="contacto-relacion">¿Quién es para vos?</label>
          <input
            className="lm-input" type="text" id="contacto-relacion"
            placeholder="Tía / me llevo bien con ella"
            value={relacion} onChange={(e) => setRelacion(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') agregar(); }}
          />
        </div>
      </Dialogo>
    </>
  );
}

/* -------------------------------------------------------------------------- */

function Paso({
  numero, tono, titulo, texto,
}: { numero: string; tono: string; titulo: string; texto: string }) {
  return (
    <li className="flex items-start gap-space-sm p-space-md rounded-2xl bg-surface-container-low">
      <span className={`w-9 h-9 rounded-full flex items-center justify-center font-label-lg text-label-lg font-bold shrink-0 ${tono}`}>
        {numero}
      </span>
      <div>
        <p className="font-label-lg text-label-lg text-on-surface">{titulo}</p>
        <p className="font-body-sm text-body-sm text-on-surface-variant">{texto}</p>
      </div>
    </li>
  );
}

/* --------------------------------------------------------------------------
   Tarjeta de modo

   Es un `radio` de verdad por debajo, no un `div` con onClick: así funciona con
   las flechas del teclado, el lector de pantalla lo anuncia como "opción 1 de
   2" y el estado seleccionado no depende de que alguien recuerde poner un
   `aria-checked`.
   -------------------------------------------------------------------------- */

function TarjetaModo({
  activo, simbolo, titulo, gancho, texto, pie, onElegir,
}: {
  activo: boolean;
  simbolo: string;
  titulo: string;
  gancho: string;
  texto: string;
  pie: string;
  onElegir: () => void;
}) {
  return (
    <label className="cursor-pointer">
      <input type="radio" name="modo-red" className="peer sr-only" checked={activo} onChange={onElegir} />
      <span className={`block h-full p-space-lg rounded-3xl transition-all peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 ${
        activo
          ? 'bg-primary-container shadow-[0_8px_24px_-4px_rgba(189,164,243,0.4)]'
          : 'bg-surface-container-lowest hover:bg-surface-container-low shadow-sm'
      }`}>
        <span className="flex items-start justify-between gap-space-sm mb-space-sm">
          <span className={`w-11 h-11 rounded-lg flex items-center justify-center ${
            activo ? 'bg-on-primary-container text-primary-container' : 'bg-primary-fixed text-on-primary-fixed'
          }`}>
            <Icono nombre={simbolo} className="text-[22px]" />
          </span>
          {activo && (
            <span className="w-6 h-6 rounded-full bg-on-primary-container text-primary-container flex items-center justify-center shrink-0">
              <Icono nombre="check" className="text-[16px]" />
            </span>
          )}
        </span>

        <span className={`block font-headline-sm text-headline-sm ${activo ? 'text-on-primary-container' : 'text-on-surface'}`}>
          {titulo}
        </span>
        <span className={`block font-label-md text-label-md mb-space-2xs ${activo ? 'text-on-primary-container/80' : 'text-primary'}`}>
          {gancho}
        </span>
        <span className={`block font-body-sm text-body-sm ${activo ? 'text-on-primary-container/90' : 'text-on-surface-variant'}`}>
          {texto}
        </span>
        <span className={`mt-space-sm block font-label-sm text-label-sm ${activo ? 'text-on-primary-container/70' : 'text-on-surface-variant'}`}>
          {pie}
        </span>
      </span>
    </label>
  );
}

export default Red;
