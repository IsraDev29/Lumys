const Anthropic = require('@anthropic-ai/sdk');

// ---------------------------------------------------------------------------
// Proveedor Anthropic — modelo remoto
//
// Es el proveedor de mayor calidad y el que se usa cuando hay internet y saldo.
// Su papel natural en Lumys es el análisis del check-in cerrado, que es donde la
// diferencia de capacidad se nota: detectar riesgo en un texto ambiguo de un
// adolescente no es lo mismo que elegir la próxima pregunta.
//
// El módulo se carga siempre, con o sin clave. Sin `ANTHROPIC_API_KEY`,
// `disponible()` devuelve false y el selector pasa al siguiente proveedor.
// ---------------------------------------------------------------------------

const MODELO = process.env.IA_MODELO || 'claude-opus-4-8';

const nombre = 'anthropic';

let cliente = null;

function obtenerCliente() {
    if (cliente) return cliente;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;

    cliente = new Anthropic({ apiKey, maxRetries: 2 });
    return cliente;
}

// La clave se comprueba en cada llamada y no se cachea: es una lectura de
// process.env, no cuesta nada, y permite que los tests la cambien en caliente.
async function disponible() {
    return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * `esfuerzo` es la palanca de latencia. Un turno de conversación se responde con
 * el estudiante mirando la pantalla, así que va en 'low'; el análisis corre
 * después de guardar y alimenta la detección de riesgo, así que va en 'high'.
 * Es la misma inteligencia, distinta profundidad.
 */
async function generar({ sistema, usuario, esquema, maxTokens = 1024, esfuerzo = 'low' }) {
    const api = obtenerCliente();
    if (!api) throw new Error('Anthropic sin API key');

    const respuesta = await api.messages.create({
        model: MODELO,
        max_tokens: maxTokens,
        // El bloque `sistema` es idéntico en todas las llamadas del mismo tipo,
        // así que se marca para caché. Ojo: en Opus el prefijo mínimo cacheable
        // son 4096 tokens — por debajo de eso la marca no rompe nada pero
        // tampoco ahorra. Con la persona del check-in crecida sí paga.
        system: [{ type: 'text', text: sistema, cache_control: { type: 'ephemeral' } }],
        thinking: { type: 'adaptive' },
        output_config: {
            effort: esfuerzo,
            format: { type: 'json_schema', schema: esquema },
        },
        messages: [{ role: 'user', content: usuario }],
    });

    // Una negativa del clasificador llega como HTTP 200 con content vacío. Sin
    // esta guarda, el .find() de abajo devuelve undefined y el error real
    // ("no se puede leer .text") no dice nada de lo que pasó.
    if (respuesta.stop_reason === 'refusal') {
        const error = new Error('El modelo declinó responder');
        error.codigo = 'REFUSAL';
        error.detalle = respuesta.stop_details || null;
        throw error;
    }

    const bloque = respuesta.content.find((b) => b.type === 'text');
    if (!bloque) throw new Error('Respuesta del modelo sin texto');

    return JSON.parse(bloque.text);
}

async function precalentar() {
    return false; // Un proveedor remoto no tiene nada que precargar.
}

module.exports = { nombre, MODELO, disponible, generar, precalentar };
