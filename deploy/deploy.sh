#!/usr/bin/env bash
# Sunucuda çalışır (Docker yok, pm2). Kullanım:
#   ./deploy/deploy.sh            # hepsi (backend + web + admin — var olanlar)
#   ./deploy/deploy.sh backend    # sadece API
#   ./deploy/deploy.sh web admin  # birden fazla hedef
# İlk hata adımında durur; sonda "DEPLOY OK" görmüyorsan çıktıya bak.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# Loopback portları (paylaşımlı sunucu): tek kaynak deploy/ports.env — ecosystem.config.js de aynı dosyayı okur.
. "$ROOT/deploy/ports.env"
: "${API_PORT:=4100}" "${WEB_PORT:=3101}" "${ADMIN_PORT:=3100}"

TARGETS=("$@")
[ ${#TARGETS[@]} -eq 0 ] && TARGETS=(backend web admin)

# Uygulamanın açılmasını bekle (Nest/Next ilk açılışta 3-15 sn sürebilir); 45 sn içinde cevap yoksa hata.
wait_http() {               # $1 = url
  for _ in $(seq 1 45); do
    curl -fsS -o /dev/null "$1" 2>/dev/null && return 0
    sleep 1
  done
  return 1
}

deploy_backend() {
  echo "▶ backend"
  cd "$ROOT/backend"
  npm ci --no-audit --no-fund   # devDeps dahil: nest build / prisma / ts-node (seed) için gerekli
  npx prisma generate
  npx prisma migrate deploy
  npm run build
  npm run db:seed            # idempotent: yalnızca eksik varsayılanları doldurur
  cd "$ROOT"
  pm2 reload ecosystem.config.js --only maeyja-api --update-env
  wait_http "http://127.0.0.1:${API_PORT}/health" || { echo "✗ API 45 sn içinde açılmadı (:${API_PORT})"; pm2 logs maeyja-api --lines 50 --nostream; exit 1; }
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
  wait_http "http://127.0.0.1:$3/" || { echo "✗ $1 45 sn içinde açılmadı (:$3)"; pm2 logs "$2" --lines 50 --nostream; exit 1; }
  echo "✓ $1"
}

for t in "${TARGETS[@]}"; do
  case "$t" in
    backend|api) deploy_backend ;;
    web)         deploy_next web   maeyja-web   "$WEB_PORT" ;;
    admin)       deploy_next admin maeyja-admin "$ADMIN_PORT" ;;
    all)         deploy_backend; deploy_next web maeyja-web "$WEB_PORT"; deploy_next admin maeyja-admin "$ADMIN_PORT" ;;
    *)           echo "Bilinmeyen hedef: $t (backend|web|admin|all)"; exit 1 ;;
  esac
done

pm2 save >/dev/null
echo "DEPLOY OK — $(git log -1 --format='%h %s')"
