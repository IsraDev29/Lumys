require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.get('/health',(req,res) => {
    res.status(200).json({
        status: 'ok',
        message: 'Lummys backend corriendo correctamente',
    });

});

const authRoutes = require('./auth/auth.routes');
app.use('/api/v1/auth', authRoutes)

const PORT =process.env.port || 5000

app.listen(PORT, () => {
    console.log(`Servidor Lumys* corriendo en el puerto ${PORT}`);
});
