const { z } = require('zod');
const { PERFILES } = require('../auth/auth.schema');

const ROLES = ['ADMIN', 'AUDITOR', 'USUARIO'];

// Solo un ADMIN llega a esta ruta (lo impone verificarRol en usuarios.routes).
const cambiarRolSchema = z.object({
    rol: z.enum(ROLES, {errorMap: () => ({message: `Rol inválido. Valores: ${ROLES.join(', ')}`})}),
    perfil: z.enum(PERFILES).nullable().optional(),
});

const cambiarEstadoSchema = z.object({
    activo: z.boolean(),
});

module.exports = { cambiarRolSchema, cambiarEstadoSchema, ROLES };
