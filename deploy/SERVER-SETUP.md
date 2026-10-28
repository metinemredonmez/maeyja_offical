# Sunucu kurulumu (hazal sunucusu, SSH, Docker YOK)

Tek seferlik kurulum. Komutları Emre sunucuda elle çalıştırır.

## 1. Sistem paketleri
```bash
apt update && apt install -y nginx postgresql postgresql-contrib certbot python3-certbot-nginx git build-essential
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt install -y nodejs
npm i -g pm2
mkdir -p /var/log/pm2
```

## 2. PostgreSQL
```bash
sudo -u postgres psql -c "CREATE USER maeyja WITH PASSWORD '<güçlü-şifre>';"
sudo -u postgres psql -c "CREATE DATABASE maeyja OWNER maeyja;"
```

## 3. Kod
```bash
mkdir -p /var/www && cd /var/www
git clone https://github.com/metinemredonmez/maeyja_offical maeyja
cd maeyja
cp backend/.env.example backend/.env && nano backend/.env   # DATABASE_URL, JWT_ACCESS_SECRET (openssl rand -base64 48), API_URL=https://api.maeyja.com, WEB_URL, ADMIN_URL, CORS_ORIGINS, UPLOAD_PUBLIC_URL=https://api.maeyja.com/uploads, SMTP, IYZICO, ONESIGNAL, SWAGGER_ENABLED=false
cp web/.env.example web/.env.local && nano web/.env.local     # API_URL=http://127.0.0.1:4000/api, NEXT_PUBLIC_SITE_URL=https://maeyja.com, IMAGE_HOSTS=api.maeyja.com
cp admin/.env.example admin/.env.local && nano admin/.env.local # API_URL=http://127.0.0.1:4000/api, NEXT_PUBLIC_SITE_URL=https://admin.maeyja.com
./deploy/deploy.sh
pm2 save && pm2 startup                  # çıktıdaki komutu çalıştır
```

## 4. nginx + TLS
```bash
cp deploy/nginx-maeyja.conf /etc/nginx/sites-available/maeyja
ln -s /etc/nginx/sites-available/maeyja /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
certbot --nginx -d maeyja.com -d www.maeyja.com -d admin.maeyja.com -d api.maeyja.com
```
DNS A kayıtları → sunucu IP: `maeyja.com`, `www`, `admin`, `api`. (Şu an maeyja.com hosting firmasının "yapım aşamasında" sayfasını gösteriyor; DNS taşınınca eski hosting kapatılır.)
Sertifika sonrası `nginx-maeyja.conf` başındaki TLS snippet'ini `/etc/nginx/snippets/maeyja-tls.conf` olarak kaydedip her 443 bloğuna `include` et (HSTS dahil). Sertifika yenileme certbot'un systemd timer'ı ile otomatik; `certbot renew --dry-run` ile doğrula.

## 5. Doğrulama
```bash
curl -s https://api.maeyja.com/health
curl -sI https://maeyja.com | grep -i -E "strict-transport|content-security"
pm2 status
```
Güvenlik sıkılaştırma adımları (ufw, fail2ban, SSH, otomatik güncelleme, yedek): [../docs/GUVENLIK.md](../docs/GUVENLIK.md).
Swagger prod'da kapalı; açmak için `.env` → `SWAGGER_ENABLED=true` → `/api/docs`.

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
