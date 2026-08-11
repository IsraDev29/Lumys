const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const {PrismaClient} = require('@prisma/client')
const {PrismaPg} = require('@prisma/adapter-pg')

// Prisma 7 ya no acepta `url` en el datasource: la conexión se pasa al cliente
// mediante un driver adapter.
const adapter = new PrismaPg({connectionString: process.env.DATABASE_URL})
const prisma = new PrismaClient({adapter})

const SALT_ROUNDS = 10

// La tabla `usuarios` real guarda el identificador de login en `contacto` y el
// tipo de usuario en `perfil`. La API pública sigue hablando de `email` y
// `tipoUsuario`, así que la traducción vive aquí.
function aRespuestaPublica(usuario){
    const {passwordHash: _, contacto, perfil, ...resto} = usuario;
    return {...resto, email: contacto, tipoUsuario: perfil};
}

async function registrarUsuario(datos){
    const {email, nombre, tipoUsuario, institucionId, password, rol} = datos

    const existente = await prisma.usuario.findUnique({where : {contacto: email}});
    if (existente){
        throw new Error('EMAIL YA REGISTRADO');
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const usuario = await prisma.usuario.create({
        data: {
            contacto: email,
            nombre,
            perfil: tipoUsuario,
            institucionId,
            passwordHash,
            rol: rol || 'USUARIO'
        }
    })

    return aRespuestaPublica(usuario);
}

async function verificarCredenciales(email, password){
    const usuario = await prisma.usuario.findUnique({where: {contacto: email}});

    if(!usuario) return null;

    const passwordCorrecto = await bcrypt.compare(password, usuario.passwordHash);

    if(!passwordCorrecto) return null;

    return aRespuestaPublica(usuario);
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
