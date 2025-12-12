require('dotenv').config();

/**
 * @fileoverview Archivo central de configuración.
 * Carga variables de entorno y proporciona valores predeterminados seguros.
 */

const config = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: process.env.PORT || 3000,

    // Configuración de JWT
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1h',

    // Configuración de la base de datos (marcador de posición)
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_USER: process.env.DB_USER || 'agro_user',
    DB_PASS: process.env.DB_PASS || 'secret',
    DB_NAME: process.env.DB_NAME || 'agrobridge',

    // CORS Whitelist
    CORS_WHITELIST: process.env.CORS_WHITELIST || 'http://localhost:3000',
};

const requiredInProd = ['JWT_SECRET', 'DB_PASS'];

if (config.NODE_ENV === 'production') {
    requiredInProd.forEach((secret) => {
        if (!config[secret]) {
            console.error(
                `[FATAL ERROR] Secreto requerido '${secret}' no está definido en el entorno de producción.`
            );
            process.exit(1);
        }
    });
}

module.exports = config;
