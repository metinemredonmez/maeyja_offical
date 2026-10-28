#!/usr/bin/env bash
# Sunucuda çalışır (Docker yok, pm2). Kullanım:
#   ./deploy/deploy.sh            # hepsi (backend + web + admin — var olanlar)
#   ./deploy/deploy.sh backend    # sadece API
#   ./deploy/deploy.sh web admin  # birden fazla hedef
# İlk hata adımında durur; sonda "DEPLOY OK" görmüyorsan çıktıya bak.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TARGETS=("$@")
[ ${#TARGETS[@]} -eq 0 ] && TARGETS=(backend web admin)

deploy_backend() {
  echo "▶ backend"
  cd "$ROOT/backend"
  npm ci --omit=dev --no-audit --no-fund
  npx prisma generate
  npx prisma migrate deploy
  npm run build
  npm run db:seed            # idempotent: yalnızca eksik varsayılanları doldurur
  cd "$ROOT"
  pm2 reload ecosystem.config.js --only maeyja-api --update-env
  sleep 2
  curl -fsS http://127.0.0.1:4000/health >/dev/null || { echo "✗ API health check başarısız"; pm2 logs maeyja-api --lines 50 --nostream; exit 1; }
  echo "✓ backend"
}

deploy_next() {               # $1 = klasör (web|admin), $2 = pm2 adı, $3 = port
  if [ ! -f "$ROOT/$1/package.json" ]; then echo "– $1 henüz yok, atlandı"; return; fi
  echo "▶ $1"
  cd "$ROOT/$1"
  npm ci --no-audit --no-fund
  rm -rf .next                # yarım kalan build'den 500 almamak için temiz build
  npm run build
  cd "$ROOT"
  pm2 reload ecosystem.config.js --only "$2" --update-env
  sleep 2
  curl -fsS -o /dev/null "http://127.0.0.1:$3/" || { echo "✗ $1 açılmadı"; pm2 logs "$2" --lines 50 --nostream; exit 1; }
  echo "✓ $1"
}

for t in "${TARGETS[@]}"; do
  case "$t" in
    backend|api) deploy_backend ;;
    web)         deploy_next web   maeyja-web   3001 ;;
    admin)       deploy_next admin maeyja-admin 3000 ;;
    all)         deploy_backend; deploy_next web maeyja-web 3001; deploy_next admin maeyja-admin 3000 ;;
    *)           echo "Bilinmeyen hedef: $t (backend|web|admin|all)"; exit 1 ;;
  esac
done

pm2 save >/dev/null
echo "DEPLOY OK — $(git log -1 --format='%h %s')"
