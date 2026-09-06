require('dotenv').config();

const path = require('path');
const express = require('express');

const {
    corsRestringido,
    cabeceras,
    limiteGeneral,
    limiteAuth,
    limiteIa,
} = require('./middlewares/seguridad.middlewares');

const app = express();

// Detrás de un proxy (Render, Railway, nginx) req.ip devuelve la IP del proxy y
// no la del cliente, con lo que TODO el tráfico compartiría cupo de rate limit.
// Solo se confía en el proxy si se declara explícitamente: confiar por defecto
// permitiría falsificar X-Forwarded-For para saltarse los límites.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);

// Revela que el backend es Express y su familia de versiones. No es una
// vulnerabilidad en sí, pero no hay razón para regalar el dato.
app.disable('x-powered-by');

app.use(cabeceras);
app.use(corsRestringido);

// Tope explícito del cuerpo. El más grande que la app manda de verdad es el
// cierre de check-in: ocho turnos y hasta 4000 caracteres de texto libre, que no
// llega a 20 KB.
app.use(express.json({ limit: '100kb' }));

app.use('/api', limiteGeneral);

// El cliente es una aplicación de React construida con Vite. En desarrollo lo
// sirve el propio Vite en el 5173 (que proxea /api hacia acá) y este servidor
// solo atiende la API; en producción se sirve desde acá el resultado de
// `npm run build`.
const CLIENTE = path.join(__dirname, '..', 'client', 'dist');

// Los archivos de assets/ llevan hash en el nombre, así que son inmutables por
// definición: si cambia el contenido, cambia el nombre. index.html no lleva
// hash y por eso se revalida siempre — es el que sabe qué hash toca hoy.
app.use(express.static(CLIENTE, {
    index: false,
    setHeaders(res, ruta) {
        if (ruta.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
    },
}));

app.get('/health',(req,res) => {
    res.status(200).json({
        status: 'ok',
        message: 'Lummys backend corriendo correctamente',
    });

});

const authRoutes = require('./auth/auth.routes');
app.use('/api/v1/auth', limiteAuth, authRoutes)

const usuariosRoutes = require('./usuarios/usuarios.routes');
app.use('/api/v1/usuarios', usuariosRoutes)

const iaRoutes = require('./IA/ia.routers');
app.use('/api/v1/ia', limiteIa, iaRoutes)

const emocionalRoutes = require('./Emocional/emocional.routers');
app.use('/api/v1/registros', emocionalRoutes)

const alertasRoutes = require('./alertas/alerta.router');
app.use('/api/v1/alertas', alertasRoutes)

const comunitarioRoutes = require('./comunitario/comunitario.routers');
app.use('/api/v1/comunitario', comunitarioRoutes)

// Una ruta /api inexistente debe responder 404 en JSON. Sin esto cae en el
// index.html del frontend y el cliente recibe HTML donde espera datos.
app.use('/api', (req, res) => {
    res.status(404).json({error: 'Recurso no encontrado'});
});

// Reserva para la navegación del cliente. React Router usa rutas de verdad
// (/inicio, /checkin) en vez del hash de antes, así que al recargar en
// /historial el navegador le pide esa ruta al servidor: hay que devolverle el
// index.html para que la aplicación arranque y resuelva la ruta por su cuenta.
//
// Va DESPUÉS del 404 de /api a propósito. Si estuviera antes, un endpoint mal
// escrito devolvería HTML con estado 200 y el cliente reventaría al parsear
// JSON, en vez de ver un 404 que dice lo que pasa.
app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(CLIENTE, 'index.html'), (err) => {
        // Todavía no se corrió `npm run build`. Se dice qué falta, en vez de
        // devolver un 500 sin explicación.
        if (err && !res.headersSent) {
            res.status(503).type('text/plain').send(
                'El cliente de React no está construido todavía.\n\n'
                + '  Desarrollo:  npm run dev      (Express + Vite juntos)\n'
                + '  Producción:  npm run build && npm start\n',
            );
        }
    });
});

const manejarErrores = require('./middlewares/error.middlewares');
app.use(manejarErrores);

const PORT = process.env.PORT || 5000

// El servidor se exporta sin escuchar para que los tests lo monten en un puerto
// efímero. `require.main` distingue "me arrancaron" de "me importaron".
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Servidor Lumys* corriendo en el puerto ${PORT}`);

        // Precarga del modelo local sin bloquear el arranque: el backend tiene
        // que aceptar peticiones mientras el modelo se lee de disco, no después.
        // El primer check-in del día es el que peor latencia tendría, y ese
        // costo se paga mejor mientras nadie está esperando.
        require('./IA/proveedores').precalentar().catch(() => {});
    });
}

module.exports = app;
