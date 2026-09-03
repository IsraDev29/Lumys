const Anthropic = require('@anthropic-ai/sdk');
const prompts = require('./ia.prompt');
const seguridad = require('./ia.seguridad');

// ---------------------------------------------------------------------------
// Cliente de Claude
//
// El módulo tiene que poder cargarse sin API key: el resto del backend (auth,
// usuarios, historial) no debería caerse porque falte una variable de entorno
// del módulo de IA. Sin clave, `hayIA()` devuelve false y cada función usa su
// respaldo local.
// ---------------------------------------------------------------------------

const MODELO = process.env.IA_MODELO || 'claude-opus-4-8';

let cliente = null;

function obtenerCliente() {
    if (cliente) return cliente;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;

    cliente = new Anthropic({ apiKey, maxRetries: 2 });
    return cliente;
}

function hayIA() {
    return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Una sola puerta hacia la API. Centraliza tres cosas que si no quedan
 * repetidas en cada llamada: el esfuerzo del modelo, las salidas
 * estructuradas y el marcado de caché del prompt estable.
 *
 * `esfuerzo` es la palanca principal de latencia. Un turno de conversación se
 * responde con el estudiante mirando la pantalla, así que va en 'low'; el
 * análisis corre después de guardar y alimenta la detección de riesgo, así que
 * va en 'high'. Es la misma inteligencia, distinta profundidad.
 */
async function pedirJson({ sistema, usuario, esquema, maxTokens = 1024, esfuerzo = 'low' }) {
    const api = obtenerCliente();
    if (!api) throw new Error('IA no configurada');

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

// ---------------------------------------------------------------------------
// Turno del check-in conversacional
// ---------------------------------------------------------------------------

function momentoDelDia(fecha = new Date()) {
    const hora = fecha.getHours();
    if (hora < 12) return 'por la mañana';
    if (hora < 19) return 'por la tarde';
    return 'de noche';
}

/**
 * Genera el siguiente intercambio del check-in.
 *
 * Recibe la sesión completa en cada llamada porque el backend no guarda estado
 * conversacional: el check-in vive en el cliente hasta que se cierra. Eso hace
 * que refrescar la página no deje un check-in a medias colgado en la base, y
 * que el endpoint sea idempotente por turno.
 */
async function siguienteTurno({ nombre, racha = 0, memoria = [], sesion = [] }) {
    // El ángulo rota por número de turno para que dos preguntas seguidas no se
    // parezcan aunque el modelo tienda a su forma preferida.
    const angulo = prompts.ANGULOS[sesion.length % prompts.ANGULOS.length];

    const contexto = prompts.contextoDeTurno({
        nombre,
        momento: momentoDelDia(),
        racha,
        memoria,
        sesion,
        angulo,
    });

    try {
        const turno = await pedirJson({
            sistema: prompts.PERSONA_CHECKIN,
            usuario: contexto,
            esquema: prompts.ESQUEMA_TURNO,
            maxTokens: 900,
            esfuerzo: 'low',
        });

        return { ...normalizarTurno(turno, sesion), generado: true };
    } catch (error) {
        console.error('[IA] turno de check-in:', error.message);
        return { ...turnoDeRespaldo(sesion), generado: false };
    }
}

/**
 * El modelo puede devolver formas válidas contra el esquema pero incómodas para
 * la interfaz: cero opciones en formato "opciones", seis botones, un componente
 * que ya se cubrió. Se corrige acá y no en el frontend, para que cualquier
 * cliente que consuma la API reciba lo mismo.
 */
function normalizarTurno(turno, sesion) {
    const opciones = (turno.opciones || []).slice(0, 4);

    let formato = turno.formato;
    if (formato === 'opciones' && opciones.length < 2) formato = 'escala';

    // Tope duro de longitud: sin él, un turno largo se sale del hilo de chat en
    // pantallas de teléfono, que es donde se usa esto.
    const recortar = (texto, max) => {
        const limpio = String(texto || '').trim();
        return limpio.length > max ? `${limpio.slice(0, max - 1).trimEnd()}…` : limpio;
    };

    return {
        reaccion: sesion.length === 0 ? '' : recortar(turno.reaccion, 140),
        pregunta: recortar(turno.pregunta, 180),
        componente: turno.componente,
        formato,
        opciones: formato === 'opciones' ? opciones : [],
        // Nunca dejamos que el modelo alargue la sesión más allá de 6: en
        // pruebas tiende a querer un turno más "para estar seguro", y el costo
        // de eso lo paga la constancia del estudiante.
        cierre: Boolean(turno.cierre) || sesion.length >= 5,
        motivo: turno.motivo || '',
    };
}

/**
 * Respaldo sin IA. No es el formulario viejo: son bancos por componente de los
 * que se elige al azar, así que aun caída la API dos días seguidos no traen la
 * misma pregunta. Es peor que el modelo, pero no se siente un trámite.
 */
const BANCO = {
    animo: [
        { pregunta: '¿Qué fue lo último que te hizo reír, aunque haya sido una tontera?', opciones: [
            { emoji: '😄', etiqueta: 'Algo bueno', valor: 5 },
            { emoji: '🙃', etiqueta: 'Nada hoy', valor: 2 },
            { emoji: '🤔', etiqueta: 'No me acuerdo', valor: 3 },
        ] },
        { pregunta: 'Si ayer hubiera sido una canción, ¿iba rápida o lenta?', opciones: [
            { emoji: '⚡', etiqueta: 'Rápida', valor: 4 },
            { emoji: '🎧', etiqueta: 'Tranquila', valor: 4 },
            { emoji: '🐢', etiqueta: 'Lenta', valor: 2 },
        ] },
        { pregunta: '¿Cómo venís hoy comparado con el resto de tu semana?', opciones: [
            { emoji: '🙂', etiqueta: 'Mejor', valor: 5 },
            { emoji: '😐', etiqueta: 'Igual', valor: 3 },
            { emoji: '😮‍💨', etiqueta: 'Más pesado', valor: 2 },
        ] },
    ],
    sueno: [
        { pregunta: '¿Anoche te dormiste de una o le diste vueltas al asunto?', opciones: [
            { emoji: '😴', etiqueta: 'De una', valor: 5 },
            { emoji: '🌙', etiqueta: 'Me costó', valor: 3 },
            { emoji: '👀', etiqueta: 'Casi nada', valor: 1 },
        ] },
        { pregunta: 'Cuando sonó la alarma hoy, ¿te levantaste o le diste posponer?', opciones: [
            { emoji: '☀️', etiqueta: 'Me levanté', valor: 5 },
            { emoji: '⏰', etiqueta: 'Un ratito más', valor: 3 },
            { emoji: '🛏️', etiqueta: 'No quería', valor: 2 },
        ] },
    ],
    energia: [
        { pregunta: 'Del 1 al 5, ¿cuánta batería traés hoy comparado con tu semana normal?', formato: 'escala' },
        { pregunta: '¿Hiciste algo ayer que te haya costado más que de costumbre?', opciones: [
            { emoji: '🙌', etiqueta: 'Todo normal', valor: 5 },
            { emoji: '😮‍💨', etiqueta: 'Un poco', valor: 3 },
            { emoji: '🥵', etiqueta: 'Bastante', valor: 1 },
        ] },
    ],
    vinculo: [
        { pregunta: '¿Con quién hablaste ayer que no fuera por obligación?', opciones: [
            { emoji: '👥', etiqueta: 'Con varios', valor: 5 },
            { emoji: '🙋', etiqueta: 'Con uno', valor: 4 },
            { emoji: '🎧', etiqueta: 'Con nadie', valor: 2 },
        ] },
        { pregunta: 'En el recreo de ayer, ¿andabas acompañado o en lo tuyo?', opciones: [
            { emoji: '👥', etiqueta: 'Acompañado', valor: 5 },
            { emoji: '🔀', etiqueta: 'Un poco de cada', valor: 4 },
            { emoji: '🎧', etiqueta: 'En lo mío', valor: 2 },
        ] },
    ],
    concentracion: [
        { pregunta: 'En clase ayer, ¿se te fue la cabeza a otro lado?', opciones: [
            { emoji: '🎯', etiqueta: 'Estuve atento', valor: 5 },
            { emoji: '🌫️', etiqueta: 'A ratos', valor: 3 },
            { emoji: '🛰️', etiqueta: 'Todo el rato', valor: 1 },
        ] },
        { pregunta: 'Del 1 al 5, ¿qué tanto lograste enfocarte hoy comparado con tu normal?', formato: 'escala' },
    ],
    libre: [
        { pregunta: '¿Querés contarme algo más? Escribí lo que sea — o saltá esta parte.', formato: 'texto' },
    ],
};

const REACCIONES = [
    'Anotado.',
    'Vale, gracias por decirlo.',
    'Listo, lo guardo.',
    'Está bien que sea así.',
    'Ok, me sirve saberlo.',
];

function turnoDeRespaldo(sesion) {
    const cubiertos = sesion.map((t) => t.componente);
    const pendientes = prompts.COMPONENTES.filter((c) => !cubiertos.includes(c));

    const componente = pendientes.length ? pendientes[0] : 'libre';
    const banco = BANCO[componente];
    const elegido = banco[Math.floor(Math.random() * banco.length)];

    return {
        reaccion: sesion.length === 0 ? '' : REACCIONES[Math.floor(Math.random() * REACCIONES.length)],
        pregunta: elegido.pregunta,
        componente,
        formato: elegido.formato || 'opciones',
        opciones: elegido.opciones || [],
        cierre: componente === 'libre',
        motivo: 'respaldo local: la IA no estaba disponible',
    };
}

// ---------------------------------------------------------------------------
// Análisis del check-in cerrado
// ---------------------------------------------------------------------------

/**
 * Devuelve sentimiento, factores explicativos, mensaje de coach y nivel de
 * lenguaje de riesgo.
 *
 * El nivel de riesgo que sale de acá ya viene combinado con el léxico
 * determinista: el modelo puede subirlo, nunca bajarlo. Ver ia.seguridad.js.
 */
async function analizarCheckin({ turnos, textoLibre, icve, lineaBase, delta }) {
    const porLexico = seguridad.evaluarTexto(
        [textoLibre, ...turnos.map((t) => t.respuesta)].filter(Boolean).join(' \n '),
    );

    const contexto = prompts.contextoDeAnalisis({ turnos, textoLibre, icve, lineaBase, delta });

    let analisis;
    try {
        analisis = await pedirJson({
            sistema: prompts.SISTEMA_ANALISIS,
            usuario: contexto,
            esquema: prompts.ESQUEMA_ANALISIS,
            maxTokens: 1600,
            esfuerzo: 'high',
        });
    } catch (error) {
        console.error('[IA] análisis de check-in:', error.message);
        analisis = analisisDeRespaldo({ icve, delta, porLexico });
    }

    const riesgo = seguridad.combinar(porLexico.etiqueta, analisis.lenguaje_riesgo);

    return {
        ...analisis,
        lenguaje_riesgo: riesgo.etiqueta,
        nivel_riesgo: riesgo.nivel,
        // Se guarda de dónde salió cada mitad del veredicto: sin esto, revisar
        // una alerta después es adivinar si la disparó el léxico o el modelo.
        deteccion: {
            lexico: porLexico.etiqueta,
            coincidencias: porLexico.coincidencias,
            modelo: analisis.lenguaje_riesgo,
        },
        // Si el léxico detectó algo que el modelo no vio, la revisión humana no
        // es opcional aunque el modelo haya dicho que no hace falta.
        necesita_persona: Boolean(analisis.necesita_persona) || riesgo.nivel >= 2,
    };
}

/**
 * Respaldo del análisis: aritmética pura sobre el ICVE. Sin matices, pero el
 * check-in queda guardado con un puntaje y un mensaje coherente en vez de
 * perderse porque la API no respondió.
 */
function analisisDeRespaldo({ icve, delta, porLexico }) {
    const subio = delta !== null && delta >= 12;

    return {
        sentimiento: icve >= 60 ? 'negativo' : icve >= 40 ? 'neutro' : 'positivo',
        confianza: 0.3,
        factores: [
            {
                factor: subio ? 'Cambio respecto a su propio promedio' : 'Registro dentro de lo habitual',
                evidencia: 'Calculado a partir de las respuestas del check-in, sin análisis de texto.',
                direccion: subio ? 'tensiona' : 'protege',
            },
        ],
        explicacion: 'Lectura provisional: el análisis de texto no estuvo disponible en este registro.',
        coach: 'Gracias por aparecer hoy. Queda guardado.',
        nota_orientador: 'Registro guardado sin análisis de texto. Revisar cuando el módulo de IA vuelva.',
        lenguaje_riesgo: porLexico.etiqueta,
        necesita_persona: porLexico.nivel >= 2,
    };
}

// ---------------------------------------------------------------------------
// Análisis de texto suelto (endpoint independiente del check-in)
// ---------------------------------------------------------------------------

async function analizarTexto(texto) {
    return analizarCheckin({
        turnos: [],
        textoLibre: texto,
        icve: 50,
        lineaBase: null,
        delta: null,
    });
}

module.exports = {
    MODELO,
    hayIA,
    pedirJson,
    siguienteTurno,
    analizarCheckin,
    analizarTexto,
};
