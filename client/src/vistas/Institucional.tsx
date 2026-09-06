/* ==========================================================================
   Lumys* — Panel institucional

   Solo agregados: nunca un caso, nunca un nombre. Es el panel que decide dónde
   se ponen los recursos, y para eso no hace falta saber de quién se trata.
   ========================================================================== */

import { Barra, Cargador, Contador, Vacio } from '../componentes/comunes.tsx';
import { useDatos } from '../lib/useDatos.ts';
import * as api from '../lib/api.ts';

export function Institucional() {
  const { datos, cargando, error } = useDatos(
    () => Promise.all([api.institucional(), api.comunitario()]),
    [],
  );

  if (cargando) return <Cargador />;
  if (error || !datos) return <Vacio titulo="No pudimos abrir el panel" detalle={error?.message} />;

  const [panel, comunidad] = datos;

  return (
    <>
      {/* Vista: panel de bienestar institucional (agregado y anónimo) */}
      <section className="lm-stack">

        <div className="lm-page-head">
          <div className="lm-page-head__text">
            <h1>Panel de bienestar</h1>
            <p>Métricas agregadas del centro. <strong>Sin nombres, sin casos individuales.</strong> El colegio garantiza las condiciones; no opera el día a día.</p>
          </div>
          <span className="lm-anon-note"><i className="bi bi-incognito"></i> Datos anónimos y agregados</span>
        </div>

        <div className="lm-kpi-grid">
          {panel.kpis.map((k) => (
            <div className="lm-stat" key={k.etiqueta}>
              <span className="lm-stat__value"><Contador valor={k.valor} sufijo={k.sufijo ?? ''} /></span>
              <span className="lm-stat__label">{k.etiqueta}</span>
              {/* El indicador respeta `tipo`: antes todos salían en verde, así
                  que un dato malo se presentaba con la misma cara que uno bueno. */}
              <span className={`lm-stat__delta lm-stat__delta--${k.tipo === 'down' ? 'warm' : 'up'}`}>
                {k.delta}
              </span>
            </div>
          ))}
        </div>

        <div className="row g-4">
          <div className="col-12 col-lg-6">
            <article className="lm-card h-100">
              <div className="lm-card__head">
                <div>
                  <h2>Distribución por nivel de respuesta</h2>
                  <p className="lm-caption mb-0">Avisar mucho para conversar, poco para derivar.</p>
                </div>
              </div>
              <div>
                {panel.niveles.map((n, i) => (
                  <div className="lm-bar-row" key={n.etiqueta}>
                    <span className="lm-bar-row__label">{n.etiqueta}</span>
                    <span className="lm-bar-row__track">
                      <Barra
                        valor={n.valor}
                        max={n.max}
                        className={`lm-bar-row__fill${i === 2 ? ' lm-bar-row__fill--warm' : ''}`}
                        titulo={n.etiqueta}
                      />
                    </span>
                    <span className="lm-bar-row__value">{n.valor}</span>
                  </div>
                ))}
              </div>
              <p className="lm-caption mt-3 mb-0">
                Que la mayoría esté en Nivel 1 es la señal de que el sistema funciona bien:
                significa que se está conversando temprano.
              </p>
            </article>
          </div>

          <div className="col-12 col-lg-6">
            <article className="lm-card h-100">
              <div className="lm-card__head">
                <div>
                  <h2>Participación por grado</h2>
                  <p className="lm-caption mb-0">Porcentaje de estudiantes que registran casi todos los días.</p>
                </div>
              </div>
              {/* Sin grado ni sección en el esquema, este corte no se puede
                  calcular. Decirlo es más útil que cinco barras inventadas que
                  alguien podría llevarse a una reunión. */}
              {panel.grados.length ? (
                <div>
                  {panel.grados.map((g) => (
                    <div className="lm-bar-row" key={g.etiqueta}>
                      <span className="lm-bar-row__label">{g.etiqueta}</span>
                      <span className="lm-bar-row__track">
                        <Barra valor={g.participacion} className="lm-bar-row__fill" titulo={g.etiqueta} />
                      </span>
                      <span className="lm-bar-row__value">{g.participacion}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <Vacio
                  titulo="Todavía no se puede desglosar por grado"
                  detalle="Las cuentas de estudiante no guardan grado ni sección, así que este corte no existe. En cuanto el registro lo pida, aparece solo."
                />
              )}
            </article>
          </div>
        </div>

        <article className="lm-card">
          <div className="lm-card__head">
            <div>
              <h2>Cómo sabemos si Lumys<span className="lm-ast">*</span> funciona</h2>
              <p className="lm-caption mb-0">No se mide por cuántas alertas genera — eso solo indica que el sistema habla mucho.</p>
            </div>
          </div>

          {/* Estos tres salen de las alertas y del radar reales. Los otros seis
              que había acá —81% de confianza, 64% de adultos que cambiaron su
              forma de explicar, 8 horas protegidas— eran números escritos a
              mano: no hay encuesta ni instrumento que los mida, y presentados
              con la misma tipografía que los reales eran indistinguibles. */}
          <div className="lm-grid lm-grid--3">
            {panel.cierre.map((c) => (
              <div className="lm-stat" key={c.etiqueta}>
                <span className="lm-stat__value"><Contador valor={c.valor} /></span>
                <span className="lm-stat__label">{c.etiqueta}</span>
              </div>
            ))}
          </div>

          <div className="lm-note mt-4">
            <i className="bi bi-clipboard-data" aria-hidden="true"></i>
            <div>
              <strong>Lo que todavía no se mide.</strong>
              El tiempo de la señal a la conversación, la confirmación de las derivaciones a 7 y 30
              días y la percepción de confianza de los estudiantes son los indicadores que definen
              si esto sirve. Hoy ninguno está instrumentado, así que no se muestran: un número
              inventado en este panel es peor que un hueco, porque se usa para decidir.
            </div>
          </div>
        </article>

        <div className="row g-4">
          <div className="col-12 col-lg-7">
            <article className="lm-card h-100">
              <div className="lm-card__head">
                <div>
                  <h2>Aprendizaje federado por centro</h2>
                  <p className="lm-caption mb-0">Cada institución agrega localmente. Solo se sincronizan parámetros, nunca registros crudos.</p>
                </div>
              </div>
              <div className="lm-table-wrap">
                <table className="lm-table">
                  <thead><tr><th>Centro</th><th>Qué se comparte</th><th>Registros locales</th></tr></thead>
                  <tbody>
                  {comunidad.federado.map((f) => (
                    <tr key={f.centro}>
                      <td>{f.centro}</td>
                      <td><span className="lm-chip lm-chip--neutral">{f.icve}</span></td>
                      <td>{f.registros}</td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            </article>
          </div>

          <div className="col-12 col-lg-5">
            <article className="lm-card lm-card--emerald h-100">
              <h2>El rol del colegio</h2>
              <p style={{ color: 'rgba(var(--lm-cream-rgb),.82)', fontSize: '.95rem' }}>
                El colegio no opera Lumys<span className="lm-ast">*</span>: lo sostiene. Su responsabilidad formal es
                garantizar horas protegidas para el orientador y nombrar un responsable por caso.
              </p>
              <ul className="lm-list mt-3">
                <li className="lm-list__item" style={{ borderColor: 'rgba(var(--lm-cream-rgb),.16)' }}>
                  <i className="bi bi-clock-history" style={{ color: 'var(--lm-celeste)' }}></i>
                  <span style={{ fontSize: '.92rem', color: 'rgba(var(--lm-cream-rgb),.82)' }}>Horas protegidas del orientador</span>
                </li>
                <li className="lm-list__item" style={{ borderColor: 'rgba(var(--lm-cream-rgb),.16)' }}>
                  <i className="bi bi-person-badge" style={{ color: 'var(--lm-celeste)' }}></i>
                  <span style={{ fontSize: '.92rem', color: 'rgba(var(--lm-cream-rgb),.82)' }}>Un responsable nombrado por caso</span>
                </li>
                <li className="lm-list__item" style={{ borderColor: 'rgba(var(--lm-cream-rgb),.16)' }}>
                  <i className="bi bi-megaphone" style={{ color: 'var(--lm-celeste)' }}></i>
                  <span style={{ fontSize: '.92rem', color: 'rgba(var(--lm-cream-rgb),.82)' }}>Canal de adopción: charla de bienvenida y aval institucional</span>
                </li>
                <li className="lm-list__item" style={{ borderColor: 'rgba(var(--lm-cream-rgb),.16)' }}>
                  <i className="bi bi-x-circle" style={{ color: 'var(--lm-terracotta)' }}></i>
                  <span style={{ fontSize: '.92rem', color: 'rgba(var(--lm-cream-rgb),.82)' }}>Nunca: acceso a casos individuales ni a nombres</span>
                </li>
              </ul>
            </article>
          </div>
        </div>
      </section>
    </>
  );
}

export default Institucional;
