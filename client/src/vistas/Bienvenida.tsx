/* ===========================================================================
 * Lumys* — portada pública
 * ---------------------------------------------------------------------------
 * Portada de `landing_page_oficial_nica_lumys`. El marcado sigue clase por
 * clase al export de Stitch; lo que cambia es lo que un mockup estático no
 * puede resolver:
 *
 *   · Las imágenes venían de URLs `aida-public` de Google —el isotipo, el
 *     logotipo y la miniatura de Lumy—. Se sustituyen por <Isotipo>, <Logotipo>
 *     y <Lumy>, que son la identidad 2026 de verdad y no dependen de un CDN
 *     ajeno que puede caducar.
 *   · Los `href="#"` con `data-path="acceso-y-registro"` pasan a ser enlaces
 *     reales del enrutador.
 *   · El revelado al hacer scroll, el ciclo de respiración y la sombra de la
 *     cabecera son estado de React; en el export eran un <script> suelto.
 * =========================================================================== */

import { useEffect, useState } from 'react';

import { A } from '../componentes/A.tsx';
import { Isotipo, Logotipo } from '../componentes/Identidad.tsx';
import { Lumy } from '../lumy/Lumy.tsx';
import { escalon, prefiereMenosMovimiento, useRevelar } from '../lib/movimiento.ts';

/* --------------------------------------------------------------------------
 * Piezas que se repiten
 * ------------------------------------------------------------------------ */

/** Los iconos de Stitch son ligaduras de Material Symbols: el nombre va como
 *  texto dentro del <span>, no como atributo. */
function Icono({ nombre, className = '' }: { nombre: string; className?: string }) {
  return (
    <span className={`material-symbols-outlined ${className}`} aria-hidden="true">
      {nombre}
    </span>
  );
}

function Vineta({ texto, color = 'text-secondary' }: { texto: string; color?: string }) {
  return (
    <div className="flex items-center gap-space-xs">
      <Icono nombre="check_circle" className={`${color} text-[20px]`} />
      <span>{texto}</span>
    </div>
  );
}

function ItemRol({ texto }: { texto: string }) {
  return (
    <li className="flex items-start gap-space-xs">
      <Icono nombre="check" className="text-secondary text-[16px]" />
      <span>{texto}</span>
    </li>
  );
}

type PropsRol = {
  icono: string;
  /** Clases del cuadrado del icono: fondo y color de trazo. */
  tono: string;
  etiqueta: string;
  tonoEtiqueta: string;
  titulo: string;
  resumen: string;
  puntos: string[];
  pie: string;
  iconoPie: string;
  tonoPie: string;
  indice: number;
};

function TarjetaRol({
  icono, tono, etiqueta, tonoEtiqueta, titulo, resumen, puntos, pie, iconoPie, tonoPie, indice,
}: PropsRol) {
  return (
    <div
      className="lm-revelar bg-surface-container-lowest p-space-lg rounded-3xl border border-outline-variant/15 shadow-[0_8px_24px_-4px_rgba(28,45,90,0.05)] flex flex-col justify-between hover:-translate-y-1 transition-all duration-300"
      style={escalon(indice)}
    >
      <div>
        <div className={`w-12 h-12 rounded-2xl ${tono} flex items-center justify-center mb-space-md`}>
          <Icono nombre={icono} className="text-[24px]" />
        </div>
        <span className={`inline-block px-space-xs py-1 rounded-full ${tonoEtiqueta} font-label-sm text-[11px] font-bold mb-space-xs`}>
          {etiqueta}
        </span>
        <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold mb-space-xs">{titulo}</h3>
        <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed mb-space-md">{resumen}</p>
        <ul className="space-y-space-xs font-body-sm text-[12px] text-on-surface-variant">
          {puntos.map((p) => <ItemRol key={p} texto={p} />)}
        </ul>
      </div>
      <div className={`mt-space-lg pt-space-sm border-t border-outline-variant/15 text-label-sm font-label-sm ${tonoPie} font-bold flex items-center gap-1`}>
        <span>{pie}</span>
        <Icono nombre={iconoPie} className="text-[14px]" />
      </div>
    </div>
  );
}

function Estrellas() {
  return (
    <div className="flex items-center gap-space-2xs text-[#775a03] mb-space-sm" role="img" aria-label="Cinco de cinco estrellas">
      {Array.from({ length: 5 }, (_, i) => <Icono key={i} nombre="star" className="text-[18px]" />)}
    </div>
  );
}

type PropsTestimonio = {
  cita: string;
  inicial: string;
  tonoInicial: string;
  nombre: string;
  rol: string;
  indice: number;
};

function Testimonio({ cita, inicial, tonoInicial, nombre, rol, indice }: PropsTestimonio) {
  return (
    <figure
      className="lm-revelar bg-surface-container-lowest p-space-lg rounded-3xl border border-outline-variant/15 shadow-sm flex flex-col justify-between m-0"
      style={escalon(indice)}
    >
      <div>
        <Estrellas />
        <blockquote className="font-body-md text-body-md text-on-surface mb-space-md italic leading-relaxed m-0">
          {cita}
        </blockquote>
      </div>
      <figcaption className="flex items-center gap-space-sm pt-space-sm border-t border-outline-variant/10">
        <div className={`w-10 h-10 rounded-full ${tonoInicial} flex items-center justify-center font-bold`} aria-hidden="true">
          {inicial}
        </div>
        <div>
          <div className="font-label-md text-label-md text-on-surface font-bold">{nombre}</div>
          <div className="font-body-sm text-[11px] text-on-surface-variant">{rol}</div>
        </div>
      </figcaption>
    </figure>
  );
}

function PilarManifiesto({
  icono, titulo, tono, children,
}: { icono: string; titulo: string; tono: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-container-lowest/5 p-space-md rounded-2xl backdrop-blur-sm border border-white/10">
      <div className={`flex items-center gap-space-xs ${tono} mb-space-2xs font-headline-sm text-headline-sm font-bold`}>
        <Icono nombre={icono} className="text-[22px]" />
        <span>{titulo}</span>
      </div>
      <p className="font-body-md text-body-md text-surface-container">{children}</p>
    </div>
  );
}

/* --------------------------------------------------------------------------
 * Vista
 * ------------------------------------------------------------------------ */

export function Bienvenida() {
  const refRevelado = useRevelar<HTMLElement>();

  /* La cabecera del mockup lleva `transition-all` pero nada que la dispare.
     Acá gana una sombra al despegarse del borde superior, que es lo que ese
     `transition-all` estaba esperando. */
  const [desplazada, setDesplazada] = useState(false);
  useEffect(() => {
    const alDesplazar = () => setDesplazada(window.scrollY > 8);
    alDesplazar();
    window.addEventListener('scroll', alDesplazar, { passive: true });
    return () => window.removeEventListener('scroll', alDesplazar);
  }, []);

  /* Ciclo de respiración de la tarjeta de calma: cuatro segundos por fase, que
     es el 4-4-4 que anuncia la propia tarjeta. */
  const [inhala, setInhala] = useState(true);
  useEffect(() => {
    if (prefiereMenosMovimiento()) return;
    const reloj = setInterval(() => setInhala((v) => !v), 4000);
    return () => clearInterval(reloj);
  }, []);

  return (
    <div className="stitch stitch-landing bg-background font-body-md text-on-surface antialiased selection:bg-brand-violet/40 selection:text-on-primary-container min-h-screen flex flex-col">

      {/* ================= Cabecera ================= */}
      <header
        className={`fixed top-0 w-full z-50 bg-surface/85 backdrop-blur-xl border-b border-outline-variant/15 transition-all ${
          desplazada ? 'shadow-[0_4px_20px_-8px_rgba(4,24,69,0.18)]' : ''
        }`}
      >
        <div className="h-20 max-w-[1200px] mx-auto px-margin-mobile md:px-margin-desktop flex items-center justify-between gap-space-sm">
          <A className="flex items-center gap-space-sm group" href="#/bienvenida" aria-label="Lumys, inicio">
            <div className="relative flex items-center justify-center">
              <Isotipo tamano={40} className="transition-transform duration-300 group-hover:scale-105" />
            </div>
            <div className="h-7 w-[1px] bg-outline-variant/30 hidden sm:block" />
            <Logotipo tamano={26} />
          </A>

          <div className="flex items-center gap-space-xs sm:gap-space-sm">
            <A
              className="px-space-md sm:px-space-lg py-2 rounded-full text-on-surface hover:text-primary hover:bg-surface-container transition-all font-label-md text-label-md font-semibold"
              href="#/acceso"
            >
              Ingresar
            </A>
            <A
              className="px-space-md sm:px-space-lg py-2 rounded-full bg-brand-violet hover:bg-[#a98eed] text-on-primary-container font-label-md text-label-md font-bold shadow-[0_4px_16px_rgba(189,164,243,0.35)] transition-all hover:scale-[1.02] active:scale-[0.98]"
              href="#/acceso"
            >
              Registrarse
            </A>
          </div>
        </div>
      </header>

      {/* ================= Contenido ================= */}
      <main
        ref={refRevelado}
        id="lm-view"
        className="w-full pt-28 pb-20 flex-1 max-w-[1200px] mx-auto px-margin-mobile md:px-margin-desktop"
      >
        <div className="flex flex-col w-full">

          {/* ---------------- Portada ---------------- */}
          <section className="relative w-full overflow-hidden rounded-3xl bg-gradient-to-br from-surface-container-lowest via-surface-container-low to-[#aee0f6]/15 p-space-lg md:p-space-2xl border border-outline-variant/10 shadow-[0_20px_60px_-15px_rgba(189,164,243,0.12)] mb-space-3xl">
            {/* Orbes de fondo */}
            <div className="absolute -top-24 -left-20 w-80 h-80 rounded-full bg-brand-violet/20 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 right-6 w-[22rem] h-[22rem] rounded-full bg-brand-yellow/25 blur-3xl pointer-events-none" />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl items-center relative z-10">
              {/* Columna de texto */}
              <div className="lg:col-span-7 flex flex-col items-start text-left">
                <div className="inline-flex items-center gap-space-xs px-space-md py-1.5 rounded-full bg-surface-container-lowest border border-brand-violet/30 text-on-surface mb-space-md shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-secondary-sky animate-pulse" />
                  <span className="font-label-sm text-label-sm font-semibold tracking-wide text-primary">
                    Santuario Emocional Escolar • 13 a 18 años
                  </span>
                </div>

                {/* Stitch declaró `headline-xl-mobile` en el tema pero dejó el
                    titular fijo en 38 px. Acá sí se usa: a 360 px de ancho, 38 px
                    parte "sin juicios ni etiquetas clínicas" en cuatro líneas. */}
                <h1 className="font-headline-xl text-headline-xl-mobile md:text-headline-xl text-on-surface tracking-tight leading-[1.15] mb-space-md">
                  Un refugio seguro para tus emociones,{' '}
                  <span className="bg-gradient-to-r from-primary via-[#8463c2] to-secondary bg-clip-text text-transparent">
                    sin juicios ni etiquetas clínicas
                  </span>
                  .
                </h1>

                <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl mb-space-xl leading-relaxed">
                  La plataforma de acompañamiento socioemocional que te acompaña a tu ritmo:
                  encuentra calma en instantes difíciles, expresa lo que sientes y conecta con tu
                  red de confianza en un espacio 100% privado y protegido.
                </p>

                <div className="flex flex-wrap items-center gap-space-sm sm:gap-space-md w-full sm:w-auto">
                  <A
                    className="w-full sm:w-auto px-space-xl py-3.5 rounded-full bg-brand-violet hover:bg-[#a98eed] text-on-primary-container font-label-lg text-label-lg font-bold shadow-[0_8px_24px_rgba(189,164,243,0.35)] hover:scale-[1.02] active:scale-[0.98] transition-all text-center flex items-center justify-center gap-space-xs"
                    href="#/acceso"
                  >
                    <span>Comenzar ahora</span>
                    <Icono nombre="arrow_forward" className="text-[18px]" />
                  </A>
                  <A
                    className="w-full sm:w-auto px-space-lg py-3.5 rounded-full bg-surface-container-lowest text-on-surface border border-outline-variant/20 hover:bg-surface-container-high transition-all font-label-lg text-label-lg font-semibold flex items-center justify-center gap-space-xs shadow-sm"
                    href="#experiencias"
                  >
                    <Icono nombre="shield_heart" className="text-secondary text-[20px]" />
                    <span>Conoce cómo te cuidamos</span>
                  </A>
                </div>

                {/* Sellos de confianza */}
                <div className="flex flex-wrap items-center gap-space-md sm:gap-space-lg mt-space-xl pt-space-md border-t border-outline-variant/15 w-full">
                  <div className="flex items-center gap-space-2xs font-label-sm text-label-sm text-on-surface-variant">
                    <Icono nombre="lock" className="text-secondary text-[18px]" />
                    <span>100% Cifrado E2EE</span>
                  </div>
                  <div className="flex items-center gap-space-2xs font-label-sm text-label-sm text-on-surface-variant">
                    <Icono nombre="psychology_alt" className="text-tertiary-fixed-dim text-[18px]" />
                    <span>Sin diagnósticos médicos</span>
                  </div>
                  <div className="flex items-center gap-space-2xs font-label-sm text-label-sm text-on-surface-variant">
                    <Icono nombre="diversity_1" className="text-primary text-[18px]" />
                    <span>Tú tienes el control</span>
                  </div>
                </div>

                {/* Métricas */}
                <div className="grid grid-cols-3 gap-space-md mt-space-lg pt-space-sm border-t border-outline-variant/10 w-full">
                  <div>
                    <div className="font-headline-sm text-headline-sm font-bold text-primary">+12,000</div>
                    <div className="font-body-sm text-[11px] text-on-surface-variant">Jóvenes escuchados</div>
                  </div>
                  <div>
                    <div className="font-headline-sm text-headline-sm font-bold text-secondary">0% Juicio</div>
                    <div className="font-body-sm text-[11px] text-on-surface-variant">Sin notas ni registros</div>
                  </div>
                  <div>
                    <div className="font-headline-sm text-headline-sm font-bold text-[#775a03]">24 / 7</div>
                    <div className="font-body-sm text-[11px] text-on-surface-variant">Recursos de calma</div>
                  </div>
                </div>
              </div>

              {/* Columna visual */}
              <div className="lg:col-span-5 flex justify-center items-center relative">
                <div className="relative w-full max-w-[390px]">
                  <div className="absolute inset-0 bg-gradient-to-tr from-brand-violet/35 via-brand-yellow/25 to-secondary-sky/35 rounded-[3rem] blur-2xl transform scale-95" />
                  <div className="relative bg-surface-container-lowest p-space-xl rounded-[2.5rem] border border-outline-variant/20 shadow-[0_24px_48px_rgba(4,24,69,0.06)] flex flex-col items-center text-center">
                    <div className="relative p-space-md mb-space-sm">
                      <div className="w-48 h-48 rounded-full bg-gradient-to-b from-[#faf8ff] to-[#f2f3ff] flex items-center justify-center shadow-inner">
                        {/* La portada es lo primero que ve alguien que llega sin
                            saber qué es esto: Lumy sale en `alegria`, de banda
                            apoyo. Nadie entra a una plataforma de salud mental
                            para que lo reciba una mascota triste. */}
                        <Lumy
                          emocion="alegria"
                          ancho={144}
                          className="lm-lumy--float transition-transform hover:scale-105 duration-300"
                          etiqueta="Lumy, la mascota de Lumys, una forma suave y luminosa"
                        />
                      </div>
                      <div className="absolute bottom-2 right-4 bg-surface-container-lowest px-space-sm py-1 rounded-full shadow-md border border-brand-violet/25 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="font-label-sm text-[11px] font-semibold text-on-surface">Aquí contigo</span>
                      </div>
                    </div>

                    <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold mb-1">Hola, soy Lumy ☁️</h2>
                    <p className="font-body-sm text-body-sm text-on-surface-variant max-w-xs mb-space-md">
                      Un espacio donde puedes desahogarte, respirar hondo y sentirte en calma en
                      cualquier momento del día.
                    </p>

                    <div className="w-full bg-surface-container-low rounded-2xl p-space-xs flex items-center justify-between text-left">
                      <div className="flex items-center gap-space-xs pl-space-xs">
                        <Icono nombre="air" className="text-secondary text-[18px]" />
                        <span className="font-label-sm text-[12px] text-on-surface font-semibold">
                          Respiración 4-4-4 disponible
                        </span>
                      </div>
                      <A
                        className="px-space-sm py-1 rounded-full bg-brand-violet/40 hover:bg-brand-violet text-on-primary-container font-label-sm text-[11px] font-bold transition-all"
                        href="#/acceso"
                      >
                        Probar
                      </A>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ---------------- Experiencias ---------------- */}
          <section className="w-full mb-space-3xl" id="experiencias">
            <div className="text-center max-w-2xl mx-auto mb-space-2xl">
              <div className="inline-flex items-center gap-space-xs px-space-md py-1 rounded-full bg-surface-container border border-outline-variant/20 text-on-surface-variant font-label-sm text-label-sm font-semibold mb-space-xs">
                <Icono nombre="auto_awesome" className="text-[16px] text-primary" />
                <span>Experiencias Diseñadas para Ti</span>
              </div>
              <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight mb-space-xs">
                Diseñado para sentirse como un abrazo, no como una tarea escolar
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Explora las dinámicas pensadas para ayudarte a soltar el peso del día a tu propio ritmo.
              </p>
            </div>

            <div className="space-y-space-xl">

              {/* Experiencia 1 — Check-in conversacional */}
              <div className="lm-revelar grid grid-cols-1 lg:grid-cols-12 gap-space-xl items-center bg-surface-container-lowest p-space-xl rounded-3xl border border-outline-variant/15 shadow-[0_10px_30px_rgba(4,24,69,0.03)]">
                <div className="lg:col-span-6 flex flex-col">
                  <div className="inline-flex items-center gap-space-xs px-space-sm py-1 rounded-full bg-brand-violet/25 text-on-primary-container font-label-sm text-label-sm font-bold w-fit mb-space-sm">
                    <Icono nombre="chat_bubble" className="text-[16px]" />
                    <span>Check-in Conversacional IA</span>
                  </div>
                  <h3 className="font-headline-md text-headline-md text-on-surface font-bold mb-space-sm">
                    Como charlar por chat con tu mejor amigo de confianza
                  </h3>
                  <p className="font-body-lg text-body-lg text-on-surface-variant mb-space-md leading-relaxed">
                    Olvídate de responder cuestionarios fríos con escalas del 1 al 10. Lumy IA te
                    saluda con calidez, te acompaña en tus momentos de cansancio y te ayuda a ponerle
                    nombre a lo que sientes sin juzgarte jamás.
                  </p>
                  <div className="flex flex-col gap-space-xs font-body-md text-body-md text-on-surface-variant">
                    <Vineta texto="Detección de sobrecarga emocional suave y no invasiva." color="text-primary" />
                    <Vineta texto="Respuestas empáticas y ejercicios de respiración contextuales." color="text-primary" />
                  </div>
                </div>

                {/* Maqueta de chat */}
                <div className="lg:col-span-6 flex justify-center">
                  <div className="w-full max-w-md bg-surface-container-low/70 rounded-3xl p-space-md border border-outline-variant/20 shadow-sm flex flex-col gap-space-sm">
                    <div className="flex items-center justify-between pb-space-xs border-b border-outline-variant/20">
                      <div className="flex items-center gap-space-xs">
                        <div className="w-8 h-8 rounded-full bg-surface-container-lowest p-0.5 shadow-sm flex items-center justify-center">
                          <Isotipo tamano={26} />
                        </div>
                        <div>
                          <div className="font-label-md text-label-md font-bold text-on-surface leading-tight">Lumy</div>
                          <div className="font-label-sm text-[11px] text-secondary font-medium">
                            Acompañante activo • En línea
                          </div>
                        </div>
                      </div>
                      <Icono nombre="lock" className="text-on-surface-variant text-[16px]" />
                    </div>

                    <div className="flex items-start gap-space-xs max-w-[88%]">
                      <div className="bg-surface-container-lowest p-space-sm rounded-2xl rounded-tl-sm font-body-md text-body-md text-on-surface shadow-sm">
                        ¡Hola! Noté que hoy tuviste examen de Química. ¿Cómo se siente tu pecho ahora
                        que terminó el día? ☁️
                      </div>
                    </div>
                    <div className="flex items-end justify-end self-end max-w-[88%]">
                      <div className="bg-brand-violet/60 p-space-sm rounded-2xl rounded-tr-sm font-body-md text-body-md text-on-primary-container shadow-sm">
                        Sentía un nudo en el estómago antes de entrar, pero ya estoy en casa, solo un
                        poco cansado.
                      </div>
                    </div>
                    <div className="flex items-start gap-space-xs max-w-[88%]">
                      <div className="bg-surface-container-lowest p-space-sm rounded-2xl rounded-tl-sm font-body-md text-body-md text-on-surface shadow-sm">
                        Ese nudo es súper comprensible, pero lo hiciste excelente. ¿Hacemos una pausa
                        de calma de 1 minuto antes de cenar? ✨
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-space-xs pt-space-xs">
                      <span className="px-space-sm py-1 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-semibold">
                        Sí, respirar juntos 🌿
                      </span>
                      <span className="px-space-sm py-1 rounded-full bg-surface-container-high text-on-surface font-label-sm text-label-sm font-medium">
                        Solo quiero descansar
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Experiencia 2 — Red de confianza */}
              <div className="lm-revelar grid grid-cols-1 lg:grid-cols-12 gap-space-xl items-center bg-surface-container-lowest p-space-xl rounded-3xl border border-outline-variant/15 shadow-[0_10px_30px_rgba(4,24,69,0.03)]">
                <div className="lg:col-span-6 flex justify-center order-2 lg:order-1">
                  <div className="w-full max-w-md bg-surface-container-low/70 rounded-3xl p-space-lg border border-outline-variant/20 shadow-sm flex flex-col gap-space-md">
                    <div className="flex items-center justify-between">
                      <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
                        Mi Red de Confianza
                      </span>
                      <span className="px-space-xs py-1 rounded-full bg-secondary-sky/40 text-on-secondary-fixed-variant font-label-sm text-[11px] font-bold">
                        Tú tienes el control
                      </span>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Elige a quién contactar con un solo toque si algún día sientes que necesitas una mano:
                    </p>

                    <div className="space-y-space-xs">
                      <div className="flex items-center justify-between p-space-sm bg-surface-container-lowest rounded-2xl shadow-sm">
                        <div className="flex items-center gap-space-sm">
                          <div className="w-10 h-10 rounded-full bg-brand-violet/40 flex items-center justify-center text-primary font-bold" aria-hidden="true">V</div>
                          <div>
                            <div className="font-label-md text-label-md text-on-surface font-bold">Valentina (Mejor amiga)</div>
                            <div className="font-body-sm text-[11px] text-on-surface-variant">Compañera de clase</div>
                          </div>
                        </div>
                        <span className="px-space-sm py-1 rounded-full bg-brand-violet text-on-primary-container font-label-sm text-[11px] font-bold">
                          Escribir
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-space-sm bg-surface-container-lowest rounded-2xl shadow-sm">
                        <div className="flex items-center gap-space-sm">
                          <div className="w-10 h-10 rounded-full bg-brand-yellow/50 flex items-center justify-center text-[#775a03] font-bold" aria-hidden="true">M</div>
                          <div>
                            <div className="font-label-md text-label-md text-on-surface font-bold">Profe Carmen (Orientación)</div>
                            <div className="font-body-sm text-[11px] text-on-surface-variant">Cita confidencial en recreo</div>
                          </div>
                        </div>
                        <span className="px-space-sm py-1 rounded-full bg-surface-container-high text-on-surface font-label-sm text-[11px] font-semibold">
                          Pedir cita
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-space-sm bg-error-container/40 rounded-2xl border border-error-container/60">
                        <div className="flex items-center gap-space-sm">
                          <div className="w-10 h-10 rounded-full bg-error text-on-error flex items-center justify-center">
                            <Icono nombre="call" className="text-[18px]" />
                          </div>
                          <div>
                            <div className="font-label-md text-label-md text-on-error-container font-bold">Línea Nacional MIFAM 133</div>
                            <div className="font-body-sm text-[11px] text-on-surface-variant">Llamada anónima y gratuita 24/7</div>
                          </div>
                        </div>
                        <Icono nombre="chevron_right" className="text-error text-[18px]" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-6 flex flex-col order-1 lg:order-2">
                  <div className="inline-flex items-center gap-space-xs px-space-sm py-1 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-bold w-fit mb-space-sm">
                    <Icono nombre="diversity_1" className="text-[16px]" />
                    <span>Apoyo a Tu Medida</span>
                  </div>
                  <h3 className="font-headline-md text-headline-md text-on-surface font-bold mb-space-sm">
                    Tu Red de Confianza: Tú decides con quién hablar y cuándo
                  </h3>
                  <p className="font-body-lg text-body-lg text-on-surface-variant mb-space-md leading-relaxed">
                    Nunca te forzaremos a hablar con adultos del colegio si no te sientes cómodo.
                    Puedes configurar tu red con tus amistades más cercanas, tu orientador/a, o
                    recurrir a canales especializados de protección en un entorno seguro y libre de
                    estigmas.
                  </p>
                  <div className="flex flex-col gap-space-xs font-body-md text-body-md text-on-surface-variant">
                    <Vineta texto="Sin notificaciones automáticas a terceros que violen tu privacidad." />
                    <Vineta texto="Enlace asistido con canales de protección solo si tú lo solicitas o en riesgo inminente." />
                  </div>
                </div>
              </div>

              {/* Experiencia 3 — Oasis de calma */}
              <div className="lm-revelar grid grid-cols-1 lg:grid-cols-12 gap-space-xl items-center bg-surface-container-lowest p-space-xl rounded-3xl border border-outline-variant/15 shadow-[0_10px_30px_rgba(4,24,69,0.03)]">
                <div className="lg:col-span-6 flex flex-col">
                  <div className="inline-flex items-center gap-space-xs px-space-sm py-1 rounded-full bg-brand-yellow/40 text-[#775a03] font-label-sm text-label-sm font-bold w-fit mb-space-sm">
                    <Icono nombre="air" className="text-[16px]" />
                    <span>Oasis de Calma</span>
                  </div>
                  <h3 className="font-headline-md text-headline-md text-on-surface font-bold mb-space-sm">
                    Respiración guiada, constancia positiva y mini dinámicas
                  </h3>
                  <p className="font-body-lg text-body-lg text-on-surface-variant mb-space-md leading-relaxed">
                    Entrena tu sistema nervioso para regresar al equilibrio. Ejercicios bio-rítmicos
                    interactivos de 2 a 4 minutos con paisajes sonoros suaves para calmar la ansiedad
                    previa a un examen o tras un momento de sobrecarga.
                  </p>
                  <div className="flex flex-wrap items-center gap-space-md pt-space-xs">
                    <div className="flex items-center gap-space-xs">
                      <Icono nombre="timer" className="text-tertiary text-[22px]" />
                      <span className="font-label-md text-label-md text-on-surface font-semibold">
                        Micro-sesiones de 2 a 4 min
                      </span>
                    </div>
                    <div className="flex items-center gap-space-xs">
                      <Icono nombre="music_note" className="text-tertiary text-[22px]" />
                      <span className="font-label-md text-label-md text-on-surface font-semibold">
                        Paisajes sonoros binaurales
                      </span>
                    </div>
                  </div>
                </div>

                {/* Maqueta de respiración */}
                <div className="lg:col-span-6 flex justify-center">
                  <div className="w-full max-w-sm bg-surface-container-low/70 rounded-3xl p-space-xl border border-outline-variant/20 shadow-sm flex flex-col items-center text-center">
                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-space-md font-bold">
                      Ejercicio de Respiración Rítmica
                    </span>

                    <div className="relative w-44 h-44 flex items-center justify-center mb-space-md">
                      <div className="absolute inset-0 rounded-full bg-secondary-sky/30 animate-ping opacity-60" />
                      <div className="absolute inset-4 rounded-full bg-brand-violet/30 animate-pulse" />
                      <svg className="w-40 h-40 transform -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
                        <circle className="text-surface-container-high" cx="60" cy="60" fill="none" r="50" stroke="currentColor" strokeWidth="8" />
                        {/* El aro se llena al inhalar y se vacía al exhalar, en
                            los mismos 4 s que el rótulo. En el mockup el trazo
                            estaba congelado en un valor fijo. */}
                        <circle
                          className="text-primary"
                          cx="60" cy="60" fill="none" r="50"
                          stroke="currentColor"
                          strokeDasharray="314"
                          strokeDashoffset={inhala ? 0 : 314}
                          strokeLinecap="round"
                          strokeWidth="8"
                          style={{ transition: 'stroke-dashoffset 4s linear' }}
                        />
                      </svg>
                      <div className="absolute flex flex-col items-center">
                        <Icono nombre="wind_power" className="text-primary text-[32px]" />
                        <span className="font-headline-sm text-headline-sm text-on-surface font-bold mt-1">
                          {inhala ? 'Inhala' : 'Exhala'}
                        </span>
                        <span className="font-body-sm text-body-sm text-on-surface-variant font-medium">4 seg</span>
                      </div>
                    </div>

                    <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-md">
                      Sincroniza tu respiración con el pulso suave de Lumy.
                    </p>
                    <A
                      href="#/acceso"
                      className="w-full py-2.5 rounded-full bg-surface-container-lowest hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-semibold border border-outline-variant/20 transition-colors flex items-center justify-center gap-space-xs shadow-sm"
                    >
                      <Icono nombre="play_arrow" className="text-[18px]" />
                      <span>Iniciar respiración guiada</span>
                    </A>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ---------------- Roles ---------------- */}
          <section className="w-full mb-space-3xl" id="roles">
            <div className="text-center max-w-3xl mx-auto mb-space-2xl">
              <div className="inline-flex items-center gap-space-xs px-space-md py-1 rounded-full bg-surface-container border border-outline-variant/20 text-on-surface-variant font-label-sm text-label-sm font-semibold mb-space-xs">
                <Icono nombre="shield" className="text-[16px] text-secondary" />
                <span>Límites Éticos Inquebrantables</span>
              </div>
              <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight mb-space-xs">
                Cuatro roles, un solo propósito: cuidarte sin vulnerar tu intimidad
              </h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant">
                Cada persona en el entorno escolar cumple un papel de cuidado mutuo con
                responsabilidades claras y fronteras éticas infranqueables.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
              <TarjetaRol
                indice={0}
                icono="favorite"
                tono="bg-brand-violet/25 text-primary"
                etiqueta="Tu Espacio Autónomo"
                tonoEtiqueta="bg-brand-violet/30 text-on-primary-container"
                titulo="Estudiante"
                resumen="Santuario personal libre de juicios ni exámenes."
                puntos={[
                  'Check-in diario y desahogo privado',
                  'Constancia sin rachas estresantes',
                  'Juegos de calma y respiración rítmica',
                  'Red de confianza 100% elegida por ti',
                ]}
                pie="Libre de vigilancia"
                iconoPie="lock"
                tonoPie="text-primary"
              />
              <TarjetaRol
                indice={1}
                icono="wb_sunny"
                tono="bg-brand-yellow/40 text-[#775a03]"
                etiqueta="Clima Comunitario"
                tonoEtiqueta="bg-brand-yellow/40 text-[#564000]"
                titulo="Orientador/a"
                resumen="Monitoreo agregado y acompañamiento preventivo."
                puntos={[
                  'Métricas grupales de aula 100% anónimas',
                  'Gestión de talleres socioemocionales',
                  'Soporte temprano ante sobrecarga',
                  'Cero acceso a reflexiones privadas',
                ]}
                pie="Visión grupal anónima"
                iconoPie="pie_chart"
                tonoPie="text-[#775a03]"
              />
              <TarjetaRol
                indice={2}
                icono="psychology"
                tono="bg-secondary-sky/50 text-secondary"
                etiqueta="Apoyo Especializado"
                tonoEtiqueta="bg-secondary-container text-on-secondary-container"
                titulo="Psicólogo"
                resumen="Contención clínica oportuna y derivación respetuosa."
                puntos={[
                  'Derivación con consentimiento mutuo',
                  'Herramientas de primera respuesta',
                  'Protocolo estricto de secreto profesional',
                  'Sin diagnósticos médicos invasivos',
                ]}
                pie="Canal confidencial"
                iconoPie="shield"
                tonoPie="text-secondary"
              />
              <TarjetaRol
                indice={3}
                icono="support_agent"
                tono="bg-surface-container-high text-on-surface"
                etiqueta="Soporte Lumys"
                tonoEtiqueta="bg-surface-container text-on-surface"
                titulo="Equipo Lumys"
                resumen="Red anónima de acompañamiento humano y bioética."
                puntos={[
                  'Monitores en primeros auxilios psicológicos',
                  'Para cuando prefieres apoyo externo',
                  'Puente neutral y compasivo',
                  'Cero persistencia de datos personales',
                ]}
                pie="Guardia de bioética"
                iconoPie="verified"
                tonoPie="text-on-surface-variant"
              />
            </div>
          </section>

          {/* ---------------- Manifiesto ---------------- */}
          <section
            className="w-full bg-gradient-to-br from-[#041845] via-[#152758] to-[#1d2e5b] text-inverse-on-surface rounded-3xl p-space-xl md:p-space-3xl mb-space-3xl relative overflow-hidden shadow-2xl"
            id="manifiesto"
          >
            <div className="max-w-3xl relative z-10">
              <div className="inline-flex items-center gap-space-xs px-space-md py-1 rounded-full bg-surface-container-lowest/10 text-primary-fixed font-label-sm text-label-sm font-semibold mb-space-md backdrop-blur-md border border-white/10">
                <Icono nombre="verified" className="text-[16px]" />
                <span>El Compromiso Inviolable de Lumys</span>
              </div>
              <h2 className="font-headline-xl text-headline-xl-mobile md:text-headline-xl font-bold tracking-tight mb-space-md text-surface-container-lowest">
                Manifiesto Ético de Privacidad y Blindaje Integral
              </h2>
              <p className="font-body-lg text-body-lg text-surface-container-high mb-space-xl leading-relaxed">
                Creemos firmemente que ningún adolescente puede expresarse con honestidad si teme
                ser vigilado, juzgado o patologizado. Lumys no es una herramienta de disciplina
                escolar ni un portal burocrático para directivos.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md mb-space-2xl">
                <PilarManifiesto icono="visibility_off" titulo="Diarios Blindados" tono="text-secondary-sky">
                  Tus conversaciones con Lumy y tus notas de desahogo están cifradas con llaves
                  privadas. Ni directores ni profesores pueden acceder a ellas.
                </PilarManifiesto>
                <PilarManifiesto icono="medical_services" titulo="Cero Diagnósticos" tono="text-brand-yellow">
                  No emitimos etiquetas clínicas ni creamos expedientes psiquiátricos. Ofrecemos
                  herramientas pedagógicas y emocionales de autocuidado.
                </PilarManifiesto>
                <PilarManifiesto icono="lock_reset" titulo="Control Soberano de Datos" tono="text-primary-fixed">
                  Puedes reiniciar tu historial en cualquier momento. Jamás comercializamos datos de
                  menores ni alimentamos modelos publicitarios externos.
                </PilarManifiesto>
                <PilarManifiesto icono="sos" titulo="Auxilio Protegido" tono="text-error-container">
                  En situaciones de riesgo inminente para la vida, el sistema activa protocolos de
                  asistencia humanitaria e institucional con total transparencia.
                </PilarManifiesto>
              </div>

              <div className="flex flex-wrap items-center gap-space-md">
                <A
                  className="px-space-xl py-3 rounded-full bg-brand-violet hover:bg-[#a98eed] text-on-primary-container font-label-lg text-label-lg font-bold transition-all shadow-md"
                  href="#/acceso"
                >
                  Unirme con Garantía de Privacidad
                </A>
                <div className="flex items-center gap-space-2xs text-surface-variant font-label-sm text-label-sm">
                  <Icono nombre="verified_user" className="text-[18px]" />
                  <span>Cumplimiento RGPD • Ley de Protección a la Niñez y Adolescencia</span>
                </div>
              </div>
            </div>
          </section>

          {/* ---------------- Testimonios ---------------- */}
          <section className="w-full mb-space-3xl">
            <div className="text-center max-w-2xl mx-auto mb-space-2xl">
              <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight mb-space-xs">
                Lo que dice nuestra comunidad escolar
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Estudiantes, orientadores y psicólogos comparten cómo Lumys transformó su convivencia diaria.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-space-lg">
              <Testimonio
                indice={0}
                cita="«Antes de Lumys me guardaba todo porque me daba miedo que los profes me juzgaran. Hablar con Lumy me ayuda a ordenar lo que siento sin sentirme observada.»"
                inicial="S"
                tonoInicial="bg-brand-violet/30 text-primary"
                nombre="Sofía M., 15 años"
                rol="Estudiante de 3er año"
              />
              <Testimonio
                indice={1}
                cita="«Como orientadora, Lumys me permite detectar si un aula completa está pasando por picos de estrés sin vulnerar el diario de ningún chico. Es el equilibrio perfecto entre cuidado y respeto.»"
                inicial="C"
                tonoInicial="bg-brand-yellow/50 text-[#775a03]"
                nombre="Lic. Carmen Benítez"
                rol="Orientadora Psicopedagógica"
              />
              <Testimonio
                indice={2}
                cita="«Nos ayuda a desestigmatizar la salud mental escolar. Los chicos que acuden a sesión ya vienen con mayor autoconocimiento y sin el miedo a ser etiquetados.»"
                inicial="D"
                tonoInicial="bg-secondary-sky/50 text-secondary"
                nombre="Dr. Daniel Morales"
                rol="Psicólogo Clínico Institucional"
              />
            </div>
          </section>

          {/* ---------------- Doble llamada a la acción ---------------- */}
          <section
            className="w-full bg-surface-container-low/70 rounded-3xl p-space-xl md:p-space-2xl border border-outline-variant/15 mb-space-3xl"
            id="contacto"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-space-xl items-center">
              <div className="bg-surface-container-lowest p-space-xl rounded-3xl border border-outline-variant/15 shadow-sm flex flex-col justify-between h-full">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-brand-violet/30 flex items-center justify-center text-primary mb-space-md">
                    <Icono nombre="school" className="text-[26px]" />
                  </div>
                  <h3 className="font-headline-md text-headline-md text-on-surface font-bold mb-space-xs">
                    ¿Eres estudiante?
                  </h3>
                  <p className="font-body-md text-body-md text-on-surface-variant mb-space-lg leading-relaxed">
                    Empieza tu camino de calma de forma gratuita con el código de tu centro o de
                    manera autónoma. No necesitas tarjeta ni autorización médica.
                  </p>
                </div>
                <A
                  className="w-full py-3.5 rounded-full bg-brand-violet hover:bg-[#a98eed] text-on-primary-container font-label-lg text-label-lg font-bold text-center shadow-[0_6px_20px_rgba(189,164,243,0.3)] transition-all hover:scale-[1.01]"
                  href="#/acceso"
                >
                  Comenzar mi Check-in Gratuito
                </A>
              </div>

              <div className="bg-surface-container-lowest p-space-xl rounded-3xl border border-outline-variant/15 shadow-sm flex flex-col justify-between h-full">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-secondary-container flex items-center justify-center text-secondary mb-space-md">
                    <Icono nombre="apartment" className="text-[26px]" />
                  </div>
                  <h3 className="font-headline-md text-headline-md text-on-surface font-bold mb-space-xs">
                    ¿Representas a un Colegio?
                  </h3>
                  <p className="font-body-md text-body-md text-on-surface-variant mb-space-lg leading-relaxed">
                    Lleva el ecosistema Lumys a tu centro escolar. Fortalece la convivencia pacífica,
                    la prevención oportuna y el bienestar socioemocional.
                  </p>
                </div>
                <A
                  href="#/acceso"
                  className="w-full py-3.5 rounded-full bg-secondary hover:bg-on-secondary-container text-on-secondary font-label-lg text-label-lg font-bold text-center shadow-sm transition-all hover:scale-[1.01]"
                >
                  Solicitar Demo Institucional
                </A>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* ================= Pie ================= */}
      <footer className="w-full bg-surface-container-low border-t border-outline-variant/15 py-space-xl">
        <div className="max-w-[1200px] mx-auto px-margin-mobile md:px-margin-desktop flex flex-col gap-space-lg">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md pb-space-lg border-b border-outline-variant/15">
            <div className="flex flex-col gap-1.5">
              <Logotipo tamano={30} conIsotipo conBajada />
              <p className="font-body-sm text-body-sm text-on-surface-variant max-w-md">
                Plataforma tecnológica socioemocional creada para brindar contención, intimidad
                blindada y seguridad psicológica a la comunidad adolescente.
              </p>
            </div>

            <div className="flex items-center gap-space-sm p-space-sm bg-surface-container-lowest rounded-2xl border border-error-container/60 shadow-sm">
              <div className="w-10 h-10 rounded-full bg-error-container text-error flex items-center justify-center">
                <Icono nombre="health_and_safety" className="text-[20px]" />
              </div>
              <div className="text-left">
                <div className="font-label-sm text-label-sm text-on-surface font-bold">
                  Línea Nacional MIFAM 133 • Emergencias
                </div>
                <div className="font-body-sm text-[11px] text-on-surface-variant">
                  Llamada gratuita, confidencial y disponible 24/7
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-space-sm text-center sm:text-left">
            <div className="font-body-sm text-body-sm text-on-surface-variant">
              © 2026 Lumys • hN10 Hackathon Nicaragua · Legacy4Nic
            </div>
            <div className="flex flex-wrap items-center justify-center gap-space-md text-on-surface-variant font-label-sm text-label-sm">
              <A className="hover:text-primary transition-colors flex items-center gap-1" href="#manifiesto">
                <Icono nombre="lock" className="text-[14px]" />
                Privacidad Cifrada
              </A>
              <A className="hover:text-primary transition-colors flex items-center gap-1" href="#manifiesto">
                <Icono nombre="policy" className="text-[14px]" />
                Manifiesto Ético
              </A>
              <A className="hover:text-primary transition-colors" href="#/marca">
                Manual de marca
              </A>
              <A className="hover:text-primary transition-colors" href="#/acceso">
                Acceso Institucional
              </A>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Bienvenida;
