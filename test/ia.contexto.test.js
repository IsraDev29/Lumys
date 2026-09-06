/* ===========================================================================
 * Lumys — qué ve el modelo cuando analiza un check-in
 * ---------------------------------------------------------------------------
 * Hay dos preguntas distintas y es fácil confundirlas:
 *
 *   · ¿qué puede LEER una persona?  → test/privacidad.roles.test.js
 *   · ¿qué puede ANALIZAR el modelo? → esto
 *
 * La respuesta no es la misma, y esa asimetría es el diseño. El modelo trabaja
 * con el material crudo y devuelve paráfrasis y números; lo crudo no sale de
 * ahí. Por eso darle MÁS contexto derivado no debilita la promesa: la refuerza,
 * porque cuanto mejor explica el patrón, menos falta hace mirar el texto.
 *
 * Lo que estas pruebas fijan es que el patrón por componente efectivamente
 * llegue. Estuvo calculado y sin usar un buen rato: `componentesDesviados` se
 * ejecutaba DESPUÉS de la llamada al modelo, así que el modelo solo veía un
 * número global. Dos estudiantes con ICVE 62 pueden estar en situaciones
 * opuestas —uno durmiendo mal, otro dejando de hablar con gente— y con un solo
 * número no hay forma de distinguirlos.
 * =========================================================================== */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');

const { contextoDeAnalisis } = require('../src/IA/ia.prompt');
const { componentesDesviados } = require('../src/Emocional/icve.service');

const turnos = [
    { componente: 'sueno', pregunta: '¿Dormiste?', respuesta: 'Poco', valor: 2 },
    { componente: 'vinculo', pregunta: '¿Con quién hablaste?', respuesta: 'Con nadie', valor: 2 },
];

describe('el patrón por componente llega al modelo', () => {

    test('se nombra qué componente se movió, con su habitual y su hoy', () => {
        const texto = contextoDeAnalisis({
            turnos, textoLibre: null, icve: 62, lineaBase: 48, delta: 14,
            desviados: [{ componente: 'vinculo', habitual: 4.2, hoy: 2, delta: -2.2 }],
        });

        assert.match(texto, /vinculo/);
        assert.match(texto, /4\.2/, 'falta el valor habitual del estudiante');
        assert.match(texto, /hoy 2/, 'falta el valor de hoy');
        assert.match(texto, /peor que su normal/);
    });

    test('un componente que mejoró se describe como mejor, no como riesgo', () => {
        // La plataforma tiene que poder ver que algo se recuperó. Un sistema que
        // solo sabe nombrar lo que empeora entrena a los adultos a leer alarmas.
        const texto = contextoDeAnalisis({
            turnos, textoLibre: null, icve: 30, lineaBase: 48, delta: -18,
            desviados: [{ componente: 'sueno', habitual: 2.1, hoy: 4, delta: 1.9 }],
        });

        assert.match(texto, /mejor que su normal/);
        assert.ok(!/peor que su normal/.test(texto));
    });

    test('se le avisa al modelo que las dos escalas van al revés', () => {
        // El ICVE es 0-100 y más alto es PEOR; los componentes son 1-5 y más
        // alto es MEJOR. Si el modelo las confunde, invierte la lectura entera
        // del check-in. Va escrito en el prompt, no dado por supuesto.
        const texto = contextoDeAnalisis({
            turnos, textoLibre: null, icve: 62, lineaBase: 48, delta: 14,
            desviados: [{ componente: 'vinculo', habitual: 4.2, hoy: 2, delta: -2.2 }],
        });

        assert.match(texto, /más alto = más vulnerabilidad/);
        assert.match(texto, /1 a 5, más alto = mejor/);
    });

    test('si nada se movió, se le prohíbe inventar una causa única', () => {
        const texto = contextoDeAnalisis({
            turnos, textoLibre: null, icve: 55, lineaBase: 48, delta: 7, desviados: [],
        });

        assert.match(texto, /Ningún componente se apartó/);
        assert.match(texto, /no le atribuyas una causa única/);
    });

    test('sin línea base no se compara con nada', () => {
        // El primer check-in de un estudiante no tiene contra qué medirse. Antes
        // de tener historial propio, la única comparación posible sería contra
        // otros estudiantes, y eso es justo lo que la plataforma no hace.
        const texto = contextoDeAnalisis({
            turnos, textoLibre: null, icve: 62, lineaBase: null, delta: null,
        });

        assert.match(texto, /Todavía no tiene línea base propia/);
        assert.ok(!/su patrón habitual/.test(texto));
    });

    test('la comparación es siempre contra él mismo', () => {
        const texto = contextoDeAnalisis({
            turnos, textoLibre: null, icve: 62, lineaBase: 48, delta: 14, desviados: [],
        });
        assert.match(texto, /nunca contra otros estudiantes/);
    });

    test('quien llama sin patrón sigue obteniendo un contexto válido', () => {
        // `desviados` es opcional a propósito: analizarTexto y los primeros
        // check-ins no tienen historial. El contexto se degrada, no se rompe.
        const texto = contextoDeAnalisis({ turnos, textoLibre: null, icve: 62, lineaBase: 48, delta: 14 });
        assert.match(texto, /ICVE calculado hoy: 62/);
    });
});

describe('el bloque de patrón no agrega superficie de texto del estudiante', () => {

    test('las líneas de desviación son solo nombres de componente y números', () => {
        // Esta es la razón por la que darle más contexto al modelo es seguro:
        // lo que se agregó son cifras derivadas, no una palabra más de lo que
        // el estudiante escribió. Si alguien mete texto libre acá, esto falla.
        const texto = contextoDeAnalisis({
            turnos, textoLibre: 'Discutí con mi mamá y no se lo cuento a nadie.',
            icve: 62, lineaBase: 48, delta: 14,
            desviados: [{ componente: 'vinculo', habitual: 4.2, hoy: 2, delta: -2.2 }],
        });

        const lineaDesviacion = texto.split('\n').find((l) => l.startsWith('- vinculo:'));
        assert.ok(lineaDesviacion, 'no se encontró la línea del componente desviado');
        assert.strictEqual(
            lineaDesviacion,
            '- vinculo: habitualmente 4.2, hoy 2 → peor que su normal.',
            'la línea de patrón debe ser derivada pura: componente, cifras y dirección',
        );
    });
});

describe('cómo se decide que un componente se movió', () => {

    test('sin patrón previo no hay desviaciones que reportar', () => {
        assert.deepStrictEqual(componentesDesviados({ animo: 2 }, null), []);
    });

    test('menos de un punto de diferencia es ruido, no señal', () => {
        // En una escala de 5, medio punto entra dentro de cómo se responde un
        // martes cualquiera. Marcarlo llenaría la nota del orientador de cosas
        // que no significan nada.
        assert.deepStrictEqual(
            componentesDesviados({ animo: 3.5 }, { animo: 3 }),
            [],
        );
    });

    test('un punto entero sí se reporta, con su magnitud', () => {
        assert.deepStrictEqual(
            componentesDesviados({ vinculo: 2 }, { vinculo: 4.2 }),
            [{ componente: 'vinculo', habitual: 4.2, hoy: 2, delta: -2.2 }],
        );
    });

    test('un componente que hoy se cubrió pero nunca antes no se compara', () => {
        // No tiene habitual contra qué medirse. Inventarle uno sería fabricar
        // una desviación a partir de nada.
        assert.deepStrictEqual(componentesDesviados({ energia: 1 }, { animo: 3 }), []);
    });
});
