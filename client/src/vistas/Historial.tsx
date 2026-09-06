/* ==========================================================================
   Lumys* — Huella emocional

   Todo el gráfico es ipsativo: la referencia es el promedio del propio
   estudiante, nunca un corte clínico poblacional.

   --------------------------------------------------------------------------
   SOBRE EL MARCADO

   Es la primera sección de `huella_emocional_constancia_juegos_de_calma`. Se
   portó su forma —la ola a siete columnas y el círculo de hábitos a cinco— con
   dos divergencias deliberadas del mockup:

   1. En el mockup la ola y el calendario cuentan lo mismo: días de sol, de
      recarga, reflexivos. Acá NO. La ola es el ICVE, o sea cómo pesó el día; el
      calendario es constancia, o sea si apareciste. Pintar el calendario según
      el ánimo haría que un día pesado se viera más flojo que uno bueno, y la
      cuadrícula estaría premiando sentirse bien — que es exactamente lo que la
      racha no debe hacer.

   2. La "Próxima Recompensa" del mockup desbloquea un sonido de ambiente que no
      existe. En su lugar va la siguiente insignia sin ganar, que sí sale de
      hechos reales (ver lib/metricas.ts).

   La ola tampoco trae la curva dibujada a mano del export: se genera con una
   spline sobre los puntajes que de verdad se guardaron.
   ========================================================================== */

import { useState } from 'react';

import { A } from '../componentes/A.tsx';
import { Cargador, Vacio } from '../componentes/comunes.tsx';
import { fechaLarga, haceCuanto } from '../lib/formato.ts';
import { useDatos } from '../lib/useDatos.ts';
import * as almacen from '../lib/almacen.ts';
import * as api from '../lib/api.ts';
import type { Animo, DiaConstancia, Entrada, Insignia, PuntoLinea } from '../lib/tipos.ts';

const RANGOS = [7, 14, 30] as const;
type Rango = (typeof RANGOS)[number];

type CheckinLocal = { fecha?: string; emocion?: Animo; texto_usuario?: string };

const CARA: Record<string, string> = { bien: '🙂', normal: '😐', pesado: '😮‍💨', nose: '🤷' };
const DIAS_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function Icono({ nombre, className = '' }: { nombre: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`} aria-hidden="true">{nombre}</span>;
}

/* --- Bandas del ICVE ------------------------------------------------------
 * Los mismos cortes que usa `avatar.service.js` en el servidor, para que la
 * lectura de la ola y el clima del inicio no puedan contradecirse. Recordar que
 * más alto es MÁS carga.
 * ------------------------------------------------------------------------- */

const BANDAS = [
  { hasta: 25, nombre: 'liviano', color: '#ffd77a', clase: 'bg-tertiary-fixed' },
  { hasta: 50, nombre: 'normal', color: '#baeaff', clase: 'bg-secondary-fixed' },
  { hasta: 75, nombre: 'cargado', color: '#bda4f3', clase: 'bg-primary-container' },
  { hasta: 100, nombre: 'pesado', color: '#68529a', clase: 'bg-primary' },
] as const;

const banda = (v: number) => BANDAS.find((b) => v <= b.hasta) ?? BANDAS[3];

export function Historial() {
  const [rango, setRango] = useState<Rango>(14);

  // El rango entra en las dependencias: las series salen del historial real, así
  // que cambiar de 7 a 30 días vuelve a pedirlo en vez de rellenar los días que
  // faltan. Antes se reconstruían con un seno sobre el nivel de constancia — el
  // gráfico de 30 días no mostraba ningún dato del estudiante.
  const { datos, cargando, error } = useDatos(
    () => Promise.all([api.gemelo(), api.entradas(), api.constancia(), api.serie(rango), api.insignias()]),
    [rango],
  );

  if (cargando) return <Cargador />;
  if (error || !datos) return <Vacio titulo="No pudimos abrir tu huella" detalle={error?.message} />;

  const [gemelo, entradas, constancia, serie, insignias] = datos;

  // Se muestran primero los check-ins hechos en esta sesión.
  const propios: Entrada[] = almacen.leer<CheckinLocal[]>('checkins', [])
    .filter((c) => c.texto_usuario)
    .map((c) => ({
      fecha: c.fecha ?? new Date().toISOString(),
      animo: c.emocion ?? 'normal',
      texto: c.texto_usuario ?? '',
      etiquetas: ['tuyo'],
    }));

  const lista = [...propios, ...entradas];

  return (
    <section className="w-full pt-space-lg max-w-[1200px] mx-auto px-margin-mobile md:px-margin-desktop flex flex-col gap-space-lg">

      {/* ================= Encabezado ================= */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
        <div className="space-y-space-2xs">
          <h1 className="font-headline-xl-mobile text-headline-xl-mobile md:font-headline-xl md:text-headline-xl text-on-surface">
            Tu huella emocional
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-[52ch]">
            Todo lo que ves acá se compara con <strong className="text-on-surface">vos mismo</strong>.
            No hay puntaje, no hay promedio del salón, no hay nota.
          </p>
        </div>

        <div
          className="flex items-center gap-space-2xs p-space-2xs bg-surface-container-low rounded-full shrink-0"
          role="group"
          aria-label="Rango de tiempo"
        >
          {RANGOS.map((d) => (
            <button
              key={d}
              className={`px-space-md py-space-xs rounded-full font-label-md text-label-md transition-all ${
                rango === d
                  ? 'bg-primary-container text-on-primary-container font-semibold shadow-[0_4px_16px_rgba(189,164,243,0.3)]'
                  : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`}
              type="button"
              aria-pressed={rango === d}
              onClick={() => setRango(d)}
            >
              {d} días
            </button>
          ))}
        </div>
      </header>

      {/* ================= Ola + círculo de hábitos ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">

        <article className="lg:col-span-7 bg-surface-container-lowest rounded-3xl p-space-lg md:p-space-xl shadow-[0_8px_24px_-4px_rgba(189,164,243,0.1)] flex flex-col gap-space-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-xs">
            <div>
              <h2 className="font-headline-md text-headline-md text-on-surface">Cómo se movió tu ánimo</h2>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Tu oleaje en los últimos {rango} días
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-space-xs font-label-sm text-label-sm text-on-surface-variant">
              {BANDAS.slice(0, 3).map((b) => (
                <span className="inline-flex items-center gap-1.5" key={b.nombre}>
                  <span className={`w-3 h-3 rounded-full ${b.clase}`} />
                  Día {b.nombre}
                </span>
              ))}
            </div>
          </div>

          <Ola datos={serie} promedio={gemelo.promedioPropio} />

          <LecturaDeLaOla datos={serie} promedio={gemelo.promedioPropio} titular={gemelo.titular} />
        </article>

        <article className="lg:col-span-5 bg-surface-container-lowest rounded-3xl p-space-lg md:p-space-xl shadow-[0_8px_24px_-4px_rgba(189,164,243,0.1)] flex flex-col justify-between gap-space-lg">
          <CirculoDeHabitos dias={constancia} racha={gemelo.racha} />
          <ProximaInsignia insignias={insignias} racha={gemelo.racha} />
        </article>
      </div>

      {/* ================= Contra tu propio promedio ================= */}
      {gemelo.ipsativa.length > 0 && (
        <article className="bg-surface-container-lowest rounded-3xl p-space-lg md:p-space-xl shadow-[0_8px_24px_-4px_rgba(189,164,243,0.1)]">
          <div className="mb-space-md">
            <h2 className="font-headline-md text-headline-md text-on-surface">Contra tu propio promedio</h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Qué se movió respecto a cómo venís normalmente vos.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-space-sm">
            {gemelo.ipsativa.map((item) => (
              <div
                key={item.etiqueta}
                className="p-space-md rounded-2xl bg-surface-container-low flex flex-col gap-space-2xs"
              >
                <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                  item.tendencia === 'sube' ? 'bg-secondary-fixed text-on-secondary-fixed'
                    : item.tendencia === 'baja' ? 'bg-primary-fixed text-on-primary-fixed'
                    : 'bg-surface-container-high text-on-surface-variant'
                }`}>
                  <Icono nombre={item.simbolo} className="text-[20px]" />
                </span>
                <p className="font-headline-sm text-headline-sm text-on-surface">{item.valor}</p>
                <p className="font-label-md text-label-md text-on-surface-variant">{item.etiqueta}</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">{item.delta}</p>
              </div>
            ))}
          </div>
        </article>
      )}

      {/* ================= Lo que escribiste ================= */}
      <article className="bg-surface-container-lowest rounded-3xl p-space-lg md:p-space-xl shadow-[0_8px_24px_-4px_rgba(189,164,243,0.1)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-xs mb-space-md">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface">Lo que escribiste</h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Solo vos ves esto. Ni el colegio ni tu familia lo leen.
            </p>
          </div>
          <span className="inline-flex items-center gap-space-2xs px-space-sm py-space-2xs rounded-full bg-secondary-container text-on-secondary-container font-label-md text-label-md shrink-0">
            <Icono nombre="lock" className="text-[16px]" /> Privado
          </span>
        </div>

        {lista.length === 0 ? (
          <Vacio
            titulo="Todavía no escribiste nada"
            detalle="Cuando quieras contar algo, va a quedar acá — solo para vos."
            emocion="esperanza"
          >
            <A
              className="mt-space-md inline-flex items-center gap-space-2xs px-space-md py-space-xs rounded-full bg-primary text-on-primary font-label-md text-label-md font-semibold"
              href="#/checkin"
            >
              Hacer mi check-in
            </A>
          </Vacio>
        ) : (
          <div className="flex flex-col gap-space-sm">
            {lista.map((e, i) => (
              <article
                key={`${e.fecha}-${i}`}
                className="p-space-md rounded-2xl bg-surface-container-low flex flex-col gap-space-xs"
              >
                <div className="flex items-center gap-space-sm">
                  <span className="w-10 h-10 rounded-full bg-surface-container-lowest flex items-center justify-center text-[20px] shrink-0">
                    {CARA[e.animo] ?? '·'}
                  </span>
                  <div className="min-w-0">
                    <p className="font-label-lg text-label-lg text-on-surface truncate">{fechaLarga(e.fecha)}</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">{haceCuanto(e.fecha)}</p>
                  </div>
                </div>
                <p className="font-body-md text-body-md text-on-surface leading-relaxed">{e.texto}</p>
                {(e.etiquetas ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-space-2xs">
                    {(e.etiquetas ?? []).map((t) => (
                      <span
                        key={t}
                        className="px-space-xs py-0.5 rounded-full bg-surface-container-high font-label-sm text-label-sm text-on-surface-variant"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}

/* --- La ola ------------------------------------------------------------------
 * El export traía la curva escrita a mano en el `d` del path. Acá se genera con
 * una spline de Catmull-Rom sobre los puntajes reales: pasa por todos los
 * puntos y suaviza los tramos intermedios, que es lo que hace que se lea como
 * una ola y no como un electrocardiograma.
 * --------------------------------------------------------------------------- */

const W = 600;
const H = 160;

function spline(puntos: { x: number; y: number }[]): string {
  if (!puntos.length) return '';
  const p = puntos;
  if (p.length === 1) return `M${p[0]!.x},${p[0]!.y}`;

  let d = `M${p[0]!.x},${p[0]!.y}`;
  for (let i = 0; i < p.length - 1; i += 1) {
    const anterior = p[i - 1] ?? p[i]!;
    const actual = p[i]!;
    const proximo = p[i + 1]!;
    const posterior = p[i + 2] ?? proximo;

    // Un sexto de la distancia entre los vecinos: es la tensión estándar de
    // Catmull-Rom, la que no genera lazos con puntos muy juntos.
    const c1x = actual.x + (proximo.x - anterior.x) / 6;
    const c1y = actual.y + (proximo.y - anterior.y) / 6;
    const c2x = proximo.x - (posterior.x - actual.x) / 6;
    const c2y = proximo.y - (posterior.y - actual.y) / 6;

    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${proximo.x.toFixed(1)},${proximo.y.toFixed(1)}`;
  }
  return d;
}

function Ola({ datos, promedio }: { datos: PuntoLinea[]; promedio: number }) {
  if (!datos.length) {
    return (
      <div className="w-full bg-surface-container-low rounded-2xl p-space-xl">
        <Vacio
          titulo="Todavía no hay registros en este rango"
          detalle="La ola aparece sola en cuanto tengas check-ins acá."
          emocion="esperanza"
        />
      </div>
    );
  }

  // La escala es fija 0-100 y no se ajusta al máximo de la muestra: si se
  // ajustara, una semana tranquila se vería idéntica a una semana durísima
  // porque el pico llenaría el gráfico igual en los dos casos.
  const x = (i: number) => (datos.length === 1 ? W / 2 : (i * W) / (datos.length - 1));
  const y = (v: number) => H - (v / 100) * H;

  const puntos = datos.map((d, i) => ({ x: x(i), y: y(d.valor) }));
  const linea = spline(puntos);
  const area = `${linea} L${W},${H} L0,${H} Z`;

  const etiquetas = datos.filter((_, i) => i % Math.ceil(datos.length / 7) === 0).slice(0, 7);

  return (
    <div className="w-full bg-surface-container-low rounded-2xl p-space-md flex flex-col gap-space-md">
      <div className="h-44 w-full relative">
        <svg
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Tu ánimo en los últimos ${datos.length} días con registro, comparado con tu propio promedio`}
        >
          <defs>
            <linearGradient id="olaLumys" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#bda4f3" stopOpacity="0.5" />
              <stop offset="50%" stopColor="#baeaff" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          <path d={area} fill="url(#olaLumys)" />

          {/* Tu propio promedio. Es la única referencia del gráfico. */}
          <line
            x1={0} y1={y(promedio)} x2={W} y2={y(promedio)}
            stroke="#7a7581" strokeDasharray="6 6" strokeWidth={1.5} vectorEffect="non-scaling-stroke"
          />

          <path
            d={linea}
            fill="none"
            stroke="#68529a"
            strokeLinecap="round"
            strokeWidth={3}
            vectorEffect="non-scaling-stroke"
          />

          {puntos.map((p, i) => {
            const punto = datos[i]!;
            const esHoy = i === datos.length - 1;
            return (
              <circle
                key={punto.fecha}
                cx={p.x}
                cy={p.y}
                r={esHoy ? 6 : 5}
                fill={banda(punto.valor).color}
                stroke={esHoy ? '#ffffff' : 'none'}
                strokeWidth={esHoy ? 2 : 0}
              >
                <title>{`${fechaLarga(punto.fecha)} · día ${banda(punto.valor).nombre}`}</title>
              </circle>
            );
          })}
        </svg>
      </div>

      <div className="flex justify-between font-label-sm text-label-sm text-on-surface-variant pt-space-xs">
        {etiquetas.map((d, i) => (
          <span key={d.fecha}>
            {i === etiquetas.length - 1 && d === datos[datos.length - 1]
              ? 'Hoy'
              : new Date(d.fecha).toLocaleDateString('es-NI', { day: 'numeric', month: 'short' })}
          </span>
        ))}
      </div>
    </div>
  );
}

/** La "lectura suave de Lumy" del mockup, con los conteos de verdad. */
function LecturaDeLaOla({
  datos, promedio, titular,
}: { datos: PuntoLinea[]; promedio: number; titular: string }) {
  if (!datos.length) return null;

  const livianos = datos.filter((d) => d.valor < promedio).length;
  const pesados = datos.length - livianos;

  return (
    <div className="flex items-center gap-space-md p-space-md rounded-2xl bg-secondary-container/30">
      <div className="w-10 h-10 rounded-full bg-secondary-fixed flex items-center justify-center text-on-secondary-fixed shrink-0">
        <Icono nombre="wb_twilight" className="text-[20px]" />
      </div>
      <p className="font-body-md text-body-md text-on-surface">
        <strong>Lectura de Lumy:</strong>{' '}
        {titular || 'Así viene tu propio patrón.'}{' '}
        De los {datos.length} días con registro, {livianos}{' '}
        {livianos === 1 ? 'estuvo' : 'estuvieron'} por debajo de tu promedio y {pesados} por encima.
      </p>
    </div>
  );
}

/* --- Círculo de hábitos ------------------------------------------------------
 * Mide APARECER. El color de cada casilla sale de la cobertura —cuánto del
 * check-in se llegó a cubrir— y nunca del ánimo: un día pesado se pinta igual
 * de fuerte que uno bueno, que es lo que impide que la racha premie fingirse
 * contento.
 * --------------------------------------------------------------------------- */

const TONO_POR_NIVEL: Record<number, string> = {
  0: 'bg-surface-container-low text-outline-variant',
  1: 'bg-secondary-fixed/40 text-on-secondary-fixed',
  2: 'bg-secondary-fixed/70 text-on-secondary-fixed',
  3: 'bg-primary-fixed text-on-primary-fixed',
  4: 'bg-primary-container text-on-primary-container',
};

function CirculoDeHabitos({ dias, racha }: { dias: DiaConstancia[]; racha: number }) {
  // La cuadrícula arranca en lunes: sin este relleno, el día 1 cae bajo la
  // columna equivocada y todo el mes queda corrido una casilla.
  const primero = dias[0];
  const huecos = primero ? (new Date(primero.fecha).getDay() + 6) % 7 : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-space-2xs">
        <h2 className="font-headline-md text-headline-md text-on-surface">Círculo de hábitos</h2>
        <span className="font-label-md text-label-md text-primary font-semibold">
          {racha} {racha === 1 ? 'día' : 'días'} seguidos
        </span>
      </div>
      <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-md">
        Cuenta que hayas aparecido, no cómo te sentiste. Un día pesado pinta igual que uno bueno.
      </p>

      <div className="grid grid-cols-7 gap-space-2xs text-center">
        {DIAS_SEMANA.map((d, i) => (
          <span key={`${d}-${i}`} className="font-label-sm text-label-sm text-outline">{d}</span>
        ))}

        {Array.from({ length: huecos }, (_, i) => <span key={`hueco-${i}`} aria-hidden="true" />)}

        {dias.map((d, i) => {
          const fecha = new Date(d.fecha);
          const esHoy = i === dias.length - 1;
          return (
            <div
              key={d.fecha}
              className={`h-10 rounded-xl flex items-center justify-center font-label-sm text-label-sm transition-transform hover:scale-105 ${
                TONO_POR_NIVEL[d.nivel] ?? TONO_POR_NIVEL[0]
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
    </div>
  );
}

/** La recompensa del mockup desbloqueaba un sonido que no existe. Esta sale de
 *  `metricas.insigniasDesde`, que resuelve cada insignia contra hechos. */
function ProximaInsignia({ insignias, racha }: { insignias: Insignia[]; racha: number }) {
  const ganadas = insignias.filter((i) => i.obtenida).length;
  const proxima = insignias.find((i) => !i.obtenida);

  if (!proxima) {
    return (
      <div className="bg-surface-container-low p-space-md rounded-2xl flex items-center gap-space-sm">
        <div className="w-11 h-11 rounded-full bg-tertiary-fixed-dim flex items-center justify-center text-on-tertiary-fixed shrink-0">
          <Icono nombre="military_tech" className="text-[22px]" />
        </div>
        <p className="font-body-md text-body-md text-on-surface">
          Las tenés todas. {racha} días seguidos, y contando.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-low p-space-md rounded-2xl flex items-center justify-between gap-space-sm">
      <div className="flex items-center gap-space-sm min-w-0">
        <div className="w-11 h-11 rounded-full bg-primary flex items-center justify-center text-on-primary shrink-0">
          <Icono nombre="lock_open" className="text-[22px]" />
        </div>
        <div className="min-w-0">
          <p className="font-label-lg text-label-lg text-on-surface leading-tight truncate">
            {proxima.nombre}
          </p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">{proxima.detalle}</p>
        </div>
      </div>
      <span className="font-headline-sm text-headline-sm text-primary shrink-0">
        {ganadas}/{insignias.length}
      </span>
    </div>
  );
}

export default Historial;
