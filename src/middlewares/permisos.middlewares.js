function verificarRol(...rolesPermitidos) {
    return(req, res, next) => {
        const { rol } = req.usuario;

        if (!rolesPermitidos.includes(rol)){
            return res.status(403).json({
                error: ('No tienes permisos para acceder a este recurso'),
            });
        }
        next();
    }
}

module.exports = verificarRol;
