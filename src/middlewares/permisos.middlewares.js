const prisma = require('../db');

// ---------------------------------------------------------------------------
// Permisos por rol y por perfil
//
// `rol` (ADMIN, AUDITOR, USUARIO) es el nivel de acceso técnico.
// `perfil` (ESTUDIANTE, DOCENTE, ORIENTADOR...) es la función dentro del
// acompañamiento. Un ADMIN no necesita perfil; un orientador es USUARIO con
// perfil ORIENTADOR. Por eso hacen falta dos guardas distintas.
//
// Todas asumen que `verificarToken` ya llenó `req.usuario`.
// ---------------------------------------------------------------------------

const ROLES_TOTALES = ['ADMIN', 'AUDITOR'];
const PERFILES_STAFF = ['ORIENTADOR', 'PSICOLOGO'];

function verificarRol(...rolesPermitidos) {
    return(req, res, next) => {
        const { rol } = req.usuario;

        if (!rolesPermitidos.includes(rol)){
            return res.status(403).json({
                error: 'No tienes permisos para acceder a este recurso',
            });
        }
        next();
    }
}

function verificarPerfil(...perfilesPermitidos) {
    return (req, res, next) => {
        const { rol, perfil } = req.usuario;

        // Un administrador o auditor no queda fuera por no tener perfil.
        if (ROLES_TOTALES.includes(rol)) return next();

        if (!perfilesPermitidos.includes(perfil)){
            return res.status(403).json({
                error: 'Tu perfil no tiene acceso a este recurso',
            });
        }
        next();
    }
}

/**
 * Devuelve el filtro Prisma con los estudiantes que este usuario puede ver.
 * Se usa en los listados, para que la consulta nazca ya acotada en vez de
 * traer todo y filtrar después (que es como se filtran datos por error).
 */
async function alcanceDeEstudiantes(usuario) {
    const {id, rol, perfil, institucionId} = usuario;

    // Administración y auditoría ven toda la plataforma.
    if (ROLES_TOTALES.includes(rol)) return {};

    // Orientadores y psicólogos ven a los estudiantes de su propia institución.
    if (PERFILES_STAFF.includes(perfil)) {
        return {perfil: 'ESTUDIANTE', institucionId: institucionId ?? -1};
    }

    // Familia y compañeros solo ven a quien los puso en su red de apoyo.
    if (perfil === 'FAMILIA' || perfil === 'COMPANERO') {
        const vinculos = await prisma.redDeApoyo.findMany({
            where: {personaApoyoId: id},
            select: {estudianteId: true},
        });
        return {id: {in: vinculos.map((v) => v.estudianteId)}};
    }

    // Un estudiante (o cualquier otro perfil) solo se ve a sí mismo.
    return {id};
}

/** ¿Puede `usuario` ver los datos del estudiante `estudianteId`? */
async function puedeVerEstudiante(usuario, estudianteId) {
    const alcance = await alcanceDeEstudiantes(usuario);
    const encontrado = await prisma.usuario.findFirst({
        where: {AND: [{id: estudianteId}, alcance]},
        select: {id: true},
    });
    return encontrado !== null;
}

/**
 * Protege las rutas con `:id` de estudiante. Responde 403 en vez de 404 para
 * no revelar si el estudiante existe.
 */
function verificarAccesoAEstudiante(req, res, next) {
    const estudianteId = Number(req.params.id);

    if (!Number.isInteger(estudianteId)) {
        return res.status(400).json({error: 'Identificador de estudiante inválido'});
    }

    puedeVerEstudiante(req.usuario, estudianteId)
        .then((permitido) => {
            if (!permitido) {
                return res.status(403).json({error: 'No tienes acceso a los datos de este estudiante'});
            }
            next();
        })
        .catch(next);
}

module.exports = {
    verificarRol,
    verificarPerfil,
    alcanceDeEstudiantes,
    puedeVerEstudiante,
    verificarAccesoAEstudiante,
};
