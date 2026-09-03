const express = require('express');
const router = express.Router();
const authController =require('./auth.controller');
const validate = require('../middlewares/validate.middlewares');
const verificarToken = require('../middlewares/auth.middlewares');
const { registrarSchema, loginSchema } = require ('./auth.schema');

router.post('/register', validate(registrarSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);

// Requiere token: es la ruta con la que el frontend debe armar la sesión en
// vez de deducir el perfil a partir del correo.
router.get('/me', verificarToken, authController.yo);

module.exports = router;
