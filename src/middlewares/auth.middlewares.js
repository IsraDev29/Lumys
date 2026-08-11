const jwt = require('jsonwebtoken');

function verificarToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader){
        return res.status(401).json({error: 'No se proporcionó un token de autorización'});
    }

    const token = authHeader.split(' ')[1]; 

    try{
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.usuario = payload;
        next();
    }catch (error){
        return res.status(401).json({error: 'Token Inválido o Expirado'});
    }
}

module.exports = verificarToken;
