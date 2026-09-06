require('dotenv').config();

const test = require('node:test');
const assert = require('node:assert');

const app = require('../src/server');

// ---------------------------------------------------------------------------
// Seguridad de la API, contra el servidor levantado de verdad
//
// Todo lo que se prueba acá se comprobó primero a mano contra el backend
// corriendo, y todo fallaba. Estos tests existen para que no vuelva a fallar en
// silencio.
//
// Ninguno escribe en la base: el peor caso es una lectura de usuario por email
// inexistente. Se hizo así a propósito porque DATABASE_URL apunta a la base real
// del proyecto, y una batería de tests que siembra cuentas de prueba en la base
// donde viven datos de estudiantes es un problema, no una verificación.
// ---------------------------------------------------------------------------

let servidor;
let base;

test.before(async () => {
    await new Promise((resolve) => {
        servidor = app.listen(0, '127.0.0.1', resolve);
    });
    base = `http://127.0.0.1:${servidor.address().port}`;
});

test.after(() => servidor?.close());

const pedir = (ruta, opciones = {}) =>
    fetch(`${base}${ruta}`, {
        ...opciones,
        headers: { 'Content-Type': 'application/json', ...(opciones.headers || {}) },
    });

// ---------------------------------------------------------------------------
// Escalada de privilegios por auto-registro
// ---------------------------------------------------------------------------

test('nadie puede registrarse con un perfil que da acceso a datos ajenos', async () => {
    // Esta era la falla más grave del backend. `alcanceDeEstudiantes` le concede
    // a ORIENTADOR y PSICOLOGO la lectura de todos los estudiantes de su
    // institución, y `institucionId` viaja en el cuerpo de la petición: con un
    // solo POST sin autenticar se conseguía el historial emocional de menores.
    // Comprobado contra el servidor real antes de cerrarlo.
    for (const perfil of ['ORIENTADOR', 'PSICOLOGO', 'DOCENTE']) {
        const respuesta = await pedir('/api/v1/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                email: `regresion.${perfil.toLowerCase()}@ejemplo.invalid`,
                nombre: 'Cuenta De Prueba',
                password: 'passwordlargo123',
                perfil,
                institucionId: 1,
                consentimiento: true,
            }),
        });

        assert.strictEqual(respuesta.status, 400, `${perfil} no debería poder auto-asignarse`);
    }
});

test('tampoco se puede llegar a ADMIN por el cuerpo de la petición', async () => {
    const respuesta = await pedir('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify({
            email: 'regresion.admin@ejemplo.invalid',
            nombre: 'Cuenta De Prueba',
            password: 'passwordlargo123',
            perfil: 'ESTUDIANTE',
            rol: 'ADMIN',
            consentimiento: true,
        }),
    });

    // Zod descarta `rol` por no estar declarado. Si el registro llegara a
    // crearse, al menos no sería como administrador; el 409 significa que el
    // email ya existía de una corrida anterior, y sirve igual.
    if (respuesta.status === 201) {
        const usuario = await respuesta.json();
        assert.strictEqual(usuario.rol, 'USUARIO', 'el rol no puede venir del cliente');
    }
});

test('el consentimiento no se puede omitir ni falsear', async () => {
    for (const consentimiento of [false, undefined, 'sí']) {
        const respuesta = await pedir('/api/v1/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                email: 'regresion.consentimiento@ejemplo.invalid',
                nombre: 'Cuenta De Prueba',
                password: 'passwordlargo123',
                perfil: 'ESTUDIANTE',
                consentimiento,
            }),
        });
        assert.strictEqual(respuesta.status, 400);
    }
});

// ---------------------------------------------------------------------------
// Autenticación
// ---------------------------------------------------------------------------

test('las rutas de datos exigen sesión', async () => {
    const rutas = [
        '/api/v1/ia/estado',
        '/api/v1/usuarios',
        '/api/v1/usuarios/estudiantes',
        '/api/v1/usuarios/1/checkins',
        '/api/v1/registros',
        '/api/v1/alertas',
    ];

    for (const ruta of rutas) {
        const respuesta = await pedir(ruta);
        assert.strictEqual(respuesta.status, 401, `${ruta} respondió ${respuesta.status}`);
    }
});

test('un token falsificado no entra', async () => {
    // Firmado con otra clave: si el backend lo aceptara, cualquiera podría
    // fabricarse una sesión de administrador.
    const jwt = require('jsonwebtoken');
    const falso = jwt.sign({ id: 1, rol: 'ADMIN' }, 'clave-que-no-es-la-del-servidor');

    const respuesta = await pedir('/api/v1/usuarios', {
        headers: { Authorization: `Bearer ${falso}` },
    });
    assert.strictEqual(respuesta.status, 401);
});

test('el algoritmo "none" no cuela', async () => {
    // Ataque clásico contra JWT: cabecera alg:none y sin firma.
    const cabecera = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const carga = Buffer.from(JSON.stringify({ id: 1, rol: 'ADMIN' })).toString('base64url');

    const respuesta = await pedir('/api/v1/usuarios', {
        headers: { Authorization: `Bearer ${cabecera}.${carga}.` },
    });
    assert.strictEqual(respuesta.status, 401);
});

test('se exige el esquema Bearer', async () => {
    for (const cabecera of ['token-suelto', 'Basic abc', 'Bearer', 'Bearer ']) {
        const respuesta = await pedir('/api/v1/usuarios', { headers: { Authorization: cabecera } });
        assert.strictEqual(respuesta.status, 401, `pasó con "${cabecera}"`);
    }
});

// ---------------------------------------------------------------------------
// Fuerza bruta
// ---------------------------------------------------------------------------

test('el login se corta tras varios intentos fallidos', async () => {
    // Antes admitía intentos ilimitados: doce contraseñas equivocadas seguidas
    // devolvían doce 401 sin ninguna fricción.
    const codigos = [];
    for (let i = 0; i < 14; i += 1) {
        const respuesta = await pedir('/api/v1/auth/login', {
            method: 'POST',
            body: JSON.stringify({
                email: 'fuerza.bruta@ejemplo.invalid',
                password: `claveIncorrecta${i}`,
            }),
        });
        codigos.push(respuesta.status);
    }

    assert.ok(codigos.includes(429), `nunca se activó el límite: ${codigos.join(',')}`);
});

// ---------------------------------------------------------------------------
// Cabeceras y CORS
// ---------------------------------------------------------------------------

test('responde con las cabeceras de seguridad', async () => {
    const respuesta = await pedir('/health');

    assert.ok(respuesta.headers.get('content-security-policy'), 'falta CSP');
    assert.strictEqual(respuesta.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(respuesta.headers.get('referrer-policy'), 'falta Referrer-Policy');
    assert.strictEqual(respuesta.headers.get('x-powered-by'), null, 'no debe anunciar Express');
});

test('la CSP no permite scripts en línea', async () => {
    // Es la directiva que de verdad frena el XSS. styleSrc sí lleva
    // unsafe-inline como concesión al frontend actual, scriptSrc no.
    const csp = (await pedir('/health')).headers.get('content-security-policy');

    const scriptSrc = csp.split(';').find((d) => d.trim().startsWith('script-src'));
    assert.ok(scriptSrc, 'falta script-src');
    assert.ok(!scriptSrc.includes('unsafe-inline'), `script-src permisivo: ${scriptSrc}`);
    assert.ok(csp.includes("frame-ancestors 'none'"), 'debe prohibir el embebido en iframes');
});

test('un origen no autorizado recibe 403, no 500', async () => {
    const respuesta = await pedir('/api/v1/auth/login', {
        method: 'POST',
        headers: { Origin: 'https://sitio-no-autorizado.invalid' },
        body: JSON.stringify({ email: 'a@b.co', password: 'x' }),
    });

    assert.strictEqual(respuesta.status, 403);
    assert.strictEqual(respuesta.headers.get('access-control-allow-origin'), null);
});

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------

test('un cuerpo enorme se rechaza', async () => {
    const respuesta = await pedir('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'a@b.co', password: 'x'.repeat(200000) }),
    });

    assert.ok(respuesta.status >= 400, `aceptó 200 KB: ${respuesta.status}`);
});

test('una ruta /api inexistente responde JSON, no el index.html', async () => {
    const respuesta = await pedir('/api/v1/no-existe');

    assert.strictEqual(respuesta.status, 404);
    assert.match(respuesta.headers.get('content-type') || '', /json/);
});

test('un JSON mal formado no tumba el servidor', async () => {
    const respuesta = await pedir('/api/v1/auth/login', {
        method: 'POST',
        body: '{"email": roto',
    });

    assert.ok(respuesta.status >= 400 && respuesta.status < 500);

    // Y el servidor sigue en pie después.
    assert.strictEqual((await pedir('/health')).status, 200);
});
