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
 * =========================================================================== */

import { Lumy } from '../lumy/Lumy.tsx';
import { Cargador, Vacio } from '../componentes/comunes.tsx';
import { GraficoRadar } from '../componentes/graficos.tsx';
import { POR_CLIMA } from '../lumy/emociones.ts';
import { CLIMAS } from '../lib/formato.ts';
import { useDatos } from '../lib/useDatos.ts';
import * as api from '../lib/api.ts';

export function Comunitario() {
  const { datos, cargando, error } = useDatos(() => api.comunitario(), []);

  if (cargando) return <Cargador />;
  if (error || !datos) return <Vacio titulo="No pudimos abrir el gemelo del centro" detalle={error?.message} />;

  const clima = CLIMAS[datos.clima] ?? CLIMAS.parcial;

  return (
    <>
      {/* Vista: gemelo digital emocional comunitario */}
      <section className="lm-stack">

        <div className="lm-page-head">
          <div className="lm-page-head__text">
            <h1>Gemelo comunitario</h1>
            <p>El clima emocional del centro, agregado y anónimo. <strong>Nunca representa a una persona</strong>: si un grupo tiene menos de 10 registros, no se muestra.</p>
          </div>
          <span className="lm-anon-note"><i className="bi bi-incognito"></i> Umbral mínimo aplicado</span>
        </div>

        <article className="lm-card">
          <div className="lm-gemelo">
            <div className="lm-gemelo__stage">
              <Lumy emocion={POR_CLIMA[datos.clima]} className="lm-lumy lm-lumy--float" etiqueta="Avatar del clima comunitario" />
            </div>
            <div>
              <p className="lm-eyebrow">Clima del centro esta semana</p>
              <h2 className="mb-3">{datos.titular}</h2>
              <span className="lm-gemelo__estado mb-4"><i className="bi bi-cloud-sun" /> {clima.titulo}</span>
              <p className="lm-muted mb-0" style={{ fontSize: '.95rem' }}>
                Igual que con cada estudiante, la comparación es <strong>ipsativa</strong>: el centro se
                compara con su propio promedio de las semanas anteriores, nunca con otros colegios.
              </p>
            </div>
          </div>
        </article>

        <div className="row g-4">
          <div className="col-12 col-lg-6">
            <article className="lm-card h-100">
              <div className="lm-card__head">
                <div>
                  <h2>Radar del centro</h2>
                  <p className="lm-caption mb-0">Línea sólida: este mes. Punteada: el mes anterior del propio centro.</p>
                </div>
              </div>
              {/* El umbral no es una limitación técnica que haya que disimular:
                  por debajo de diez registros un promedio identifica a quienes
                  lo componen, así que el radar no se dibuja y se explica. */}
              {datos.suficiente ? (
                <GraficoRadar ejes={datos.radar.ejes} promedio={datos.radar.promedio} actual={datos.radar.actual} />
              ) : (
                <Vacio
                  titulo="Todavía no hay registros suficientes"
                  detalle={`Hacen falta al menos ${datos.minimo} check-ins en el mes para que un promedio no identifique a nadie. Van ${datos.registros}.`}
                />
              )}
            </article>
          </div>

          <div className="col-12 col-lg-6">
            <article className="lm-card h-100">
              <div className="lm-card__head">
                <div>
                  <h2>Por grupo</h2>
                  <p className="lm-caption mb-0">Sin nombres, sin casos individuales.</p>
                </div>
              </div>
              <div className="lm-stack-sm">
                {datos.grupos.map((g) => {
                  const oculto = g.clima === 'oculto';
                  return (
                    <div key={g.nombre} className={`lm-grupo${oculto ? ' lm-grupo--oculto' : ''}`}>
                      <span className="lm-grupo__dot" data-clima={oculto ? 'nublado' : g.clima} />
                      <div>
                        <p className="lm-grupo__name mb-0">{g.nombre}</p>
                        <p className="lm-grupo__meta mb-0">{g.nota}</p>
                      </div>
                      <div className="lm-grupo__side">
                        {oculto
                          ? <span className="lm-chip lm-chip--neutral">sin datos</span>
                          : <span className="lm-chip">{g.registros} registros</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          </div>
        </div>

        <div className="row g-4">
          <div className="col-12 col-lg-7">
            <article className="lm-card h-100">
              <div className="lm-card__head">
                <div>
                  <h2>Cobertura del acompañamiento</h2>
                  <p className="lm-caption mb-0">Qué proporción del centro está efectivamente cubierta.</p>
                </div>
              </div>
              <div className="lm-cobertura">
                <div className="lm-cobertura__item">
                  <p className="lm-cobertura__pct mb-0">78%</p>
                  <p className="lm-caption mb-0">registra casi todos los días</p>
                </div>
                <div className="lm-cobertura__item">
                  <p className="lm-cobertura__pct mb-0">91%</p>
                  <p className="lm-caption mb-0">tiene su red de confianza armada</p>
                </div>
                <div className="lm-cobertura__item">
                  <p className="lm-cobertura__pct mb-0">100%</p>
                  <p className="lm-caption mb-0">de casos con responsable nombrado</p>
                </div>
                <div className="lm-cobertura__item">
                  <p className="lm-cobertura__pct mb-0">4</p>
                  <p className="lm-caption mb-0">servicios de derivación verificados</p>
                </div>
              </div>
            </article>
          </div>

          <div className="col-12 col-lg-5">
            <article className="lm-card lm-card--cream h-100">
              <h2>Por qué esto no es vigilancia</h2>
              <p className="lm-muted mb-3" style={{ fontSize: '.94rem' }}>
                Si el adolescente siente que está siendo vigilado, deja de responder con honestidad
                y el sistema empieza a medir humo. Por eso el agregado comunitario es
                deliberadamente grueso: sirve para <strong>priorizar recursos</strong>, no para encontrar personas.
              </p>
              <ul className="lm-list">
                <li className="lm-list__item"><i className="bi bi-x-lg" style={{ color: 'var(--lm-terracotta)' }}></i>
                  <span style={{ fontSize: '.92rem' }}>No se puede llegar de un grupo a un estudiante.</span></li>
                <li className="lm-list__item"><i className="bi bi-x-lg" style={{ color: 'var(--lm-terracotta)' }}></i>
                  <span style={{ fontSize: '.92rem' }}>No se muestran grupos con pocos registros.</span></li>
                <li className="lm-list__item"><i className="bi bi-check-lg" style={{ color: 'var(--lm-teal)' }}></i>
                  <span style={{ fontSize: '.92rem' }}>Sí se ve dónde hace falta más tiempo de orientación.</span></li>
              </ul>
            </article>
          </div>
        </div>
      </section>
    </>
  );
}

export default Comunitario;
