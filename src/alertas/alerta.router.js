const express = require('express');
const router = express.Router();

const alertaController = require('./alerta.controller');
const validate = require('../middlewares/validate.middlewares');
const verificarToken = require('../middlewares/auth.middlewares');
const { verificarPerfil } = require('../middlewares/permisos.middlewares');
const { abrirCasoSchema, cerrarAlertaSchema } = require('./alerta.schema');

// Ninguna ruta de este módulo es pública.
router.use(verificarToken);

// Una alerta es información sobre el estado emocional de un menor: solo la ve
// quien tiene la función de acompañarlo. La guarda va en el router y no ruta por
// ruta para que una ruta nueva no pueda nacer desprotegida por olvido.
//
// verificarPerfil deja pasar a ADMIN y AUDITOR sin exigirles perfil, que es lo
// correcto acá: la auditoría del sistema de alertas es parte de su trabajo.
// Aun así ven solo lo que les permita alcanceDeEstudiantes.
router.use(verificarPerfil('ORIENTADOR', 'PSICOLOGO'));

router.get('/', alertaController.listar);

// El caso es un recurso hijo de la señal: la señal es la evidencia y el caso es
// lo que se decidió hacer con ella. De ahí la ruta anidada.
router.post('/:id/caso', validate(abrirCasoSchema), alertaController.abrirCaso);

router.delete('/:id', validate(cerrarAlertaSchema), alertaController.cerrar);

module.exports = router;
