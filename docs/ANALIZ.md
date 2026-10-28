# MAEYJA — Analiz, İstekler ve MVP Mimarisi

> 28 Ekim 2026. Rakip araştırması: [RAKIP-ARASTIRMASI.md](RAKIP-ARASTIRMASI.md). Sunucu: [../deploy/SERVER-SETUP.md](../deploy/SERVER-SETUP.md).

## 1. Marka durumu

| | Bulgu |
|---|---|
| Ürün | **Tek model** heykelsi deri çanta, 5 renk (Kırmızı, Siyah, Beyaz, Yeşil, Çift Renk). El yapımı, İstanbul. |
| Kanallar | Instagram @maeyja_official (657 takipçi), Beymen İstinye'de raf, Vogue Türkiye'de yer almış. |
| Web | maeyja.com → hosting "yapım aşamasında" sayfası, HTTPS yok. Instagram bio linki yanlış siteye gidiyor. |
| Konum | Polène / Wandler / Manu Atelier segmenti: az ürün, yüksek zanaat, editoryal anlatım. |
| Hedef | Önce tek çantayı en iyi şekilde satan butik site; sonra giyim (renk × beden). |

## 2. Referans projelerden alınanlar

| Kaynak | Alındı | Alınmadı (neden) |
|---|---|---|
| **pure** (kahve) | NestJS+Prisma iskeleti, global guard/filter/interceptor düzeni, soft delete, "fiyat otoritesi backend" kuralı, OneSignal broadcast, iyzico Checkout Form akışı (HMAC imza, callback'te sunucudan doğrulama), pm2 deploy şablonu, KDV dahil fiyat mantığı | Abonelik, B2B, loyalty, chatbot, Kargonomi, PayTR, Redis/BullMQ (tek ürünlü butik için gereksiz yük), MUI admin (tasarım diline uymuyor) |
| **printy** (POD) | Joi ile `.env` doğrulama (eksik değişken = açılışta hata), `AGENTS.md` "bozulmaması gereken kurallar" formatı, Next.js 16 + Tailwind v4 + shadcn/base-ui admin yaklaşımı, `proxy.ts` rol kapısı | Çoklu tenant, kredi/lot sistemi, Etsy, üretim kanban |

## 3. İstek listesi (MVP kapsamı)

### Web (mağaza) — ✅ tamamlandı (web/)
- [ ] Ana sayfa: admin'den yönetilen bölümler (hero video/görsel, öne çıkanlar, atölye hikâyesi, basın, satış noktaları, newsletter)
- [ ] Ürün sayfası: solda dikey galeri, sağda sticky kutu; renk swatch → galeri değişir; fiyat butonda; akordeon (Detaylar / Malzeme-Bakım / Ölçüler / Teslimat-İade / Atölye); "Gelince haber ver"
- [ ] Liste: 2/3 kolon, hover'da ikinci görsel, renk/beden/fiyat filtre, sıralama
- [ ] Sepet drawer; misafir sepeti; kupon
- [ ] Checkout: tek sayfa, misafir, adres, fatura (bireysel/kurumsal), iyzico (3DS, taksit) + havale, mesafeli satış onayı
- [ ] Hesap: siparişler, adresler, favoriler, şifre; misafir sipariş sorgulama
- [ ] İçerik: Journal, Hakkımızda, Bakım rehberi, SSS, yasal sayfalar (KVKK, mesafeli satış, ön bilgilendirme, iade)
- [ ] **11 dil:** TR (varsayılan) + EN · RU · NL · DE · FR · IT · ES · KO · JA · ZH — URL öneki `/en`, `/ja` …; `hreflang`; dil seçici header'da; CJK (Noto Sans JP/KR/SC) ve Kiril için font fallback
- [ ] SEO (meta, OG, JSON-LD Product), sitemap (dil başına)
- [ ] Lighthouse 90+, görsel optimizasyonu (WebP renditions backend'den geliyor)

### Admin — ✅ tamamlandı (admin/)
- [ ] Dashboard: 30 günlük ciro grafiği, bekleyen kargo, düşük stok, iade talepleri, okunmamış mesaj
- [ ] Ürün formu: varyant matrisi (renk × beden), stok, görsel sürükle-bırak, görsel→renk eşleme, 11 dil sekmesi (boş alan TR'ye düşer), SEO
- [ ] Sipariş: liste/filtre, detay, durum geçişi, kargo bilgisi + takip linki, CSV dışa aktarma, iade yönetimi
- [ ] İçerik: ana sayfa bölümleri (sıralama), sayfalar, journal, basın, satış noktaları, SSS
- [ ] Pazarlama: kuponlar, bülten listesi/CSV, push bildirimi gönder
- [ ] Ayarlar: mağaza, kargo (ücret, eşik, kargo firmaları), KDV, havale bilgileri, misafir ödeme
- [ ] Kullanıcılar, personel rolleri, denetim kaydı

### Mobil (Expo) — tasarım Emre'den
- [ ] Tab bar: Ana sayfa / Mağaza / Favoriler / Sepet / Hesap
- [ ] Ürün swipe galeri, sticky "Sepete ekle", stok bildirimi
- [ ] Checkout iyzico WebView (paymentPageUrl)
- [ ] OneSignal push (login → `OneSignal.login(userId)`, `POST /devices`), deep link `maeyja://order/:no`
- [ ] Sipariş takibi, favoriler
- [ ] 11 dil (cihaz diline göre otomatik, ayarlardan değiştirilebilir)

### Backend — ✅ tamamlandı (bkz. [../backend/README.md](../backend/README.md))

## 4. Mimari

```
                 ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
                 │  web (Next)  │   │ admin (Next) │   │ mobile (Expo)│
                 │  :3001       │   │  :3000       │   │              │
                 └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
                        │ REST /api         │                  │
                        └──────────┬────────┴──────────────────┘
                                   ▼
                     ┌──────────────────────────┐    ┌──────────┐
   nginx ──────────▶ │  backend (NestJS) :4000  │───▶│ Postgres │
   /uploads (disk)   │  pm2 fork · cron içeride │    └──────────┘
                     └─────┬────────┬───────┬───┘
                           ▼        ▼       ▼
                        iyzico   OneSignal  SMTP
```

**Backend modülleri:** auth · users · catalog · media · pricing · coupons · cart · orders (checkout, iyzico, lifecycle, jobs) · wishlist · content · notifications (mail, push) · settings · dashboard · health.

**Diller:** backend `LOCALES = tr en ru nl de fr it es ko ja zh`; içerik çevirileri `translations` JSON'da, admin'de dil sekmeleri. Arayüz metinleri (buton, menü) web/admin/mobil tarafında `messages/<lang>.json` (next-intl / i18n-js). İşlem mailleri TR/EN; iyzico tr/en.

**Veri modeli (öz):** `Product` → `ProductVariant` (renk × beden, SKU, stok, fiyat override) → `ProductImage` (renge bağlanabilir). `Order` + `OrderItem` snapshot (fiyat/isim katalogdan tekrar okunmaz). `HomeSection` tipli bölümler. `translations` JSON ile EN.

**Kurallar (bozma):**
1. Fiyat yalnızca `PricingService.quote()` ile hesaplanır; istemci fiyat göndermez.
2. Stok, siparişle aynı transaction'da koşullu düşülür (`stock >= qty`); iptal/iade `releaseStock` ile geri döner (idempotent).
3. iyzico callback'i asla tarayıcıdan gelen veriye güvenmez; tutar/basketId sunucudan doğrulanır.
4. Sipariş durum geçişleri `TRANSITIONS` tablosundan geçer; koşullu `updateMany` ile yarış engellenir.
5. Yeni env değişkeni → `env.validation.ts` Joi şemasına ekle.
6. Prod'da Docker yok: pm2 fork, tek instance (cron'lar süreç içinde).

## 5. Tasarım yönü (web)

- **Palet:** kırık beyaz `#F6F4F0`, taş `#E8E3DA`, kömür `#1A1A1A`, vurgu: Maeyja kırmızısı `#A3121B` (yalnızca CTA hover/aktif swatch).
- **Tipografi:** Başlık serif ince (örn. *Instrument Serif* / *Cormorant*), gövde grotesk (*Inter* / *Geist*). Menü 11px uppercase, letter-spacing 0.12em. Logo: "MAEYJA" uppercase, 0.42em letter-spacing (Instagram logosuyla aynı).
- **Layout:** passe-partout hero (Toteme), 12 kolon, 4:5 görseller, bol boşluk (The Row).
- **Ana sayfa:** Konsept A ("Tek İkon") ile başla; katalog büyüyünce Konsept B'ye geç. Bölümler admin'den sıralanır.
- Örnek tasarımlar (4 pano: Ana sayfa A ve B, ürün listesi, ürün sayfası): https://claude.ai/artifact/WPU3jsuv9aJZJEpoFiLJfP

## 6. Sıradaki adımlar
1. **Sunucu:** hazal sunucusuna kurulum ([SERVER-SETUP.md](../deploy/SERVER-SETUP.md)) + [GUVENLIK.md](GUVENLIK.md) bölüm 4 (ufw, fail2ban, SSH, yedek); DNS (maeyja.com, www, admin, api); certbot.
2. **Anahtarlar:** iyzico (önce sandbox), OneSignal app, SMTP, `APP_ENCRYPTION_KEY`; prod `.env`'de `MFA_REQUIRED_FOR_STAFF=true`.
3. **İçerik:** gerçek ürün fotoğrafları/video, fiyat, KVKK/mesafeli satış metinleri (admin → Sayfalar), Instagram bio linkini düzelt.
4. **mobile/** — Emre'nin tasarımı geldiğinde Expo (OneSignal, deep link, iyzico WebView).
5. P1 güvenlik maddeleri (GUVENLIK.md): CAPTCHA, HIBP şifre kontrolü, oturum listesi, CLI MFA sıfırlama.
