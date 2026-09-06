/* ===========================================================================
 * Lumys* — respiración guiada
 * ---------------------------------------------------------------------------
 * Ritmo 4-4-6: inhalar cuatro, sostener cuatro, exhalar seis. La exhalación
 * más larga que la inhalación es lo que activa la rama parasimpática; invertir
 * los números daría el efecto contrario.
 *
 * Lumy respira con el estudiante. `serenidad` durante la inhalación y la
 * retención, `esperanza` al exhalar — las dos de banda apoyo. El acompañamiento
 * es el punto: si el ejercicio se hace solo contra un círculo, es un
 * temporizador; con la mascota siguiendo el mismo ritmo, es compañía.
 *
 * El temporizador se limpia al desmontar. En la versión anterior eso dependía
 * de un `hashchange` con `{ once: true }`, que fallaba si el estudiante volvía
 * a entrar a la vista sin cambiar de hash.
 *
 * ── Sobre el marcado ───────────────────────────────────────────────────────
 * Es la segunda sección de `huella_emocional_constancia_juegos_de_calma`: los
 * anillos que se expanden, Lumy al centro creciendo con la inhalación y la
 * botonera de abajo. Dos apartes del mockup:
 *
 *   · Anuncia "Técnica Rítmica 4-7-8" pero acá el ciclo es 4-4-6, que es el que
 *     estaba implementado y documentado. Se rotula lo que de verdad se hace.
 *   · Su selector de ambiente tiene cuatro sonidos y ningún archivo de audio
 *     detrás. Quedan los dos que se pueden cumplir —lluvia sintetizada y
 *     silencio—; fuego y ondas cósmicas no se pueden sintetizar de forma
 *     convincente y un botón que no suena es peor que no tenerlo.
 * =========================================================================== */

import { useCallback, useEffect, useRef, useState } from 'react';

import { Lumy } from '../lumy/Lumy.tsx';
import { useAvisos } from '../lib/avisos.tsx';
import * as ambiente from '../lib/ambiente.ts';
import * as progreso from '../lib/progreso.ts';
import { reduceMotion } from '../lib/formato.ts';
import type { EmocionApoyo } from '../lumy/emociones.ts';

const FASES = [
  { texto: 'Inhalá', ayuda: 'Por la nariz, sin forzar', segundos: 4, cara: 'serenidad', escala: 1.18 },
  { texto: 'Sostené', ayuda: 'Quedate acá un momento', segundos: 4, cara: 'serenidad', escala: 1.18 },
  { texto: 'Exhalá', ayuda: 'Por la boca, largo y lento', segundos: 6, cara: 'esperanza', escala: 0.86 },
] as const satisfies readonly {
  texto: string; ayuda: string; segundos: number; cara: EmocionApoyo; escala: number;
}[];

function Icono({ nombre, className = '' }: { nombre: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`} aria-hidden="true">{nombre}</span>;
}

/** Lo que dura una ronda entera, en segundos. */
const CICLO = FASES.reduce((total, f) => total + f.segundos, 0);

/** En qué fase y a cuántos segundos del final cae un momento del ciclo. */
function momento(segundos: number) {
  const dentro = segundos % CICLO;
  let acumulado = 0;
  for (let i = 0; i < FASES.length; i += 1) {
    const fin = acumulado + FASES[i]!.segundos;
    if (dentro < fin) return { fase: i, restante: Math.ceil(fin - dentro) };
    acumulado = fin;
  }
  return { fase: 0, restante: FASES[0].segundos };
}

export function Respirar() {
  const avisar = useAvisos();
  const [corriendo, setCorriendo] = useState(false);
  const [transcurrido, setTranscurrido] = useState(0);
  const [conLluvia, setConLluvia] = useState(false);
  const intervalo = useRef<ReturnType<typeof setInterval> | null>(null);
  const arranque = useRef(0);
  const contadas = useRef(0);

  /* El ritmo se deriva del reloj, no de restar uno a un contador.
   *
   * La versión anterior encadenaba `setCiclos` dentro de `setFase` dentro de
   * `setRestante`: efectos secundarios dentro de funciones de actualización,
   * que React exige que sean puras y que en modo estricto invoca dos veces. El
   * resultado era que el ciclo corría al triple de velocidad y que cada ronda
   * sumaba dos a la insignia — se medían 3 rondas y 6 respiraciones en 15
   * segundos, cuando una sola ronda dura 14. Con el tiempo transcurrido como
   * única fuente, la fase es una función pura del reloj y además no acumula
   * deriva si el navegador atrasa un tick. */
  const detener = useCallback(() => {
    if (intervalo.current) clearInterval(intervalo.current);
    intervalo.current = null;
    setCorriendo(false);
    setTranscurrido(0);
  }, []);

  const correr = useCallback(() => {
    arranque.current = Date.now();
    contadas.current = 0;
    setTranscurrido(0);
    setCorriendo(true);

    // Cada 200 ms para que el número de la cuenta atrás no se vea saltar; el
    // valor que se pinta se redondea igual a segundos enteros.
    intervalo.current = setInterval(() => {
      setTranscurrido(Date.now() - arranque.current);
    }, 200);
  }, []);

  const ciclos = corriendo ? Math.floor(transcurrido / 1000 / CICLO) : 0;

  // La ronda cuenta cuando se termina, no cuando se abre la pantalla: es lo que
  // hace que la insignia "Respiro" signifique algo. Se guarda en el teléfono, no
  // viaja a ningún lado. El `ref` evita contar dos veces la misma ronda si el
  // efecto se vuelve a ejecutar.
  useEffect(() => {
    if (ciclos <= contadas.current) return;
    for (let i = contadas.current; i < ciclos; i += 1) progreso.sumar('respiraciones');
    contadas.current = ciclos;
    if (ciclos === 4) avisar('Cuatro rondas completas. Eso ya cuenta.', { tipo: 'logro' });
  }, [ciclos, avisar]);

  // Se limpia al desmontar: irse de la vista tiene que parar el temporizador y
  // callar la lluvia. Sin esto el ambiente seguiría sonando en otra pantalla.
  useEffect(() => () => {
    if (intervalo.current) clearInterval(intervalo.current);
    ambiente.detener();
  }, []);

  const { fase, restante } = momento(transcurrido / 1000);

  const alternarLluvia = () => {
    if (conLluvia) { ambiente.detener(); setConLluvia(false); return; }
    if (!ambiente.soportado()) {
      avisar('Este navegador no permite generar el sonido de lluvia.', { tipo: 'info' });
      return;
    }
    ambiente.iniciar();
    setConLluvia(true);
  };

  const actual = FASES[fase] ?? FASES[0];
  // Con movimiento reducido los anillos no se expanden: el ejercicio sigue
  // funcionando con el texto y la cuenta, que es lo que de verdad lo guía.
  const quieto = reduceMotion();
  const escala = corriendo && !quieto ? actual.escala : 1;
  const duracion = quieto ? 0 : actual.segundos * 1000;

  return (
    <section className="w-full pt-space-lg max-w-[1200px] mx-auto px-margin-mobile md:px-margin-desktop flex flex-col gap-space-lg">

      <section className="w-full bg-surface-container-lowest rounded-3xl p-space-lg md:p-space-2xl shadow-[0_8px_24px_-4px_rgba(189,164,243,0.1)] flex flex-col gap-space-xl relative overflow-hidden">

        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-space-sm">
          <div className="max-w-xl">
            <span className="font-label-md text-label-md uppercase tracking-wider text-primary font-semibold">
              Ritmo 4-4-6
            </span>
            <h1 className="font-headline-xl-mobile text-headline-xl-mobile md:font-headline-xl md:text-headline-xl text-on-surface">
              Respirá con Lumy
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Inhalá cuatro, sostené cuatro, soltá seis. Lumy se expande con vos para que no tengas
              que ir contando: seguile el ritmo y ya está.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-space-xs p-space-2xs bg-surface-container-low rounded-full shrink-0">
            <button
              className={`px-space-md py-space-2xs rounded-full font-label-sm text-label-sm flex items-center gap-1.5 transition-all ${
                conLluvia
                  ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              type="button"
              aria-pressed={conLluvia}
              onClick={alternarLluvia}
            >
              <Icono nombre="rainy" className="text-[16px] text-secondary" />
              <span>Lluvia suave</span>
            </button>
            <button
              className={`px-space-md py-space-2xs rounded-full font-label-sm text-label-sm flex items-center gap-1.5 transition-all ${
                conLluvia
                  ? 'text-on-surface-variant hover:text-on-surface'
                  : 'bg-surface-container-lowest text-on-surface shadow-sm'
              }`}
              type="button"
              aria-pressed={!conLluvia}
              onClick={() => { ambiente.detener(); setConLluvia(false); }}
            >
              <Icono nombre="volume_off" className="text-[16px]" />
              <span>Silencio</span>
            </button>
          </div>
        </div>

        {/* --- El círculo --- */}
        <div className="relative w-full py-space-xl flex flex-col items-center justify-center min-h-[380px]">
          <div
            className="absolute w-72 h-72 rounded-full bg-primary-fixed/30 ease-in-out"
            style={{ transform: `scale(${escala})`, transition: `transform ${duracion}ms ease-in-out` }}
            aria-hidden="true"
          />
          <div
            className="absolute w-56 h-56 rounded-full bg-secondary-fixed/40 ease-in-out"
            style={{ transform: `scale(${escala})`, transition: `transform ${duracion}ms ease-in-out` }}
            aria-hidden="true"
          />

          <div
            className="relative z-10 flex flex-col items-center justify-center text-center"
            style={{ transform: `scale(${escala})`, transition: `transform ${duracion}ms ease-in-out` }}
          >
            <Lumy emocion={corriendo ? actual.cara : 'serenidad'} ancho={190} etiqueta={null} />

            <div className="mt-space-md">
              {/* `aria-live` va acá y no en el contador: quien usa lector de
                  pantalla necesita la instrucción, no que le canten los
                  segundos uno por uno. */}
              <span
                className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight block"
                aria-live="polite"
              >
                {corriendo ? actual.texto : 'Listo cuando vos querás'}
              </span>
              <span className="font-body-md text-body-md text-primary font-medium">
                {corriendo ? actual.ayuda : 'Tocá el botón de abajo'}
              </span>
              {corriendo && restante > 0 && (
                <span className="mt-space-2xs block font-headline-md text-headline-md text-on-surface-variant tabular-nums">
                  {restante}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-space-md">
          <button
            className={`px-space-xl py-space-md rounded-full font-label-lg text-label-lg shadow-md transition-all flex items-center gap-space-xs ${
              corriendo
                ? 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                : 'bg-primary text-on-primary hover:bg-on-primary-container'
            }`}
            type="button"
            onClick={() => (corriendo ? detener() : correr())}
          >
            <Icono nombre={corriendo ? 'pause' : 'play_arrow'} className="text-[22px]" />
            <span>{corriendo ? 'Parar' : 'Empezar'}</span>
          </button>

          {ciclos > 0 && (
            <span className="inline-flex items-center gap-space-2xs px-space-md py-space-xs rounded-full bg-tertiary-fixed/50 text-on-tertiary-fixed font-label-md text-label-md font-semibold">
              <Icono nombre="check_circle" className="text-[18px]" />
              {ciclos} {ciclos === 1 ? 'ronda' : 'rondas'} hoy
            </span>
          )}
        </div>
      </section>

      {/* --- Acompañamiento --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-lg">
        <article className="bg-surface-container-lowest rounded-3xl p-space-lg shadow-[0_8px_24px_-4px_rgba(189,164,243,0.1)] flex flex-col gap-space-sm">
          <h2 className="font-headline-md text-headline-md text-on-surface">Cuándo suele servir</h2>
          <ul className="flex flex-col gap-space-xs">
            {[
              { icono: 'edit_note', texto: 'Antes de un examen o una exposición.' },
              { icono: 'sentiment_stressed', texto: 'Después de una discusión, cuando todavía estás caliente.' },
              { icono: 'bedtime', texto: 'De noche, si la cabeza no para.' },
            ].map((item) => (
              <li key={item.icono} className="flex items-start gap-space-sm p-space-sm rounded-2xl bg-surface-container-low">
                <span className="w-9 h-9 rounded-lg bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center shrink-0">
                  <Icono nombre={item.icono} className="text-[20px]" />
                </span>
                <span className="font-body-md text-body-md text-on-surface">{item.texto}</span>
              </li>
            ))}
          </ul>
        </article>

        <div className="flex flex-col gap-space-lg">
          <article className="bg-primary-fixed/40 rounded-3xl p-space-lg flex items-center gap-space-md">
            <Lumy emocion="empatia" ancho={84} etiqueta={null} />
            <p className="font-body-lg text-body-lg text-on-surface">
              No tenés que sentirte distinto al terminar. A veces solo sirve para bajar un cambio.
            </p>
          </article>

          <div className="bg-error-container/60 rounded-3xl p-space-lg flex items-start gap-space-sm">
            <Icono nombre="call" className="text-[22px] text-on-error-container shrink-0 mt-0.5" />
            <p className="font-body-md text-body-md text-on-error-container">
              Si esto no alcanza y necesitás hablar:{' '}
              <a className="font-semibold underline" href="tel:133">Línea 133</a>, gratis las 24 horas.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Respirar;
