/* ==========================================================================
   Lumys* — Panel del orientador/a · casos activos

   Cada tarjeta describe conducta observable + ventana temporal, comparada con
   la propia línea base del estudiante. Nunca un diagnóstico, nunca un puntaje
   suelto, nunca el texto libre que el estudiante escribió.

   --------------------------------------------------------------------------
   SOBRE EL MARCADO

   Es `orientadora_casos_activos_seguimiento_tico`. Se portó su tablero a ocho
   columnas con el riel ético a cuatro, y su tarjeta de caso con la franja de
   color al costado. Cuatro apartes del mockup:

   1. Su barra de navegación flotante no se porta: ya existe una, la de la
      cáscara, y dos docks compitiendo es peor que ninguno.
   2. Sus métricas de cabecera son cifras escritas a mano —"3 días de la señal
      a la conversación, antes eran 11"—. Se calculan de las alertas reales, y
      las que no se pueden calcular no se muestran. Ese mismo "3 días" estaba
      también en el código que había acá.
   3. Muestra "Tutor asignado: Prof. Marcos Véliz" y el grado en cada tarjeta.
      El servidor manda un alias y no expone ni grado ni sección, así que se
      pinta lo que hay.
   4. Su buscador filtra por código de estudiante. Se conserva, pero sobre el
      alias, que es lo único identificable que este panel recibe.

   La ficha lateral ahora muestra la explicabilidad que el backend ya mandaba
   y el cliente descartaba: qué componente se movió, cuánto respecto de lo
   habitual de esa persona, y la paráfrasis del análisis.
   ========================================================================== */

import { useEffect, useMemo, useState } from 'react';

import { Cargador, Contador, Vacio } from '../componentes/comunes.tsx';
import { useAvisos } from '../lib/avisos.tsx';
import { NIVELES, capitalizar, fechaLarga, haceCuanto } from '../lib/formato.ts';
import { useDatos } from '../lib/useDatos.ts';
import * as api from '../lib/api.ts';
import type { Caso, EstadoCaso } from '../lib/tipos.ts';

const ESTADOS: { estado: EstadoCaso | 'todos'; texto: string }[] = [
  { estado: 'todos', texto: 'Todos' },
  { estado: 'abierto', texto: 'Señal nueva' },
  { estado: 'seguimiento', texto: 'En seguimiento' },
  { estado: 'derivado', texto: 'Derivado' },
  { estado: 'cerrado', texto: 'Cerrado con alta' },
];

const NIVEL_TONO: Record<number, { franja: string; pastilla: string }> = {
  1: { franja: 'bg-secondary-container', pastilla: 'bg-secondary-container text-on-secondary-container' },
  2: { franja: 'bg-primary-container', pastilla: 'bg-primary-container text-on-primary-container' },
  3: { franja: 'bg-error', pastilla: 'bg-error-container text-on-error-container' },
};

const ESTADO_TEXTO: Record<EstadoCaso, string> = {
  abierto: 'Señal nueva',
  seguimiento: 'En acompañamiento',
  derivado: 'Derivado',
  cerrado: 'Cerrado con alta',
};

const COMPONENTE_TEXTO: Record<string, string> = {
  animo: 'Ánimo',
  sueno: 'Sueño',
  energia: 'Energía',
  vinculo: 'Tiempo con gente',
  concentracion: 'Concentración',
};

function Icono({ nombre, className = '' }: { nombre: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`} aria-hidden="true">{nombre}</span>;
}

export function Orientador() {
  const [estado, setEstado] = useState<EstadoCaso | 'todos'>('todos');
  const [nivel, setNivel] = useState<'todos' | '1' | '2' | '3'>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [ficha, setFicha] = useState<Caso | null>(null);

  const { datos: casos, cargando, error } = useDatos(() => api.casos(), []);

  useEffect(() => {
    if (!ficha) return;
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') setFicha(null); };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [ficha]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (casos ?? []).filter((c) =>
      (estado === 'todos' || c.estado === estado)
      && (nivel === 'todos' || String(c.nivel) === nivel)
      && (!q || c.alias.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)));
  }, [casos, estado, nivel, busqueda]);

  if (cargando) return <Cargador />;
  if (error || !casos) return <Vacio titulo="No pudimos abrir los casos" detalle={error?.message} />;

  const activos = casos.filter((c) => c.estado !== 'cerrado');
  const sinAtender = casos.filter((c) => c.estado === 'abierto');

  // La espera más larga sin conversación. Es el indicador que de verdad importa
  // acá: no cuántas señales hay, sino cuánto tarda una en llegar a una persona.
  const esperas = sinAtender.map((c) => Math.floor((Date.now() - +new Date(c.desde)) / 86400000));
  const esperaMax = esperas.length ? Math.max(...esperas) : 0;

  const KPIS = [
    { valor: activos.length, etiqueta: 'casos activos', pie: `${casos.length} en total`, alerta: false },
    { valor: sinAtender.length, etiqueta: 'sin atender todavía', pie: 'ninguna conversación aún', alerta: sinAtender.length > 0 },
    { valor: esperaMax, etiqueta: 'días de la señal más antigua', pie: 'sin conversación', alerta: esperaMax > 7 },
    { valor: casos.filter((c) => c.nivel === 1).length, etiqueta: 'en Nivel 1 · conversar', pie: 'el nivel más barato de equivocarse', alerta: false },
  ];

  return (
    <>
      <section className="w-full pt-space-lg max-w-[1200px] mx-auto px-margin-mobile md:px-margin-desktop flex flex-col gap-space-lg">

        {/* ================= Encabezado ================= */}
        <header className="space-y-space-2xs">
          <h1 className="font-headline-xl-mobile text-headline-xl-mobile md:font-headline-xl md:text-headline-xl text-on-surface">
            Casos activos
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-[62ch]">
            Señales, no diagnósticos. Cada ficha describe <strong className="text-on-surface">qué
            cambió y en cuánto tiempo</strong>, comparado con la propia línea base de esa persona.
          </p>
        </header>

        <div className="flex items-start gap-space-sm p-space-md rounded-2xl bg-secondary-container/40">
          <Icono nombre="shield_person" className="text-[22px] text-on-secondary-container shrink-0 mt-0.5" />
          <p className="font-body-sm text-body-sm text-on-secondary-container">
            <strong>Este panel no muestra lo que el estudiante escribió.</strong> Recibe la
            paráfrasis del análisis y los componentes que se movieron. Si necesitás más, se
            conversa con la persona — no se consulta el registro.
          </p>
        </div>

        {/* ================= Indicadores ================= */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-space-md">
          {KPIS.map((k) => (
            <div
              key={k.etiqueta}
              className={`p-space-lg rounded-2xl flex flex-col gap-space-2xs ${
                k.alerta ? 'bg-error-container/50' : 'bg-surface-container-lowest shadow-[0_8px_24px_-4px_rgba(189,164,243,0.1)]'
              }`}
            >
              <span className={`font-headline-lg text-headline-lg ${k.alerta ? 'text-on-error-container' : 'text-on-surface'}`}>
                <Contador valor={k.valor} />
              </span>
              <span className={`font-label-md text-label-md ${k.alerta ? 'text-on-error-container' : 'text-on-surface-variant'}`}>
                {k.etiqueta}
              </span>
              <span className={`font-body-sm text-body-sm ${k.alerta ? 'text-on-error-container/80' : 'text-outline'}`}>
                {k.pie}
              </span>
            </div>
          ))}
        </div>

        {/* ================= Filtros ================= */}
        <div className="flex flex-col gap-space-sm">
          <div className="relative">
            <Icono nombre="search" className="absolute left-space-md top-1/2 -translate-y-1/2 text-[20px] text-outline" />
            <input
              className="w-full py-space-sm pl-11 pr-space-md bg-surface-container-low rounded-full font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:shadow-[0_0_0_2px_rgba(189,164,243,0.4)] transition-all"
              type="search"
              placeholder="Buscar por alias o código de caso…"
              aria-label="Buscar caso"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-space-2xs" role="group" aria-label="Filtrar por estado">
            {ESTADOS.map((e) => (
              <Pastilla
                key={e.estado}
                activa={estado === e.estado}
                onClick={() => setEstado(e.estado)}
                texto={e.texto}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-space-2xs" role="group" aria-label="Filtrar por nivel">
            <span className="font-label-sm text-label-sm text-outline mr-space-2xs">Nivel:</span>
            {(['todos', '1', '2', '3'] as const).map((n) => (
              <Pastilla
                key={n}
                activa={nivel === n}
                onClick={() => setNivel(n)}
                texto={n === 'todos' ? 'Todos' : `${n} · ${NIVELES[Number(n) as 1 | 2 | 3].nombre}`}
              />
            ))}
          </div>
        </div>

        {/* ================= Tablero + riel ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">

          <div className="lg:col-span-8 flex flex-col gap-space-md">
            {visibles.length === 0 ? (
              <div className="p-space-xl rounded-3xl bg-surface-container-lowest">
                <Vacio
                  titulo="Ningún caso con esos filtros"
                  detalle="Probá quitando el filtro de nivel o de estado."
                />
              </div>
            ) : visibles.map((caso) => (
              <TarjetaCaso key={caso.id} caso={caso} onAbrir={() => setFicha(caso)} />
            ))}
          </div>

          <aside className="lg:col-span-4 flex flex-col gap-space-md w-full">
            <article className="p-space-lg rounded-3xl bg-error-container/50 flex flex-col gap-space-sm">
              <div className="flex items-center gap-space-xs">
                <span className="w-10 h-10 rounded-lg bg-error text-on-error flex items-center justify-center shrink-0">
                  <Icono nombre="emergency" className="text-[22px]" />
                </span>
                <h2 className="font-headline-sm text-headline-sm text-on-error-container">
                  Derivación mayor
                </h2>
              </div>
              <p className="font-body-sm text-body-sm text-on-error-container">
                Ante riesgo inmediato no se espera a que la señal se sostenga. Se llama y se
                registra después.
              </p>
              <a
                className="inline-flex items-center justify-center gap-space-2xs w-full py-space-sm rounded-full bg-error text-on-error font-label-lg text-label-lg font-semibold hover:brightness-95 transition-all"
                href="tel:133"
              >
                <Icono nombre="call" className="text-[20px]" /> MIFAN · 133
              </a>
              <a
                className="inline-flex items-center justify-center gap-space-2xs w-full py-space-sm rounded-full bg-surface-container-lowest text-on-surface font-label-lg text-label-lg font-semibold hover:bg-surface-container transition-all"
                href="tel:118"
              >
                <Icono nombre="local_police" className="text-[20px]" /> Policía Nacional · 118
              </a>
            </article>

            <article className="p-space-lg rounded-3xl bg-surface-container-lowest shadow-[0_8px_24px_-4px_rgba(189,164,243,0.1)] flex flex-col gap-space-sm">
              <div className="flex items-center gap-space-xs">
                <span className="w-10 h-10 rounded-lg bg-primary-fixed text-on-primary-fixed flex items-center justify-center shrink-0">
                  <Icono nombre="rule" className="text-[22px]" />
                </span>
                <h2 className="font-headline-sm text-headline-sm text-on-surface">
                  Cómo se calcula una señal
                </h2>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Nunca es una caja negra: se cruzan el autorreporte ipsativo —comparado con el
                promedio propio de las últimas semanas, no con un corte poblacional— y los
                patrones de conducta observable.
              </p>

              <ul className="flex flex-col gap-space-2xs">
                {[
                  { n: 1, texto: 'Ambos componentes cambian de forma sostenida 2–3 semanas.' },
                  { n: 2, texto: 'Ambos coinciden con intensidad marcada, o uno es muy fuerte.' },
                  { n: 3, texto: 'Lenguaje de riesgo explícito: inmediato, sin esperar semanas.' },
                ].map((r) => (
                  <li key={r.n} className="flex items-start gap-space-xs p-space-sm rounded-xl bg-surface-container-low">
                    <span className={`px-space-xs py-0.5 rounded-full font-label-sm text-label-sm font-bold shrink-0 ${
                      NIVEL_TONO[r.n]!.pastilla
                    }`}>
                      N{r.n}
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">{r.texto}</span>
                  </li>
                ))}
              </ul>

              <p className="font-body-sm text-body-sm text-outline">
                Ningún componente activa una señal por sí solo con una sola medición.
              </p>
            </article>
          </aside>
        </div>
      </section>

      <FichaCaso caso={ficha} onCerrar={() => setFicha(null)} />
    </>
  );
}

/* -------------------------------------------------------------------------- */

function Pastilla({ activa, texto, onClick }: { activa: boolean; texto: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={activa}
      onClick={onClick}
      className={`px-space-md py-space-xs rounded-full font-label-md text-label-md transition-all ${
        activa
          ? 'bg-primary-container text-on-primary-container font-semibold shadow-[0_4px_16px_rgba(189,164,243,0.3)]'
          : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
      }`}
    >
      {texto}
    </button>
  );
}

function TarjetaCaso({ caso, onAbrir }: { caso: Caso; onAbrir: () => void }) {
  const tono = NIVEL_TONO[caso.nivel] ?? NIVEL_TONO[1]!;

  return (
    <article className="relative overflow-hidden rounded-3xl bg-surface-container-lowest p-space-lg shadow-[0_8px_24px_-4px_rgba(189,164,243,0.12)] hover:shadow-[0_12px_32px_-6px_rgba(28,45,90,0.14)] transition-all flex flex-col gap-space-md">
      <span className={`absolute top-0 left-0 bottom-0 w-1.5 ${tono.franja}`} aria-hidden="true" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm pl-space-xs">
        <div className="flex items-center gap-space-sm min-w-0">
          <span className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed font-label-lg text-label-lg font-bold shrink-0">
            {caso.id.slice(-3)}
          </span>
          <div className="min-w-0">
            <p className="font-label-lg text-label-lg text-on-surface truncate">{caso.alias}</p>
            <p className="font-body-sm text-body-sm text-outline truncate">
              {caso.id} · abierto {haceCuanto(caso.desde)}
              {caso.responsable ? ` · ${caso.responsable}` : ' · sin responsable asignado'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-space-xs self-start sm:self-center shrink-0">
          <span className={`px-space-sm py-1 rounded-full font-label-sm text-label-sm font-semibold flex items-center gap-1 ${tono.pastilla}`}>
            {caso.estado !== 'cerrado' && (
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" aria-hidden="true" />
            )}
            {ESTADO_TEXTO[caso.estado]}
          </span>
          <span className="px-space-xs py-1 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm">
            Nivel {caso.nivel}
          </span>
        </div>
      </div>

      <div className="bg-surface-container-low/70 p-space-md rounded-2xl flex flex-col gap-space-xs ml-space-xs">
        <div className="flex items-center gap-space-xs">
          <Icono nombre="query_stats" className="text-[18px] text-primary shrink-0" />
          <span className="font-label-md text-label-md text-on-surface font-semibold">
            Qué se observó
          </span>
        </div>
        <ul className="flex flex-wrap gap-space-2xs">
          {caso.señales.map((s) => (
            <li
              key={s}
              className="px-space-sm py-space-2xs rounded-full bg-surface-container-lowest font-body-sm text-body-sm text-on-surface-variant"
            >
              {s}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-xs font-body-sm text-body-sm text-outline pl-space-xs">
        <div className="flex items-center gap-space-sm flex-wrap">
          <span className="flex items-center gap-1">
            <Icono nombre="history" className="text-[16px] text-secondary" />
            {caso.ultimoContacto
              ? <>Último contacto: <strong>{haceCuanto(caso.ultimoContacto)}</strong></>
              : <>Sin contacto todavía</>}
          </span>
          <span className="flex items-center gap-1">
            <Icono nombre="calendar_month" className="text-[16px] text-tertiary" />
            Sostenido <strong>{caso.semanas} semanas</strong>
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-space-xs pl-space-xs">
        <button
          className="px-space-md py-space-xs rounded-full bg-primary text-on-primary hover:bg-on-primary-container font-label-md text-label-md font-semibold transition-colors flex items-center gap-1"
          type="button"
          onClick={onAbrir}
        >
          <Icono nombre="visibility" className="text-[16px]" />
          Ver ficha de seguimiento
        </button>
      </div>
    </article>
  );
}

/* --- Ficha lateral del caso ------------------------------------------------
 * Era un `bootstrap.Offcanvas`. Acá es un panel propio con los tokens de
 * Stitch: entra desde la derecha en escritorio y ocupa la pantalla en teléfono.
 * ------------------------------------------------------------------------- */

function FichaCaso({ caso, onCerrar }: { caso: Caso | null; onCerrar: () => void }) {
  const avisar = useAvisos();
  const abierto = caso !== null;

  return (
    /* El cajón se anima entrando desde la derecha, o sea que estando cerrado
       vive desplazado un 100% fuera de la pantalla. Un elemento así ensancha el
       documento y mete barra de desplazamiento horizontal en el teléfono —
       `visibility: hidden` no lo arregla porque sigue ocupando maquetación—.
       Este contenedor fijo con `overflow-hidden` lo recorta sin perder la
       animación, y deja pasar los clics cuando está cerrado. */
    <div
      className={`stitch fixed inset-0 z-[60] overflow-hidden ${abierto ? '' : 'pointer-events-none'}`}
    >
      <div
        className={`absolute inset-0 bg-on-background/40 backdrop-blur-sm transition-opacity ${
          abierto ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onCerrar}
        aria-hidden="true"
      />

      <div
        className={`absolute top-0 right-0 bottom-0 w-full sm:w-[460px] bg-background shadow-[0_0_48px_rgba(28,45,90,0.2)] flex flex-col transition-transform duration-300 pointer-events-auto ${
          abierto ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal={abierto || undefined}
        aria-hidden={!abierto}
        aria-labelledby="ficha-caso-titulo"
      >
        <header className="flex items-start justify-between gap-space-sm p-space-lg bg-surface-container-low">
          <div className="min-w-0">
            <h2 className="font-headline-md text-headline-md text-on-surface truncate" id="ficha-caso-titulo">
              {caso?.alias ?? 'Caso'}
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {caso ? `${caso.id} · abierto ${haceCuanto(caso.desde)}` : ''}
            </p>
          </div>
          <button
            className="w-10 h-10 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface flex items-center justify-center shrink-0"
            type="button"
            aria-label="Cerrar"
            onClick={onCerrar}
          >
            <Icono nombre="close" className="text-[20px]" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-space-lg flex flex-col gap-space-md">
          {caso && (
            <>
              <div className="flex flex-wrap gap-space-2xs">
                <span className={`px-space-sm py-space-2xs rounded-full font-label-md text-label-md font-semibold ${
                  (NIVEL_TONO[caso.nivel] ?? NIVEL_TONO[1]!).pastilla
                }`}>
                  Nivel {caso.nivel} · {NIVELES[caso.nivel].nombre}
                </span>
                <span className="px-space-sm py-space-2xs rounded-full bg-surface-container font-label-md text-label-md text-on-surface-variant">
                  {caso.semanas} semanas sostenidas
                </span>
                {caso.riesgoExplicito && (
                  <span className="px-space-sm py-space-2xs rounded-full bg-error text-on-error font-label-md text-label-md font-semibold">
                    Riesgo explícito
                  </span>
                )}
              </div>

              {/* La traducción es el producto: conducta observable, ventana
                  temporal y un "no sabemos la causa" explícito. */}
              <div className="p-space-md rounded-2xl bg-secondary-container/40">
                <p className="flex items-center gap-space-2xs font-label-lg text-label-lg text-on-secondary-container mb-space-2xs">
                  <Icono nombre="translate" className="text-[18px]" /> Lo que se le dice a un adulto
                </p>
                <p className="font-body-sm text-body-sm text-on-secondary-container">
                  “En las últimas {caso.semanas} semanas {caso.señales[0]?.toLowerCase()}. No
                  sabemos la causa. Sería bueno conversar esta semana, sin presionarlo.”
                </p>
              </div>

              {/* Explicabilidad: el porqué, no solo el cuánto. Solo aparece con
                  datos reales — el respaldo de demostración no trae estos
                  números y no se inventan para llenar el hueco. */}
              {caso.componentes && caso.componentes.length > 0 && (
                <section>
                  <p className="font-label-md text-label-md uppercase tracking-wider text-primary font-semibold mb-space-xs">
                    Qué se movió, y cuánto
                  </p>
                  <ul className="flex flex-col gap-space-2xs">
                    {caso.componentes.map((c) => (
                      <li
                        key={c.componente}
                        className="flex items-center justify-between gap-space-sm p-space-sm rounded-xl bg-surface-container-low"
                      >
                        <span className="font-label-md text-label-md text-on-surface">
                          {COMPONENTE_TEXTO[c.componente] ?? c.componente}
                        </span>
                        <span className="flex items-center gap-space-2xs font-body-sm text-body-sm text-on-surface-variant">
                          <span>{c.habitual} → {c.hoy}</span>
                          <Icono
                            nombre={c.direccion === 'empeora' ? 'trending_down' : 'trending_up'}
                            className={`text-[16px] ${c.direccion === 'empeora' ? 'text-error' : 'text-secondary'}`}
                          />
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-space-2xs font-body-sm text-body-sm text-outline">
                    Escala de 1 a 5, donde 5 es la mejor situación. Se compara contra lo habitual
                    de esta persona, nunca contra el resto.
                  </p>
                </section>
              )}

              {caso.nota && (
                <div className="p-space-md rounded-2xl bg-surface-container-low">
                  <p className="font-label-lg text-label-lg text-on-surface mb-space-2xs">
                    Nota del análisis
                  </p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">{caso.nota}</p>
                  <p className="mt-space-2xs font-body-sm text-body-sm text-outline">
                    Es una paráfrasis, nunca una cita de lo que escribió.
                  </p>
                </div>
              )}

              <section>
                <p className="font-label-md text-label-md uppercase tracking-wider text-primary font-semibold mb-space-xs">
                  Conducta observable
                </p>
                <div className="flex flex-wrap gap-space-2xs">
                  {caso.señales.map((se) => (
                    <span
                      key={se}
                      className="px-space-sm py-space-2xs rounded-full bg-surface-container-low font-body-sm text-body-sm text-on-surface-variant"
                    >
                      {se}
                    </span>
                  ))}
                </div>
              </section>

              <section>
                <p className="font-label-md text-label-md uppercase tracking-wider text-primary font-semibold mb-space-xs">
                  Historia del caso
                </p>
                <ol className="flex flex-col gap-space-2xs">
                  {caso.linea.map((h) => (
                    <li
                      key={h.t + h.texto}
                      className={`p-space-sm rounded-xl border-l-4 ${
                        h.tipo === 'alerta'
                          ? 'border-error bg-error-container/30'
                          : h.tipo === 'accion'
                            ? 'border-secondary bg-secondary-container/25'
                            : 'border-outline-variant bg-surface-container-low'
                      }`}
                    >
                      <p className="font-label-sm text-label-sm text-outline">
                        {capitalizar(haceCuanto(h.t))} · {fechaLarga(h.t)}
                      </p>
                      <p className="font-body-md text-body-md text-on-surface">{h.texto}</p>
                    </li>
                  ))}
                </ol>
              </section>

              <div className="flex flex-col gap-space-2xs">
                <button
                  className="w-full py-space-sm rounded-full bg-primary text-on-primary font-label-lg text-label-lg font-semibold hover:bg-on-primary-container transition-all flex items-center justify-center gap-space-2xs"
                  type="button"
                  onClick={() => avisar('Conversación registrada. El caso sigue abierto.', { tipo: 'ok' })}
                >
                  <Icono nombre="forum" className="text-[20px]" /> Registrar conversación
                </button>
                <button
                  className="w-full py-space-sm rounded-full bg-surface-container text-on-surface font-label-lg text-label-lg font-semibold hover:bg-surface-container-high transition-all flex items-center justify-center gap-space-2xs"
                  type="button"
                  onClick={() => avisar('Enviado al psicólogo para revisión.', { tipo: 'info' })}
                >
                  <Icono nombre="shield_person" className="text-[20px] " /> Pedir revisión
                </button>
                <button
                  className="w-full py-space-sm rounded-full bg-surface-container text-on-surface font-label-lg text-label-lg font-semibold hover:bg-surface-container-high transition-all flex items-center justify-center gap-space-2xs"
                  type="button"
                  onClick={() => avisar('Caso cerrado con alta explícita.', { tipo: 'logro' })}
                >
                  <Icono nombre="task_alt" className="text-[20px]" /> Cerrar con alta
                </button>
              </div>

              <p className="font-body-sm text-body-sm text-outline text-center">
                Este panel nunca muestra el texto libre del estudiante.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Orientador;
