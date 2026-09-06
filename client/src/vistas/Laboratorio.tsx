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

export function Laboratorio() {
  const [seleccion, setSeleccion] = useState<ClaveEmocion>('alegria');
  const [reposo, setReposo] = useState(true);
  const heroe = useRef<ManejadorLumy>(null);

  const def = EMOCIONES[seleccion];
  const desvios = Object.entries(def.pose);

  return (
    <section className="lm-stack lumy-lab">

      <div className="lm-page-head">
        <div className="lm-page-head__text">
          <h1>Banco de emociones</h1>
          <p>
            33 estados sobre la misma geometría. Ninguna pose reemplaza un trazo del
            SVG original: todas lo deforman. Tocá cualquier celda para verla en grande.
          </p>
        </div>
        <span className="lm-chip">{CLAVES.length} estados · rig v{VERSION}</span>
      </div>

      {/* ---------- Prueba de fidelidad ---------- */}
      <article className="lm-card">
        <p className="lm-eyebrow">Prueba de fidelidad</p>
        <div className="d-flex flex-wrap align-items-end gap-4">
          <figure className="m-0 text-center" style={{ width: '150px' }}>
            <img src="/img/lumys-mascota.svg" alt="" style={{ width: '150px', display: 'block' }} />
            <figcaption className="lm-caption mt-2">
              lumys-mascota.svg<br />(archivo original)
            </figcaption>
          </figure>

          <figure className="m-0 text-center" style={{ width: '150px' }}>
            <Lumy emocion="neutral" reposo={false} ancho={150} etiqueta={null} />
            <figcaption className="lm-caption mt-2">
              rig en <code>neutral</code><br />(sin ritmo)
            </figcaption>
          </figure>

          <p className="lm-muted mb-0" style={{ flex: '1 1 260px', minWidth: '240px', fontSize: '.9rem' }}>
            A la izquierda el archivo que ya está en producción; a la derecha el rig con
            la pose <code>neutral</code> y el bucle de reposo apagado. Tienen que ser
            indistinguibles: mismos paths, mismos radios, mismo gradiente.
          </p>
        </div>
      </article>

      {/* ---------- Escenario ---------- */}
      <article className="lm-card lm-card--cream">
        <div className="d-flex flex-wrap align-items-center gap-4">
          <div style={{ width: '240px' }}>
            {/* `espejo` va puesto porque el laboratorio es justamente donde se
                miran todas, incluidas las que Lumy nunca adopta sola. */}
            <Lumy ref={heroe} emocion={seleccion} espejo reposo={reposo} etiqueta={null} />
          </div>
          <div className="flex-grow-1" style={{ minWidth: '260px' }}>
            <p className="lm-eyebrow mb-1">
              {FAMILIAS[def.familia].nombre}
              {' · '}
              {def.intensidad ? `intensidad ${def.intensidad}` : 'sin escala'}
              {' · banda '}
              {def.banda}
            </p>
            <h2 className="mb-2">{def.nombre}</h2>
            <p className="mb-3">{def.pista}</p>

            <p className="lm-caption mb-2">Canales que se apartan del reposo</p>
            <p className="lm-caption mb-3" style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>
              {desvios.length
                ? desvios.map(([k, v]) => `${k}: ${typeof v === 'number' ? v : `'${v}'`}`).join('  ·  ')
                : 'reposo puro, sin desvíos'}
            </p>

            <div className="d-flex flex-wrap gap-2">
              <button
                className={`lm-btn lm-btn--sm${reposo ? '' : ' lm-btn--ghost'}`}
                type="button"
                aria-pressed={reposo}
                onClick={() => setReposo((v) => !v)}
              >
                Ritmo de reposo
              </button>
              <button
                className="lm-btn lm-btn--ghost lm-btn--sm"
                type="button"
                onClick={() => heroe.current?.parpadear()}
              >
                Parpadear
              </button>
            </div>
          </div>
        </div>
      </article>

      <div className="d-flex flex-wrap gap-4 lm-caption">
        <span>
          <i className="d-inline-block rounded-circle me-1" style={{ width: 8, height: 8, background: 'var(--lm-clima-despejado)' }} />
          <strong>apoyo</strong> — Lumy la adopta sola
        </span>
        <span>
          <i className="d-inline-block rounded-circle me-1" style={{ width: 8, height: 8, background: 'var(--lm-terracotta)' }} />
          <strong>espejo</strong> — solo cuando el estudiante nombra lo suyo
        </span>
      </div>

      {/* ---------- Rejilla por familia ---------- */}
      {ORDEN.map((fam) => {
        const claves = CLAVES.filter((c) => EMOCIONES[c].familia === fam);
        if (!claves.length) return null;
        const opuesta = FAMILIAS[fam].opuesta;

        return (
          <article className="lm-card" key={fam}>
            <div className="lm-card__head">
              <div>
                <h2>{FAMILIAS[fam].nombre}</h2>
                <p className="lm-caption mb-0">
                  {claves.length} estado{claves.length > 1 ? 's' : ''}
                  {opuesta ? ` · opuesta: ${FAMILIAS[opuesta].nombre}` : ''}
                </p>
              </div>
            </div>

            <div className="lumy-lab__rejilla">
              {claves.map((clave) => {
                const e = EMOCIONES[clave];
                return (
                  <button
                    key={clave}
                    type="button"
                    className="lumy-lab__celda"
                    aria-pressed={clave === seleccion}
                    onClick={() => setSeleccion(clave)}
                  >
                    <span
                      className="lumy-lab__banda"
                      title={`banda ${e.banda}`}
                      style={{
                        background: e.banda === 'apoyo'
                          ? 'var(--lm-clima-despejado)'
                          : 'var(--lm-terracotta)',
                      }}
                    />
                    {/* duración 0: la celda nace ya en su pose, sin transición
                        desde neutral. */}
                    <Lumy emocion={clave} espejo duracion={0} ancho={96} etiqueta={null} />
                    <span className="lumy-lab__nombre">{e.nombre}</span>
                    <span className="lm-caption">
                      {clave}{e.intensidad ? ` · ${e.intensidad}` : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          </article>
        );
      })}
    </section>
  );
}

export default Laboratorio;
