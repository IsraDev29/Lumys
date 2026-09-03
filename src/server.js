require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

// La carpeta se llama "Public": en Linux la ruta relativa 'public' no resuelve.
app.use(express.static(path.join(__dirname, '..', 'Public')));

app.get('/health',(req,res) => {
    res.status(200).json({
        status: 'ok',
        message: 'Lummys backend corriendo correctamente',
    });

});

const authRoutes = require('./auth/auth.routes');
app.use('/api/v1/auth', authRoutes)

const usuariosRoutes = require('./usuarios/usuarios.routes');
app.use('/api/v1/usuarios', usuariosRoutes)

const iaRoutes = require('./IA/ia.routers');
app.use('/api/v1/ia', iaRoutes)

const emocionalRoutes = require('./Emocional/emocional.routers');
app.use('/api/v1/registros', emocionalRoutes)

const alertasRoutes = require('./alertas/alerta.router');
app.use('/api/v1/alertas', alertasRoutes)

// Una ruta /api inexistente debe responder 404 en JSON. Sin esto cae en el
// index.html del frontend y el cliente recibe HTML donde espera datos.
app.use('/api', (req, res) => {
    res.status(404).json({error: 'Recurso no encontrado'});
});

const manejarErrores = require('./middlewares/error.middlewares');
app.use(manejarErrores);

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
    console.log(`Servidor Lumys* corriendo en el puerto ${PORT}`);
});
