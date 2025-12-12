// Archivo de configuración para node-pg-migrate
module.exports = {
    databaseUrl: `postgres://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
    dir: 'migrations',
    migrationsTable: 'pgmigrations',
    direction: 'up',
    count: Infinity,
};
