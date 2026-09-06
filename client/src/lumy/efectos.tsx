/* ===========================================================================
 * Lumy — capas de efecto
 * ---------------------------------------------------------------------------
 * Lágrimas, gotas, espirales, confeti… Son elementos ADICIONALES, no rasgos:
 * viven fuera del cuerpo, en grupos que están vacíos en reposo, y no alteran
 * la silueta. Todos aparecen en las láminas de referencia que definió el
 * equipo de marca.
 *
 * Cada capa declara si va por detrás o por delante del cuerpo. Las de detrás
 * (vapor, líneas de impacto, nubarrón) tienen que quedar tapadas parcialmente
 * por el blob para leerse como profundidad; las de delante (lágrimas, sudor)
 * caen sobre la cara.
 *
 * Se montan las ocho una sola vez y se controlan por opacidad. Montarlas y
 * desmontarlas en cada cambio de emoción provocaría un reflow por gesto.
 * =========================================================================== */

import type { ReactElement } from 'react';
import type { ClaveFx } from './emociones.ts';

export type Capa = 'tras' | 'frente';

export const EFECTOS: Record<ClaveFx, { capa: Capa; contenido: ReactElement }> = {

  lagrima: {
    capa: 'frente',
    contenido: (
      <g fill="#AEE0F6" opacity="0.9">
        <path className="lumy-fx-gota" d="M96 128 c0 0 5.5 8.4 5.5 12.2 a5.5 5.5 0 0 1-11 0 C90.5 136.4 96 128 96 128 Z" />
        <path className="lumy-fx-gota" d="M144 130 c0 0 4.6 7 4.6 10.2 a4.6 4.6 0 0 1-9.2 0 C139.4 137 144 130 144 130 Z" />
      </g>
    ),
  },

  sudor: {
    capa: 'frente',
    contenido: (
      <g fill="#CDE9F8" opacity="0.92">
        <path className="lumy-fx-gota" d="M168 72 c0 0 6 9.2 6 13.3 a6 6 0 0 1-12 0 C162 81.2 168 72 168 72 Z" />
      </g>
    ),
  },

  espiral: {
    capa: 'frente',
    contenido: (
      <g fill="none" stroke="#6C4BC1" strokeWidth="2.4" strokeLinecap="round" opacity="0.55">
        <path className="lumy-fx-giro" d="M84 78 a7 7 0 1 1-6.4 4.2 a11 11 0 1 0 12.6-6.6" />
        <path className="lumy-fx-giro" d="M158 82 a5.4 5.4 0 1 1-5 3.2 a8.6 8.6 0 1 0 9.8-5.2" />
      </g>
    ),
  },

  confeti: {
    capa: 'frente',
    contenido: (
      <g className="lumy-fx-confeti">
        <rect x="60" y="58" width="5" height="9" rx="2" fill="#E0A32A" transform="rotate(24 62 62)" />
        <rect x="182" y="72" width="5" height="9" rx="2" fill="#7CC6E8" transform="rotate(-38 184 76)" />
        <rect x="72" y="176" width="5" height="9" rx="2" fill="#FFD77A" transform="rotate(52 74 180)" />
        <rect x="176" y="160" width="5" height="9" rx="2" fill="#AEE0F6" transform="rotate(-16 178 164)" />
        <circle cx="52" cy="112" r="3.1" fill="#FFD77A" />
        <circle cx="196" cy="128" r="2.7" fill="#E0A32A" />
        <circle cx="104" cy="42" r="2.4" fill="#7CC6E8" />
      </g>
    ),
  },

  corazon: {
    capa: 'frente',
    contenido: (
      <g fill="#CDB2FF" opacity="0.85">
        <path
          className="lumy-fx-corazon"
          transform="translate(180 78) scale(0.62)"
          d="M0 12 C-14 2-14-10-6-13 C-2-14.6 0-11.6 0-9.4 C0-11.6 2-14.6 6-13 C14-10 14 2 0 12 Z"
        />
        <path
          className="lumy-fx-corazon"
          transform="translate(196 104) scale(0.4)"
          opacity="0.7"
          d="M0 12 C-14 2-14-10-6-13 C-2-14.6 0-11.6 0-9.4 C0-11.6 2-14.6 6-13 C14-10 14 2 0 12 Z"
        />
      </g>
    ),
  },

  vapor: {
    capa: 'tras',
    contenido: (
      <g fill="none" stroke="#DD8B63" strokeWidth="3" strokeLinecap="round" opacity="0.55">
        <path className="lumy-fx-vapor" d="M74 50 c-4-6 4-10 0-16" />
        <path className="lumy-fx-vapor" d="M120 40 c-4-7 4-11 0-18" />
        <path className="lumy-fx-vapor" d="M166 50 c-4-6 4-10 0-16" />
      </g>
    ),
  },

  lineas: {
    capa: 'tras',
    contenido: (
      <g stroke="#6C4BC1" strokeWidth="3" strokeLinecap="round" opacity="0.4">
        <path d="M32 60 l-11-9" />
        <path d="M120 26 l0-13" />
        <path d="M208 60 l11-9" />
        <path d="M26 130 l-13 3" />
        <path d="M214 130 l13 3" />
      </g>
    ),
  },

  // A escala 1 y en su sitio original la nube se sale por arriba del viewBox:
  // el borde superior del blob está a y=15 y no queda hueco. Reducida y
  // corrida a la izquierda entra entera (y 3..39) y además deja de tapar la
  // cara, que es lo que tiene que seguir leyéndose.
  nube: {
    capa: 'tras',
    contenido: (
      <g opacity="0.75" transform="translate(-26 14) scale(0.8)">
        <path
          d="M96 30 a15 15 0 0 1 28-6 a13 13 0 0 1 20 10 a11 11 0 0 1-3 21 H100 a13 13 0 0 1-4-25 Z"
          fill="#A9C9EA"
        />
        <g stroke="#7095B7" strokeWidth="3.4" strokeLinecap="round">
          <path className="lumy-fx-lluvia" d="M108 60 l-3 9" />
          <path className="lumy-fx-lluvia" d="M124 58 l-3 11" />
          <path className="lumy-fx-lluvia" d="M140 61 l-3 8" />
        </g>
      </g>
    ),
  },
};
