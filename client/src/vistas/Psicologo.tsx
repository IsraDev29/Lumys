/* ==========================================================================
   Lumys* — Supervisión clínica

   El psicólogo no toma el caso: decide junto al orientador/a si se sostiene el
   nivel o baja. Registrar el criterio es lo que devuelve la decisión a quien
   está acompañando al estudiante.

   --------------------------------------------------------------------------
   SOBRE EL MARCADO

   Es `psic_logo_fichas_cl_nicas_acompa_amiento_individual`: métricas arriba,
   expedientes a siete columnas y bitácora cronológica al costado. Tres apartes:

   1. El mockup llama "expediente clínico" y "paciente" a lo que acá es una
      consulta de supervisión sobre una señal. Cambiarle el nombre no es
      cosmético: Lumys no diagnostica y no tiene pacientes, y un rótulo clínico
      en pantalla invita a usar la herramienta para algo que no puede sostener.
   2. Anuncia "Registro Clínico Cifrado". No hay cifrado de registros; se
      rotula como lo que es.
   3. Sus cifras de cabecera están escritas a mano, igual que las que había en
      esta vista —"14 casos activos", "86% de derivaciones confirmadas", barras
      de confirmación al 92%, 79% y 14%—. Ninguna se mide. Se sustituyen por
      las que salen de las alertas reales, y lo que no se puede calcular se
      dice en vez de rellenarse.
   ========================================================================== */

import { useMemo, useState } from 'react';

import { Cargador, Contador, Vacio } from '../componentes/comunes.tsx';
import { Lumy } from '../lumy/Lumy.tsx';
import { useAvisos } from '../lib/avisos.tsx';
import { NIVELES, capitalizar, fechaLarga, haceCuanto } from '../lib/formato.ts';
import { useDatos } from '../lib/useDatos.ts';
import * as api from '../lib/api.ts';

const NIVEL_TONO: Record<number, string> = {
  1: 'bg-secondary-container text-on-secondary-container',
  2: 'bg-primary-container text-on-primary-container',
  3: 'bg-error-container text-on-error-container',
};

const COMPONENTE_TEXTO: Record<string, string> = {
  animo: 'Ánimo',
  sueno: 'Sueño',
  energia: 'Energía',
  vinculo: 'Tiempo con gente',
  concentracion: 'Concentración',
};

const CRITERIOS = [
  {
    simbolo: 'trending_down',
    titulo: 'Bajar de nivel',
    texto: 'Si el cambio no se sostiene, el caso baja. No todo bajón necesita seguimiento.',
  },
  {
    simbolo: 'task_alt',
    titulo: 'Dar de alta',
    texto: 'El objetivo es que el adolescente deje de necesitar el sistema, no que se quede dentro.',
  },
  {
    simbolo: 'warning',
    titulo: 'Evaluar al receptor',
    texto: 'Si la familia es fuente potencial de daño, se escala a la línea 133 sin insistir con ella.',
  },
];

function Icono({ nombre, className = '' }: { nombre: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`} aria-hidden="true">{nombre}</span>;
}

export function Psicologo() {
  const avisar = useAvisos();
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [soloNivel3, setSoloNivel3] = useState(false);

  const { datos, cargando, error } = useDatos(
    () => Promise.all([api.supervision(), api.casos()]),
    [],
  );

  const [pendientes, casos] = datos ?? [[], []];

  // La consulta activa se resuelve durante el render y no en un estado propio:
  // así no hace falta un efecto que la sincronice cuando los datos llegan
  // después del primer pintado, ni una comprobación de que el id guardado
  // siga existiendo tras cambiar de filtro.
  const cola = useMemo(
    () => (soloNivel3
      ? pendientes.filter((p) => casos.find((c) => c.id === p.caso)?.nivel === 3)
      : pendientes),
    [pendientes, casos, soloNivel3],
  );
  const activa = cola.find((p) => p.caso === seleccionado) ?? cola[0] ?? null;

  if (cargando) return <Cargador />;
  if (error || !datos) return <Vacio titulo="No pudimos abrir la supervisión" detalle={error?.message} />;

  const casoDe = (id: string) => casos.find((c) => c.id === id) ?? null;
  const casoActivo = activa ? casoDe(activa.caso) : null;

  const KPIS = [
    { valor: pendientes.length, etiqueta: 'esperando tu criterio', alerta: pendientes.length > 0 },
    { valor: casos.filter((c) => c.nivel === 3).length, etiqueta: 'señales de nivel 3', alerta: casos.some((c) => c.nivel === 3) },
    { valor: casos.filter((c) => c.estado === 'derivado').length, etiqueta: 'casos derivados fuera', alerta: false },
    { valor: casos.filter((c) => !c.responsable).length, etiqueta: 'sin responsable asignado', alerta: casos.some((c) => !c.responsable) },
  ];

  return (
    <section className="w-full pt-space-lg max-w-[1200px] mx-auto px-margin-mobile md:px-margin-desktop flex flex-col gap-space-lg">

      {/* ================= Encabezado ================= */}
      <header className="space-y-space-2xs">
        <h1 className="font-headline-xl-mobile text-headline-xl-mobile md:font-headline-xl md:text-headline-xl text-on-surface">
          Supervisión
        </h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant max-w-[62ch]">
          Tu rol es <strong className="text-on-surface">decidir junto al orientador/a</strong> los
          casos difíciles y validar cuándo un caso debe derivarse fuera. No operás el día a día.
        </p>
      </header>

      <div className="flex items-start gap-space-sm p-space-md rounded-2xl bg-error-container/40">
        <Icono nombre="gavel" className="text-[22px] text-on-error-container shrink-0 mt-0.5" />
        <p className="font-body-sm text-body-sm text-on-error-container">
          <strong>Esto no es un expediente clínico.</strong> Lumys no diagnostica y no tiene
          pacientes: lo que ves es una consulta de supervisión sobre una señal, con la conducta
          observable que la originó. Un diagnóstico se hace en consulta, con la persona delante.
        </p>
      </div>

      {/* ================= Indicadores ================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-space-md">
        {KPIS.map((k) => (
          <div
            key={k.etiqueta}
            className={`p-space-lg rounded-2xl flex flex-col gap-space-2xs ${
              k.alerta
                ? 'bg-error-container/50'
                : 'bg-surface-container-lowest shadow-[0_8px_24px_-4px_rgba(189,164,243,0.1)]'
            }`}
          >
            <span className={`font-headline-lg text-headline-lg ${k.alerta ? 'text-on-error-container' : 'text-on-surface'}`}>
              <Contador valor={k.valor} />
            </span>
            <span className={`font-label-md text-label-md ${k.alerta ? 'text-on-error-container' : 'text-on-surface-variant'}`}>
              {k.etiqueta}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-space-2xs" role="group" aria-label="Filtrar la cola">
        {[
          { valor: false, texto: 'Toda la cola', activo: 'bg-primary-container text-on-primary-container' },
          { valor: true, texto: 'Solo nivel 3', activo: 'bg-error-container text-on-error-container' },
        ].map((f) => (
          <button
            key={f.texto}
            type="button"
            aria-pressed={soloNivel3 === f.valor}
            onClick={() => setSoloNivel3(f.valor)}
            className={`px-space-md py-space-xs rounded-full font-label-md text-label-md transition-all ${
              soloNivel3 === f.valor
                ? `${f.activo} font-semibold shadow-[0_4px_16px_rgba(189,164,243,0.3)]`
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
            }`}
          >
            {f.texto}
          </button>
        ))}
      </div>

      {/* ================= Cola + bitácora ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">

        <div className="lg:col-span-7 flex flex-col gap-space-md">
          <h2 className="font-headline-md text-headline-md text-on-surface">
            Consultas del orientador/a
          </h2>

          {cola.length === 0 ? (
            <div className="p-space-xl rounded-3xl bg-surface-container-lowest">
              <Vacio
                titulo="Nada esperando tu criterio"
                detalle="Cuando el orientador o la orientadora necesite una segunda mirada, aparece acá."
                emocion="serenidad"
              />
            </div>
          ) : cola.map((p) => {
            const caso = casoDe(p.caso);
            const elegida = activa?.caso === p.caso;
            return (
              <button
                key={p.caso}
                type="button"
                onClick={() => setSeleccionado(p.caso)}
                aria-pressed={elegida}
                className={`text-left rounded-3xl p-space-lg bg-surface-container-lowest transition-all flex flex-col gap-space-sm ${
                  elegida
                    ? 'shadow-[0_12px_32px_-6px_rgba(28,45,90,0.16)] ring-2 ring-primary'
                    : 'shadow-[0_8px_24px_-4px_rgba(189,164,243,0.12)] hover:shadow-md'
                }`}
              >
                <div className="flex items-center gap-space-sm">
                  <span className="w-10 h-10 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center font-label-lg text-label-lg font-bold shrink-0">
                    {p.caso.slice(-3)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-label-lg text-label-lg text-on-surface truncate">
                      {caso?.alias ?? p.caso}
                    </p>
                    <p className="font-body-sm text-body-sm text-outline truncate">
                      {p.caso} · esperando desde {haceCuanto(p.desde)}
                    </p>
                  </div>
                  {caso && (
                    <span className={`px-space-sm py-space-2xs rounded-full font-label-sm text-label-sm font-semibold shrink-0 ${
                      NIVEL_TONO[caso.nivel] ?? NIVEL_TONO[1]!
                    }`}>
                      Nivel {caso.nivel}
                    </span>
                  )}
                </div>

                <p className="font-body-md text-body-md text-on-surface p-space-sm rounded-xl bg-surface-container-low">
                  {p.pregunta}
                </p>

                <div className="flex flex-wrap gap-space-2xs">
                  {(caso?.señales ?? []).map((se) => (
                    <span
                      key={se}
                      className="px-space-sm py-space-2xs rounded-full bg-surface-container font-body-sm text-body-sm text-on-surface-variant"
                    >
                      {se}
                    </span>
                  ))}
                </div>

                <p className="font-body-sm text-body-sm text-outline">Consulta de {p.orientador}</p>
              </button>
            );
          })}

          <article className="bg-surface-container-lowest rounded-3xl p-space-lg shadow-[0_8px_24px_-4px_rgba(189,164,243,0.1)] flex flex-col gap-space-md">
            <div>
              <h2 className="font-headline-md text-headline-md text-on-surface">
                Sostener al orientador/a
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant">
                El riesgo de intervenir de más se vigila igual que el de intervenir de menos.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm">
              {CRITERIOS.map((c) => (
                <div key={c.titulo} className="p-space-md rounded-2xl bg-surface-container-low flex flex-col gap-space-2xs">
                  <span className="w-9 h-9 rounded-lg bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center">
                    <Icono nombre={c.simbolo} className="text-[20px]" />
                  </span>
                  <p className="font-label-lg text-label-lg text-on-surface">{c.titulo}</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">{c.texto}</p>
                </div>
              ))}
            </div>
          </article>
        </div>

        {/* --- Bitácora del caso elegido --- */}
        <aside className="lg:col-span-5 flex flex-col gap-space-md w-full">
          {activa && casoActivo ? (
            <article className="bg-surface-container-lowest rounded-3xl p-space-lg shadow-[0_8px_24px_-4px_rgba(189,164,243,0.1)] flex flex-col gap-space-md">
              <div>
                <h2 className="font-headline-md text-headline-md text-on-surface">{casoActivo.alias}</h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  {casoActivo.id} · Nivel {casoActivo.nivel} · {NIVELES[casoActivo.nivel].nombre}
                  {' · '}{casoActivo.semanas} semanas sostenidas
                </p>
              </div>

              {/* Solo con datos reales: el respaldo de demostración no trae
                  estos números y no se inventan para llenar el hueco. */}
              {casoActivo.componentes && casoActivo.componentes.length > 0 && (
                <section>
                  <p className="font-label-md text-label-md uppercase tracking-wider text-primary font-semibold mb-space-xs">
                    Qué se movió
                  </p>
                  <ul className="flex flex-col gap-space-2xs">
                    {casoActivo.componentes.map((c) => (
                      <li
                        key={c.componente}
                        className="flex items-center justify-between gap-space-sm p-space-sm rounded-xl bg-surface-container-low font-body-sm text-body-sm"
                      >
                        <span className="text-on-surface">
                          {COMPONENTE_TEXTO[c.componente] ?? c.componente}
                        </span>
                        <span className="flex items-center gap-space-2xs text-on-surface-variant">
                          {c.habitual} → {c.hoy}
                          <Icono
                            nombre={c.direccion === 'empeora' ? 'trending_down' : 'trending_up'}
                            className={`text-[16px] ${c.direccion === 'empeora' ? 'text-error' : 'text-secondary'}`}
                          />
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section>
                <p className="font-label-md text-label-md uppercase tracking-wider text-primary font-semibold mb-space-xs">
                  Cronología
                </p>
                <ol className="flex flex-col gap-space-2xs">
                  {casoActivo.linea.map((h) => (
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
                  onClick={() => avisar('Criterio registrado. Vuelve a quien está acompañando.', { tipo: 'ok' })}
                >
                  <Icono nombre="how_to_reg" className="text-[20px]" /> Registrar criterio
                </button>
                <button
                  className="w-full py-space-sm rounded-full bg-surface-container text-on-surface font-label-lg text-label-lg font-semibold hover:bg-surface-container-high transition-all flex items-center justify-center gap-space-2xs"
                  type="button"
                  onClick={() => avisar('Pauta no diagnóstica generada para el tutor de aula.', { tipo: 'info' })}
                >
                  <Icono nombre="description" className="text-[20px]" /> Pauta para el tutor
                </button>
              </div>
            </article>
          ) : (
            <div className="p-space-xl rounded-3xl bg-surface-container-lowest">
              <Vacio titulo="Elegí una consulta" detalle="La bitácora del caso aparece acá." />
            </div>
          )}

          <article className="bg-primary-fixed/40 rounded-3xl p-space-lg flex items-start gap-space-md">
            <Lumy emocion="serenidad" ancho={72} etiqueta={null} />
            <div>
              <p className="font-label-lg text-label-lg text-on-surface mb-space-2xs">
                Tablero de discordancia
              </p>
              <p className="font-body-sm text-body-sm text-on-surface">
                Cuando el autorreporte del adolescente y lo que percibe el entorno no coinciden, se
                muestra como <strong>pregunta</strong> y nunca como veredicto: “reporta más
                dificultad de la que el entorno percibe. Es frecuente y no significa exageración.”
              </p>
            </div>
          </article>

          {/* Lo que el mockup —y esta vista— presentaban como medido y no lo
              está. Un porcentaje de confirmación inventado en la pantalla del
              psicólogo es de lo más caro que puede tener este producto. */}
          <div className="p-space-lg rounded-3xl bg-surface-container-low flex items-start gap-space-sm">
            <Icono nombre="pending_actions" className="text-[22px] text-on-surface-variant shrink-0 mt-0.5" />
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              <strong className="text-on-surface">Cierre del círculo, todavía sin instrumentar.</strong>{' '}
              Confirmar a los 7 y a los 30 días que la atención derivada de verdad ocurrió es el
              indicador que dice si esto sirve. Hoy no se registra, así que no se muestra ningún
              porcentaje. Si nadie confirma, la derivación no se da por hecha: se persigue.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

export default Psicologo;
