# MAEYJA — tek komutla geliştirme ve deploy.
#   make dev              yerelde API (web/admin eklendikçe onlar da)
#   make test             backend typecheck + jest
#   make ship             commit edilmiş her şeyi push et + sunucuda hepsini deploy et
#   make ship T=backend   yalnızca API (T=web, T=admin, T="web admin")
#   make server-deploy    sunucunun kendisinde çalıştırılır (git pull + deploy)
#   make logs             sunucudaki pm2 loglarını izle
#
# SSH_HOST = ~/.ssh/config'teki sunucu adı (varsayılan: hazal). REMOTE_DIR = sunucudaki klasör.

SSH_HOST   ?= hazal
REMOTE_DIR ?= /var/www/maeyja
T          ?= all
BRANCH     := $(shell git rev-parse --abbrev-ref HEAD)

.PHONY: dev dev-backend dev-web dev-admin test ship push server-deploy logs status setup

## ─── yerel ───
dev: dev-backend

dev-backend:
	cd backend && npm run start:dev

dev-web:
	@test -d web || { echo "web/ henüz yok"; exit 1; }
	cd web && npm run dev

dev-admin:
	@test -d admin || { echo "admin/ henüz yok"; exit 1; }
	cd admin && npm run dev

test:
	cd backend && npm run typecheck && npm test

setup:  ## ilk kurulum (yerel)
	cd backend && npm install && cp -n .env.example .env || true
	cd backend && npx prisma migrate dev && npm run db:seed

## ─── deploy ───
push:
	@git diff --quiet && git diff --cached --quiet || { echo "✗ Commit edilmemiş değişiklik var. Önce commit et."; exit 1; }
	git push origin $(BRANCH)

ship: push  ## push + sunucuda deploy
	ssh $(SSH_HOST) 'cd $(REMOTE_DIR) && git pull --ff-only && ./deploy/deploy.sh $(T)'

server-deploy:  ## sunucuda: git pull + deploy
	git pull --ff-only && ./deploy/deploy.sh $(T)

logs:
	ssh -t $(SSH_HOST) 'pm2 logs --lines 100'

status:
	ssh $(SSH_HOST) 'cd $(REMOTE_DIR) && . deploy/ports.env && pm2 status && curl -s http://127.0.0.1:$$API_PORT/health && echo'
