# Sunucu kurulumu (hazal VPS — paylaşımlı, SSH, Docker YOK)

Tek seferlik kurulum. Komutları Emre sunucuda `root` olarak elle çalıştırır (`ssh hazal`).

> **Paylaşımlı sunucu:** aynı makinede `hazal-api/web/admin`, `ogulcanates-web`, `playce-api/worker` pm2 ile çalışıyor.
> Çakışmamak için: pm2 adları `maeyja-*`, loopback portları [ports.env](ports.env) (API **4100**, web **3101**, admin **3100**),
> nginx zone/map adları `mj_` önekli, ayrı PostgreSQL kullanıcısı/veritabanı. Diğer projelere dokunulmaz.

## 0. Önce kontrol (çıktıyı Claude'a yapıştır)
```bash
node -v; npm -v; pm2 -v; nginx -v; psql --version; certbot --version
ss -tlnp | grep -E ':(4100|3100|3101)\b' || echo "portlar serbest"
ls /etc/nginx/sites-enabled/
grep -rhoE 'zone=[a-z_]+|map \$http_upgrade \$[a-z_]+' /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null | sort -u
sudo -u postgres psql -Atc "select datname from pg_database where not datistemplate"
```
Portlardan biri doluysa `deploy/ports.env` + `deploy/nginx-maeyja.conf` içindeki numarayı değiştir (ikisi aynı olmalı).

## 1. Sistem paketleri (yalnızca eksik olanlar)
Node 20+, pm2, nginx, PostgreSQL ve certbot büyük ihtimalle diğer projelerden dolayı kurulu. Eksikse:
```bash
apt update && apt install -y nginx postgresql postgresql-contrib certbot python3-certbot-nginx git build-essential
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt install -y nodejs
npm i -g pm2
mkdir -p /var/log/pm2
```

## 2. PostgreSQL (ayrı kullanıcı + veritabanı)
```bash
sudo -u postgres psql -c "CREATE USER maeyja WITH PASSWORD '<güçlü-şifre>';"
sudo -u postgres psql -c "CREATE DATABASE maeyja OWNER maeyja;"
```

## 3. Kod + .env + ilk deploy
```bash
mkdir -p /var/www && cd /var/www
git clone https://github.com/metinemredonmez/maeyja_offical maeyja
cd maeyja
cp backend/.env.example backend/.env && nano backend/.env
cp web/.env.example web/.env.local && nano web/.env.local
cp admin/.env.example admin/.env.local && nano admin/.env.local
```
`backend/.env` — prod'da mutlaka:
```
NODE_ENV=production
PORT=4100                      # pm2 zaten ports.env'den verir; aynı tut
LISTEN_HOST=127.0.0.1
TRUST_PROXY=1
API_URL=https://api.maeyja.com
WEB_URL=https://maeyja.com
ADMIN_URL=https://admin.maeyja.com
CORS_ORIGINS=https://maeyja.com,https://admin.maeyja.com
DATABASE_URL=postgresql://maeyja:<şifre>@localhost:5432/maeyja?schema=public
JWT_ACCESS_SECRET=<openssl rand -base64 48>
APP_ENCRYPTION_KEY=<openssl rand -base64 32>
MFA_REQUIRED_FOR_STAFF=true
UPLOAD_DIR=./uploads
UPLOAD_PUBLIC_URL=https://api.maeyja.com/uploads
SWAGGER_ENABLED=false
SEED_ADMIN_EMAIL=<admin e-postan>
SEED_ADMIN_PASSWORD=<≥15 karakter>   # ilk girişten sonra bu iki satırı SİL
# SMTP_*, IYZICO_*, ONESIGNAL_* — eldekileri gir; boş kalanlar ilgili özelliği kapatır
```
`web/.env.local`:
```
API_URL=http://127.0.0.1:4100/api
NEXT_PUBLIC_SITE_URL=https://maeyja.com
IMAGE_HOSTS=api.maeyja.com
```
`admin/.env.local`:
```
API_URL=http://127.0.0.1:4100/api
NEXT_PUBLIC_SITE_URL=https://admin.maeyja.com
```
Sonra:
```bash
./deploy/deploy.sh          # npm ci + prisma migrate + build + pm2 start/reload + health check (5-10 dk)
pm2 save                    # pm2 startup zaten diğer projeler için kurulu; değilse: pm2 startup → çıktıdaki komutu çalıştır
pm2 list                    # maeyja-api / maeyja-web / maeyja-admin "online" olmalı
```

## 4. nginx + TLS
DNS A kayıtları (sunucu IP'si) önce: `maeyja.com`, `www`, `admin`, `api`. (Şu an maeyja.com hosting firmasının "yapım aşamasında"
sayfasını gösteriyor; DNS taşınınca eski hosting kapatılır.)
```bash
cp deploy/nginx-maeyja.conf /etc/nginx/sites-available/maeyja
ln -s /etc/nginx/sites-available/maeyja /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx          # nginx -t hata verirse reload ETME; çıktıyı Claude'a yapıştır
certbot --nginx -d maeyja.com -d www.maeyja.com -d admin.maeyja.com -d api.maeyja.com
```
`sites-enabled/default`'u SİLME (diğer siteler kullanıyor olabilir). Sertifika sonrası `nginx-maeyja.conf` başındaki TLS snippet'ini
`/etc/nginx/snippets/maeyja-tls.conf` olarak kaydedip maeyja'nın her 443 bloğuna `include` et (HSTS dahil). Yenileme certbot'un
systemd timer'ı ile otomatik; `certbot renew --dry-run` ile doğrula.

## 5. Doğrulama
```bash
curl -s https://api.maeyja.com/health
curl -sI https://maeyja.com | grep -i -E "strict-transport|content-security"
curl -sI https://admin.maeyja.com | head -3
pm2 status
```
Sonra tarayıcıda `admin.maeyja.com` → seed admin ile gir → profil → **MFA kur** (zorunlu) → `backend/.env`'den `SEED_ADMIN_*` satırlarını sil → `pm2 reload maeyja-api`.

Güvenlik sıkılaştırma (ufw, fail2ban, SSH, otomatik güncelleme, yedek): [../docs/GUVENLIK.md](../docs/GUVENLIK.md) bölüm 4 — sunucu
paylaşımlı olduğu için ufw kuralı eklerken diğer sitelerin portlarını (80/443/22) kapatmamaya dikkat.

## Her deploy
Mac'ten tek komut (commit'li her şeyi push eder, sunucuda `git pull` + build + pm2 reload):
```bash
make ship            # hepsi
make ship T=backend  # sadece API (T=web, T=admin)
```
`~/.ssh/config`'te sunucu adı `hazal` değilse: `make ship SSH_HOST=<ad>`. Sunucunun kendisinde: `make server-deploy`.
Loglar: `make logs` · durum: `make status`.

## Yedek
```bash
# günlük cron: 0 3 * * *
pg_dump -U maeyja maeyja | gzip > /var/backups/maeyja-$(date +%F).sql.gz
tar czf /var/backups/maeyja-uploads-$(date +%F).tgz -C /var/www/maeyja/backend uploads
```
