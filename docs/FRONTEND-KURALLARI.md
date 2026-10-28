# Frontend kuralları (web + admin)

İki Next.js 16 uygulaması aynı kalıpları kullanır; bu dosya ortak sözleşmedir.

## Stack
- Next.js 16 (App Router, `proxy.ts` middleware), React 19, TypeScript strict, Tailwind v4 (`@theme` in `app/globals.css`, `tailwind.config` YOK).
- Build: `next build --webpack` (Turbopack route-group manifest sorununa karşı; pure'da yaşandı). Prod: `next start -p 3001` (web) / `-p 3000` (admin).
- Paketler: `next-intl` (web), `@tanstack/react-query`, `react-hook-form` + `zod`, `lucide-react`, `sonner`, `clsx` + `tailwind-merge`.

## API erişimi — BFF proxy, token tarayıcı JS'ine asla inmez
- Tarayıcı **yalnızca** kendi origin'ine konuşur: `/api/*`. `app/api/[...path]/route.ts` isteği `API_URL` (örn. `http://127.0.0.1:4000/api`) adresine iletir.
- Proxy, `httpOnly; Secure; SameSite=Lax` cookie'lerden `Authorization: Bearer <access>` ve `X-Cart-Token` başlıklarını ekler; `Accept-Language` ve istemci IP'sini (`X-Forwarded-For`) geçirir.
- 401 dönerse proxy `refresh` cookie'si ile `POST /auth/refresh` dener, yeni tokenları cookie'ye yazar ve isteği bir kez tekrarlar; yine 401 ise cookie'leri siler.
- `POST /api/auth/login|register|logout|refresh` proxy içinde özel işlenir: backend yanıtındaki `accessToken`/`refreshToken` cookie'ye yazılır, gövdeden silinir, sadece `user` döner.
- Server Component'ler API'ye `lib/api.server.ts` ile doğrudan (`API_URL`, cookie'den token okuyarak) gider; Client Component'ler `lib/api.client.ts` ile `/api/...` çağırır.
- Backend zarfı: `{ success: true, data }` / `{ success: false, statusCode, message }`. İstemci helper'ı `data`'yı açar, hatada `ApiError(message, statusCode)` fırlatır.
- Cookie adları: `mj_at` (access, 15 dk), `mj_rt` (refresh, 30 gün, path=/api/auth), `mj_cart` (misafir sepet token'ı, 30 gün).

## Güvenlik
- `proxy.ts`: korumalı rotalarda `mj_at` yoksa login'e yönlendir (admin: tüm `(admin)` grubu; web: `/account/*`, `/checkout`). Bilinmeyen rol = oturumsuz say.
- Güvenlik başlıkları `next.config.ts` `headers()` ile: `Content-Security-Policy` (nonce'suz, `script-src 'self'`; iyzico için `frame-src https://*.iyzipay.com`), `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `X-Content-Type-Options: nosniff`. HSTS nginx'te.
- Form girdileri `zod` ile doğrulanır; backend hatası (`message` string veya dizi) kullanıcıya gösterilir.
- Asla `dangerouslySetInnerHTML` ile ham API içeriği basma — CMS HTML'i (`Page.body`, `JournalPost.body`) `sanitize-html` ile temizlenerek basılır.
- Env: `API_URL` (server-only), `NEXT_PUBLIC_SITE_URL`. Sır yok.

## Görsel dil
- Web: kırık beyaz `#F6F4F0`, taş `#E8E3DA`, kömür `#1A1A1A`, Maeyja kırmızısı `#A3121B` (yalnızca aktif/hover). Cormorant Garamond (başlık) + Inter (gövde). Menü 11px uppercase 0.14em. Logo "MAEYJA" 0.42em aralık. Tasarım panoları: https://claude.ai/artifact/WPU3jsuv9aJZJEpoFiLJfP
- Admin: nötr (`neutral` zinc), Inter, shadcn/base-ui bileşenleri; sol menü, üst bar; yoğun ama sakin. Marka kırmızısı yalnızca tehlikeli işlemlerde.

## Diller
- Web: `next-intl`, `localePrefix: 'as-needed'` → `/` TR, `/en`, `/ja`… `messages/<lang>.json` (tr, en, ru, nl, de, fr, it, es, ko, ja, zh). `hreflang` alternates `generateMetadata` ile. API'ye `?lang=<locale>`.
- Admin: arayüz TR; içerik formlarında 11 dil sekmesi (`translations[lang][field]`), boş = TR'ye düşer.
