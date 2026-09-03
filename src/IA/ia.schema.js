const { z } = require('zod');
const { COMPONENTES } = require('./ia.prompt');

// Un turno ya respondido, tal como lo reenvía el cliente en cada llamada.
//
// `componente` se valida contra la lista cerrada porque de ahí sale el peso en
// el ICVE: un componente inventado desde el cliente movería el puntaje hacia un
// promedio que no corresponde.
const turnoRespondido = z.object({
    pregunta: z.string().min(1).max(300),
    respuesta: z.string().min(1).max(2000),
    componente: z.enum([...COMPONENTES, 'libre']),
    valor: z.number().int().min(1).max(5).nullable().optional(),
});

// El cliente manda la sesión completa en cada turno: el backend no guarda estado
// conversacional. El tope de 8 evita que alguien alargue el hilo a mano para
// inflar el prompt.
const siguienteTurnoSchema = z.object({
    sesion: z.array(turnoRespondido).max(8).default([]),
});

const cerrarCheckinSchema = z.object({
    turnos: z.array(turnoRespondido).min(1).max(8),
    texto_usuario: z.string().max(4000).nullable().optional(),
    voz: z
        .object({
            caracteristicas: z.record(z.number()),
            consentimiento: z.literal(true),
        })
        .nullable()
        .optional(),
});

const analizarTextoSchema = z.object({
    texto: z.string().min(1).max(4000),
});

const analizarVozSchema = z.object({
    caracteristicas: z.record(z.number()),
    // Sin valor por defecto: el consentimiento se otorga, no se asume.
    consentimiento: z.literal(true),
});

module.exports = {
    siguienteTurnoSchema,
    cerrarCheckinSchema,
    analizarTextoSchema,
    analizarVozSchema,
};
