const authService = require('./auth.service');

async function register(req, res, next){
    try{
        const usuario = await authService.registrarUsuario(req.body);
        res.status(201).json(usuario);
    }catch (error){
        if (error.message === 'EMAIL YA REGISTRADO'){
            return res.status(409).json({error: 'Email ya registrado'});
        }
        next(error);
    }
}

async function login(req, res, next){
    try{
        const {email, password} = req.body;
        const usuario = await authService.verificarCredenciales(email, password);

        if(!usuario){
            return res.status(401).json({error: 'credenciales inválidas'});
        }

        const token = authService.generarToken(usuario);
        res.status(200).json({token, usuario});
    }catch(error){
        next(error);
    }
}

module.exports = {register, login};
