#!/usr/bin/env node
/* ===========================================================================
 * Lumy — exportador de SVG por emoción
 * ---------------------------------------------------------------------------
 *     node tools/lumy-exportar-svg.js [carpeta-destino]
 *     npm run lumy:svg
 *
 * Escribe un SVG autocontenido por cada estado del catálogo, más un archivo
 * base con el rig en reposo. Están pensados para importarse en Rive, pero
 * sirven igual para prensa, stickers o cualquier cosa que necesite un Lumy
 * quieto con una emoción concreta.
 *
 * Usa el MISMO núcleo geométrico que el rig del navegador
 * (client/src/lumy/nucleo.ts), así que lo que sale acá es cuadro por cuadro lo
 * que ve el estudiante en la app. No hay una segunda implementación que se
 * pueda desincronizar.
 *
 * ---------------------------------------------------------------------------
 * NOTAS PARA RIVE
 *
 * El importador de Rive no es un navegador. Tres cosas a saber:
 *
 *   1. `<filter>` (feGaussianBlur) se ignora. Afecta al brillo difuso del
 *      cuerpo y al rubor, que llegarán con borde duro. En Rive se rehacen con
 *      un blur del propio editor, o se deja el borde duro: a tamaño de app
 *      casi no se nota. Por eso el exportador puede correr con --sin-filtros.
 *   2. `<clipPath>` llega, pero conviene rehacer el párpado como un grupo con
 *      máscara nativa para poder animarlo desde el state machine.
 *   3. Los gradientes radiales con `r` en porcentaje se importan bien; los
 *      `stop-opacity` también.
 *
 * El detalle de cómo rearmar el rig completo está en docs/lumy-rive-spec.md.
 * =========================================================================== */

'use strict';

const fs = require('fs');
const path = require('path');

const E = require('../client/src/lumy/emociones.ts');
const N = require('../client/src/lumy/nucleo.ts');

const { GEO, EMOCIONES, CLAVES } = E;

const args = process.argv.slice(2);
const SIN_FILTROS = args.includes('--sin-filtros');
const DESTINO = path.resolve(
  args.find((a) => !a.startsWith('--')) || path.join(__dirname, '..', 'brand-lumy')
);

/* --------------------------------------------------------------------------
 * Las capas de efecto. Se declaran acá y no se importan de lumy.js porque ese
 * archivo es de navegador (toca `document` al construirse). Es la única cosa
 * duplicada, y es marcado estático sin aritmética: si cambia, cambia el dibujo
 * de una lágrima, no la posición de un ojo.
 * ------------------------------------------------------------------------ */
const FX = {
  lagrima: ['frente', `<g fill="#7FC6E8" opacity="0.9">
    <path d="M96 128 c0 0 5.5 8.4 5.5 12.2 a5.5 5.5 0 0 1-11 0 C90.5 136.4 96 128 96 128 Z"/>
    <path d="M144 130 c0 0 4.6 7 4.6 10.2 a4.6 4.6 0 0 1-9.2 0 C139.4 137 144 130 144 130 Z"/></g>`],
  sudor: ['frente', `<g fill="#8ED3EE" opacity="0.92">
    <path d="M168 72 c0 0 6 9.2 6 13.3 a6 6 0 0 1-12 0 C162 81.2 168 72 168 72 Z"/></g>`],
  espiral: ['frente', `<g fill="none" stroke="#0F766E" stroke-width="2.4" stroke-linecap="round" opacity="0.55">
    <path d="M84 78 a7 7 0 1 1-6.4 4.2 a11 11 0 1 0 12.6-6.6"/>
    <path d="M158 82 a5.4 5.4 0 1 1-5 3.2 a8.6 8.6 0 1 0 9.8-5.2"/></g>`],
  confeti: ['frente', `<g>
    <rect x="60" y="58" width="5" height="9" rx="2" fill="#C2410C" transform="rotate(24 62 62)"/>
    <rect x="182" y="72" width="5" height="9" rx="2" fill="#2A9D8C" transform="rotate(-38 184 76)"/>
    <rect x="72" y="176" width="5" height="9" rx="2" fill="#E2C069" transform="rotate(52 74 180)"/>
    <rect x="176" y="160" width="5" height="9" rx="2" fill="#6FCBBB" transform="rotate(-16 178 164)"/>
    <circle cx="52" cy="112" r="3.1" fill="#E2C069"/><circle cx="196" cy="128" r="2.7" fill="#C2410C"/>
    <circle cx="104" cy="42" r="2.4" fill="#2A9D8C"/></g>`],
  corazon: ['frente', `<g fill="#E08FA8" opacity="0.85">
    <path transform="translate(180 78) scale(0.62)" d="M0 12 C-14 2-14-10-6-13 C-2-14.6 0-11.6 0-9.4 C0-11.6 2-14.6 6-13 C14-10 14 2 0 12 Z"/>
    <path transform="translate(196 104) scale(0.4)" opacity="0.7" d="M0 12 C-14 2-14-10-6-13 C-2-14.6 0-11.6 0-9.4 C0-11.6 2-14.6 6-13 C14-10 14 2 0 12 Z"/></g>`],
  vapor: ['tras', `<g fill="none" stroke="#DD8B63" stroke-width="3" stroke-linecap="round" opacity="0.55">
    <path d="M74 50 c-4-6 4-10 0-16"/><path d="M120 40 c-4-7 4-11 0-18"/><path d="M166 50 c-4-6 4-10 0-16"/></g>`],
  lineas: ['tras', `<g stroke="#0F766E" stroke-width="3" stroke-linecap="round" opacity="0.4">
    <path d="M32 60 l-11-9"/><path d="M120 26 l0-13"/><path d="M208 60 l11-9"/>
    <path d="M26 130 l-13 3"/><path d="M214 130 l13 3"/></g>`],
  nube: ['tras', `<g opacity="0.75" transform="translate(-26 14) scale(0.8)">
    <path d="M96 30 a15 15 0 0 1 28-6 a13 13 0 0 1 20 10 a11 11 0 0 1-3 21 H100 a13 13 0 0 1-4-25 Z" fill="#ABBDD1"/>
    <g stroke="#7095B7" stroke-width="3.4" stroke-linecap="round">
      <path d="M108 60 l-3 9"/><path d="M124 58 l-3 11"/><path d="M140 61 l-3 8"/></g></g>`],
};

/* --------------------------------------------------------------------------
 * Plantilla
 * ------------------------------------------------------------------------ */

/**
 * Un SVG completo para una pose. Todo va como ATRIBUTO, no como CSS: un
 * archivo suelto tiene que verse igual abierto en Inkscape, en Illustrator o
 * en el importador de Rive, y ninguno de los tres garantiza `transform-box`.
 *
 * Los `id` son los nombres con los que hay que rearmar la jerarquía en Rive.
 * Coinciden uno a uno con los grupos de docs/lumy-rive-spec.md.
 */
function svgDePose(clave, p, meta) {
  const g = GEO;
  const [dx, dy] = g.desfase;
  const op = N.opacidades(p);
  const asim = (EMOCIONES[clave] || {}).asimetria || null;

  const filtroSuave = SIN_FILTROS ? '' : ' filter="url(#soft)"';
  const filtroRubor = SIN_FILTROS ? '' : ' filter="url(#soft2)"';

  const defsFiltros = SIN_FILTROS ? '' : `
    <filter id="soft" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="8"/></filter>
    <filter id="soft2" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="4"/></filter>`;

  const ojo = (lado) => `
      <g id="ojo-${lado}" transform="${N.trOjo(lado, p)}">
        <g id="ojo-${lado}-mov" transform="${N.trOjoMov(lado, p, asim)}">
          <g id="ojo-${lado}-abierto" opacity="${op.ojoAbierto}" clip-path="url(#parpado-${lado})">
            <ellipse id="ojo-${lado}-globo" rx="${g.ojos.rx}" ry="${g.ojos.ry}" fill="${p.tinta}"/>
            <g id="ojo-${lado}-brillo" fill="#FFF7ED" opacity="${op.ojoBrillo}">
              ${g.brillosOjo.map((b) => `<circle cx="${b.dx}" cy="${b.dy}" r="${b.r}"/>`).join('')}
            </g>
          </g>
          <path id="ojo-${lado}-arco" d="${N.arcoOjo(p)}" fill="none" stroke="${p.tinta}"
                stroke-width="4" stroke-linecap="round" opacity="${op.ojoArco}"/>
        </g>
      </g>`;

  const capa = (dónde) => Object.keys(FX)
    .filter((k) => FX[k][0] === dónde && N.valorFx(p, k) > 0.01)
    .map((k) => `<g id="fx-${k}" opacity="${N.valorFx(p, k)}">${FX[k][1]}</g>`)
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Lumy · ${meta.nombre} (${clave})
     ${meta.familia}${meta.intensidad ? ' · intensidad ' + meta.intensidad : ''} · banda ${meta.banda}
     "${meta.pista}"

     Generado por tools/lumy-exportar-svg.js desde client/src/lumy/emociones.ts.
     NO editar a mano: se regenera. Para cambiar la pose, tocá el catálogo.  -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${g.viewBox}" width="207" height="176"
     role="img" aria-label="Lumy — ${meta.nombre}">
  <title>Lumy — ${meta.nombre}</title>
  <desc>${meta.pista}</desc>
  <defs>
    <radialGradient id="cuerpo" cx="33%" cy="22%" r="86%">
      ${p.cuerpo.map((c, i) => `<stop offset="${[0, 26, 52, 76, 100][i]}%" stop-color="${c}"/>`).join('\n      ')}
    </radialGradient>
    <linearGradient id="rim" x1="0" y1="0.48" x2="0.18" y2="1">
      <stop offset="0%" stop-color="${p.rim}" stop-opacity="0"/>
      <stop offset="100%" stop-color="${p.rim}" stop-opacity="0.42"/>
    </linearGradient>
    <radialGradient id="core" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FFF7ED" stop-opacity="0.62"/>
      <stop offset="100%" stop-color="#FFF7ED" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="halo" cx="50%" cy="50%" r="50%">
      <stop offset="52%" stop-color="${p.halo}" stop-opacity="0.34"/>
      <stop offset="100%" stop-color="${p.halo}" stop-opacity="0"/>
    </radialGradient>${defsFiltros}
    <clipPath id="parpado-izq"><polygon points="${N.parpado('izq', p, asim, 1)}"/></clipPath>
    <clipPath id="parpado-der"><polygon points="${N.parpado('der', p, asim, 1)}"/></clipPath>
  </defs>

  <g id="mundo" transform="translate(${dx} ${dy})">
    <g id="fx-tras">${capa('tras')}</g>

    <ellipse id="aura" cx="${g.halo.cx}" cy="${g.halo.cy}" rx="${g.halo.rx}" ry="${g.halo.ry}"
             fill="url(#halo)" opacity="${op.aura}" transform="${N.trAura(p)}"/>

    <g id="cuerpo" transform="${N.trCuerpo(p)}">
      <path id="blob" d="${g.blob}" fill="url(#cuerpo)"/>
      <path id="rim" d="${g.blob}" fill="url(#rim)"/>
      <ellipse id="core" cx="${g.core.cx}" cy="${g.core.cy}" rx="${g.core.rx}" ry="${g.core.ry}" fill="url(#core)"/>
      <g id="brillos" opacity="${op.brillos}">
        <g${filtroSuave} opacity="0.7">
          <ellipse cx="${g.brilloSuave.cx}" cy="${g.brilloSuave.cy}" rx="${g.brilloSuave.rx}" ry="${g.brilloSuave.ry}"
                   transform="rotate(${g.brilloSuave.rot} ${g.brilloSuave.cx} ${g.brilloSuave.cy})" fill="#FFF7ED"/>
        </g>
        <ellipse cx="${g.brilloDuro.cx}" cy="${g.brilloDuro.cy}" rx="${g.brilloDuro.rx}" ry="${g.brilloDuro.ry}"
                 transform="rotate(${g.brilloDuro.rot} ${g.brilloDuro.cx} ${g.brilloDuro.cy})" fill="#FFF7ED" opacity="0.9"/>
        <g id="motas" fill="#FFF7ED" opacity="0.65">
          ${g.motas.map((m) => `<circle cx="${m.cx}" cy="${m.cy}" r="${m.r}"/>`).join('')}
        </g>
      </g>
    </g>

    <g id="cara" transform="${N.trCara(p)}">
      <g id="rubor"${filtroRubor} fill="#C2410C" opacity="${op.rubor}">
        ${g.rubor.map((r, i) => `<ellipse cx="${r.cx}" cy="${r.cy}" rx="${r.rx}" ry="${r.ry}" transform="${N.trRubor(p, i)}"/>`).join('\n        ')}
      </g>
      <g id="ojos">${ojo('izq')}${ojo('der')}
      </g>
      <path id="boca" d="${N.boca(p)}" fill="${p.tinta}" stroke="${p.tinta}"
            stroke-width="${N.clamp(g.boca.grosor * p.bocaGrosor, 0, 20)}"
            stroke-linecap="round" stroke-linejoin="round"/>
    </g>

    <g id="chispas" opacity="${op.chispas}">
      ${g.chispas.map((c, i) => `<path d="${g.chispaPath}" fill="${c.color}" opacity="${c.op}" transform="${N.trChispa(p, i)}"/>`).join('\n      ')}
    </g>

    <g id="fx-frente">${capa('frente')}</g>
  </g>
</svg>
`;
}

/* --------------------------------------------------------------------------
 * Ejecución
 * ------------------------------------------------------------------------ */

function main() {
  const carpeta = path.join(DESTINO, 'emociones');
  fs.mkdirSync(carpeta, { recursive: true });

  let bytes = 0;
  for (const clave of CLAVES) {
    const def = EMOCIONES[clave];
    const pose = N.resolver(E.pose(clave));
    const texto = svgDePose(clave, pose, def);
    const archivo = path.join(carpeta, `lumy-${clave}.svg`);
    fs.writeFileSync(archivo, texto, 'utf8');
    bytes += Buffer.byteLength(texto);
  }

  // El base es `neutral` sin efectos: es el que se importa a Rive para armar
  // el rig. Los otros 32 son destinos de keyframe, no artboards.
  const base = svgDePose('neutral', N.resolver(E.pose('neutral')), EMOCIONES.neutral);
  fs.writeFileSync(path.join(DESTINO, 'lumy-rig-base.svg'), base, 'utf8');

  // Un índice legible, para no tener que abrir 33 archivos para saber cuál es cuál.
  const filas = CLAVES.map((c) => {
    const d = EMOCIONES[c];
    return `| \`${c}\` | ${d.nombre} | ${d.familia} | ${d.intensidad || '—'} | ${d.banda} | ${d.pista} |`;
  });
  fs.writeFileSync(path.join(DESTINO, 'INDICE.md'),
    `# Lumy — emociones exportadas\n\n`
    + `Generado por \`tools/lumy-exportar-svg.js\`. No editar a mano.\n\n`
    + `${CLAVES.length} estados · núcleo v${N.VERSION} · catálogo v${E.VERSION}\n\n`
    + `Las de banda **espejo** solo se muestran cuando el estudiante nombra su\n`
    + `propia emoción. Lumy nunca las adopta por su cuenta. Ver la nota de\n`
    + `seguridad en \`client/src/lumy/emociones.ts\`.\n\n`
    + `| clave | nombre | familia | int. | banda | pista |\n|---|---|---|---|---|---|\n`
    + filas.join('\n') + '\n', 'utf8');

  console.log(`Lumy · ${CLAVES.length} emociones exportadas`);
  console.log(`  destino:  ${DESTINO}`);
  console.log(`  filtros:  ${SIN_FILTROS ? 'omitidos (--sin-filtros)' : 'incluidos'}`);
  console.log(`  tamaño:   ${(bytes / 1024).toFixed(1)} KB en total`);
}

main();
