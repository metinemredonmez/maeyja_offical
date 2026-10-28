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
cd maeyja/backend
cp .env.example .env && nano .env       # DATABASE_URL, JWT_ACCESS_SECRET (openssl rand -base64 48), API_URL=https://api.maeyja.com, SMTP, IYZICO, ONESIGNAL
cd .. && ./deploy/deploy.sh
pm2 save && pm2 startup                  # çıktıdaki komutu çalıştır
```

## 4. nginx + TLS
```bash
cp deploy/nginx-api.conf /etc/nginx/sites-available/api.maeyja.com
ln -s /etc/nginx/sites-available/api.maeyja.com /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d api.maeyja.com
```
DNS: `api.maeyja.com` A kaydı → sunucu IP. (Şu an maeyja.com hosting firmasının "yapım aşamasında" sayfasını gösteriyor, 443 kapalı.)

## 5. Doğrulama
```bash
curl -s https://api.maeyja.com/health
pm2 status
```
Swagger prod'da kapalı; açmak için `.env` → `SWAGGER_ENABLED=true` → `/api/docs`.

## Her deploy
```bash
cd /var/www/maeyja && git pull --ff-only && ./deploy/deploy.sh
```

## Yedek
```bash
# günlük cron: 0 3 * * *
pg_dump -U maeyja maeyja | gzip > /var/backups/maeyja-$(date +%F).sql.gz
tar czf /var/backups/maeyja-uploads-$(date +%F).tgz -C /var/www/maeyja/backend uploads
```
