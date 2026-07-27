const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const {PrismaClient} = require('../generated/prisma')

const prisma = new PrismaClient()

const SALT_ROUNDS = 10

async function registarUsiario(datos){
    const {email, edad, tipoUsuario, centroId, consentimiento, comunidadId, password, rol} = datos

    const existente = await prisma.usuario.findUnique({where : {email}});
    if (existente){
        throw new Error('EMAIL YA REGISTRADO');
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const usuario = await prisma.usuario.create({
        data: {
            email,
            edad,
            tipoUsuario,
            centroId,
            consentimiento,
            comunidadId,
            passwordHash,
            rol: rol || 'USUARIO'
        }
    })

    const {passwordHash: _, ...usuarioSinPassword} = usuario;
    return usuarioSinPassword;
}

async function VerificarCredenciales(email, password){
    const usuario = await prisma.usuario.findUnique({where: {email}});
    
    if(!usuario) return null;

    const passwordCorrecto = await bcrypt.compare(password, usuario.passwordHash);

    if(!passwordCorrecto) return null;

    const {passwordHash: _, ...usuarioSinPassword} = usuario;
    return usuarioSinPassword;
}

function generarToken(usuario){
    const payload = {
        id: usuario.id,
        rol: usuario.rol,
        tipoUsuario: usuario.tipoUsuario,
    };

    return jwt.sign(payload, process.env.JWT_SECRET, {expiresIn: '1h'});
}

module.exports ={
    registrarUsuario,
    verificarCredenciales,
    generarToken,
};
