const jwt = require('jsonwebtoken');
const prisma = require('../db');

async function verificarToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader){
        return res.status(401).json({error: 'No se proporcionó un token de autorización'});
    }

    // Se exige el formato "Bearer <token>". Antes se hacía split(' ')[1] a
    // secas, así que un encabezado sin el prefijo dejaba token = undefined.
    const [esquema, token] = authHeader.split(' ');

    if (esquema !== 'Bearer' || !token){
        return res.status(401).json({error: 'Formato de autorización inválido. Se espera: Bearer <token>'});
    }

    let payload;
    try{
        payload = jwt.verify(token, process.env.JWT_SECRET);
    }catch (error){
        return res.status(401).json({error: 'Token Inválido o Expirado'});
    }

    try{
        // El token es válido hasta una hora. Sin esta comprobación, una cuenta
        // desactivada (o un usuario con el rol ya cambiado) seguiría entrando
        // con el token que obtuvo antes.
        const usuario = await prisma.usuario.findUnique({
            where: {id: payload.id},
            select: {id: true, rol: true, perfil: true, institucionId: true, activo: true},
        });

        if (!usuario || !usuario.activo){
            return res.status(401).json({error: 'La cuenta no está activa'});
        }

        req.usuario = usuario;
        next();
    }catch (error){
        next(error);
    }
}

module.exports = verificarToken;
