const jwt = require('jsonwebtoken');
const config = require('../config/config');
const logger = require('../utils/logger');
const db = require('../core/db');

/**
 * Middleware para verificar el token JWT y obtener el usuario de la BD.
 */
const protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, config.JWT_SECRET);

            // Buscar el usuario en la base de datos usando el ID del token
            const { rows } = await db.query(
                'SELECT id, username, role FROM users WHERE id = $1',
                [decoded.id]
            );
            const currentUser = rows[0];

            if (!currentUser) {
                return res
                    .status(401)
                    .json({
                        success: false,
                        message: 'No autorizado, usuario no encontrado.',
                    });
            }

            req.user = currentUser; // Adjuntar el usuario de la BD a la petición
            next();
        } catch (error) {
            logger.error('Token de autenticación inválido', {
                error: error.message,
            });
            return res
                .status(401)
                .json({
                    success: false,
                    message: 'No autorizado, token inválido.',
                });
        }
    }

    if (!token) {
        return res
            .status(401)
            .json({
                success: false,
                message: 'No autorizado, no se encontró token.',
            });
    }
};

/**
 * Middleware para restringir el acceso basado en roles.
 * @param  {...string} roles - Los roles permitidos para acceder a la ruta.
 */
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            logger.warn('Intento de acceso no autorizado por rol', {
                userId: req.user ? req.user.id : 'N/A',
                userRole: req.user ? req.user.role : 'N/A',
                requiredRoles: roles,
            });
            return res.status(403).json({
                success: false,
                message: `Acceso denegado. Se requiere uno de los siguientes roles: ${roles.join(', ')}`,
            });
        }
        next();
    };
};

module.exports = { protect, authorize };
