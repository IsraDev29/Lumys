const express = require('express');
const router = express.Router();
const authController =require('./auth.controller');
const validate = require('../middlewares/validate.middlewares');
const { registrarSchema, loginSchema } = require ('./auth.schema');

router.post('/register', validate(registrarSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);

module.exports = router;
