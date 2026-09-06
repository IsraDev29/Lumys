const test = require('node:test');
const assert = require('node:assert');

const permisosPath = require.resolve('../src/middlewares/permisos.middlewares');
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
    delete require.cache[permisosPath];
    delete require.cache[dbPath];
    require.cache[dbPath] = {
        id: dbPath,
        filename: dbPath,
        loaded: true,
        exports: dbMock,
    };
    return require(permisosPath);
}

function limpiarCache() {
    delete require.cache[permisosPath];
    delete require.cache[dbPath];
}

function esperarTick() {
    return new Promise((resolve) => setImmediate(resolve));
}

test.afterEach(() => {
    limpiarCache();
});

test('verificarRol deja pasar solo a los roles permitidos', async () => {
    const { verificarRol } = cargarConDb({});
    const middleware = verificarRol('ADMIN', 'AUDITOR');

    const reqPermitido = { usuario: { rol: 'ADMIN' } };
    const resPermitido = crearRes();
    let nextCalled = false;

    await middleware(reqPermitido, resPermitido, () => {
        nextCalled = true;
    });

    assert.strictEqual(nextCalled, true);
    assert.strictEqual(resPermitido.statusCode, null);
    assert.strictEqual(resPermitido.body, null);

    const reqDenegado = { usuario: { rol: 'USUARIO' } };
    const resDenegado = crearRes();
    let nextDenegado = false;

    await middleware(reqDenegado, resDenegado, () => {
        nextDenegado = true;
    });

    assert.strictEqual(nextDenegado, false);
    assert.strictEqual(resDenegado.statusCode, 403);
    assert.deepStrictEqual(resDenegado.body, {
        error: 'No tienes permisos para acceder a este recurso',
    });
});

test('verificarPerfil deja pasar a ADMIN y AUDITOR aunque no tengan perfil', async () => {
    const { verificarPerfil } = cargarConDb({});
    const middleware = verificarPerfil('ORIENTADOR', 'PSICOLOGO');

    for (const rol of ['ADMIN', 'AUDITOR']) {
        const req = { usuario: { rol, perfil: null } };
        const res = crearRes();
        let nextCalled = false;

        await middleware(req, res, () => {
            nextCalled = true;
        });

        assert.strictEqual(nextCalled, true, `${rol} debería pasar`);
        assert.strictEqual(res.statusCode, null);
    }
});

test('verificarPerfil rechaza perfiles fuera de la lista', async () => {
    const { verificarPerfil } = cargarConDb({});
    const middleware = verificarPerfil('ORIENTADOR', 'PSICOLOGO');

    const req = { usuario: { rol: 'USUARIO', perfil: 'ESTUDIANTE' } };
    const res = crearRes();
    let nextCalled = false;

    await middleware(req, res, () => {
        nextCalled = true;
    });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 403);
    assert.deepStrictEqual(res.body, {
        error: 'Tu perfil no tiene acceso a este recurso',
    });
});

test('alcanceDeEstudiantes acota familia y compañeros a sus vínculos', async () => {
    let llamadas = 0;
    const prisma = {
        redDeApoyo: {
            findMany: async () => {
                llamadas += 1;
                return [{ estudianteId: 11 }, { estudianteId: 27 }];
            },
        },
    };
    const { alcanceDeEstudiantes } = cargarConDb(prisma);

    const familia = await alcanceDeEstudiantes({
        id: 8,
        rol: 'USUARIO',
        perfil: 'FAMILIA',
        institucionId: null,
    });
    const companero = await alcanceDeEstudiantes({
        id: 9,
        rol: 'USUARIO',
        perfil: 'COMPANERO',
        institucionId: null,
    });

    assert.deepStrictEqual(familia, { id: { in: [11, 27] } });
    assert.deepStrictEqual(companero, { id: { in: [11, 27] } });
    assert.strictEqual(llamadas, 2);
});

test('puedeVerEstudiante consulta el alcance antes de decidir', async () => {
    const prisma = {
        usuario: {
            findFirst: async ({ where }) => (where.AND[0].id === 42 ? { id: 42 } : null),
        },
        redDeApoyo: {
            findMany: async () => [],
        },
    };
    const { puedeVerEstudiante } = cargarConDb(prisma);

    assert.strictEqual(
        await puedeVerEstudiante({ id: 42, rol: 'USUARIO', perfil: 'ESTUDIANTE' }, 42),
        true,
    );
    assert.strictEqual(
        await puedeVerEstudiante({ id: 42, rol: 'USUARIO', perfil: 'ESTUDIANTE' }, 7),
        false,
    );
});

test('verificarAccesoAEstudiante corta ids inválidos y permite los válidos', async () => {
    const prisma = {
        usuario: {
            findFirst: async ({ where }) => (where.AND[0].id === 42 ? { id: 42 } : null),
        },
        redDeApoyo: {
            findMany: async () => [],
        },
    };
    const { verificarAccesoAEstudiante } = cargarConDb(prisma);

    const reqInvalido = { params: { id: 'abc' }, usuario: { id: 42, rol: 'USUARIO', perfil: 'ESTUDIANTE' } };
    const resInvalido = crearRes();
    let nextInvalido = false;
    verificarAccesoAEstudiante(reqInvalido, resInvalido, () => {
        nextInvalido = true;
    });
    await esperarTick();

    assert.strictEqual(nextInvalido, false);
    assert.strictEqual(resInvalido.statusCode, 400);
    assert.deepStrictEqual(resInvalido.body, { error: 'Identificador de estudiante inválido' });

    const reqPermitido = { params: { id: '42' }, usuario: { id: 42, rol: 'USUARIO', perfil: 'ESTUDIANTE' } };
    const resPermitido = crearRes();
    let nextPermitido = false;
    verificarAccesoAEstudiante(reqPermitido, resPermitido, () => {
        nextPermitido = true;
    });
    await esperarTick();

    assert.strictEqual(nextPermitido, true);
    assert.strictEqual(resPermitido.statusCode, null);

    const reqDenegado = { params: { id: '7' }, usuario: { id: 42, rol: 'USUARIO', perfil: 'ESTUDIANTE' } };
    const resDenegado = crearRes();
    let nextDenegado = false;
    verificarAccesoAEstudiante(reqDenegado, resDenegado, () => {
        nextDenegado = true;
    });
    await esperarTick();

    assert.strictEqual(nextDenegado, false);
    assert.strictEqual(resDenegado.statusCode, 403);
    assert.deepStrictEqual(resDenegado.body, {
        error: 'No tienes acceso a los datos de este estudiante',
    });
});
