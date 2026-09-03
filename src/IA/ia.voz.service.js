const prompts = require('./ia.prompt');
const { pedirJson, hayIA } = require('./ia.service');

// ---------------------------------------------------------------------------
// Análisis de voz (opcional, con consentimiento explícito)
//
// El backend recibe características prosódicas ya extraídas en el cliente —
// duración, pausas, variación de tono, velocidad del habla — y nunca el audio
// ni una transcripción. Es una decisión de privacidad, no una limitación
// técnica: la grabación de un menor hablando de cómo está no tiene por qué
// salir de su teléfono para que el sistema note que habla más lento que ayer.
//
// Y una advertencia que va en el prompt y también acá: la prosodia es una señal
// débil. Un resfrío produce los mismos números que el cansancio. Por eso el
// resultado nunca sube el ICVE por sí solo — solo puede añadir un factor
// explicativo que un humano lee junto con el resto.
// ---------------------------------------------------------------------------

// Rangos de referencia para adolescentes hablando de forma espontánea. Son un
// punto de partida grueso: lo que de verdad importa es la comparación contra el
// propio historial del estudiante, no contra estas constantes.
const REFERENCIA = {
    palabrasPorMinuto: { min: 110, max: 190 },
    proporcionPausas: { min: 0.08, max: 0.30 },
    variacionTono: { min: 15, max: 60 },
};

/**
 * Compara las características contra el rango de referencia y, si existe, contra
 * el promedio propio del estudiante. Es aritmética, no IA: si el modelo no está
 * disponible esto sigue funcionando.
 */
function compararConReferencia(caracteristicas, propioPromedio = null) {
    const desviaciones = [];

    for (const [clave, rango] of Object.entries(REFERENCIA)) {
        const valor = caracteristicas[clave];
        if (typeof valor !== 'number') continue;

        if (valor < rango.min) desviaciones.push({ clave, sentido: 'bajo', valor });
        else if (valor > rango.max) desviaciones.push({ clave, sentido: 'alto', valor });

        // La comparación ipsativa pesa más que la normativa: que hable más lento
        // que el promedio de su edad dice poco; que hable más lento que él mismo
        // la semana pasada dice bastante más.
        const propio = propioPromedio?.[clave];
        if (typeof propio === 'number' && propio > 0) {
            const cambio = (valor - propio) / propio;
            if (Math.abs(cambio) >= 0.25) {
                desviaciones.push({
                    clave,
                    sentido: cambio > 0 ? 'sobre su propio promedio' : 'bajo su propio promedio',
                    valor,
                    cambio: Math.round(cambio * 100),
                });
            }
        }
    }

    return desviaciones;
}

/**
 * Analiza características prosódicas. `consentimiento` no tiene valor por
 * defecto a propósito: quien llame tiene que pasarlo explícitamente.
 */
async function analizarVoz({ caracteristicas, propioPromedio = null, consentimiento }) {
    if (consentimiento !== true) {
        const error = new Error('El análisis de voz requiere consentimiento explícito');
        error.status = 403;
        throw error;
    }

    const desviaciones = compararConReferencia(caracteristicas, propioPromedio);

    if (!hayIA()) {
        return {
            observaciones: desviaciones.length
                ? desviaciones.map((d) => `${d.clave}: ${d.sentido} (${d.valor})`)
                : ['Las características están dentro de lo esperable.'],
            señal: desviaciones.length >= 2 ? 'leve' : 'sin_señal',
            advertencia: 'Comparación numérica sin análisis de lenguaje. La voz por sí sola no indica un estado emocional.',
            generado: false,
        };
    }

    const contexto = [
        'Características prosódicas de esta nota de voz:',
        ...Object.entries(caracteristicas).map(([k, v]) => `- ${k}: ${v}`),
        '',
        desviaciones.length
            ? `Desviaciones detectadas: ${desviaciones.map((d) => `${d.clave} ${d.sentido}`).join(', ')}.`
            : 'No hay desviaciones respecto a los rangos de referencia.',
    ].join('\n');

    try {
        const analisis = await pedirJson({
            sistema: prompts.SISTEMA_VOZ,
            usuario: contexto,
            esquema: prompts.ESQUEMA_VOZ,
            maxTokens: 700,
            esfuerzo: 'low',
        });
        return { ...analisis, generado: true };
    } catch (error) {
        console.error('[IA] análisis de voz:', error.message);
        return {
            observaciones: ['El análisis de voz no estuvo disponible en este registro.'],
            señal: 'sin_señal',
            advertencia: 'No se pudo completar el análisis.',
            generado: false,
        };
    }
}

module.exports = { REFERENCIA, compararConReferencia, analizarVoz };
