const test = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');

const authPath = require.resolve('../src/middlewares/auth.middlewares');
const dbPath = require.resolve('../src/db');

function crearRes() {
    return {
        statusCode: null,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        },
    };
}

function cargarConDb(dbMock) {
    delete require.cache[authPath];
    delete require.cache[dbPath];
    require.cache[dbPath] = {
        id: dbPath,
        filename: dbPath,
        loaded: true,
        exports: dbMock,
    };
    return require(authPath);
}

function limpiarCache() {
    delete require.cache[authPath];
    delete require.cache[dbPath];
}

test.afterEach(() => {
    limpiarCache();
});

test('verificarToken rechaza la cabecera ausente o con formato inválido', async () => {
    process.env.JWT_SECRET = 'secreto-de-prueba';
    const verificarToken = cargarConDb({
        usuario: {
            findUnique: async () => null,
        },
    });

    for (const authorization of [undefined, 'token-suelto', 'Basic abc', 'Bearer', 'Bearer ']) {
        const req = { headers: authorization ? { authorization } : {} };
        const res = crearRes();
        let nextCalled = false;

        await verificarToken(req, res, () => {
            nextCalled = true;
        });

        assert.strictEqual(nextCalled, false, `no debería pasar con ${JSON.stringify(authorization)}`);
        assert.strictEqual(res.statusCode, 401);
    }
});

test('verificarToken rechaza tokens falsos o cuentas inactivas', async () => {
    process.env.JWT_SECRET = 'secreto-de-prueba';
    const verificarToken = cargarConDb({
        usuario: {
            findUnique: async () => ({ id: 7, rol: 'USUARIO', perfil: 'ESTUDIANTE', institucionId: 1, activo: true }),
        },
    });

    const tokenFalso = jwt.sign({ id: 7 }, 'otra-clave');
    const resFalso = crearRes();
    await verificarToken({ headers: { authorization: `Bearer ${tokenFalso}` } }, resFalso, () => {});
    assert.strictEqual(resFalso.statusCode, 401);

    limpiarCache();

    const verificarTokenInactivo = cargarConDb({
        usuario: {
            findUnique: async () => ({ id: 7, rol: 'USUARIO', perfil: 'ESTUDIANTE', institucionId: 1, activo: false }),
        },
    });
    const tokenValido = jwt.sign({ id: 7 }, process.env.JWT_SECRET);
    const req = { headers: { authorization: `Bearer ${tokenValido}` } };
    const res = crearRes();
    let nextCalled = false;

    await verificarTokenInactivo(req, res, () => {
        nextCalled = true;
    });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 401);
    assert.deepStrictEqual(res.body, { error: 'La cuenta no está activa' });
});

test('verificarToken llena req.usuario cuando el token es válido', async () => {
    process.env.JWT_SECRET = 'secreto-de-prueba';
    const verificarToken = cargarConDb({
        usuario: {
            findUnique: async () => ({
                id: 7,
                rol: 'USUARIO',
                perfil: 'ESTUDIANTE',
                institucionId: 1,
                activo: true,
            }),
        },
    });

    const token = jwt.sign({ id: 7 }, process.env.JWT_SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = crearRes();
    let nextCalled = false;

    await verificarToken(req, res, () => {
        nextCalled = true;
    });

    assert.strictEqual(nextCalled, true);
    assert.strictEqual(res.statusCode, null);
    assert.deepStrictEqual(req.usuario, {
        id: 7,
        rol: 'USUARIO',
        perfil: 'ESTUDIANTE',
        institucionId: 1,
        activo: true,
    });
});
