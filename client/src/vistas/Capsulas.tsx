/* ===========================================================================
 * Lumys* — cápsulas semanales
 * ---------------------------------------------------------------------------
 * De las 21 pantallas de Stitch, ninguna es esta: `lumys_santuario_seguro...`
 * parecía serlo por el nombre pero es otra landing. Así que el marcado no se
 * porta de ningún export — se escribe con el mismo sistema de tokens que el
 * resto (Material 3 + Plus Jakarta Sans) para que no desentone.
 *
 * El video todavía no existe. La rejilla no finge que sí: cada tarjeta dice
 * cuánto dura y abre un aviso honesto, y por eso tampoco suma a la insignia de
 * cápsulas (ver componentes/Capsulas.tsx). Mostrar un botón de reproducir sobre
 * algo que no reproduce nada es la clase de detalle que hace que un adolescente
 * deje de creerle a la app entera.
 * =========================================================================== */

import { RejillaCapsulas } from '../componentes/Capsulas.tsx';
import { Cargador, Vacio } from '../componentes/comunes.tsx';
import { useDatos } from '../lib/useDatos.ts';
import * as api from '../lib/api.ts';

function Icono({ nombre, className = '' }: { nombre: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`} aria-hidden="true">{nombre}</span>;
}

const PROXIMAS = [
  {
    simbolo: 'forum',
    tono: 'bg-primary-fixed text-on-primary-fixed',
    titulo: 'Cómo decir que no estás bien',
    texto: 'Frases concretas para empezar una conversación difícil sin sentirte raro.',
  },
  {
    simbolo: 'diversity_3',
    tono: 'bg-secondary-fixed text-on-secondary-fixed',
    titulo: 'Cuando un amigo te cuenta algo pesado',
    texto: 'Escuchar sin quedarte con la responsabilidad del riesgo del otro.',
  },
  {
    simbolo: 'bedtime',
    tono: 'bg-tertiary-fixed text-on-tertiary-fixed',
    titulo: 'Dormir cambia el día entero',
    texto: 'Lo que cambia en la cabeza cuando dormís dos horas menos de lo normal.',
  },
];

export function Capsulas() {
  const { datos, cargando, error } = useDatos(() => api.capsulas(), []);

  if (cargando) return <Cargador />;
  if (error || !datos) return <Vacio titulo="No pudimos traer las cápsulas" detalle={error?.message} />;

  return (
    <section className="w-full pt-space-lg max-w-[1200px] mx-auto px-margin-mobile md:px-margin-desktop flex flex-col gap-space-lg">

      <header className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
        <div className="space-y-space-2xs">
          <h1 className="font-headline-xl-mobile text-headline-xl-mobile md:font-headline-xl md:text-headline-xl text-on-surface">
            Cápsulas
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-[56ch]">
            Cosas cortas que sirven, en el formato con el que ya convivís todos los días.
            Sin sermón y sin lenguaje de clínica.
          </p>
        </div>
        <span className="inline-flex items-center gap-space-2xs px-space-md py-space-xs rounded-full bg-secondary-container text-on-secondary-container font-label-md text-label-md font-semibold shrink-0">
          <Icono nombre="collections_bookmark" className="text-[18px]" /> Nuevas cada semana
        </span>
      </header>

      <article className="bg-surface-container-lowest rounded-3xl p-space-lg md:p-space-xl shadow-[0_8px_24px_-4px_rgba(189,164,243,0.1)] flex flex-col gap-space-md">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface">Para ver de una</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">Menos de un minuto cada una.</p>
        </div>
        <RejillaCapsulas capsulas={datos} />
      </article>

      <article className="flex flex-col gap-space-md">
        <h2 className="font-headline-md text-headline-md text-on-surface">En camino</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
          {PROXIMAS.map((c) => (
            <div
              key={c.titulo}
              className="bg-surface-container-lowest rounded-3xl p-space-lg shadow-[0_8px_24px_-4px_rgba(189,164,243,0.1)] flex flex-col gap-space-xs"
            >
              <span className={`w-11 h-11 rounded-lg flex items-center justify-center ${c.tono}`}>
                <Icono nombre={c.simbolo} className="text-[22px]" />
              </span>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">{c.titulo}</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">{c.texto}</p>
            </div>
          ))}
        </div>
      </article>

      <div className="p-space-lg rounded-3xl bg-secondary-container/40 flex items-start gap-space-md">
        <Icono nombre="shield_person" className="text-[24px] text-on-secondary-container shrink-0 mt-0.5" />
        <p className="font-body-md text-body-md text-on-secondary-container">
          <strong>Por qué acá no se habla de “salud mental”.</strong> Se habla de bienestar y de
          acompañar. Para muchas familias nicaragüenses la psicología sigue siendo un tema tabú — si
          Lumys<span className="align-super text-[0.7em]">*</span> se presenta como un producto
          psicológico, pierde a la mitad de su público antes de empezar.
        </p>
      </div>
    </section>
  );
}

export default Capsulas;
