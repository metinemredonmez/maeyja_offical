#!/usr/bin/env bash
# Run ON THE SERVER after `git pull`. Stops at the first failing step; prints DEPLOY OK at the end.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "▶ backend"
cd backend
npm ci --omit=dev --no-audit --no-fund
npx prisma generate
npx prisma migrate deploy
npm run build
npm run db:seed            # idempotent: only fills missing defaults
cd ..

pm2 reload ecosystem.config.js --only maeyja-api --update-env
sleep 2
curl -fsS http://127.0.0.1:4000/health >/dev/null && echo "DEPLOY OK" || { echo "health check FAILED"; pm2 logs maeyja-api --lines 50 --nostream; exit 1; }
