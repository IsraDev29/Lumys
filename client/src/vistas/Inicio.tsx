/* ===========================================================================
 * Lumys* — inicio del estudiante
 * ---------------------------------------------------------------------------
 * Portada de `inicio_estudiante_mascota_lumy`, en el mismo orden:
 *
 *   1. Saludo + tarjeta de racha
 *   2. Hub de Lumy: burbuja de diálogo, mascota con halo, conexión rápida
 *   3. Check-in emocional rápido: ánimo, qué influye, diario
 *   4. Rejilla de bienestar: respiración · mundo de calma · red de confianza
 *   5. Tu huella (línea base ipsativa) y el aviso de privacidad
 *
 * Lo que cambia respecto a la maqueta es de dónde salen los datos: la racha, el
 * clima y la línea base vienen de `api.gemelo()`, la red de `api.redApoyo()`, y
 * la mascota es el rig de 33 estados (lumy/Lumy.tsx), no una imagen.
 *
 * La cabecera fija del mockup no se porta: la navegación de Lumys vive abajo y
 * en un solo sitio. El botón SOS que vivía en ella baja al saludo, que es lo
 * primero que se lee.
 *
 * La regla de seguridad se sostiene: el clima elige la emoción de Lumy a través
 * de `POR_CLIMA`, tipado para devolver solo emociones de banda 'apoyo'. Con
 * lluvia —el peor tramo— Lumy pasa a `empatia`, no a tristeza. Cuando al
 * estudiante le va peor es justo cuando la mascota tiene que sostener en vez de
 * hundirse con él.
 * =========================================================================== */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { A } from '../componentes/A.tsx';
import { Lumy } from '../lumy/Lumy.tsx';
import { LineaBase } from '../componentes/LineaBase.tsx';
import { Cargador, Contador, Vacio } from '../componentes/comunes.tsx';
import { POR_CLIMA } from '../lumy/emociones.ts';
import * as api from '../lib/api.ts';
import * as almacen from '../lib/almacen.ts';
import { CLIMAS, fechaLarga } from '../lib/formato.ts';
import { escalon, prefiereMenosMovimiento, useRevelar } from '../lib/movimiento.ts';
import { useDatos } from '../lib/useDatos.ts';
import { useSesion } from '../lib/sesion.tsx';

function Icono({ nombre, className = '' }: { nombre: string; className?: string }) {
  return (
    <span className={`material-symbols-outlined ${className}`} aria-hidden="true">
      {nombre}
    </span>
  );
}

/** ¿Ya hizo el check-in de hoy? Se mira el historial local para no depender de
 *  que el servidor haya confirmado la sincronización. */
function hechoHoy(): boolean {
  const ultimo = almacen.leer<{ fecha?: string }[]>('checkins', [])[0];
  return (ultimo?.fecha ?? '').slice(0, 10) === new Date().toISOString().slice(0, 10);
}

/* Los cinco ánimos de la maqueta. El emoji va antes que la palabra a propósito:
   a los 13 el emoji se reconoce más rápido que la etiqueta, y la etiqueta está
   para nombrar lo que ya se eligió — que es media alfabetización emocional. */
const ANIMOS = [
  { id: 'radiante', emoji: '✨', nombre: 'Radiante', pie: 'Con energía alta', hover: 'hover:bg-tertiary-fixed/50' },
  { id: 'tranquilo', emoji: '🌿', nombre: 'Tranquilo', pie: 'En paz y calma', hover: 'hover:bg-secondary-fixed/60' },
  { id: 'dudas', emoji: '🤔', nombre: 'Con dudas', pie: 'Pensativo', hover: 'hover:bg-surface-container-high' },
  { id: 'abrumado', emoji: '🌪️', nombre: 'Abrumado', pie: 'Es mucho a la vez', hover: 'hover:bg-primary-fixed/40' },
  { id: 'bajon', emoji: '🌧️', nombre: 'De bajón', pie: 'Sin muchas ganas', hover: 'hover:bg-error-container/40' },
] as const;

const INFLUYE = [
  { id: 'estudio', simbolo: 'menu_book', texto: 'Exámenes y tareas' },
  { id: 'amigos', simbolo: 'sentiment_satisfied', texto: 'Amigos del cole' },
  { id: 'familia', simbolo: 'home', texto: 'Familia' },
  { id: 'sueno', simbolo: 'bedtime', texto: 'Sueño / descanso' },
  { id: 'libre', simbolo: 'sports_esports', texto: 'Tiempo libre' },
  { id: 'relaciones', simbolo: 'favorite', texto: 'Relaciones' },
];

const ACCESOS = [
  { simbolo: 'lightbulb', tono: 'bg-secondary-fixed text-on-secondary-fixed-variant', hover: 'hover:bg-primary-fixed/40', titulo: 'Pedir un tip de calma', pie: 'Soltar la tensión de hombros', ruta: 'respirar' },
  { simbolo: 'auto_awesome', tono: 'bg-tertiary-fixed text-on-tertiary-fixed', hover: 'hover:bg-tertiary-fixed/40', titulo: 'Escuchar una afirmación', pie: '«Alcanzo, paso a paso»', ruta: 'capsulas' },
  { simbolo: 'collections_bookmark', tono: 'bg-primary-fixed text-on-primary-fixed-variant', hover: 'hover:bg-primary-container/40', titulo: 'Ver una cápsula corta', pie: 'Menos de un minuto', ruta: 'capsulas' },
];

export function Inicio() {
  const { usuario } = useSesion();
  const navegar = useNavigate();
  const revelar = useRevelar<HTMLElement>();

  const [animo, setAnimo] = useState<string | null>(null);
  const [influye, setInfluye] = useState<string[]>([]);
  const [nota, setNota] = useState('');

  const { datos, cargando, error } = useDatos(
    () => Promise.all([api.gemelo(), api.redApoyo()]),
    [],
  );

  if (cargando) return <Cargador />;
  if (error || !datos) {
    return <Vacio titulo="No pudimos abrir tu espacio" detalle={error?.message} />;
  }

  // La lectura ipsativa viaja dentro del gemelo, calculada por el servidor
  // contra el patrón habitual de ESTE estudiante. Pedirla por separado la
  // traía de una lista fija que era idéntica para todos.
  const [gemelo, contactos] = datos;
  const ipsativa = gemelo.ipsativa;
  const clima = CLIMAS[gemelo.clima] ?? CLIMAS.parcial;
  const yaHizo = hechoHoy();
  const activos = contactos.filter((c) => !c.excluido);
  const diasSemana = Math.min(gemelo.racha, 7);

  const alternarInfluye = (id: string) =>
    setInfluye((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  /* El check-in de verdad es conversacional y vive en /checkin. Lo de acá es la
     puerta de entrada: se lleva lo ya elegido para que nadie tenga que responder
     dos veces la misma pregunta. */
  const continuar = () => {
    almacen.guardar('checkinBorrador', { animo, influye, nota, iniciado: Date.now() });
    navegar('/checkin');
  };

  return (
    <section
      ref={revelar}
      className="w-full pt-space-xl max-w-[1200px] mx-auto px-margin-mobile md:px-margin-desktop flex flex-col gap-space-xl"
    >

      {/* ================= 1 · Saludo y racha ================= */}
      <header
        className="lm-revelar flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md"
        style={escalon(0)}
      >
        <div className="space-y-space-2xs">
          <div className="flex items-center gap-space-xs flex-wrap">
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-semibold bg-secondary-fixed/50 px-space-xs py-space-2xs rounded-full flex items-center gap-1">
              <Icono nombre="wb_twilight" className="text-[14px]" />
              {fechaLarga()}
            </span>
            {/* El SOS vivía en la cabecera fija del mockup; sin cabecera, sube acá. */}
            <A
              href="#/red"
              className="font-label-sm text-label-sm font-semibold px-space-sm py-space-2xs rounded-full bg-tertiary-fixed text-on-tertiary-fixed shadow-[0_0_24px_rgba(255,215,122,0.45)] hover:bg-tertiary-container hover:text-on-tertiary-container transition-all flex items-center gap-1"
            >
              <Icono nombre="shield_with_heart" className="text-[16px]" />
              Botón de Calma / SOS
            </A>
          </div>

          <h1 className="font-headline-xl text-headline-xl-mobile md:text-headline-xl text-on-surface tracking-tight">
            ¡Hola, {usuario?.nombre.split(' ')[0]}! Qué bueno verte hoy{' '}
            <span className="inline-block animate-bounce" aria-hidden="true">✨</span>
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-xl">
            «No tenés que resolverlo todo en este momento. Solo el próximo paso, con calma.»
          </p>
        </div>

        <div className="flex items-center gap-space-md p-space-sm pl-space-md bg-surface-container-lowest rounded-2xl shadow-[0_8px_24px_-4px_rgba(189,164,243,0.18)] self-stretch md:self-auto justify-between md:justify-start">
          <div className="w-12 h-12 rounded-full bg-tertiary-fixed flex items-center justify-center text-on-tertiary-fixed shadow-[0_0_16px_rgba(255,223,153,0.6)] shrink-0">
            <Icono nombre="local_fire_department" className="text-[26px]" />
          </div>
          <div className="flex flex-col pr-space-sm">
            <span className="font-label-lg text-label-lg text-on-surface font-bold">
              <Contador valor={gemelo.racha} /> días seguidos
            </span>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              Se premia aparecer, no el ánimo
            </span>
          </div>
          {/* Siete puntos: la semana. El último late si todavía falta el de hoy. */}
          <div className="hidden sm:flex flex-col items-end pl-space-xs" aria-hidden="true">
            <div className="flex gap-1">
              {Array.from({ length: 7 }, (_, i) => (
                <span
                  key={i}
                  className={`w-2 h-2 rounded-full ${
                    i < diasSemana
                      ? `bg-tertiary${i === diasSemana - 1 && !yaHizo ? ' animate-pulse' : ''}`
                      : 'bg-outline-variant/50'
                  }`}
                />
              ))}
            </div>
            <span className="font-label-sm text-label-sm text-secondary font-medium mt-1">
              {clima.titulo}
            </span>
          </div>
        </div>
      </header>

      {/* ================= 2 · Hub de Lumy ================= */}
      <section
        className="lm-revelar relative overflow-hidden bg-gradient-to-b from-surface-container-low via-surface-container-lowest to-surface-container-low rounded-3xl p-space-lg md:p-space-2xl shadow-[0_12px_32px_-8px_rgba(28,45,90,0.06)]"
        style={escalon(1)}
      >
        {/* Manchas de luz del fondo. Decorativas y con blur: no llevan contenido
            y por eso no necesitan estar en el árbol de accesibilidad. */}
        <div className="absolute -top-16 -left-16 w-64 h-64 bg-primary-fixed/40 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-72 h-72 bg-secondary-fixed/40 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-tertiary-fixed/25 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-space-xl">

          <div className="flex flex-col items-center flex-1 text-center relative max-w-md">
            <div className="mb-space-sm bg-surface-container-lowest/95 backdrop-blur-md px-space-lg py-space-sm rounded-2xl shadow-[0_8px_24px_rgba(28,45,90,0.08)] relative">
              <p className="font-body-md text-body-md text-on-surface font-medium leading-snug">
                {yaHizo
                  ? 'Ya apareciste hoy. Con eso basta — nos vemos mañana.'
                  : gemelo.mensaje}
              </p>
              {/* Rabito del bocadillo */}
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-surface-container-lowest" />
            </div>

            <div className="relative flex items-center justify-center py-space-xs group">
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary-fixed-dim/40 via-secondary-fixed/50 to-tertiary-fixed-dim/40 filter blur-xl scale-95 transition-transform duration-700 group-hover:scale-110" />
              <Lumy
                emocion={POR_CLIMA[gemelo.clima]}
                etiqueta={null}
                ancho={220}
                className="relative z-10 transition-transform duration-500 hover:scale-105 select-none drop-shadow-[0_12px_24px_rgba(104,82,154,0.18)]"
              />
            </div>

            <div className="inline-flex items-center gap-space-xs mt-space-xs px-space-sm py-space-2xs bg-surface-container rounded-full text-secondary font-label-sm text-label-sm">
              <span className="w-2 h-2 rounded-full bg-secondary animate-ping" aria-hidden="true" />
              Lumys está en modo escucha
            </div>
          </div>

          <div className="flex flex-col gap-space-md w-full lg:max-w-md">
            <div className="space-y-space-2xs">
              <span className="font-label-sm text-label-sm uppercase font-semibold text-primary tracking-wide flex items-center gap-1">
                <Icono nombre="magic_button" className="text-[16px]" />
                Conexión rápida con Lumy
              </span>
              <h2 className="font-headline-md text-headline-md text-on-surface font-semibold tracking-tight">
                ¿Qué necesitás para este ratito?
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Sin juzgar, sin notas que calificar. Solo un micro-espacio para vos.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-space-xs">
              {ACCESOS.map((a) => (
                <A
                  key={a.titulo}
                  href={`#/${a.ruta}`}
                  className={`group flex items-center gap-space-sm p-space-sm bg-surface-container-lowest ${a.hover} transition-all rounded-2xl shadow-sm text-left`}
                >
                  <div className={`w-10 h-10 rounded-xl ${a.tono} flex items-center justify-center group-hover:scale-110 transition-transform shrink-0`}>
                    <Icono nombre={a.simbolo} className="text-[20px]" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-label-lg text-label-lg text-on-surface font-semibold">{a.titulo}</span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">{a.pie}</span>
                  </div>
                </A>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================= 3 · Check-in rápido ================= */}
      <section
        className="lm-revelar bg-surface-container-lowest rounded-3xl p-space-lg md:p-space-xl shadow-[0_8px_28px_-6px_rgba(28,45,90,0.07)] flex flex-col gap-space-lg"
        style={escalon(2)}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-xs">
          <div>
            <div className="flex items-center gap-space-xs mb-1">
              <Icono nombre="energy_savings_leaf" className="text-primary text-[20px]" />
              <span className="font-label-sm text-label-sm uppercase font-semibold text-primary tracking-wide">
                Paso a paso
              </span>
            </div>
            <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
              Check-in emocional rápido
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Identificá cómo está tu energía en este instante para acompañarte mejor.
            </p>
          </div>
          <div className="flex items-center gap-space-xs text-on-surface-variant bg-surface-container-low px-space-sm py-space-2xs rounded-full self-start sm:self-auto">
            <Icono nombre="visibility_off" className="text-[16px] text-secondary" />
            <span className="font-label-sm text-label-sm">Solo visible para vos</span>
          </div>
        </div>

        {/* Ánimo */}
        <div className="flex flex-col gap-space-xs">
          <span className="font-label-md text-label-md text-on-surface font-medium">
            ¿Cómo anda tu ánimo hoy?
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-space-sm" role="group" aria-label="Elegí tu ánimo de hoy">
            {ANIMOS.map((a, i) => {
              const activo = animo === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => setAnimo(a.id)}
                  className={`group p-space-md rounded-2xl transition-all flex flex-col items-center text-center gap-space-2xs ${
                    i === 4 ? 'col-span-2 sm:col-span-1' : ''
                  } ${
                    activo
                      ? 'bg-secondary-fixed text-on-secondary-fixed ring-2 ring-secondary shadow-sm'
                      : `bg-surface-container-low text-on-surface ${a.hover}`
                  }`}
                >
                  <span className="text-3xl transition-transform group-hover:scale-125" aria-hidden="true">
                    {a.emoji}
                  </span>
                  <span className="font-label-lg text-label-lg font-semibold">{a.nombre}</span>
                  <span className={`font-body-sm text-body-sm ${activo ? 'opacity-80' : 'text-on-surface-variant'}`}>
                    {a.pie}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Qué influye */}
        <div className="flex flex-col gap-space-xs pt-space-xs">
          <span className="font-label-md text-label-md text-on-surface font-medium">
            ¿Qué está influyendo? Podés marcar varias.
          </span>
          <div className="flex flex-wrap gap-space-xs">
            {INFLUYE.map((t) => {
              const activo = influye.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => alternarInfluye(t.id)}
                  className={`px-space-md py-space-2xs rounded-full font-label-md text-label-md transition-colors flex items-center gap-1 ${
                    activo
                      ? 'bg-primary-fixed text-on-primary-fixed-variant'
                      : 'bg-surface-container-low hover:bg-surface-container text-on-surface'
                  }`}
                >
                  <Icono nombre={t.simbolo} className={`text-[16px] ${activo ? '' : 'text-secondary'}`} />
                  {t.texto}
                </button>
              );
            })}
          </div>
        </div>

        {/* Diario */}
        <div className="flex flex-col gap-space-2xs">
          <label
            className="font-label-md text-label-md text-on-surface font-medium flex items-center justify-between gap-space-xs"
            htmlFor="nota-diario"
          >
            <span>Palabras rápidas para tu diario (opcional):</span>
            <span className="text-on-surface-variant text-xs">Se guarda en tu teléfono</span>
          </label>
          <div className="relative">
            <input
              id="nota-diario"
              type="text"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Ej: hoy me siento más aliviado después de entregar el trabajo de biología…"
              className="w-full bg-surface-container-low text-on-surface placeholder:text-outline px-space-md py-space-sm pr-11 rounded-2xl focus:outline-none focus:bg-surface-container focus:shadow-[0_0_0_3px_rgba(189,164,243,0.35)] transition-all font-body-md text-body-md"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-primary">
              <Icono nombre="lock" className="text-[20px]" />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-space-md pt-space-2xs">
          <div className="flex items-center gap-space-xs text-on-surface-variant">
            <Icono nombre="shield_lock" className="text-[18px] text-secondary" />
            <span className="font-body-sm text-body-sm">
              Solo vos tenés la llave. Cero juicio, cero reportes.
            </span>
          </div>
          <button
            type="button"
            onClick={continuar}
            className="w-full sm:w-auto px-space-xl py-space-sm rounded-full bg-primary-container hover:bg-primary text-on-primary-container hover:text-on-primary font-label-lg text-label-lg transition-all transform active:scale-95 shadow-[0_4px_16px_rgba(189,164,243,0.35)] flex items-center justify-center gap-space-xs"
          >
            <Icono nombre="bookmark_heart" className="text-[20px]" />
            <span>{yaHizo ? 'Revisar mi check-in' : 'Seguir con el check-in'}</span>
          </button>
        </div>
      </section>

      {/* ================= 4 · Rejilla de bienestar ================= */}
      <section className="lm-revelar grid grid-cols-1 md:grid-cols-3 gap-space-md" style={escalon(3)}>

        <TarjetaRespiracion />

        {/* Mundo de calma */}
        <div className="bg-surface-container-lowest rounded-3xl p-space-lg shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-space-sm">
            <div className="w-10 h-10 rounded-2xl bg-tertiary-fixed flex items-center justify-center text-on-tertiary-fixed">
              <Icono nombre="auto_fix_high" className="text-[22px]" />
            </div>
            <span className="font-label-sm text-label-sm px-space-xs py-space-2xs rounded-full bg-surface-container text-tertiary font-semibold">
              Antiestrés
            </span>
          </div>
          <div className="space-y-space-2xs mb-space-sm">
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">Mundo de calma</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Cosas cortas para desconectar la mente que da vueltas.
            </p>
          </div>
          <div className="space-y-space-2xs my-auto">
            {[
              { emoji: '🌟', titulo: 'Cápsulas de un minuto', pie: 'Para ver entre clases' },
              { emoji: '🌧️', titulo: 'Sonido de lluvia', pie: 'Fondo para estudiar o dormir' },
            ].map((j) => (
              <A
                href="#/capsulas"
                key={j.titulo}
                className="p-space-xs bg-surface-container-low hover:bg-surface-container rounded-2xl flex items-center justify-between transition-colors group"
              >
                <div className="flex items-center gap-space-xs">
                  <span className="text-xl" aria-hidden="true">{j.emoji}</span>
                  <div className="flex flex-col">
                    <span className="font-label-md text-label-md text-on-surface font-semibold">{j.titulo}</span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">{j.pie}</span>
                  </div>
                </div>
                <Icono nombre="chevron_right" className="text-outline group-hover:text-primary transition-colors text-[20px]" />
              </A>
            ))}
          </div>
          <A
            href="#/capsulas"
            className="w-full mt-space-sm py-space-xs rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md transition-colors flex items-center justify-center gap-1"
          >
            <Icono nombre="sports_esports" className="text-[18px]" />
            Explorar todas las cápsulas
          </A>
        </div>

        {/* Red de confianza */}
        <div className="bg-surface-container-lowest rounded-3xl p-space-lg shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-space-sm">
            <div className="w-10 h-10 rounded-2xl bg-primary-fixed flex items-center justify-center text-on-primary-fixed-variant">
              <Icono nombre="support_agent" className="text-[22px]" />
            </div>
            <span className="font-label-sm text-label-sm px-space-xs py-space-2xs rounded-full bg-secondary-fixed/60 text-on-secondary-fixed font-semibold">
              {activos.length} {activos.length === 1 ? 'activa' : 'activas'}
            </span>
          </div>
          <div className="space-y-space-2xs mb-space-xs">
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">Mi red de confianza</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Personas que elegiste vos para cuando querás hablar.
            </p>
          </div>

          <div className="flex flex-col gap-space-xs my-auto">
            {activos.slice(0, 2).map((c) => (
              <div className="flex items-center justify-between p-space-2xs bg-surface-container-low rounded-2xl" key={c.id}>
                <div className="flex items-center gap-space-xs min-w-0">
                  <div className="w-9 h-9 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold text-xs shrink-0" aria-hidden="true">
                    {c.nombre.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-label-md text-label-md text-on-surface font-semibold truncate">
                      {c.nombre}
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
                      {c.relacion}
                    </span>
                  </div>
                </div>
                <span className="w-2.5 h-2.5 rounded-full bg-secondary shrink-0" aria-hidden="true" />
              </div>
            ))}
            {activos.length === 0 && (
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Todavía no elegiste a nadie. Podés hacerlo cuando querás.
              </p>
            )}
          </div>

          <A
            href="#/red"
            className="w-full mt-space-sm py-space-xs rounded-full bg-primary-container hover:bg-primary text-on-primary-container hover:text-on-primary font-label-md text-label-md transition-colors flex items-center justify-center gap-1"
          >
            <Icono nombre="forum" className="text-[18px]" />
            Pedir charla discreta
          </A>
        </div>
      </section>

      {/* ================= 5 · Tu huella ================= */}
      <section
        className="lm-revelar bg-surface-container-lowest rounded-3xl p-space-lg md:p-space-xl shadow-sm flex flex-col gap-space-md"
        style={escalon(4)}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-xs">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight">Tu huella</h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Comparada con vos mismo, nunca con los demás.
            </p>
          </div>
          <A
            href="#/historial"
            className="font-label-md text-label-md text-primary hover:underline self-start sm:self-auto whitespace-nowrap"
          >
            Ver todo →
          </A>
        </div>

        <LineaBase datos={gemelo.lineaBase} promedio={gemelo.promedioPropio} />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-sm">
          {ipsativa.map((item) => (
            <div className="p-space-md rounded-2xl bg-surface-container-low text-center" key={item.etiqueta}>
              <p className="font-headline-sm text-headline-sm text-on-surface font-bold">{item.valor}</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">{item.etiqueta}</p>
              <p className="font-label-sm text-label-sm text-secondary font-semibold mt-1">{item.delta}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ================= Privacidad y auxilio ================= */}
      <section
        className="lm-revelar p-space-md rounded-2xl bg-surface-container-lowest shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex items-start sm:items-center gap-space-sm"
        style={escalon(5)}
      >
        <div className="w-8 h-8 rounded-full bg-primary-fixed/60 text-primary flex items-center justify-center shrink-0">
          <Icono nombre="lock_clock" className="text-[18px]" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-xs w-full">
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            <span className="font-semibold text-on-surface">Tu privacidad es sagrada en Lumys:</span>{' '}
            tus notas y check-ins son privados y nunca se comparten palabra por palabra con
            profesores, dirección ni compañeros. ¿Necesitás hablar con alguien ahora?{' '}
            <strong className="text-on-surface">MIFAN 133</strong> y{' '}
            <strong className="text-on-surface">Policía Nacional 118</strong>, gratis las 24 horas.
          </p>
          <A
            href="#/perfil"
            className="font-label-sm text-label-sm text-primary hover:underline whitespace-nowrap font-medium self-start sm:self-auto"
          >
            Conocer mis derechos →
          </A>
        </div>
      </section>
    </section>
  );
}

/* --------------------------------------------------------------------------
 * Tarjeta de respiración
 * ------------------------------------------------------------------------
 * Se separa porque tiene estado propio —la fase del ciclo— y no tiene sentido
 * volver a dibujar el resto de la pantalla cada cuatro segundos.
 */
function TarjetaRespiracion() {
  const [inhala, setInhala] = useState(true);

  useEffect(() => {
    if (prefiereMenosMovimiento()) return;
    const reloj = setInterval(() => setInhala((v) => !v), 4000);
    return () => clearInterval(reloj);
  }, []);

  return (
    <div className="bg-surface-container-lowest rounded-3xl p-space-lg shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
      <div className="flex items-center justify-between mb-space-sm">
        <div className="w-10 h-10 rounded-2xl bg-secondary-fixed flex items-center justify-center text-on-secondary-fixed-variant">
          <Icono nombre="air" className="text-[22px]" />
        </div>
        <span className="font-label-sm text-label-sm px-space-xs py-space-2xs rounded-full bg-surface-container text-secondary font-semibold">
          1 min
        </span>
      </div>

      <div className="space-y-space-2xs mb-space-md">
        <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
          Respiración con Lumy
        </h3>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Seguí el compás visual de 4-4-4 para desinflar el estrés.
        </p>
      </div>

      <div className="py-space-md flex flex-col items-center justify-center relative">
        <div
          className={`w-24 h-24 rounded-full bg-gradient-to-tr from-secondary-fixed via-primary-fixed to-tertiary-fixed flex items-center justify-center shadow-[0_0_24px_rgba(181,231,253,0.6)] transition-transform duration-[4000ms] ease-in-out ${
            inhala ? 'scale-110' : 'scale-90'
          }`}
        >
          <span className="font-label-md text-label-md font-bold text-on-surface">
            {inhala ? 'Inhalá' : 'Exhalá'}
          </span>
        </div>
        <span className="font-label-sm text-label-sm text-secondary font-medium mt-3">
          {inhala ? 'Expandí el pecho suavemente' : 'Soltá el aire despacio'}
        </span>
      </div>

      <A
        href="#/respirar"
        className="w-full mt-space-xs py-space-xs rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md transition-colors flex items-center justify-center gap-1"
      >
        <Icono nombre="play_circle" className="text-[18px]" />
        Iniciar sesión guiada
      </A>

    </div>
  );
}

export default Inicio;
