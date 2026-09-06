/* ===========================================================================
 * Lumys* — tu cuenta y privacidad
 * ---------------------------------------------------------------------------
 * Las tres preferencias se guardan localmente hasta que exista el módulo de
 * datos en el backend. Que estén acá y no escondidas en un menú es parte del
 * trato: el estudiante tiene que poder ver y cambiar qué se comparte sin
 * buscarlo.
 * =========================================================================== */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { A } from '../componentes/A.tsx';
import { useAvisos } from '../lib/avisos.tsx';
import { rutaInicial, useSesion } from '../lib/sesion.tsx';
import { capitalizar, iniciales } from '../lib/formato.ts';
import * as almacen from '../lib/almacen.ts';
import type { Perfil as PerfilTipo } from '../lib/tipos.ts';

type Preferencias = { resumen: boolean; familia: boolean; recordatorio: boolean };

const POR_DEFECTO: Preferencias = { resumen: true, familia: false, recordatorio: true };

export function Perfil() {
  const { usuario } = useSesion();
  const avisar = useAvisos();
  const [prefs, setPrefs] = useState<Preferencias>(
    () => almacen.leer<Preferencias>('privacidad', POR_DEFECTO),
  );

  const cambiar = (clave: keyof Preferencias) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const siguientes = { ...prefs, [clave]: e.target.checked };
    setPrefs(siguientes);
    almacen.guardar('privacidad', siguientes);
    avisar('Guardado. Podés cambiarlo cuando querás.', { tipo: 'ok' });
  };

  const borrarRegistros = () => {
    almacen.borrar('checkins');
    avisar('Borramos tus check-ins de este dispositivo.', { tipo: 'ok' });
  };

  return (
    <>
      {/* Vista: cuenta, privacidad y transparencia */}
      <section className="lm-stack">

        <div className="lm-page-head">
          <div className="lm-page-head__text">
            <h1>Tu cuenta</h1>
            <p>Acá ves exactamente <strong>qué se comparte, con quién y cuándo</strong>. La transparencia no es un trámite: es lo que sostiene todo lo demás.</p>
          </div>
        </div>

        <article className="lm-card">
          <div className="d-flex flex-wrap align-items-center gap-4">
            <span className="lm-avatar lm-avatar--lg">{iniciales(usuario?.nombre ?? '')}</span>
            <div className="flex-grow-1" style={{ minWidth: '200px' }}>
              <h2 className="mb-1">{usuario?.nombre ?? '—'}</h2>
              <p className="lm-caption mb-0">{usuario ? `${capitalizar(usuario.perfil)}${usuario.grado ? ` · ${usuario.grado}` : ''}` : ''}</p>
              <p className="lm-caption mb-0">{usuario?.centro || '—'}</p>
            </div>
            <A className="lm-btn lm-btn--ghost lm-btn--sm" href="#/red">
              <i className="bi bi-diagram-3" aria-hidden="true"></i> Mi red de confianza
            </A>
          </div>
        </article>

        <div className="row g-4">
          <div className="col-12 col-lg-7">
            <article className="lm-card h-100">
              <div className="lm-card__head">
                <div>
                  <h2>Qué se comparte</h2>
                  <p className="lm-caption mb-0">Podés cambiar esto cuando querás.</p>
                </div>
              </div>

              <ul className="lm-list">
                <li className="lm-list__item">
                  <div className="flex-grow-1">
                    <p className="mb-0 fw-semibold" style={{ fontSize: '.95rem' }}>Resumen descriptivo a mi orientador/a</p>
                    <p className="lm-caption mb-0">Conducta observable y ventana de tiempo. Nunca tu texto literal.</p>
                  </div>
                  <label className="lm-switch">
                    <input type="checkbox" checked={prefs.resumen} onChange={cambiar('resumen')} />
                    <span className="lm-switch__track"></span>
                    <span className="visually-hidden">Compartir resumen con el orientador o la orientadora</span>
                  </label>
                </li>
                <li className="lm-list__item">
                  <div className="flex-grow-1">
                    <p className="mb-0 fw-semibold" style={{ fontSize: '.95rem' }}>Avisos a mi familia</p>
                    <p className="lm-caption mb-0">Solo si una señal se sostiene y solo tras evaluar que sea seguro.</p>
                  </div>
                  <label className="lm-switch">
                    <input type="checkbox" checked={prefs.familia} onChange={cambiar('familia')} />
                    <span className="lm-switch__track"></span>
                    <span className="visually-hidden">Permitir avisos a mi familia</span>
                  </label>
                </li>
                <li className="lm-list__item">
                  <div className="flex-grow-1">
                    <p className="mb-0 fw-semibold" style={{ fontSize: '.95rem' }}>Recordatorio diario del check-in</p>
                    <p className="lm-caption mb-0">Un mensaje por WhatsApp, a la hora que elijas.</p>
                  </div>
                  <label className="lm-switch">
                    <input type="checkbox" checked={prefs.recordatorio} onChange={cambiar('recordatorio')} />
                    <span className="lm-switch__track"></span>
                    <span className="visually-hidden">Recibir recordatorio diario</span>
                  </label>
                </li>
              </ul>
            </article>
          </div>

          <div className="col-12 col-lg-5">
            <article className="lm-card h-100">
              <div className="lm-card__head">
                <div>
                  <h2>Quién ve qué</h2>
                  <p className="lm-caption mb-0">Matriz de permisos del sistema.</p>
                </div>
              </div>

              <div className="lm-table-wrap">
                <table className="lm-table lm-permisos" style={{ minWidth: '0' }}>
                  <thead>
                    <tr><th>Rol</th><th>Tu texto</th><th>Resumen</th><th>Agregados</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>Vos</td><td><i className="bi bi-check-lg si"></i></td><td><i className="bi bi-check-lg si"></i></td><td><i className="bi bi-dash no"></i></td></tr>
                    <tr><td>Orientador/a</td><td><i className="bi bi-x-lg no"></i></td><td><i className="bi bi-check-lg si"></i></td><td><i className="bi bi-check-lg si"></i></td></tr>
                    <tr><td>Psicólogo</td><td><i className="bi bi-x-lg no"></i></td><td><i className="bi bi-check-lg si"></i></td><td><i className="bi bi-check-lg si"></i></td></tr>
                    <tr><td>Familia</td><td><i className="bi bi-x-lg no"></i></td><td><i className="bi bi-check-lg si"></i></td><td><i className="bi bi-x-lg no"></i></td></tr>
                    <tr><td>Colegio</td><td><i className="bi bi-x-lg no"></i></td><td><i className="bi bi-x-lg no"></i></td><td><i className="bi bi-check-lg si"></i></td></tr>
                    <tr><td>Equipo Lumys</td><td><i className="bi bi-x-lg no"></i></td><td><i className="bi bi-x-lg no"></i></td><td><i className="bi bi-check-lg si"></i></td></tr>
                  </tbody>
                </table>
              </div>
              <p className="lm-caption mt-3 mb-0">“Agregados” significa métricas de todo el centro, sin nombres y sin casos individuales.</p>
            </article>
          </div>
        </div>

        <article className="lm-card lm-card--cream">
          <div className="lm-card__head">
            <div>
              <h2>Tus datos</h2>
              <p className="lm-caption mb-0">Son tuyos. Podés llevártelos o borrarlos.</p>
            </div>
          </div>
          <div className="d-flex flex-wrap gap-2">
            <button className="lm-btn lm-btn--ghost lm-btn--sm" type="button"
                    onClick={() => avisar('La exportación llega con el módulo de datos.', { tipo: 'info' })}>
              <i className="bi bi-download" aria-hidden="true"></i> Descargar mis registros
            </button>
            <button className="lm-btn lm-btn--ghost lm-btn--sm" type="button" onClick={borrarRegistros}>
              <i className="bi bi-trash3" aria-hidden="true"></i> Borrar mis check-ins de este dispositivo
            </button>
            <A className="lm-btn lm-btn--ghost lm-btn--sm" href="#/marca">
              <i className="bi bi-palette" aria-hidden="true"></i> Manual de marca
            </A>
          </div>
        </article>

        <SesionYAuxilio />
      </section>
    </>
  );
}

/* ---------------------------------------------------------------------------
 * Sesión, cambio de perfil y teléfonos de auxilio
 * ---------------------------------------------------------------------------
 * Estos tres bloques vivían en la barra lateral y en el desplegable de la
 * cabecera. Al quedarse la navegación abajo y en un único sitio, esas dos barras
 * desaparecieron; aterrizan acá porque esta vista ya se llamaba "Tu cuenta" y es
 * donde alguien los va a buscar.
 * ------------------------------------------------------------------------- */

const DEMOS: { perfil: PerfilTipo; icono: string; texto: string }[] = [
  { perfil: 'estudiante', icono: 'bi-person-heart', texto: 'Estudiante' },
  { perfil: 'orientador', icono: 'bi-clipboard-heart', texto: 'Orientador/a' },
  { perfil: 'psicologo', icono: 'bi-shield-check', texto: 'Psicólogo' },
  { perfil: 'admin', icono: 'bi-bar-chart', texto: 'Equipo Lumys' },
];

function SesionYAuxilio() {
  const { usuario, salir, entrarComo } = useSesion();
  const navegar = useNavigate();
  const avisar = useAvisos();

  const cambiar = (perfil: PerfilTipo) => {
    const u = entrarComo(perfil);
    if (!u) return;
    navegar(rutaInicial(perfil));
    avisar(`Entraste como ${u.nombre}`, { tipo: 'ok' });
  };

  return (
    <>
      <article className="lm-card">
        <div className="lm-card__head">
          <div>
            <h2>¿Necesitás ayuda ya?</h2>
            <p className="lm-caption mb-0">Gratis, las 24 horas, desde cualquier teléfono.</p>
          </div>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <a className="lm-btn lm-btn--ghost lm-btn--sm" href="tel:133">
            <i className="bi bi-telephone-fill" aria-hidden="true"></i> 133 · MIFAN
          </a>
          <a className="lm-btn lm-btn--ghost lm-btn--sm" href="tel:118">
            <i className="bi bi-shield-fill-check" aria-hidden="true"></i> 118 · Policía Nacional
          </a>
        </div>
      </article>

      <article className="lm-card">
        <div className="lm-card__head">
          <div>
            <h2>Tu sesión</h2>
            <p className="lm-caption mb-0">
              Entraste como <strong>{usuario?.nombre}</strong>.
            </p>
          </div>
        </div>

        <p className="lm-eyebrow">Cambiar de perfil (demo)</p>
        <div className="d-flex flex-wrap gap-2 mb-3">
          {DEMOS.map((d) => (
            <button
              className="lm-btn lm-btn--ghost lm-btn--sm"
              type="button"
              key={d.perfil}
              disabled={usuario?.perfil === d.perfil}
              onClick={() => cambiar(d.perfil)}
            >
              <i className={`bi ${d.icono}`} aria-hidden="true"></i> {d.texto}
            </button>
          ))}
        </div>

        <button
          className="lm-btn lm-btn--sm"
          type="button"
          onClick={() => {
            salir();
            avisar('Cerraste sesión. Tus datos siguen siendo tuyos.', { tipo: 'info' });
          }}
        >
          <i className="bi bi-box-arrow-left" aria-hidden="true"></i> Cerrar sesión
        </button>
      </article>
    </>
  );
}

export default Perfil;
