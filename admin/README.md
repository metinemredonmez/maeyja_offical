# MAEYJA Yönetim Paneli

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind v4 · shadcn/ui (`@base-ui/react`, stil `base-nova`) · TanStack Query · react-hook-form + zod · recharts · dnd-kit.

Arayüz Türkçe; içerik formlarında 11 dil sekmesi (`translations[lang][field]`, boş alan TR'ye düşer).

## Çalıştırma

```bash
cp .env.example .env.local   # API_URL ve NEXT_PUBLIC_SITE_URL
npm install
npm run dev                  # http://localhost:3000
npm run typecheck            # tsc --noEmit
npm run build                # next build --webpack
npm start                    # next start -p 3000
```

Backend (`../backend`, `http://127.0.0.1:4000/api`) çalışıyor olmalı; build backend'e ihtiyaç duymaz (build zamanı fetch yok, tüm sayfalar dinamik).

### Ortam değişkenleri

| Değişken | Açıklama |
|---|---|
| `API_URL` | Backend API kökü (yalnız sunucu tarafı), örn. `http://127.0.0.1:4000/api` |
| `NEXT_PUBLIC_SITE_URL` | Bu uygulamanın public origin'i; BFF proxy CSRF kontrolünde `Origin` ile karşılaştırılır |
| `NEXT_PUBLIC_WEB_URL` | (opsiyonel) Vitrin adresi; ürün sayfasındaki "Sitede gör" bağlantısı için (varsayılan `http://localhost:3001`) |

## Mimari

- **BFF proxy** `app/api/[...path]/route.ts` — tarayıcı yalnızca `/api/*` ile konuşur. Proxy, `mj_at` cookie'sinden `Authorization: Bearer` ekler; yalnızca `auth/<bilinen uçlar>` ve `admin/**` yollarını iletir (diğerleri 404); istek başlıklarından yalnızca `accept`, `accept-language`, `content-type`, `user-agent` geçer (+ kendi eklediği `X-Forwarded-For`). GET dışı isteklerde `X-Requested-With: mj` ve same-origin `Origin`/`Sec-Fetch-Site` zorunludur (yoksa 403). `auth/admin/login`, `auth/login/mfa`, `auth/change-password` yanıtlarındaki token'lar cookie'ye yazılır ve gövdeden silinir; `auth/refresh` cookie'deki refresh token'ı kullanır; `auth/logout` backend'de iptal edip cookie'leri siler. Multipart (medya yükleme) ve CSV (`Content-Disposition`) yanıtları olduğu gibi geçer.
- **Cookie'ler** (`lib/auth-cookies.ts`): `mj_at` (httpOnly, SameSite=Strict, path `/`) ve `mj_rt` (httpOnly, SameSite=Strict, path `/api/auth`, 30 gün). Not: `mj_at` içindeki JWT 15 dk geçerlidir, cookie'nin kendisi 30 gün yaşar; böylece `proxy.ts` "oturum var ama token bayat" durumunu "hiç giriş yapılmamış"tan ayırabilir. İstemci ilk 401'de `POST /api/auth/refresh` ile yeniler ve isteği tekrarlar; yenileme de başarısız olursa cookie'ler silinir ve `/login?next=…&expired=1`'e yönlendirilir (yalnız göreli `next` kabul edilir).
- **`proxy.ts`** (Next 16 middleware) — `mj_at`/`mj_rt` yoksa `/login`'e yönlendirir (`/login`, `/forgot-password`, `/reset-password`, `/api/*`, `/_next/*` hariç). Her istekte nonce üretip `Content-Security-Policy` (`script-src 'self' 'nonce-…' 'strict-dynamic'`, `frame-ancestors 'none'`, …) başlığını hem isteğe hem yanıta yazar; Next inline script'lerini bu nonce ile damgalar. Statik güvenlik başlıkları (`X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `X-Robots-Tag: noindex`) `next.config.ts`'te.
- **İki adımlı doğrulama (TOTP)** — giriş `{ mfaRequired, mfaToken }` dönerse ikinci adım formu (6 haneli kod veya `AB12C-DE34F` yedek kod) `POST /auth/login/mfa`'ya gider. Kurulum/kapatma/yedek kod yenileme `/profile` sayfasındaki "İki adımlı doğrulama" kartında. Backend `MFA_REQUIRED_FOR_STAFF=true` ile çalışıyorsa `403 { code: 'MFA_SETUP_REQUIRED' }` yanıtı istemci tarafında yakalanır ve kullanıcı `/profile?mfa=setup`'a yönlendirilir (zorunluluk banner'ı gösterilir).
- **İstemci API** `lib/api.client.ts` (`api.get/post/patch/put/delete`, `{success,data}` zarfını açar, `ApiError(message[], statusCode, code)` fırlatır); **sunucu** `lib/api.server.ts` (Server Component'ler için, cookie'den token okur — yalnız `(admin)/layout.tsx` ilk `me` denemesinde kullanılır).
- **Veri katmanı** `lib/queries/*` (domain başına TanStack Query hook'ları; her mutasyon toast gösterir ve ilgili query'leri invalidate eder), `lib/schemas/*` (backend DTO kurallarını yansıtan zod şemaları), `lib/types.ts`, `lib/labels.ts` (Türkçe durum etiketleri + renk tonları), `lib/i18n.ts`, `lib/html.ts` (`sanitize-html` — backend ile aynı allowlist; tek `dangerouslySetInnerHTML` kullanımı RichText önizlemesindedir).
- **Paylaşılan bileşenler** `components/shared/*`: `DataTable` (sunucu sayfalama, debounce'lu arama, boş/yükleniyor/hata durumları), `PageHeader`, `StatusBadge`, `Money`, `DateTime`, `ConfirmDialog`/`useConfirm` (tüm yıkıcı işlemler), `ImageUploader` (sürükle-bırak → `/api/admin/media`), `MediaPicker`, `TranslationsTabs`, `RichText` (HTML kaynak + araç çubuğu + Markdown→HTML + temizlenmiş önizleme), `SeoFields`, `ProductPicker`/`UserPicker`, `QueryState`/`ErrorState` (403 → "yetkiniz yok", ağ hatası → tekrar dene).
- **Kabuk** `components/layout/*`: daraltılabilir gruplu sol menü (Genel / Katalog / Satış / İçerik / Pazarlama / Sistem; rol bazlı — EDITOR yalnız İçerik + Medya, ADMIN Personel hariç her şey, SUPER_ADMIN hepsi), üst bar (⌘K komut paleti: sipariş no / ürün / müşteri / sayfa), kullanıcı menüsü (Profil, Şifre değiştir, Çıkış).

## Sayfalar

| Alan | Rotalar |
|---|---|
| Giriş | `/login` (+ TOTP ikinci adım), `/forgot-password`, `/reset-password?token=` |
| Genel | `/` panel (KPI kartları, 30 günlük ciro ve sipariş grafikleri, kargolanacak, durum sayıları, son siparişler, düşük stok, en çok satanlar) |
| Katalog | `/products`, `/products/new`, `/products/[id]` (çeviri sekmeleri, varyant tablosu + matris üretici + stok ±, sürükle-sırala görseller), `/categories`, `/collections`, `/colors`, `/media` |
| Satış | `/orders` (durum sekmeleri, filtreler, CSV), `/orders/[id]` (geçişler, kargoya ver, ödemeler, zaman çizelgesi, not), `/returns`, `/coupons`, `/coupons/[id]`, `/customers`, `/customers/[id]` |
| İçerik | `/content/home` (sürükle-sırala bölümler), `/content/pages(/new, /[id])`, `/content/journal(/new, /[id])`, `/content/press`, `/content/stockists`, `/content/faq` |
| Pazarlama | `/newsletter` (CSV), `/messages`, `/push` |
| Sistem | `/settings` (store / shipping / tax / checkout / bankTransfer), `/staff` (SUPER_ADMIN), `/audit-logs`, `/profile` (şifre + 2FA) |

## Notlar

- Liste uçları sıralama parametresi sunmadığından tablolarda sunucu taraflı sıralama yoktur; filtre/sayfa/arama URL'de tutulur.
- Ürün düzenlemede varyant/görsel alanları odak kaybında kendi uçlarına otomatik kaydedilir; oluşturma ekranında ürünle birlikte tek `POST` ile gönderilir.
- Geliştirmede web (3001) ve admin (3000) aynı host'ta aynı cookie adlarını paylaşır; üretimde ayrı alan adlarında çalıştırın.
