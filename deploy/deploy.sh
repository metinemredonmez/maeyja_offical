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

# pm2 `reload` args/env değişikliklerini uygulamaz; fork modunda zaten restart demek → sil + baştan başlat.
# Yalnızca maeyja-* süreçlerine dokunur (sunucudaki diğer projeler etkilenmez).
pm2_restart() {             # $1 = pm2 adı
  pm2 delete "$1" >/dev/null 2>&1 || true
  pm2 start ecosystem.config.js --only "$1"
}

# Uygulamanın açılmasını bekle (Nest/Next ilk açılışta 3-15 sn sürebilir); 45 sn içinde cevap yoksa hata.
wait_http() {               # $1 = url
  for _ in $(seq 1 45); do
    curl -fsS -o /dev/null "$1" 2>/dev/null && return 0
    sleep 1
  done
  return 1
}

# package-lock.json değişmediyse node_modules'a dokunma: hem hızlı, hem çalışan uygulamanın modülleri silinmez.
npm_ci_if_changed() {
  local sum
  sum="$(sha256sum package-lock.json | cut -d' ' -f1)"
  if [ -d node_modules ] && [ "$(cat node_modules/.mj-lock 2>/dev/null)" = "$sum" ]; then
    echo "  bağımlılıklar değişmemiş, npm ci atlandı"
    return
  fi
  npm ci --no-audit --no-fund
  echo "$sum" > node_modules/.mj-lock
}

deploy_backend() {
  echo "▶ backend"
  cd "$ROOT/backend"
  npm_ci_if_changed           # devDeps dahil: nest build / prisma / ts-node (seed) için gerekli
  npx prisma generate
  npx prisma migrate deploy
  npm run build
  npm run db:seed            # idempotent: yalnızca eksik varsayılanları doldurur
  npm run db:seed:catalog    # idempotent: eksik ürün/ana sayfa görselleri ve yeni ana sayfa bölümleri (bir kez)
  cd "$ROOT"
  pm2_restart maeyja-api
  wait_http "http://127.0.0.1:${API_PORT}/health" || { echo "✗ API 45 sn içinde açılmadı (:${API_PORT})"; pm2 logs maeyja-api --lines 50 --nostream; exit 1; }
  echo "✓ backend"
}

# Yeni sürüm, çalışan sürümün yanındaki boş klasöre (.next-a / .next-b) derlenir; site build boyunca açık kalır ve
# yalnızca sondaki yeniden başlatmada 1-2 sn kesilir. Açılmazsa eski klasöre geri döner (eskisi ancak başarıdan sonra silinir).
deploy_next() {               # $1 = klasör (web|admin), $2 = pm2 adı, $3 = port
  if [ ! -f "$ROOT/$1/package.json" ]; then echo "– $1 henüz yok, atlandı"; return; fi
  echo "▶ $1"
  cd "$ROOT/$1"
  npm_ci_if_changed
  local old new
  old="$(cat .next-slot 2>/dev/null || echo .next)"
  if [ "$old" = .next-a ]; then new=.next-b; else new=.next-a; fi
  rm -rf "$new"
  NEXT_DIST_DIR="$new" npm run build
  echo "$new" > .next-slot
  cd "$ROOT"
  pm2_restart "$2"
  if ! wait_http "http://127.0.0.1:$3/"; then
    echo "✗ $1 45 sn içinde açılmadı (:$3) — önceki sürüme dönülüyor"
    pm2 logs "$2" --lines 50 --nostream
    echo "$old" > "$ROOT/$1/.next-slot"
    pm2_restart "$2"
    exit 1
  fi
  rm -rf "${ROOT:?}/$1/$old"
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
