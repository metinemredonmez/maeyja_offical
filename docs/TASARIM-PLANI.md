# MAEYJA web yenileme + yapay zekâ — plan (29 Ekim 2026)

Kaynak: [TASARIM-NOTLARI.md](TASARIM-NOTLARI.md) (Emre'nin seçtiği parçalar). Her faz ayrı yayınlanır; her fazdan önce
yerelde kurulup ekran görüntüsüyle onaya sunulur.

## Faz 1 — Temel + ana sayfa
**Genel görünüm**
- Zemin sıcak krem (Liffner), metin koyu antrasit, vurgu MAEYJA kırmızısı (az kullanılır).
- Yazı: başlıklar Cormorant Garamond 300 BÜYÜK HARF (Polène tarzı), menü/etiket/buton Tenor Sans (aralıklı büyük harf), metin Inter.
- Model adları numaralı: `N°01 Origami`, `N°02 Valise`… (sıra admin'deki ürün sıralamasından gelir).
- Üst menü: ana sayfada görselin üstünde şeffaf, kaydırınca krem zemine geçer. Logo ortada.

**Geçişler (her sayfada)**
- Parallax: görseller metinden yavaş kayar; bölümler yumuşakça (opaklık + hafif yukarı) belirir; yan yana fotoğraflar farklı hızda.
- Telefonda ve "hareketi azalt" açık cihazlarda sade/kapalı. Ağır kütüphane yok (CSS scroll animasyonu + küçük yardımcı).

**Ana sayfa sırası**
1. **Hero (Wandler + Polène):** tam ekran görsel ya da sessiz döngü video; ekran genişliğinde dev `M A E Y J A`, kaydırınca küçülüp menüye oturur. Sol altta yüzen küçük ürün kartı (görsel + ad + fiyat).
2. **Yeni gelenler (Manu/Wandler):** 4'lü ürün şeridi, renk noktaları.
3. **Yan yana iki büyük fotoğraf (Manu + Liffner):** farklı hızda parallax, altlarında kısa başlık + link.
4. **Kategori şeridi (Liffner):** dekupe ürün görselleri + altında kategori adı (Omuz, Kova, Mini, Kutu…).
5. **Vitrin / atölye bölümü (Polène):** tam genişlik görsel (admin Medya'daki vitrin görseli), sol altta başlık + "Keşfet".
6. **Kampanya bannerı / video (Mlouye):** tam genişlik, üstünde ürün/kampanya adı. (Faz 3'te "Üzerimde gör" ara bannerı da buraya eklenir.)
7. Basın şeridi · Satış noktaları · Bülten (yeni tipografiyle).

## Faz 2 — Ürün listesi + ürün sayfası
- **Çantalar / koleksiyon (Aesther Ekme):** üstte ortada küçük büyük harf başlık; masaüstünde 2–3 sütun büyük kutular (taş-gri fon); üstüne gelince ikinci fotoğraf; altında ortalı `N°01 ORIGAMI` + fiyat + renk noktaları; ince filtre şeridi (renk, sıralama).
- **Ürün sayfası (Polène + Wandler):** solda büyük galeri (masaüstünde alt alta, telefonda kaydırmalı), sağda yapışkan bilgi: numara + ad, alt başlık, fiyat, adlı renk seçimi, **"Sepete ekle — ₺14.500"** (fiyat butonun içinde), akordeon: Açıklama · Detay & ölçüler · Malzeme & bakım · Kargo & iade · Zanaat. Altta "Birlikte güzel durur" şeridi ve tam genişlik atölye görseli.

## Faz 3 — Yapay zekâ
**A. Sohbet asistanı (sağdan kayan panel)**
- Sağ altta küçük "Asistan" düğmesi → sağdan kayan sohbet paneli (telefonda tam ekran). 11 dilde, ziyaretçinin dilinde cevap.
- **"Eğitim":** model yeniden eğitilmez; her soruda mağazanın güncel bilgisi verilir — ürünler, fiyat, stok, renkler, ölçüler, SSS, kargo/iade/KVKK sayfaları, bakım rehberi, iletişim. Admin'de ürün ya da SSS değişince asistan otomatik bilir.
- Admin → Ayarlar → **Asistan:** aç/kapat, karşılama mesajı, ton ve kurallar ("indirim sözü verme", "sipariş durumunu sorarsa sipariş takibine yönlendir" vb.), sık sorulara ek bilgi notları.
- Ürün önerirken tıklanabilir ürün kartı gösterir; bilmediği konuda uydurmaz, support@ / iletişim formuna yönlendirir.
- Güvenlik/maliyet: API anahtarı yalnızca sunucuda; IP başına hız sınırı, mesaj uzunluğu ve günlük harcama sınırı; kişisel veri istenmez, sohbetler kalıcı saklanmaz (istenirse 30 gün, KVKK metnine eklenir).

**B. Otomatik çeviri**
- Admin'deki çeviri sekmelerine **"Otomatik çevir"** düğmesi: Türkçe metinden 10 dile tek tıkla doldurur (ürün, sayfa, journal, ana sayfa, SSS, renk/kategori, kampanya). Çeviri düzenlenebilir taslak olarak gelir; kaydetmeden önce bakılır.
- Ürün açıklamalarında marka dili korunur (model adları çevrilmez, "N°01" kalır).

**C. Sanal dene — "Üzerimde gör" (ai-beauty'deki deneme altyapısından)**
- Ürün sayfasında **"Üzerimde gör"** düğmesi: ziyaretçi kendi fotoğrafını yükler (ya da çeker), seçili çanta omzunda/elinde
  görünür; önce/sonra kaydırıcı, indir/paylaş.
- **Altyapı `virtual-textile` projesinden taşınır** (aynı NestJS yapısı): sağlayıcı katmanı (fal.ai: FASHN v1.6 / IDM-VTON /
  CAT-VTON · Google Gemini görüntü modeli), hata eşleme, kalite kontrolü, filigran, kullanım ölçümü, kuyrukta asenkron iş.
  ai-beauty'deki rıza/izin akışı örnek alınır. Giysi modelleri çanta için uygun olmayabilir; **çanta için önce Gemini'nin
  çok görselli düzenlemesi**, fal.ai yedek — gerçek çanta fotoğraflarımızla denenip en doğal sonuç seçilir.
- virtual-textile'deki **AI stil danışmanı** fikri sohbet asistanına eklenir: "Bu elbiseyle hangi çanta?" gibi sorulara
  katalogdan öneri.
- Video deneme (virtual-textile'de var) pahalı; şimdilik kapalı, sonraki aşama.
- **KVKK:** fotoğraf kişisel veri ve yurt dışına (fal.ai) gider → ayrı, önceden işaretlenmemiş açık rıza; fotoğraf
  saklanmaz (iş bitince silinir); 18 yaş beyanı; KVKK metnine eklenir. Kötüye kullanıma karşı hız ve günlük sınır.
- **Ana sayfada ara banner:** "Yeni · Çantanı üzerinde gör" — kısa video/örnek görselle tam genişlik tanıtım bandı;
  ürün kartlarında küçük "Dene" etiketi.

**Gereken:** Anthropic (Claude) API anahtarı → sunucuda `backend/.env` (`ANTHROPIC_API_KEY`). Model seçimi uygulama sırasında güncel modellere göre yapılır (sohbet hızlı/ekonomik, çeviri kaliteli).

## Faz 4 — Atölye / Journal + cila
- Atölye (Hakkımızda) sayfası: diptik fotoğraflar, el işçiliği adımları, İstanbul hikâyesi.
- Journal: dergi düzeni (büyük kapak, ince serif başlık).
- Footer ve sepet çekmecesi yeni tipografiye.

## Admin'de yapılacak küçük eklemeler (tasarımına dokunulmadan)
- Ana sayfa bölüm formuna: ikinci görsel (yan yana düzen), düzen seçimi, video.
- Çeviri sekmelerine "Otomatik çevir" düğmesi.
- Ayarlar → "Asistan" sekmesi.

## Senden gerekenler
- Anthropic API anahtarı + Google AI (Gemini) ve/veya fal.ai anahtarı (Faz 3 için).
- Fotoğraflar: stüdyo (aynı açık bej fon) + kampanya (manken, İstanbul mimarisi); 5–10 sn sessiz döngü videolar (opsiyonel, Mlouye tarzı). Gelene kadar mevcut en iyi kareler ve vitrin görseli kullanılır.
