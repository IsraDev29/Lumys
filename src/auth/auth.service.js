const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const prisma = require('../db')

const SALT_ROUNDS = 10

// Nunca devolvemos el hash de la contraseña al cliente.
const CAMPOS_PUBLICOS = {
    id: true,
    nombre: true,
    email: true,
    rol: true,
    perfil: true,
    institucionId: true,
    activo: true,
    creadoEn: true,
};

async function registrarUsuario(datos){
    // `rol` se omite a propósito: si viniera del cliente, cualquiera podría
    // registrarse como ADMIN. Solo se asigna desde la base o por un admin.
    const {email, nombre, perfil, institucionId, password, consentimiento} = datos

    const existente = await prisma.usuario.findUnique({where : {email}});
    if (existente){
        throw new Error('EMAIL YA REGISTRADO');
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    return prisma.usuario.create({
        data: {
            email,
            nombre,
            perfil,
            institucionId,
            passwordHash,
            consentimiento,
            fechaConsentimiento: consentimiento ? new Date() : null,
        },
        select: CAMPOS_PUBLICOS,
    });
}

async function verificarCredenciales(email, password){
    const usuario = await prisma.usuario.findUnique({where: {email}});

    if(!usuario) return null;

    // Una cuenta desactivada no debe poder iniciar sesión aunque la clave sea
    // correcta.
    if(!usuario.activo) return null;

    const passwordCorrecto = await bcrypt.compare(password, usuario.passwordHash);

    if(!passwordCorrecto) return null;

    const {passwordHash: _, ...usuarioSinPassword} = usuario;
    return usuarioSinPassword;
}

function obtenerUsuario(id){
    return prisma.usuario.findUnique({
        where: {id},
        select: {...CAMPOS_PUBLICOS, institucion: {select: {id: true, nombre: true}}},
    });
}

function generarToken(usuario){
    // El token lleva rol, perfil e institución porque son los tres datos con
    // los que se deciden los permisos en cada petición.
    const payload = {
        id: usuario.id,
        rol: usuario.rol,
        perfil: usuario.perfil,
        institucionId: usuario.institucionId,
    };

    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    });
}

module.exports ={
    registrarUsuario,
    verificarCredenciales,
    obtenerUsuario,
    generarToken,
};
