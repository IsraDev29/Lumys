// ---------------------------------------------------------------------------
// Proveedor Ollama — modelo local, sin red
//
// Es el proveedor que hace posible el offline-first: corre en la misma máquina
// que el backend, así que un centro educativo con internet intermitente sigue
// teniendo check-in conversacional.
//
// Todo en este archivo está escrito contra una restricción concreta: la máquina
// de referencia no tiene GPU. En CPU el costo se reparte entre procesar el
// prompt (una vez, proporcional a su largo) y generar la respuesta (por token).
// Las dos palancas están abajo, y ninguna es opcional:
//
//   - num_predict acota la generación. Es la palanca más grande: un turno de
//     check-in son ~60 tokens de salida, y sin tope el modelo escribe 500.
//   - num_ctx acota el contexto. Reservar 8192 tokens de caché KV que nunca se
//     usan cuesta RAM y tiempo de arranque en una máquina con 4 GB libres.
//   - keep_alive evita la recarga. Sin esto Ollama descarga el modelo a los 5
//     minutos y el siguiente estudiante paga varios segundos de carga desde
//     disco antes de que empiece a generar.
//   - El timeout es lo que convierte "lento" en "degradado". Si el modelo no
//     respondió a tiempo, el check-in sigue con el banco local: un estudiante
//     mirando una pantalla congelada es peor que una pregunta menos ingeniosa.
// ---------------------------------------------------------------------------

const BASE = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const MODELO = process.env.OLLAMA_MODELO || 'gemma3:1b';

// Mantener el modelo residente entre check-ins. En horario de clase los
// registros llegan en ráfagas, así que la primera petición paga la carga y las
// siguientes no.
const KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE || '30m';

// Presupuesto de tiempo por tipo de llamada. El turno se responde con el
// estudiante esperando; el análisis corre después de que el check-in ya se
// guardó, así que puede tomarse más.
const TIMEOUT_TURNO = Number(process.env.OLLAMA_TIMEOUT_MS || 8000);
const TIMEOUT_ANALISIS = Number(process.env.OLLAMA_TIMEOUT_ANALISIS_MS || 25000);

const NUM_CTX = Number(process.env.OLLAMA_NUM_CTX || 2048);

const nombre = 'ollama';

/**
 * Detección de disponibilidad con memoria corta.
 *
 * Se cachea el resultado porque esto se consulta en cada llamada y no tiene
 * sentido hacer un round-trip HTTP extra por turno. Pero se cachea POCO: si el
 * daemon se cae a media jornada queremos notarlo dentro del minuto, no seguir
 * mandando peticiones a un puerto muerto durante horas.
 */
let cacheDisponible = { valor: null, hasta: 0, modelos: [] };

async function disponible() {
    if (Date.now() < cacheDisponible.hasta) return cacheDisponible.valor;

    try {
        const respuesta = await fetch(`${BASE}/api/tags`, {
            signal: AbortSignal.timeout(1500),
        });
        if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);

        const { models = [] } = await respuesta.json();
        const modelos = models.map((m) => m.name);

        // Que el daemon responda no basta: si el modelo configurado no está
        // descargado, la primera petición real fallaría con un 404 confuso.
        // Ollama nombra los modelos con etiqueta ("gemma3:1b"), y aceptamos
        // tanto el nombre exacto como el mismo modelo con otra etiqueta.
        const base = MODELO.split(':')[0];
        const tiene = modelos.some((m) => m === MODELO || m.split(':')[0] === base);

        cacheDisponible = {
            valor: tiene,
            hasta: Date.now() + (tiene ? 60000 : 15000),
            modelos,
        };

        if (!tiene && modelos.length) {
            console.warn(
                `[IA] Ollama responde pero no tiene "${MODELO}". Disponibles: ${modelos.join(', ') || 'ninguno'}. ` +
                `Descargalo con: ollama pull ${MODELO}`,
            );
        }

        return tiene;
    } catch (error) {
        cacheDisponible = { valor: false, hasta: Date.now() + 15000, modelos: [] };
        return false;
    }
}

/**
 * Pide JSON estructurado al modelo local.
 *
 * `esquema` se pasa como `format`: Ollama lo compila a una gramática que
 * restringe la generación token a token, así que el modelo no *puede* devolver
 * otra forma. Es lo que hace viable usar un modelo de 1B para esto — sin la
 * gramática, un modelo chico se sale del JSON una de cada tres veces.
 */
async function generar({ sistema, usuario, esquema, maxTokens = 256, esfuerzo = 'low' }) {
    const timeout = esfuerzo === 'high' ? TIMEOUT_ANALISIS : TIMEOUT_TURNO;
    const arrancado = Date.now();

    const respuesta = await fetch(`${BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(timeout),
        body: JSON.stringify({
            model: MODELO,
            // Sin stream: necesitamos el JSON completo para parsearlo, y
            // transmitir un objeto a medias no le sirve a nadie.
            stream: false,
            format: esquema,
            keep_alive: KEEP_ALIVE,
            messages: [
                { role: 'system', content: sistema },
                { role: 'user', content: usuario },
            ],
            options: {
                num_predict: maxTokens,
                num_ctx: NUM_CTX,
                // Temperatura baja: no queremos creatividad en la forma, la
                // variedad de las preguntas ya la da la rotación de ángulos del
                // prompt. Además reduce los reintentos por JSON inválido.
                temperature: esfuerzo === 'high' ? 0.3 : 0.7,
                top_k: 40,
                top_p: 0.9,
                // Sin penalización de repetición: con salida estructurada corta
                // solo consigue que el modelo evite las llaves y las comillas
                // que el JSON necesita.
                repeat_penalty: 1.0,
            },
        }),
    });

    if (!respuesta.ok) {
        const cuerpo = await respuesta.text().catch(() => '');
        throw new Error(`Ollama HTTP ${respuesta.status}: ${cuerpo.slice(0, 200)}`);
    }

    const datos = await respuesta.json();
    const texto = datos.message?.content;

    if (!texto) throw new Error('Ollama devolvió una respuesta sin contenido');

    // Se registra la latencia real para poder decidir con datos si el modelo
    // configurado sirve en esta máquina. `eval_count` son los tokens generados:
    // con los dos números se saca tokens/s sin instrumentar nada más.
    const ms = Date.now() - arrancado;
    if (process.env.IA_TRAZA === '1') {
        const tokens = datos.eval_count || 0;
        const carga = Math.round((datos.load_duration || 0) / 1e6);
        console.log(
            `[IA] ollama ${MODELO} ${esfuerzo}: ${ms}ms · ${tokens} tokens · ` +
            `${(tokens / (ms / 1000)).toFixed(1)} tok/s · carga ${carga}ms`,
        );
    }

    try {
        return JSON.parse(texto);
    } catch (error) {
        // Con `format` esto no debería pasar, pero un modelo chico que agota
        // num_predict devuelve JSON truncado. El mensaje incluye el texto para
        // que se vea si fue truncamiento o basura.
        throw new Error(`Ollama devolvió JSON inválido: ${texto.slice(0, 200)}`);
    }
}

/**
 * Carga el modelo en RAM sin generar nada.
 *
 * Se llama al arrancar el servidor. El primer check-in del día es el que peor
 * latencia tendría — el modelo se lee de disco — y ese costo se paga mejor
 * mientras nadie está esperando.
 */
async function precalentar() {
    if (!(await disponible())) return false;

    try {
        await fetch(`${BASE}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(120000),
            // Sin mensajes, Ollama solo carga el modelo y devuelve.
            body: JSON.stringify({ model: MODELO, messages: [], keep_alive: KEEP_ALIVE }),
        });
        console.log(`[IA] modelo ${MODELO} precargado en Ollama`);
        return true;
    } catch (error) {
        console.warn(`[IA] no se pudo precalentar ${MODELO}: ${error.message}`);
        return false;
    }
}

module.exports = { nombre, MODELO, BASE, disponible, generar, precalentar };
