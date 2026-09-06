const prisma = require('../db');
const avatar = require('./avatar.service');
const { COMPONENTES } = require('../IA/ia.prompt');

// ---------------------------------------------------------------------------
// Gemelo digital del estudiante
//
// Es la vista que el estudiante tiene de sí mismo: su clima de hoy, su serie de
// las últimas dos semanas y qué se movió respecto de su propio patrón.
//
// Todo acá se calcula contra su propia línea base y nunca contra otros
// estudiantes. No es una decisión estética: un adolescente comparado con el
// promedio de su clase aprende que está peor que los demás, que es exactamente
// el efecto que esta plataforma existe para no producir.
// ---------------------------------------------------------------------------

const DIAS_SERIE = 14;

/** Días consecutivos con al menos un check-in, contando hacia atrás desde hoy. */
function calcularRacha(fechas) {
    if (!fechas.length) return 0;

    const DIA = 86400000;
    const aMedianoche = (f) => {
        const d = new Date(f);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
    };

    const dias = [...new Set(fechas.map(aMedianoche))].sort((a, b) => b - a);
    const hoy = aMedianoche(new Date());

    if (hoy - dias[0] > DIA) return 0;

    let racha = 1;
    for (let i = 1; i < dias.length; i += 1) {
        if (dias[i - 1] - dias[i] !== DIA) break;
        racha += 1;
    }
    return racha;
}

/**
 * Qué componentes se movieron respecto del patrón habitual, en lenguaje llano.
 *
 * Es la parte "explicable" del gemelo: sin esto el estudiante ve una línea que
 * sube y baja sin saber por qué, que es tan poco útil como no ver nada.
 */
function lecturaIpsativa(componentesHoy, patronNormal) {
    if (!patronNormal) return [];

    const ETIQUETAS = {
        animo: 'Ánimo',
        sueno: 'Sueño',
        energia: 'Energía',
        vinculo: 'Tiempo con gente',
        concentracion: 'Concentración',
    };

    return COMPONENTES.filter((clave) => typeof componentesHoy[clave] === 'number')
        .map((clave) => {
            const hoy = componentesHoy[clave];
            const habitual = patronNormal[clave];

            // `hoy` y `habitual` viajan siempre, incluso cuando la tendencia es
            // 'igual'. La tarjeta ipsativa del estudiante muestra el valor de
            // hoy y su distancia al promedio; sin los números tendría que
            // deducirlos de la etiqueta, que es como se terminan inventando.
            const base = { componente: clave, etiqueta: ETIQUETAS[clave], hoy };

            if (typeof habitual !== 'number') {
                return { ...base, habitual: null, delta: null, tendencia: 'igual', nota: 'Todavía sin patrón' };
            }

            const delta = Number((hoy - habitual).toFixed(2));

            // Menos de un punto en una escala de 5 es ruido. Nombrarlo haría que
            // el estudiante viera "cambios" todos los días y dejara de creerles.
            if (Math.abs(delta) < 1) {
                return { ...base, habitual, delta, tendencia: 'igual', nota: 'Igual que tu promedio' };
            }

            // Ojo con el signo: en los componentes 5 es lo mejor, al revés que
            // en el ICVE. Un delta positivo acá es una buena noticia.
            return {
                ...base,
                habitual,
                delta,
                tendencia: delta > 0 ? 'sube' : 'baja',
                nota: delta > 0 ? 'Mejor que tu promedio' : 'Por debajo de tu promedio',
            };
        });
}

/**
 * Arma el gemelo digital de un estudiante.
 *
 * Recibe un solo id y lo trata como propio: el controlador siempre le pasa
 * `req.usuario.id`, nunca un parámetro de la URL. La función no comprueba
 * permisos porque no puede — no sabe quién pregunta. Si algún día un orientador
 * pudiera abrir el gemelo de alguien a quien acompaña, el filtro va en el
 * controlador (con `alcanceDeEstudiantes`), no acá.
 *
 * Devuelve `mensaje`, que es el coach del último check-in, y la lectura
 * ipsativa. Nunca devuelve el texto libre: esta vista la mira el estudiante,
 * pero la regla de no reexponer lo que escribió vale igual.
 */
async function construir(estudianteId) {
    const [registros, lineaBase, usuario] = await Promise.all([
        prisma.checkIn.findMany({
            where: { estudianteId },
            orderBy: { fecha: 'desc' },
            take: 30,
            select: { fecha: true, puntajeIcve: true, respuestas: true, resumenIa: true },
        }),
        prisma.lineaBase.findUnique({ where: { estudianteId } }),
        prisma.usuario.findUnique({ where: { id: estudianteId }, select: { nombre: true } }),
    ]);

    const ultimo = registros[0] || null;
    const icveHoy = ultimo?.puntajeIcve ?? null;
    const promedioPropio = lineaBase?.promedioIcveMovil ?? null;

    const hoyMedianoche = new Date();
    hoyMedianoche.setHours(0, 0, 0, 0);

    return {
        nombre: usuario?.nombre?.split(' ')[0] || null,
        clima: avatar.climaDeIcve(icveHoy),
        titular: avatar.titularIpsativo(icveHoy, promedioPropio),

        racha: calcularRacha(registros.map((r) => r.fecha)),
        totalRegistros: registros.length,
        // Lo consulta la pantalla de inicio para saber si ofrecer el check-in o
        // felicitar por el de hoy.
        checkinHoy: Boolean(ultimo && new Date(ultimo.fecha) >= hoyMedianoche),

        // La serie va en orden cronológico, que es como se dibuja el gráfico.
        // Se manda el ICVE porque esta serie alimenta la Huella Emocional, donde
        // la forma de la curva importa más que cada valor suelto.
        // Se descartan los check-ins sin puntaje. Un `valor: null` en medio de
        // la serie rompe el trazado del gráfico —la línea salta al origen— y no
        // aporta nada: son check-ins donde el estudiante no cubrió ningún
        // componente, así que no hay día que dibujar.
        serie: registros
            .slice(0, DIAS_SERIE)
            .reverse()
            .filter((r) => typeof r.puntajeIcve === 'number')
            .map((r) => ({ fecha: r.fecha, valor: r.puntajeIcve })),

        promedioPropio: promedioPropio === null ? null : Math.round(promedioPropio),
        ipsativa: lecturaIpsativa(ultimo?.respuestas?.componentes || {}, lineaBase?.patronNormal),
        // El mensaje del último check-in, que lo escribió el modelo para él.
        mensaje: ultimo?.resumenIa || null,
    };
}

module.exports = { DIAS_SERIE, calcularRacha, lecturaIpsativa, construir };
