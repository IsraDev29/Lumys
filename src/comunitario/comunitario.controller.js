const gemeloService = require('./gemelo.service');
const federadoService = require('./federado.service');

// ---------------------------------------------------------------------------
// Gemelo personal y gemelo comunitario
//
// Son dos vistas con audiencias distintas y por eso viven en rutas distintas
// con permisos distintos:
//
//   GET /comunitario/gemelo → el estudiante, sobre sí mismo. Sin números.
//   GET /comunitario/radar  → el orientador, sobre su centro. Sin personas.
//
// La segunda no es "la primera pero de todos": si lo fuera, bastaría con
// filtrar por institución y listo. Es una agregación con un umbral mínimo,
// porque el promedio de un grupo chico identifica a sus miembros. Ver
// federado.service.js.
// ---------------------------------------------------------------------------

/**
 * GET /comunitario/gemelo — el gemelo digital del propio estudiante.
 *
 * Siempre sobre `req.usuario.id`, nunca sobre un id de la URL. Aceptar un
 * parámetro acá abriría exactamente el mismo agujero que ya se cerró en el
 * registro: cualquiera pediría el gemelo de cualquiera cambiando un número.
 */
async function gemelo(req, res, next) {
    try {
        res.status(200).json(await gemeloService.construir(req.usuario.id));
    } catch (error) {
        next(error);
    }
}

/**
 * GET /comunitario/radar — el gemelo del centro.
 *
 * Requiere institución. Un usuario sin `institucionId` no es un caso de error
 * sino de datos incompletos, y responder 200 con todo en null sería mentir
 * sobre por qué la pantalla está vacía.
 */
async function radar(req, res, next) {
    try {
        const { institucionId } = req.usuario;

        if (!institucionId) {
            return res.status(409).json({
                error: 'Tu cuenta todavía no está asociada a una institución',
            });
        }

        const [centro, grupos, federado] = await Promise.all([
            federadoService.radarDelCentro(institucionId),
            federadoService.grupos(institucionId),
            federadoService.federado(institucionId),
        ]);

        res.status(200).json({ ...centro, grupos, federado });
    } catch (error) {
        next(error);
    }
}

module.exports = { gemelo, radar };
