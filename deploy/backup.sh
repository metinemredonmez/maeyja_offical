#!/usr/bin/env bash
# MAEYJA günlük yedek (sunucuda root cron'u çalıştırır, bkz. SERVER-SETUP.md → Yedek).
#   veritabanı (pg_dump -Fc) · yüklenen görseller · maeyja.com mail kutuları · .env dosyaları
# /var/backups/maeyja altında, yalnızca root okuyabilir; KEEP günden eskiler silinir.
# Geri yükleme:
#   sudo -u postgres pg_restore --clean --if-exists -d maeyja db-YYYY-MM-DD.dump
#   tar xzf uploads-YYYY-MM-DD.tar.gz -C /var/www/maeyja/backend
# .env yedeği önemlidir: APP_ENCRYPTION_KEY olmadan 2FA sırları ve mail hesabı şifreleri çözülemez.
set -euo pipefail

DIR=/var/backups/maeyja
DAY=$(date +%F)
KEEP=${KEEP:-14}
APP=/var/www/maeyja

mkdir -p "$DIR"
chmod 700 "$DIR"

sudo -u postgres pg_dump -Fc maeyja > "$DIR/db-$DAY.dump"
tar czf "$DIR/uploads-$DAY.tar.gz" -C "$APP/backend" uploads
if [ -d /home/vmail/maeyja.com ]; then
  tar czf "$DIR/mail-$DAY.tar.gz" -C /home/vmail maeyja.com
fi
tar czf "$DIR/env-$DAY.tar.gz" -C "$APP" backend/.env web/.env.local admin/.env.local

chmod 600 "$DIR"/*
find "$DIR" -type f -mtime +"$KEEP" -delete

echo "$(date '+%F %T') yedek tamam — $(ls "$DIR" | wc -l) dosya, toplam $(du -sh "$DIR" | cut -f1)"
