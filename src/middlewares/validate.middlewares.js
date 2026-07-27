function validate(schema) {
    return (req, res, next) => {
        const resultado = schema.safeParse(req.body);

        if (!resultado.success){
            return res.status(400).json({
                error: 'Datos inválidos',
                detalles: resultado.error.flatten().fieldErrors,
            });
        }

        req.body = resultado.data;
        next();
    }; 
}

module.exports = validate;
