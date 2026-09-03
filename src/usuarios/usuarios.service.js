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

function listarCheckinsDeEstudiante(estudianteId) {
    return prisma.checkIn.findMany({
        where: {estudianteId},
        orderBy: {fecha: 'desc'},
        select: {id: true, fecha: true, respuestas: true, textoLibre: true, puntajeIcve: true},
    });
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
};
