/**
 * Turkish bodies for the store pages and the first journal posts. The seed only replaces the original
 * "… metni buraya gelecek." placeholders (and creates posts whose slug doesn't exist), so anything edited in
 * the admin stays. Other languages are filled by the AI translator (AiService / npm run translate:missing).
 *
 * Legal texts are drafts built on Law No. 6502, the Distance Contracts Regulation and KVKK (Law No. 6698).
 * Fields in [square brackets] must be completed in the admin, and the texts reviewed by a lawyer.
 */

const UPDATED = '<p><em>Son güncelleme: 29 Ekim 2026. Bu metnin Türkçe dışındaki çevirileri bilgi amaçlıdır; farklılık hâlinde Türkçe metin esas alınır.</em></p>';

const SELLER = `<ul>
<li><strong>Unvan:</strong> [Şirket unvanı]</li>
<li><strong>Adres:</strong> [Açık adres], İstanbul, Türkiye</li>
<li><strong>Vergi dairesi / no:</strong> [Vergi dairesi] / [Vergi numarası]</li>
<li><strong>MERSİS no:</strong> [MERSİS numarası]</li>
<li><strong>Telefon:</strong> [Telefon]</li>
<li><strong>E-posta:</strong> hello@maeyja.com</li>
<li><strong>Web sitesi:</strong> maeyja.com</li>
</ul>`;

/** Inserted into an existing KVKK text (before "Toplama yöntemi") when the try-on section is missing. */
export const KVKK_TRYON = `<h2>Sanal deneme (Üzerimde gör)</h2>
<p>“Üzerimde gör” özelliğini kullanırsanız yüklediğiniz fotoğraf, yalnızca seçtiğiniz çantanın sizin üzerinizde gösterildiği görseli oluşturmak için açık rızanızla (KVKK m. 5/1 ve m. 9) yurt dışındaki yapay zekâ hizmet sağlayıcımıza (Google) iletilir. Fotoğraf ve oluşan görsel sunucularımızda kalıcı olarak saklanmaz; görsel en geç 10 dakika sonra silinir. Bu özelliği yalnızca 18 yaşından büyük kullanıcılar, yalnızca kendi fotoğraflarıyla kullanabilir. Rızanızı vermemeniz sitenin diğer bölümlerini kullanmanıza engel değildir.</p>
`;

export const PAGE_BODIES: Record<string, string> = {
  expertise: `<h2 id="design">Tasarım</h2>
<p>Her MAEYJA modeli Fransa'da, tasarımcı Canan Delettre'nin elinden çıkar. Mimari, tasarım, sanat ve müzikten beslenen formlar ilk bakışta yalın görünür; asıl hikâye detaylarda saklıdır. Aranan şey, işlevsel, pratik, duygusal, estetik ve şehirli olan arasındaki doğru denge: kusursuz ve zarif, ama resmiyetten uzak.</p>
<h2 id="materials">Malzeme</h2>
<p>Çantalarımız hakiki deriden üretilir. Deri, damarı ve dokusu incelenerek kesilir; her parçanın en güzel yüzü çantanın en çok görünen yerine gelir. Altın tonlu fermuarlar ve deri çekeceklerle tamamlanır.</p>
<h2 id="craft">Dikiş ve işçilik</h2>
<p>Her model mümkün olduğunca tek parça deriden katlanarak biçimlenir; birleşim yerleri azaldıkça form daha saf, çanta daha dayanıklı olur. Kesim, kenar inceltme, dikiş ve kenar boyası elde yapılır. Bir çantanın atölyeden çıkması yaklaşık iki günlük el işçiliği demektir; üretim sayılıdır.</p>
<h2 id="artisans">Zanaatkârlar</h2>
<p>Tasarım Fransa'da, üretim İstanbul'da. Her MAEYJA çantası İstanbul'daki atölyede, usta deri zanaatkârlarının elinde hayat bulur. İki şehir arasında kurulan bu köprü markanın kalbidir.</p>
<p><a href="/about">Hikâyemiz</a></p>`,

  'shipping-returns': `<h2>Kargo</h2>
<p>Türkiye içindeki tüm siparişlerde kargo ücretsizdir. Siparişiniz 1–3 iş günü içinde hazırlanıp kargoya verilir ve anlaşmalı kargo firmalarımızdan biriyle (Aras, Yurtiçi veya MNG Kargo) adresinize ulaştırılır.</p>
<p>Kargoya verildiğinde takip numaranız e-posta ile gönderilir; siparişinizi hesabınızdan ya da <a href="/order-status">Sipariş takibi</a> sayfasından izleyebilirsiniz.</p>
<p>Her çanta toz torbası içinde ve elle yazılmış bir notla, özenle paketlenerek yola çıkar.</p>
<p>Yurt dışına gönderim için hello@maeyja.com adresine yazabilirsiniz; ülkenize göre süre ve ücreti size bildiririz.</p>
<h2>İade ve cayma hakkı</h2>
<p>Ürünü teslim aldığınız günden itibaren 14 gün içinde, herhangi bir gerekçe göstermeden ve cezai şart ödemeden iade edebilirsiniz.</p>
<ul>
<li>İade talebinizi hesabınızdaki sipariş sayfasından ya da sipariş numaranızla hello@maeyja.com adresine yazarak iletebilirsiniz.</li>
<li>Size bildirdiğimiz anlaşmalı kargo firması ve iade kodu ile gönderdiğiniz iadelerde kargo ücreti ödemezsiniz.</li>
<li>Ürün kullanılmamış olmalı; etiketleri, toz torbası ve orijinal ambalajıyla birlikte gönderilmelidir.</li>
<li>İade bize ulaştıktan sonra en geç 14 gün içinde ödemeniz, ödemeyi yaptığınız yönteme iade edilir. Tutarın kartınıza yansıma süresi bankanıza bağlıdır.</li>
</ul>
<h2>Değişim</h2>
<p>Başka bir model ya da renk tercih ederseniz ürünü iade edip yeni sipariş verebilirsiniz; yardım için bize yazmanız yeterli.</p>
<h2>Hasarlı veya hatalı ürün</h2>
<p>Paket teslimatta hasarlıysa kargo görevlisine tutanak tutturmanızı rica ederiz. Üründe bir hata fark ederseniz fotoğrafıyla birlikte hello@maeyja.com adresine yazın; onarım, değişim ya da iade için hemen dönüş yaparız.</p>`,

  care: `<p>Her MAEYJA çantası hakiki deriden elde kesilip dikilir. Doğru bakımla yıllar içinde güzelleşir ve size ait bir patina kazanır.</p>
<h2>Gündelik kullanım</h2>
<ul>
<li>Tozunu kuru ve yumuşak bir bezle düzenli olarak alın.</li>
<li>Açık renkli çantaları, boyası çıkabilecek yeni kot ve koyu kumaşlarla uzun süre temas ettirmeyin.</li>
<li>Parfüm, el kremi ve alkollü ürünlerin deriyle doğrudan temasından kaçının.</li>
</ul>
<h2>Su ve lekeler</h2>
<ul>
<li>Çanta ıslanırsa kuru bir bezle ovalamadan tamponlayın ve oda sıcaklığında, ısı kaynaklarından uzakta kendi kendine kurumaya bırakın. Saç kurutma makinesi kullanmayın.</li>
<li>Yağ ve mürekkep lekelerini ovalamayın; ıslak mendil, kimyasal temizleyici ya da leke çıkarıcı kullanmayın. Bize yazın, size yol gösterelim.</li>
</ul>
<h2>Besleme</h2>
<p>Yılda iki kez, renksiz bir deri kremini yumuşak bir bezle çok ince bir tabaka hâlinde sürün. Önce görünmeyen küçük bir alanda deneyin.</p>
<h2>Saklama</h2>
<ul>
<li>Kullanmadığınızda içini kâğıtla doldurarak formunu koruyun ve toz torbasında saklayın.</li>
<li>Doğrudan güneş almayan, kuru ve havadar bir yer seçin; plastik poşet ya da kapalı kutuda saklamayın.</li>
<li>Çantaları üst üste koymayın, saplarından asarak uzun süre bekletmeyin.</li>
</ul>
<h2>Onarım</h2>
<p>Fermuar, dikiş ya da kenar boyası için atölyemiz yardımcı olabilir. Fotoğraflarla birlikte hello@maeyja.com adresine yazmanız yeterli.</p>`,

  'preliminary-information': `${UPDATED}
<h2>1. Satıcı bilgileri</h2>
${SELLER}
<h2>2. Konu</h2>
<p>Bu form, 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği uyarınca, maeyja.com üzerinden verilecek siparişten önce alıcının bilgilendirilmesi amacıyla hazırlanmıştır.</p>
<h2>3. Ürünün temel nitelikleri ve fiyatı</h2>
<p>Ürünün adı, rengi, adedi ve vergiler dâhil satış fiyatı sipariş özetinde ve ödeme sayfasında gösterilir. Türkiye içi kargo ücretsizdir; ek bir teslimat masrafı alınmaz.</p>
<h2>4. Ödeme</h2>
<p>Ödeme, iyzico güvenli ödeme altyapısı aracılığıyla kredi kartı/banka kartı ile ya da sipariş sırasında belirtilen hesaba havale/EFT ile yapılabilir. Kart bilgileri satıcı tarafından görülmez ve saklanmaz.</p>
<h2>5. Teslimat</h2>
<p>Ürün, ödemenin onaylanmasından sonra en geç 30 gün içinde, genellikle 1–3 iş günü içinde kargoya verilerek alıcının bildirdiği adrese teslim edilir.</p>
<h2>6. Cayma hakkı</h2>
<p>Alıcı, ürünü teslim aldığı tarihten itibaren 14 gün içinde herhangi bir gerekçe göstermeksizin ve cezai şart ödemeksizin sözleşmeden cayma hakkına sahiptir. Cayma bildirimi hello@maeyja.com adresine ya da yukarıdaki adrese yazılı olarak yapılabilir. Satıcının bildirdiği anlaşmalı kargo firmasıyla yapılan iadelerde iade masrafı alıcıdan istenmez. Ödeme, cayma bildiriminin satıcıya ulaşmasından itibaren 14 gün içinde ödeme yöntemine iade edilir.</p>
<p>Alıcının istekleri veya kişisel ihtiyaçları doğrultusunda hazırlanan ürünlerde (kişiye özel üretim) cayma hakkı kullanılamaz.</p>
<h2>7. Şikâyet ve başvuru</h2>
<p>Şikâyetlerinizi hello@maeyja.com adresine iletebilirsiniz. Uyuşmazlıklarda, Ticaret Bakanlığınca her yıl belirlenen parasal sınırlar dâhilinde alıcının veya satıcının yerleşim yerindeki tüketici hakem heyetlerine, bu sınırları aşan durumlarda tüketici mahkemelerine başvurulabilir.</p>`,

  'distance-sales-agreement': `${UPDATED}
<h2>1. Taraflar</h2>
<p><strong>Satıcı</strong></p>
${SELLER}
<p><strong>Alıcı:</strong> maeyja.com üzerinden sipariş veren ve sipariş sırasında ad, adres ve iletişim bilgilerini bildiren kişi.</p>
<h2>2. Konu</h2>
<p>Bu sözleşme, alıcının maeyja.com üzerinden elektronik ortamda siparişini verdiği ürünün satışı ve teslimine ilişkin olarak 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği hükümleri gereğince tarafların hak ve yükümlülüklerini düzenler.</p>
<h2>3. Ürün, fiyat ve ödeme</h2>
<p>Ürünün türü, rengi, adedi, vergiler dâhil satış bedeli ve ödeme şekli sipariş özetinde ve alıcıya gönderilen sipariş onay e-postasında yer alır ve bu sözleşmenin ayrılmaz parçasıdır. Türkiye içi teslimat ücretsizdir.</p>
<h2>4. Teslimat</h2>
<p>Ürün, ödemenin onaylanmasından itibaren en geç 30 gün içinde alıcının bildirdiği adrese kargo ile teslim edilir. Teslimat sırasında alıcının adreste bulunmaması hâlinde satıcı yükümlülüğünü yerine getirmiş sayılır; kargo firmasının bildirdiği şekilde teslim alınmayan ürün için ek bedel doğarsa alıcıya bildirilir.</p>
<h2>5. Alıcının beyanları</h2>
<p>Alıcı, ödeme öncesinde ön bilgilendirme formunu okuduğunu, ürünün temel nitelikleri, satış fiyatı, ödeme şekli ve teslimata ilişkin bilgileri elektronik ortamda teyit ettiğini kabul eder.</p>
<h2>6. Cayma hakkı</h2>
<p>Alıcı, ürünü teslim aldığı tarihten itibaren 14 gün içinde herhangi bir gerekçe göstermeksizin ve cezai şart ödemeksizin sözleşmeden cayabilir. Cayma bildirimi bu süre içinde hello@maeyja.com adresine veya satıcının adresine yazılı olarak yapılır. Ürün, cayma bildiriminden itibaren 10 gün içinde, kullanılmamış ve yeniden satılabilir durumda, faturası, etiketleri ve ambalajıyla birlikte satıcıya gönderilir. Satıcının bildirdiği anlaşmalı kargo firmasıyla yapılan iadelerde iade masrafı alıcıdan istenmez.</p>
<p>Satıcı, cayma bildiriminin kendisine ulaşmasından itibaren 14 gün içinde ürün bedelini alıcının ödeme yaptığı yönteme iade eder.</p>
<h2>7. Cayma hakkının kullanılamayacağı durumlar</h2>
<p>Alıcının istekleri veya kişisel ihtiyaçları doğrultusunda hazırlanan, kişiye özel üretilen ürünlerde cayma hakkı kullanılamaz.</p>
<h2>8. Ayıplı ürün</h2>
<p>Teslim edilen ürünün ayıplı olması hâlinde alıcı, 6502 sayılı Kanun'un 11. maddesindeki seçimlik haklarını (sözleşmeden dönme, bedel indirimi, ücretsiz onarım veya ayıpsız misli ile değişim) kullanabilir.</p>
<h2>9. Kişisel veriler</h2>
<p>Alıcının kişisel verileri KVKK Aydınlatma Metni'nde belirtilen amaçlarla ve sınırlar dâhilinde işlenir.</p>
<h2>10. Uyuşmazlıklar</h2>
<p>Bu sözleşmeden doğan uyuşmazlıklarda, Ticaret Bakanlığınca her yıl belirlenen parasal sınırlar dâhilinde alıcının veya satıcının yerleşim yerindeki tüketici hakem heyetleri, bu sınırları aşan durumlarda tüketici mahkemeleri yetkilidir.</p>
<h2>11. Yürürlük</h2>
<p>Alıcı, siparişi onaylayarak bu sözleşmenin tüm koşullarını kabul etmiş sayılır. Sözleşme, siparişin onaylandığı anda yürürlüğe girer.</p>`,

  kvkk: `${UPDATED}
<h2>Veri sorumlusu</h2>
<p>6698 sayılı Kişisel Verilerin Korunması Kanunu (“KVKK”) uyarınca kişisel verileriniz, veri sorumlusu sıfatıyla [Şirket unvanı] (“MAEYJA”) tarafından aşağıda açıklanan kapsamda işlenir.</p>
<h2>İşlenen kişisel veriler</h2>
<ul>
<li><strong>Kimlik ve iletişim:</strong> ad, soyad, e-posta, telefon, teslimat ve fatura adresi.</li>
<li><strong>Müşteri işlem:</strong> sipariş, ödeme durumu, iade ve talep kayıtları. Kart bilgileri ödeme kuruluşu iyzico tarafından işlenir; MAEYJA tarafından görülmez ve saklanmaz.</li>
<li><strong>İşlem güvenliği:</strong> IP adresi, oturum ve giriş kayıtları.</li>
<li><strong>Pazarlama:</strong> bülten aboneliği için verdiğiniz e-posta adresi ve dil tercihi.</li>
</ul>
<h2>İşleme amaçları ve hukuki sebepler</h2>
<ul>
<li>Siparişin alınması, ödemenin tamamlanması, teslimat, iade ve müşteri hizmetleri (KVKK m. 5/2-c: sözleşmenin kurulması ve ifası).</li>
<li>Fatura, muhasebe ve yasal saklama yükümlülükleri (m. 5/2-ç: hukuki yükümlülük).</li>
<li>Site ve hesap güvenliğinin sağlanması, kötüye kullanımın önlenmesi (m. 5/2-f: meşru menfaat).</li>
<li>Bülten ve kampanya e-postalarının gönderilmesi (m. 5/1: açık rıza; dilediğiniz an e-postadaki bağlantıyla vazgeçebilirsiniz).</li>
</ul>
<h2>Aktarım</h2>
<p>Kişisel verileriniz yalnızca yukarıdaki amaçlar için gerekli olduğu ölçüde; kargo firmalarına (teslimat), ödeme kuruluşu iyzico'ya (ödeme), barındırma ve e-posta hizmeti sağlayıcılarına (sitenin ve bildirim e-postalarının çalışması) ve talep hâlinde yetkili kamu kurum ve kuruluşlarına aktarılır.</p>
<p>E-posta gönderim altyapısı ve mobil bildirim hizmeti gibi bazı hizmet sağlayıcılarımızın sunucuları yurt dışında bulunabilir; bu aktarımlar KVKK'nın 9. maddesine uygun olarak gerçekleştirilir.</p>
<h2>Sanal deneme (Üzerimde gör)</h2>
<p>“Üzerimde gör” özelliğini kullanırsanız yüklediğiniz fotoğraf, yalnızca seçtiğiniz çantanın sizin üzerinizde gösterildiği görseli oluşturmak için açık rızanızla (KVKK m. 5/1 ve m. 9) yurt dışındaki yapay zekâ hizmet sağlayıcımıza (Google) iletilir. Fotoğraf ve oluşan görsel sunucularımızda kalıcı olarak saklanmaz; görsel en geç 10 dakika sonra silinir. Bu özelliği yalnızca 18 yaşından büyük kullanıcılar, yalnızca kendi fotoğraflarıyla kullanabilir. Rızanızı vermemeniz sitenin diğer bölümlerini kullanmanıza engel değildir.</p>
<h2>Toplama yöntemi</h2>
<p>Verileriniz maeyja.com üzerindeki üyelik, sipariş, iletişim ve bülten formları ile e-posta yazışmaları aracılığıyla, elektronik ortamda toplanır.</p>
<h2>Haklarınız</h2>
<p>KVKK'nın 11. maddesi uyarınca verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, işleme amacını ve amaca uygun kullanılıp kullanılmadığını öğrenme, aktarıldığı üçüncü kişileri bilme, eksik veya yanlış işlenmişse düzeltilmesini, şartları oluştuğunda silinmesini veya yok edilmesini isteme, itiraz etme ve zararın giderilmesini talep etme haklarına sahipsiniz.</p>
<p>Başvurularınızı hello@maeyja.com adresine ya da [Açık adres] adresine yazılı olarak iletebilirsiniz; en geç 30 gün içinde yanıtlanır.</p>`,

  privacy: `${UPDATED}
<h2>Gizlilik</h2>
<p>MAEYJA olarak kişisel verilerinizi yalnızca siparişlerinizi tamamlamak, size hizmet vermek ve izin verdiyseniz sizi yeni koleksiyonlardan haberdar etmek için kullanırız. Nasıl işlendiğini <a href="/kvkk">KVKK Aydınlatma Metni</a>'nde ayrıntılı olarak bulabilirsiniz.</p>
<p>Ödemeler iyzico güvenli ödeme altyapısıyla alınır; kart bilgileriniz bize ulaşmaz. Site trafiği şifreli (HTTPS) bağlantı üzerinden taşınır, hesap şifreleri geri döndürülemez biçimde saklanır.</p>
<h2>Çerezler</h2>
<p>Çerezler, siteyi ziyaret ettiğinizde tarayıcınıza kaydedilen küçük dosyalardır. maeyja.com şu anda yalnızca sitenin çalışması için gerekli çerezleri ve tercihlerinizi hatırlayan kayıtları kullanır:</p>
<ul>
<li><strong>Zorunlu çerezler:</strong> oturumunuzun açık kalması, sepetiniz ve ödeme adımlarının güvenliği.</li>
<li><strong>Tercih kayıtları:</strong> seçtiğiniz dil ve bülten penceresini kapattığınız bilgisi (tarayıcınızın yerel deposunda).</li>
</ul>
<p>Reklam veya üçüncü taraf takip çerezi kullanmıyoruz. İleride ziyaret istatistikleri ya da pazarlama amaçlı çerezler eklenirse, bunlar yalnızca onayınızla çalışır ve bu sayfa güncellenir.</p>
<p>Çerezleri tarayıcınızın ayarlarından silebilir veya engelleyebilirsiniz; zorunlu çerezleri engellemeniz hâlinde sepet ve ödeme gibi bölümler çalışmayabilir.</p>
<h2>İletişim</h2>
<p>Gizlilikle ilgili sorularınız için: hello@maeyja.com</p>`,

  terms: `${UPDATED}
<h2>Kapsam</h2>
<p>maeyja.com'u kullanarak aşağıdaki koşulları kabul etmiş olursunuz. Site, [Şirket unvanı] (“MAEYJA”) tarafından işletilir.</p>
<h2>Fikrî mülkiyet</h2>
<p>Sitedeki tasarımlar, ürün fotoğrafları, videolar, metinler ve MAEYJA markası MAEYJA'ya aittir. Yazılı izin olmadan kopyalanamaz, çoğaltılamaz veya ticari amaçla kullanılamaz.</p>
<h2>Hesabınız</h2>
<p>Hesap bilgilerinizin ve şifrenizin gizliliğinden siz sorumlusunuz. Hesabınızda yetkisiz bir işlem fark ederseniz bize hemen bildirin.</p>
<h2>Fiyat ve stok</h2>
<p>Fiyatlar Türk lirası cinsinden ve vergiler dâhil gösterilir. Açık bir yazım veya sistem hatası nedeniyle yanlış fiyatla verilen siparişlerde sizi bilgilendirir, dilerseniz siparişi iptal ederek ödemenizi tam olarak iade ederiz. Ürünler el yapımı olduğundan stoklar sınırlıdır.</p>
<h2>Siparişler</h2>
<p>Satın alma işlemlerinde <a href="/distance-sales-agreement">Mesafeli Satış Sözleşmesi</a> ve <a href="/preliminary-information">Ön Bilgilendirme Formu</a> geçerlidir.</p>
<h2>Bağlantılar</h2>
<p>Sitede yer alan üçüncü taraf bağlantılarının (ör. Instagram) içeriğinden MAEYJA sorumlu değildir.</p>
<h2>Değişiklikler</h2>
<p>Bu koşullar gerektiğinde güncellenebilir; güncel metin her zaman bu sayfada yer alır.</p>
<h2>Uygulanacak hukuk</h2>
<p>Bu koşullar Türkiye Cumhuriyeti hukukuna tabidir. Tüketici işlemlerinden doğan uyuşmazlıklarda tüketici hakem heyetleri ve tüketici mahkemeleri yetkilidir.</p>`,
};

export const JOURNAL_POSTS: { slug: string; title: string; excerpt: string; body: string; cover: [string, string] }[] = [
  {
    slug: 'origami-kupten-piramide',
    title: 'Origami: küpten piramide',
    excerpt: 'İmza modelimiz tek bir fermuarla iki ayrı forma bürünüyor. Hikâyesi bir kâğıt katlama oyunuyla başladı.',
    cover: ['_home', '13-campaign-studio.webp'],
    body: `<p>Origami, MAEYJA'nın N°01'i. Adını kâğıt katlama sanatından alıyor; çünkü o da tek bir parçanın katlanarak biçim kazanmasından doğdu.</p>
<p>Köşe boyunca uzanan uzun fermuar kapalıyken çanta yumuşak bir küp gibi durur. Fermuarı açtığınızda deri kendi üzerine katlanır ve form bir piramide dönüşür. Aynı çanta, gün içinde iki farklı siluet.</p>
<h2>Az parça, çok düşünce</h2>
<p>Mimari, tasarım ve müzik Canan Delettre'nin en büyük ilham kaynakları. Origami'de de bunu görebilirsiniz: süs yok, gereksiz dikiş yok. Formu taşıyan şey derinin kendisi.</p>
<p>Elde taşınabilir ya da ince askısıyla omuza alınabilir. Kırmızısı imzamız oldu; fildişi, yeşil ve siyah da atölyeden çıkan renkler arasında.</p>
<p><a href="/products/origami">Origami'yi keşfedin</a></p>`,
  },
  {
    slug: 'tek-parca-deriden',
    title: 'Tek parça deriden',
    excerpt: 'Her MAEYJA çantası İstanbul’daki atölyede, usta ellerde kesilip dikiliyor. Bir çantanın yolculuğuna yakından bakış.',
    cover: ['origami', '07-red.webp'],
    body: `<p>MAEYJA çantaları Fransa'da tasarlanıyor, İstanbul'daki atölyemizde hayat buluyor. Her model mümkün olduğunca tek parça deriden çıkıyor; birleşim yerleri azaldıkça form daha saf, çanta daha dayanıklı oluyor.</p>
<h2>Kesim</h2>
<p>Deri, damarı ve dokusu tek tek incelendikten sonra elde kesiliyor. Her parçanın en güzel yüzü, çantanın en çok görünen yerine geliyor.</p>
<h2>Katlama ve dikiş</h2>
<p>Kenarlar inceltiliyor, katlanıyor ve sabırla dikiliyor. Bir çantanın atölyeden çıkması yaklaşık iki günlük el işçiliği demek.</p>
<h2>Son dokunuş</h2>
<p>Kenar boyaları elde sürülüyor, fermuar ve askılar takılıyor, her çanta tek tek kontrol ediliyor. Üretim sayılı; çünkü acele etmiyoruz.</p>
<p><a href="/about">Atölyemiz hakkında</a></p>`,
  },
  {
    slug: 'deriye-ozen',
    title: 'Deriye özen',
    excerpt: 'İyi bakılan deri yıllar içinde güzelleşir. Çantanızı uzun yıllar taşımanız için birkaç basit alışkanlık.',
    cover: ['drape', '05-green.webp'],
    body: `<p>Kaliteli deri yaşayan bir malzemedir: kullandıkça yumuşar, rengi derinleşir, size ait bir patina kazanır. Ona biraz özen göstermek yeterli.</p>
<h2>Nefes alsın</h2>
<p>Kullanmadığınızda çantanızın içini kâğıtla doldurun ve toz torbasında, güneş almayan kuru bir yerde saklayın. Plastik poşetler deriyi nefessiz bırakır.</p>
<h2>Sudan ve ısıdan uzak</h2>
<p>Islanırsa ovalamadan kuru bir bezle tamponlayın ve kendi kendine kurumasını bekleyin. Kalorifer ya da saç kurutma makinesi deriyi sertleştirir.</p>
<h2>Yılda iki kez besleyin</h2>
<p>Renksiz bir deri kremini çok ince bir tabaka hâlinde sürün; önce görünmeyen küçük bir alanda deneyin.</p>
<p>Ayrıntılar için <a href="/care">Deri bakım rehberimize</a> göz atın; bir sorunuz olursa hello@maeyja.com adresinden bize yazın.</p>`,
  },
];
