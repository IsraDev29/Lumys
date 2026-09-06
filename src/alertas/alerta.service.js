const prisma = require('../db');
const { alcanceDeEstudiantes } = require('../middlewares/permisos.middlewares');

// ---------------------------------------------------------------------------
// Alertas — la bandeja del orientador
//
// `SenalDetectada` la escribe icve.service al cerrar un check-in. Hasta acá el
// sistema detectaba y guardaba, pero nadie lo leía: este módulo es el puente
// entre la señal y la persona que puede hacer algo con ella.
//
// Dos reglas mandan sobre todo lo demás en este archivo:
//
// 1. Explicabilidad. Un orientador no actúa sobre un número. La respuesta trae
//    QUÉ componentes se movieron respecto a la línea base del propio estudiante
//    y por qué se abrió la señal, no solo el puntaje. Si esto se recorta, el
//    tablero vuelve a ser un semáforo sin argumento.
//
// 2. Privacidad. La app le promete al estudiante que nadie lee su texto palabra
//    por palabra. Eso incluye `CheckIn.textoLibre` Y `CheckIn.respuestas`, que
//    guarda los turnos con sus respuestas literales (hasta 2000 caracteres cada
//    una, ver ia.schema.js). Por eso de `respuestas` acá solo sale la paráfrasis
//    que el análisis dejó en `analisis.nota_orientador`, nunca el objeto entero.
// ---------------------------------------------------------------------------

// Tope de la bandeja. No es paginación: es que una lista de 300 alertas no se
// atiende, se ignora. Se ordena por nivel para que el 3 nunca quede fuera.
const LIMITE = 50;

// La señal se crea dentro del mismo request que el check-in que la originó
// (ver procesarRegistro), así que su `creadoEn` cae milisegundos después de
// `CheckIn.fecha`. Cinco minutos es margen de sobra para reencontrar ese
// check-in y, a la vez, lo bastante estrecho para no colgarle a una señal la
// nota de un registro anterior que no tiene nada que ver.
const TOLERANCIA_MS = 5 * 60 * 1000;

// Cómo se lee cada componente cuando se desvía. Los valores van de 1 a 5 con 5
// como la mejor situación, así que un delta negativo es un empeoramiento.
// El texto es deliberadamente descriptivo y no clínico: el orientador tiene que
// poder repetirlo en voz alta frente al estudiante sin que suene a diagnóstico.
const FRASES = {
    animo: { baja: 'Ánimo más bajo que lo habitual', sube: 'Ánimo mejor que lo habitual' },
    sueno: { baja: 'Duerme peor que lo habitual', sube: 'Duerme mejor que lo habitual' },
    energia: { baja: 'Con menos energía que lo habitual', sube: 'Con más energía que lo habitual' },
    vinculo: { baja: 'Menos contacto con otros que lo habitual', sube: 'Más contacto con otros que lo habitual' },
    concentracion: {
        baja: 'Le cuesta concentrarse más que lo habitual',
        sube: 'Se concentra mejor que lo habitual',
    },
};

/**
 * Convierte los componentes desviados en frases legibles.
 *
 * Los empeoramientos van primero y ordenados por magnitud, porque el tablero
 * muestra solo los dos primeros (`señales.slice(0, 2)`) y la ficha arma una
 * oración con `señales[0]`: si ahí cayera una mejora, la tarjeta diría lo
 * contrario de lo que pasa.
 */
function frasesDeDesviacion(desviados) {
    return [...desviados]
        .filter((d) => FRASES[d.componente])
        .sort((a, b) => {
            // Primero lo que empeora; dentro de cada grupo, lo más marcado.
            if (a.delta < 0 !== b.delta < 0) return a.delta < 0 ? -1 : 1;
            return Math.abs(b.delta) - Math.abs(a.delta);
        })
        .map((d) => FRASES[d.componente][d.delta < 0 ? 'baja' : 'sube']);
}

/**
 * La nota parafraseada del análisis, y nada más.
 *
 * Se consulta el check-in de a uno y con la ventana de tiempo puesta en el
 * `where`: la alternativa (traer los check-ins recientes de todos los
 * estudiantes y cruzarlos en memoria) es una sola consulta, pero carga en el
 * proceso el texto literal de decenas de personas para terminar usando un campo
 * de cada una. Leer exactamente la fila que hace falta es más barato en
 * exposición, que acá es lo que importa.
 *
 * Devuelve null si no se encuentra el check-in de origen. Es preferible una
 * alerta sin nota que una alerta con la nota de otro registro.
 */
async function contextoDeLaSenal(senal) {
    const desde = new Date(senal.creadoEn.getTime() - TOLERANCIA_MS);

    const checkIn = await prisma.checkIn.findFirst({
        where: {
            estudianteId: senal.estudianteId,
            fecha: { gte: desde, lte: senal.creadoEn },
        },
        orderBy: { fecha: 'desc' },
        // `respuestas` entra al proceso pero no sale de esta función: abajo se
        // extraen dos campos y el resto se descarta.
        select: { respuestas: true },
    });

    const analisis = checkIn?.respuestas?.analisis || {};

    return {
        nota: analisis.nota_orientador || null,
        // Del factor sale el nombre corto y la dirección, no la `evidencia`.
        // El prompt le pide al modelo que la evidencia sea paráfrasis y nunca
        // cita literal, pero es texto generado sobre lo que escribió el
        // estudiante: si el modelo se sale del molde una vez, la cita aparece
        // en pantalla. No exponerla cuesta nada y cierra esa puerta.
        factores: (analisis.factores || []).map((f) => ({
            factor: f.factor,
            direccion: f.direccion,
        })),
    };
}

/**
 * Arma la alerta con la forma que ya consume el tablero (`DEMO.casos` en
 * client/src/lib/demo.ts). Se respetan esos nombres —incluido `señales` con eñe— para
 * que el frontend funcione igual con datos reales que con los de demostración.
 */
function comoAlerta(senal, contexto) {
    const patron = senal.componentePatron || {};
    const desviados = Array.isArray(patron.desviados) ? patron.desviados : [];

    const frases = frasesDeDesviacion(desviados);

    // La ficha hace `señales[0].toLowerCase()` sin comprobar nada. Una señal por
    // lenguaje de riesgo puede no tener componentes desviados (dispara en el
    // primer registro, sin línea base), así que la lista nunca puede ir vacía.
    if (!frases.length) frases.push(patron.motivo || 'Cambio detectado en el check-in');

    return {
        // El tablero usa `id.slice(-3)` para el avatar y lo imprime como
        // etiqueta, así que tiene que ser texto. El número real va aparte,
        // porque es el que reciben POST /:id/caso y DELETE /:id.
        id: `AL-${String(senal.id).padStart(3, '0')}`,
        senalId: senal.id,
        estudianteId: senal.estudianteId,
        alias: senal.estudiante.nombre,
        nivel: senal.nivelRespuesta,
        // Todas las de este listado están sin atender: si tuvieran caso, no
        // estarían acá.
        estado: 'abierto',
        desde: senal.creadoEn,
        señales: frases,
        semanas: senal.semanasSostenidas,
        // Sin caso todavía no hay contacto ni responsable asignado. Van en null
        // y no omitidos para que el tablero no tenga que adivinar.
        ultimoContacto: null,
        responsable: null,
        linea: [
            {
                t: senal.creadoEn,
                texto: patron.motivo || 'Señal detectada.',
                tipo: senal.lenguajeRiesgoExplicito ? 'alerta' : 'sistema',
            },
        ],

        // --- Explicabilidad: el porqué, no solo el cuánto ---
        motivo: patron.motivo || null,
        // Los números crudos de cada componente, para que el orientador pueda
        // contrastar "hoy" contra "lo habitual" de ese mismo estudiante.
        componentes: desviados.map((d) => ({
            componente: d.componente,
            habitual: d.habitual,
            hoy: d.hoy,
            delta: d.delta,
            direccion: d.delta < 0 ? 'empeora' : 'mejora',
        })),
        icve: patron.icve ?? null,
        lineaBase: patron.referencia ?? null,
        deltaIcve: senal.deltaIcve,
        riesgoExplicito: senal.lenguajeRiesgoExplicito,
        nota: contexto.nota,
        factores: contexto.factores,
    };
}

/**
 * GET /alertas — señales todavía sin caso, acotadas al alcance del solicitante.
 *
 * El filtro de visibilidad se arma con `alcanceDeEstudiantes` y viaja dentro del
 * where de la consulta: un orientador ve las señales de su institución y nada
 * más, porque la base nunca llega a devolver las otras.
 *
 * `caso: null` es lo que define "sin atender". Una señal con caso —abierto o
 * cerrado— sale de la bandeja: el seguimiento ya vive en el caso.
 */
async function listarAlertasVisibles(solicitante) {
    const alcance = await alcanceDeEstudiantes(solicitante);

    const senales = await prisma.senalDetectada.findMany({
        where: { caso: null, estudiante: alcance },
        // Nivel 3 arriba siempre. Dentro del mismo nivel, lo más reciente.
        orderBy: [{ nivelRespuesta: 'desc' }, { creadoEn: 'desc' }],
        take: LIMITE,
        select: {
            id: true,
            estudianteId: true,
            deltaIcve: true,
            componentePatron: true,
            lenguajeRiesgoExplicito: true,
            semanasSostenidas: true,
            nivelRespuesta: true,
            creadoEn: true,
            estudiante: { select: { nombre: true } },
        },
    });

    const contextos = await Promise.all(senales.map(contextoDeLaSenal));

    return senales.map((senal, i) => comoAlerta(senal, contextos[i]));
}

/**
 * Busca la señal solo dentro de lo que este usuario puede ver.
 *
 * Devuelve null tanto si la señal no existe como si existe pero es de otra
 * institución. Quien llama responde 403 en los dos casos: distinguirlos le
 * confirmaría a un curioso que cierto identificador corresponde a un estudiante
 * real con una alerta abierta.
 */
async function senalEnAlcance(senalId, solicitante) {
    const alcance = await alcanceDeEstudiantes(solicitante);

    return prisma.senalDetectada.findFirst({
        where: { id: senalId, estudiante: alcance },
        select: { id: true, caso: { select: { id: true, estado: true } } },
    });
}

/**
 * POST /alertas/:id/caso — abre el caso a partir de la señal.
 *
 * La relación es 1:1 (`senalId` es único), así que el caso queda anclado a la
 * evidencia que lo justificó: cuando alguien pregunte por qué se abrió, la
 * respuesta es el `componentePatron` de esa señal y no la memoria de nadie.
 */
function abrirCaso(senalId, orientadorId, { planSeguridad, accionRegistrada }) {
    return prisma.casoOrientador.create({
        data: {
            senalId,
            orientadorId,
            estado: 'ABIERTO',
            planSeguridad: planSeguridad ?? null,
            accionRegistrada: accionRegistrada ?? null,
        },
        select: {
            id: true,
            senalId: true,
            orientadorId: true,
            estado: true,
            planSeguridad: true,
            accionRegistrada: true,
            creadoEn: true,
        },
    });
}

/**
 * DELETE /alertas/:id — saca la alerta de la bandeja una vez atendida.
 *
 * No borra la señal. Registra un caso ya cerrado, que es lo que de verdad pasó:
 * una persona la miró y decidió que no hacía falta abrir seguimiento. Borrar la
 * fila tendría tres costos: se pierde el historial clínico del estudiante, se
 * pierde quién la descartó y cuándo, y la próxima señal sostenida volvería a
 * aparecer sin que nadie sepa que ya se había revisado una igual.
 *
 * Además, como el listado filtra por `caso: null`, dejar el caso cerrado es
 * justo lo que la retira de la bandeja sin ninguna columna nueva.
 */
function cerrarAlerta(senalId, orientadorId, motivo) {
    return prisma.casoOrientador.create({
        data: {
            senalId,
            orientadorId,
            estado: 'CERRADO',
            fechaCierre: new Date(),
            accionRegistrada: motivo || 'Alerta revisada y cerrada sin abrir caso.',
        },
        select: {
            id: true,
            senalId: true,
            orientadorId: true,
            estado: true,
            accionRegistrada: true,
            fechaCierre: true,
            creadoEn: true,
        },
    });
}

module.exports = {
    LIMITE,
    listarAlertasVisibles,
    senalEnAlcance,
    abrirCaso,
    cerrarAlerta,
};
