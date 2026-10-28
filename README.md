# MAEYJA

El yapımı deri çanta markası için e-ticaret platformu. Minimalist butik; önce çanta, sonra giyim.

| Klasör | Durum | Teknoloji |
|---|---|---|
| [`backend/`](backend) | ✅ hazır | NestJS 11 + Prisma + PostgreSQL · iyzico · OneSignal · SMTP |
| [`web/`](web) | ✅ hazır | Next.js 16 mağaza · 11 dil · BFF proxy · CSP nonce |
| [`admin/`](admin) | ✅ hazır | Next.js 16 + Tailwind + shadcn yönetim paneli · TOTP MFA |
| `mobile/` | ⏳ tasarım Emre'den | Expo (React Native) |
| [`docs/`](docs) | | Analiz, rakip araştırması, mimari |
| [`deploy/`](deploy) | | pm2 + nginx; Docker yok |

Belgeler: [docs/ANALIZ.md](docs/ANALIZ.md) · [docs/RAKIP-ARASTIRMASI.md](docs/RAKIP-ARASTIRMASI.md) · [docs/GUVENLIK.md](docs/GUVENLIK.md) · [docs/FRONTEND-KURALLARI.md](docs/FRONTEND-KURALLARI.md) · [deploy/SERVER-SETUP.md](deploy/SERVER-SETUP.md)

Komutlar: `make dev` · `make test` · `make ship` (push + sunucuda deploy) · `make status` · `make logs`
