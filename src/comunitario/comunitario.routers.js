const express = require('express');
const router = express.Router();

const comunitarioController = require('./comunitario.controller');
const verificarToken = require('../middlewares/auth.middlewares');
const { verificarPerfil } = require('../middlewares/permisos.middlewares');

// Ninguna ruta de este módulo es pública.
router.use(verificarToken);

// El gemelo propio: cualquier sesión, siempre sobre sus propios datos.
router.get('/gemelo', comunitarioController.gemelo);

// El radar del centro es una herramienta de acompañamiento, no información
// general. Un estudiante no tiene por qué ver cómo viene su colegio: no puede
// hacer nada con ese dato y sí puede sacar conclusiones sobre sus compañeros.
router.get('/radar', verificarPerfil('ORIENTADOR', 'PSICOLOGO', 'DOCENTE'), comunitarioController.radar);

module.exports = router;
