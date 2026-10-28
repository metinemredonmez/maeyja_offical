# MAEYJA Web (mağaza)

Next.js 16 · React 19 · Tailwind v4 · next-intl (11 dil) · TanStack Query. Port 3001.

```bash
cp .env.example .env.local     # API_URL, NEXT_PUBLIC_SITE_URL, IMAGE_HOSTS
npm install
npm run dev                    # http://localhost:3001  (API 4000'de çalışmalı)
npm run build && npm start     # prod (next build --webpack)
```

## Yapı
- `app/[locale]/…` — sayfalar. `/` Türkçe, `/en`, `/ja` … (`localePrefix: as-needed`).
- `app/api/[...path]/route.ts` — **BFF proxy**: tarayıcı yalnızca `/api/*`'ye konuşur; access/refresh/cart token'ları `httpOnly` cookie'de (`mj_at`, `mj_rt`, `mj_cart`). 401'de bir kez refresh dener; login/register'da misafir sepetini hesaba birleştirir.
- `proxy.ts` — next-intl yönlendirme + `/account/*` koruması + istek başına **CSP nonce**.
- `lib/api.server.ts` (RSC, cache'li katalog) · `lib/api.client.ts` (client, `/api`) · `lib/types.ts` (API şekilleri).
- `components/` — header/footer, cart drawer (`cart/`), ürün (`product/`), checkout, hesap, ana sayfa bölümleri (`home/sections.tsx` → admin'deki HomeSection tipleri).
- `messages/<lang>.json` — arayüz metinleri (tr kaynak; 10 çeviri).

## Sayfalar
Ana sayfa · `/products` (filtre: renk/beden/sıralama) · `/products/[slug]` (galeri + sticky kutu, renk→galeri, stok bildirimi, JSON-LD) · `/collections/[slug]` · `/cart` · `/checkout` (misafir, kayıtlı adres, fatura, iyzico/havale, sözleşme onayı) · `/checkout/result` · `/order-status` (misafir sorgu + iade talebi) · `/journal`, `/journal/[slug]` · `/faq` · `/stockists` · `/contact` · CMS sayfaları `/[slug]` (about, care, kvkk, privacy, terms, shipping-returns, distance-sales-agreement, preliminary-information) · hesap: login/register/forgot/reset/verify-email, profil, siparişler, adresler, favoriler · `sitemap.xml`, `robots.txt`.

## Güvenlik
CSP (nonce + strict-dynamic, iyzico frame/form izinli), X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, COOP; token'lar JS'e kapalı; open-redirect koruması (`next` yalnızca site içi yol); CMS HTML `sanitize-html` ile temizlenir; iletişim formunda honeypot. HSTS nginx'te.
