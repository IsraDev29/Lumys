const prisma = require('../db');
const { alcanceDeEstudiantes } = require('../middlewares/permisos.middlewares');

const CAMPOS_PUBLICOS = {
    id: true,
    nombre: true,
    email: true,
    rol: true,
    perfil: true,
    institucionId: true,
    activo: true,
    creadoEn: true,
};

function listarUsuarios() {
    return prisma.usuario.findMany({
        select: CAMPOS_PUBLICOS,
        orderBy: {id: 'asc'},
    });
}

/**
 * Lista de estudiantes ya acotada a lo que este usuario puede ver. El filtro
 * se aplica en la consulta, no después de traer los datos.
 */
async function listarEstudiantesVisibles(solicitante) {
    const alcance = await alcanceDeEstudiantes(solicitante);

    return prisma.usuario.findMany({
        where: {AND: [{perfil: 'ESTUDIANTE'}, alcance]},
        select: CAMPOS_PUBLICOS,
        orderBy: {id: 'asc'},
    });
}

// ---------------------------------------------------------------------------
// Historial de un estudiante, visto por quien lo acompaña
//
// Esta consulta devolvía `textoLibre` y el objeto `respuestas` entero. Dentro
// de `respuestas` viajan los `turnos`, con la respuesta literal de cada uno
// (hasta 2000 caracteres, ver ia.schema.js). Es decir: el orientador recibía en
// el JSON exactamente lo que la app le promete al estudiante que nadie va a
// leer — en el check-in, en el cierre y en el consentimiento del registro.
//
// La interfaz no lo pintaba, y por eso no se notaba. Pero no pintarlo no es
// protegerlo: el dato viajaba igual y se ve abriendo la pestaña de red del
// navegador. La misma regla ya está escrita y cumplida en alerta.service.js;
// acá faltaba aplicarla.
//
// Lo que SÍ sale, porque es lo que permite acompañar y lo que alimenta el
// análisis de patrones:
//
//   · el puntaje y su fecha            → la serie temporal
//   · los componentes                  → qué se movió (números, no frases)
//   · la paráfrasis del análisis       → qué cambió, dicho sin citar
//   · los factores y el sentimiento    → por qué el sistema lo leyó así
//   · las métricas de voz              → seis números, nunca audio
//
// Lo que NO sale nunca: `textoLibre` y `respuestas.turnos`.
// ---------------------------------------------------------------------------

/** Deja pasar solo lo derivado. Es la frontera entre "material del modelo" y
 *  "material que una persona puede leer". */
function proyectarParaAcompanamiento(registro) {
    const analisis = registro.respuestas?.analisis || {};
    const voz = registro.respuestas?.voz || null;

    return {
        id: registro.id,
        fecha: registro.fecha,
        icve: registro.puntajeIcve,
        componentes: registro.respuestas?.componentes || null,
        cobertura: registro.respuestas?.cobertura ?? null,
        nota: analisis.nota_orientador || null,
        factores: (analisis.factores || []).map((f) => ({
            factor: f.factor,
            direccion: f.direccion,
        })),
        sentimiento: analisis.sentimiento || null,
        confianza: analisis.confianza ?? null,
        necesita_persona: analisis.necesita_persona ?? null,
        // Del análisis de voz salen los indicadores, no las características
        // crudas: esas son insumo del promedio propio del estudiante y no le
        // dicen nada útil a quien acompaña.
        voz: voz ? { indicadores: voz.indicadores ?? null, nota: voz.nota ?? null } : null,
        // Se informa que hubo texto y cuánto, sin decir qué. Que el orientador
        // sepa que el estudiante se tomó el trabajo de escribir es relevante;
        // leerlo, no.
        escribio: Boolean(registro.textoLibre),
        largoTexto: registro.textoLibre ? registro.textoLibre.length : 0,
    };
}

async function listarCheckinsDeEstudiante(estudianteId) {
    const registros = await prisma.checkIn.findMany({
        where: {estudianteId},
        orderBy: {fecha: 'desc'},
        take: 60,
        select: {id: true, fecha: true, respuestas: true, textoLibre: true, puntajeIcve: true},
    });

    return registros.map(proyectarParaAcompanamiento);
}

function cambiarRol(id, {rol, perfil}) {
    return prisma.usuario.update({
        where: {id},
        data: {rol, ...(perfil !== undefined && {perfil})},
        select: CAMPOS_PUBLICOS,
    });
}

function cambiarEstado(id, activo) {
    return prisma.usuario.update({
        where: {id},
        data: {activo},
        select: CAMPOS_PUBLICOS,
    });
}

module.exports = {
    listarUsuarios,
    listarEstudiantesVisibles,
    listarCheckinsDeEstudiante,
    cambiarRol,
    cambiarEstado,
    // Se exporta para poder probarla sin base de datos. Es la frontera de
    // privacidad del módulo: si alguien le agrega un campo, la prueba de
    // test/privacidad.roles.test.js tiene que enterarse.
    proyectarParaAcompanamiento,
};
