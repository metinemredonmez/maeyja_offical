/**
 * pm2 process list for the production server (no Docker).
 *   pm2 start ecosystem.config.js            # first time
 *   pm2 reload ecosystem.config.js --only maeyja-api
 *   pm2 save && pm2 startup                  # survive reboots
 * Env files are read from each app's own .env — nothing secret lives here.
 */
module.exports = {
  apps: [
    {
      name: 'maeyja-api',
      cwd: './backend',
      script: 'dist/main.js',
      exec_mode: 'fork', // cron jobs live in-process; keep a single instance
      instances: 1,
      env: { NODE_ENV: 'production' },
      max_memory_restart: '400M',
      out_file: '/var/log/pm2/maeyja-api.out.log',
      error_file: '/var/log/pm2/maeyja-api.err.log',
      merge_logs: true,
      time: true,
    },
    {
      name: 'maeyja-web',
      cwd: './web',
      script: 'node_modules/.bin/next',
      args: 'start -H 127.0.0.1 -p 3001',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '500M',
      out_file: '/var/log/pm2/maeyja-web.out.log',
      error_file: '/var/log/pm2/maeyja-web.err.log',
      merge_logs: true,
      time: true,
    },
    {
      name: 'maeyja-admin',
      cwd: './admin',
      script: 'node_modules/.bin/next',
      args: 'start -H 127.0.0.1 -p 3000',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '500M',
      out_file: '/var/log/pm2/maeyja-admin.out.log',
      error_file: '/var/log/pm2/maeyja-admin.err.log',
      merge_logs: true,
      time: true,
    },
  ],
};
