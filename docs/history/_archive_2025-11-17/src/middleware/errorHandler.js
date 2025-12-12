const logger = require('../utils/logger');

const errorHandler = (err, req, res) => {
    // Loggear el error con pino
    logger.error(
        {
            message: err.message,
            stack: err.stack,
            path: req.path,
            method: req.method,
        },
        'Error no controlado capturado por el middleware'
    );

    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

    res.status(statusCode).json({
        success: false,
        message:
            process.env.NODE_ENV === 'production'
                ? 'Ha ocurrido un error en el servidor.'
                : err.message,
        // No exponer el stack trace en producción
        stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    });
};

module.exports = errorHandler;
