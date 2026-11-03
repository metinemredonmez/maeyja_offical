# Stripe kurulumu (kart ödemesi)

Kart ödemeleri Stripe'ın kendi ödeme sayfasından alınır (Stripe Checkout). Kart bilgisi bize hiç gelmez.
iyzico kodu duruyor ama kapalı; ileride `CARD_PROVIDER=IYZICO` ile açılabilir.

> Stripe, Türkiye'de kurulu şirketlere hesap açmıyor. Hesap, Stripe'ın desteklediği bir ülkedeki şirketle açılmalı.

## 1. Stripe panelinde (dashboard.stripe.com)

1. **Önce sandbox'ta dene.** Developers → Sandboxes kısmından bir test ortamı aç; aşağıdaki adımlar orada da aynı.
2. **Kısıtlı anahtar (restricted key, `rk_…`).** Developers → API keys → Create restricted key. Yalnız şu izinleri ver:
   - Checkout Sessions: **Write**
   - Coupons: **Write** (kuponlu siparişte indirim satırı için)
   - Refunds: **Write** (admin'den iade için)
   - PaymentIntents: **Read**, Charges: **Read**
3. **Webhook.** Developers → Webhooks → Add endpoint:
   - URL: `https://api.maeyja.com/api/payments/stripe/webhook`
   - Olaylar: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`
   - Oluşunca "Signing secret" (`whsec_…`) değerini kopyala.
4. **Önerilen:**
   - Settings → Payments → Adaptive Pricing: yurtdışı müşteri kendi para biriminde öder; tutarlar bizde TL olarak kontrol edilir.
   - Radar: varsayılan kurallar yeter. Radar "manual review" derse sipariş admin'de **incelemede** görünür.
   - Hesapta 2 adımlı doğrulama: SMS değil, passkey ya da authenticator uygulaması.

## 2. Sunucuda (`/var/www/maeyja/backend/.env`)

```
CARD_PROVIDER=STRIPE
STRIPE_SECRET_KEY=rk_live_…
STRIPE_WEBHOOK_SECRET=whsec_…
```

- Prod'da `STRIPE_SECRET_KEY` girilip `STRIPE_WEBHOOK_SECRET` girilmezse API açılmaz. Bu bilerek böyle: müşteri sekmeyi kapatırsa ödemeyi webhook işler.
- Test anahtarıyla (`rk_test_…`) gelen ödemeler sipariş geçmişinde "TEST modu, gerçek para yok" diye yazılır. Siteyi açmadan önce canlı anahtara geç.
- Sonra `make ship T=backend`. Yeni migration (`STRIPE` ödeme türü) deploy sırasında kendiliğinden uygulanır.

## 3. Nasıl çalışıyor

- **Ödeme:** Müşteri Stripe sayfasına gider, ödeyip `…/payments/stripe/return` adresine döner. Sunucu oturumu Stripe'a sorar ve siparişi "Ödendi" yapar. Aynı işi webhook da yapar; hangisi önce gelirse o işler, ikinci kez işlenmez.
- **Tutar kontrolü:** Stripe'ın bildirdiği tutar, para birimi ve sipariş kimliği bizdekiyle eşleşmezse sipariş "Ödendi" olmaz, **incelemeye** düşer. Admin notuna uyarı yazılır.
- **Süre dolunca:** Ödenmemiş sipariş 30 dakika sonra iptal edilir. İptal etmeden önce Stripe'a sorulur, açık ödeme sayfası kapatılır. Stripe'a ulaşılamazsa sipariş iptal edilmez, sonraki turda yeniden denenir.
- **Tekrar deneme:** Müşteri "Tekrar öde" derse açık sayfa varsa aynı sayfa açılır. İkinci bir ödeme sayfası açılmaz.
- **Çift ödeme:** Yine de ödenmiş bir siparişe ikinci ödeme gelirse otomatik iade edilir ve admin notuna yazılır.
- **İade:** Admin'de sipariş iptal ya da iade yapılırken "Stripe'ta ödemeyi iade et" seçilebilir.

## 4. Yerelde deneme (isteğe bağlı)

```
stripe listen --forward-to localhost:4000/api/payments/stripe/webhook
```

Bu komutun verdiği `whsec_…` ile sandbox anahtarı yerel `backend/.env`'e girilir. Test kartı: `4242 4242 4242 4242`, ileri bir tarih, herhangi bir CVC.

## 5. Canlı içerikte değişmesi gerekenler (admin → Sayfalar)

Seed metinleri güncellendi, ama canlıdaki sayfalar daha önce oluştuğu için kendiliğinden değişmez. Şu sayfalarda "iyzico" yazan yerler "Stripe" olmalı:
- Mesafeli satış sözleşmesi / ön bilgilendirme (ödeme yöntemi)
- KVKK aydınlatma metni: Stripe yurt dışında yerleşik bir ödeme kuruluşu, bu yüzden **yurt dışına aktarım** yazılmalı. Canan ve avukat onaylamalı.
- Güvenlik / gizlilik sayfası
