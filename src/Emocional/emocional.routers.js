const express = require('express');
const router = express.Router();

const emocionalController = require('./emocional.controlers');
const validate = require('../middlewares/validate.middlewares');
const verificarToken = require('../middlewares/auth.middlewares');
const { cerrarCheckinSchema } = require('../IA/ia.schema');

// Un registro emocional es siempre del usuario autenticado. No hay forma de
// crear ni leer el de otra persona desde acá: para eso está
// GET /usuarios/:id/checkins, que pasa por verificarAccesoAEstudiante.
router.use(verificarToken);

router.get('/', emocionalController.listar);
router.post('/', validate(cerrarCheckinSchema), emocionalController.crear);

module.exports = router;
