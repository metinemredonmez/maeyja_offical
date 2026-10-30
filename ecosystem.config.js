/**
 * pm2 process list for the production server (no Docker, shared box → unique names + ports).
 *   pm2 start ecosystem.config.js            # first time
 *   pm2 reload ecosystem.config.js --only maeyja-api
 *   pm2 save && pm2 startup                  # survive reboots
 * Ports come from deploy/ports.env (single source, also read by deploy.sh). The API's PORT is
 * injected here and wins over backend/.env (dotenv never overrides an existing process.env value).
 * Secrets live in each app's own .env — nothing secret lives here.
 */
const fs = require('fs');
const path = require('path');

const ports = { API_PORT: 4100, WEB_PORT: 3101, ADMIN_PORT: 3100 };
try {
  for (const line of fs.readFileSync(path.join(__dirname, 'deploy/ports.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*(API_PORT|WEB_PORT|ADMIN_PORT)\s*=\s*(\d+)/);
    if (m) ports[m[1]] = Number(m[2]);
  }
} catch {
  /* defaults above */
}

/**
 * Next 16 builds the middleware URL as `<proto>://localhost:<port>` but compares rewrites against
 * `<proto>://<-H value>:<port>`. With `-H 127.0.0.1` behind nginx (X-Forwarded-Proto: https) every
 * next-intl rewrite (`/` → `/tr`) looks external and is proxied to https://localhost → 500.
 * So bind as `localhost`, and force IPv4 resolution so it still listens on 127.0.0.1 only.
 */
const NEXT_ENV = { NODE_ENV: 'production', NODE_OPTIONS: '--dns-result-order=ipv4first' };

/** deploy.sh builds into .next-a / .next-b beside the running build and records the live one in <app>/.next-slot. */
const distDir = (app) => {
  try {
    return fs.readFileSync(path.join(__dirname, app, '.next-slot'), 'utf8').trim() || '.next';
  } catch {
    return '.next';
  }
};

module.exports = {
  apps: [
    {
      name: 'maeyja-api',
      cwd: './backend',
      script: 'dist/main.js',
      exec_mode: 'fork', // cron jobs live in-process; keep a single instance
      instances: 1,
      env: { NODE_ENV: 'production', PORT: String(ports.API_PORT), LISTEN_HOST: '127.0.0.1' },
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
      args: `start -H localhost -p ${ports.WEB_PORT}`,
      env: { ...NEXT_ENV, NEXT_DIST_DIR: distDir('web') },
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
      args: `start -H localhost -p ${ports.ADMIN_PORT}`,
      env: { ...NEXT_ENV, NEXT_DIST_DIR: distDir('admin') },
      max_memory_restart: '500M',
      out_file: '/var/log/pm2/maeyja-admin.out.log',
      error_file: '/var/log/pm2/maeyja-admin.err.log',
      merge_logs: true,
      time: true,
    },
  ],
};
