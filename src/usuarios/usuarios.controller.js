const usuariosService = require('./usuarios.service');

async function listar(req, res, next){
    try{
        res.status(200).json(await usuariosService.listarUsuarios());
    }catch(error){
        next(error);
    }
}

async function listarEstudiantes(req, res, next){
    try{
        res.status(200).json(await usuariosService.listarEstudiantesVisibles(req.usuario));
    }catch(error){
        next(error);
    }
}

async function checkinsDeEstudiante(req, res, next){
    try{
        // El acceso ya lo validó verificarAccesoAEstudiante.
        res.status(200).json(await usuariosService.listarCheckinsDeEstudiante(Number(req.params.id)));
    }catch(error){
        next(error);
    }
}

async function cambiarRol(req, res, next){
    try{
        const id = Number(req.params.id);

        // Sin esto, un admin puede quitarse su propio rol y dejar la
        // plataforma sin administradores.
        if (id === req.usuario.id){
            return res.status(409).json({error: 'No puedes cambiar tu propio rol'});
        }

        res.status(200).json(await usuariosService.cambiarRol(id, req.body));
    }catch(error){
        if (error.code === 'P2025'){
            return res.status(404).json({error: 'Usuario no encontrado'});
        }
        next(error);
    }
}

async function cambiarEstado(req, res, next){
    try{
        const id = Number(req.params.id);

        if (id === req.usuario.id){
            return res.status(409).json({error: 'No puedes desactivar tu propia cuenta'});
        }

        res.status(200).json(await usuariosService.cambiarEstado(id, req.body.activo));
    }catch(error){
        if (error.code === 'P2025'){
            return res.status(404).json({error: 'Usuario no encontrado'});
        }
        next(error);
    }
}

module.exports = {listar, listarEstudiantes, checkinsDeEstudiante, cambiarRol, cambiarEstado};
