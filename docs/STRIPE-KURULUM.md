# Stripe kurulumu (kart ödemesi)

Kart ödemeleri Stripe'ın kendi ödeme sayfasından alınır (Stripe Checkout). Kart bilgisi bize hiç gelmez.
iyzico kodu duruyor ama kapalı; ileride `CARD_PROVIDER=IYZICO` ile açılabilir.

> Stripe, Türkiye'de kurulu şirketlere hesap açmıyor. Hesap, Stripe'ın desteklediği bir ülkedeki şirketle açılmalı.

## 1. Tek adım: anahtarı admin'e yapıştır

1. Stripe panelinde **Developers → API keys** bölümünden gizli anahtarı (`sk_live_…`) kopyala. Önce denemek istersen test anahtarı (`sk_test_…`) da olur.
2. Admin'de **Ayarlar → Kartla ödeme** sekmesine yapıştır ve **Kaydet ve bağla**'ya bas.

Gerisini sistem yapar:
- Anahtar Stripe'a sorularak doğrulanır.
- Webhook (`https://api.maeyja.com/api/payments/stripe/webhook`) kendiliğinden kurulur.
- Anahtar ve webhook anahtarı veritabanında şifreli saklanır.
- Ekranda yalnızca son 4 hane görünür.

Ek bilgiler:
- Test anahtarıyla gelen ödemeler sipariş geçmişinde "TEST modu, gerçek para yok" diye yazılır. Siteyi açmadan önce canlı anahtara geç.
- Kısıtlı anahtar (`rk_…`) kullanılacaksa şu izinler gerekir: Checkout Sessions, Coupons, Refunds ve **Webhook Endpoints** için Write; PaymentIntents ve Charges için Read.
- Stripe hesabında 2 adımlı doğrulama açık olsun; SMS değil, passkey ya da authenticator uygulaması.
- İstersen Settings → Payments → **Adaptive Pricing** aç: yurtdışı müşteri kendi para biriminde öder, tutarlar bizde TL olarak kontrol edilir.

## 2. Alternatif: sunucu `.env`

Admin'de anahtar yoksa `backend/.env` içindeki `STRIPE_SECRET_KEY` ve `STRIPE_WEBHOOK_SECRET` kullanılır. Bu durumda webhook'u Stripe panelinden elle kurmak gerekir. Prod'da `STRIPE_SECRET_KEY` girilip webhook anahtarı girilmezse API açılmaz.

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
