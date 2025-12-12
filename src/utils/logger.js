import pino from 'pino';

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    // En desarrollo, usamos pino-pretty para un formato legible.
    // En producción, se registrará en formato JSON para ser consumido por servicios de logging.
    transport:
        process.env.NODE_ENV !== 'production'
            ? {
                  target: 'pino-pretty',
                  options: {
                      colorize: true,
                      translateTime: 'SYS:dd-mm-yyyy HH:MM:ss',
                      ignore: 'pid,hostname',
                  },
              }
            : undefined,
});

export default logger;
