/**
 * PM2 Ecosystem Configuration - AgroBridge Backend API
 * Production-ready process management configuration
 * 
 * @see https://pm2.keymetrics.io/docs/usage/application-declaration/
 * @author AgroBridge Engineering Team
 * @version 1.0.0
 */

module.exports = {
  apps: [
    {
      // ─── Application Configuration ────────────────────────────────────────
      name: 'agrobridge-api',
      script: './dist/server.js',
      
      // ─── Process Management ───────────────────────────────────────────────
      instances: 'max',           // Use all available CPU cores
      exec_mode: 'cluster',       // Cluster mode for load balancing
      
      // ─── Environment Variables ────────────────────────────────────────────
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      
      // ─── Logging Configuration ────────────────────────────────────────────
      error_file: '/var/log/agrobridge/error.log',
      out_file: '/var/log/agrobridge/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // ─── Resource Limits ──────────────────────────────────────────────────
      max_memory_restart: '1G',   // Restart if memory exceeds 1GB
      
      // ─── Auto-Restart Configuration ───────────────────────────────────────
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',          // Minimum uptime before restart
      restart_delay: 4000,        // Delay between restarts (4s)
      
      // ─── Advanced Settings ────────────────────────────────────────────────
      watch: false,               // Disable file watching in production
      kill_timeout: 5000,         // Graceful shutdown timeout (5s)
      wait_ready: true,           // Wait for app ready signal
      listen_timeout: 10000,      // Timeout for app to start listening
      
      // ─── Environment-specific settings ────────────────────────────────────
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        LOG_LEVEL: 'info',
      },
      
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 3001,
        LOG_LEVEL: 'debug',
      },
    },
    
    // ─── Notification Worker Process ─────────────────────────────────────────
    {
      name: 'agrobridge-worker',
      script: './dist/infrastructure/notifications/workers/notification-worker.js',
      instances: 2,               // 2 worker processes for notifications
      exec_mode: 'cluster',
      
      env: {
        NODE_ENV: 'production',
        WORKER_TYPE: 'notifications',
      },
      
      error_file: '/var/log/agrobridge/worker-error.log',
      out_file: '/var/log/agrobridge/worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      max_memory_restart: '512M',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      watch: false,
    }
  ],
  
  // ─── Deployment Configuration ──────────────────────────────────────────────
  deploy: {
    production: {
      user: 'deploy',
      host: ['api1.agrobridge.com', 'api2.agrobridge.com'],
      ref: 'origin/main',
      repo: 'git@github.com:AgroBridge-backup/backend.git',
      path: '/var/www/agrobridge-api',
      'post-deploy': 'npm ci && npm run build && pm2 reload ecosystem.config.js --env production && pm2 save',
      'pre-setup': 'echo "Setting up deployment environment..."',
      'post-setup': 'echo "Setup complete!"',
    },
    
    staging: {
      user: 'deploy',
      host: 'staging.agrobridge.com',
      ref: 'origin/develop',
      repo: 'git@github.com:AgroBridge-backup/backend.git',
      path: '/var/www/agrobridge-api-staging',
      'post-deploy': 'npm ci && npm run build && pm2 reload ecosystem.config.js --env staging && pm2 save',
    }
  }
};
