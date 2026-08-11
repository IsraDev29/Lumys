const { z } = require('zod');

// `edad` y `consentimiento` se validan pero NO se persisten: la tabla `usuarios`
// no tiene columnas para ellos. Ver la nota en auth.service.js.
const registrarSchema =z.object({
    email: z.string().email('Email inválido'),
    nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
    edad: z.number().int().positive().optional(),
    tipoUsuario: z.enum(['Estudiante', 'Docente', 'Administrador']),
    institucionId: z.number().int().positive().optional(),
    consentimiento: z.boolean().refine((v) => v === true, 'Debe aceptar los términos y condiciones'),
});

const loginSchema = z.object({
    email: z.string().email('Email inválido'),
    password: z.string().min(1, 'La contraseña es requerida'),
});

module.exports = { registrarSchema, loginSchema };
