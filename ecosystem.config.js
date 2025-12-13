module.exports = {
  apps: [
    {
      name: 'agrobridge-api-staging',
      script: './apps/api/dist/server.js',
      cwd: '/opt/agrobridge-api',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'staging',
        PORT: 4000,
      },
      max_memory_restart: '500M',
      error_file: './logs/pm2-error-staging.log',
      out_file: './logs/pm2-out-staging.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      min_uptime: '10s',
      max_restarts: 10,
      autorestart: true,
      watch: false,

      // Timeouts
      listen_timeout: 10000,
      kill_timeout: 5000,

      // Health monitoring
      instance_var: 'INSTANCE_ID',
    },
    {
      name: 'agrobridge-api-production',
      script: './apps/api/dist/server.js',
      cwd: '/opt/agrobridge-api',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      max_memory_restart: '800M',
      error_file: './logs/pm2-error-prod.log',
      out_file: './logs/pm2-out-prod.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      min_uptime: '30s',
      max_restarts: 5,
      autorestart: true,
      watch: false,

      // Timeouts
      listen_timeout: 10000,
      kill_timeout: 5000,

      // Health monitoring
      instance_var: 'INSTANCE_ID',
    },
  ],
};
