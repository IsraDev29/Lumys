/* ===========================================================================
 * Lumy — pruebas del rig
 * ---------------------------------------------------------------------------
 * La prueba que importa es la primera: que la pose `neutral` reproduzca
 * EXACTAMENTE el archivo client/public/img/lumys-mascota.svg.
 *
 * El encargo fue explícito: no cambiar ningún rasgo ni la forma de la mascota.
 * El rig cumple eso deformando la geometría original en vez de redibujarla,
 * pero nada impide que dentro de seis meses alguien "acomode" una constante en
 * lumy/emociones.ts y la silueta se corra dos píxeles sin que nadie lo note.
 * Estas pruebas hacen que eso falle en CI en vez de en producción.
 *
 * ---------------------------------------------------------------------------
 * Se compara contra client/public/, que es el archivo que Vite copia al build y
 * que el servidor termina sirviendo. Es a propósito: si la prueba midiera una
 * copia guardada en otro lado, pasaría en verde mientras el dibujo que ve el
 * estudiante se movió, que es el peor de los dos mundos.
 * =========================================================================== */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const E = require('../client/src/lumy/emociones.ts');
const N = require('../client/src/lumy/nucleo.ts');

const ORIGINAL = fs.readFileSync(
  path.join(__dirname, '..', 'client', 'public', 'img', 'lumys-mascota.svg'), 'utf8');

const neutral = () => N.resolver(E.pose('neutral'));

/** Primer grupo de captura, o null. Evita el `[0][1]` de las expresiones sin
 *  grupo, que es donde se tropieza siempre. */
const capturar = (texto, re) => (texto.match(re) || [])[1] || null;

describe('fidelidad con el archivo original', () => {

  test('el path del blob es idéntico, carácter por carácter', () => {
    const enArchivo = capturar(ORIGINAL, /<path d="(M204\.80[^"]+)"/);
    assert.ok(enArchivo, 'no se encontró el path del blob en el SVG original');
    assert.strictEqual(E.GEO.blob, enArchivo);
  });

  test('los cinco stops del gradiente del cuerpo son los del archivo', () => {
    const bloque = capturar(ORIGINAL, /(<radialGradient id="body"[\s\S]*?<\/radialGradient>)/);
    const enArchivo = [...bloque.matchAll(/stop-color="(#[0-9A-Fa-f]{6})"/g)].map((m) => m[1]);
    assert.deepStrictEqual(E.PALETAS.menta.cuerpo, enArchivo);
  });

  test('el halo y el borde interno conservan sus colores propios', () => {
    // No son stops del gradiente del cuerpo: son dos valores aparte. Es
    // justo el detalle que se perdió al hacer que la paleta tiñera el halo,
    // y por eso se declaran explícitos en cada paleta.
    const halo = capturar(ORIGINAL, /<radialGradient id="halo"[\s\S]*?stop-color="(#[0-9A-Fa-f]{6})"/);
    const rim = capturar(ORIGINAL, /<linearGradient id="rim"[\s\S]*?stop-color="(#[0-9A-Fa-f]{6})"/);
    assert.strictEqual(E.PALETAS.menta.halo, halo);
    assert.strictEqual(E.PALETAS.menta.rim, rim);
  });

  test('el color de tinta de ojos y boca es el del archivo', () => {
    const tinta = capturar(ORIGINAL, /<g fill="(#065F46)">/);
    assert.strictEqual(E.PALETAS.menta.tinta, tinta);
  });

  test('los ojos caen en sus centros y radios originales', () => {
    const ojos = [...ORIGINAL.matchAll(
      /<ellipse cx="(\d+)"\s+cy="(113)" rx="(12)" ry="(14)"\/>/g)].map((m) => Number(m[1]));
    assert.deepStrictEqual(ojos, [96, 144], 'el archivo original cambió de ojos');

    const p = neutral();
    assert.strictEqual(N.trOjo('izq', p), 'translate(96, 113)');
    assert.strictEqual(N.trOjo('der', p), 'translate(144, 113)');
    assert.strictEqual(E.GEO.ojos.rx, 12);
    assert.strictEqual(E.GEO.ojos.ry, 14);
  });

  test('la boca en reposo empieza y termina donde la cuadrática original', () => {
    const d = capturar(ORIGINAL, /d="(M109 136 Q120 147\.5 131 136)"/);
    assert.ok(d, 'el archivo original cambió de boca');

    // El rig la parte en seis tramos por la forma polar. Partirla es exacto,
    // así que los extremos tienen que caer clavados en los del original.
    const boca = N.boca(neutral());
    assert.match(boca, /^M 109 136 /, 'el extremo izquierdo se movió');
    assert.match(boca, / 131 136 Q /, 'el extremo derecho se movió');
  });

  test('la partición de la boca reproduce la curva original punto por punto', () => {
    // Se comprueba contra la cuadrática evaluada a mano: B(t) con
    // P0=(109,136) P1=(120,147.5) P2=(131,136).
    const B = (t) => [
      (1 - t) * (1 - t) * 109 + 2 * (1 - t) * t * 120 + t * t * 131,
      (1 - t) * (1 - t) * 136 + 2 * (1 - t) * t * 147.5 + t * t * 136,
    ];
    const boca = N.boca(neutral());
    // Los extremos de cada tramo son los puntos finales de cada `Q`.
    const finales = [...boca.matchAll(/Q [\d.-]+ [\d.-]+ ([\d.-]+) ([\d.-]+)/g)]
      .slice(0, 6).map((m) => [Number(m[1]), Number(m[2])]);

    assert.strictEqual(finales.length, 6);
    finales.forEach((pt, i) => {
      const esperado = B((i + 1) / 6);
      assert.ok(Math.abs(pt[0] - esperado[0]) < 0.002, `tramo ${i}: x se desvió`);
      assert.ok(Math.abs(pt[1] - esperado[1]) < 0.002, `tramo ${i}: y se desvió`);
    });
  });

  test('en reposo no hay transformación ni efectos', () => {
    const p = neutral();
    // Identidad: traslación cero, rotación cero, escala uno.
    assert.match(N.trCuerpo(p), /translate\(0, 0\).*rotate\(0\).*scale\(1, 1\)/);
    assert.match(N.trCara(p), /translate\(0, 0\).*rotate\(0\).*scale\(1, 1\)/);
    assert.strictEqual(N.parpado('izq', p, null, 1), '-20,-18 20,-18 20,18 -20,18');

    for (const fx of ['lagrima', 'sudor', 'espiral', 'confeti', 'corazon', 'vapor', 'lineas', 'nube']) {
      assert.strictEqual(N.valorFx(p, fx), 0, `el efecto ${fx} está encendido en reposo`);
    }
    const op = N.opacidades(p);
    assert.strictEqual(op.rubor, 0.42, 'el rubor no está en el 0.42 del archivo');
    assert.strictEqual(op.ojoArco, 0, 'el ojo en arco no debería verse en reposo');
  });
});

describe('catálogo de emociones', () => {

  test('toda emoción declara nombre, familia, banda y pista', () => {
    for (const clave of E.CLAVES) {
      const d = E.EMOCIONES[clave];
      assert.ok(d.nombre, `${clave}: falta nombre`);
      assert.ok(E.FAMILIAS[d.familia], `${clave}: familia "${d.familia}" no existe`);
      assert.ok(['apoyo', 'espejo'].includes(d.banda), `${clave}: banda inválida`);
      assert.ok(d.pista, `${clave}: falta la pista que lee el estudiante`);
    }
  });

  test('toda pose usa canales que existen y paletas que existen', () => {
    for (const clave of E.CLAVES) {
      for (const canal of Object.keys(E.EMOCIONES[clave].pose)) {
        assert.ok(canal in E.BASE, `${clave}: el canal "${canal}" no existe en BASE`);
      }
      const pal = E.EMOCIONES[clave].pose.paleta;
      if (pal) assert.ok(E.PALETAS[pal], `${clave}: la paleta "${pal}" no existe`);
    }
  });

  test('las ocho ramas de Plutchik están completas en tres intensidades', () => {
    const ramas = ['alegria', 'confianza', 'miedo', 'sorpresa',
                   'tristeza', 'aversion', 'enojo', 'anticipacion'];
    for (const rama of ramas) {
      const niveles = E.CLAVES
        .filter((c) => E.EMOCIONES[c].familia === rama)
        .map((c) => E.EMOCIONES[c].intensidad)
        .sort();
      assert.deepStrictEqual(niveles, [1, 2, 3], `la rama ${rama} no tiene sus tres intensidades`);
    }
  });

  test('cada paleta trae sus cinco stops más tinta, halo y borde', () => {
    for (const [nombre, p] of Object.entries(E.PALETAS)) {
      assert.strictEqual(p.cuerpo.length, 5, `paleta ${nombre}: no son cinco stops`);
      for (const c of [...p.cuerpo, p.tinta, p.halo, p.rim]) {
        assert.match(c, /^#[0-9A-Fa-f]{6}$/, `paleta ${nombre}: "${c}" no es un hex de seis`);
      }
    }
  });
});

describe('banda de seguridad', () => {

  // La razón está en la cabecera de lumy-emociones.js: si un estudiante
  // reporta angustia y la mascota se angustia, se valida el afecto pero se
  // amplifica. La app tiene que ser el elemento regulado de la conversación.

  test('ninguna emoción del tramo negativo es de adopción automática', () => {
    const deben = ['tristeza', 'pena', 'miedo', 'terror', 'enojo', 'furia',
                   'agobio', 'soledad', 'culpa', 'verguenza', 'repulsion'];
    for (const clave of deben) {
      assert.strictEqual(E.EMOCIONES[clave].banda, 'espejo',
        `${clave} tendría que ser de banda espejo: Lumy no la puede adoptar sola`);
    }
  });

  test('el mapeo por clima nunca devuelve una emoción de espejo', () => {
    for (const [clima, clave] of Object.entries(E.POR_CLIMA)) {
      assert.strictEqual(E.EMOCIONES[clave].banda, 'apoyo',
        `el clima "${clima}" devuelve "${clave}", que es de espejo`);
    }
  });

  test('el peor tramo del ICVE da acompañamiento, no espejo', () => {
    // ICVE alto = más vulnerabilidad. Es justo cuando la mascota tiene que
    // sostener, no hundirse con el estudiante.
    for (const icve of [0, 24, 25, 44, 45, 64, 65, 85, 100]) {
      const clave = E.porIcve(icve);
      assert.strictEqual(E.EMOCIONES[clave].banda, 'apoyo',
        `ICVE ${icve} devuelve "${clave}", que es de espejo`);
    }
    assert.strictEqual(E.porIcve(100), 'empatia');
    assert.strictEqual(E.porIcve(null), 'neutral');
  });

  test('APOYO y las de espejo particionan el catálogo', () => {
    const espejo = E.CLAVES.filter((c) => E.EMOCIONES[c].banda === 'espejo');
    assert.strictEqual(E.APOYO.length + espejo.length, E.CLAVES.length);
    assert.ok(E.APOYO.length >= 10, 'quedan muy pocas emociones que Lumy pueda adoptar');
  });
});

describe('interpolación', () => {

  test('mezclar una pose consigo misma la devuelve intacta', () => {
    for (const clave of ['alegria', 'tristeza', 'enojo']) {
      const p = N.resolver(E.pose(clave));
      const m = N.mezclarPose(p, p, 0.5);
      assert.strictEqual(m.cuerpoSX, p.cuerpoSX);
      assert.deepStrictEqual(m.cuerpo, p.cuerpo);
      assert.strictEqual(m.tinta, p.tinta);
    }
  });

  test('los extremos de la mezcla caen en las poses de origen y destino', () => {
    const a = N.resolver(E.pose('neutral'));
    const b = N.resolver(E.pose('euforia'));
    assert.strictEqual(N.mezclarPose(a, b, 0).cuerpoSY, a.cuerpoSY);
    assert.strictEqual(N.mezclarPose(a, b, 1).cuerpoSY, b.cuerpoSY);
    assert.strictEqual(N.mezclarPose(a, b, 0).tinta, a.tinta);
    assert.strictEqual(N.mezclarPose(a, b, 1).tinta, b.tinta);
  });

  test('el color se interpola por canal y sigue siendo hex válido', () => {
    const medio = N.mezclarColor('#000000', '#FFFFFF', 0.5);
    assert.strictEqual(medio, '#808080');
    assert.strictEqual(N.mezclarColor('#065F46', '#065F46', 0.3), '#065F46');
    const p = N.mezclarPose(N.resolver(E.pose('neutral')), N.resolver(E.pose('enojo')), 0.37);
    for (const c of [...p.cuerpo, p.tinta, p.halo, p.rim]) {
      assert.match(c, /^#[0-9a-f]{6}$/i);
    }
  });
});

describe('el ceño fruncido sin cejas', () => {

  // Lumy no tiene cejas y el encargo prohíbe agregarle rasgos. El enojo se
  // construye inclinando el párpado: la esquina interna baja y la externa
  // sube. Con el signo invertido sale la ceja preocupada de la tristeza.

  const alturas = (clave, lado) => {
    const pts = N.parpado(lado, N.resolver(E.pose(clave)), null, 1).split(' ');
    return { externo: Number(pts[0].split(',')[1]), interno: Number(pts[1].split(',')[1]) };
  };

  test('en el enojo la esquina interna del párpado queda por debajo de la externa', () => {
    for (const clave of ['fastidio', 'enojo', 'furia']) {
      const izq = alturas(clave, 'izq');
      assert.ok(izq.interno > izq.externo,
        `${clave}: la interna (${izq.interno}) tendría que estar más abajo que la externa (${izq.externo})`);
    }
  });

  test('en la tristeza y el miedo la inclinación se invierte', () => {
    for (const clave of ['melancolia', 'tristeza', 'pena', 'miedo', 'terror', 'agobio']) {
      const izq = alturas(clave, 'izq');
      assert.ok(izq.interno < izq.externo,
        `${clave}: la interna (${izq.interno}) tendría que estar más arriba que la externa (${izq.externo})`);
    }
  });

  test('los párpados son espejo entre un ojo y el otro', () => {
    const i = alturas('enojo', 'izq');
    const d = alturas('enojo', 'der');
    assert.strictEqual(i.externo, d.interno);
    assert.strictEqual(i.interno, d.externo);
  });
});
