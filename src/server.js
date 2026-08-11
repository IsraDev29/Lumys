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

const manejarErrores = require('./middlewares/error.middlewares');
app.use(manejarErrores);

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
    console.log(`Servidor Lumys* corriendo en el puerto ${PORT}`);
});
