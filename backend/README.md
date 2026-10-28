# MAEYJA API

NestJS 11 · Prisma 6 · PostgreSQL 15 · Node 20. Tek süreç (pm2 fork), Redis/kuyruk yok — cron işleri süreç içinde.

## Çalıştırma
```bash
cp .env.example .env      # DATABASE_URL'i düzenle
npm install
npx prisma migrate dev    # şemayı uygular
npm run db:seed           # admin + renkler + Signature Bag + yasal sayfalar + ana sayfa bölümleri
npm run start:dev         # http://localhost:4000/api  ·  Swagger: /api/docs  ·  /health
```
Seed admin: `.env` → `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (ilk girişten sonra şifreyi değiştir).

## Yanıt zarfı
Başarılı: `{ success: true, data }` — Hata: `{ success: false, statusCode, message, path }`. Decimal'ler sayı olarak döner.

## Kimlik
- `Authorization: Bearer <accessToken>` (15 dk). Yenileme: `POST /auth/refresh` ile dönen refresh token **tek kullanımlıktır** (rotasyon; tekrar kullanım tüm oturumları düşürür).
- Misafir sepeti: ilk `POST /cart/items` yanıtındaki `cartToken`'ı sakla, sonraki isteklerde `X-Cart-Token` başlığı ile gönder. Girişten sonra `POST /cart/merge`.
- Roller: `CUSTOMER` · `EDITOR` (içerik) · `ADMIN` · `SUPER_ADMIN` (personel yönetimi). Admin paneli `POST /auth/admin/login` kullanır.
- Dil: `?lang=xx` veya `Accept-Language`. Varsayılan `tr`; desteklenen: `tr en ru nl de fr it es ko ja zh`. Çeviriler `translations` JSON kolonunda (`{ "en": {...}, "ja": {...} }`); boş alan TR'ye düşer. İşlem mailleri TR/EN (diğer diller EN alır); iyzico formu tr/en.

## Uç noktalar (özet)
| Alan | Public | Hesap | Admin |
|---|---|---|---|
| Katalog | `GET /catalog/products`, `/products/:slug`, `/categories`, `/collections`, `/colors`, `POST /catalog/stock-alerts` | `GET/POST/DELETE /me/wishlist` | `/admin/products`, `/variants/:id/stock`, `/images`, `/categories`, `/collections`, `/colors`, `/media` |
| Sepet & sipariş | `/cart/*`, `POST /checkout`, `POST /orders/:no/pay`, `POST /orders/lookup`, `POST /orders/:no/returns` | `GET /me/orders`, `/me/orders/:no`, `/me/addresses` | `/admin/orders`, `/:id/status`, `/:id/ship`, `/export.csv`, `/admin/returns`, `/admin/coupons` |
| İçerik | `/content/home`, `/pages/:slug`, `/journal`, `/press`, `/stockists`, `/faq`, `POST /newsletter/subscribe`, `POST /contact` | — | `/admin/home-sections`, `/pages`, `/journal`, `/press`, `/stockists`, `/faq`, `/newsletter`, `/messages` |
| Sistem | `GET /settings/public`, `POST /devices` (push) | `GET /auth/me`, `PATCH /me`, `DELETE /me` (KVKK) | `/admin/dashboard`, `/admin/settings`, `/admin/users`, `/admin/push`, `/admin/audit-logs` |

Tam liste Swagger'da.

## Ödeme (iyzico Checkout Form)
1. `POST /checkout` `{ paymentMethod: "IYZICO" }` → `payment.paymentPageUrl` (yönlendir) veya `checkoutFormContent` (gömülü).
2. 3-D Secure sonrası iyzico tarayıcıyı `POST /api/payments/iyzico/callback`'e yollar; backend sonucu **sunucudan** doğrular (tutar, basketId, conversationId) ve `WEB_URL/checkout/result?order=…&status=success|failed` adresine yönlendirir.
3. Ödeme gelmezse `ORDER_PAYMENT_TIMEOUT_MINUTES` sonra sipariş otomatik iptal olur, stok geri döner. Geç gelen ödeme stok varsa siparişi yeniden açar, yoksa `adminNote`'a iade uyarısı düşer.
4. Havale/EFT: admin → Ayarlar → `bankTransfer.enabled`; admin siparişi `PAID` yapınca müşteriye onay maili gider.

Fiyatlar KDV **dahil**; `taxTotal` bilgi amaçlıdır. Tüm hesap `PricingService.quote()` içinde — sepet, checkout ve sipariş aynı sayıyı görür.

## Push (OneSignal)
Mobil uygulama `OneSignal.login(user.id)` çağırır ve `POST /devices` ile subscription id'yi bildirir. Admin → `POST /admin/push` `{ target: "ALL" | "USERS" }`. FCM/APNs anahtarları OneSignal panelinde tanımlanır; backend'e `ONESIGNAL_APP_ID` + `ONESIGNAL_API_KEY` yeter.

## Test
```bash
npm test          # birim: para/KDV, iyzico sepet dağılımı, durum makinesi, i18n, slug
npm run typecheck
```
