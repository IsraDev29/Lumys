/* ===========================================================================
 * Lumys* — gemelo digital comunitario
 * ---------------------------------------------------------------------------
 * Nunca una persona: siempre un grupo. Un grupo con menos de diez registros se
 * muestra como 'oculto' porque por debajo de ese umbral el agregado deja de ser
 * anónimo y se vuelve deducible.
 *
 * La mascota del centro también respeta la banda de seguridad: el clima elige
 * su emoción por `POR_CLIMA`, que solo devuelve emociones de apoyo. Un colegio
 * con la semana pesada necesita ver acompañamiento en la pantalla, no un
 * espejo de su propio bajón.
 *
 * ── Sobre el marcado ───────────────────────────────────────────────────────
 * Es `orientadora_clima_del_centro_escolar_por_aula`, el "termómetro emocional
 * colectivo". Tres apartes del mockup:
 *
 *   1. Su matriz es por aula ("3-A Sobrecarga Parciales", "5-A Vocacional").
 *      El esquema no guarda grado ni sección —lo dice `federado.service.js`—,
 *      así que el corte más fino que existe hoy es por institución. Se pinta
 *      esa agrupación con la forma del mockup en vez de inventar aulas.
 *   2. Cada aula suya trae un diagnóstico de causa ("sobrecarga de parciales",
 *      "ansiedad vocacional"). El agregado no sabe la causa y afirmarla sería
 *      justo el salto que este panel no puede dar.
 *   3. Su barra de cobertura eran cuatro porcentajes escritos a mano, igual que
 *      los que había acá —78%, 91%, 100%, 4—. Ninguno se mide.
 * =========================================================================== */

import { Lumy } from '../lumy/Lumy.tsx';
import { Cargador, Contador, Vacio } from '../componentes/comunes.tsx';
import { GraficoRadar } from '../componentes/graficos.tsx';
import { POR_CLIMA } from '../lumy/emociones.ts';
import { CLIMAS } from '../lib/formato.ts';
import { useDatos } from '../lib/useDatos.ts';
import * as api from '../lib/api.ts';
import type { ClimaGrupo } from '../lib/tipos.ts';

/** Semáforo ético: el punto de color de cada grupo. `oculto` no es un clima
 *  malo, es la negativa deliberada a promediar un grupo demasiado chico. */
const PUNTO: Record<ClimaGrupo, string> = {
  despejado: 'bg-tertiary-fixed-dim',
  parcial: 'bg-secondary-fixed-dim',
  nublado: 'bg-primary-container',
  lluvia: 'bg-primary',
  oculto: 'bg-outline-variant',
};

function Icono({ nombre, className = '' }: { nombre: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`} aria-hidden="true">{nombre}</span>;
}

export function Comunitario() {
  const { datos, cargando, error } = useDatos(() => api.comunitario(), []);

  if (cargando) return <Cargador />;
  if (error || !datos) return <Vacio titulo="No pudimos abrir el gemelo del centro" detalle={error?.message} />;

  const clima = CLIMAS[datos.clima] ?? CLIMAS.parcial;
  const conDatos = datos.grupos.filter((g) => g.clima !== 'oculto');
  const ocultos = datos.grupos.length - conDatos.length;
  const registrosFederados = datos.federado.reduce((s, f) => s + f.registros, 0);

  return (
    <section className="w-full pt-space-lg max-w-[1200px] mx-auto px-margin-mobile md:px-margin-desktop flex flex-col gap-space-lg">

      {/* ================= Encabezado ================= */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
        <div className="space-y-space-2xs max-w-[62ch]">
          <h1 className="font-headline-xl-mobile text-headline-xl-mobile md:font-headline-xl md:text-headline-xl text-on-surface">
            Termómetro del centro
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            El clima emocional agregado y anónimo.{' '}
            <strong className="text-on-surface">Nunca representa a una persona</strong>: si un grupo
            tiene menos de {datos.minimo} registros, no se muestra.
          </p>
        </div>
        <span className="inline-flex items-center gap-space-2xs px-space-md py-space-xs rounded-full bg-secondary-container text-on-secondary-container font-label-md text-label-md font-semibold shrink-0">
          <Icono nombre="visibility_off" className="text-[18px]" /> Umbral mínimo aplicado
        </span>
      </header>

      {/* ================= Clima del centro ================= */}
      <article className="bg-surface-container-lowest rounded-3xl p-space-lg md:p-space-xl shadow-[0_8px_24px_-4px_rgba(189,164,243,0.1)] flex flex-col md:flex-row items-center gap-space-lg">
        <div className="shrink-0">
          <Lumy emocion={POR_CLIMA[datos.clima]} ancho={160} etiqueta="Avatar del clima comunitario" />
        </div>
        <div className="flex-1 space-y-space-xs text-center md:text-left">
          <p className="font-label-md text-label-md uppercase tracking-wider text-primary font-semibold">
            Clima del centro este mes
          </p>
          <h2 className="font-headline-lg text-headline-lg text-on-surface">{datos.titular}</h2>
          <span className="inline-flex items-center gap-space-2xs px-space-md py-space-xs rounded-full bg-primary-fixed text-on-primary-fixed font-label-md text-label-md font-semibold">
            <Icono nombre="partly_cloudy_day" className="text-[18px]" /> {clima.titulo}
          </span>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Igual que con cada estudiante, la comparación es{' '}
            <strong className="text-on-surface">ipsativa</strong>: el centro se compara con su
            propio mes anterior, nunca con otros colegios.
          </p>
        </div>
      </article>

      {/* ================= Resumen ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md">
        <div className="p-space-lg rounded-2xl bg-surface-container-lowest shadow-[0_8px_24px_-4px_rgba(189,164,243,0.1)] flex flex-col gap-space-2xs">
          <span className="font-headline-lg text-headline-lg text-on-surface">
            <Contador valor={datos.registros} />
          </span>
          <span className="font-label-md text-label-md text-on-surface-variant">
            check-ins del último mes
          </span>
          <span className="font-body-sm text-body-sm text-outline">en todo el centro</span>
        </div>

        <div className="p-space-lg rounded-2xl bg-surface-container-lowest shadow-[0_8px_24px_-4px_rgba(189,164,243,0.1)] flex flex-col gap-space-2xs">
          <span className="font-headline-lg text-headline-lg text-on-surface">
            {conDatos.length}<span className="text-on-surface-variant">/{datos.grupos.length}</span>
          </span>
          <span className="font-label-md text-label-md text-on-surface-variant">
            grupos con datos suficientes
          </span>
          <span className="font-body-sm text-body-sm text-outline">
            {ocultos ? `${ocultos} por debajo del umbral` : 'todos pasan el umbral'}
          </span>
        </div>

        <div className="p-space-lg rounded-2xl bg-surface-container-lowest shadow-[0_8px_24px_-4px_rgba(189,164,243,0.1)] flex flex-col gap-space-2xs">
          <span className="font-headline-lg text-headline-lg text-on-surface">
            <Contador valor={registrosFederados} />
          </span>
          <span className="font-label-md text-label-md text-on-surface-variant">
            registros en la red federada
          </span>
          <span className="font-body-sm text-body-sm text-outline">
            {datos.federado.length} centros aportando
          </span>
        </div>
      </div>

      {/* ================= Radar + grupos ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">

        <article className="lg:col-span-6 bg-surface-container-lowest rounded-3xl p-space-lg md:p-space-xl shadow-[0_8px_24px_-4px_rgba(189,164,243,0.1)] flex flex-col gap-space-md">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface">Radar del centro</h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Línea sólida: este mes. Punteada: el mes anterior del propio centro.
            </p>
          </div>

          {/* El umbral no es una limitación técnica que haya que disimular: por
              debajo de diez registros un promedio identifica a quienes lo
              componen, así que el radar no se dibuja y se explica. */}
          {datos.suficiente ? (
            <GraficoRadar ejes={datos.radar.ejes} promedio={datos.radar.promedio} actual={datos.radar.actual} />
          ) : (
            <Vacio
              titulo="Todavía no hay registros suficientes"
              detalle={`Hacen falta al menos ${datos.minimo} check-ins en el mes para que un promedio no identifique a nadie. Van ${datos.registros}.`}
            />
          )}
        </article>

        <article className="lg:col-span-6 bg-surface-container-lowest rounded-3xl p-space-lg md:p-space-xl shadow-[0_8px_24px_-4px_rgba(189,164,243,0.1)] flex flex-col gap-space-md">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface">Por grupo</h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Sin nombres, sin casos individuales. Y sin causa: el agregado dice cómo viene un
              grupo, nunca por qué.
            </p>
          </div>

          <ul className="flex flex-col gap-space-sm">
            {datos.grupos.map((g) => {
              const oculto = g.clima === 'oculto';
              return (
                <li
                  key={g.nombre}
                  className={`flex items-center gap-space-sm p-space-md rounded-2xl ${
                    oculto ? 'bg-surface-container-low opacity-70' : 'bg-surface-container-low'
                  }`}
                >
                  <span
                    className={`w-3 h-3 rounded-full shrink-0 ${PUNTO[g.clima] ?? PUNTO.parcial}`}
                    aria-hidden="true"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-label-lg text-label-lg text-on-surface truncate">{g.nombre}</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant truncate">{g.nota}</p>
                  </div>
                  <span className={`px-space-sm py-space-2xs rounded-full font-label-sm text-label-sm shrink-0 ${
                    oculto
                      ? 'bg-surface-container text-on-surface-variant'
                      : 'bg-primary-fixed text-on-primary-fixed'
                  }`}>
                    {oculto ? 'sin datos' : `${g.registros} registros`}
                  </span>
                </li>
              );
            })}
          </ul>
        </article>
      </div>

      {/* ================= Federado ================= */}
      <article className="bg-surface-container-lowest rounded-3xl p-space-lg md:p-space-xl shadow-[0_8px_24px_-4px_rgba(189,164,243,0.1)] flex flex-col gap-space-md">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface">Aprendizaje federado</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Cada centro agrega localmente. Hacia afuera solo salen parámetros, nunca registros.
          </p>
        </div>

        <ul className="flex flex-col gap-space-2xs">
          {datos.federado.map((f) => (
            <li
              key={f.centro}
              className="flex flex-wrap items-center justify-between gap-space-xs p-space-md rounded-2xl bg-surface-container-low"
            >
              <span className="font-label-lg text-label-lg text-on-surface">{f.centro}</span>
              <span className="flex items-center gap-space-sm">
                <span className="px-space-sm py-space-2xs rounded-full bg-surface-container font-label-sm text-label-sm text-on-surface-variant">
                  {f.icve}
                </span>
                <span className="font-body-sm text-body-sm text-outline">{f.registros} registros</span>
              </span>
            </li>
          ))}
        </ul>
      </article>

      {/* ================= Por qué no es vigilancia ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
        <article className="lg:col-span-7 p-space-lg md:p-space-xl rounded-3xl bg-on-background flex flex-col gap-space-md">
          <h2 className="font-headline-md text-headline-md text-inverse-on-surface">
            Por qué esto no es vigilancia
          </h2>
          <p className="font-body-md text-body-md text-inverse-on-surface/75">
            Si el adolescente siente que está siendo vigilado, deja de responder con honestidad y el
            sistema empieza a medir humo. Por eso el agregado comunitario es deliberadamente grueso:
            sirve para <strong className="text-inverse-on-surface">priorizar recursos</strong>, no
            para encontrar personas.
          </p>

          <ul className="flex flex-col gap-space-2xs">
            {[
              { si: false, texto: 'No se puede llegar de un grupo a un estudiante.' },
              { si: false, texto: `No se muestran grupos con menos de ${datos.minimo} registros.` },
              { si: false, texto: 'No se afirma la causa de lo que se observa.' },
              { si: true, texto: 'Sí se ve dónde hace falta más tiempo de orientación.' },
            ].map((r) => (
              <li key={r.texto} className="flex items-start gap-space-xs p-space-sm rounded-xl bg-inverse-on-surface/10">
                <Icono
                  nombre={r.si ? 'check' : 'close'}
                  className={`text-[18px] shrink-0 mt-0.5 ${r.si ? 'text-secondary-fixed-dim' : 'text-error-container'}`}
                />
                <span className="font-body-sm text-body-sm text-inverse-on-surface/85">{r.texto}</span>
              </li>
            ))}
          </ul>
        </article>

        {/* La cobertura del mockup eran cuatro porcentajes inventados. Los que
            se pueden calcular ya están arriba; el resto se nombra sin cifra. */}
        <article className="lg:col-span-5 p-space-lg md:p-space-xl rounded-3xl bg-surface-container-low flex flex-col gap-space-sm">
          <div className="flex items-center gap-space-xs">
            <Icono nombre="pending_actions" className="text-[22px] text-on-surface-variant" />
            <h2 className="font-headline-sm text-headline-sm text-on-surface">
              Cobertura, todavía sin instrumentar
            </h2>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Qué proporción del centro registra casi todos los días, cuántos tienen su red de
            confianza armada y cuántos servicios de derivación están verificados son las tres
            cifras que dirían si el acompañamiento llega. Ninguna se mide hoy.
          </p>
          <p className="font-body-sm text-body-sm text-outline">
            Se nombran igual porque decidir sin ellas es decidir a ciegas — pero un porcentaje
            inventado acá termina en un informe de dirección.
          </p>
        </article>
      </div>
    </section>
  );
}

export default Comunitario;
