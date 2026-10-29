# Web yeniden tasarım notları (29 Ekim 2026)

Kapsam: **yalnızca web (mağaza)**. Admin'e dokunulmayacak. Hedef: referans sitelerin karışımı ama **MAEYJA'ya özgü**.

## Emre'nin seçtiği parçalar

| Kaynak | Ne alınacak | Gözlem (sitelerde bakıldı) |
|---|---|---|
| **Polène** (eng.polene-paris.com) | **Temel yapı + yazı tipi** | Tam ekran hero, menü görselin üstünde şeffaf, logo ortada. Sol altta küçük yüzen ürün kartı (görsel + ad + fiyat). Bölüm başlıkları çok büyük, ince, BÜYÜK HARF serif ("SMALL LEATHER GOODS"). Tam genişlik editoryal görsel, sol altta başlık + "Discover" linki. Fontlar: ince serif (250–300) başlık, orta kalın küçük sans menü/etiket. |
| **Wandler** (wandler.com) | **Parallax geçiş** (1. ekran) | Hero görseli kaydırırken yavaş kayıyor; ekran genişliğinde dev aralıklı logo görselin üstünde, kaydırınca küçülüp menüye yerleşiyor. Altında büyük serif başlık + "Shop now". |
| **Manu Atelier** (tr.manuatelier.com) | **Yan yana fotoğraflar + geçişler** | Ürün şeridinden sonra yarı yarıya iki büyük fotoğraf (diptik); biri hareketli/flu, renkli fon. |
| **Mlouye** (mlouye.com) | **Videolar + reklam bannerları** | Hero ve ürün kartlarında sessiz döngü video; tam genişlik kampanya bannerları, kart üzerinde ürün adı. |
| **Liffner** (liffner.co) | **Yan yana fotoğraf, renk, geçişler** | Sıcak krem zemin; iki görsel yan yana; kategori şeridi (dekupe ürün görselleri + altında kategori adı); yumuşak geçişler. |
| **Aesther Ekme** (aestherekme.com/collections/new-arrivals) | **Koleksiyon / ürün listeleme alanı** | Üstte ortada küçük büyük harf başlık; 2 sütun büyük ürün kutuları, gri-taş fon üzerinde ürün; altında ortalı küçük BÜYÜK HARF ad + fiyat. |

## Geçişler
Tüm sayfa boyunca **parallax** hissi (Wandler gibi): görseller kaydırırken metinden yavaş kayar, bölümler yumuşakça belirir (fade + hafif yukarı kayma), diptik fotoğraflar farklı hızda hareket eder. Telefonlarda ve "hareketi azalt" ayarı açık olanlarda sade kalır.

## Tipografi kararı (öneri — Emre Polène'in yazı tipini beğendi)
- **Logo:** mevcut aralıklı `M A E Y J A` kalır (Instagram ile aynı kimlik).
- **Büyük başlıklar:** Cormorant Garamond 300, BÜYÜK HARF, büyük boy, hafif aralık (Polène "Primary" karşılığı). Kiril destekli.
- **Menü / etiket / buton:** küçük, büyük harf, geniş aralıklı sans (Tenor Sans ya da Inter 500).
- **Metin:** Inter.
- **Bize özgü dokunuş:** model adları numaralı — `N°01 Origami`, `N°02 Valise`… (Polène'in numaralı isim fikrinin MAEYJA versiyonu).
- Örnekler: `docs/tipografi-onerisi.html` (A önerilen).

## Fotoğraf
Mevcut kafe masası fotoğrafları zayıf; profesyonel stüdyo (aynı açık bej fon) + İstanbul mimarisinde mankenli kampanya çekimi gerekli. Video için 5–10 sn'lik sessiz döngüler (Mlouye tarzı).

## Görseller
- **Vitrin görseli** (Polène'in mağaza fotoğrafı yerine, ona benzer, bize ait): Canva'da üretildi — niş, ceviz raflar, üstünde Origami (kırmızı), Valise (fildişi), Drape (yeşil). 1136×1408. Canva → Yüklemeler'de. Not: yapay zekâ çantaların detaylarını birebir korumayabilir; ürünü temsil eden görsel değil, atmosfer görseli olarak kullanılmalı.

## Bekleyen
Emre'den kalan seçimler (ürün sayfası, footer vb.) gelince tek plan çıkarılıp onaya sunulacak.
