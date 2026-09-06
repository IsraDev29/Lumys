const prisma = require('../db');
const avatar = require('./avatar.service');
const { COMPONENTES } = require('../IA/ia.prompt');

// ---------------------------------------------------------------------------
// Agregados comunitarios
//
// El gemelo comunitario le muestra a un orientador cómo viene su centro sin
// mostrarle a nadie en particular. Todo este archivo existe para sostener esa
// frase, y su regla más importante es el umbral de abajo.
//
// Por qué un mínimo y no simplemente "no mostramos nombres": en un grupo de
// tres estudiantes, un promedio ES un dato personal. Si el orientador sabe
// quiénes son los tres —y lo sabe— un promedio que se dispara le dice de quién
// se trata con bastante precisión. Quitar el nombre no anonimiza nada cuando el
// grupo es chico.
//
// El umbral está en 10 porque es donde un valor extremo individual deja de
// mover el promedio lo suficiente como para ser identificable. Bajarlo hace la
// demo más vistosa (más grupos con datos) y la plataforma indefendible.
// ---------------------------------------------------------------------------

const MINIMO_PARA_AGREGAR = 10;

// Ventana de los agregados. Un mes es suficiente para ver una tendencia de
// centro y corto como para que el dato siga siendo del presente.
const DIAS_VENTANA = 30;

const ETIQUETAS = {
    animo: 'Ánimo',
    sueno: 'Sueño',
    energia: 'Energía',
    vinculo: 'Apoyo social',
    concentracion: 'Concentración',
};

function desde(dias) {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - dias);
    return fecha;
}

/**
 * Promedia los componentes de un conjunto de check-ins.
 *
 * Devuelve null por debajo del umbral. Que devuelva null y no un objeto vacío
 * es a propósito: obliga a quien llame a decidir qué mostrar en ese caso, en
 * vez de dejar pasar un promedio de cero como si fuera un dato.
 */
function promediarComponentes(registros) {
    if (registros.length < MINIMO_PARA_AGREGAR) return null;

    const acumulado = {};
    const cuenta = {};

    for (const registro of registros) {
        const componentes = registro.respuestas?.componentes || {};
        for (const clave of COMPONENTES) {
            const valor = componentes[clave];
            if (typeof valor !== 'number') continue;
            acumulado[clave] = (acumulado[clave] || 0) + valor;
            cuenta[clave] = (cuenta[clave] || 0) + 1;
        }
    }

    const promedio = {};
    for (const clave of COMPONENTES) {
        // Cada componente tiene que pasar el umbral por separado: que el grupo
        // tenga 30 check-ins no significa que 30 hayan hablado de sueño.
        if (!cuenta[clave] || cuenta[clave] < MINIMO_PARA_AGREGAR) continue;
        promedio[clave] = Number((acumulado[clave] / cuenta[clave]).toFixed(2));
    }

    return Object.keys(promedio).length ? promedio : null;
}

/** Promedio de ICVE de un conjunto, o null si el grupo es demasiado chico. */
function promediarIcve(registros) {
    const puntajes = registros.map((r) => r.puntajeIcve).filter((p) => typeof p === 'number');
    if (puntajes.length < MINIMO_PARA_AGREGAR) return null;
    return Math.round(puntajes.reduce((s, p) => s + p, 0) / puntajes.length);
}

/**
 * Radar del centro: cómo viene este mes contra su propio mes anterior.
 *
 * La comparación es del centro consigo mismo, igual que la del estudiante con
 * su propio historial. Un ranking entre colegios convertiría esto en algo que
 * un director querría maquillar, y el primer efecto sería que los estudiantes
 * dejen de registrar la verdad.
 */
async function radarDelCentro(institucionId) {
    const [actuales, previos] = await Promise.all([
        prisma.checkIn.findMany({
            where: { estudiante: { institucionId }, fecha: { gte: desde(DIAS_VENTANA) } },
            select: { puntajeIcve: true, respuestas: true },
        }),
        prisma.checkIn.findMany({
            where: {
                estudiante: { institucionId },
                fecha: { gte: desde(DIAS_VENTANA * 2), lt: desde(DIAS_VENTANA) },
            },
            select: { puntajeIcve: true, respuestas: true },
        }),
    ]);

    const actual = promediarComponentes(actuales);
    const previo = promediarComponentes(previos);

    const icveActual = promediarIcve(actuales);

    return {
        suficiente: actual !== null,
        minimo: MINIMO_PARA_AGREGAR,
        registros: actuales.length,
        clima: avatar.climaDeIcve(icveActual),
        titular: titularDelCentro(icveActual, promediarIcve(previos)),
        ejes: COMPONENTES.map((c) => ETIQUETAS[c]),
        // Se manda la clave junto a la etiqueta para que el frontend no tenga
        // que reconstruir la correspondencia por posición del array.
        claves: COMPONENTES,
        actual: actual ? COMPONENTES.map((c) => actual[c] ?? null) : null,
        promedio: previo ? COMPONENTES.map((c) => previo[c] ?? null) : null,
    };
}

function titularDelCentro(icveActual, icvePrevio) {
    if (icveActual === null) {
        return `Todavía no hay ${MINIMO_PARA_AGREGAR} registros este mes. Sin eso no se muestra ningún promedio.`;
    }
    if (icvePrevio === null) return 'Primer mes con datos suficientes. Este es el punto de partida del centro.';

    const delta = icveActual - icvePrevio;
    if (Math.abs(delta) < 5) return 'El centro viene parecido a su propio mes anterior.';
    if (delta > 0) return 'El centro viene un poco más cargado que su propio mes anterior.';
    return 'El centro viene más liviano que su propio mes anterior.';
}

/**
 * Agregados por institución dentro del municipio.
 *
 * El esquema no tiene grado ni sección —el frontend de demostración muestra
 * "7mo A", "8vo B"—, así que el corte más fino que se puede hacer hoy es por
 * institución. Agrupar por aula necesita un campo en el modelo Usuario que no
 * existe; se deja anotado en vez de inventar una agrupación falsa.
 */
async function grupos(institucionId) {
    const propia = await prisma.institucion.findUnique({
        where: { id: institucionId },
        select: { municipioId: true },
    });

    const instituciones = await prisma.institucion.findMany({
        where: propia?.municipioId ? { municipioId: propia.municipioId } : { id: institucionId },
        select: { id: true, nombre: true },
    });

    const resultado = [];

    for (const institucion of instituciones) {
        const registros = await prisma.checkIn.findMany({
            where: { estudiante: { institucionId: institucion.id }, fecha: { gte: desde(DIAS_VENTANA) } },
            select: { puntajeIcve: true },
        });

        const icve = promediarIcve(registros);

        resultado.push({
            // El nombre solo se revela si es la propia institución: saber cómo
            // viene el colegio de al lado no le sirve a nadie y sí habilita
            // comparaciones entre centros.
            nombre: institucion.id === institucionId ? institucion.nombre : 'Otro centro del municipio',
            propia: institucion.id === institucionId,
            registros: registros.length,
            suficiente: icve !== null,
            clima: icve === null ? null : avatar.climaDeIcve(icve),
            nota: icve === null
                ? `Menos de ${MINIMO_PARA_AGREGAR} registros: no se muestra`
                : 'Comparado con su propio promedio',
        });
    }

    return resultado;
}

/**
 * Vista del aprendizaje federado.
 *
 * Lo que el nombre promete: cada centro calcula su línea base con sus propios
 * datos y hacia afuera solo salen parámetros agregados, nunca registros. Lo que
 * esta función hace hoy es exponer ese recuento —cuántos registros aporta cada
 * centro— que es la parte del federado que el esquema actual sí sostiene.
 *
 * El entrenamiento federado propiamente dicho (promediar pesos de un modelo
 * entre centros) no está implementado y no se insinúa que lo esté: sería una
 * pieza de infraestructura aparte, no una consulta.
 */
async function federado(institucionId) {
    const instituciones = await prisma.institucion.findMany({
        select: { id: true, nombre: true },
    });

    const filas = [];

    for (const institucion of instituciones) {
        const registros = await prisma.checkIn.count({
            where: { estudiante: { institucionId: institucion.id } },
        });

        if (registros < MINIMO_PARA_AGREGAR && institucion.id !== institucionId) continue;

        filas.push({
            centro: institucion.id === institucionId ? `${institucion.nombre} · este centro` : 'Centro participante',
            aporte: institucion.id === institucionId ? 'Línea base propia' : 'Solo parámetros agregados',
            registros,
        });
    }

    return filas;
}

module.exports = {
    MINIMO_PARA_AGREGAR,
    DIAS_VENTANA,
    promediarComponentes,
    promediarIcve,
    radarDelCentro,
    grupos,
    federado,
};
