/* ===========================================================================
 * Lumys* — constancia e insignias
 * ---------------------------------------------------------------------------
 * El calendario mide APARECER, nunca el ánimo. Un día pesado suma igual que un
 * día bueno: es lo que impide que la racha premie fingirse contento.
 *
 * Ninguna cifra de esta pantalla está escrita a mano. La racha y el total los
 * calcula el servidor sobre los check-ins guardados; las insignias se resuelven
 * contra hechos en `lib/metricas.ts` —incluidas las dos que dependen de algo
 * que solo vive en el teléfono, como cuántas respiraciones completó—; y los
 * días registrados salen de contar el calendario, no de su largo. Ese número
 * era un `35` fijo, o sea el tamaño de la cuadrícula: decía lo mismo el primer
 * día que el año siguiente.
 * =========================================================================== */

import { Cargador, Contador, Vacio } from '../componentes/comunes.tsx';
import { Lumy } from '../lumy/Lumy.tsx';
import { useDatos } from '../lib/useDatos.ts';
import * as api from '../lib/api.ts';
import type { DiaConstancia } from '../lib/tipos.ts';

const DIAS_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** El color sale de la cobertura del check-in, nunca del ánimo. */
const TONO: Record<number, string> = {
  0: 'bg-surface-container-low text-outline-variant',
  1: 'bg-secondary-fixed/40 text-on-secondary-fixed',
  2: 'bg-secondary-fixed/70 text-on-secondary-fixed',
  3: 'bg-primary-fixed text-on-primary-fixed',
  4: 'bg-primary-container text-on-primary-container',
};

function Icono({ nombre, className = '' }: { nombre: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`} aria-hidden="true">{nombre}</span>;
}

export function Logros() {
  const { datos, cargando, error } = useDatos(
    () => Promise.all([api.gemelo(), api.insignias(), api.constancia()]),
    [],
  );

  if (cargando) return <Cargador />;
  if (error || !datos) return <Vacio titulo="No pudimos abrir tu constancia" detalle={error?.message} />;

  const [gemelo, insignias, constancia] = datos;
  const ganadas = insignias.filter((i) => i.obtenida).length;
  const registrados = constancia.filter((d) => d.nivel > 0).length;

  return (
    <section className="w-full pt-space-lg max-w-[1200px] mx-auto px-margin-mobile md:px-margin-desktop flex flex-col gap-space-lg">

      <header className="space-y-space-2xs">
        <h1 className="font-headline-xl-mobile text-headline-xl-mobile md:font-headline-xl md:text-headline-xl text-on-surface">
          Tu constancia
        </h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant max-w-[56ch]">
          Acá se premia <strong className="text-on-surface">aparecer</strong>, nunca cómo te
          sentiste. Un día pesado suma igual que un día bueno.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">

        {/* --- Racha --- */}
        <article className="lg:col-span-5 bg-surface-container-lowest rounded-3xl p-space-lg md:p-space-xl shadow-[0_8px_24px_-4px_rgba(189,164,243,0.1)] flex flex-col gap-space-md">
          <div className="flex items-center gap-space-md">
            <span className="w-16 h-16 rounded-full bg-tertiary-fixed text-on-tertiary-fixed flex items-center justify-center shrink-0">
              <Icono nombre="local_fire_department" className="text-[32px]" />
            </span>
            <div>
              <p className="font-headline-xl-mobile text-headline-xl-mobile text-on-surface leading-none">
                {gemelo.racha}
              </p>
              <p className="font-body-md text-body-md text-on-surface-variant">
                {gemelo.racha === 1 ? 'día seguido' : 'días seguidos'}
              </p>
            </div>
          </div>

          <p className="font-body-md text-body-md text-on-surface-variant">
            No es un puntaje ni una nota. Es solo la prueba de que seguís acá.
          </p>

          <div className="grid grid-cols-2 gap-space-sm">
            <div className="p-space-md rounded-2xl bg-surface-container-low">
              <p className="font-headline-md text-headline-md text-on-surface">
                <Contador valor={ganadas} />
              </p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                insignias de {insignias.length}
              </p>
            </div>
            <div className="p-space-md rounded-2xl bg-surface-container-low">
              <p className="font-headline-md text-headline-md text-on-surface">
                <Contador valor={registrados} />
              </p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                días de los últimos {constancia.length}
              </p>
            </div>
          </div>

          <div className="mt-space-2xs flex items-center gap-space-md p-space-md rounded-2xl bg-primary-fixed/40">
            <Lumy emocion="esperanza" ancho={72} etiqueta={null} />
            <p className="font-body-md text-body-md text-on-surface">
              {gemelo.racha >= 7
                ? 'Una semana entera apareciendo. Eso no lo hace cualquiera.'
                : 'Cada día que aparecés, aunque sea para decir que estuvo feo, cuenta.'}
            </p>
          </div>
        </article>

        {/* --- Calendario --- */}
        <article className="lg:col-span-7 bg-surface-container-lowest rounded-3xl p-space-lg md:p-space-xl shadow-[0_8px_24px_-4px_rgba(189,164,243,0.1)] flex flex-col gap-space-md">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface">Tus últimas cinco semanas</h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Cada cuadro es un día en que apareciste. El tono más fuerte es un check-in más completo.
            </p>
          </div>

          <Calendario dias={constancia} />

          <div className="flex flex-wrap items-center gap-space-md font-label-sm text-label-sm text-on-surface-variant">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 h-4 rounded bg-surface-container-low" /> sin registro
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 h-4 rounded bg-secondary-fixed/70" /> registro corto
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 h-4 rounded bg-primary-container" /> registro completo
            </span>
          </div>
        </article>
      </div>

      {/* --- Insignias --- */}
      <article className="bg-surface-container-lowest rounded-3xl p-space-lg md:p-space-xl shadow-[0_8px_24px_-4px_rgba(189,164,243,0.1)] flex flex-col gap-space-md">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface">Insignias</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Se ganan por constancia y por cuidarte, nunca por estar bien.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-space-sm">
          {insignias.map((ins) => (
            <div
              key={ins.nombre}
              className={`p-space-md rounded-2xl flex flex-col items-center text-center gap-space-2xs transition-all ${
                ins.obtenida
                  ? 'bg-primary-fixed/50'
                  : 'bg-surface-container-low opacity-60'
              }`}
            >
              <span className={`w-12 h-12 rounded-full flex items-center justify-center ${
                ins.obtenida
                  ? 'bg-primary text-on-primary shadow-[0_4px_16px_rgba(189,164,243,0.4)]'
                  : 'bg-surface-container-high text-outline'
              }`}>
                <Icono nombre={ins.obtenida ? 'military_tech' : 'lock'} className="text-[24px]" />
              </span>
              <span className="font-label-lg text-label-lg text-on-surface">{ins.nombre}</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">{ins.detalle}</span>
            </div>
          ))}
        </div>
      </article>

      <div className="p-space-lg rounded-3xl bg-secondary-container/40 flex items-start gap-space-md">
        <Icono nombre="lightbulb" className="text-[24px] text-on-secondary-container shrink-0 mt-0.5" />
        <p className="font-body-md text-body-md text-on-secondary-container">
          <strong>Por qué no hay ranking.</strong> Competir por “estar mejor” convierte el ánimo en
          algo que hay que fingir. Acá nadie compara tu semana con la de otro.
        </p>
      </div>
    </section>
  );
}

function Calendario({ dias }: { dias: DiaConstancia[] }) {
  // Arranca en lunes: sin este relleno, el primer día cae bajo la columna
  // equivocada y las cinco semanas quedan corridas una casilla.
  const primero = dias[0];
  const huecos = primero ? (new Date(primero.fecha).getDay() + 6) % 7 : 0;

  return (
    <div className="grid grid-cols-7 gap-space-2xs text-center">
      {DIAS_SEMANA.map((d, i) => (
        <span key={`${d}-${i}`} className="font-label-sm text-label-sm text-outline pb-space-2xs">{d}</span>
      ))}

      {Array.from({ length: huecos }, (_, i) => <span key={`hueco-${i}`} aria-hidden="true" />)}

      {dias.map((d, i) => {
        const fecha = new Date(d.fecha);
        const esHoy = i === dias.length - 1;
        return (
          <div
            key={d.fecha}
            className={`aspect-square rounded-xl flex items-center justify-center font-label-sm text-label-sm transition-transform hover:scale-105 ${
              TONO[d.nivel] ?? TONO[0]
            }${esHoy ? ' ring-2 ring-primary font-bold' : ''}`}
            title={`${fecha.toLocaleDateString('es-NI', { weekday: 'long', day: 'numeric', month: 'long' })} · ${
              d.nivel ? 'apareciste' : 'sin registro'
            }`}
          >
            {d.nivel ? <Icono nombre="check_small" className="text-[18px]" /> : fecha.getDate()}
          </div>
        );
      })}
    </div>
  );
}

export default Logros;
