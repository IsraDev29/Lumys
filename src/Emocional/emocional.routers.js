const express = require("express");
const router = express.Router();

const {crearRegistro, obtenerHistorial,} = require("../controllers/emocional.controller");

//crear registro emocional

router.post("/registros", crearRegistro);

//obtener historial de emociones

router.get("/registros", obtenerHistorial);

module.exports = router;

