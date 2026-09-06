const ollama = require('./ollama');
const anthropic = require('./anthropic');

// ---------------------------------------------------------------------------
// Selección y degradación entre proveedores
//
// Lumys tiene que funcionar en un aula de Nicaragua con internet que va y
// viene. Eso obliga a dos cosas: que haya un modelo local, y que la caída de
// cualquiera de los dos no se note más allá de una respuesta menos afinada.
//
// El orden no es fijo, depende de qué se esté pidiendo:
//
//   - Un TURNO del check-in se responde con el estudiante mirando la pantalla.
//     Manda la latencia, y el modelo local siempre le gana a un round-trip a
//     internet. Va primero Ollama.
//   - El ANÁLISIS corre después de que el check-in ya se guardó, y de él sale la
//     clasificación de riesgo. Ahí manda la calidad: distinguir "estoy cansado"
//     de "ya no aguanto" en el texto de un adolescente es justo lo que un modelo
//     de 1B hace peor. Va primero Anthropic.
//
// Debajo de todo está siempre el respaldo determinista de ia.service.js, que no
// es un proveedor: es aritmética y bancos de preguntas locales. Que los dos
// proveedores fallen degrada la experiencia, nunca pierde un check-in.
// ---------------------------------------------------------------------------

// 'auto' aplica la política de arriba. Los demás valores fuerzan un proveedor,
// que es lo que se quiere en pruebas y al medir latencia de uno solo.
const ESTRATEGIA = process.env.IA_PROVEEDOR || 'auto';

const REGISTRO = { ollama, anthropic };

// Qué dialecto de prompt entiende cada proveedor. No es una etiqueta cosmética:
// la persona completa del check-in son más de mil tokens de reglas en prosa, y
// un modelo de 1B ni las sigue ni las procesa gratis. Ver ia.prompt.js.
const PERFIL = { ollama: 'compacto', anthropic: 'completo' };

function ordenPara(esfuerzo) {
    if (ESTRATEGIA === 'ninguno') return [];
    if (REGISTRO[ESTRATEGIA]) return [REGISTRO[ESTRATEGIA]];

    return esfuerzo === 'high' ? [anthropic, ollama] : [ollama, anthropic];
}

/**
 * Ejecuta la primera opción disponible y, si falla, sigue con la siguiente.
 *
 * `construir` recibe el perfil del proveedor que se va a usar y devuelve
 * `{ sistema, usuario, esquema, maxTokens }`. Se llama por proveedor y no una
 * sola vez arriba porque el prompt cambia según a quién se le hable: si
 * cayéramos de Ollama a Anthropic con el prompt compacto, estaríamos pagando
 * el modelo bueno para darle instrucciones recortadas.
 */
async function generar({ construir, esfuerzo = 'low' }) {
    const candidatos = ordenPara(esfuerzo);
    const fallos = [];

    for (const proveedor of candidatos) {
        if (!(await proveedor.disponible())) {
            fallos.push(`${proveedor.nombre}: no disponible`);
            continue;
        }

        try {
            const peticion = construir(PERFIL[proveedor.nombre]);
            const datos = await proveedor.generar({ ...peticion, esfuerzo });
            return { datos, proveedor: proveedor.nombre, modelo: proveedor.MODELO };
        } catch (error) {
            // Se sigue al siguiente proveedor en vez de propagar: que Ollama
            // devuelva JSON truncado no es razón para dejar sin análisis un
            // check-in si hay una API remota con saldo esperando.
            console.error(`[IA] ${proveedor.nombre} falló: ${error.message}`);
            fallos.push(`${proveedor.nombre}: ${error.message}`);
        }
    }

    const error = new Error(`Ningún proveedor de IA respondió (${fallos.join(' | ') || 'ninguno configurado'})`);
    error.codigo = 'SIN_PROVEEDOR';
    throw error;
}

/** Si al menos un proveedor puede atender. Lo consulta GET /ia/estado. */
async function hayAlguno() {
    for (const proveedor of Object.values(REGISTRO)) {
        if (await proveedor.disponible()) return true;
    }
    return false;
}

/** Estado por proveedor, para el endpoint de diagnóstico y para el arranque. */
async function estado() {
    const detalle = {};

    for (const [clave, proveedor] of Object.entries(REGISTRO)) {
        detalle[clave] = {
            disponible: await proveedor.disponible(),
            modelo: proveedor.MODELO,
            perfil: PERFIL[clave],
        };
    }

    return { estrategia: ESTRATEGIA, proveedores: detalle };
}

/**
 * Precarga los modelos locales. Se llama una vez al arrancar el servidor y no se
 * espera su resultado: el backend tiene que aceptar peticiones mientras el
 * modelo se lee de disco, no después.
 */
async function precalentar() {
    for (const proveedor of ordenPara('low')) {
        await proveedor.precalentar();
    }
}

module.exports = { ESTRATEGIA, PERFIL, generar, hayAlguno, estado, precalentar, REGISTRO };
