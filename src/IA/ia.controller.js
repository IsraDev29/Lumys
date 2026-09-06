const prisma = require('../db');
const iaService = require('./ia.service');
const vozService = require('./ia.voz.service');
const seguridad = require('./ia.seguridad');
const proveedoresIa = require('./proveedores');

// ---------------------------------------------------------------------------
// Contexto del estudiante
//
// La racha y la memoria de días anteriores se leen SIEMPRE de la base, nunca
// del cuerpo de la petición. El cliente ya manda la sesión en curso porque es
// suya; el historial no lo es, y aceptarlo desde el navegador permitiría
// inyectar texto arbitrario dentro del prompt del modelo.
// ---------------------------------------------------------------------------

const DIA = 86400000;

/** Días consecutivos con al menos un check-in, contando hacia atrás desde hoy. */
function calcularRacha(fechas) {
    if (!fechas.length) return 0;

    const aMedianoche = (f) => {
        const d = new Date(f);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
    };

    const dias = [...new Set(fechas.map(aMedianoche))].sort((a, b) => b - a);
    const hoy = aMedianoche(new Date());

    // Si el último check-in no es de hoy ni de ayer, la racha ya se cortó.
    if (hoy - dias[0] > DIA) return 0;

    let racha = 1;
    for (let i = 1; i < dias.length; i += 1) {
        if (dias[i - 1] - dias[i] !== DIA) break;
        racha += 1;
    }
    return racha;
}

async function contextoDelEstudiante(estudianteId) {
    // Dos consultas y no una: la racha necesita 30 fechas, la memoria necesita 3
    // explicaciones. Traer las dos cosas juntas obligaba a arrastrar el `respuestas`
    // completo de 30 check-ins —turnos incluidos, hasta 2000 caracteres cada
    // uno— para descartar 27 en memoria, y eso pasa en CADA turno del check-in.
    const [dias, ultimos] = await Promise.all([
        prisma.checkIn.findMany({
            where: { estudianteId },
            orderBy: { fecha: 'desc' },
            take: 30,
            select: { fecha: true },
        }),
        prisma.checkIn.findMany({
            where: { estudianteId },
            orderBy: { fecha: 'desc' },
            take: 3,
            select: { respuestas: true },
        }),
    ]);

    // Lo que se le pasa al modelo es la explicación que él mismo escribió: una
    // paráfrasis, nunca lo que el estudiante tecleó. La memoria de Lumy es de
    // patrones, no de frases.
    const memoria = ultimos
        .map((r) => r.respuestas?.analisis?.explicacion)
        .filter((texto) => typeof texto === 'string' && texto.length);

    return { racha: calcularRacha(dias.map((r) => r.fecha)), memoria };
}

/**
 * POST /ia/checkin/turno — devuelve el siguiente intercambio del check-in.
 *
 * Nunca responde 5xx: si la IA falla, `siguienteTurno` degrada a su banco local
 * y devuelve `generado: false`. Un check-in interrumpido a mitad es peor que un
 * check-in con una pregunta menos ingeniosa.
 */
async function siguienteTurno(req, res, next) {
    try {
        const { racha, memoria } = await contextoDelEstudiante(req.usuario.id);

        const usuario = await prisma.usuario.findUnique({
            where: { id: req.usuario.id },
            select: { nombre: true },
        });

        const turno = await iaService.siguienteTurno({
            nombre: usuario.nombre.split(' ')[0],
            racha,
            memoria,
            sesion: req.body.sesion,
        });

        // `motivo` es traza interna para depurar por qué el modelo eligió esta
        // pregunta. No sale al cliente: el estudiante no tiene que leer el
        // razonamiento del sistema sobre él.
        const { motivo, ...publico } = turno;
        res.status(200).json({ ...publico, turno: req.body.sesion.length + 1, racha });
    } catch (error) {
        next(error);
    }
}

/** POST /ia/analizar-texto */
async function analizarTexto(req, res, next) {
    try {
        res.status(200).json(await iaService.analizarTexto(req.body.texto));
    } catch (error) {
        next(error);
    }
}

/** POST /ia/analizar-voz — requiere consentimiento explícito. */
async function analizarVoz(req, res, next) {
    try {
        // El promedio propio sale de la base, nunca del cuerpo de la petición:
        // el historial no es del cliente, y aceptarlo desde el navegador
        // permitiría fabricar una desviación que no ocurrió.
        const registros = await prisma.checkIn.findMany({
            where: { estudianteId: req.usuario.id },
            orderBy: { fecha: 'desc' },
            take: 10,
            select: { respuestas: true },
        });

        const analisis = await vozService.analizarVoz({
            caracteristicas: req.body.caracteristicas,
            propioPromedio: vozService.promedioPropio(registros),
            consentimiento: req.body.consentimiento,
        });
        res.status(200).json(analisis);
    } catch (error) {
        next(error);
    }
}

/**
 * GET /ia/estado — qué proveedores pueden atender ahora mismo.
 *
 * El frontend lo usa para saber si está hablando con un modelo o con el banco
 * local, y mostrarlo. Que el estudiante sepa cuándo hay IA detrás y cuándo no
 * es parte de lo que la plataforma promete sobre sus datos.
 *
 * El desglose por proveedor sirve además para operar: es la forma de ver desde
 * afuera si el modelo local está levantado sin entrar a la máquina.
 */
async function estado(req, res, next) {
    try {
        const { estrategia, proveedores } = await proveedoresIa.estado();

        res.status(200).json({
            disponible: Object.values(proveedores).some((p) => p.disponible),
            estrategia,
            proveedores,
            niveles_riesgo: seguridad.NOMBRE_DE_NIVEL,
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    calcularRacha,
    contextoDelEstudiante,
    siguienteTurno,
    analizarTexto,
    analizarVoz,
    estado,
};
