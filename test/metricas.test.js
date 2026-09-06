/* ===========================================================================
 * Lumys* — pruebas de la capa de métricas del cliente
 * ---------------------------------------------------------------------------
 * `client/src/lib/metricas.ts` traduce lo que manda el servidor a lo que dibuja
 * la pantalla. Es una capa aburrida y por eso mismo peligrosa: cuando estaba
 * mal, no se rompía nada visible — la interfaz caía al respaldo de maqueta y se
 * veía perfecta con los datos de otro.
 *
 * Lo que se comprueba acá es justo lo que fallaba en silencio:
 *
 *   · que `serie` llegue como `lineaBase`, que es lo que lee el gráfico;
 *   · que el signo del ICVE no se invierta (más alto es MÁS carga);
 *   · que el radar convierta la escala 1-5 a porcentaje;
 *   · que la constancia mida aparecer y no el ánimo;
 *   · que las insignias salgan de hechos y no de una lista fija.
 *
 * Solo hay `import type` en el módulo, así que Node lo carga directo con el
 * borrado de tipos, igual que ya hace `lumy.test.js` con el rig de la mascota.
 * =========================================================================== */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');

const M = require('../client/src/lib/metricas.ts');

const DIA = 86400000;
const diasAtras = (n) => new Date(Date.now() - n * DIA).toISOString();

/** Un gemelo con la forma EXACTA que devuelve GET /comunitario/gemelo. */
const gemeloServidor = (extra = {}) => ({
    nombre: 'Kevin',
    clima: { id: 'nublado', titulo: 'Día nublado', mensaje: 'Se nota que viene pesando.', mascota: 'atenta' },
    titular: 'Hoy venís parecido a tu propio promedio.',
    racha: 4,
    totalRegistros: 9,
    checkinHoy: true,
    serie: [
        { fecha: diasAtras(2), valor: 60 },
        { fecha: diasAtras(1), valor: 70 },
        { fecha: diasAtras(0), valor: 50 },
    ],
    promedioPropio: 62,
    ipsativa: [],
    mensaje: 'Gracias por aparecer hoy.',
    ...extra,
});

describe('gemelo: la forma del servidor no es la que dibuja la pantalla', () => {
    test('la serie del servidor llega como la línea base del gráfico', () => {
        // Este es EL fallo que motivó el archivo entero: el servidor manda
        // `serie` y `LineaBase` hace `datos.map(...)` sobre `lineaBase`. Con una
        // sesión real, sin esta traducción, la vista revienta al primer render.
        const g = M.adaptarGemelo(gemeloServidor());

        assert.ok(Array.isArray(g.lineaBase), 'lineaBase tiene que existir y ser un arreglo');
        assert.strictEqual(g.lineaBase.length, 3);
        assert.strictEqual(g.lineaBase[2].valor, 50);
    });

    test('el clima se traduce de objeto a cadena y tormenta pasa a lluvia', () => {
        // El backend tiene cinco ids y la mascota entiende cuatro. Sin el mapeo,
        // `POR_CLIMA[gemelo.clima]` da undefined y Lumy se queda sin dibujar.
        assert.strictEqual(M.adaptarGemelo(gemeloServidor()).clima, 'nublado');

        const tormenta = gemeloServidor({ clima: { id: 'tormenta' } });
        assert.strictEqual(M.adaptarGemelo(tormenta).clima, 'lluvia');
    });

    test('sin datos no se afirma un clima', () => {
        const nuevo = M.adaptarGemelo(gemeloServidor({
            clima: { id: 'sin_datos' }, serie: [], promedioPropio: null, totalRegistros: 0,
        }));

        assert.strictEqual(nuevo.sinDatos, true, 'la vista tiene que poder decir que todavía no sabe');
        assert.ok(nuevo.clima, 'igual necesita un clima con el que dibujar la mascota');
    });

    test('un estudiante sin línea base no recibe un promedio de cero', () => {
        // Con promedio 0 la línea punteada cae al piso del gráfico y TODOS los
        // días quedan por encima: parecería que siempre está peor que su
        // promedio, justo el mensaje que la app existe para no dar.
        const g = M.adaptarGemelo(gemeloServidor({ promedioPropio: null }));

        assert.strictEqual(g.promedioPropio, 60, 'sale de la propia serie');
        assert.ok(g.promedioPropio > 0);
    });
});

describe('constancia: mide aparecer, nunca el ánimo', () => {
    test('un día pesado cuenta igual que uno bueno', () => {
        // Si el nivel saliera del ICVE, el día malo se pintaría más flojo y la
        // cuadrícula estaría premiando sentirse bien.
        const dias = M.constanciaDesde([
            { fecha: diasAtras(1), icve: 5, cobertura: 1 },    // día buenísimo
            { fecha: diasAtras(0), icve: 98, cobertura: 1 },   // día pésimo
        ], 3);

        const [, ayer, hoy] = dias;
        assert.strictEqual(ayer.nivel, hoy.nivel, 'la misma cobertura da el mismo nivel');
    });

    test('sin registro es nivel 0 y con registro nunca lo es', () => {
        const dias = M.constanciaDesde([{ fecha: diasAtras(0), icve: 40, cobertura: 0.01 }], 2);

        assert.strictEqual(dias[0].nivel, 0, 'el día sin check-in queda vacío');
        assert.ok(dias[1].nivel >= 1, 'por corto que sea, el día se pinta');
    });

    test('dos registros el mismo día se quedan con el más completo', () => {
        const dias = M.constanciaDesde([
            { fecha: diasAtras(0), icve: 40, cobertura: 0.2 },
            { fecha: diasAtras(0), icve: 40, cobertura: 1 },
        ], 1);

        assert.strictEqual(dias[0].nivel, 4);
    });
});

describe('entradas: el ánimo se deduce del ICVE con los cortes del avatar', () => {
    test('más alto es más pesado, no al revés', () => {
        const entradas = M.adaptarEntradas([
            { fecha: diasAtras(0), icve: 10, texto: 'buen día', etiquetas: [] },
            { fecha: diasAtras(1), icve: 90, texto: 'día duro', etiquetas: [] },
        ]);

        assert.strictEqual(entradas[0].animo, 'bien');
        assert.strictEqual(entradas[1].animo, 'pesado');
    });

    test('los registros sin texto no aparecen en "lo que escribiste"', () => {
        const entradas = M.adaptarEntradas([{ fecha: diasAtras(0), icve: 50, texto: null, etiquetas: [] }]);
        assert.deepStrictEqual(entradas, []);
    });
});

describe('radar del centro', () => {
    const radarServidor = (extra = {}) => ({
        suficiente: true,
        minimo: 10,
        registros: 42,
        clima: { id: 'parcial' },
        titular: 'El centro viene parecido a su propio mes anterior.',
        ejes: ['Ánimo', 'Sueño'],
        claves: ['animo', 'sueno'],
        actual: [5, 3],
        promedio: [1, 3],
        grupos: [],
        federado: [],
        ...extra,
    });

    test('la escala 1-5 se convierte a porcentaje', () => {
        // El SVG dibuja los vértices como `valor / 100` del radio. Sin
        // convertir, un centro con ánimo 4 se dibujaba al 4% y el polígono
        // colapsaba a un punto: parecía que el colegio entero estaba en cero.
        const c = M.adaptarComunitario(radarServidor());

        assert.strictEqual(c.radar.actual[0], 100, 'un 5 es el máximo del eje');
        assert.strictEqual(c.radar.promedio[0], 0, 'un 1 es el mínimo');
        assert.strictEqual(c.radar.actual[1], 50, 'un 3 cae a la mitad');
    });

    test('un grupo por debajo del umbral queda oculto, no en cero', () => {
        const c = M.adaptarComunitario(radarServidor({
            grupos: [{ nombre: '11mo C', propia: true, registros: 4, suficiente: false, clima: null, nota: 'pocos' }],
        }));

        assert.strictEqual(c.grupos[0].clima, 'oculto');
    });

    test('un eje sin dato no arrastra al polígono fuera del gráfico', () => {
        const c = M.adaptarComunitario(radarServidor({ actual: [4, null] }));
        assert.strictEqual(c.radar.actual[1], 0);
    });
});

describe('insignias: salen de hechos comprobables', () => {
    const base = { racha: 0, totalRegistros: 0 };
    const obtenida = (lista, nombre) => lista.find((i) => i.nombre === nombre).obtenida;

    test('sin un solo check-in no hay ninguna ganada', () => {
        const lista = M.insigniasDesde(base, { respiraciones: 0, capsulas: 0, contactos: 0 });
        assert.strictEqual(lista.every((i) => !i.obtenida), true);
    });

    test('la racha real decide las de constancia', () => {
        const lista = M.insigniasDesde({ racha: 7, totalRegistros: 7 },
            { respiraciones: 0, capsulas: 0, contactos: 0 });

        assert.strictEqual(obtenida(lista, 'Primera vez'), true);
        assert.strictEqual(obtenida(lista, 'Siete seguidos'), true);
        assert.strictEqual(obtenida(lista, 'Un mes'), false);
    });

    test('los contactos excluidos no cuentan para la red', () => {
        const red = [
            { excluido: false }, { excluido: false }, { excluido: true },
        ];
        assert.strictEqual(M.contactosActivos(red), 2);

        const lista = M.insigniasDesde(base, { respiraciones: 0, capsulas: 0, contactos: M.contactosActivos(red) });
        assert.strictEqual(obtenida(lista, 'Red armada'), false, 'hacen falta tres activos');
    });
});

describe('indicadores del centro', () => {
    const caso = (nivel, estado, dias) => ({ nivel, estado, desde: diasAtras(dias) });

    test('los niveles se cuentan de las alertas reales', () => {
        const panel = M.institucionalDesde(
            [caso(1, 'abierto', 2), caso(1, 'abierto', 3), caso(3, 'derivado', 1)], null);

        assert.deepStrictEqual(panel.niveles.map((n) => n.valor), [2, 0, 1]);
    });

    test('la participación por grado no se inventa', () => {
        // El esquema no guarda grado ni sección. Cinco barras plausibles acá
        // terminan en una reunión de dirección como si fueran una medición.
        const panel = M.institucionalDesde([caso(1, 'abierto', 1)], null);
        assert.deepStrictEqual(panel.grados, []);
    });

    test('la espera se mide sobre la señal sin atender más antigua', () => {
        const panel = M.institucionalDesde(
            [caso(1, 'abierto', 9), caso(1, 'cerrado', 40)], null);

        const espera = panel.kpis.find((k) => k.etiqueta.includes('más antigua'));
        assert.strictEqual(espera.valor, 9, 'el caso cerrado ya no espera a nadie');
        assert.strictEqual(espera.tipo, 'down', 'nueve días esperando no es una buena noticia');
    });
});
