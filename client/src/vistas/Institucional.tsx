/* ==========================================================================
   Lumys* — Panel institucional

   Solo agregados: nunca un caso, nunca un nombre. Es el panel que decide dónde
   se ponen los recursos, y para eso no hace falta saber de quién se trata.

   --------------------------------------------------------------------------
   SOBRE EL MARCADO

   Es `equipo_lumys_monitoreo_global_salud_del_ecosistema_escolar`, el "centro
   de comando": cabecera con orbes y tarjetas flotantes, rejilla de indicadores
   con barras, dinámica de estresores a dos tercios con el blindaje de identidad
   al lado, y la matriz de colegios en red abajo.

   Lo que NO se porta es su repertorio de cifras. El mockup llena cada barra y
   cada anillo con porcentajes inventados, y esta vista ya venía con los suyos
   —"81% de estudiantes confía en el sistema", "64% de adultos cambió su forma
   de explicar", "8 h protegidas", "86% de derivaciones confirmadas"—. Ninguno
   se mide en ningún lado. Todo lo que se pinta acá sale de `institucionalDesde`
   en lib/metricas.ts, que deriva de las alertas y del radar reales; lo que no
   se puede derivar se nombra sin número, porque este panel se usa para decidir
   y un dato inventado acá termina en un informe de dirección.
   ========================================================================== */

import { Barra, Cargador, Contador, Vacio } from '../componentes/comunes.tsx';
import { useDatos } from '../lib/useDatos.ts';
import * as api from '../lib/api.ts';

const BLINDAJE = [
  {
    simbolo: 'visibility_off',
    tono: 'bg-secondary-container/60 text-secondary',
    titulo: 'Nunca un nombre',
    texto: 'Este panel no recibe identidades. No hay pantalla que lleve de un agregado a una persona.',
  },
  {
    simbolo: 'groups',
    tono: 'bg-primary-container/40 text-primary',
    titulo: 'Umbral mínimo',
    texto: 'Un grupo con pocos registros no se promedia: con pocos miembros, la media los identifica.',
  },
  {
    simbolo: 'lock',
    tono: 'bg-tertiary-fixed/50 text-tertiary',
    titulo: 'Sin texto libre',
    texto: 'Lo que un estudiante escribe no sale de su cuenta. Ni acá, ni en el panel del orientador/a.',
  },
];

function Icono({ nombre, className = '' }: { nombre: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`} aria-hidden="true">{nombre}</span>;
}

export function Institucional() {
  const { datos, cargando, error } = useDatos(
    () => Promise.all([api.institucional(), api.comunitario()]),
    [],
  );

  if (cargando) return <Cargador />;
  if (error || !datos) return <Vacio titulo="No pudimos abrir el panel" detalle={error?.message} />;

  const [panel, comunidad] = datos;
  const totalNiveles = panel.niveles.reduce((s, n) => s + n.valor, 0);

  return (
    <section className="w-full pt-space-lg max-w-[1200px] mx-auto px-margin-mobile md:px-margin-desktop flex flex-col gap-space-lg">

      {/* ================= Cabecera ================= */}
      <header className="relative overflow-hidden rounded-3xl bg-surface-container-lowest p-space-lg md:p-space-xl shadow-[0_8px_24px_-4px_rgba(189,164,243,0.1)]">
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="absolute -right-16 -top-16 w-96 h-96 bg-primary-container/20 rounded-full blur-3xl" />
          <div className="absolute -left-12 -bottom-12 w-80 h-80 bg-secondary-container/30 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-space-xl">
          <div className="space-y-space-2xs max-w-[56ch]">
            <span className="inline-flex items-center gap-space-2xs px-space-sm py-1 rounded-full bg-tertiary-fixed/50 font-label-sm text-label-sm text-on-tertiary-fixed font-semibold">
              <Icono nombre="hub" className="text-[16px]" /> Solo datos agregados
            </span>
            <h1 className="font-headline-xl-mobile text-headline-xl-mobile md:font-headline-xl md:text-headline-xl text-on-surface">
              Panel de bienestar
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant">
              Métricas agregadas del centro,{' '}
              <strong className="text-on-surface">sin nombres y sin casos individuales</strong>. El
              colegio garantiza las condiciones; no opera el día a día.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-space-sm w-full lg:w-auto">
            {panel.kpis.slice(0, 4).map((k) => (
              <div
                key={k.etiqueta}
                className="bg-surface-container-lowest/90 backdrop-blur-md px-space-md py-space-sm rounded-2xl shadow-sm flex flex-col gap-space-2xs min-w-[150px]"
              >
                <span className="font-headline-md text-headline-md text-on-surface">
                  <Contador valor={k.valor} sufijo={k.sufijo ?? ''} />
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant leading-tight">
                  {k.etiqueta}
                </span>
                {/* El indicador respeta `tipo`: antes todos salían en verde, así
                    que un dato malo se presentaba con la misma cara que uno
                    bueno. */}
                <span className={`font-label-sm text-label-sm ${
                  k.tipo === 'down' ? 'text-error' : 'text-secondary'
                }`}>
                  {k.delta}
                </span>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ================= Niveles + blindaje ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-lg items-start">

        <article className="lg:col-span-2 bg-surface-container-lowest rounded-3xl p-space-lg md:p-space-xl shadow-[0_8px_24px_-4px_rgba(189,164,243,0.1)] flex flex-col gap-space-md">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface">
              Distribución por nivel de respuesta
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Avisar mucho para conversar, poco para derivar.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-space-lg items-center">
            <div className="md:col-span-2 flex flex-col items-center justify-center p-space-md bg-surface-container-low/50 rounded-2xl">
              <span className="font-headline-xl text-headline-xl text-on-surface">
                <Contador valor={totalNiveles} />
              </span>
              <span className="font-label-md text-label-md text-on-surface-variant text-center">
                señales en total
              </span>
              <span className="mt-space-2xs font-body-sm text-body-sm text-outline text-center">
                {totalNiveles === 0
                  ? 'Ninguna señal abierta ahora mismo.'
                  : `${Math.round((panel.niveles[0]!.valor / totalNiveles) * 100)}% se resuelve conversando`}
              </span>
            </div>

            <div className="md:col-span-3 flex flex-col gap-space-sm">
              {panel.niveles.map((n, i) => (
                <div key={n.etiqueta} className="p-space-sm rounded-2xl bg-surface-container-low flex flex-col">
                  <div className="flex justify-between items-center font-label-md text-label-md mb-1">
                    <span className="text-on-surface">{n.etiqueta}</span>
                    <span className="text-on-surface-variant">{n.valor}</span>
                  </div>
                  <div className="w-full bg-surface-container-highest rounded-full h-1.5 overflow-hidden">
                    <Barra
                      valor={n.valor}
                      max={n.max}
                      className={`h-1.5 rounded-full ${
                        i === 2 ? 'bg-error' : i === 1 ? 'bg-primary-container' : 'bg-secondary'
                      }`}
                      titulo={n.etiqueta}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-space-md rounded-2xl bg-tertiary-fixed/30 flex items-start gap-space-md">
            <span className="w-9 h-9 rounded-full bg-tertiary-fixed flex items-center justify-center text-on-tertiary-fixed shrink-0 mt-0.5">
              <Icono nombre="lightbulb" className="text-[20px]" />
            </span>
            <p className="font-body-sm text-body-sm text-on-surface">
              Que la mayoría esté en Nivel 1 es la señal de que el sistema funciona bien: significa
              que se está conversando temprano, cuando equivocarse todavía sale barato.
            </p>
          </div>
        </article>

        <article className="bg-surface-container-lowest rounded-3xl p-space-lg md:p-space-xl shadow-[0_8px_24px_-4px_rgba(189,164,243,0.1)] flex flex-col gap-space-md">
          <h2 className="font-headline-md text-headline-md text-on-surface">
            Blindaje de identidad
          </h2>

          <ul className="flex flex-col gap-space-sm">
            {BLINDAJE.map((b) => (
              <li key={b.titulo} className="flex items-start gap-space-sm">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${b.tono}`}>
                  <Icono nombre={b.simbolo} className="text-[18px]" />
                </span>
                <div>
                  <p className="font-label-lg text-label-lg text-on-surface">{b.titulo}</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">{b.texto}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-auto p-space-md rounded-2xl bg-surface-container-low text-center">
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Si el adolescente se siente vigilado, deja de responder con honestidad y el sistema
              empieza a medir humo.
            </p>
          </div>
        </article>
      </div>

      {/* ================= Participación por grado ================= */}
      <article className="bg-surface-container-lowest rounded-3xl p-space-lg md:p-space-xl shadow-[0_8px_24px_-4px_rgba(189,164,243,0.1)] flex flex-col gap-space-md">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface">Participación por grado</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Qué proporción de cada grado registra casi todos los días.
          </p>
        </div>

        {/* Sin grado ni sección en el esquema, este corte no se puede calcular.
            Decirlo es más útil que cinco barras inventadas que alguien podría
            llevarse a una reunión. */}
        {panel.grados.length ? (
          <div className="flex flex-col gap-space-sm">
            {panel.grados.map((g) => (
              <div key={g.etiqueta} className="p-space-sm rounded-2xl bg-surface-container-low flex flex-col">
                <div className="flex justify-between items-center font-label-md text-label-md mb-1">
                  <span className="text-on-surface">{g.etiqueta}</span>
                  <span className="text-on-surface-variant">{g.participacion}%</span>
                </div>
                <div className="w-full bg-surface-container-highest rounded-full h-1.5 overflow-hidden">
                  <Barra valor={g.participacion} className="h-1.5 rounded-full bg-secondary" titulo={g.etiqueta} />
                </div>
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

      {/* ================= Matriz de centros ================= */}
      <article className="bg-surface-container-lowest rounded-3xl p-space-lg md:p-space-xl shadow-[0_8px_24px_-4px_rgba(189,164,243,0.1)] flex flex-col gap-space-md">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface">Centros en red</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Cada institución agrega localmente. Solo se sincronizan parámetros, nunca registros
            crudos — y el nombre de los demás centros no se revela.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-space-md">
          {comunidad.federado.map((f) => (
            <div
              key={f.centro}
              className="bg-surface-container-low/60 hover:bg-surface-container-low transition-all rounded-2xl p-space-lg flex flex-col gap-space-sm"
            >
              <div className="flex items-start justify-between gap-space-sm">
                <p className="font-label-lg text-label-lg text-on-surface">{f.centro}</p>
                <Icono nombre="school" className="text-[20px] text-outline shrink-0" />
              </div>

              <div className="p-space-sm rounded-xl bg-surface-container-lowest flex flex-col gap-1">
                <span className="font-label-sm text-label-sm text-on-surface-variant">Qué comparte</span>
                <span className="font-body-sm text-body-sm text-on-surface">{f.icve}</span>
              </div>

              <div className="flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant">
                <span>Registros locales</span>
                <span className="font-semibold text-on-surface">{f.registros}</span>
              </div>
            </div>
          ))}
        </div>
      </article>

      {/* ================= Cierre + lo que falta medir ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
        <article className="lg:col-span-7 bg-surface-container-lowest rounded-3xl p-space-lg md:p-space-xl shadow-[0_8px_24px_-4px_rgba(189,164,243,0.1)] flex flex-col gap-space-md">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface">
              Cómo sabemos si Lumys<span className="align-super text-[0.6em]">*</span> funciona
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              No se mide por cuántas alertas genera — eso solo indica que el sistema habla mucho.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm">
            {panel.cierre.map((c) => (
              <div key={c.etiqueta} className="p-space-md rounded-2xl bg-surface-container-low flex flex-col gap-space-2xs">
                <span className="font-headline-md text-headline-md text-on-surface">
                  <Contador valor={c.valor} />
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">{c.etiqueta}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="lg:col-span-5 p-space-lg md:p-space-xl rounded-3xl bg-surface-container-low flex items-start gap-space-sm">
          <Icono nombre="pending_actions" className="text-[22px] text-on-surface-variant shrink-0 mt-0.5" />
          <div>
            <p className="font-label-lg text-label-lg text-on-surface mb-space-2xs">
              Lo que todavía no se mide
            </p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              El tiempo de la señal a la conversación, la confirmación de las derivaciones a 7 y 30
              días y la percepción de confianza de los estudiantes son los indicadores que definen
              si esto sirve. Hoy ninguno está instrumentado, así que no se muestran: un número
              inventado en este panel es peor que un hueco, porque se usa para decidir.
            </p>
          </div>
        </article>
      </div>

      {/* ================= El rol del colegio ================= */}
      <article className="rounded-3xl bg-on-background p-space-lg md:p-space-xl flex flex-col gap-space-md">
        <h2 className="font-headline-md text-headline-md text-inverse-on-surface">El rol del colegio</h2>
        <p className="font-body-md text-body-md text-inverse-on-surface/75 max-w-[70ch]">
          El colegio no opera Lumys<span className="align-super text-[0.6em]">*</span>: lo sostiene.
          Su responsabilidad formal es garantizar horas protegidas para el orientador o la
          orientadora y nombrar un responsable por caso.
        </p>

        <ul className="grid grid-cols-1 md:grid-cols-2 gap-space-sm">
          {[
            { simbolo: 'schedule', texto: 'Horas protegidas de orientación', si: true },
            { simbolo: 'badge', texto: 'Un responsable nombrado por caso', si: true },
            { simbolo: 'campaign', texto: 'Charla de bienvenida y aval institucional', si: true },
            { simbolo: 'block', texto: 'Nunca: acceso a casos individuales ni a nombres', si: false },
          ].map((r) => (
            <li key={r.texto} className="flex items-start gap-space-sm p-space-md rounded-2xl bg-inverse-on-surface/10">
              <Icono
                nombre={r.simbolo}
                className={`text-[20px] shrink-0 ${r.si ? 'text-secondary-fixed-dim' : 'text-error-container'}`}
              />
              <span className="font-body-md text-body-md text-inverse-on-surface/85">{r.texto}</span>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}

export default Institucional;
