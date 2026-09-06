/* ===========================================================================
 * Lumys — el umbral que hace anónimo al gemelo comunitario
 * ---------------------------------------------------------------------------
 * El radar del centro le promete al orientador una lectura de su colegio "sin
 * mostrarle a nadie en particular". Esa frase se sostiene en un solo número:
 * MINIMO_PARA_AGREGAR = 10.
 *
 * En un grupo de tres, un promedio ES un dato personal. El orientador sabe
 * quiénes son los tres; si el promedio se dispara, sabe de quién se trata. No
 * poner nombres no anonimiza nada cuando el grupo es chico.
 *
 * Bajar el umbral hace la demo más vistosa —más grupos con datos que mostrar—
 * y la plataforma indefendible. Por eso está acá y no solo en un comentario.
 * =========================================================================== */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');

const federado = require('../src/comunitario/federado.service');
const { lecturaIpsativa } = require('../src/comunitario/gemelo.service');
const { climaDeIcve, titularIpsativo } = require('../src/comunitario/avatar.service');

/** n check-ins con los mismos componentes, que es lo que promedia el radar. */
const registros = (n, componentes, icve = 50) =>
    Array.from({ length: n }, () => ({ puntajeIcve: icve, respuestas: { componentes } }));

const COMPLETO = { animo: 3, sueno: 3, energia: 3, vinculo: 3, concentracion: 3 };

describe('nada se promedia por debajo del mínimo', () => {

    test('el umbral es 10 y no se movió', () => {
        // Si alguien lo baja para que la demo muestre más datos, esto falla y
        // obliga a justificarlo en el diff.
        assert.strictEqual(federado.MINIMO_PARA_AGREGAR, 10);
    });

    test('nueve registros no producen ningún promedio', () => {
        assert.strictEqual(federado.promediarComponentes(registros(9, COMPLETO)), null);
        assert.strictEqual(federado.promediarIcve(registros(9, COMPLETO)), null);
    });

    test('diez sí', () => {
        assert.deepStrictEqual(federado.promediarComponentes(registros(10, COMPLETO)), COMPLETO);
        assert.strictEqual(federado.promediarIcve(registros(10, COMPLETO, 62)), 62);
    });

    test('cada componente pasa el umbral por su cuenta', () => {
        // Que el centro tenga 20 check-ins no significa que 20 hayan hablado de
        // sueño. Si el promedio del grupo se calculara sobre el total, el eje de
        // sueño quedaría hecho con las respuestas de tres personas.
        const muchos = registros(20, { animo: 4 });
        const pocos = registros(3, { animo: 4, sueno: 1 });

        const promedio = federado.promediarComponentes([...muchos, ...pocos]);

        assert.strictEqual(promedio.animo, 4, 'ánimo tiene 23 respuestas: debe promediarse');
        assert.strictEqual(promedio.sueno, undefined, 'sueño solo tiene 3 respuestas: no debe aparecer');
    });

    test('devuelve null y no un objeto vacío cuando no alcanza nada', () => {
        // La diferencia importa: un `{}` se cuela por un `if (promedio)` y
        // termina dibujando un radar de ceros como si fuera un dato real.
        assert.strictEqual(federado.promediarComponentes(registros(30, {})), null);
    });

    test('un registro sin componentes no arrastra el promedio hacia abajo', () => {
        // Los check-ins incompletos existen (el estudiante cortó a la mitad).
        // Contarlos como cero convertiría abandono en malestar.
        const conDatos = registros(12, { animo: 4 });
        const vacios = registros(5, {});
        assert.strictEqual(federado.promediarComponentes([...conDatos, ...vacios]).animo, 4);
    });
});

describe('el estudiante se compara consigo mismo y con nadie más', () => {

    test('sin patrón propio todavía no hay lectura', () => {
        assert.deepStrictEqual(lecturaIpsativa({ animo: 2 }, null), []);
    });

    test('menos de un punto de diferencia se reporta como igual', () => {
        const [animo] = lecturaIpsativa({ animo: 3.5 }, { animo: 3 });
        assert.strictEqual(animo.tendencia, 'igual');
        assert.strictEqual(animo.nota, 'Igual que tu promedio');
    });

    test('el signo no se invierte: en componentes, más alto es mejor', () => {
        // El ICVE va al revés (más alto = más vulnerable) y las dos escalas
        // conviven en el mismo archivo. Confundirlas le diría al estudiante que
        // mejoró cuando empeoró.
        const [subio] = lecturaIpsativa({ animo: 5 }, { animo: 2 });
        assert.strictEqual(subio.tendencia, 'sube');
        assert.strictEqual(subio.nota, 'Mejor que tu promedio');

        const [bajo] = lecturaIpsativa({ vinculo: 2 }, { vinculo: 4.5 });
        assert.strictEqual(bajo.tendencia, 'baja');
        assert.strictEqual(bajo.nota, 'Por debajo de tu promedio');
    });

    test('un componente sin patrón previo se dice, no se inventa', () => {
        const [energia] = lecturaIpsativa({ energia: 1 }, { animo: 3 });
        assert.strictEqual(energia.nota, 'Todavía sin patrón');
        assert.strictEqual(energia.tendencia, 'igual');
    });

    test('ningún texto que ve el estudiante lo compara con otros', () => {
        const frases = [
            titularIpsativo(80, 50),
            titularIpsativo(20, 50),
            titularIpsativo(52, 50),
            titularIpsativo(60, null),
            titularIpsativo(null, null),
            ...lecturaIpsativa({ animo: 5, vinculo: 1 }, { animo: 2, vinculo: 4 }).map((l) => l.nota),
        ].join(' ').toLowerCase();

        for (const palabra of ['compañer', 'los demás', 'otros estudiantes', 'la clase', 'el resto']) {
            assert.ok(!frases.includes(palabra), `el texto al estudiante menciona "${palabra}"`);
        }
        // Y sí ancla en lo propio.
        assert.match(frases, /tu propio|tu promedio|cómo venís/);
    });

    test('sin datos no se muestra un clima cualquiera', () => {
        // Un estudiante nuevo que ve "despejado" cree que el sistema ya sabe
        // algo sobre él. La ausencia de dato se dice.
        assert.strictEqual(climaDeIcve(null).id, 'sin_datos');
        assert.strictEqual(climaDeIcve(undefined).id, 'sin_datos');
        assert.strictEqual(climaDeIcve(NaN).id, 'sin_datos');
        assert.strictEqual(climaDeIcve(0).id, 'despejado');
    });

    test('el clima cubre la escala entera sin huecos', () => {
        for (let i = 0; i <= 100; i += 1) {
            assert.ok(climaDeIcve(i).id !== 'sin_datos', `el ICVE ${i} no tiene clima`);
        }
        assert.strictEqual(climaDeIcve(25).id, 'despejado');
        assert.strictEqual(climaDeIcve(26).id, 'parcial');
        assert.strictEqual(climaDeIcve(75).id, 'nublado');
        assert.strictEqual(climaDeIcve(76).id, 'tormenta');
    });
});
