const { z } = require('zod');

// Estos valores son los del enum `Perfil` en prisma/schema.prisma. Antes eran
// texto libre ('Estudiante', 'Docente', 'Administrador'), que no coincidía con
// lo que ya había en la base de datos.
const PERFILES = ['ESTUDIANTE', 'DOCENTE', 'ORIENTADOR', 'PSICOLOGO', 'FAMILIA', 'COMPANERO'];

// `rol` no se acepta a propósito: si el cliente pudiera enviarlo, cualquiera
// podría crearse una cuenta ADMIN. Zod descarta las claves no declaradas.
const registrarSchema =z.object({
    email: z.string().email('Email inválido'),
    nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
    perfil: z.enum(PERFILES, {errorMap: () => ({message: `Perfil inválido. Valores: ${PERFILES.join(', ')}`})}),
    institucionId: z.number().int().positive().optional(),
    consentimiento: z.boolean().refine((v) => v === true, 'Debe aceptar los términos y condiciones'),
});

const loginSchema = z.object({
    email: z.string().email('Email inválido'),
    password: z.string().min(1, 'La contraseña es requerida'),
});

module.exports = { registrarSchema, loginSchema, PERFILES };
