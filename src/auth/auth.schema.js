const { z } = require('zod');

const registrarSchema =z.object({
    email: z.string().email('Email inválido'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
    edad: z.number().int().positive().optional(),
    tipoUsuario: z.enum(['Estudiante', 'Docente', 'Administrador']),
    centroId: z.string().uuid().optional(),
    consentimiento: z.boolean().refine((v) => v === true, 'Debe aceptar los términos y condiciones'),
});

const loginSchema = z.object({
    email: z.string().email('Email inválido'),
    password: z.string().min(1, 'La contraseña es requerida'),
});

module.exports = { registrarSchema, loginSchema };
