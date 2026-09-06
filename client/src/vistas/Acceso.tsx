/* ===========================================================================
 * Lumys* — acceso (entrar / crear cuenta)
 * ---------------------------------------------------------------------------
 * Portada de `acceso_registro_multirrol_lumys`. La composición es la del
 * mockup: selector de cuatro perfiles arriba, tarjeta con pestañas
 * "Iniciar sesión / Crear cuenta" en el centro, y los dos bloques de confianza
 * abajo.
 *
 * ── Dónde el mockup y el backend no coinciden ─────────────────────────────
 * Stitch dibuja el acceso del estudiante como «Alias anónimo o Código Secreto
 * Escolar» + «PIN de 4 a 6 dígitos». La API de Lumys autentica con correo y
 * contraseña, y no existe ni el alias ni el PIN. Copiar esos campos daría una
 * pantalla idéntica a la captura y absolutamente incapaz de iniciar sesión, así
 * que se conserva el contrato real con el estilo de campo del mockup (icono a
 * la izquierda, fondo hundido, foco que eleva). Lo mismo con el botón de
 * Google Classroom / Microsoft EDU: no hay SSO detrás, así que avisa en vez de
 * fingir que entra.
 *
 * El acceso rápido de demostración no está en el mockup, pero es el recorrido
 * con el que se enseña el sistema: se mantiene, con el lenguaje visual de las
 * tarjetas de rol.
 * =========================================================================== */

import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { A } from '../componentes/A.tsx';
import { Isotipo, Logotipo } from '../componentes/Identidad.tsx';
import { Lumy } from '../lumy/Lumy.tsx';
import { useAvisos } from '../lib/avisos.tsx';
import { rutaInicial, useSesion } from '../lib/sesion.tsx';
import * as api from '../lib/api.ts';
import type { Perfil } from '../lib/tipos.ts';

const emailValido = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

type Errores = Record<string, string>;
type Modo = 'login' | 'registro';

function Icono({ nombre, className = '', relleno = false }: { nombre: string; className?: string; relleno?: boolean }) {
  return (
    <span className={`material-symbols-outlined${relleno ? ' is-fill' : ''} ${className}`} aria-hidden="true">
      {nombre}
    </span>
  );
}

/* --------------------------------------------------------------------------
 * Los cuatro perfiles
 * ------------------------------------------------------------------------
 * `Perfil` en el código es estudiante | orientador | psicologo | admin; en el
 * mockup son estudiante | orientadora | psicologo | equipo. Se mapean acá para
 * que el resto de la vista hable un solo idioma.
 */
const PERFILES: {
  perfil: Perfil;
  titulo: string;
  bajada: string;
  tonoBajada: string;
  resumen: string;
  icono: string;
  tonoIcono: string;
  /** Nombre y descripción de la cuenta de demostración. */
  demo: string;
}[] = [
  {
    perfil: 'estudiante',
    titulo: 'Estudiante',
    bajada: 'Espacio Personal',
    tonoBajada: 'text-primary',
    resumen: 'Acceso a tu espacio privado, check-in conversacional y calma.',
    icono: 'mood',
    tonoIcono: 'bg-primary-container/40 text-primary',
    demo: 'Kevin · 9no B',
  },
  {
    perfil: 'orientador',
    titulo: 'Orientador/a',
    bajada: 'Comunidad Escolar',
    tonoBajada: 'text-secondary',
    resumen: 'Gestión de clima de aula y citas voluntarias.',
    icono: 'assignment_turned_in',
    tonoIcono: 'bg-secondary-container/50 text-secondary',
    demo: 'Karla · orientadora',
  },
  {
    perfil: 'psicologo',
    titulo: 'Psicólogo/a',
    bajada: 'Clínico Escolar',
    tonoBajada: 'text-primary',
    resumen: 'Acompañamiento especializado e interconsultas éticas.',
    icono: 'verified_user',
    tonoIcono: 'bg-surface-variant text-on-primary-fixed-variant',
    demo: 'Dr. Sequeira · supervisión',
  },
  {
    perfil: 'admin',
    titulo: 'Equipo Lumys',
    bajada: 'Supervisión Red',
    tonoBajada: 'text-tertiary',
    resumen: 'Supervisión institucional y red anónima de apoyo.',
    icono: 'query_stats',
    tonoIcono: 'bg-tertiary-fixed text-on-tertiary-container',
    demo: 'Panel institucional',
  },
];

/** Clases del campo de texto del mockup, que se repiten en los cinco inputs. */
const CAMPO =
  'w-full rounded-lg bg-surface-container-low py-space-sm pl-11 pr-space-md font-body-md text-body-md ' +
  'text-on-surface placeholder:text-outline focus:bg-surface-container-lowest focus:shadow-md transition-all outline-none';

export function Acceso() {
  const [modo, setModo] = useState<Modo>('login');
  const [perfil, setPerfil] = useState<Perfil>('estudiante');
  const [errores, setErrores] = useState<Errores>({});
  const [ocupado, setOcupado] = useState(false);
  const [verClave, setVerClave] = useState<Record<string, boolean>>({});

  const { entrar, entrarComo } = useSesion();
  const navegar = useNavigate();
  const avisar = useAvisos();

  const esEstudiante = perfil === 'estudiante';
  const seleccionado = PERFILES.find((p) => p.perfil === perfil)!;

  const alternarClave = (id: string) => setVerClave((v) => ({ ...v, [id]: !v[id] }));

  const cambiarPerfil = (p: Perfil) => {
    setPerfil(p);
    setErrores({});
  };

  const cambiarModo = (m: Modo) => {
    setModo(m);
    setErrores({});
  };

  /* --- Entrar ------------------------------------------------------------ */
  async function iniciarSesion(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    const email = String(datos.get('email') ?? '').trim();
    const password = String(datos.get('password') ?? '');

    const errs: Errores = {};
    if (!emailValido(email)) errs.email = 'Escribí un correo válido.';
    if (password.length < 1) errs.password = 'Falta tu contraseña.';
    setErrores(errs);
    if (Object.keys(errs).length) return;

    setOcupado(true);
    try {
      const res = await api.login(email, password);
      if (res.token) api.token.set(res.token);

      // El perfil lo manda el backend. Solo se recurre al elegido en pantalla
      // cuando la respuesta viene del respaldo de demostración.
      const perfilReal = (res.usuario?.perfil?.toLowerCase() as Perfil | undefined)
        ?? (res.usuario?.rol === 'ADMIN' ? 'admin' : undefined)
        ?? perfil;

      const base = api.perfilesDemo()[perfilReal] ?? api.perfilesDemo().estudiante;
      entrar({ ...base });
      navegar(rutaInicial(perfilReal));
      avisar(`Hola de nuevo, ${base.nombre.split(' ')[0]}`, { tipo: 'ok' });
    } catch (err) {
      setErrores({ password: (err as Error).message || 'No pudimos entrar. Probá de nuevo.' });
      setOcupado(false);
    }
  }

  /* --- Crear cuenta ------------------------------------------------------ */
  async function crearCuenta(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    const nombre = String(datos.get('nombre') ?? '').trim();
    const email = String(datos.get('email') ?? '').trim();
    const edad = String(datos.get('edad') ?? '');
    const password = String(datos.get('password') ?? '');
    const consentimiento = datos.get('consentimiento') === 'on';

    const errs: Errores = {};
    if (nombre.length < 2) errs.nombre = 'Escribí cómo querés que te llamemos.';
    if (!emailValido(email)) errs.email = 'Escribí un correo válido.';
    if (edad && (Number(edad) < 12 || Number(edad) > 80)) errs.edad = 'Poné una edad entre 12 y 80.';
    if (password.length < 8) errs.password = 'La contraseña necesita al menos 8 caracteres.';
    if (!consentimiento) errs.consentimiento = 'Necesitamos que confirmes esto para seguir.';
    setErrores(errs);
    if (Object.keys(errs).length) return;

    setOcupado(true);
    try {
      await api.registrar({
        email,
        nombre,
        password,
        perfil: perfil.toUpperCase(),
        consentimiento: true,
      });

      const base = api.perfilesDemo()[perfil] ?? api.perfilesDemo().estudiante;
      entrar({ ...base, nombre });
      navegar(rutaInicial(perfil));
      avisar('Tu cuenta está lista. Empezá cuando querás.', { tipo: 'logro' });
    } catch (err) {
      setErrores({ email: (err as Error).message || 'No pudimos crear la cuenta.' });
      setOcupado(false);
    }
  }

  const entrarDemo = (p: Perfil) => {
    const u = entrarComo(p);
    if (!u) return;
    navegar(rutaInicial(p));
    avisar(`Entraste como ${u.nombre}`, { tipo: 'ok' });
  };

  /** Mensaje de error bajo un campo. */
  const Fallo = ({ de }: { de: string }) =>
    errores[de] ? (
      <p className="font-body-sm text-body-sm text-error mt-space-2xs flex items-center gap-1" role="alert">
        <Icono nombre="error" className="text-[16px]" />
        {errores[de]}
      </p>
    ) : null;

  const anillo = (de: string) => (errores[de] ? ' ring-1 ring-error' : '');

  const textoEnviar = modo === 'login'
    ? (esEstudiante ? 'Ingresar a mi Espacio Seguro' : 'Iniciar Sesión Profesional')
    : (esEstudiante ? 'Crear mi Espacio Anónimo' : 'Completar Registro Institucional');

  return (
    <div className="stitch bg-background font-body-md text-on-surface antialiased selection:bg-primary-container selection:text-on-primary-container min-h-screen flex flex-col items-center justify-center p-margin-mobile md:p-margin-desktop">
      <main id="lm-view" className="w-full max-w-[1200px] mx-auto">
        <div className="flex flex-col w-full">
          <div className="relative w-full overflow-hidden rounded-xl bg-gradient-to-b from-surface-container-lowest via-surface-container-low to-background p-space-md md:p-space-2xl shadow-xl">

            {/* Orbes de fondo */}
            <div className="pointer-events-none absolute -top-24 -left-20 h-96 w-96 rounded-full bg-primary-container/20 blur-3xl" />
            <div className="pointer-events-none absolute top-1/3 -right-24 h-96 w-96 rounded-full bg-secondary-container/30 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 left-1/4 h-80 w-80 rounded-full bg-tertiary-fixed/20 blur-3xl" />

            {/* ---------------- Cabecera ---------------- */}
            <header className="relative z-10 mx-auto mb-space-xl flex max-w-2xl flex-col items-center text-center">
              <A href="#/bienvenida" className="mb-space-md transition-transform hover:scale-105 duration-300" aria-label="Volver a la portada">
                <Logotipo tamano={44} conIsotipo conBajada />
              </A>

              <div className="inline-flex items-center gap-space-xs rounded-full bg-surface-container px-space-md py-space-2xs text-on-surface-variant font-label-md text-label-md mb-space-sm shadow-sm">
                <Icono nombre="switch_left" className="text-primary text-[18px]" />
                <span>Espacio escolar de bienestar emocional confidencial</span>
              </div>

              <h1 className="font-headline-xl text-headline-xl-mobile md:text-headline-xl text-on-surface tracking-tight">
                Bienvenido a tu santuario seguro
              </h1>
              <p className="font-body-lg text-body-lg text-on-surface-variant mt-space-xs max-w-lg">
                Elige tu rol para comenzar un viaje de escucha compasiva, resguardo ético y
                acompañamiento sin juicios.
              </p>
            </header>

            {/* ---------------- Selector de perfil ---------------- */}
            <div className="relative z-10 mx-auto mb-space-xl max-w-4xl">
              <div className="mb-space-sm flex items-center justify-between px-space-xs">
                <span className="font-label-lg text-label-lg text-on-surface font-semibold flex items-center gap-space-2xs">
                  <Icono nombre="group" className="text-primary text-[20px]" />
                  Selecciona tu perfil de acceso
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">4 perfiles habilitados</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-sm" role="radiogroup" aria-label="Perfil de acceso">
                {PERFILES.map((p) => {
                  const activo = p.perfil === perfil;
                  return (
                    <button
                      key={p.perfil}
                      type="button"
                      role="radio"
                      aria-checked={activo}
                      onClick={() => cambiarPerfil(p.perfil)}
                      className={`text-left p-space-md rounded-lg bg-surface-container-lowest transition-all duration-300 group relative overflow-hidden ${
                        activo ? 'shadow-md ring-2 ring-primary' : 'shadow-sm hover:shadow-md'
                      }`}
                    >
                      <div className={`absolute top-2 right-2 transition-opacity ${activo ? 'opacity-100' : 'opacity-0'}`}>
                        <Icono nombre="check_circle" className="text-primary text-[20px]" relleno />
                      </div>
                      <div className="flex items-center gap-space-sm mb-space-xs">
                        <div className={`w-11 h-11 rounded-full ${p.tonoIcono} flex items-center justify-center transition-colors`}>
                          <Icono nombre={p.icono} className="text-[24px]" />
                        </div>
                        <div>
                          <span className="font-label-lg text-label-lg font-bold text-on-surface block">{p.titulo}</span>
                          <span className={`font-label-sm text-label-sm ${p.tonoBajada} font-medium`}>{p.bajada}</span>
                        </div>
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant mt-space-2xs">{p.resumen}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ---------------- Tarjeta de formulario ---------------- */}
            <div className="relative z-10 mx-auto w-full max-w-xl">
              <div className="relative rounded-xl bg-surface-container-lowest p-space-lg md:p-space-xl shadow-xl">

                <div className="mb-space-lg flex p-space-2xs rounded-full bg-surface-container-low shadow-inner" role="tablist" aria-label="Entrar o crear cuenta">
                  {(['login', 'registro'] as Modo[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="tab"
                      aria-selected={modo === m}
                      onClick={() => cambiarModo(m)}
                      className={`flex-1 py-space-xs rounded-full font-label-lg text-label-lg transition-all text-center ${
                        modo === m
                          ? 'font-bold text-on-surface bg-surface-container-lowest shadow-sm'
                          : 'font-semibold text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      {m === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
                    </button>
                  ))}
                </div>

                <div className="mb-space-md inline-flex items-center gap-space-xs px-space-sm py-space-2xs rounded-full bg-secondary-container/40 text-on-secondary-container font-label-sm text-label-sm">
                  <Icono nombre="verified" className="text-[16px]" />
                  <span aria-live="polite">
                    {modo === 'login' ? 'Ingresando como: ' : 'Registrándote como: '}
                    <strong className="font-semibold">{seleccionado.titulo}</strong>
                  </span>
                </div>

                <form
                  className="space-y-space-md"
                  onSubmit={modo === 'login' ? iniciarSesion : crearCuenta}
                  noValidate
                >
                  {/* Solo al crear cuenta: cómo llamarte y la edad. */}
                  {modo === 'registro' && (
                    <>
                      <div>
                        <label className="block font-label-md text-label-md text-on-surface mb-space-2xs" htmlFor="ac-nombre">
                          ¿Cómo te llamamos?
                        </label>
                        <div className="relative flex items-center">
                          <Icono nombre="badge" className="absolute left-space-sm text-on-surface-variant text-[20px]" />
                          <input
                            className={CAMPO + anillo('nombre')}
                            id="ac-nombre" name="nombre" type="text" autoComplete="name"
                            placeholder="Kevin" required
                          />
                        </div>
                        <Fallo de="nombre" />
                      </div>

                      {esEstudiante && (
                        <div>
                          <label className="block font-label-md text-label-md text-on-surface mb-space-2xs" htmlFor="ac-edad">
                            Edad
                          </label>
                          <div className="relative flex items-center">
                            <Icono nombre="cake" className="absolute left-space-sm text-on-surface-variant text-[20px]" />
                            <input
                              className={CAMPO + anillo('edad')}
                              id="ac-edad" name="edad" type="number" min="12" max="80" placeholder="15"
                            />
                          </div>
                          <Fallo de="edad" />
                        </div>
                      )}
                    </>
                  )}

                  <div>
                    <label className="block font-label-md text-label-md text-on-surface mb-space-2xs" htmlFor="ac-email">
                      {esEstudiante ? 'Tu correo' : 'Correo institucional autorizado'}
                    </label>
                    <div className="relative flex items-center">
                      <Icono nombre="mail" className="absolute left-space-sm text-on-surface-variant text-[20px]" />
                      <input
                        className={CAMPO + anillo('email')}
                        id="ac-email" name="email" type="email" autoComplete="email"
                        placeholder={esEstudiante ? 'kevin@ejemplo.com' : 'nombre.apellido@colegio.edu'}
                        required
                      />
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-space-2xs">
                      {esEstudiante
                        ? 'Tu nombre real nunca se muestra a nadie de tu colegio.'
                        : 'Requiere credencial educativa o colegiatura profesional verificada.'}
                    </p>
                    <Fallo de="email" />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-space-2xs">
                      <label className="font-label-md text-label-md text-on-surface" htmlFor="ac-password">
                        {esEstudiante ? 'Tu contraseña' : 'Contraseña institucional'}
                      </label>
                      {modo === 'login' && (
                        <A className="font-label-sm text-label-sm text-primary hover:underline" href="#/acceso">
                          {esEstudiante ? '¿Olvidaste tu contraseña?' : '¿Problemas de clave?'}
                        </A>
                      )}
                    </div>
                    <div className="relative flex items-center">
                      <Icono nombre={esEstudiante ? 'key' : 'lock'} className="absolute left-space-sm text-on-surface-variant text-[20px]" />
                      <input
                        className={CAMPO + ' pr-11' + anillo('password')}
                        id="ac-password" name="password"
                        type={verClave.password ? 'text' : 'password'}
                        autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
                        placeholder={modo === 'login' ? '••••••••' : 'Al menos 8 caracteres'}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => alternarClave('password')}
                        aria-label={verClave.password ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        className="absolute right-space-sm text-on-surface-variant hover:text-on-surface transition-colors"
                      >
                        <Icono nombre={verClave.password ? 'visibility_off' : 'visibility'} className="text-[20px]" />
                      </button>
                    </div>
                    <Fallo de="password" />
                  </div>

                  {/* Consentimiento — solo al crear cuenta */}
                  {modo === 'registro' && (
                    <div className="p-space-sm rounded-lg bg-surface-container">
                      <label className="flex items-start gap-space-sm cursor-pointer">
                        <input
                          type="checkbox" name="consentimiento"
                          className="mt-1 h-4 w-4 shrink-0 accent-primary"
                        />
                        <span className="font-body-sm text-body-sm text-on-surface-variant">
                          Entiendo que puedo <strong className="font-semibold text-on-surface">elegir y cambiar</strong> quién
                          de mi red recibe avisos, y que Lumys nunca comparte lo que escribo palabra por palabra.
                        </span>
                      </label>
                      <Fallo de="consentimiento" />
                    </div>
                  )}

                  {/* 2FA — informativo, igual que en el mockup */}
                  {!esEstudiante && modo === 'login' && (
                    <div className="p-space-sm rounded-lg bg-surface-container flex items-center justify-between gap-space-sm">
                      <div className="flex items-center gap-space-xs">
                        <Icono nombre="security" className="text-primary text-[22px]" />
                        <div>
                          <span className="font-label-md text-label-md font-semibold text-on-surface block">
                            Autenticación 2FA Activa
                          </span>
                          <span className="font-body-sm text-body-sm text-on-surface-variant">
                            Código temporal obligatorio para proteger expedientes
                          </span>
                        </div>
                      </div>
                      <Icono nombre="check_circle" className="text-secondary text-[20px]" />
                    </div>
                  )}

                  {/* Acceso por el aula — el mockup lo ofrece, pero no hay SSO detrás */}
                  {esEstudiante && modo === 'login' && (
                    <div className="pt-space-xs">
                      <div className="relative flex items-center justify-center my-space-xs">
                        <div className="w-full h-px bg-surface-variant" />
                        <span className="absolute bg-surface-container-lowest px-space-sm font-label-sm text-label-sm text-on-surface-variant">
                          O mediante tu aula
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => avisar('El acceso con la cuenta del colegio todavía no está habilitado.', { tipo: 'info' })}
                        className="w-full mt-space-xs py-space-sm px-space-md rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md flex items-center justify-center gap-space-sm transition-all"
                      >
                        <Icono nombre="school" className="text-[20px] text-secondary" />
                        <span>Entrar con cuenta de colegio (Google Classroom / Microsoft EDU)</span>
                      </button>
                    </div>
                  )}

                  <div className="pt-space-xs">
                    <button
                      type="submit"
                      disabled={ocupado}
                      className="w-full py-space-md px-space-lg rounded-full font-label-lg text-label-lg font-bold text-on-primary-container bg-gradient-to-r from-primary-container via-secondary-container to-primary-container shadow-md hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-space-xs disabled:opacity-60 disabled:hover:scale-100"
                    >
                      <span>{ocupado ? 'Un segundo…' : textoEnviar}</span>
                      <Icono nombre={ocupado ? 'hourglass_top' : 'arrow_forward'} className="text-[20px]" />
                    </button>
                  </div>
                </form>

                {/* Garantía */}
                <div className="mt-space-lg rounded-lg bg-surface-container-low p-space-md">
                  <div className="flex items-start gap-space-sm">
                    <div className="w-7 h-7 rounded-full bg-secondary-container flex items-center justify-center text-secondary shrink-0 mt-0.5">
                      <Icono nombre="verified" className="text-[18px]" />
                    </div>
                    <div>
                      <h3 className="font-label-md text-label-md font-bold text-on-surface">
                        Garantía de Cero Difusión Escolar
                      </h3>
                      <p className="font-body-sm text-body-sm text-on-surface-variant mt-space-2xs leading-relaxed">
                        Ninguna nota íntima o check-in de un estudiante es compartido con terceros.
                        Lumys es un facilitador de contención socioemocional y no emite diagnósticos
                        clínicos.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Recorrido de demostración — fuera del mockup, ver la cabecera */}
                <div className="mt-space-lg pt-space-md border-t border-outline-variant/20">
                  <div className="flex items-center gap-space-xs mb-space-sm">
                    <Icono nombre="play_circle" className="text-primary text-[18px]" />
                    <span className="font-label-md text-label-md font-semibold text-on-surface">
                      Recorrido de demostración
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-space-xs">
                    {PERFILES.map((p) => (
                      <button
                        key={p.perfil}
                        type="button"
                        onClick={() => entrarDemo(p.perfil)}
                        className="text-left p-space-sm rounded-lg bg-surface-container-low hover:bg-surface-container transition-all flex items-center gap-space-xs"
                      >
                        <div className={`w-8 h-8 rounded-full ${p.tonoIcono} flex items-center justify-center shrink-0`}>
                          <Icono nombre={p.icono} className="text-[18px]" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-label-sm text-label-sm font-bold text-on-surface block truncate">
                            {p.titulo}
                          </span>
                          <span className="font-body-sm text-[11px] text-on-surface-variant block truncate">
                            {p.demo}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* SOS y protocolo */}
              <div className="mt-space-lg flex flex-col sm:flex-row items-center justify-between gap-space-sm px-space-xs">
                <a
                  className="inline-flex items-center gap-space-xs font-label-md text-label-md text-error font-semibold hover:underline bg-error-container/40 px-space-md py-space-xs rounded-full transition-colors"
                  href="tel:133"
                >
                  <Icono nombre="emergency" className="text-[18px]" />
                  ¿Necesitas ayuda inmediata? Línea 133 · MIFAN
                </a>
                <div className="flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface-variant">
                  <Icono nombre="privacy_tip" className="text-[16px] text-tertiary" />
                  Protocolo Ley de Protección Juvenil
                </div>
              </div>
            </div>

            {/* ---------------- Pie con la mascota ---------------- */}
            <div className="relative z-10 mx-auto mt-space-xl max-w-3xl flex flex-col md:flex-row items-center justify-center gap-space-lg">
              <div className="relative flex items-center gap-space-md bg-surface-container-lowest/90 backdrop-blur-sm p-space-md rounded-xl shadow-md max-w-md">
                <div className="relative shrink-0">
                  {/* `esperanza` es de banda apoyo: la pantalla donde alguien
                      decide si confiar en la plataforma no es el lugar para una
                      mascota apagada. */}
                  <Lumy
                    emocion="esperanza"
                    ancho={96}
                    className="-rotate-3 hover:rotate-0 transition-transform duration-300"
                    etiqueta={null}
                  />
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-tertiary-container" />
                  </span>
                </div>
                <div className="flex flex-col">
                  <div className="inline-flex items-center gap-1 font-label-sm text-label-sm text-primary font-bold">
                    <span>LUMYS COMPANION</span>
                    <span className="text-tertiary">✨</span>
                  </div>
                  <p className="font-headline-sm text-headline-sm font-bold text-on-surface leading-tight mt-0.5">
                    «Nos alegra tenerte de vuelta ✨»
                  </p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                    Respira profundo. Tu ritmo es el correcto aquí.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-space-md p-space-md rounded-xl bg-surface-container-lowest/80 shadow-sm">
                <Isotipo tamano={64} className="opacity-90" />
                <div className="text-left">
                  <span className="font-label-md text-label-md font-bold text-on-surface block">
                    Red Conectada y Segura
                  </span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant block">
                    Sincronización ética de 4 esferas del ecosistema.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Acceso;
