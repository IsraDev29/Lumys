/* ===========================================================================
 * Lumys* — mini manual de marca
 * =========================================================================== */

import { A } from '../componentes/A.tsx';
import { Isotipo, Logotipo } from '../componentes/Identidad.tsx';

export function Marca() {
  return (
    <>
      {/* Vista pública: mini manual de marca aplicado (versión viva del Figma) */}
      <div className="lm-public">

        <nav className="lm-public__nav">
          <A href="#/bienvenida" aria-label="Lumys, inicio">
            <Logotipo tamano={30} conIsotipo conBajada />
          </A>
          <div className="lm-public__nav-links">
            <A href="#paleta" className="d-none-sm">Paleta</A>
            <A href="#tipografia" className="d-none-sm">Tipografía</A>
            <A href="#interfaz" className="d-none-sm">Interfaz</A>
            <A className="lm-btn lm-btn--sm" href="#/acceso">Entrar</A>
          </div>
        </nav>

        <header className="lm-hero" style={{ paddingBottom: '0' }}>
          <div className="lm-hero__inner" style={{ gridTemplateColumns: 'minmax(0,1fr)' }}>
            <div>
              <p className="lm-eyebrow">Mini manual de marca · v2.0 · 2026</p>
              <h1 style={{ maxWidth: '22ch' }}>La identidad, aplicada a la interfaz real.</h1>
              <p className="lm-hero__claim">
                Esta página no describe la marca: <strong>la ejecuta</strong>. Todo lo que ves acá son
                los mismos componentes y tokens que usa la aplicación.
              </p>
              <div className="lm-hero__pills">
                <span className="lm-chip">Ecosistema · web y app de bienestar</span>
                <span className="lm-chip">Audiencia · 12 a 18 años</span>
                <span className="lm-chip lm-chip--warm">Nicaragua · Fase 2, un colegio</span>
              </div>
            </div>
          </div>
        </header>

        {/* ================= Paleta ================= */}
        <section className="lm-section" id="paleta">
          <div className="lm-section__inner">
            <div className="lm-section__head">
              <h2>Paleta de color</h2>
              <p className="lm-muted">La paleta se organiza por función, no por estética. Cada color tiene un rol fijo dentro de la interfaz.</p>
            </div>

            <div className="lm-grid lm-grid--4">
              <article className="lm-card lm-card--pad-sm">
                <div style={{ height: '110px', borderRadius: 'var(--lm-radius)', background: 'var(--lm-lavanda)' }}></div>
                <h3 className="mt-3 mb-1">Lavanda</h3>
                <p className="lm-caption mb-2">Primario · #CDB2FF</p>
                <p className="lm-muted mb-0" style={{ fontSize: '.88rem' }}>Introspección, acción principal, la píldora activa de la navegación.</p>
              </article>
              <article className="lm-card lm-card--pad-sm">
                <div style={{ height: '110px', borderRadius: 'var(--lm-radius)', background: 'var(--lm-celeste)' }}></div>
                <h3 className="mt-3 mb-1">Celeste</h3>
                <p className="lm-caption mb-2">Secundario · #AEE0F6</p>
                <p className="lm-muted mb-0" style={{ fontSize: '.88rem' }}>Calma, respiración, estados pasivos y de espera.</p>
              </article>
              <article className="lm-card lm-card--pad-sm">
                <div style={{ height: '110px', borderRadius: 'var(--lm-radius)', background: 'var(--lm-sol)' }}></div>
                <h3 className="mt-3 mb-1">Sol</h3>
                <p className="lm-caption mb-2">Acento cálido · #FFD77A</p>
                <p className="lm-muted mb-0" style={{ fontSize: '.88rem' }}>Logros, rachas, insignias y el asterisco de la marca.</p>
              </article>
              <article className="lm-card lm-card--pad-sm">
                <div style={{ height: '110px', borderRadius: 'var(--lm-radius)', background: 'var(--lm-navy)' }}></div>
                <h3 className="mt-3 mb-1">Navy</h3>
                <p className="lm-caption mb-2">Tinta · #152B63</p>
                <p className="lm-muted mb-0" style={{ fontSize: '.88rem' }}>Todo el texto, la barra lateral y la navegación inferior.</p>
              </article>
            </div>

            <div className="lm-note lm-note--teal mt-4">
              <i className="bi bi-eye" aria-hidden="true"></i>
              <div>
                <strong>Los tres pasteles no se usan como texto</strong>
                <p className="lm-caption mb-0">
                  Lavanda, Celeste y Sol son colores de relleno: sobre blanco ninguno llega al
                  contraste mínimo legible. Para texto e iconos existe una variante oscurecida de
                  cada uno —<code>--lm-lavanda-ink</code>, <code>--lm-celeste-ink</code>,{' '}
                  <code>--lm-sol-ink</code>— que conserva el tono y sí pasa AA.
                </p>
              </div>
            </div>

            <p className="lm-eyebrow mt-5">Regla de proporción 60 / 30 / 10</p>
            <div className="d-flex flex-wrap gap-2 mb-3">
              <div style={{ flex: '6 1 200px', padding: '1rem', borderRadius: 'var(--lm-radius)', background: 'var(--lm-cream-deep)', border: '1px solid var(--lm-line)' }}>
                <strong style={{ fontSize: '.9rem' }}>60% lienzo claro</strong> — fondo dominante
              </div>
              <div style={{ flex: '3 1 140px', padding: '1rem', borderRadius: 'var(--lm-radius)', background: 'var(--lm-degradado-calma)', color: 'var(--lm-navy-900)' }}>
                <strong style={{ fontSize: '.9rem' }}>30% Lavanda / Celeste</strong> — estructura
              </div>
              <div style={{ flex: '1 1 90px', padding: '1rem', borderRadius: 'var(--lm-radius)', background: 'var(--lm-sol)', color: 'var(--lm-navy-900)' }}>
                <strong style={{ fontSize: '.9rem' }}>10% Sol</strong>
              </div>
            </div>
            <p className="lm-caption">
              El Sol nunca se usa como fondo extenso. Si un logro deja de sentirse especial,
              es porque se está usando de más.
            </p>
          </div>
        </section>

        {/* ================= Tipografía ================= */}
        <section className="lm-section lm-section--cream" id="tipografia">
          <div className="lm-section__inner">
            <div className="lm-section__head">
              <h2>Tipografía</h2>
              <p className="lm-muted">Cercana pero legible, nunca infantil.</p>
            </div>

            <div className="lm-grid lm-grid--2">
              <article className="lm-card">
                <p style={{ fontFamily: 'var(--lm-font-display)', fontWeight: '700', fontSize: '2.6rem', lineHeight: '1', color: 'var(--lm-emerald-900)', marginBottom: '.6rem' }}>Fredoka</p>
                <p style={{ fontFamily: 'var(--lm-font-display)', fontSize: '1.35rem', color: 'var(--lm-ink-soft)' }}>AaBbCc 0123456789</p>
                <p className="lm-caption mb-0">Geométrica y de trazo redondeado. Títulos, wordmark, botones e insignias.</p>
              </article>
              <article className="lm-card">
                <p style={{ fontFamily: 'var(--lm-font-body)', fontWeight: '600', fontSize: '2.6rem', lineHeight: '1', color: 'var(--lm-emerald-900)', marginBottom: '.6rem' }}>Plus Jakarta Sans</p>
                <p style={{ fontFamily: 'var(--lm-font-body)', fontSize: '1.35rem', color: 'var(--lm-ink-soft)' }}>AaBbCc 0123456789</p>
                <p className="lm-caption mb-0">Sans-serif neutra de alta legibilidad en pantalla. Cuerpo, formularios, chat.</p>
              </article>
            </div>

            <div className="lm-table-wrap mt-4">
              <table className="lm-table">
                <thead><tr><th>Nivel</th><th>Fuente / peso</th><th>Uso</th></tr></thead>
                <tbody>
                  <tr><td><span style={{ fontFamily: 'var(--lm-font-display)', fontWeight: '700', fontSize: '1.5rem' }}>H1</span></td><td>Fredoka Bold</td><td>Títulos de sección y pantallas de bienvenida</td></tr>
                  <tr><td><span style={{ fontFamily: 'var(--lm-font-display)', fontWeight: '600', fontSize: '1.2rem' }}>H2</span></td><td>Fredoka SemiBold</td><td>Encabezados de tarjeta y nombres de módulos</td></tr>
                  <tr><td>Body</td><td>Plus Jakarta Sans Regular</td><td>Párrafos, descripciones, mensajes de chat</td></tr>
                  <tr><td><span className="lm-caption">Caption</span></td><td>Plus Jakarta Sans Medium</td><td>Etiquetas, marcas de tiempo, metadatos</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ================= Logo ================= */}
        <section className="lm-section">
          <div className="lm-section__inner">
            <div className="lm-section__head">
              <h2>Logo, símbolo y zona de respeto</h2>
            </div>

            <div className="lm-grid lm-grid--2">
              <article className="lm-card">
                <p className="lm-eyebrow">Área de protección</p>
                <div style={{ padding: '2.5rem', border: '2px dashed var(--lm-teal-300)', borderRadius: 'var(--lm-radius)', display: 'grid', placeItems: 'center', background: 'var(--lm-cream-soft)' }}>
                  <Logotipo tamano={46} conIsotipo conBajada />
                </div>
                <p className="lm-muted mt-3 mb-2" style={{ fontSize: '.92rem' }}>
                  El margen libre alrededor del isotipo equivale a la altura de la letra <strong>L</strong>.
                  Ningún texto, borde de contenedor ni elemento gráfico puede invadir esa zona.
                </p>
                <p className="lm-caption mb-0">El asterisco siempre en Sol #FFD77A. No se recolorea ni se sustituye.</p>
              </article>

              <article className="lm-card">
                <p className="lm-eyebrow">Versiones del sistema</p>
                <div className="d-flex flex-wrap align-items-center gap-4 mb-4">
                  <Isotipo tamano={76} conFondo />
                  <Isotipo tamano={76} />
                  <img src="/img/lumys-mascota-plana.svg" alt="Mascota plana" style={{ width: '64px' }} />
                  <Logotipo tamano={34} />
                </div>
                <div className="lm-table-wrap">
                  <table className="lm-table" style={{ minWidth: '0' }}>
                    <thead><tr><th>Versión</th><th>Uso recomendado</th></tr></thead>
                    <tbody>
                      <tr><td>Isotipo principal</td><td>Piezas de marca, presentaciones, cabeceras</td></tr>
                      <tr><td>Versión simple</td><td>Una sola tinta sobre Navy: splash, merch</td></tr>
                      <tr><td>App icon</td><td>Instalación en tiendas. Sin wordmark</td></tr>
                      <tr><td>Versión circular</td><td>Avatares de Instagram y TikTok, favicon</td></tr>
                      <tr><td>Símbolo aislado</td><td>Bullet, marcador de notificación, sello</td></tr>
                    </tbody>
                  </table>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* ================= Usos ================= */}
        <section className="lm-section lm-section--cream">
          <div className="lm-section__inner">
            <div className="lm-section__head">
              <h2>Usos correctos e incorrectos</h2>
            </div>

            <div className="lm-grid lm-grid--2">
              <article className="lm-card" style={{ borderLeft: '4px solid var(--lm-teal)' }}>
                <h3 className="mb-3">✓ Hacer</h3>
                <div className="lm-stack-sm">
                  <p className="lm-tick mb-0"><i className="bi bi-check-lg"></i> Usar el isotipo sobre fondos claros: blanco o el lienzo claro #F7F6FD.</p>
                  <p className="lm-tick mb-0"><i className="bi bi-check-lg"></i> Respetar el área de protección equivalente a la altura de la L.</p>
                  <p className="lm-tick mb-0"><i className="bi bi-check-lg"></i> Usar la versión circular de forma independiente en avatares y favicon.</p>
                  <p className="lm-tick mb-0"><i className="bi bi-check-lg"></i> Mantener el asterisco siempre en Sol.</p>
                  <p className="lm-tick mb-0"><i className="bi bi-check-lg"></i> CTA principal en Navy con texto claro; al pasar el ratón vira a Lavanda.</p>
                </div>
              </article>

              <article className="lm-card" style={{ borderLeft: '4px solid var(--lm-terracotta)' }}>
                <h3 className="mb-3">✗ Evitar</h3>
                <div className="lm-stack-sm">
                  <p className="lm-tick lm-tick--no mb-0"><i className="bi bi-x-lg"></i> Distorsionar, estirar o rotar el isotipo.</p>
                  <p className="lm-tick lm-tick--no mb-0"><i className="bi bi-x-lg"></i> Sustituir los colores oficiales por neones o tonos saturados.</p>
                  <p className="lm-tick lm-tick--no mb-0"><i className="bi bi-x-lg"></i> Agregar sombras, biseles o efectos de iluminación no contemplados.</p>
                  <p className="lm-tick lm-tick--no mb-0"><i className="bi bi-x-lg"></i> Colocar el logo sobre fotografías o fondos de bajo contraste.</p>
                  <p className="lm-tick lm-tick--no mb-0"><i className="bi bi-x-lg"></i> Usar el Sol como fondo de pantalla completo.</p>
                </div>
              </article>
            </div>

            <article className="lm-card mt-4">
              <p className="lm-eyebrow">Lo que Lumys<span className="lm-ast">*</span> nunca hace</p>
              <div className="lm-grid lm-grid--4">
                <p className="mb-0" style={{ fontSize: '.94rem' }}>No diagnostica ni etiqueta a nadie.</p>
                <p className="mb-0" style={{ fontSize: '.94rem' }}>No muestra nombres en el panel institucional.</p>
                <p className="mb-0" style={{ fontSize: '.94rem' }}>No avisa a nadie sin que el estudiante lo haya definido.</p>
                <p className="mb-0" style={{ fontSize: '.94rem' }}>No premia el estado de ánimo, solo la constancia.</p>
              </div>
            </article>
          </div>
        </section>

        {/* ================= Interfaz ================= */}
        <section className="lm-section" id="interfaz">
          <div className="lm-section__inner">
            <div className="lm-section__head">
              <h2>Aplicación en interfaz</h2>
              <p className="lm-muted">Componentes reales del producto, no maquetas.</p>
            </div>

            <div className="lm-grid lm-grid--2">
              <article className="lm-card">
                <p className="lm-eyebrow">Botones y estados</p>
                <div className="d-flex flex-column gap-3">
                  <button className="lm-btn" type="button">Primario · Navy</button>
                  <button className="lm-btn lm-btn--ghost" type="button">Secundario · contorno Lavanda</button>
                  <button className="lm-btn lm-btn--logro" type="button">Logro · Sol</button>
                  <button className="lm-btn lm-btn--soft" type="button">Suave · sobre lienzo</button>
                </div>
                <p className="lm-caption mt-3 mb-0">El hover del primario pasa a Lavanda. El Sol se reserva a micro-momentos de logro.</p>
              </article>

              <article className="lm-card">
                <p className="lm-eyebrow">Navegación · píldora activa</p>
                <div className="lm-bottomnav" style={{ position: 'static', transform: 'none', width: '100%', boxShadow: 'none' }}>
                  <span className="lm-bottomnav__link is-active"><i className="bi bi-house-heart"></i><span>Inicio</span></span>
                  <span className="lm-bottomnav__link"><i className="bi bi-chat-heart"></i></span>
                  <span className="lm-bottomnav__link"><i className="bi bi-graph-up"></i></span>
                  <span className="lm-bottomnav__link"><i className="bi bi-diagram-3"></i></span>
                  <span className="lm-bottomnav__link"><i className="bi bi-person-gear"></i></span>
                </div>
                <p className="lm-caption mt-3 mb-4">La píldora activa se expande y muestra la etiqueta; el resto quedan como iconos al 55%. Solo un elemento activo a la vez.</p>

                <p className="lm-eyebrow">Niveles de respuesta</p>
                <div className="d-flex flex-wrap gap-2">
                  <span className="lm-nivel lm-nivel--1">Nivel 1 · Conversar</span>
                  <span className="lm-nivel lm-nivel--2">Nivel 2 · Acompañar</span>
                  <span className="lm-nivel lm-nivel--3">Nivel 3 · Derivar</span>
                </div>
              </article>
            </div>

            <div className="lm-grid lm-grid--2 mt-4">
              <article className="lm-card">
                <p className="lm-eyebrow">Mascota vs. isotipo</p>
                <p className="lm-muted mb-3" style={{ fontSize: '.94rem' }}>
                  Si la pieza busca cercanía y conexión, lidera Lumy. Si busca credibilidad
                  institucional, lidera el isotipo. Pueden coexistir, pero solo uno protagoniza.
                </p>
                <div className="lm-table-wrap">
                  <table className="lm-table" style={{ minWidth: '0' }}>
                    <thead><tr><th>Contexto</th><th>Protagonista</th></tr></thead>
                    <tbody>
                      <tr><td>Onboarding, estados vacíos, notificaciones</td><td>Lumy</td></tr>
                      <tr><td>Instagram, TikTok, stickers de chat</td><td>Lumy</td></tr>
                      <tr><td>App icon, favicon, firma institucional</td><td>Isotipo</td></tr>
                      <tr><td>Documentos formales, alianzas, prensa</td><td>Isotipo</td></tr>
                    </tbody>
                  </table>
                </div>
              </article>

              <div className="lm-stack">
                <article className="lm-card" style={{ borderLeft: '4px solid var(--lm-teal)' }}>
                  <p className="lm-eyebrow">Siempre</p>
                  <p className="mb-2" style={{ fontSize: '1.05rem', fontFamily: 'var(--lm-font-display)', color: 'var(--lm-emerald-900)' }}>
                    “Hoy parece un día pesado. Está bien nombrarlo.”
                  </p>
                  <p className="lm-caption mb-0">Cercana, directa, validante. Frases cortas. De tú a tú.</p>
                </article>
                <article className="lm-card" style={{ borderLeft: '4px solid var(--lm-terracotta)' }}>
                  <p className="lm-eyebrow">Nunca</p>
                  <p className="mb-2" style={{ fontSize: '1.05rem', fontFamily: 'var(--lm-font-display)', color: 'var(--lm-emerald-900)' }}>
                    “Presenta usted síntomas compatibles con…”
                  </p>
                  <p className="lm-caption mb-0">Sin tono clínico, diagnósticos ni lenguaje alarmista.</p>
                </article>
              </div>
            </div>
          </div>
        </section>

        <footer className="lm-footer">
          <div className="lm-footer__inner">
            <div>
              <Logotipo tamano={34} conIsotipo conBajada invertido />
              <p className="mt-3 mb-0">Manual de marca v2.0 · 2026</p>
            </div>
            <div>
              <p className="lm-eyebrow" style={{ color: 'rgba(var(--lm-cream-rgb),.5)' }}>Volver</p>
              <p className="mb-1"><A href="#/bienvenida">Portada</A></p>
              <p className="mb-0"><A href="#/acceso">Entrar a la demo</A></p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

export default Marca;
