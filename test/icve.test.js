const test = require('node:test');
const assert = require('node:assert');

const icve = require('../src/Emocional/icve.service');
const iaService = require('../src/IA/ia.service');
const { calcularRacha } = require('../src/IA/ia.controller');

// ---------------------------------------------------------------------------
// Aritmética del ICVE
//
// Este número es lo que hace comparable el historial de un estudiante consigo
// mismo y lo que un orientador tiene que poder defender cuando pregunten por qué
// se abrió un caso. Se prueba como se prueba una fórmula: por los extremos.
// ---------------------------------------------------------------------------

const turno = (componente, valor) => ({ componente, valor, pregunta: 'p', respuesta: 'r' });

test('todo en 5 da 0 y todo en 1 da 100', () => {
    const todoBien = ['animo', 'vinculo', 'sueno', 'energia', 'concentracion'].map((c) => turno(c, 5));
    const todoMal = ['animo', 'vinculo', 'sueno', 'energia', 'concentracion'].map((c) => turno(c, 1));

    assert.strictEqual(icve.calcularIcve(todoBien).icve, 0);
    assert.strictEqual(icve.calcularIcve(todoMal).icve, 100);
    assert.strictEqual(icve.calcularIcve(todoBien).cobertura, 1);
});

test('sin turnos válidos el puntaje es null, no 0', () => {
    // La diferencia importa: 0 significa "está perfecto" y null significa "no
    // sabemos". Confundirlos mete un día excelente inventado en la línea base.
    assert.strictEqual(icve.calcularIcve([]).icve, null);
    assert.strictEqual(icve.calcularIcve([turno('animo', null)]).icve, null);
    assert.strictEqual(icve.calcularIcve([turno('libre', 3)]).icve, null);
    assert.strictEqual(icve.calcularIcve([turno('inventado', 3)]).icve, null);
});

test('un valor fuera de rango se descarta en vez de deformar el puntaje', () => {
    const resultado = icve.calcularIcve([turno('animo', 99), turno('sueno', 1)]);
    assert.strictEqual(resultado.icve, 100, 'solo debería contar el sueño');
    assert.deepStrictEqual(Object.keys(resultado.componentes), ['sueno']);
});

test('los pesos se renormalizan sobre los componentes presentes', () => {
    // Con un solo componente en 1, el puntaje es 100 aunque falten los otros
    // cuatro: no se asume un 3 neutro para lo que no se preguntó.
    assert.strictEqual(icve.calcularIcve([turno('animo', 1)]).icve, 100);
    assert.strictEqual(icve.calcularIcve([turno('animo', 3)]).icve, 50);
    assert.strictEqual(icve.calcularIcve([turno('animo', 1)]).cobertura, 0.2);
});

test('la primera línea base es el propio registro', () => {
    const siguiente = icve.siguienteLineaBase(null, 40, { animo: 3 });
    assert.strictEqual(siguiente.promedioIcveMovil, 40);
    assert.deepStrictEqual(siguiente.patronNormal, { animo: 3 });
});

test('un solo día malo mueve la línea base sin reescribirla', () => {
    // Con alfa 0.3, 50 → 80 sube a 59, no a 80. Es lo que evita que el sistema
    // acepte un mal martes como la nueva normalidad del estudiante.
    const siguiente = icve.siguienteLineaBase(
        { promedioIcveMovil: 50, patronNormal: { animo: 4 } },
        80,
        { animo: 1 },
    );
    assert.strictEqual(siguiente.promedioIcveMovil, 59);
    assert.strictEqual(siguiente.patronNormal.animo, 3.1);
});

test('el riesgo explícito abre señal sin esperar tendencia', () => {
    const veredicto = icve.evaluarSenal({
        icve: 20, delta: -5, nivelRiesgo: 3, semanasSostenidas: 0, desviados: [],
    });
    assert.strictEqual(veredicto.abrir, true);
    assert.strictEqual(veredicto.nivelRespuesta, 3);
});

test('un puntaje alto aislado NO abre señal', () => {
    // El sistema busca cambios sostenidos. Si alarmara por un día suelto, el
    // orientador dejaría de mirar las alertas en una semana.
    const veredicto = icve.evaluarSenal({
        icve: 90, delta: 40, nivelRiesgo: 0, semanasSostenidas: 1, desviados: [],
    });
    assert.strictEqual(veredicto.abrir, false);
});

test('el mismo puntaje sostenido sí abre señal', () => {
    const veredicto = icve.evaluarSenal({
        icve: 90, delta: 40, nivelRiesgo: 0, semanasSostenidas: 3, desviados: [],
    });
    assert.strictEqual(veredicto.abrir, true);
    assert.strictEqual(veredicto.nivelRespuesta, 2);
});

test('sin línea base no se abre señal por desviación', () => {
    const veredicto = icve.evaluarSenal({
        icve: 90, delta: null, nivelRiesgo: 0, semanasSostenidas: 0, desviados: [],
    });
    assert.strictEqual(veredicto.abrir, false);
});

test('componentesDesviados ignora los cambios de menos de un punto', () => {
    const desviados = icve.componentesDesviados(
        { animo: 2, sueno: 3.5 },
        { animo: 4, sueno: 4 },
    );
    assert.strictEqual(desviados.length, 1);
    assert.strictEqual(desviados[0].componente, 'animo');
    assert.strictEqual(desviados[0].delta, -2);
});

// ---------------------------------------------------------------------------
// Racha de días consecutivos
// ---------------------------------------------------------------------------

const hace = (dias) => new Date(Date.now() - dias * 86400000);

test('la racha cuenta días consecutivos hacia atrás', () => {
    assert.strictEqual(calcularRacha([hace(0), hace(1), hace(2)]), 3);
    assert.strictEqual(calcularRacha([hace(0)]), 1);
    assert.strictEqual(calcularRacha([]), 0);
});

test('la racha se corta con un hueco', () => {
    assert.strictEqual(calcularRacha([hace(0), hace(1), hace(5)]), 2);
});

test('la racha sigue viva si el último check-in fue ayer', () => {
    // Si se cortara a medianoche, alguien que registra a las 8 de la mañana
    // vería su racha en cero cada día antes de entrar.
    assert.strictEqual(calcularRacha([hace(1), hace(2)]), 2);
});

test('la racha muere si el último check-in fue anteayer', () => {
    assert.strictEqual(calcularRacha([hace(2), hace(3)]), 0);
});

test('dos check-ins el mismo día cuentan como un día', () => {
    assert.strictEqual(calcularRacha([hace(0), hace(0), hace(1)]), 2);
});

// ---------------------------------------------------------------------------
// Normalización del turno
//
// El modelo puede devolver formas válidas contra el esquema pero incómodas para
// la interfaz. Con un modelo local chico esto pasa más seguido, así que la
// normalización dejó de ser una cortesía y es parte del contrato.
// ---------------------------------------------------------------------------

test('el formato "opciones" con menos de dos botones pasa a escala', () => {
    const turnoNormalizado = iaService.normalizarTurno(
        { reaccion: 'ok', pregunta: '¿y?', componente: 'animo', formato: 'opciones', opciones: [], cierre: false },
        [{ componente: 'sueno' }],
    );
    assert.strictEqual(turnoNormalizado.formato, 'escala');
    assert.deepStrictEqual(turnoNormalizado.opciones, []);
});

test('se recortan a cuatro los botones de más', () => {
    const opciones = Array.from({ length: 7 }, (_, i) => ({ etiqueta: `o${i}`, emoji: '🙂', valor: 3 }));
    const turnoNormalizado = iaService.normalizarTurno(
        { reaccion: 'ok', pregunta: '¿y?', componente: 'animo', formato: 'opciones', opciones, cierre: false },
        [{ componente: 'sueno' }],
    );
    assert.strictEqual(turnoNormalizado.opciones.length, 4);
});

test('el primer turno nunca lleva reacción', () => {
    // No hay nada a qué reaccionar todavía; que el modelo salude reaccionando a
    // la nada es la señal más rápida de que el check-in es un guion.
    const turnoNormalizado = iaService.normalizarTurno(
        { reaccion: 'Qué bueno', pregunta: '¿y?', componente: 'animo', formato: 'escala', opciones: [], cierre: false },
        [],
    );
    assert.strictEqual(turnoNormalizado.reaccion, '');
});

test('la sesión se cierra sola en el sexto turno', () => {
    // El modelo tiende a pedir "un turno más para estar seguro" y ese costo lo
    // paga la constancia del estudiante.
    const sesion = Array.from({ length: 5 }, () => ({ componente: 'animo' }));
    const turnoNormalizado = iaService.normalizarTurno(
        { reaccion: 'ok', pregunta: '¿y?', componente: 'libre', formato: 'texto', opciones: [], cierre: false },
        sesion,
    );
    assert.strictEqual(turnoNormalizado.cierre, true);
});

test('una pregunta larguísima se recorta', () => {
    const turnoNormalizado = iaService.normalizarTurno(
        { reaccion: 'x'.repeat(500), pregunta: 'y'.repeat(500), componente: 'animo', formato: 'escala', opciones: [], cierre: false },
        [{ componente: 'sueno' }],
    );
    assert.ok(turnoNormalizado.pregunta.length <= 180);
    assert.ok(turnoNormalizado.reaccion.length <= 140);
});

test('el respaldo local no repite componente ya cubierto', () => {
    const respaldo = iaService.turnoDeRespaldo([
        { componente: 'animo' }, { componente: 'sueno' },
    ]);
    assert.ok(!['animo', 'sueno'].includes(respaldo.componente));
    assert.ok(respaldo.pregunta.length > 0);
});
