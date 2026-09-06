const test = require('node:test');
const assert = require('node:assert');

const seguridad = require('../src/IA/ia.seguridad');

// ---------------------------------------------------------------------------
// Léxico de riesgo
//
// Es la capa que decide si un check-in llega o no a los ojos de una persona, y
// la única que sigue funcionando con la IA caída. Los falsos negativos de acá no
// se recuperan en ninguna otra parte del sistema, así que se prueba el caso
// difícil: escritura de chat, sin tildes, con la frase en medio de otra cosa.
// ---------------------------------------------------------------------------

test('detecta riesgo explícito escrito como se escribe en un chat', () => {
    const casos = [
        'ya no quiero vivir',
        'a veces pienso en quitarme la vida',
        'me quiero morir',
        'no quiero seguir viviendo',
        'estaria mejor muerto',
        'quiero acabar con todo',
    ];

    for (const texto of casos) {
        const resultado = seguridad.evaluarTexto(texto);
        assert.strictEqual(resultado.nivel, 3, `debería ser nivel 3: "${texto}"`);
        assert.ok(resultado.coincidencias.length > 0, `sin coincidencias: "${texto}"`);
    }
});

test('detecta riesgo explícito sin tildes y en mayúsculas', () => {
    // Un adolescente escribiendo rápido en el teléfono no pone tildes. Si el
    // léxico dependiera de ellas, sería casi decorativo.
    assert.strictEqual(seguridad.evaluarTexto('ME QUIERO MORIR').nivel, 3);
    assert.strictEqual(seguridad.evaluarTexto('quiero suicidarme').nivel, 3);
    assert.strictEqual(seguridad.evaluarTexto('pienso en hacerme daño').nivel, 3);
    assert.strictEqual(seguridad.evaluarTexto('pienso en hacerme dano').nivel, 3);
});

test('detecta riesgo posible', () => {
    for (const texto of [
        'solo quiero desaparecer',
        'siento que soy una carga',
        'estarian mejor sin mi',
        'nada vale la pena',
        'ya no aguanto',
    ]) {
        assert.strictEqual(seguridad.evaluarTexto(texto).nivel, 2, `falló: "${texto}"`);
    }
});

test('una negación baja el malestar pero NO el riesgo explícito', () => {
    // La asimetría es deliberada: "ya no me siento solo" es una buena noticia,
    // pero "ya no quiero morirme" habla igual de algo que pasó y merece que
    // alguien lo lea.
    assert.strictEqual(seguridad.evaluarTexto('ya no me siento solo').nivel, 0);
    assert.strictEqual(seguridad.evaluarTexto('ya no quiero morir').nivel, 3);
    assert.strictEqual(seguridad.evaluarTexto('nunca quiero morir').nivel, 3);
});

test('el texto normal no dispara nada', () => {
    for (const texto of [
        'hoy me fue bien en el colegio',
        'dormi bien y desayune con mi mama',
        'estoy cansado por el partido de ayer',
        '',
        null,
    ]) {
        assert.strictEqual(seguridad.evaluarTexto(texto).nivel, 0, `falso positivo: "${texto}"`);
    }
});

test('combinar toma el máximo: el modelo sube pero nunca baja', () => {
    // Esta es la garantía central del módulo. Si alguna vez se invierte, un
    // modelo alucinando "ninguno" borraría una detección del léxico.
    assert.strictEqual(seguridad.combinar('riesgo_explicito', 'ninguno').nivel, 3);
    assert.strictEqual(seguridad.combinar('ninguno', 'riesgo_explicito').nivel, 3);
    assert.strictEqual(seguridad.combinar('malestar', 'riesgo_posible').nivel, 2);
    assert.strictEqual(seguridad.combinar('ninguno', 'ninguno').nivel, 0);
});

test('combinar sobrevive a una etiqueta que no existe', () => {
    // Un modelo local chico puede devolver una etiqueta fuera del enum. Que eso
    // resulte en NaN y se cuele como "sin riesgo" sería el peor final posible.
    assert.strictEqual(seguridad.combinar('inventada', 'ninguno').nivel, 0);
    assert.strictEqual(seguridad.combinar('riesgo_explicito', 'inventada').nivel, 3);
    assert.strictEqual(seguridad.combinar(undefined, undefined).nivel, 0);
});

test('el nivel de respuesta institucional sigue al de riesgo', () => {
    assert.strictEqual(seguridad.nivelDeRespuesta(3), 3);
    assert.strictEqual(seguridad.nivelDeRespuesta(2), 2);
    assert.strictEqual(seguridad.nivelDeRespuesta(1), 1);
    assert.strictEqual(seguridad.nivelDeRespuesta(0), 1);
});

test('el mensaje de contención no inventa teléfonos', () => {
    const sinServicios = seguridad.mensajeDeContencion({ servicios: [] });
    assert.ok(!/\d{4}/.test(sinServicios), 'no debe traer números escritos a mano');

    const conServicios = seguridad.mensajeDeContencion({
        servicios: [{ nombre: 'Línea de Crisis', telefono: '133' }],
    });
    assert.ok(conServicios.includes('Línea de Crisis'));
    assert.ok(conServicios.includes('133'));
});
