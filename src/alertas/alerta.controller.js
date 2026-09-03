const alertaService = require('./alerta.service');

/**
 * Lee el `:id` de la señal. Devolver null en vez de lanzar deja la decisión de
 * la respuesta en el controlador, que es quien conoce el código de estado.
 */
function senalIdDe(req) {
    const id = Number(req.params.id);
    return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * GET /alertas — bandeja de señales sin atender.
 *
 * No recibe filtros: el alcance no es una opción del cliente, lo decide el
 * perfil del usuario dentro del servicio.
 */
async function listar(req, res, next) {
    try {
        res.status(200).json(await alertaService.listarAlertasVisibles(req.usuario));
    } catch (error) {
        next(error);
    }
}

/** POST /alertas/:id/caso — convierte la señal en un caso de acompañamiento. */
async function abrirCaso(req, res, next) {
    try {
        const senalId = senalIdDe(req);
        if (senalId === null) {
            return res.status(400).json({ error: 'Identificador de señal inválido' });
        }

        const senal = await alertaService.senalEnAlcance(senalId, req.usuario);

        // 403 y no 404: ver el comentario en senalEnAlcance. Que la señal no
        // exista y que sea de otra institución tienen que verse igual desde
        // afuera.
        if (!senal) {
            return res.status(403).json({ error: 'No tienes acceso a esta señal' });
        }

        if (senal.caso) {
            return res.status(409).json({
                error: 'Esta señal ya tiene un caso',
                casoId: senal.caso.id,
                estado: senal.caso.estado,
            });
        }

        const caso = await alertaService.abrirCaso(senalId, req.usuario.id, req.body);

        res.status(201).json(caso);
    } catch (error) {
        // Dos orientadores abriendo el mismo caso a la vez: la comprobación de
        // arriba pasa en ambos y el índice único de `senalId` frena al segundo.
        // Es la misma situación de negocio, así que responde igual.
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'Esta señal ya tiene un caso' });
        }
        next(error);
    }
}

/**
 * DELETE /alertas/:id — cierra la alerta atendida.
 *
 * Deja registro de quién la cerró en vez de borrar la señal; el detalle del
 * porqué está en alerta.service.
 */
async function cerrar(req, res, next) {
    try {
        const senalId = senalIdDe(req);
        if (senalId === null) {
            return res.status(400).json({ error: 'Identificador de señal inválido' });
        }

        const senal = await alertaService.senalEnAlcance(senalId, req.usuario);

        if (!senal) {
            return res.status(403).json({ error: 'No tienes acceso a esta señal' });
        }

        // Si ya hay un caso, la alerta no está en la bandeja y cerrarla no
        // significa nada. Cerrar un caso en curso es otra operación, con sus
        // propias condiciones, y no se hace desde la lista de alertas.
        if (senal.caso) {
            return res.status(409).json({
                error: 'Esta señal ya tiene un caso. Ciérralo desde el caso, no desde la alerta.',
                casoId: senal.caso.id,
                estado: senal.caso.estado,
            });
        }

        const caso = await alertaService.cerrarAlerta(senalId, req.usuario.id, req.body.motivo);

        res.status(200).json(caso);
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'Esta señal ya tiene un caso' });
        }
        next(error);
    }
}

module.exports = { listar, abrirCaso, cerrar };
