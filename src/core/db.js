import pkg from 'pg';
import config from '../config/config.js';
import logger from '../utils/logger.js';

const { Pool } = pkg;

const pool = new Pool({
    user: config.DB_USER,
    host: config.DB_HOST,
    database: config.DB_NAME,
    password: config.DB_PASS,
    port: config.DB_PORT || 5432,
    max: 20, // Máximo de clientes en el pool
    idleTimeoutMillis: 30000, // Tiempo de espera antes de cerrar un cliente inactivo
    connectionTimeoutMillis: 2000, // Tiempo de espera para obtener una conexión
});

pool.on('connect', () => {
    logger.info('Nuevo cliente conectado a la base de datos PostgreSQL');
});

pool.on('error', (err) => {
    logger.error('Error inesperado en cliente de base de datos', {
        error: err.stack,
    });
    process.exit(-1);
});

// Exporta funciones con sintaxis ESModule
const db = {
    query: (text, params) => pool.query(text, params),
    getClient: () => pool.connect(),
};

export default db;
