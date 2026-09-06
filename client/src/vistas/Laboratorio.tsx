/* ===========================================================================
 * Lumys* — banco de emociones
 * ---------------------------------------------------------------------------
 * Los 33 estados del rig sobre la misma geometría. Antes era una página HTML
 * suelta con su propio <script>; ahora es una ruta más, visible solo para el
 * perfil admin.
 *
 * La primera sección es la que importa: el archivo original al lado del rig en
 * pose `neutral` con el bucle de reposo apagado. Tienen que ser
 * indistinguibles. Si difieren, el rig alteró la geometría en vez de deformarla
 * — que es exactamente lo que el encargo prohíbe.
 *
 * ── Por qué esta pantalla y no la del mockup ────────────────────────────────
 * El export que le tocaba a esta ruta es `equipo_lumys_auditor_a_de_bio_tica_
 * de_ia_mitigaci_n_de_sesgos`: un tablero con "adherencia a tono empático",
 * "lenguaje patologizante", "falsos positivos de alarma" y "equidad de género
 * y neurodiversidad", cada uno con su porcentaje y su barra.
 *
 * No se portó. Ninguna de esas cuatro métricas está instrumentada: no hay
 * muestreo ciego, ni etiquetado de respuestas del modelo, ni cohortes con las
 * que medir equidad. Portarlo sería construir un tablero de auditoría ética
 * entero con números inventados, y un tablero de sesgos que miente es peor que
 * no tener tablero — le da a un comité la sensación de estar vigilando algo.
 * Lo que sí existe y sí se puede auditar a ojo es esto: las 33 poses del rig y
 * la prueba de que ninguna deforma la mascota fuera de lo permitido. Se
 * conserva y se le pone el sistema visual de Stitch.
 * =========================================================================== */

import { useRef, useState } from 'react';

import { Lumy, type ManejadorLumy } from '../lumy/Lumy.tsx';
import {
  CLAVES, EMOCIONES, FAMILIAS, VERSION,
  type ClaveEmocion, type ClaveFamilia,
} from '../lumy/emociones.ts';

const ORDEN: ClaveFamilia[] = [
  'base', 'alegria', 'confianza', 'miedo', 'sorpresa',
  'tristeza', 'aversion', 'enojo', 'anticipacion', 'social',
];

function Icono({ nombre, className = '' }: { nombre: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`} aria-hidden="true">{nombre}</span>;
}

export function Laboratorio() {
  const [seleccion, setSeleccion] = useState<ClaveEmocion>('alegria');
  const [reposo, setReposo] = useState(true);
  const heroe = useRef<ManejadorLumy>(null);

  const def = EMOCIONES[seleccion];
  const desvios = Object.entries(def.pose);

  return (
    <section className="w-full pt-space-lg max-w-[1200px] mx-auto px-margin-mobile md:px-margin-desktop flex flex-col gap-space-lg">

      {/* ================= Encabezado ================= */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
        <div className="space-y-space-2xs max-w-[60ch]">
          <h1 className="font-headline-xl-mobile text-headline-xl-mobile md:font-headline-xl md:text-headline-xl text-on-surface">
            Banco de emociones
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            33 estados sobre la misma geometría. Ninguna pose reemplaza un trazo del SVG
            original: todas lo deforman. Tocá cualquier celda para verla en grande.
          </p>
        </div>
        <span className="inline-flex items-center gap-space-2xs px-space-md py-space-xs rounded-full bg-primary-fixed text-on-primary-fixed font-label-md text-label-md font-semibold shrink-0">
          <Icono nombre="palette" className="text-[18px]" /> {CLAVES.length} estados · rig v{VERSION}
        </span>
      </header>

      {/* ================= Prueba de fidelidad ================= */}
      <article className="bg-surface-container-lowest rounded-3xl p-space-lg md:p-space-xl shadow-[0_8px_24px_-4px_rgba(189,164,243,0.1)] flex flex-col gap-space-md">
        <div>
          <p className="font-label-md text-label-md uppercase tracking-wider text-primary font-semibold">
            Prueba de fidelidad
          </p>
          <h2 className="font-headline-md text-headline-md text-on-surface">
            El rig deforma, no redibuja
          </h2>
        </div>

        <div className="flex flex-wrap items-end gap-space-lg">
          {/* La referencia era `lumys-mascota.svg`. Ese archivo se borró del
              repositorio en el commit 5dcf21a, que cambió la mascota a PNG, y
              con él se cayó `test/lumy.test.js` — la prueba que comparaba el
              rig contra el original trazo por trazo. Se apunta al PNG para no
              dejar una imagen rota, pero la comparación ya no es exacta: un
              mapa de bits no sirve para detectar que un path se corrió dos
              píxeles, que es justo lo que esa prueba vigilaba. */}
          <figure className="m-0 text-center w-[150px]">
            <img src="/img/lumys-mascota-oficial.png" alt="" className="w-[150px] block" />
            <figcaption className="mt-space-xs font-body-sm text-body-sm text-on-surface-variant">
              <code className="font-mono">lumys-mascota-oficial.png</code><br />archivo en el repo
            </figcaption>
          </figure>

          <figure className="m-0 text-center w-[150px]">
            <Lumy emocion="neutral" reposo={false} ancho={150} etiqueta={null} />
            <figcaption className="mt-space-xs font-body-sm text-body-sm text-on-surface-variant">
              rig en <code className="font-mono">neutral</code><br />sin ritmo
            </figcaption>
          </figure>

          <p className="flex-1 min-w-[240px] font-body-md text-body-md text-on-surface-variant">
            A la izquierda el archivo del repositorio; a la derecha el rig con la pose
            <code className="font-mono"> neutral </code> y el bucle de reposo apagado. Deberían ser
            indistinguibles.{' '}
            <strong className="text-on-surface">
              La comparación automática está caída
            </strong>{' '}
            desde que se reemplazó el SVG por un PNG: contra un mapa de bits no se puede verificar
            que ningún trazo se haya movido.
          </p>
        </div>
      </article>

      {/* ================= Escenario ================= */}
      <article className="bg-primary-fixed/40 rounded-3xl p-space-lg md:p-space-xl flex flex-wrap items-center gap-space-lg">
        <div className="w-[220px] shrink-0 mx-auto sm:mx-0">
          {/* `espejo` va puesto porque el laboratorio es justamente donde se
              miran todas, incluidas las que Lumy nunca adopta sola. */}
          <Lumy ref={heroe} emocion={seleccion} espejo reposo={reposo} etiqueta={null} />
        </div>

        <div className="flex-1 min-w-[260px] space-y-space-xs">
          <p className="font-label-md text-label-md uppercase tracking-wider text-primary font-semibold">
            {FAMILIAS[def.familia].nombre}
            {' · '}
            {def.intensidad ? `intensidad ${def.intensidad}` : 'sin escala'}
            {' · banda '}
            {def.banda}
          </p>
          <h2 className="font-headline-lg text-headline-lg text-on-surface">{def.nombre}</h2>
          <p className="font-body-md text-body-md text-on-surface">{def.pista}</p>

          <div>
            <p className="font-label-sm text-label-sm text-on-surface-variant mb-space-2xs">
              Canales que se apartan del reposo
            </p>
            <p className="font-mono text-body-sm text-on-surface-variant p-space-sm rounded-xl bg-surface-container-lowest/70 break-words">
              {desvios.length
                ? desvios.map(([k, v]) => `${k}: ${typeof v === 'number' ? v : `'${v}'`}`).join('  ·  ')
                : 'reposo puro, sin desvíos'}
            </p>
          </div>

          <div className="flex flex-wrap gap-space-xs">
            <button
              className={`px-space-md py-space-xs rounded-full font-label-md text-label-md font-semibold transition-all ${
                reposo
                  ? 'bg-primary text-on-primary hover:bg-on-primary-container'
                  : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container'
              }`}
              type="button"
              aria-pressed={reposo}
              onClick={() => setReposo((v) => !v)}
            >
              Ritmo de reposo
            </button>
            <button
              className="px-space-md py-space-xs rounded-full bg-surface-container-lowest text-on-surface font-label-md text-label-md font-semibold hover:bg-surface-container transition-all"
              type="button"
              onClick={() => heroe.current?.parpadear()}
            >
              Parpadear
            </button>
          </div>
        </div>
      </article>

      {/* ================= Leyenda de bandas ================= */}
      <div className="flex flex-wrap gap-space-md p-space-md rounded-2xl bg-surface-container-low font-body-sm text-body-sm text-on-surface-variant">
        <span className="flex items-center gap-space-2xs">
          <span className="w-2.5 h-2.5 rounded-full bg-secondary-fixed-dim" aria-hidden="true" />
          <strong className="text-on-surface">apoyo</strong> — Lumy la adopta sola
        </span>
        <span className="flex items-center gap-space-2xs">
          <span className="w-2.5 h-2.5 rounded-full bg-tertiary-fixed-dim" aria-hidden="true" />
          <strong className="text-on-surface">espejo</strong> — solo cuando el estudiante nombra lo suyo
        </span>
      </div>

      {/* ================= Rejilla por familia ================= */}
      {ORDEN.map((fam) => {
        const claves = CLAVES.filter((c) => EMOCIONES[c].familia === fam);
        if (!claves.length) return null;
        const opuesta = FAMILIAS[fam].opuesta;

        return (
          <article
            className="bg-surface-container-lowest rounded-3xl p-space-lg md:p-space-xl shadow-[0_8px_24px_-4px_rgba(189,164,243,0.1)] flex flex-col gap-space-md"
            key={fam}
          >
            <div>
              <h2 className="font-headline-md text-headline-md text-on-surface">
                {FAMILIAS[fam].nombre}
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant">
                {claves.length} estado{claves.length > 1 ? 's' : ''}
                {opuesta ? ` · opuesta: ${FAMILIAS[opuesta].nombre}` : ''}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-space-sm">
              {claves.map((clave) => {
                const e = EMOCIONES[clave];
                const elegida = clave === seleccion;
                return (
                  <button
                    key={clave}
                    type="button"
                    aria-pressed={elegida}
                    onClick={() => setSeleccion(clave)}
                    className={`relative overflow-hidden p-space-sm rounded-2xl flex flex-col items-center gap-space-2xs transition-all hover:-translate-y-0.5 ${
                      elegida
                        ? 'bg-primary-container ring-2 ring-primary'
                        : 'bg-surface-container-low hover:bg-surface-container-high'
                    }`}
                  >
                    <span
                      className={`absolute top-0 left-0 right-0 h-1 ${
                        e.banda === 'apoyo' ? 'bg-secondary-fixed-dim' : 'bg-tertiary-fixed-dim'
                      }`}
                      title={`banda ${e.banda}`}
                      aria-hidden="true"
                    />
                    {/* duración 0: la celda nace ya en su pose, sin transición
                        desde neutral. */}
                    <Lumy emocion={clave} espejo duracion={0} ancho={88} etiqueta={null} />
                    <span className={`font-label-md text-label-md text-center ${
                      elegida ? 'text-on-primary-container' : 'text-on-surface'
                    }`}>
                      {e.nombre}
                    </span>
                    <span className={`font-label-sm text-label-sm text-center ${
                      elegida ? 'text-on-primary-container/75' : 'text-outline'
                    }`}>
                      {clave}{e.intensidad ? ` · ${e.intensidad}` : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          </article>
        );
      })}

      {/* ================= Por qué falta la auditoría de sesgos ================= */}
      <div className="p-space-lg md:p-space-xl rounded-3xl bg-surface-container-low flex items-start gap-space-sm">
        <Icono nombre="balance" className="text-[24px] text-on-surface-variant shrink-0 mt-0.5" />
        <div>
          <p className="font-label-lg text-label-lg text-on-surface mb-space-2xs">
            La auditoría de sesgos todavía no existe
          </p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            El diseño previsto para esta sección medía adherencia al tono empático, lenguaje
            patologizante, falsos positivos de alarma y equidad de género y neurodiversidad. Hace
            falta muestreo ciego, etiquetado de las respuestas del modelo y cohortes con las que
            comparar — nada de eso está montado. Un tablero de sesgos con números inventados es
            peor que ninguno: le daría a un comité la sensación de estar vigilando algo.
          </p>
        </div>
      </div>
    </section>
  );
}

export default Laboratorio;
