const express = require('express');
const router = express.Router();
const usuariosController = require('./usuarios.controller');
const validate = require('../middlewares/validate.middlewares');
const verificarToken = require('../middlewares/auth.middlewares');
const {
    verificarRol,
    verificarAccesoAEstudiante,
} = require('../middlewares/permisos.middlewares');
const { cambiarRolSchema, cambiarEstadoSchema } = require('./usuarios.schema');

// Ninguna ruta de este módulo es pública.
router.use(verificarToken);

// El padrón completo es información de administración y auditoría.
router.get('/', verificarRol('ADMIN', 'AUDITOR'), usuariosController.listar);

// Abierta a cualquier sesión, pero cada quien recibe una lista distinta:
// el alcance lo decide alcanceDeEstudiantes según rol y perfil.
router.get('/estudiantes', usuariosController.listarEstudiantes);

router.get('/:id/checkins', verificarAccesoAEstudiante, usuariosController.checkinsDeEstudiante);

// Gestión de roles: exclusiva de ADMIN. Un AUDITOR observa, no modifica.
router.patch('/:id/rol', verificarRol('ADMIN'), validate(cambiarRolSchema), usuariosController.cambiarRol);
router.patch('/:id/estado', verificarRol('ADMIN'), validate(cambiarEstadoSchema), usuariosController.cambiarEstado);

module.exports = router;
