/* ===========================================================================
 * Lumys — la frontera entre roles
 * ---------------------------------------------------------------------------
 * La plataforma le hace al estudiante tres promesas explícitas, escritas en su
 * propia interfaz:
 *
 *   · en el check-in     "Lo que escribís no se comparte palabra por palabra"
 *   · al cerrarlo        "Nadie lee lo que escribiste palabra por palabra"
 *   · al registrarse     "Lumys nunca comparte lo que escribo palabra por palabra"
 *
 * Una promesa que solo vive en un texto de la interfaz no es una garantía: es
 * una intención. Estas pruebas la convierten en algo que se rompe en CI.
 *
 * El caso que las motivó fue real. `GET /usuarios/:id/checkins` devolvía
 * `textoLibre` y el objeto `respuestas` completo —con los turnos y su respuesta
 * literal— a orientadores, psicólogos y administración. La interfaz no lo
 * pintaba, así que no se veía; pero el dato viajaba en el JSON y estaba a una
 * pestaña de red de distancia. No pintar algo no es protegerlo.
 * =========================================================================== */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');

const { proyectarParaAcompanamiento } = require('../src/usuarios/usuarios.service');
const { alcanceDeEstudiantes } = require('../src/middlewares/permisos.middlewares');

/** Un check-in tal como queda guardado, con todo lo sensible dentro. */
const registroCompleto = () => ({
    id: 7,
    fecha: new Date('2026-03-04T14:20:00Z'),
    puntajeIcve: 58,
    textoLibre: 'Discutí con mi mamá y me fui a dormir llorando. No se lo cuento a nadie.',
    respuestas: {
        turnos: [
            { componente: 'animo', pregunta: '¿Cómo venís?', respuesta: 'Mal, discutí en casa otra vez', valor: 2 },
            { componente: 'sueno', pregunta: '¿Dormiste?', respuesta: 'Casi nada, lloré hasta tarde', valor: 1 },
        ],
        componentes: { animo: 2, sueno: 1, energia: 3 },
        cobertura: 0.6,
        analisis: {
            coach: 'Gracias por contarlo. Mañana seguimos.',
            nota_orientador: 'Reporta tensión en casa y menos sueño que lo habitual. Vale conversar esta semana.',
            factores: [
                { factor: 'Duerme menos que lo habitual', direccion: 'riesgo', evidencia: 'lloré hasta tarde' },
                { factor: 'Mantiene el vínculo con amigos', direccion: 'protege' },
            ],
            sentimiento: 'negativo',
            confianza: 0.72,
            nivel_riesgo: 2,
            necesita_persona: true,
            explicacion: 'Dos componentes por debajo de su promedio.',
        },
        voz: {
            indicadores: { ritmo: 'más lento que su promedio' },
            nota: 'Habla más lento que en sus últimos registros.',
            caracteristicas: { duracionSegundos: 31.4, variacionTono: 18.2, palabrasPorMinuto: 92 },
        },
    },
});

/** Recorre un objeto y devuelve todos los valores de texto que contiene, a
 *  cualquier profundidad. Es la forma honesta de comprobar que algo NO está:
 *  buscar la clave por nombre se saltaría una copia anidada. */
function textosDe(valor, acumulado = []) {
    if (typeof valor === 'string') acumulado.push(valor);
    else if (Array.isArray(valor)) valor.forEach((v) => textosDe(v, acumulado));
    else if (valor && typeof valor === 'object') Object.values(valor).forEach((v) => textosDe(v, acumulado));
    return acumulado;
}

describe('lo que ve quien acompaña a un estudiante', () => {

    test('el texto libre no sale, ni siquiera anidado', () => {
        const visto = proyectarParaAcompanamiento(registroCompleto());
        const todo = textosDe(visto).join(' \n ');

        assert.ok(
            !todo.includes('Discutí con mi mamá'),
            'el texto libre del estudiante viajó en la respuesta',
        );
        assert.ok(
            !todo.includes('me fui a dormir llorando'),
            'el texto libre del estudiante viajó en la respuesta',
        );
    });

    test('las respuestas literales de cada turno tampoco salen', () => {
        const visto = proyectarParaAcompanamiento(registroCompleto());
        const todo = textosDe(visto).join(' \n ');

        assert.ok(!todo.includes('discutí en casa otra vez'), 'salió la respuesta literal de un turno');
        assert.ok(!todo.includes('lloré hasta tarde'), 'salió la respuesta literal de un turno');
        assert.strictEqual(visto.turnos, undefined, 'no debe existir la clave `turnos`');
        assert.strictEqual(visto.textoLibre, undefined, 'no debe existir la clave `textoLibre`');
        assert.strictEqual(visto.respuestas, undefined, 'no debe existir la clave `respuestas`');
    });

    test('la evidencia que el modelo citó tampoco se filtra', () => {
        // `factores[].evidencia` puede traer una cita casi literal. El prompt le
        // pide al modelo que parafrasee, pero un prompt es una petición, no una
        // garantía: la proyección se queda con el factor y la dirección.
        const visto = proyectarParaAcompanamiento(registroCompleto());
        assert.ok(
            visto.factores.every((f) => f.evidencia === undefined),
            'la evidencia del factor llegó hasta el orientador',
        );
    });

    test('las características crudas de la voz se quedan en el servidor', () => {
        const visto = proyectarParaAcompanamiento(registroCompleto());
        assert.strictEqual(
            visto.voz.caracteristicas, undefined,
            'las seis métricas prosódicas son insumo del promedio propio, no material de lectura',
        );
        assert.ok(visto.voz.nota, 'sí debe llegar la lectura en palabras');
    });

    test('sí llega todo lo que hace falta para acompañar y para ver patrones', () => {
        const visto = proyectarParaAcompanamiento(registroCompleto());

        // La serie temporal y los componentes son lo que alimenta el análisis de
        // patrones: sin esto el tablero es un semáforo sin argumento.
        assert.strictEqual(visto.icve, 58);
        assert.deepStrictEqual(visto.componentes, { animo: 2, sueno: 1, energia: 3 });
        assert.strictEqual(visto.cobertura, 0.6);
        assert.ok(visto.fecha instanceof Date);

        // La explicación, parafraseada.
        assert.match(visto.nota, /tensión en casa/);
        assert.strictEqual(visto.factores.length, 2);
        assert.deepStrictEqual(visto.factores[0], {
            factor: 'Duerme menos que lo habitual', direccion: 'riesgo',
        });
        assert.strictEqual(visto.sentimiento, 'negativo');
        assert.strictEqual(visto.confianza, 0.72);
        assert.strictEqual(visto.necesita_persona, true);
    });

    test('se sabe que el estudiante escribió, sin saber qué escribió', () => {
        const registro = registroCompleto();
        const visto = proyectarParaAcompanamiento(registro);
        assert.strictEqual(visto.escribio, true);
        assert.strictEqual(visto.largoTexto, registro.textoLibre.length);

        const sinTexto = proyectarParaAcompanamiento({ ...registroCompleto(), textoLibre: null });
        assert.strictEqual(sinTexto.escribio, false);
        assert.strictEqual(sinTexto.largoTexto, 0);
    });

    test('el nivel de riesgo crudo no viaja', () => {
        // El orientador ve `necesita_persona`, que es accionable. El número del
        // 0 al 3 es una etiqueta, y etiquetar es justo lo que la plataforma dice
        // que no hace.
        const visto = proyectarParaAcompanamiento(registroCompleto());
        assert.strictEqual(visto.nivel_riesgo, undefined);
    });

    test('un registro a medias no revienta la proyección', () => {
        // Si el modelo falló, el check-in se guarda igual y `analisis` queda
        // vacío. La respuesta tiene que seguir siendo válida.
        const visto = proyectarParaAcompanamiento({
            id: 1, fecha: new Date(), puntajeIcve: null, textoLibre: null, respuestas: {},
        });
        assert.deepStrictEqual(visto.factores, []);
        assert.strictEqual(visto.nota, null);
        assert.strictEqual(visto.voz, null);
    });
});

describe('alcance de datos por rol', () => {

    test('un estudiante solo se alcanza a sí mismo', async () => {
        const alcance = await alcanceDeEstudiantes({
            id: 42, rol: 'USUARIO', perfil: 'ESTUDIANTE', institucionId: 3,
        });
        assert.deepStrictEqual(alcance, { id: 42 });
    });

    test('un orientador alcanza a los estudiantes de SU institución, no de otra', async () => {
        const alcance = await alcanceDeEstudiantes({
            id: 20, rol: 'USUARIO', perfil: 'ORIENTADOR', institucionId: 3,
        });
        assert.deepStrictEqual(alcance, { perfil: 'ESTUDIANTE', institucionId: 3 });
    });

    test('un orientador sin institución no alcanza a nadie', async () => {
        // El -1 no es un valor mágico caprichoso: es un id que no existe. Sin
        // él, `institucionId: undefined` haría que Prisma ignorara la condición
        // y devolviera TODOS los estudiantes de la plataforma.
        const alcance = await alcanceDeEstudiantes({
            id: 21, rol: 'USUARIO', perfil: 'ORIENTADOR', institucionId: null,
        });
        assert.deepStrictEqual(alcance, { perfil: 'ESTUDIANTE', institucionId: -1 });
    });

    test('un psicólogo tiene el mismo alcance que un orientador, no más', async () => {
        const alcance = await alcanceDeEstudiantes({
            id: 30, rol: 'USUARIO', perfil: 'PSICOLOGO', institucionId: 3,
        });
        assert.deepStrictEqual(alcance, { perfil: 'ESTUDIANTE', institucionId: 3 });
    });

    test('un docente NO alcanza a los estudiantes', async () => {
        // DOCENTE puede ver el radar del centro (agregado) pero no la lista de
        // estudiantes. Si esto cambiara, cualquier profesor vería el historial
        // de cualquier alumno de su colegio.
        const alcance = await alcanceDeEstudiantes({
            id: 50, rol: 'USUARIO', perfil: 'DOCENTE', institucionId: 3,
        });
        assert.deepStrictEqual(alcance, { id: 50 });
    });

    test('administración y auditoría ven la plataforma entera', async () => {
        for (const rol of ['ADMIN', 'AUDITOR']) {
            const alcance = await alcanceDeEstudiantes({ id: 1, rol, perfil: null, institucionId: null });
            assert.deepStrictEqual(alcance, {}, `${rol} debería tener alcance total`);
        }
    });
});
