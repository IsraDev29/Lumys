const { z } = require('zod');

// El cuerpo de estas dos rutas es opcional: lo que importa es el identificador
// de la señal y quién está autenticado. Los campos de texto son el registro de
// la acción humana, y se validan por tamaño para que nadie use el caso como
// depósito de notas largas — para eso existe el seguimiento de la derivación.

const abrirCasoSchema = z.object({
    planSeguridad: z.string().min(1).max(2000).nullable().optional(),
    accionRegistrada: z.string().min(1).max(2000).nullable().optional(),
});

// Cerrar sin motivo está permitido (el servicio pone un texto por defecto),
// pero si se escribe uno queda guardado en el caso.
const cerrarAlertaSchema = z.object({
    motivo: z.string().min(1).max(500).nullable().optional(),
});

module.exports = { abrirCasoSchema, cerrarAlertaSchema };
