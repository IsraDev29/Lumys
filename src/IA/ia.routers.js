const express = require('express');
const router = express.Router();

const iaController = require('./ia.controller');
const validate = require('../middlewares/validate.middlewares');
const verificarToken = require('../middlewares/auth.middlewares');
const {
    siguienteTurnoSchema,
    analizarTextoSchema,
    analizarVozSchema,
} = require('./ia.schema');

// Ninguna ruta de este módulo es pública: cada llamada gasta tokens contra la
// clave de la plataforma, así que todas exigen sesión.
router.use(verificarToken);

router.get('/estado', iaController.estado);

// El check-in conversacional. Se llama una vez por intercambio.
router.post('/checkin/turno', validate(siguienteTurnoSchema), iaController.siguienteTurno);

router.post('/analizar-texto', validate(analizarTextoSchema), iaController.analizarTexto);
router.post('/analizar-voz', validate(analizarVozSchema), iaController.analizarVoz);

module.exports = router;
