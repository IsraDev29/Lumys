const test = require('node:test');
const assert = require('node:assert');

process.env.IA_PROVEEDOR = 'ninguno';
const voz = require('../src/IA/ia.voz.service');

// ---------------------------------------------------------------------------
// Análisis de voz
//
// El backend nunca recibe audio ni transcripción: solo características
// prosódicas ya extraídas en el navegador. Lo que se prueba acá es que esa
// frontera se respete y que la comparación contra el propio historial del
// estudiante — que es la única que dice algo — funcione.
// ---------------------------------------------------------------------------

test('el análisis de voz exige consentimiento explícito', async () => {
    // Sin valor por defecto y sin aceptar equivalentes: el consentimiento se
    // otorga, no se deduce. Con menores de por medio eso no es formalismo.
    for (const consentimiento of [undefined, false, null, 'sí', 1]) {
        await assert.rejects(
            () => voz.analizarVoz({ caracteristicas: { palabrasPorMinuto: 150 }, consentimiento }),
            (error) => error.status === 403,
            `pasó con consentimiento = ${JSON.stringify(consentimiento)}`,
        );
    }
});

test('con consentimiento devuelve observaciones sin afirmar un estado emocional', async () => {
    const resultado = await voz.analizarVoz({
        caracteristicas: { palabrasPorMinuto: 150, proporcionPausas: 0.15, variacionTono: 30 },
        consentimiento: true,
    });

    assert.ok(Array.isArray(resultado.observaciones));
    assert.ok(resultado.advertencia.length > 0, 'siempre debe advertir sobre los límites de la señal');
    assert.strictEqual(resultado.generado, false, 'sin proveedor, es comparación numérica');
});

test('detecta desviaciones contra los rangos de referencia', () => {
    const dentro = voz.compararConReferencia({
        palabrasPorMinuto: 150, proporcionPausas: 0.15, variacionTono: 30,
    });
    assert.strictEqual(dentro.length, 0);

    const fuera = voz.compararConReferencia({
        palabrasPorMinuto: 60, proporcionPausas: 0.55, variacionTono: 5,
    });
    assert.strictEqual(fuera.length, 3);
    assert.ok(fuera.every((d) => d.sentido === 'bajo' || d.sentido === 'alto'));
});

test('la comparación contra el propio promedio pesa aunque el valor sea normal', () => {
    // 120 palabras por minuto está dentro del rango de referencia, así que la
    // comparación normativa no diría nada. Pero si su propio promedio es 180,
    // hoy viene hablando un tercio más lento que él mismo, y eso sí es un dato.
    const desviaciones = voz.compararConReferencia(
        { palabrasPorMinuto: 120 },
        { palabrasPorMinuto: 180 },
    );

    assert.strictEqual(desviaciones.length, 1);
    assert.match(desviaciones[0].sentido, /propio promedio/);
    assert.strictEqual(desviaciones[0].cambio, -33);
});

test('un cambio pequeño contra el propio promedio no cuenta', () => {
    const desviaciones = voz.compararConReferencia(
        { palabrasPorMinuto: 165 },
        { palabrasPorMinuto: 180 },
    );
    assert.strictEqual(desviaciones.length, 0, 'un 8% de variación es ruido normal');
});

// ---------------------------------------------------------------------------
// Promedio propio
// ---------------------------------------------------------------------------

const registroCon = (caracteristicas) => ({ respuestas: { voz: { caracteristicas } } });

test('no se calcula promedio propio con menos de tres notas de voz', () => {
    // Con una o dos, el "promedio" es la nota de ayer y produciría desviaciones
    // inventadas en cada check-in.
    assert.strictEqual(voz.promedioPropio([]), null);
    assert.strictEqual(voz.promedioPropio([registroCon({ palabrasPorMinuto: 150 })]), null);
    assert.strictEqual(
        voz.promedioPropio([registroCon({ palabrasPorMinuto: 150 }), registroCon({ palabrasPorMinuto: 160 })]),
        null,
    );
});

test('promedia solo las claves que el servicio sabe comparar', () => {
    const promedio = voz.promedioPropio([
        registroCon({ palabrasPorMinuto: 100, variacionTono: 20, ruidoAjeno: 999 }),
        registroCon({ palabrasPorMinuto: 200, variacionTono: 40, ruidoAjeno: 999 }),
        registroCon({ palabrasPorMinuto: 150, variacionTono: 30, ruidoAjeno: 999 }),
    ]);

    assert.strictEqual(promedio.palabrasPorMinuto, 150);
    assert.strictEqual(promedio.variacionTono, 30);
    assert.strictEqual(promedio.ruidoAjeno, undefined, 'no debe promediar claves desconocidas');
});

test('los check-ins sin nota de voz no rompen el promedio', () => {
    // Lo habitual es que el estudiante grabe algunos días y otros no.
    const promedio = voz.promedioPropio([
        { respuestas: { analisis: {} } },
        registroCon({ palabrasPorMinuto: 100 }),
        { respuestas: null },
        registroCon({ palabrasPorMinuto: 200 }),
        registroCon({ palabrasPorMinuto: 150 }),
    ]);

    assert.strictEqual(promedio.palabrasPorMinuto, 150);
});
