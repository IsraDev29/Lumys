const helmet = require('helmet');
const cors = require('cors');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// ---------------------------------------------------------------------------
// Endurecimiento HTTP
//
// Todo lo de este archivo se montó después de comprobar contra el servidor real
// que faltaba: sin cabeceras de seguridad, con CORS abierto a cualquier origen y
// admitiendo doce intentos de login fallidos seguidos sin una sola demora.
//
// El criterio para elegir los límites no es "lo que recomienda la guía" sino el
// uso real: un estudiante hace UN check-in al día, de cuatro a seis turnos. Los
// topes de abajo dejan holgura de sobra para eso y muy poca para un script.
// ---------------------------------------------------------------------------

/**
 * Orígenes autorizados. En producción se declaran en CORS_ORIGENES separados por
 * coma; si no hay nada declarado se asumen los de desarrollo local.
 *
 * Ojo con una confusión frecuente: el frontend de Lumys lo sirve este mismo
 * Express, así que la app instalada NO usa CORS. Esta lista existe para el
 * desarrollo con Live Server y para un frontend en React desplegado aparte —
 * que es justo lo que viene después.
 */
const ORIGENES = (process.env.CORS_ORIGENES || 'http://localhost:5000,http://localhost:5173,http://127.0.0.1:5500')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

const corsRestringido = cors({
    origin(origin, callback) {
        // Sin `Origin` son peticiones del mismo origen, curl o la app instalada.
        // No es un navegador saltándose nada: CORS solo aplica a peticiones
        // cruzadas hechas desde una página web.
        if (!origin) return callback(null, true);

        if (ORIGENES.includes(origin)) return callback(null, true);

        // Sin `status`, el manejador de errores lo trata como fallo interno y
        // responde 500. Un origen no autorizado es una petición rechazada, no un
        // backend roto: quien depura del otro lado necesita ver la diferencia.
        const error = new Error(`Origen no autorizado: ${origin}`);
        error.status = 403;
        return callback(error);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
});

/**
 * Cabeceras de seguridad.
 *
 * La CSP se declara a mano porque la de helmet por defecto rompe el frontend
 * actual: las vistas usan atributos de estilo en línea. `scriptSrc` se queda en
 * 'self' sin 'unsafe-inline' — que es la directiva que de verdad frena el XSS —
 * y los estilos en línea se permiten como concesión temporal.
 */
const cabeceras = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'blob:'],
            connectSrc: ["'self'", ...ORIGENES],
            fontSrc: ["'self'", 'data:'],
            // Sin esto, un navegador puede intentar cargar el sitio dentro de un
            // iframe ajeno; con menores de por medio no hay motivo para permitirlo.
            frameAncestors: ["'none'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            // El service worker de la PWA tiene que poder registrarse.
            workerSrc: ["'self'"],
            mediaSrc: ["'self'", 'blob:'],
        },
    },
    // El backend puede correr detrás de un proxy que termina TLS; forzar HSTS
    // desde acá rompe el desarrollo en http://localhost.
    hsts: process.env.NODE_ENV === 'production',
    crossOriginEmbedderPolicy: false,
});

/**
 * Límite general. Cubre el uso normal con margen amplio: cargar el historial,
 * hacer un check-in completo y navegar entre vistas no llega ni a la mitad.
 */
const limiteGeneral = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Demasiadas peticiones. Esperá unos minutos.' },
});

/**
 * Límite de autenticación. Es el que faltaba: doce contraseñas equivocadas
 * seguidas contra una cuenta real devolvían doce 401 sin ninguna fricción, que
 * es una invitación a probar un diccionario entero.
 *
 * Cuenta por IP y por email, no solo por IP: si contara solo por IP, atacar una
 * cuenta desde varias direcciones seguiría siendo gratis, y limitar por IP a
 * secas dejaría fuera a un colegio entero detrás de un mismo NAT.
 */
const limiteAuth = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // Un login correcto no gasta cupo: quien sabe su contraseña no debería
    // quedar bloqueado por los intentos de otro desde la misma red.
    skipSuccessfulRequests: true,
    // `ipKeyGenerator` agrupa las IPv6 por su prefijo /64. Sin él, un atacante
    // con un rango IPv6 —que es lo normal hoy— tiene billones de direcciones
    // distintas y el límite por IP no limita nada.
    keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${String(req.body?.email || '').toLowerCase()}`,
    message: { error: 'Demasiados intentos de inicio de sesión. Probá de nuevo en 15 minutos.' },
});

/**
 * Límite del módulo de IA. Cada llamada ocupa el modelo local durante segundos:
 * sin tope, un solo cliente en bucle deja sin check-in a todos los demás. Acá el
 * recurso escaso no es la base de datos, es la CPU.
 */
const limiteIa = rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // Por usuario cuando hay sesión; si no, por IP agrupada por prefijo /64,
    // que es lo que evita que un rango IPv6 se salte el límite cambiando de
    // dirección en cada petición.
    keyGenerator: (req) => (req.usuario?.id ? `u:${req.usuario.id}` : ipKeyGenerator(req.ip)),
    message: { error: 'Demasiadas peticiones al módulo de IA. Esperá un momento.' },
});

module.exports = { ORIGENES, corsRestringido, cabeceras, limiteGeneral, limiteAuth, limiteIa };
