const prisma = require('../db');
const icve = require('./icve.service');
const iaService = require('../IA/ia.service');
const vozService = require('../IA/ia.voz.service');
const seguridad = require('../IA/ia.seguridad');

// ---------------------------------------------------------------------------
// Registros emocionales
//
// El cierre del check-in es el punto donde convergen las tres capas:
//
//   1. Aritmética  → icve.service calcula el puntaje y lo compara con la propia
//                    línea base del estudiante.
//   2. Modelo      → ia.service explica ese número y escribe el mensaje de
//                    vuelta, con lenguaje humano.
//   3. Determinismo→ ia.seguridad pone el piso del nivel de riesgo, que el
//                    modelo puede subir pero nunca bajar.
//
// El orden importa: el puntaje se calcula ANTES de llamar al modelo, así el
// análisis recibe el número y el delta como contexto en vez de tener que
// estimarlos. Y si el modelo falla, el registro se guarda igual.
// ---------------------------------------------------------------------------

/** GET /registros — historial propio del estudiante (alimenta la Huella Emocional). */
async function listar(req, res, next) {
    try {
        const registros = await prisma.checkIn.findMany({
            where: { estudianteId: req.usuario.id },
            orderBy: { fecha: 'desc' },
            take: 60,
            select: { id: true, fecha: true, respuestas: true, textoLibre: true, resumenIa: true, puntajeIcve: true },
        });

        res.status(200).json(
            registros.map((r) => ({
                id: r.id,
                fecha: r.fecha,
                icve: r.puntajeIcve,
                texto: r.textoLibre,
                coach: r.resumenIa,
                // Cuánto del check-in se llegó a cubrir, de 0 a 1. Es lo que
                // separa "pasó y contestó dos cosas" de "hizo el check-in
                // entero", que es la distinción que dibuja el calendario de
                // constancia. Sin esto el calendario solo puede pintar
                // "apareció / no apareció" y su leyenda de tres niveles miente.
                cobertura: r.respuestas?.cobertura ?? null,
                // Los factores son lo que hace explicable el puntaje: sin ellos
                // el historial es una línea que sube y baja sin motivo visible.
                etiquetas: (r.respuestas?.analisis?.factores || []).map((f) => f.factor),
                sentimiento: r.respuestas?.analisis?.sentimiento || null,
            })),
        );
    } catch (error) {
        next(error);
    }
}

/**
 * POST /registros — cierra el check-in conversacional.
 *
 * Guarda primero y analiza después. Si el análisis fallara y estuviera dentro
 * de la misma transacción que el guardado, un problema de la API de IA haría
 * perder el check-in que el estudiante ya se tomó el trabajo de completar.
 */
async function crear(req, res, next) {
    try {
        const estudianteId = req.usuario.id;
        const { turnos, texto_usuario: textoLibre = null, voz = null } = req.body;

        const { icve: puntaje, componentes, cobertura } = icve.calcularIcve(turnos);

        // Se necesita la línea base ANTES de analizar, para que el modelo pueda
        // hablar de "más alto que tu promedio" en vez de solo describir hoy.
        //
        // Se trae también `patronNormal` —la media móvil de cada componente por
        // separado— porque un solo número global esconde justo lo que hace útil
        // el análisis. Dos estudiantes con el mismo ICVE de 62 pueden estar en
        // situaciones opuestas: uno durmiendo mal y el otro dejando de hablar
        // con la gente. `componentesDesviados` es lo que permite distinguirlos,
        // y hasta ahora se calculaba DESPUÉS de llamar al modelo (en
        // procesarRegistro), así que el modelo nunca lo veía.
        const lineaBase = await prisma.lineaBase.findUnique({
            where: { estudianteId },
            select: { promedioIcveMovil: true, patronNormal: true },
        });
        const referencia = lineaBase?.promedioIcveMovil ?? null;
        const delta = referencia === null || puntaje === null ? null : Math.round(puntaje - referencia);

        // Números derivados, no texto: qué componente se movió y cuánto respecto
        // a lo habitual DE ESE estudiante. Esto no toca la promesa de privacidad
        // —no hay una sola palabra suya acá— y es la señal más rica que tenemos.
        const desviados = icve.componentesDesviados(componentes, lineaBase?.patronNormal);

        const analisis = await iaService.analizarCheckin({
            turnos,
            textoLibre,
            icve: puntaje,
            lineaBase: referencia,
            delta,
            desviados,
        });

        // La voz es opcional y no mueve el puntaje: solo suma un factor que un
        // humano lee junto al resto. Ver ia.voz.service.js.
        let analisisVoz = null;
        if (voz) {
            analisisVoz = await vozService.analizarVoz({
                caracteristicas: voz.caracteristicas,
                // Comparar contra su propio promedio y no solo contra rangos de
                // manual: hablar lento no dice nada, hablar más lento que uno
                // mismo sí. Requiere historial, así que los primeros check-ins
                // con voz solo se comparan con la referencia general.
                propioPromedio: await promedioDeVoz(estudianteId),
                consentimiento: voz.consentimiento,
            });
        }

        const registro = await prisma.checkIn.create({
            data: {
                estudianteId,
                respuestas: {
                    turnos,
                    componentes,
                    cobertura,
                    analisis,
                    // Se guardan las características junto al análisis porque son
                    // la materia prima del promedio propio del próximo check-in.
                    // Son seis números, nunca audio ni transcripción.
                    voz: analisisVoz ? { ...analisisVoz, caracteristicas: voz.caracteristicas } : null,
                },
                textoLibre,
                resumenIa: analisis.coach,
                puntajeIcve: puntaje,
            },
            select: { id: true, fecha: true },
        });

        const evaluacion = await icve.procesarRegistro({
            estudianteId,
            icve: puntaje,
            componentes,
            nivelRiesgo: analisis.nivel_riesgo,
            checkInId: registro.id,
        });

        // Ante riesgo explícito, el mensaje de cierre no lo escribe el modelo:
        // es texto fijo con los contactos que la institución mantiene.
        let contencion = null;
        if (analisis.nivel_riesgo >= 3) {
            contencion = seguridad.mensajeDeContencion({
                servicios: await serviciosDeCrisis(estudianteId),
            });
        }

        res.status(201).json({
            id: registro.id,
            fecha: registro.fecha,
            icve: puntaje,
            delta: evaluacion.delta,
            linea_base: evaluacion.lineaBase,
            coach: analisis.coach,
            factores: analisis.factores,
            explicacion: analisis.explicacion,
            sentimiento: analisis.sentimiento,
            confianza: analisis.confianza,
            // El estudiante ve que una persona lo va a leer; no ve el nivel de
            // riesgo crudo ni la nota del orientador.
            acompanamiento: analisis.necesita_persona,
            contencion,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Promedio prosódico del estudiante a partir de sus últimas notas de voz.
 *
 * Se limita a 10 registros: el interés es cómo viene hablando últimamente, no
 * cómo hablaba hace medio año. Una voz cambia sola a esa edad.
 */
async function promedioDeVoz(estudianteId) {
    const registros = await prisma.checkIn.findMany({
        where: { estudianteId },
        orderBy: { fecha: 'desc' },
        take: 10,
        select: { respuestas: true },
    });

    return vozService.promedioPropio(registros);
}

/**
 * Contactos de crisis del municipio del estudiante, con los nacionales como
 * respaldo. Salen del catálogo que mantiene la institución: un teléfono
 * escrito a mano en el código es peor que ninguno.
 */
async function serviciosDeCrisis(estudianteId) {
    const usuario = await prisma.usuario.findUnique({
        where: { id: estudianteId },
        select: { institucion: { select: { municipioId: true } } },
    });

    return prisma.servicioExterno.findMany({
        where: {
            activo: true,
            tipo: { in: ['LINEA_CRISIS', 'SALUD_MENTAL'] },
            OR: [{ municipioId: usuario?.institucion?.municipioId ?? -1 }, { municipioId: null }],
        },
        select: { nombre: true, telefono: true },
        take: 3,
    });
}

module.exports = { listar, crear };
