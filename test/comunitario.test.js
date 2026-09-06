const test = require('node:test');
const assert = require('node:assert');

const avatar = require('../src/comunitario/avatar.service');
const federado = require('../src/comunitario/federado.service');
const gemelo = require('../src/comunitario/gemelo.service');

// ---------------------------------------------------------------------------
// Umbral de anonimato
//
// Es la propiedad de seguridad de todo el módulo comunitario. En un grupo de
// tres, un promedio ES un dato personal: el orientador sabe quiénes son los
// tres, y un promedio que se dispara le dice de quién se trata. Quitar el
// nombre no anonimiza nada cuando el grupo es chico.
//
// Si algún día alguien baja este umbral para que la demo muestre más grupos con
// datos, estos tests son lo que tiene que sonar.
// ---------------------------------------------------------------------------

const registro = (icve, componentes) => ({ puntajeIcve: icve, respuestas: { componentes } });

const muchos = (n, icve = 50) =>
    Array.from({ length: n }, () => registro(icve, { animo: 3, sueno: 3, energia: 3, vinculo: 3, concentracion: 3 }));

test('el umbral de agregación es de al menos 10', () => {
    // Fijado en el test a propósito: bajarlo tiene que ser una decisión
    // deliberada que rompa algo, no un cambio de una línea que pase inadvertido.
    assert.ok(federado.MINIMO_PARA_AGREGAR >= 10, 'el mínimo no puede bajar de 10');
});

test('un grupo pequeño no produce promedio', () => {
    for (const n of [0, 1, 3, 9]) {
        assert.strictEqual(federado.promediarComponentes(muchos(n)), null, `expuso un grupo de ${n}`);
        assert.strictEqual(federado.promediarIcve(muchos(n)), null, `expuso el ICVE de un grupo de ${n}`);
    }
});

test('a partir del umbral sí se promedia', () => {
    const promedio = federado.promediarComponentes(muchos(10));
    assert.ok(promedio !== null);
    assert.strictEqual(promedio.animo, 3);

    assert.strictEqual(federado.promediarIcve(muchos(10, 40)), 40);
});

test('cada componente pasa el umbral por su cuenta', () => {
    // Que el grupo tenga 15 check-ins no significa que 15 hayan hablado de
    // sueño: la conversación es distinta cada día y cubre lo que alcanza.
    const registros = [
        ...Array.from({ length: 15 }, () => registro(50, { animo: 4 })),
        ...Array.from({ length: 4 }, () => registro(50, { animo: 4, sueno: 1 })),
    ];

    const promedio = federado.promediarComponentes(registros);
    assert.strictEqual(promedio.animo, 4, 'ánimo tiene 19 respuestas');
    assert.strictEqual(promedio.sueno, undefined, 'sueño solo tiene 4: no se muestra');
});

test('los valores no numéricos no cuentan como respuestas', () => {
    // Si contaran, un grupo de 10 con datos vacíos pasaría el umbral con un
    // promedio construido sobre nada.
    const registros = Array.from({ length: 12 }, () => registro(50, { animo: null, sueno: 'tres' }));
    assert.strictEqual(federado.promediarComponentes(registros), null);
});

// ---------------------------------------------------------------------------
// Clima
// ---------------------------------------------------------------------------

test('el clima cubre toda la escala sin huecos', () => {
    for (let icve = 0; icve <= 100; icve += 1) {
        const clima = avatar.climaDeIcve(icve);
        assert.notStrictEqual(clima.id, 'sin_datos', `ICVE ${icve} quedó sin clima`);
        assert.ok(clima.titulo && clima.mensaje);
    }
});

test('sin datos no se inventa un clima bueno', () => {
    // Un estudiante nuevo viendo "despejado" creería que el sistema ya sabe
    // algo sobre él, y no sabe nada todavía.
    for (const valor of [null, undefined, NaN]) {
        assert.strictEqual(avatar.climaDeIcve(valor).id, 'sin_datos');
    }
});

test('un ICVE alto da tormenta y uno bajo despejado', () => {
    assert.strictEqual(avatar.climaDeIcve(10).id, 'despejado');
    assert.strictEqual(avatar.climaDeIcve(90).id, 'tormenta');
});

test('ningún mensaje de clima le dice al estudiante que está mal', () => {
    // El lenguaje describe el día, no a la persona.
    const prohibidas = /\b(estás mal|andás mal|deprimid|ansios|trastorno|enferm)/i;

    for (const clima of avatar.CLIMAS) {
        assert.ok(!prohibidas.test(clima.mensaje), `mensaje con juicio: "${clima.mensaje}"`);
        assert.ok(!prohibidas.test(clima.titulo));
    }
});

test('el titular compara contra uno mismo, nunca contra otros', () => {
    assert.match(avatar.titularIpsativo(50, 52), /tu propio promedio/);
    assert.match(avatar.titularIpsativo(80, 50), /promedio/);
    assert.match(avatar.titularIpsativo(30, null), /primeros días/);
    assert.match(avatar.titularIpsativo(null, null), /registros suficientes/);
});

// ---------------------------------------------------------------------------
// Lectura ipsativa
// ---------------------------------------------------------------------------

test('un cambio menor a un punto se reporta como igual', () => {
    const lectura = gemelo.lecturaIpsativa({ animo: 3.5 }, { animo: 4 });
    assert.strictEqual(lectura[0].tendencia, 'igual');
});

test('en los componentes, subir es una buena noticia', () => {
    // Ojo con el signo: acá 5 es lo mejor, al revés que en el ICVE. Invertirlo
    // le diría al estudiante que mejoró cuando empeoró.
    const mejor = gemelo.lecturaIpsativa({ sueno: 5 }, { sueno: 2 });
    assert.strictEqual(mejor[0].tendencia, 'sube');
    assert.match(mejor[0].nota, /Mejor/);

    const peor = gemelo.lecturaIpsativa({ sueno: 1 }, { sueno: 4 });
    assert.strictEqual(peor[0].tendencia, 'baja');
});

test('sin patrón previo no se inventa una tendencia', () => {
    assert.deepStrictEqual(gemelo.lecturaIpsativa({ animo: 3 }, null), []);

    const sinEsePatron = gemelo.lecturaIpsativa({ animo: 3 }, { sueno: 4 });
    assert.strictEqual(sinEsePatron[0].tendencia, 'igual');
    assert.match(sinEsePatron[0].nota, /sin patrón/);
});

test('la racha del gemelo coincide con la del módulo de IA', () => {
    // Están implementadas en dos archivos distintos y tienen que dar lo mismo:
    // si divergen, el estudiante ve una racha en el inicio y otra en su gemelo.
    const { calcularRacha: rachaIa } = require('../src/IA/ia.controller');
    const hace = (d) => new Date(Date.now() - d * 86400000);

    for (const fechas of [[], [hace(0)], [hace(0), hace(1), hace(2)], [hace(1), hace(2)], [hace(2)], [hace(0), hace(3)]]) {
        assert.strictEqual(gemelo.calcularRacha(fechas), rachaIa(fechas));
    }
});
