const { z } = require('zod');

// Estos valores son los del enum `Perfil` en prisma/schema.prisma. Antes eran
// texto libre ('Estudiante', 'Docente', 'Administrador'), que no coincidía con
// lo que ya había en la base de datos.
const PERFILES = ['ESTUDIANTE', 'DOCENTE', 'ORIENTADOR', 'PSICOLOGO', 'FAMILIA', 'COMPANERO'];

// Perfiles que alguien puede darse a sí mismo al registrarse.
//
// ORIENTADOR y PSICOLOGO NO están en la lista, y esa ausencia es el control de
// acceso más importante del backend. `alcanceDeEstudiantes` le concede a esos
// dos perfiles la lectura de TODOS los estudiantes de su institución — check-ins
// incluidos. Como `institucionId` también viaja en el cuerpo de la petición,
// aceptarlos acá significaba que cualquiera con curl podía registrarse como
// orientador de la institución que eligiera y leer el historial emocional de
// menores. Verificado contra el servidor antes de cerrar el agujero.
//
// DOCENTE tampoco: hoy no da alcance ampliado, pero es una condición de la
// institución y no algo que uno declare de sí mismo. Si mañana se le concede
// alcance, el agujero volvería solo.
//
// Estos tres perfiles los asigna un ADMIN con PATCH /usuarios/:id/rol, que
// acepta `perfil` en el cuerpo y ya está detrás de verificarRol('ADMIN').
const PERFILES_AUTOREGISTRO = ['ESTUDIANTE', 'FAMILIA', 'COMPANERO'];

// `rol` no se acepta a propósito: si el cliente pudiera enviarlo, cualquiera
// podría crearse una cuenta ADMIN. Zod descarta las claves no declaradas.
const registrarSchema =z.object({
    email: z.string().email('Email inválido'),
    nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
    perfil: z.enum(PERFILES_AUTOREGISTRO, {
        errorMap: () => ({
            message:
                `Perfil inválido para registro propio. Valores: ${PERFILES_AUTOREGISTRO.join(', ')}. ` +
                'Los perfiles de acompañamiento los asigna la institución.',
        }),
    }),
    institucionId: z.number().int().positive().optional(),
    consentimiento: z.boolean().refine((v) => v === true, 'Debe aceptar los términos y condiciones'),
});

const loginSchema = z.object({
    email: z.string().email('Email inválido'),
    password: z.string().min(1, 'La contraseña es requerida'),
});

module.exports = { registrarSchema, loginSchema, PERFILES, PERFILES_AUTOREGISTRO };
