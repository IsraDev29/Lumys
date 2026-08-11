// Middleware de errores: captura todo lo que los controladores pasan a next(error).
// Se registra en server.js DESPUÉS de las rutas y con los 4 parámetros, porque así
// es como Express lo reconoce como manejador de errores.
function manejarErrores(error, req, res, next) {
    if (res.headersSent) {
        return next(error);
    }

    console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, error);

    const status = error.status || error.statusCode || 500;

    res.status(status).json({
        error: status === 500 ? 'Error interno del servidor' : error.message,
        ...(process.env.NODE_ENV !== 'production' && { detalle: error.message }),
    });
}

module.exports = manejarErrores;
