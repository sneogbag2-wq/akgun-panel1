# Veritabanı Yeniden Tasarım — Onaylı Kararlar ve Devam Noktası

**Son güncelleme:** 2026-08-07  
**Durum:** Şema oluşturuldu. Toplam 46 adet SQL migration ile Supabase şeması ve RLS kuralları uygulanmıştır (Durum: Uygulandı).  
**Ana plan:** `VERITABANI_YENIDEN_TASARIM_PLANI.md`
**Merkezi hesap sözleşmesi:** `SISTEM_HESAPLAMA_MATRISI.md`

## Çalışma yöntemi

- Kurallar aşama aşama ve sıfırdan belirlenecek.
- Mevcut uygulama, kod ve formüller yalnızca örnek/kanıt olarak incelenecek; otomatik olarak doğru kabul edilmeyecek.
- Her önemli iş kuralı kullanıcı tarafından onaylandıktan sonra şemaya ve uygulamaya geçilecek.
- Bu dosyada 4 Ağustos 2026 tarihine kadar önerilmiş bütün iş kuralları kullanıcı tarafından onaylanmıştır. `Onay bekleyen` karar yoktur; yalnızca henüz kuralı veya sayısal değeri hiç tanımlanmamış açık tasarım konuları vardır.

## 1. Organizasyon ve müşteri kapsamı

- Sistem tek bayi için çalışacak; çoklu bayi/tenant yapısı kurulmayacak.
- Müşteri tek kayıttır. Bira/Distile ayrımı müşteri modeli içinde tutulmayacak.
- Aynı müşterinin Bira ve Distile satırları tek müşteri kaydında birleştirilecek.
- Müşteri kodları `500` ile başlayan kodlardır.
- Müşteri kodu Excel'de geldiği biçimiyle metin olarak saklanacak ve diğer dosyalardaki müşteri kodlarıyla birebir eşleşecek.
- Kod üzerinde sıfır ekleme, sayı dönüştürme, parçalama veya benzeri normalizasyon yapılmayacak.
- Excel'deki `Kredi limiti` alanı kullanılmayacak ve içe alınmış kredi limiti hiçbir hesaplamaya kaynak olmayacak.
- Sistem daha sonra kendi verilerinden dahili kredi limiti/önerisi hesaplayacak. Bu formül henüz belirlenmedi.

## 2. Müşteri durumu

- Aynı müşterinin master satırlarından herhangi biri `Aktif` ise müşteri aktif kabul edilir.
- Aktif satır yoksa ve en az bir satır `Pasif` ise müşteri pasif kabul edilir.
- Yalnızca tüm ilgili satırlar iptalse müşteri iptal kabul edilir.
- Pasif veya iptal müşteri, hesaplanan pozitif borçlu bakiyesi `100,00 TL` ve üzerindeyse finansal raporlara dahil edilir.
- Bu müşterilerin borçları bağlı oldukları temsilcinin finansal performansına yansır.
- Pozitif borçlu bakiye 100 TL'nin altındaysa pasif/iptal müşteri finansal performans kapsamına alınmaz.
- Pasif ve iptal müşteriler, bakiyeleri ne olursa olsun sellout ve FKNS hesaplamalarına alınmaz.

## 3. Satış temsilcisi bağlantısı

- Müşteri masterında her müşterinin tek güncel satış temsilcisi olacak.
- Çok az müşteriye bağlı aykırı temsilciler performans hiyerarşisinden çıkarılacak; ancak müşteri kaydı silinmeyecek.
- Örnek Excel setinde yalnızca birer müşteriye bağlı `Ahmet Selçuk` ve `Hüseyin Edizarslan` aykırı temsilci olarak tespit edildi.
- Bu temsilcilere bağlı müşteriler iptal ve hareketsiz olduğu için başka temsilciye yapay olarak atanmayacak; normalleştirilmiş temsilci alanı boş bırakılacak.
- Kaynak Excel'deki ham temsilci adı denetim amacıyla ham veride korunacak.
- Aykırılık için sabit müşteri sayısı kullanılmayacak. Müşteri sayısının 1, 2 veya 10 olması tek başına aykırılık sebebi değildir; bağlantı tutarlılığı esas alınır.
- Her satış temsilcisi normalleştirilmiş yapıda yalnızca bir SSM'ye bağlı olacak.
- Temsilcinin asıl SSM'si, aktif müşterilerindeki SSM dağılımına göre belirlenecek.
- Temsilcinin aktif müşterilerinin en az `%90`ı aynı SSM'ye bağlıysa bu SSM temsilcinin asıl SSM'si kabul edilecek; azınlıkta kalan farklı SSM bağlantıları aykırı master bağlantısı sayılarak asıl SSM'ye taşınacak.
- Baskın SSM oranı `%90`ın altındaysa otomatik düzeltme yapılmayacak; bağlantı manuel kontrol listesine alınacak.
- Aktif müşterisi olmayan temsilci performans hiyerarşisinden çıkarılacak.
- Ancak aktif müşterisi olmayan temsilcinin pasif/iptal müşterilerinde `100 TL ve üzeri` pozitif borçlu bakiye varsa temsilci yalnızca finansal raporlama amacıyla korunacak.
- Kaynak Excel'deki ham temsilci ve SSM adları denetim amacıyla korunacak.

## 4. Kanal sınıflandırması

- Tüm müşteri kanal bilgisi müşteri masterındaki `Satış Kanalı Tanımı` alanından alınacak.
- Sellout dosyasındaki kanal alanları hiçbir kanal sınıflandırması veya FKNS kanal hesabında kullanılmayacak.
- `Standart Açık`, `Horeca`, `Otel` → `Açık Kanal`.
- `Standart Kapalı`, `Ekomini` → `Kapalı Kanal`.

## 5. Sellout ve finansal veri ayrımı

- Sellout performansı aylık değerlendirilir.
- Sellout döneminin tek tarih kaynağı `Faturalama Tarihi` alanıdır.
- Sellout hedef ve temsilci performansının ana ölçüsü litredir.
- Sellout dosyasındaki TL tutarları finansal KPI, ciro, bakiye, tahsilat, risk veya temsilci finansal performansında kullanılmayacak.
- Finansal ciro ve performansın tek kaynağı geçerli müşteri satış faturalarıdır.
- Sellout TL alanları gerekirse yalnızca ham kaynak veride korunabilir.
- Sellout'taki `Muhasebeleşme Durumu Tanımı` entegratör alanıdır; performans filtresi olarak kullanılmayacak ve normalleştirilmiş modele alınması gerekmiyor.

## 6. FKNS kuralları

- FKNS hesapları aylıktır.
- Pasif ve iptal müşteriler FKNS pay ve paydasına dahil edilmez.
- Kanal kırılımı master kanalından gelir.
- Ürün bazlı FKNS temsilci bazında tutulur ve genel fatura FKNS ile aynı benzersiz müşteri mantığını kullanır.
- Rapor ekranında tek ürün veya çoklu ürün seçilebilir.
- Çoklu ürün seçiminde, seçilen ürünlerden en az birini alan benzersiz aktif müşteriler sayılır.
- Aynı müşteri seçilen ürünlerin birkaçını almış olsa da yalnızca bir kez sayılır.
- Ürün bazlı FKNS ile Açık/Kapalı nokta FKNS hedefleri ana performans kriteri değildir; raporlama alanlarında erişilebilir ikincil göstergelerdir.
- FKNS paydası, pozitif faturalama/alım koşulu ve net elde tutulan nokta ayrımı Bölüm 12–13 ile Paket 05 teknik kararında kesinleşmiştir.

## 7. Saha satış müdürü / Dist Satış Şefi (SSM) hiyerarşisi

- SSM kaynağı müşteri masterındaki `Dist Satış Şefi Adı` alanıdır.
- Hiyerarşi: şirket → SSM → satış temsilcisi → müşteri.
- SSM tabloları kendisine bağlı temsilcilerin sonuçlarından şekillenir.
- SSM litre hedefi, bağlı temsilcilerin litre hedeflerinin toplamıdır.
- SSM litre gerçekleşmesi, bağlı temsilcilerin litre gerçekleşmelerinin toplamıdır.
- Örnek Excel setindeki ana SSM'ler: `Mertcan Çınar`, `Yusuf Akdoğan`, `Uğur Ergon`.
- `Yamaç Yolcu`ya bağlı tek aktif müşteri `5000110435`, `Ferhat Fatih İrkin` üzerinden `Yusuf Akdoğan`a bağlanır; çünkü Ferhat'ın diğer 213 müşterisi Yusuf Akdoğan'a bağlıdır.
- `Cemal Can`a bağlı tek müşteri iptal ve temsilcisi aykırı `Ahmet Selçuk` olduğu için performans hiyerarşisine alınmaz.
- Normalleştirme sonrasında kendisine bağlı geçerli temsilci kalmayan SSM performans hiyerarşisinden çıkarılacak.
- SSM aykırılığı sabit müşteri sayısıyla değil, temsilcinin aktif müşteri bağlantılarındaki `%90` baskınlık ve bağlantı tutarlılığı kuralıyla belirlenecek.

## 8. Excel incelemesinden doğrulanan önemli veri kuralları

- Örnek müşteri masterında 3.602 satır ve 1.819 benzersiz kod vardır.
- `500` ile başlayan 3.559 satır, 1.781 benzersiz 10 haneli müşteriye karşılık gelir.
- Kontrol toplamları iki farklı tekrar sayısını verir: tüm kaynakta `3.602−1.819=1.783` fazladan tekrar satırı; geçerli 500'lü kapsamda `3.559−1.781=1.778` fazladan tekrar satırı vardır. `1.783` değeri “geçerli mükerrer müşteri grubu” değildir. Geçerli grupların Bira+Distile çift/single dağılımı gerçek fixture oluşturulmadan önce yeniden doğrulanacaktır.
- Masterdaki kanal bilgisi Bira/Distile çiftlerinde çelişmemektedir.
- `Belgeler` dosyası tahsilat kaynaklarından bağımsız operasyon verisidir. Resmi tahsilat aktarımı ve hesap kapama oluşmadan önce yalnız o gün çıkan siparişlerin sevk/evrak kontrolünde yönlendirici kaynak olarak kullanılacaktır; hiçbir zaman finansal hareket veya ikinci tahsilat oluşturmayacaktır.
- `Aktarılamadı` durumundaki kayıtların `CREATED` görünmesi mümkündür; aktarım durumu ve işlem durumu ayrı kurallar olarak ele alınmalıdır.
- CANCELLED satışlar aynı `Fatura No` yerine aynı `EDOCUMENTNO` ve sipariş numarasıyla CREATED kayda bağlanabilmektedir. İptal eşleştirme anahtarı ileride ayrıca belirlenecektir.

## 9. Ürün paket bölme/birleştirme analizi — onaylandı

- `paket.xlsx` içinde Ağustos 2025–Ağustos 2026 dönemine ait 331 dönüşüm işlemi vardır.
- İşlemler 84 ürün kodunu, 59 yönlü dönüşüm ilişkisini ve 36 bağlantılı ürün ailesini oluşturur.
- Aynı kod çifti için işlemden işleme değişen dönüşüm oranı bulunmamıştır; gözlenen oranlar tutarlıdır.
- Mevcut `KESAN-BAYI-PANEL-main` stok gün modülündeki 44 sabit ileri eşleşmenin tamamı işlem Excel'iyle doğrulanmıştır ve oran uyuşmazlığı yoktur.
- Mevcut sabit tabloda bulunmayan gerçek ileri ilişkiler:
  - `151830 → 154559`, oran `4` — Efes Pilsen 30 cl 24'lü → 6'lı.
  - `151830 → 154558`, oran `2` — Efes Pilsen 30 cl 24'lü → 12'li.
  - `152471 → 152733`, oran `4` — Corona 4×6 koli → 6'lı paket.
  - `152733 → 152417`, oran `0,25` — aynı Corona ailesindeki ters paketleme zincirinin devamı.
- Bazı ailelerde ters yönde gerçek birleştirme işlemleri de vardır. Bu nedenle kaynak/hedef yönü ürünün kalıcı “ana” veya “parçalı” kimliği olarak kullanılamaz.
- Sellout örneğinde 93 benzersiz ürün kodu vardır. Paket işlem ağındaki 17 ailede aynı sellout döneminde birden fazla paket kodu satış görmüştür.
- Kod bazlı FKNS bu ailelerde aynı müşteriyi birden fazla kez sayabilir. Örnekler:
  - Efes Pilsen 50 cl kutu ailesi: kod müşteri toplamı 576, aile bazında benzersiz müşteri 555.
  - Efes Pilsen 30 cl Steinie ailesi: kod müşteri toplamı 502, aile bazında benzersiz müşteri 486.
  - Corona 33 cl ailesi: kod müşteri toplamı 295, aile bazında benzersiz müşteri 283.
- `panel/src/utils/productUtils.ts`, Efes Pilsen 30 cl `154558` ve `154559` kodlarını yanlışlıkla 50 cl ürün kodu `150003` altında toplar. `panel/src/parsers/selloutParser.ts` ise `154558` kodunu `154559`a bağlar ve `154559` için eşleme içermez. Bu iki mevcut uygulama kuralı kendi arasında ve işlem Excel'iyle tutarsızdır; yeni tasarıma taşınmamalıdır.
- Kalıcı model yönlü ana/parçalı harita yerine `ürün ailesi → paket varyantları` yapısı kullanılacak; her kod bir varyant olacak ve dönüşüm fiziksel litre üzerinden yapılacaktır.
- Ürün FKNS, seçilen ürün ailesindeki varyant kodlardan en az birini alan benzersiz aktif müşteriyi bir kez sayacaktır. Paket kodu kırılımı yalnızca detay raporu olacaktır.
- Stok gün hesabında tüm varyant stokları önce litreye çevrilip aile düzeyinde toplanacak; sellout litreleri dönüşüm yapılmadan aynı aile altında toplanacaktır.

## 10. KA İrsaliye, sellout geçmişi ve stok gün analizi — kurallar onaylandı, referans bulguları korundu

### Onaylanan KA dönem ve ortak ürün ailesi kuralları

- KA kayıtlarının dönem ve ay içi talep tarihi, dosyanın her satırında bulunan `Yükleme Tarihi` alanından alınacaktır. Dosyanın sisteme aktarılma zamanı, `İrsaliye Tarihi`, `Fatura Tarihi` ve `İstenen tsl.tarihi` dönem belirlemek için kullanılmayacaktır.
- İncelenen örnek dosyada `Yükleme Tarihi`, `İrsaliye Tarihi` ve `Fatura Tarihi` satır bazında aynı görünse de veri modeli açıkça `Yükleme Tarihi` alanına bağlanacaktır; gelecekte bu alanlar ayrışırsa dönem yine `Yükleme Tarihi` olacaktır.
- KA ve geleneksel Sellout ayrı talep kanallarıdır. Her kanalın geçmiş satışları, hedefi, ürün payı ve ay içi tüketim deseni kendi kaynağında ayrı saklanıp hesaplanacaktır.
- İki kanalda satılan aynı fiziksel ürünler kanal nedeniyle ayrı ürün sayılmayacaktır. Her iki kanalın ürün kodları ortak `ürün ailesi` ve ona bağlı `paket varyantı` modeline bağlanacaktır.
- Kanal talepleri önce kendi kurallarıyla litreye çevrilecek, ardından aynı ürün ailesi düzeyinde toplanacaktır. Aileye bağlı depo stoku yalnızca bir kez düşülecektir.
- KA ürünü ile geleneksel ürünün aynı aileye bağlanması yalnızca ürün kodu/paket dönüşümü ve doğrulanmış ürün masterı üzerinden yapılacaktır; salt ürün adı benzerliği otomatik eşleştirme için yeterli değildir.
- Ortak aile toplamı stok günü ve sipariş ihtiyacında kullanılacak; raporda ise `KA`, `Geleneksel` ve `Toplam` litre katkıları ayrı ayrı görülebilecektir.
- Hedef için gerekli stok miktarı litre olarak ayrıca hesaplanacaktır. Önce her kanalın kalan hedefi `max(0, kanal litre hedefi - kanalın cari ay gerçekleşen litresi)` formülüyle bulunacak, sonra kanalın geçmiş ürün ailesi paylarına dağıtılacaktır.
- Bir ürün ailesinin `hedef için gerekli brüt stok litresi`, `Geleneksel kalan hedef × ailenin Geleneksel payı + KA kalan hedef × ailenin KA payı` olacaktır.
- Aynı ailenin tüm paket varyantlarındaki mevcut stok litreye çevrilip bir kez toplandıktan sonra `net sipariş ihtiyacı (litre) = max(0, hedef için gerekli brüt stok litresi - mevcut aile stok litresi)` hesaplanacaktır.
- Raporda en az `hedef için gerekli brüt stok (L)`, `mevcut stok (L)`, `stok fazlası/eksiği (L)` ve `net sipariş ihtiyacı (L)` ayrı alanlar olarak gösterilecektir. Güvenlik stoğu ayrı ve görünür bir bileşen olacak; politika/formül parametreleri tanımlanana kadar brüt gereksinime sessizce eklenmeyecektir.

### Ani satış patlaması kuralı — onaylandı

- Mevcut örnek algoritmada ürün ailesinin geçmiş payı sabit kalır; ürün hızlı sattığında yalnızca kanalın kalan toplam hedefi azalır. Bu nedenle ani satış patlaması ürünün gerekli litresini artırmak yerine azaltabilir. Bu davranış yeni tasarıma taşınmamalıdır.
- Her ürün ailesi ve kanal için iki kalan talep ayrı hesaplanacaktır: `hedef bazlı kalan talep = kanalın kalan hedefi × tarihsel aile payı` ve `dinamik kalan talep = tahmini ay sonu aile litresi - ailenin cari ay gerçekleşen litresi`.
- Stok gereksiniminde `etkin kalan talep = max(hedef bazlı kalan talep, dinamik kalan talep)` kullanılacaktır. Böylece satılmış litre yeniden sipariş ihtiyacına yazılmaz; ancak güncel hız hedef dağılımını aşıyorsa hedef üstü ek talep dikkate alınır.
- Ani talep Sellout ve KA için ayrı ölçülmelidir. Bir kanaldaki patlama diğer kanalın ürün payını veya talep desenini değiştirmemelidir; iki etkin kalan talep yalnızca ortak ürün ailesi stok hesabında toplanmalıdır.
- Tek günlük/tek siparişlik uç hareketin bütün aya doğrudan yayılmaması için dinamik tahmin, ay içi tarihsel gün dağılımı ile son günlerin gerçekleşen hızını birlikte kullanacaktır. Pencere, ağırlık, asgari veri ve patlama eşiği geçmiş dönem geri testleriyle seçilecek, metrik/model sürümüyle kaydedilecek ve performansa göre kontrollü biçimde güncellenecektir.
- Ürün ailesinde birden fazla paket varyantı varsa gerekli litre tek ve kesindir; `miktar` seçilen ikmal/paket varyantına bağlıdır. Her ailede varsayılan ikmal varyantı tanımlanacak ve `gerekli miktar = tavan(net sipariş litresi / varyantın litre-birim katsayısı)` formülüyle hesaplanacaktır. Alternatif varyant eşdeğerleri raporda gösterilebilir.
- Mevcut uygulamadaki alanlar, sınıflandırmalar ve formüller yeni tasarım için zorunlu kural değildir; yalnızca mevcut davranışı anlamak ve karşılaştırmak için referanstır. Veri kalitesi, fiziksel ürün gerçeği, raporlama amacı veya karar doğruluğu daha iyi bir yaklaşım gerektiriyorsa yeni rapor alanları, formüller ve analiz yöntemleri önerilebilir. Her yeni öneri gerekçesi, varsayımları, beklenen etkisi ve varsa riskleriyle sunulacak; önemli iş kuralları kullanıcı onayı sonrasında kesinleştirilecektir.

### Dinamik talep ve tek seferlik satış ayrımı — onaylandı

- Dinamik tahmin ürün ailesi × kanal × gün düzeyinde çalışacaktır. Satış olmayan günler sıfır talep olarak zaman serisine dahil edilecektir.
- Tarihsel taban talep, tamamlanmış dönemlerden üretilecektir. Yakın dönemlere daha fazla ağırlık verilecek; ancak tek bir yüksek ayın tabanı bozmasını önlemek için uç değerlere dayanıklı bir merkez ölçüsü ve veri güven puanı kullanılacaktır.
- Ayın bugüne kadarki beklenen satışı düz gün oranıyla değil, kanalın tarihsel ay içi dağılımıyla hesaplanacaktır. Örneğin ilgili kanal geçmişte satışının çoğunu ayın son haftasında yapıyorsa ayın 10. günündeki düşük gerçekleşme otomatik olarak zayıf talep sayılmayacaktır.
- Geleneksel Sellout için ani talebin devamlılık güveni; son günlerdeki litre hızı, satış yapılan gün sayısı, belge/satır sayısı ve ürünü alan benzersiz aktif müşteri sayısındaki yayılım birlikte değerlendirilerek üretilecektir. Çok müşteriye yayılan artış, tek müşterideki aynı litre artışından daha güçlü sürdürülebilir talep sinyali sayılacaktır.
- KA için müşteri FKNS kullanılmayacaktır. Ani talebin devamlılık güveni; yükleme günleri, sipariş/irsaliye sayısı, KA müşterisine yayılım ve aynı ailede tekrarlanan yüklemeler üzerinden değerlendirilecektir. Tek bir büyük KA teslimatı gerçekleşen talep olarak sayılacak, fakat yeterli tekrar/yayılım kanıtı yoksa kalan aya tam hızla uzatılmayacaktır.
- Dinamik ay sonu tahmini üç bileşeni ayrı gösterecektir: `tarihsel taban`, `cari gerçekleşme`, `ani talep etkisi`. Formül sonucu tek sayı üretse de raporda artışın hangi bileşenden geldiği açıklanabilir olacaktır.
- Tek seferlik yüksek kayıt veri dışına atılmayacaktır. Gerçekleşen litreye ve stok tüketimine tamamen dahil olacak; yalnızca geleceğe taşınacak tekrar etkisi veri güvenine göre sınırlandırılacaktır.
- Yeni/az geçmişli ürünlerde aile geçmişi yetersizse sırasıyla ürün ailesi, doğrulanmış benzer ürün grubu ve kanal genel dağılımına geri düşülecek; kullanılan yedek seviye raporda belirtilecektir.
- Sabit bir `%50 arttıysa patlama` kuralı tüm ürünlere uygulanmayacaktır. Patlama eşiği ürünün normal oynaklığına, hacmine ve veri güvenine göre dinamik belirlenecektir; yönetici tarafından girilmiş kampanya/lansman bilgisi varsa otomatik tahminin üzerinde açık bir senaryo katmanı olarak gösterilecektir.
- Geleneksel Selloutta fatura olayı, mevcut dosya için `Müşteri No + Satış Belgesi + Faturalama Tarihi` doğal anahtarıyla oluşturulacak; aynı belgedeki aynı ürün ailesine bağlı bütün paket kodu satırları önce litre olarak tek faturada toplanacaktır. Gelecekte gerçek `Fatura No` sağlanırsa birincil belge anahtarı olarak o alan kullanılacaktır.
- Tek müşteri/tek fatura yoğunluğu, aile litresinin aynı müşterinin geçmiş aynı-aile fatura büyüklüğü ile ve kanal genelindeki benzer faturalarla karşılaştırılmasıyla ölçülecektir. Medyan, çeyrekler arası aralık/MAD ve yüzdelik konumu gibi uç değere dayanıklı ölçüler kullanılacak; büyük müşterinin olağan siparişi otomatik olarak anomali sayılmayacaktır.
- Ani artışın yoğunlaşması ayrıca `en büyük faturanın ek litre içindeki payı`, `en büyük müşterinin payı`, `benzersiz müşteri`, `benzersiz belge` ve `satış yapılan gün` göstergeleriyle ölçülecektir. Tek belge/tek müşteri yoğunluğu yüksekse devamlılık güveni düşecek; çok müşteriye ve güne yayılım varsa yükselecektir.
- Bir işlemin tek seferlik olduğu veriden kesin bilinemediği için sistem `tek seferlik` kesin hükmü vermeyecek; `yoğunlaşmış satış / düşük-orta-yüksek devamlılık güveni` sınıflaması yapacaktır. Cari gerçekleşen litre stok tüketimine tam yansıyacak, yalnızca geleceğe taşınan ani talep etkisi devamlılık güveniyle çarpılacaktır.

## 11. AI analiz ve metrik mimarisi — onaylandı, zorunlu

- AI bütün modüllerdeki veri hesaplama mantığını, metrikleri, formülleri, kapsam filtrelerini, dönem tarihini, istisnaları ve boyut ilişkilerini eksiksiz kullanabilmelidir. Hiçbir modül veya kritik metrik AI kapsamı dışında bırakılamaz.
- Dashboard, rapor, dışa aktarım ve AI aynı merkezi metrik/hesaplama katmanını kullanacaktır. Aynı KPI için arayüzde ayrı, AI tarafında ayrı formül yazılmayacaktır; böylece AI cevabı ekrandaki sayı ile birebir yeniden üretilebilir olacaktır.
- Her metrik merkezi metrik sözlüğünde en az şu bilgilerle tanımlanacaktır: kalıcı metrik kimliği, iş anlamı, formül, birim, hesaplama seviyesi, kaynak tablolar/alanlar, dönem tarihi alanı, dahil/dışarıda filtreleri, boyutlar, bağımlı metrikler, boş/negatif veri davranışı, sürüm, geçerlilik başlangıç-bitiş tarihi ve veri kalite koşulları.
- Formül değişiklikleri geçmişi bozmayacaktır. Metrik tanımları sürümlenecek; AI hem `o tarihte geçerli formülle` tarihsel raporu hem de istenirse `bugünkü formülle geçmiş yeniden hesaplama` sonucunu ayrı ve açık biçimde üretebilecektir.
- AI üç zaman katmanını birlikte analiz edebilmelidir: `geçmiş gerçekleşen`, `bugün/cari dönem gerçekleşen ve hedef temposu`, `gelecek tahmin/senaryo`. Gerçekleşen, hedef, tahmin ve yönetici senaryosu aynı alanda karıştırılmayacak; her biri ayrı veri türü ve etiketle tutulacaktır.
- AI gün/hafta/ay/yıl ve seçilen özel dönemlerde karşılaştırma yapabilmeli; önceki dönem, geçen yıl aynı dönem, hedef, cari tempo, tahmin ve ürün/kanal/temsilci/SSM kırılımlarını birlikte yorumlayabilmelidir.
- Her AI cevabı kullanılan dönem, filtreler, metrik sürümü, gerçekleşen-hedef-tahmin ayrımı, veri güncellik zamanı ve varsa veri kalite/güven uyarısını taşımalıdır. Kullanıcı istediğinde hesap adımlarını ve formülü açıklayabilmelidir.
- AI yalnızca sayı döndürmeyecek; değişimin ana nedenlerini, katkı yapan ürün/aile/kanal/müşteri/temsilci boyutlarını, anomalileri, riskleri ve olası aksiyonları açıklayacaktır. Nedensellik kanıtlanmadığında `neden` yerine `ilişkili etken/olası açıklama` dili kullanılacaktır.
- Gelecek analizi tek bir kesin sayı gibi sunulmayacaktır. Tahmin değeriyle birlikte tahmin ufku, yöntem/model sürümü, güven aralığı veya güven seviyesi, varsayımlar ve varsa kampanya/yönetici senaryosu gösterilecektir.
- Tek bayi yapısı korunarak AI; müşteri, temsilci, dist satış şefi, SSM, kanal, ürün ailesi, paket varyantı ve tarih boyutlarında ayrıntıya inebilmeli ve yukarı doğru toplulaştırabilmelidir. Kullanıcının rol/yetki kapsamı AI sorgularında da aynen uygulanacaktır.
- AI cevapları denetlenebilir olacaktır: sorgu, kullanılan veri kesiti/snapshot, metrik sürümleri, formül girdileri ve üretilen sonuç için iz kaydı tutulacaktır. Aynı snapshot ve metrik sürümüyle aynı hesap tekrarlandığında deterministik sonuç üretilecektir.
- Yeni bir modül veya metrik AI sözlüğüne ve doğrulama testlerine eklenmeden tamamlanmış sayılmayacaktır. Tanımsız metrikte AI tahmin yürütüp sayı uydurmayacak; eksik tanımı/veriyi açıkça bildirecektir.

## 12. FKNS payda ve uygun müşteri evreni — onaylandı

- FKNS paydası satış yapan müşterilerden türetilmeyecek; satıştan bağımsız `uygun aktif müşteri evreni` üzerinden kurulacaktır. Böylece düşük satış, paydayı küçültüp FKNS oranını yapay biçimde yükseltemeyecektir.
- Aylık genel FKNS paydası, ilgili dönem kesim tarihinde durumu `Aktif` olan ve seçilen temsilciye bağlı benzersiz geleneksel kanal müşterileridir. Cari ay için kesim tarihi raporun çalıştırıldığı tarih; tamamlanmış ay için ayın son günüdür.
- Geçmiş FKNS bugünkü masterla geriye dönük hesaplanmayacaktır. Müşteri durumu, temsilci, SSM ve kanal bağlantıları geçerlilik tarihli tutulacak; her ayın paydası o ayın dönem sonu snapshot'ından yeniden üretilebilecektir. Eski dönem için snapshot yoksa AI bunu veri kısıtı olarak açıklayacaktır.
- Açık Kanal FKNS paydası yalnızca master kanal eşlemesinde `Açık Kanal` olan aktif müşterilerden; Kapalı Kanal FKNS paydası yalnızca `Kapalı Kanal` olan aktif müşterilerden oluşacaktır. Sellout dosyasındaki kanal, paydayı veya müşteri kanalını değiştirmeyecektir.
- Master kanalı boş, tanımsız veya onaylı Açık/Kapalı eşlemesinin dışında olan müşteri kanal FKNS paydalarına sessizce eklenmeyecek; `kanalı sınıflandırılamayan aktif müşteri` veri kalite listesinde gösterilecektir. Genel geleneksel FKNS'ye dahil edilip edilmeyeceği, müşterinin geleneksel kanal uygunluk işaretinden açıkça belirlenecektir.
- Genel fatura FKNS oranı `dönemde geçerli fatura bulunan benzersiz uygun aktif müşteri / uygun aktif müşteri paydası` olacaktır. Müşteri aynı ayda birden çok fatura alsa da bir kez sayılacaktır.
- Ürün FKNS'nin standart uygunluk kapsamı `ürün ailesi × kanal` düzeyinde tarihçeli bir matrisle tanımlanacaktır. Örneğin yalnızca Açık Kanal'a uygun bir ürün, Kapalı Kanal müşterileri nedeniyle cezalandırılmayacaktır. Müşteri segmenti standart FKNS paydasını kendiliğinden değiştirmeyecek; ancak açıkça tanımlanmış ürün hedef/uygunluk kuralında veya kullanıcı filtresinde kullanılabilecektir.
- Ürün uygunluğu gerçekleşen satış oranından otomatik türetilmeyecektir. Mevcut uygulamadaki ürün bir kanalda `%5`ten az satıldıysa kanalı ilgisiz sayma ve ürün adındaki `Fıçı/Kutu` kelimesiyle otomatik payda silme yaklaşımı yeni tasarıma taşınmayacaktır.
- Bir ürün ailesi için kanal uygunluk kuralı yoksa sistem resmi/hedef ürün FKNS üretmeyecek; ayrı bir `ham ürün penetrasyonu = ürünü alan aktif müşteri / seçili kanaldaki tüm aktif müşteri` metriği gösterecek ve uygunluk tanımının eksik olduğunu belirtecektir.
- Çoklu ürün OR seçiminde pay, seçilen ailelerden en az birini alan benzersiz uygun aktif müşterilerdir; payda ise seçilen ürünlerin uygun müşteri evrenlerinin birleşimidir. Aynı müşteri hem payda hem pay içinde yalnızca bir kez sayılır.
- Temsilci, SSM ve şirket FKNS oranları alt grup yüzdelerinin basit ortalamasıyla hesaplanmayacaktır. İlgili seviyedeki benzersiz paylar ve benzersiz paydalar toplanarak `toplam benzersiz pay / toplam benzersiz payda` hesaplanacaktır.
- Her FKNS sonucu `pay`, `payda`, `oran`, `fatura/ürün alan müşteri listesi`, `almayan müşteri listesi`, `dışlanan müşteri sayısı ve dışlanma nedenleri` ile açıklanabilir olacaktır.
- Pozitif faturalama/alım, tam iade ve iptal edilmiş belge davranışı Bölüm 13 ve Paket 04/05 ile kesinleşmiştir: pozitif olay FKNS payını, müşteri×ay×aile net litre `>0` ise ayrı net elde tutulan nokta metriğini oluşturur.

### Müşteri segmentinin analitik kullanımı — onaylandı

- `A Diamond` gibi müşteri segmentleri master kaynağından alınacak ve geçerlilik tarihli müşteri boyutu olarak saklanacaktır. Segment, müşteri kimliği veya kanal yerine geçmeyecektir.
- Segment bilgisi raporlardan bağımsız AI sorgularında ve isteğe bağlı filtrelerde kullanılacaktır. Örneğin `A Diamond müşterilerde X ürün ne kadar satılmış?` sorgusu; ilgili dönemde segmentte bulunan müşteriler ile seçilen ürün ailesinin bütün paket varyantlarını kesiştirerek Sellout litresini hesaplayacaktır.
- Bu tür sorgularda dönem belirtilmemişse AI belirsizliği açıkça belirtecek ve varsayılan cari ay sonucunu tarih aralığıyla birlikte sunacaktır. `Ne kadar satılmış` ifadesinin varsayılan ölçüsü litre olacaktır; miktar, benzersiz müşteri veya finansal ciro istenirse ilgili doğrulanmış metrik ayrıca kullanılacaktır.
- Segment bazlı finansal ciro sorularında Sellout TL kullanılmayacak; onaylı kurala uygun geçerli müşteri satış faturaları kullanılacaktır.
- Segment filtresi standart performans KPI'larını sessizce değiştirmeyecektir. Bir rapor/AI cevabı segment filtresiyle üretildiyse filtre sonucu ve payda kapsamı açıkça gösterilecektir.

## 13. Pozitif satış, iade, iptal ve negatif litre — onaylandı

- Sellout hareketleri işaretleri silinmeden saklanacaktır. `pozitif satış`, `ürün iadesi/kredi`, `belge iptal/ters kayıt`, `teknik/ambalaj hareketi` ayrı işlem türleri olacaktır; yalnızca litre veya ürün kodu öneki işlem türünü kesinleştirmek için yeterli sayılmayacaktır.
- Örnek Selloutta 70 negatif satır ve toplam `-1.000,17 L` vardır. Bunların 69'u `2` ile başlayan, çoğunlukla `TEK ŞİŞE/TEK KUTU` adlı ürün kodlarında toplam `-950,17 L`; biri `152101 / EFES PİLSEN FIÇI 50 L` için `-50 L`dir. `2` kodlu satırları topluca yok sayan mevcut yaklaşım yeni tasarıma taşınmayacaktır.
- Negatif ürün kodları doğrulanmış ürün ailesine bağlanacaktır. Öncelik sırası `orijinal satış/iade belge bağlantısı`, `ürün masterındaki iade ürün eşlemesi`, `onaylı manuel eşleme` olacaktır. Salt ad benzerliği kesin eşleme üretmeyecektir.
- Her ürün ailesi ve dönem için ayrı metrikler üretilecektir: `brüt satış litresi = pozitif geçerli satışların toplamı`, `iade litresi = ürün iadelerinin mutlak litre toplamı`, `net satış litresi = brüt satış - iade ve geçerli ters kayıt etkisi`, `iade oranı = iade litresi / brüt satış litresi`.
- Sellout litre hedef gerçekleşmesi ve temsilci/SSM ürün hacim performansı net satış litresi üzerinden değerlendirilecektir. İadeler gizlenmeyecek; brüt satış, iade ve net sonuç birlikte gösterilecektir.
- Önerilen resmi genel fatura FKNS davranışı: müşteri dönemde en az bir geçerli pozitif satış faturası aldıysa bir kez sayılır. Tek başına iade/kredi belgesi müşteriyi FKNS payına eklemez. Orijinal satış belgesi iptal/ters kayıtla tamamen geçersiz kılınmışsa o belge FKNS oluşturmaz; gerçek bir ürün iadesi ise gerçekleşmiş faturalama olayını geriye dönük silmez.
- Önerilen resmi ürün FKNS davranışı genel fatura FKNS ile aynı olacaktır: müşteri seçilen ürün ailesinde en az bir geçerli pozitif satış satırı aldıysa bir kez sayılır; iade satırı tek başına ürün FKNS oluşturmaz. Tamamı iade edilmiş ürün noktaları ayrıca `net elde tutulan ürün noktası` metriğinde dışlanacak ve kalite/kalıcılık analizi olarak raporlanacaktır.
- `Net elde tutulan ürün noktası`, müşteri × ay × ürün ailesi düzeyinde net litre `> 0` olan benzersiz müşteri sayısıdır. Çoklu ürün OR seçiminde seçili ailelerden en az birinde net litre `> 0` olan müşteri bir kez sayılacaktır.
- Belge iptali ile ürün iadesi aynı sayılmayacaktır. İptal/ters kayıtta orijinal ve ters belge bağlantısı korunacak; operasyonel posting ayı görünümü ile orijinal satış dönemini yeniden ifade eden analiz görünümü AI tarafından ayrı sunulabilecektir.
- Negatif Sellout satırı fiziksel kullanılabilir stoğa otomatik eklenmeyecektir. Kredi/iade belgesi ürünün depoya, sağlam ve satılabilir durumda döndüğünü kanıtlamaz. Anlık kullanılabilir stok yalnızca stok kaynağından alınacak; iade kabul/depo giriş verisi ileride sağlanırsa stok hareketine o olayla bağlanacaktır.
- Talep tahmini ve stok gün modelinde varsayılan gerçekleşen tüketim `net satış litresi` olacaktır; model ayrıca brüt talep ve iade oranını ayrı özellikler olarak izleyecektir. Olağandışı iade artışı talep düşüşüyle aynı yorumlanmayacak, ayrı risk/anomali olarak açıklanacaktır.
- Sellout dosyasındaki negatif `Net/Brüt` değerler finansal ciro veya müşteri bakiyesi hesabına girmeyecektir. Finansal iade, alacak dekontu ve iptal etkisi yalnızca geçerli finansal fatura/belge kaynağından hesaplanacaktır.
- Eksik belge tipi veya ürün eşlemesi nedeniyle sınıflandırılamayan negatif hareket silinmeyecek; `sınıflandırılamayan negatif litre` metriğinde gösterilecek ve resmi KPI'a etkisi veri kalite uyarısıyla açıklanacaktır.

## 14. Tam kapsamlı stok güvenliği ve sipariş ihtiyacı — kapsam ilkesi onaylandı

- Ayrıntılı stok, talep, güvenlik stoğu, tedarik, sipariş, risk, geri test, senaryo ve AI açıklama metrikleri `STOK_METRIK_KATALOGU.md` dosyasında tam kapsamlı taslak olarak tanımlanmıştır. Metrikler kullanıcı kararıyla tutulacak, değiştirilecek veya çıkarılacaktır.
- Stok, talep, güvenlik stoğu ve sipariş modülü kapsamı tasarım aşamasında daraltılmayacaktır. İlgili bütün metrikler, formüller, bağımlılıklar ve veri alanları tanımlanacak; hangi metriklerin kullanılacağına, gösterileceğine veya kaldırılacağına kullanıcı karar verecektir.
- Her metrik için üç ayrı yönetim durumu olacaktır: `hesaplansın/hesaplanmasın`, `karar-sipariş formülünde kullanılsın/kullanılmasın`, `ekranda gösterilsin/gizlensin`. Bir metriği gizlemek hesap formülünden sessizce çıkarmayacak; bağımlılık değişikliği açıkça gösterilecek ve sürümlenecektir.
- Kullanıcı tarafından yapılan metrik ekleme/çıkarma, eşik, yöntem ve formül bileşeni değişiklikleri tarihçeli konfigürasyon olarak tutulacak; AI geçmiş sonucu o tarihte geçerli konfigürasyonla açıklayabilecektir.
- Tam kapsamlı stok girdileri uygun kaynak sağlandıkça şunları içerecektir: kullanılabilir stok, bloke/karantina stok, ayrılmış-rezerve stok, geri sipariş/backorder, kesinleşmiş yoldaki stok, beklenen giriş tarihi, tedarik süresi, minimum sipariş miktarı, paket/kat yuvarlaması, geleneksel ve KA kanal talebi, iade oranı, hedef bazlı talep, dinamik tahmin, kampanya/takvim etkisi, tahmin hatası, servis seviyesi ve ürün ailesi ikmal varyantı.
- KA İrsaliye yoldaki stok değildir; KA talep/satış kanalıdır. Yoldaki stok yalnızca satın alma/transfer siparişi veya depo giriş kaynağında ürün kodu, miktar, beklenen tarih ve geçerli durumla doğrulanmışsa hesaba katılacaktır. Veri yoksa değer `0` kabul edilmeyecek, `bilinmiyor/veri sağlanmadı` olarak tutulacaktır.
- `Stok pozisyonu = kullanılabilir stok + hesaba katılabilir kesinleşmiş yoldaki stok - ayrılmış stok - backorder` olarak hesaplanacaktır. Kaynağı bulunmayan bileşenler sıfır varsayılmadan veri kalite durumu taşıyacaktır.
- `Tedarik süresi talebi`, ürün ailesinin kanal bazlı günlük tahminleri kullanılarak sipariş tarihinden beklenen giriş tarihine kadar gün gün hesaplanacaktır. Tek sabit günlük ortalama zorunlu olmayacak; haftanın/ayın farklı gün desenleri ve bilinen kampanya-takvim etkileri kullanılabilecektir.
- Güvenlik stoğu birden fazla yöntemle hesaplanabilir olacaktır: tahmin hatasının tedarik süresindeki dağılımına dayalı istatistiksel yöntem, servis seviyesi/quantile yöntemi, tampon gün yöntemi ve min-max stok günü politikası. Hangi yöntemin karar formülünde aktif olduğu kullanıcı konfigürasyonuyla belirlenecek; diğer yöntemler karşılaştırma/senaryo metriği olarak korunabilecektir.
- Tercih edilen istatistiksel yaklaşım yalnızca geçmiş günlük talep sapmasını değil, gerçek `tahmin hatasını` ölçecektir. Yeterli geçmiş yoksa ürün ailesi/benzer grup/kanal seviyesine geri düşecek veya basit tampon gün yöntemini kullanacak; kullanılan yöntem ve güven seviyesi açıkça gösterilecektir.
- `Yeniden sipariş noktası = tedarik süresi boyunca beklenen talep + aktif güvenlik stoğu` olacaktır.
- `Hedef için brüt stok gereksinimi = etkin kalan talep + aktif güvenlik stoğu + varsa onaylı ek koruma ihtiyacı` olarak bileşenlerine ayrılacaktır.
- `Net sipariş ihtiyacı = max(0, hedef için brüt stok gereksinimi - stok pozisyonu)` olacaktır. Sipariş miktarı `tavan(net sipariş litresi / ikmal varyantının litre-birim katsayısı)` ile paket birimine çevrilecek; minimum sipariş ve kat kuralları varsa son aşamada uygulanacaktır.
- Sistem en az şu metrikleri tanımlayacaktır: brüt/kullanılabilir/net stok, stok pozisyonu, günlük tahmini talep, tedarik süresi talebi, güvenlik stoğu, yeniden sipariş noktası, stok günü, güvenlikli stok günü, tahmini tükenme tarihi, hedeften gerekli litre, net sipariş litresi ve miktarı, fazla stok, eksik stok, yavaş/ölü stok, stokout riski, tahmin güveni, yoldaki stok gecikme riski ve sipariş yuvarlama fazlası.
- Kritik durum tek bir sabit renge indirgenmeyecek; `stok tükendi`, `tedarik süresi içinde tükenecek`, `yeniden sipariş noktasının altında`, `sipariş gerekli`, `yeterli`, `fazla stok`, `talep geçmişi yetersiz` ve `veri eksik` gibi açıklanabilir durumlar üretilebilecektir. Kullanıcı istediği durumları ana ekrana ekleyip çıkarabilecektir.
- Ana ekran, detay raporu ve AI aynı metrik kataloğunu kullanacak; kullanıcı ana ekranı sadeleştirebilse de metrik tanımı kaybolmayacaktır. AI hangi metriğin aktif formülde kullanıldığını, hangisinin yalnızca karşılaştırma amaçlı hesaplandığını açıklayacaktır.

## 15. Son yüklenen anlık kullanılabilir stok — aktif verinin üzerine yazma kuralı onaylandı

- Mevcut uygulamada bulunmayan ayrı bir `Anlık Stok / Malzemeler` Excel yükleme alanı eklenecektir. Bu alan Ticari Stok yüklemesinden ve diğer veri türlerinden bağımsızdır.
- Kullanıcı `Malzemeler` dosyasını günlük veya ihtiyaç duyduğu anda yükler. Başarılı her yükleme mevcut aktif stok satırlarının tamamının yerini atomik olarak alır; günlük stok snapshot geçmişi ve stok hareket defteri tutulmaz.
- Yeni dosya önce staging alanında bütünüyle parse edilir ve doğrulanır. Kritik hata, eksik zorunlu sütun veya belirsiz ürün kodu varsa mevcut son geçerli stok silinmez; ancak yeni dosya başarıyla yayımlandıktan sonra eski aktif satırlar tek işlemde kaldırılır ve yenileri etkinleşir.
- Aktif stok veri modeli `current_stock_import` ve `current_stock_item` olarak kurulacaktır. Yalnız bir `current_stock_import` aktif olabilir. Önceki stok değerleri AI geçmiş karşılaştırması, stok farkı veya günlük trend üretmek için saklanmayacaktır; genel yükleme denetiminde yalnız dosya hash'i, yükleme zamanı, kullanıcı, satır/kontrol sayıları ve başarı durumu kalabilir.
- Mevcut `Malzemeler (1).xlsx` gerçek örneği 80 satır ve üç sütundur: `Malzeme numarası`, `Malzeme tanımı`, `Tahditsiz kullanılabilir`. 80 kodun tamamı benzersiz, dolu, pozitif ve tam sayıdır; örnekte mükerrer, negatif veya boş kod yoktur.
- Dosyada açık stok tarihi olmadığı için aktif stoğun `as_of_at` değeri Europe/Istanbul sistem yükleme zamanıdır. Dosyanın işletim sistemi değiştirilme zamanı iş tarihi kabul edilmez.
- Mevcut dosyada depo/lokasyon alanı olmadığı için ilk model tek varsayılan bayi deposuyla çalışır. İleride açık depo/lokasyon alanı gelirse parser sürümüyle ayrıştırılır; bugünkü dosyadan lokasyon uydurulmaz.
- `Tahditsiz kullanılabilir`, bayi deposundaki kullanılabilir paket varyantı miktarının tek fiziksel stok kaynağıdır. Bloke, karantina, ayrılmış, backorder, alış, transfer, iade veya yoldaki stok bu değerden türetilmez ve aktif stok formülüne eklenmez.
- `Kullanılabilir stok litresi = Tahditsiz kullanılabilir miktar × geçerli varyant litre/koli katsayısı`dır. Aynı ürün ailesindeki 6'lı, 12'li ve diğer varyantların miktarları doğrudan toplanmaz; önce ayrı ayrı litreye çevrilir, sonra aile litresi olarak birleşir.
- Litre katsayısı eksik/şüpheli varyant sıfır kabul edilmez. Doğrulanmış kısmi litre, dönüşümü eksik kod/miktar ve coverage görünür; resmi aile toplamı eksik kalite durumuyla işaretlenir.
- Aynı yüklemede aynı malzeme kodu birden fazla satırdaysa otomatik toplama yapılmaz. Tam mükerrer karantinaya, çelişkili miktarlar manuel kontrole gider; yükleme kritik kapsamı etkiliyorsa yayınlanmaz.
- Yeni yüklemede önceki dosyaya göre kod sayısı veya toplam litre olağandışı değişmişse yayın öncesi uyarı verilebilir; ancak eski stok satırları tutulmadığı için bu fark kalıcı stok geçmişi/metriği yapılmaz.
- Stokta bulunup satış geçmişinde bulunmayan ürün rapordan düşmez; `talep geçmişi yok / stok günü hesaplanamadı` olarak gösterilir.
- Sistem aktif stoktan Sellout/KA satışını düşerek ertesi gün gerçek stok üretmez ve gelen alışları eklemez. Yeni gerçek stok yalnız yeni Malzemeler yüklemesiyle değişir.
- Yeni dosya yüklenmezse son başarılı aktif stok, yükleme zamanı ve bayatlık uyarısıyla kullanılmaya devam eder; eksik gün için interpolasyon veya yapay stok değeri üretilmez.
- Yoldaki stok ve açık satın alma siparişi aktif stok/sipariş karar formülünde kullanılmaz. Ürün geldiğinde ancak sonraki Malzemeler yüklemesindeki `Tahditsiz kullanılabilir` değerde görünür.
- Aktif stok pozisyonu `son başarılı Malzemeler yüklemesinin geçerli kullanılabilir aile stok litresi`dir. Gelecek stok projeksiyonu yalnız tahmin/senaryodur; gerçek stok verisi değildir.
- Stok miktarı rapor ve kartlarda koli bazında, litreyle birlikte gösterilecektir: `X koli • Y litre`.
- Aynı ürün ailesindeki farklı paket varyantlarının ham miktarları doğrudan toplanmayacaktır. Önce tüm varyantlar litreye çevrilecek, ardından ailenin onaylı ikmal/gösterim varyantının `litre/koli` katsayısıyla `eşdeğer koli = aile stok litresi / gösterim varyantı litre-koli katsayısı` hesaplanacaktır.
- Anlık stok ekranında farklı 6'lı, 12'li ve diğer paket varyantları ayrı stok satırları/kartları olarak gösterilecektir. Her varyant kendi gerçek `koli/miktar` değeri ve kendi fiziksel litresiyle görülecek; anlık görünümde varyantlar tek satıra indirgenmeyecektir.
- Anlık stok görünümünde ürün ailesi toplamı ayrıca özet olarak gösterilebilir; ancak 6'lı/12'li varyant ayrıntısı kaybolmayacaktır.
- Anlık stok varyant görünümünde kaynak miktar/koli değeri korunacaktır. Stok-gün ekranında ana stok koduna çevrilen eşdeğer koli kesirli çıksa bile kullanıcıya standart en yakın tam koliye yuvarlanarak gösterilecektir. Kesin eşdeğer değer ve toplam litre sistemde korunacaktır.
- Litre/koli katsayısı veya gösterim varyantı tanımlı değilse litre gösterilecek, koli alanı `hesaplanamadı` olacaktır; sistem tahmini koli üretmeyecektir.
- Stok gün hesabında paket varyantları ayrı ürün sayılmayacaktır. Aynı ailedeki bütün varyant stokları önce fiziksel litreye çevrilip toplanacak, ardından ailenin açıkça tanımlanmış `ana stok kodu` altında tek hesap satırına indirgenecektir.
- `Ana stok kodu` paket işlem yönünden veya ürün adından otomatik seçilmeyecek; ürün ailesinde tarihçeli `canonical_stock_variant_id` olarak açıkça tanımlanacaktır. İç sistem kimliği yine değişmez ürün ailesi kimliği olacak, kullanıcıya stok gün kartında ana ürün kodu gösterilecektir.
- Stok gün hesabındaki ana-kod koli eşdeğeri `toplam aile stok litresi / ana stok kodunun litre-koli katsayısı` olacaktır. Stok günü ve tükenme simülasyonu toplam aile litresi üzerinden yapılacak; koli eşdeğeri yalnızca miktar gösterimi ve sipariş dönüşümü için kullanılacaktır.
- Stok-gün kartındaki gösterim `round(ana-kod kesin koli eşdeğeri) koli • toplam aile litresi` olacaktır. Bu gösterim yuvarlaması stok günü, tükenme tarihi, güvenlik stoğu veya sipariş ihtiyacı hesaplarının girdisi olmayacaktır.
- Ana stok kodu ile varsayılan ikmal/sipariş varyantı ayrı alanlardır; istenirse aynı kod seçilebilir, fakat sistem bunları zorunlu olarak aynı kabul etmeyecektir.

## Ticari Stok Excel yüklemesi ve ayrı rapor modülü — onaylandı

- Mevcut uygulamada bulunmayan ayrı bir `Ticari Stok` Excel yükleme alanı ve `Ticari Stok Raporu` eklenecektir. Malzemeler/Anlık Stok ile aynı alan, tablo veya API kullanılmayacaktır.
- `Ürünler.xlsx` ticari stok kaynağıdır. Örnek dosya 5.869 ürün satırı; 2.101 belge, 863 müşteri, 71 malzeme ve 14 dosya temsilcisi içerir. Doğal `Belge Numarası + Müşteri No + Malzeme Kodu` anahtarında örnekte mükerrer yoktur.
- Ticari stok, bayi deposunda kullanılabilir stok değildir. Müşteri/nokta üzerinde kalan ticari/emanet ürünü gösterir; Malzemeler stoğuna, stok gününe, güvenlik stoğuna, tükenme tarihine veya sipariş ihtiyacına eklenmez ve bunlardan düşülmez.
- Kaynaktan kimlik/boyut olarak yalnız gerekli alanlar alınır: bayi/satış organizasyonu gerekiyorsa kaynak kapsamı, `Belge Numarası`, `Müşteri No`, `Müşteri Ad`, `Müşteri Grubu`, `Malzeme Kodu`, `Malzeme Açıklaması`, `Ürün Hiyerarşi Tanımı`, `Tanım` ve dosyadaki temsilci bilgisi. Kanal ve resmi organizasyon bağı Master'dan gelir; dosya temsilcisi yalnız çapraz kontrol/provenance alanıdır.
- Ticari stokun kullanılacak tek sayısal ölçüleri `Depoda Kalan Mk.` ve `Depoda Kalan Lt.` alanlarıdır. `Sevk Edilmiş Mik.`, `Sevk Edilmiş Lt.`, `Toplam Mik.` ve `Toplam Lt.` parse edilse bile normalize ticari stok modeline, hesaplara, raporlara veya AI araçlarına alınmayacaktır.
- Varsayılan aktif rapor yalnız `Depoda Kalan Lt. > 0` satırlarını gösterir. Negatif değer veri kalite hatasıdır; `Depoda Kalan Mk. > 0` iken litre `≤0` veya tersi birim/kapsam çelişkisi olarak manuel kontrole gider. Sıfır kalan satırlar aktif stok kartına girmez.
- Örnek dosyada 426 pozitif kalan satır; 103 belge, 81 müşteri, 38 ürün ve 8 dosya temsilcisi vardır. Toplam kaynak kalan değeri `12.800 Mk.` ve `151.185,59 L`dir. Bu kontrol toplamları parser regresyon testinde birebir korunacaktır.
- `Depoda Kalan Mk.` farklı ürün/paketlerde aynı fiziksel birimi garanti etmediği için şirket, SSM, temsilci veya müşteri genel toplamının ana ölçüsü litre olacaktır. Miktar ürün/varyant satırında gösterilir; yalnız aynı malzeme/varyant içinde toplanabilir. Farklı ürünlerin miktarlarını tek bir anlamlı koli toplamı gibi sunmak yasaktır.
- Ticari Stok yüklemesi de tam güncel durum dosyasıdır. Başarılı yeni yükleme mevcut aktif ticari stok satırlarının tamamının yerini atomik olarak alır. Hatalı yükleme son geçerli raporu bozmaz; eski satırlardan ticari stok değişim/trend metriği üretilmez.
- Ticari Stok raporu müşteri→ürün ayrıntısı, ürün→müşteri dağılımı, temsilci ve SSM litre toplamları, müşteri/ürün/temsilci yoğunlaşması, Master kanal/segment kırılımı, pasif/iptal müşteride kalan stok ve veri kalite istisnalarını sunacaktır.
- Müşteri kartında toplam kalan litre, farklı ürün kalem sayısı ve ürün satırlarında `Malzeme Kodu/Adı`, paket/ambalaj, kalan miktar ve kalan litre gösterilir. Ürün görünümünde benzersiz stoklu müşteri sayısı ile toplam kalan litre bulunur.
- Temsilci/SSM sonuçları oran ortalamasıyla değil ham kalan litrelerin toplamıyla üretilir. Master'daki sorumluluk esas alınır; dosya temsilcisi farklıysa veri kalite uyarısı verilir.
- Ticari stok için TL değer, maliyet, satış değeri, ciro, tahsilat, FKNS veya finansal risk uydurulmayacaktır; kaynakta güvenilir fiyat/maliyet yoktur. AI ticari stoğu “müşteride kalan ürün” diye adlandırır, bayi depo stoğu veya satış gerçekleşmesi gibi yorumlamaz.
- AI en az `müşteride kalan ticari stok`, `ürünün hangi noktalarda kaldığı`, `temsilci/SSM ticari stok yoğunluğu`, `pasif/iptal noktadaki stok`, `en yoğun müşteri/ürünler` ve `dosya–Master sorumluluk farkı` sorularını merkezi metriklerden cevaplayacaktır. Yoğun sonuçlar ortak görsel/PDF/XLSX rapor üretimine bağlanacaktır.

## 16. Ürün varyantı litre katsayısı — Sellout kaynaklı hesap onaylandı

- `Malzemeler (1).xlsx` içindeki 80 stok kodunun 74'ünde Sellout veya KA hareketlerindeki `Litre / Miktar` oranı doğrudan ve istikrarlı biçimde gözlenebilmektedir. Aynı malzeme kodundaki Sellout `Miktar` biriminin stok miktarıyla uyumlu olduğu iş kuralı kabul edilmiştir; bu oran otomatik litre katsayısının resmi kaynağı olabilir.
- Tam kesinleşmeyen altı stok kodu şunlardır:
  - `152304 / Glenfiddich 18YO 70cl`: stok miktar biriminin şişe mi koli mi olduğu kaynakta doğrulanmıyor.
  - `152236 / Monkey Shoulder 6×70cl`: ambalajdan `4,2 L/koli` türetilebilir; ürün/paket masterı ile kesinleştirilmelidir.
  - `151840 / Bud 24×50cl`: ambalajdan `12 L/koli` türetilebilir; ürün/paket masterı ile kesinleştirilmelidir.
  - `151428 / Efes Xtra Shot`: gözlemlenen oranlarda kaynak yuvarlaması vardır; kanonik aday `5,688 L/koli`dir.
  - `150164 / Efes Pilsen 50cl Steinie 6×4`: ambalajdan `12 L/koli` türetilebilir; ürün/paket masterı ile kesinleştirilmelidir.
  - `3046 / CO2 depozito tüpü`: hacimle izlenen satış ürünü değildir; `volume_tracked=false` olarak litre ve stok-gün hesabı dışında tutulmalıdır.
- Her paket varyantında en az `quantity_uom`, `units_per_case`, `unit_volume_ml`, `litres_per_stock_unit`, `volume_tracked`, `conversion_source`, `verification_status`, `valid_from` ve `valid_to` alanları tutulacaktır.
- Sellouttan otomatik aday katsayı yalnızca aynı malzeme kodundaki geçerli pozitif, `Miktar > 0` ve `Litre > 0` satırlardan `sellout_litres_per_quantity = Σ Litre / Σ Miktar` formülüyle hesaplanacaktır. İade/negatif ve iptal/ters kayıtlar katsayı öğrenme örneklemine dahil edilmeyecektir.
- Sistem ayrıca satır oranlarının dağılımını kontrol edecektir. Oranlar kaynak yuvarlaması dışında tutarlıysa aday otomatik doğrulanacak; farklı paket/birim karışımı gösteren anlamlı sapma varsa tek katsayı üretmek yerine kod `birim tutarsız` olarak işaretlenecektir.
- Katsayı basit satır oranı ortalamasıyla hesaplanmayacaktır; yüksek miktarlı ve düşük miktarlı satırların kaynak yuvarlamasından farklı etkilenmesini azaltmak için toplam litre/toplam miktar oranı kullanılacak, robust medyan ve yayılım yalnızca doğrulama ölçüsü olacaktır.
- Sıvı ürün için temel formül `litres_per_case = units_per_case × unit_volume_ml / 1000`; günlük snapshot hesabı `stock_litres = uploaded_available_quantity × litres_per_stock_unit` olacaktır.
- Katsayı kaynak önceliği `istikrarlı Sellout Litre/Miktar hesabı → KA'da istikrarlı Litre/Miktar hesabı → doğrulanmış paket dönüşüm işlemi → onaylı ürün/paket masterı veya kullanıcı onaylı manuel katsayı` olacaktır. Birden fazla kaynak varsa sonuçlar çapraz doğrulanacak ve uyuşmazlık gizlenmeyecektir. Ürün adı yalnızca aday üretir, resmi katsayı oluşturmaz.
- Ürün mevcut Sellout döneminde görünmüyorsa sistem bütün doğrulanmış Sellout geçmişinde son geçerli katsayıyı arayacaktır. Hiç gözlem yoksa KA/paket/master geri düşmeleri kullanılacak; yine bulunamazsa litre ve stok günü hesaplanmayacaktır.
- Katsayısı kesinleşmemiş hacim ürünü için litre, aile stok toplamı ve stok günü resmi olarak hesaplanmayacak; ham miktar gösterilecek ve eksik dönüşüm uyarısı verilecektir.
- Katsayı değişikliği geçmiş snapshotları sessizce değiştirmeyecek. Eski sonuç eski geçerlilik sürümüyle korunacak; istenirse AI bugünkü katsayıyla yeniden hesaplanmış karşılaştırmayı ayrıca sunacaktır.

## 17. Stok günü ve tükenme tarihi — onaylandı

### Referans uygulamadan taşınmayacak davranışlar

- Geleneksel ve KA'nın farklı ay içi desenlerini tek bir haftalık şekle birleştirmek.
- Günlük veriyi yalnızca `1–7 / 8–14 / 15–21 / 22–son` dört kovasına indirgemek ve her kovada sabit hız varsaymak.
- Satış olmayan ama veri kapsamı bulunan gün/ayları ortalamadan çıkarmak; bu davranış talep hızını şişirebilir.
- Hedef temelli hız sıfır olduğunda birden çok ayın birikmiş hafta litresini ay sayısına bölmeden yalnızca `7`ye bölmek.
- Sellout için `Girilen Faturalama Tarihi`, KA için `İrsaliye Tarihi` kullanmak; onaylı tarihler sırasıyla `Faturalama Tarihi` ve satırdaki `Yükleme Tarihi`dir.
- Sabit 2026 tatil katsayılarını gelecek yıllara taşımak.
- Stok 400 günde tükenmezse gerçek sonuçmuş gibi `400 gün` göstermek.

### Önerilen stok-gün hesap akışı

- Hesap `ürün ailesi × gün` seviyesinde yapılacaktır. Anlık 6'lı/12'li varyant stokları fiziksel litreye çevrilip ana stok kodunda toplam aile litresi olarak kullanılacaktır; ana kod koli yuvarlaması yalnızca gösterimdir.
- Gelecek günlük talep önce kanal bazında ayrı tahmin edilecektir: `günlük aile talebi = günlük Geleneksel tahmin + günlük KA tahmin`. Kanalların tarihsel gün/hafta/ay desenleri birbirine karıştırılmayacaktır.
- Geleneksel eğitim tarihi `Faturalama Tarihi`, KA eğitim tarihi `Yükleme Tarihi` olacaktır. Geçerli iade kurallarından sonra net litre varsayılan gerçekleşen talep; brüt litre ve iade oranı ayrı açıklayıcı özellikler olacaktır.
- Veri dosyasının ilgili günü eksiksiz kapsadığı doğrulanıyorsa satış olmayan gün `0` talep olarak modele girecektir. Dosya/gün kapsamı eksikse gün `veri yok` olacaktır; sıfırla doldurulmayacaktır.
- Tek sabit model bütün ürünlere zorlanmayacaktır. Düzenli yüksek hacimli, mevsimsel, aralıklı ve yeni ürünler için aday modeller ayrı olacak; ürün ailesi × kanal için model ve geçmiş pencere rolling-origin geri testte tahmin hatası, bias ve operasyonel stockout/fazla stok maliyetine göre seçilecektir.
- Düzenli talepte tarihsel taban, yakın dönem ağırlığı, hafta-günü ve ay-içi desenleri; aralıklı talepte Croston/SBA/TSB benzeri yöntemler; yeni üründe ürün ailesi/benzer doğrulanmış grup/kanal geri düşmesi veya yönetici senaryosu kullanılabilecektir. Kullanılan yöntem AI tarafından açıklanacaktır.
- Bilinen kampanya, tatil ve özel gün etkisi tarihçeli takvim/olay tablosundan gelecektir. Veri olmayan etkinlik için sabit çarpan uydurulmayacaktır.

### Hedef ile dinamik tahminin günlük birleştirilmesi

- Her kanal ve ürün ailesi için daha önce onaylanan `hedef bazlı kalan talep` ve `dinamik kalan talep` ayrı korunacaktır.
- Dinamik kalan talep hedef bazlı kalandan büyük/eşitse günlük dinamik tahmin yolu kullanılacaktır.
- Hedef bazlı kalan daha büyükse aradaki pozitif fark, kanalın kalan ay tarihsel gün ağırlıklarına dağıtılarak dinamik günlük tahmine eklenecektir: `etkin günlük talep = dinamik günlük tahmin + hedef farkı × normalize edilmiş kalan-gün ağırlığı`.
- Böylece hedef talebi dinamik tahmini azaltmayacak, yalnızca eksik kalan hedef bileşenini ekleyecektir. Geleneksel ve KA katkıları gün bazında ayrı gösterilebilir olacaktır.
- Cari ay sonrasına taşan stok hesabında aylık hedef sonsuza kadar tekrar edilmeyecek; gelecek tamamlanmamış aylar için seçili talep modeli ve varsa o aya tanımlanmış hedef/senaryo kullanılacaktır.

### Tükenme simülasyonu ve gösterim

- Aktif başlangıç stoğu en güncel geçerli günlük kullanılabilir aile stok litresidir. Onaylı politika gereği yoldaki stok, alış ve depo girişi gerçek stok projeksiyonuna eklenmeyecektir.
- Her gelecek gün için `projected_stock(d) = projected_stock(d-1) - effective_daily_demand(d)` hesaplanacaktır. Bu seri tahmindir; son yüklenen aktif Malzemeler stoğunun yerine gerçek stok olarak kaydedilmeyecektir.
- Tahmini tükenme tarihi, projeksiyon stoğun ilk kez `≤ 0` olduğu gündür. Gün içindeki kesir `önceki gün kalan litre / tükenme gününün tahmini litresi` ile hesaplanacaktır.
- `Stok günü = tükenme tarihine kadar tam günler + kesirli gün` olacaktır. Hesap kesin litreyle yapılacak; kullanıcıya stok günü için uygulanacak görsel yuvarlama ayrıca tanımlanacaktır.
- Tahmin ufku içinde stok tükenmiyorsa tavan gün kesin sonuç gibi yazılmayacak; örneğin yapılandırılmış ufuk 365 günse `>365 gün / ufukta tükenmiyor` gösterilecektir.
- Gelecek tahmini talebin tamamı sıfır veya hesaplanamazsa stok günü `sonsuz` ya da `400` olmayacak; `talep tahmini yok — stok günü hesaplanamadı` olacaktır.
- Fiziksel tükenmeye kadar `stok günü` ile güvenlik stoğu eşiğine kadar `güvenlikli stok günü` ayrı metrikler olacaktır. Güvenlik stoğu yöntemi sonraki kuralda seçilecektir.
- Günlük snapshot yükleme kesimi `gün sonu` olarak tanımlanırsa tüketim ertesi günden; `gün içi` olarak tanımlanırsa snapshot saatinden sonraki gün-parçasından başlayacaktır. Aynı günün satışını iki kez düşmemek için kesim türü snapshot üzerinde saklanacaktır.

### Doğrulama ve AI açıklaması

- Tahmin talebi Sellout/KA gerçekleşenleriyle geri test edilecektir. Önceki Malzemeler stok değerleri tutulmadığı ve alış/transfer/sayım hareketleri izlenmediği için stok yüklemeleri arasından talep doğrulaması veya açıklanamayan stok farkı metriği üretilmeyecektir.
- AI bir stok-gün cevabında en az başlangıç stok litresini, ana kod ve varyant kapsamını, Geleneksel/KA günlük talep katkısını, model sürümünü, hedef ekini, tahmin güvenini, kesim tarihini ve tükenme hesabını açıklayabilecektir.

- `İrsaliye Listesi (2).xlsx` yalnızca Temmuz 2026 dönemini kapsar: 1.587 satır, 78.635,96 litre, 41 ürün kodu ve paket işlem ağına göre 40 ürün ailesi.
- KA dosyasındaki tüm satırlar `Key Account Sipariş` tipindedir. Geçersiz tarih, negatif/sıfır litre, mükerrer doğal anahtar veya `2` ile başlayan ürün kodu yoktur.
- Mevcut uygulama KA İrsaliye verisini FKNS, tahsilat ve DSO'ya dahil etmez; yalnızca litre toplamına, ürün talebine ve stok gün hesabına ekler.
- Temmuz 2026 için stok hesabına uygun sellout 724.871,614 litre, KA İrsaliye 78.635,96 litredir. Birleşik 803.507,574 litrenin `%9,79`u KA kanalından gelir.
- İki kanalın ay içi satış deseni belirgin biçimde farklıdır:
  - Sellout hafta payları `1–7: %15,66`, `8–14: %20,49`, `15–21: %19,85`, `22–son: %43,99`.
  - KA hafta payları `1–7: %2,28`, `8–14: %24,29`, `15–21: %43,36`, `22–son: %30,07`.
- Mevcut stok gün kodu kanal hedeflerini ve ürün paylarını ayrı hesaplamasına rağmen haftalık zaman desenini iki kanalın birleşik litre geçmişinden üretir. Veri, kanal desenlerinin ayrı tutulması gerektiğini göstermektedir.
- Mevcut kod sellout stok geçmişinde ve sellout arşiv ayı seçiminde `Girilen Faturalama Tarihi` kullanır. Onaylı kural ise `Faturalama Tarihi`dir.
- Örnek selloutta iki tarih alanı 758 satırda farklıdır; 5 satır başka aya kayar ve tarih farkı bulunan satırlar toplam 81.215,108 litre taşır. Yeni tasarım yalnızca onaylı `Faturalama Tarihi`ni kullanmalıdır.
- Selloutta 70 negatif litre satırı vardır; toplamı `-1.000,17` litredir. Bunların 69'u `2` ile başlayan kodlardır ve toplam `-950,17` litredir. Stok ürün geçmişi bu 69 satırı dışarıda bırakırken genel sellout litre toplamı içinde tutar.
- `2` ile başlamayan tek negatif satır `152101 / EFES PİLSEN FIÇI 50 L` için `-50` litredir. Bu kayıt mevcut stok talebi geçmişine dahildir. İade/negatif litre davranışı daha sonra Bölüm 13'te net litre ve iade sınıflamasıyla onaylanmıştır; bu eski gözlem açık karar sayılmaz.
- Paket işlem ağıyla mevcut durumda iki kanalda ortak görünen 23 ürün ailesi vardır. Ancak KA'ya özgü multipack kodların önemli bölümü paket işlem ağında bulunmadığı için aynı fiziksel ürün ayrı stok kartlarına bölünür.
- Güçlü isim/ambalaj adayları arasında `151815` ve `151292 → 151271` Efes Malt; `151400 → 150021` Efes Pilsen; `151835 → 151918` Bud; `151765 → 151247` Bomonti; `150138 → 150137` MGD 33 cl; `151915 → 151420` MGD 50 cl; `151752 → 150487` Efes Xtra bulunur. Bunlar otomatik birleştirilmeyecek, ürün masterı/işlem kanıtıyla onaylanacaktır.
- `Malzemeler (1).xlsx` içinde 80 stok kodu vardır. Sellout/KA gözlemlerinden 74 kodun litre katsayısı doğrudan doğrulanabilir; 6 kodda katsayı yok veya yuvarlama farkı vardır.
- Stokta olup geçmiş satışta görünmeyen ürünler mevcut kodda stok gün tablosuna hiç girmeyebilir; yeni tasarım bunları `talep geçmişi yok / stok günü hesaplanamadı` durumuyla göstermelidir.
- Mevcut stok gün örnek formülü:
  - Her kanal için son 6 tamamlanmış arşiv ayı seçilir; iki kanalın ayları birleştirilir.
  - Aylara eskiden yeniye doğrusal `1..N` ağırlığı verilir.
  - Kalan kanal hedefi `max(0, kanal hedefi − bu ayki kanal satışı)` olarak bulunur.
  - Kalan kanal hedefi, kanalın geçmiş ürün paylarıyla ürünlere dağıtılır.
  - Ürünün birleşik kalan hedefinden litreye çevrilmiş depo stoğu düşülerek gerekli sipariş litresi hesaplanır.
  - Talep ayın dört dilimine ayrılır ve stok bugünden başlayarak gün gün azaltılır.
  - Güvenlik stoğu örneği `1,65 × günlük sigma × √3` formülüdür. Bu yalnızca mevcut uygulama bulgusudur; yeni tasarımın servis seviyesi ve tedarik süresi politikası henüz tanımlanmamıştır.
- Mevcut formülde hedef temelli hız sıfırsa altı aylık hafta-dilimi toplamı doğrudan `7`ye bölünerek geçmiş hıza dönülür. Ay sayısına bölünmediği için birden fazla ay mevcutken organik günlük hız gereğinden yüksek hesaplanabilir.
- Tatil katsayıları yalnızca 2026 için sabit ve varsayımsaldır; yeni tasarıma otomatik taşınmayacaktır. Yeni takvim etkisi politikası henüz tanımlanmamış açık tasarım konusudur.

## 18. Güvenlik stoğu, koruma süresi ve kritik eşik — onaylandı

### Temel anlam ve veri sınırı

- Güvenlik stoğu fiziksel stok veya ayrı bir depo bakiyesi değildir. Talep tahminindeki belirsizliğe karşı kullanılan planlama tamponudur; son başarılı aktif Malzemeler stoğuna eklenmez.
- Sistem alış, açık sipariş, tahmini varış ve fiili tedarik süresi hareketlerini izlemediği için gözlemlenmiş bir `tedarik süresi` üretmeyecektir. Bunun yerine planlama amacıyla `koruma_süresi_gün` kullanılacaktır.
- `koruma_süresi_gün` kullanıcı tarafından genel varsayılan olarak tanımlanabilecek, ürün ailesi bazında istisna verilebilecek ve geçerlilik tarihleriyle sürümlenecektir. Eksik koruma süresi tahmin edilip uydurulmayacaktır.
- Yoldaki stok ve açık sipariş mevcut politikada hem gerçek stoktan hem sipariş kararından hariçtir. Ürün geldiğinde ancak yeni Malzemeler yüklemesindeki aktif kullanılabilir stokta gerçek stok haline gelir.

### Talep, güvenlik stoğu ve eşiklerin ayrılması

- `Koruma süresi talebi = bugünden sonraki koruma süresindeki etkin günlük talep toplamı` olacaktır. Geleneksel ve KA ayrı tahmin edilip ürün ailesinde toplanacaktır.
- `Güvenlik stoğu`, koruma süresinin beklenen talebini değil yalnızca bu tahminin yukarı yönlü hata/belirsizlik tamponunu temsil edecektir.
- `Kritik stok eşiği / yeniden sipariş noktası = koruma süresi talebi + aktif güvenlik stoğu` olacaktır.
- `Güvenlik stoğuna iniş tarihi`, projeksiyon stoğunun ilk kez yalnızca `SS` seviyesine indiği tarih; `kritik eşiğe iniş tarihi` ise ilk kez `koruma süresi talebi + SS` seviyesine indiği tarih olacaktır. İki kavram aynı adla gösterilmeyecektir.
- Planlama ufku talebi zaten bütün koruma süresini kapsıyorsa koruma süresi talebi sipariş ihtiyacına ikinci kez eklenmeyecektir. `Planlama ihtiyacı = planlama ufku etkin talebi + SS`; yeniden sipariş noktası ise zaman/acıliyet sinyalidir.
- Fiziksel stok günü sıfır litreye, güvenlikli stok günü `SS` eşiğine, kritik eşik günü ise `koruma süresi talebi + SS` eşiğine kadar ayrı hesaplanacaktır.

### Ana güvenlik stoğu yöntemi

- Önerilen ana yöntem, ürün ailesinin seçilmiş talep modeliyle yapılan rolling-origin geri testlerden oluşan koruma süresi kümülatif tahmin hatası dağılımıdır.
- Her geçmiş kesim için `E_H = gerçekleşen H-günlük net talep - o kesimde tahmin edilen H-günlük talep` hesaplanacaktır; burada `H = koruma_süresi_gün`dür.
- `SS_quantile = max(0, Q_servis(E_H))` olacaktır. Böylece yalnızca yukarı yönlü tahmin açığını karşılayan litre tamponu üretilir.
- Servis seviyesi sabit kodlanmayacak; örneğin `%90`, `%95`, `%98` gibi değerler kullanıcı konfigürasyonu olacaktır. Değer ürün ailesi istisnası ve geçerlilik tarihiyle sürümlenecektir.
- Yeterli ve temsili hata gözlemi varsa sipariş kararında kullanılacak varsayılan yöntem `quantile` olacaktır; dağılımın normal olduğu varsayılmayacaktır.

### Geri düşme ve karşılaştırma yöntemleri

- Hata geçmişi yetersizse geri düşme sırası `doğrulanmış benzer aile/grup hata dağılımı → tampon gün yöntemi → kullanıcı onaylı manuel güvenlik stoğu` olacaktır. Hangi geri düşmenin kullanıldığı sonuçla birlikte saklanacaktır.
- Tampon gün yöntemi `SS_days = seçilen gelecek günlük talep yolunun tampon gün içindeki toplamı` olacaktır; değişken günlük talep varken yalnızca ortalama günlük talep ile çarpma zorunlu olmayacaktır.
- Normal yaklaşım `z × tahmin_hatası_sigma × sqrt(H)` ve min-max yaklaşımı katalogda karşılaştırma/senaryo yöntemleri olarak korunacaktır. Kullanıcı açıkça etkinleştirmedikçe karar formülüne girmeyecektir.
- Aralıklı talepte sıfır günler veri kapsamı tam ise dağılıma dahil edilecek; ampirik quantile, aralıklı talebe uygun modelin gerçek geri test hatalarından üretilecektir.
- Yeni veya geçmişi yetersiz üründe güvenlik stoğu `0` kabul edilmeyecektir. Geçerli geri düşme yoksa sonuç `hesaplanamadı`; kullanıcı güvenlik stoğunu özellikle kapatmışsa açık politika nedeniyle `0` olacaktır.

### Ani satış, iade ve olay davranışı

- Tek müşteri/tek faturadaki ani toplu satış gerçekleşen talepte korunacak; geleceğe devam güveni düşükse tahmin modelinde sınırlı ağırlık aldığı gibi güvenlik stoğu hata geçmişini de kalıcı olarak şişirmeyecektir. Olay işareti ve ham/olay-düzeltilmiş sonuç karşılaştırılabilir olacaktır.
- Çok müşteri, çok belge ve çok güne yayılan artış gerçek talep rejimi değişikliği adayıdır; yakın dönem hata dağılımı ve güvenlik stoğu buna daha hızlı uyarlanabilecektir.
- İade ve iptal daha önce onaylanan hareket sınıflandırmasına göre net talepte ele alınacak; fiziksel stoğa otomatik eklenmeyecektir. Negatif satır güvenlik stoğunu yapay olarak düşürmeyecektir.
- Kampanya veya bilinen olay talebi baz tahmine eklenmişse aynı risk için ayrıca keyfi güvenlik stoğu eklenmeyecek; olay talebi ile belirsizlik tamponu ayrı bileşenler olacaktır.

### Karar, doğrulama ve gösterim

- Her yöntem için güvenlik stoğu litresi, ana kod kesin koli eşdeğeri, kullanılan servis seviyesi, koruma süresi, örnek sayısı, geri düşme seviyesi, veri kesim tarihi ve parametre/model sürümü saklanacaktır.
- Ekranda litre kesin değer olarak; koli eşdeğeri mevcut ana kod gösterim kuralıyla yuvarlanmış olarak gösterilebilecektir. Bütün hesaplar kesin litreyle yapılacaktır.
- Yöntemler rolling-origin simülasyonda `koruma süresi içinde talebi karşılayamama oranı`, eksik litre, ortalama/fazla stok litre-günü ve hedef servis seviyesine uyumla karşılaştırılacaktır. WAPE tek başına güvenlik stoğu yöntemi seçmeyecektir.
- Sistem en iyi yöntemi ve servis seviyesini önerebilir; aktif karar konfigürasyonu kullanıcı onayı olmadan sessizce değiştirilmeyecektir.
- AI her güvenlik stoğu cevabında fiziksel stok ile tamponu ayıracak; aktif yöntem, `H`, servis seviyesi, hata örneği, geri düşme, SS litre/koli eşdeğeri, kritik eşik ve sonuç güvenini açıklayabilecektir.

## 19. Merkezi sistem hesaplama matrisi — oluşturuldu

- Müşteri, organizasyon, Sellout/KA, FKNS, ürün-paket, hedef, tahmin, stok, güvenlik stoğu, sipariş, finansal, veri kalitesi, senaryo ve AI hesaplarının tamamı `SISTEM_HESAPLAMA_MATRISI.md` içinde kalıcı metrik kimlikleriyle tanımlanmıştır.
- Her metrik kaynak/dönem alanı, kayıt seviyesi, bağımlılık, kesin formül, filtre, eksik ve negatif veri davranışı, yuvarlama ve karar durumu taşır.
- Onaylı metrik, onay bekleyen öneri, kaynağı olmayan metrik ve politika gereği pasif metrik ayrı durumlarla tutulur. Sistem onaysız veya eksik kuralı resmi sonuç üretmek için çalıştıramaz.
- Hesaplar bağımlılık grafiğiyle `ham veri → kimlik → hareket → gerçekleşen → model → stok → projeksiyon → karar` sırasıyla çalıştırılır. Başarısız bağımlılık sessizce sıfırlaştırılamaz.
- Dashboard, rapor, dışa aktarım ve AI aynı metrik sonucu ve sürümünü kullanacaktır. AI için ayrı formül yazılmayacaktır.

## 20. AI rapor yorumlama ve görüş üretme davranışı — onaylandı

- AI hiçbir raporu yalnızca düz tablo, alan listesi veya sayıların cümle halinde tekrarı olarak sunmayacaktır. Her rapor ve anlamlı metrik için iş anlamı, uygun karşılaştırma, katkı yapan boyutlar, anomali/risk, gelecek etkisi ve uygulanabilir AI görüşü üretme yeteneği olacaktır.
- AI geçmişi, bugünü ve geleceği birlikte değerlendirecek; ancak `gerçekleşen`, `analitik çıkarım`, `tahmin`, `senaryo` ve `öneri` katmanlarını açıkça ayıracaktır.
- AI'ın kendi fikri veriye dayalı analitik değerlendirme ve aksiyon önerisidir. Kaynakta olmayan sayı, olay veya nedensellik uydurmak anlamına gelmez.
- Yüksek veya düşük tek bir metrik doğrudan iyi/kötü olarak yorumlanmayacaktır. AI ilgili hedefi, geçmiş tempoyu, müşteri/belge yoğunlaşmasını, iade etkisini, kanal/ürün katkısını, stok veya finansal sonucu birlikte kontrol edecektir.
- AI önemli bulguları etki, sapma, risk ve karar önceliğine göre sıralayacaktır. Önemsiz her alanı tekrarlamayacak; fakat kullanıcı sorduğunda matristeki her alanı açıklayıp yorumlayabilecektir.
- Bir yorumu destekleyecek veri bulunmuyorsa AI yapay yorum üretmeyecek; veri kısıtını ve hangi ek bilginin gerekli olduğunu söyleyecektir.
- Her çıkarım ve öneri dayandığı merkezi metrik sonuçlarına, dönem/snapshot'a ve sürüme kadar izlenebilir olacaktır.
- Rapor türü bazındaki zorunlu yorum kapsamı ve çıktı türleri `SISTEM_HESAPLAMA_MATRISI.md` içindeki AI yorumlama matrisinde tanımlanmıştır.

## 21. Dinamik talep modeli geri testi ve sürümlü model seçimi — onaylandı

### Seçim seviyesi ve zaman disiplini

- Tek bir tahmin modeli bütün ürünlere uygulanmayacaktır. Resmi model `ürün ailesi × kanal` seviyesinde seçilecek; Geleneksel ve KA ayrı modeller kullanabilecektir.
- Her geri test kesiminde yalnız o kesim tarihinde sistemde bulunabilecek veri kullanılacaktır. Gelecek gün, sonradan düzeltilmiş master, gelecek hedef veya sonradan bilinen kampanya bilgisi geçmiş kesime sızdırılmayacaktır.
- Geleneksel gerçekleşen tarihi `Faturalama Tarihi`, KA gerçekleşen tarihi `Yükleme Tarihi` olacaktır. Kaynak kapsamı doğrulanmış satışsız günler `0`; eksik günler `NULL` olacaktır.
- Tahmin ve model seçimi her çalıştırmada `as_of_at`, eğitim başlangıç/bitiş tarihi, veri snapshot'ları, model kodu, hiperparametreler ve takvim/olay sürümüyle dondurulacaktır.

### Aday model havuzu

- Her aile-kanal serisi önce `düzenli`, `mevsimsel`, `aralıklı` veya `yeni/yetersiz` talep sınıfına ayrılacaktır. Sınıflandırma sonucu tek başına model seçmeyecek; yalnız aday havuzunu daraltacaktır.
- Düzenli talepte en az naif son dönem, hareketli/üstel ağırlıklı taban ve hafta-günü/ay-içi desenli adaylar bulunacaktır.
- Yeterli çok dönemli geçmişte mevsimsel naif ve mevsimsellik içeren adaylar ayrıca yarışacaktır. Bir yıllık desen, yeterli yıllık kanıt olmadan varsayılmayacaktır.
- Aralıklı talepte Croston, SBA ve TSB benzeri aralıklı talep adayları ile uygun naif karşılaştırma bulunacaktır.
- Yeni/yetersiz üründe sırasıyla aynı ürün ailesinin kullanılabilir geçmişi, doğrulanmış benzer ürün grubu, kanal dağılımı ve açık yönetici senaryosu geri düşmeleri değerlendirilecektir. Kullanılan seviye sonuçta açıklanacaktır.
- Mevcut uygulama modeli yalnızca bir `legacy/reference challenger` olarak geri teste alınabilir; otomatik olarak resmi model kabul edilmeyecektir.

### Rolling-origin geri test düzeni

- Geri test tek bir eğitim/test bölmesine dayanmayacaktır. Birden fazla tarih kesiminde model yeniden eğitilip o tarihten sonraki gerçek talep tahmin edilecektir.
- İki operasyonel ufuk birlikte test edilecektir: `cari ayın kalan günleri` ve onaylı `koruma_süresi_gün`. Günlük tahmin doğruluğu ayrıca izlenecek; yalnız aylık toplamı tutan fakat gün desenini kaçıran model stok günü için başarılı sayılmayacaktır.
- Kesim tarihleri ayın yalnız dört sabit kovasına bağlanmayacaktır. Hesap kapasitesine göre günlük veya en fazla haftalık adımlı kesimler kullanılacak; ayın başı, ortası ve sonu yeterince temsil edilecektir.
- Model, aynı kesimlerde basit naif adaylara karşı test edilecektir. Naif modele anlamlı ve istikrarlı üstünlük sağlamayan karmaşık model yalnız karmaşık olduğu için seçilmeyecektir.

### Başarı ve seçim kuralları

- Tahmin doğruluğunda en az `WAPE`, `MAE`, `bias`, koruma ufku kümülatif hata, tahmin aralığı kapsaması ve quantile kullanılıyorsa pinball loss hesaplanacaktır. Sıfır/düşük talepte bozulduğu için MAPE ana seçim metriği olmayacaktır.
- Operasyonel simülasyonda tahmini stokout/eksik litre, güvenlik eşiği ihlali ve fazla stok litre-günü birlikte ölçülecektir. Önceki Malzemeler stok değerleri tutulmadığı için yüklemeler arası fark talep doğrulaması sayılmayacaktır.
- Model seçimi tek ve keyfi ağırlıklı puana mahkûm edilmeyecektir. Önce veri yeterliliği ve ciddi sistematik bias kontrolü, sonra koruma/ay-kalan ufuk başarısı, ardından WAPE ve operasyonel eksik-fazla stok dengesi uygulanacaktır.
- Sonuçlar birbirine yakınsa daha basit, daha istikrarlı ve daha açıklanabilir model seçilecektir. Modelin yalnız birkaç kesimde çok iyi olup diğerlerinde bozulması istikrar cezası alacaktır.
- Maliyet veya servis öncelikleri kullanıcı tarafından daha sonra verilirse model sıralamasına sürümlü iş ağırlıkları olarak eklenebilecektir; sistem bilmediği stokout/fazla stok TL maliyetini uydurmayacaktır.

### Ani talep, olay ve güncelleme

- Tek müşteri/tek fatura gerçekleşen talepte tamamen kalacak; modelin geleceğe uzattığı ek etki daha önce onaylanan devamlılık güveniyle sınırlanacaktır.
- Olay/kampanya bilgisi mevcutsa hem olaylı ham sonuç hem olay etkisi ayrıştırılmış taban karşılaştırılabilir olacaktır. Geri test sırasında yalnız o kesimde önceden bilinen olay bilgisi kullanılacaktır.
- Resmi model cari ayda yeni geçerli Sellout/KA verisi geldikçe yeniden tahmin üretebilir; ancak önceki tahmin silinmeyecek ve model değişikliği ile veri güncellemesinin etkisi ayrıştırılacaktır.
- Challenger modeller arka planda hesaplanabilir fakat onaylı üretim modeli başarı eşiği sağlanmadan ve sürüm değişikliği kaydı oluşmadan sessizce değiştirilmeyecektir.

### Başlangıç parametrelerinin belirlenmesi

- Geçmiş pencere uzunluğu, yakın dönem ağırlığı, ani talep penceresi, aralıklı talep eşikleri ve model parametreleri mevcut Excel/app sabitlerinden körü körüne alınmayacaktır.
- Sistem makul aday parametre ızgaralarını geçmişte rolling-origin geri test edecek ve `ürün ailesi × kanal` için en istikrarlı sonucu önerecektir.
- Yeterli geçmiş bulunmayan seviyede aşırı uyumlu ürün-özel parametre üretilmeyecek; grup/kanal varsayılanına geri düşülecektir.
- İlk resmi parametre seti ancak veri kapsamı analizi ve geri test sonuç tablosu görüldükten sonra etkinleştirilecek; bütün değerler `valid_from/valid_to`, model sürümü, onaylayan ve değişiklik gerekçesiyle saklanacaktır.

### AI açıklaması

- AI tahmin cevabında seçilen model ve challenger farkını, eğitim/kesim dönemini, veri yeterliliğini, hata ve bias ölçülerini, naif modele kazanımı, Geleneksel/KA katkısını, hedef ekini, ani talep güvenini, tahmin aralığını ve kullanılan geri düşmeyi açıklayabilecektir.
- “Model neden değişti?” sorusunda veri güncellemesi, performans bozulması, talep sınıfı/rejim değişimi veya parametre sürümü etkisini ayrı gösterecektir.

## 22. Bir yıllık veri yükleme ve otomatik model kalibrasyonu — onaylandı

- Algoritma, veritabanı ve hesaplama motoru bir yıllık üretim verisi önceden incelenmeden tasarlanabilecektir. Sistem belirli örnek dosyaya veya önceden elle seçilmiş ürün parametrelerine bağımlı kurulmayacaktır.
- Kullanıcı bir yıllık Sellout ve KA verisini sisteme yükleyecektir. Yükleme sonrasında sistem kolon/tarih doğrulaması, dönem ve eksik gün kapsamı, ürün ailesi/paket eşleme kapsamı, iade/iptal/mükerrer etkisi ve aile × kanal zaman serisi yeterliliğini otomatik profilleyecektir.
- Otomatik profil sonrasında Bölüm 21'deki rolling-origin geri test çalışacak; aday model ve parametreler veri üzerinden önerilecektir. Veri görülmeden başlangıç ağırlığı, pencere veya ürün-özel katsayı resmi üretim parametresi olarak uydurulmayacaktır.
- Bir yıllık günlük veri; hafta-günü, ay-içi desen, yakın dönem eğilimi, düzenli/aralıklı talep, ani talep yoğunlaşması, kalan ay tahmini ve koruma süresi hata dağılımı için kullanılabilecektir.
- Yalnız tek yıllık geçmiş, ikinci bir yıllık çevrim bulunmadığı için yıllık mevsimselliği güçlü biçimde doğrulamaya yetmez. Sistem bunu `yıllık mevsimsellik doğrulanamadı` olarak işaretleyecek ve yıllık desen uydurmayacaktır.
- Model önerisi veri yüklenince otomatik üretilebilir; resmi model ancak veri kalite kapıları, geri test sonucu ve sürümlü etkinleştirme kaydıyla kullanılacaktır.

## 23. Geçerli müşteri satış faturası ve aktif iptal kontrolü — onaylandı

### Kaynak inceleme bulgusu

- İncelenen `Satış (Veri Yazma) Listesi` 4.423 hareket satırı taşır. Bunların 3.922'si `500...` müşteriye bağlı `SATIS` tipidir.
- `500...` müşteri satışlarında aktarım durumu `3.919 Aktarıldı`, `2 Aktarılamadı (Cari)`, `1 Aktarılamadı`; fatura durumu `3.916 CREATED`, `6 CANCELLED` şeklindedir.
- Aktarılamayan üç müşteri satırının toplam `Satış Tutarı` değeri `51.755,67 TL`dir. Kullanıcı kararıyla bu dağılım yalnız kaynak bulgusudur; aktarım durumu hiçbir finansal hesap veya filtre için kullanılmayacaktır.
- Altı `CANCELLED` kaydının Fatura No değeri orijinal CREATED kaydından farklıdır. Altı çiftin tamamı aynı `EDOCUMENTNO`, `Sipariş Numarası`, müşteri ve tutarla birebir eşleşmektedir.

### Önerilen geçerlilik kuralı

- Normalize müşteri kodu, alanlardan hangisi `500` ile başlayan birebir metin kodu taşıyorsa o alandan alınacaktır. Mevcut örnekte müşteri kodu fiilen çoğunlukla `Cari Kodu 2` alanındadır. İki alan da `500` kodu taşıyıp birbirinden farklıysa kayıt otomatik seçilmeyecek ve veri kalite kontrolüne alınacaktır.
- Resmi müşteri satış faturası adayı en az `Tip=SATIS`, geçerli `500...` müşteri kodu, geçerli `Fatura Tarihi` ve sayısal `Satış Tutarı` koşullarını sağlamalıdır.
- `Durum` alanındaki `Aktarıldı`, `Aktarılamadı` ve `Aktarılamadı (Cari)` değerlerinin finansal geçerlilik açısından hiçbir önemi yoktur. Alan hesaplama, filtre, risk, ciro, bakiye, yaşlandırma ve temsilci performansında tamamen görmezden gelinecektir. Ham kayıtta denetim amacıyla tutulabilir fakat normalize finansal metriğe bağımlılık oluşturmayacaktır.
- `Fatura Durum=CREATED` tek başına yeterli olmayacaktır. Geçerli bir CANCELLED eşleşmesi bulunan hem CREATED orijinal hem CANCELLED ters kayıt resmi finansal ciro ve açık alacaktan çıkarılacaktır; iki satırın tutarlarını toplamak veya yalnız CANCELLED satırını silmek yasaktır.
- İptal eşleştirme önceliği `aynı EDOCUMENTNO + aynı müşteri` olacaktır; `Sipariş Numarası`, mutlak tutar, tarih ve belge tipi eşleşmeyi doğrulayan alanlardır. Aynı anahtarda birden fazla aday veya alan çelişkisi varsa sistem otomatik iptal uygulamayacak ve manuel kontrol üretecektir.
- EDOCUMENTNO bulunmuyorsa yalnızca `aynı müşteri + aynı Sipariş Numarası + aynı mutlak tutar + CREATED/CANCELLED karşıtlığı` benzersiz bir çift oluşturuyorsa kontrollü geri düşme kullanılabilecektir. Fatura No tek başına iptal eşleştirme anahtarı değildir.
- Eşleşmeyen CANCELLED veya başarısız aktarım satırı silinmeyecek; durum, tutar ve olası finansal etkiyle veri kalite/operasyon listesinde kalacaktır.
- Resmi fatura dönemi `Fatura Tarihi` olacaktır. Vade, aging ve tahsilat eşleştirme kuralları sonraki finansal aşamalarda ayrıca tanımlanacaktır.
- `Satış Tutarı` vergi dahil toplam fatura tutarını temsil eder. Finansal ciro, borç hareketi ve fatura bakiyesi bu vergi dahil tutarı kesin ondalıkla kullanacaktır. Boş `Vergi Toplamı` alanından ayrıca vergi hesaplanmayacak ve vergi ikinci kez eklenmeyecektir.

### Her veri girişinde aktif iptal kontrolü

- Sistem her satış faturası dosyası yüklemesinde zorunlu iptal kontrolü çalıştıracaktır. Kontrol yalnız yeni dosya içindeki satırlarla sınırlı olmayacak; yeni kayıtlar mevcut bütün fatura geçmişiyle karşılaştırılacaktır.
- İşlem sırası `ham satırı kaydet → doğal anahtar/mükerrer kontrolü → CREATED/CANCELLED adaylarını çıkar → geçmiş dahil iptal eşleştirmesi yap → belge geçerliliğini güncelle → etkilenen metrikleri yeniden hesapla` olacaktır.
- İptal bağlantısı öncelikle `aynı EDOCUMENTNO + aynı müşteri` üzerinden kurulacak; sipariş numarası, vergi dahil tutar, tip ve tarihler doğrulama alanları olacaktır. EDOCUMENTNO yoksa yalnız benzersiz ve çelişkisiz `müşteri + sipariş numarası + vergi dahil tutar + karşıt CREATED/CANCELLED durumları` kontrollü geri düşme olarak kullanılabilecektir.
- Sonradan yüklenen bir CANCELLED kaydı geçmişteki CREATED faturayla eşleşirse iki belge aynı `cancellation_group_id` altında işaretlenecek ve orijinal fatura anında geçerli ciro, bakiye, açık fatura, aging, DSO, tahsilat eşleştirme ve temsilci finansal performansından çıkarılacaktır.
- İptal edilmiş fatura ile CANCELLED ters kaydı standart rapor, müşteri ekstresi, dashboard, dışa aktarım ve AI'ın normal fatura listelerinde gösterilmeyecektir. Ham kayıtlar silinmeyecek; yalnız sistem denetim izi, eşleştirme kanıtı ve teknik yeniden üretilebilirlik için saklanacaktır.
- Önceden üretilmiş calculation run/snapshot sonucu değiştirilmeyecek; yeni veri kesitiyle yapılan güncel veya yeniden hesaplanmış rapor iptal bilgisini uygular. AI eski snapshot ile güncel yeniden hesaplamanın farkını gerekirse kaynak veri değişikliği olarak açıklayabilir.
- Eşleşmeyen veya birden fazla adaya sahip CANCELLED kaydı normal fatura listesine girmeyecek; otomatik olarak yanlış orijinal silinmeyecek. Sistem içi veri kalite alarmı oluşturulacak ve resmi finansal sonuç `çözümlenmemiş iptal riski` uyarısı taşıyacaktır.
- Aynı dosyanın tekrar yüklenmesi yeni iptal veya yeni fatura oluşturmamalıdır. Kontrol idempotent olacak; aynı ham kayıt, iptal grubu ve geçerlilik sonucu tekrar üretilecektir.
- İptal kontrolü başarısız olursa yükleme tamamlanmış/resmi hesaplamaya hazır sayılmayacak; ilgili çalışma `validation_failed` durumunda kalacaktır.

## 24. Belirsizlik bildirimi ve manuel düzeltme — onaylandı

- Sistem iptal eşleştirmesi, müşteri kodu, ürün ailesi, paket/litre katsayısı, temsilci/SSM bağlantısı, kanal, tahsilat belgesi, tarih, mükerrerlik veya diğer veri kurallarında tek ve güvenli sonuç üretemediğinde sessizce seçim yapmayacaktır.
- Belirsizlik kullanıcıya görünür bir görev/uyarı olarak bildirilecektir. Bildirim en az sorun türü, kaynak dosya ve satır/belge, olası adaylar, neden otomatik karar verilemediği, etkilenen müşteri/ürün/dönem, tutar/litre etkisi ve bloke olan metrikleri gösterecektir.
- Kullanıcı yetkisi dahilinde manuel düzenleme yapabilecektir. Örneğin doğru iptal faturasını bağlama, `eşleşme yok` kararı verme, müşteri/ürün ailesi seçme, varyant katsayısı onaylama, temsilci/SSM bağlantısını düzeltme veya kaydı kapsam dışı bırakma işlemleri desteklenecektir.
- Manuel düzenleme ham Excel satırını silmeyecek veya üzerine yazmayacaktır. Sistem `manual_resolution/override` kaydında eski normalize değer, yeni değer, karar türü, kullanıcı, tarih-saat, gerekçe, varsa belge/not ve geçerlilik başlangıç-bitişini saklayacaktır.
- Her manuel karar geri alınabilir ve yeni sürümle değiştirilebilir olacaktır. Önceki karar ve o kararla üretilmiş hesap sonuçları denetim için korunacaktır.
- Manuel düzeltme kaydedildiğinde bağımlılık grafiği üzerinden yalnız etkilenen müşteri, belge, ürün ailesi, dönem ve üst organizasyon sonuçları yeniden hesaplanacaktır. Ciro, bakiye, aging, FKNS, hedef, tahmin, stok ve AI yorumları etkileniyorsa yeni calculation run ile güncellenecektir.
- Çözülmemiş kritik belirsizlik bulunan yeni yükleme resmi hesaplamaya açılmayacak; kullanıcıya son geçerli veri snapshot'ı gösterilmeye devam edilecek ve yeni yükleme `manuel çözüm bekliyor` durumunda tutulacaktır.
- Kritik olmayan belirsizlikte hesap çalışabilecekse sonuç açık veri kalite uyarısı ve etki kapsamıyla üretilecektir. Hangi sorunların kritik/bloke edici olduğu sürümlü kural matrisiyle tanımlanacaktır.
- AI belirsizliği gizlemeyecek; sayı vermeden önce veya sonuçla birlikte çözülmemiş sorun sayısını, olası etkisini ve manuel karar gereksinimini açıklayacaktır. AI kullanıcı adına manuel düzeltmeyi kendiliğinden kesinleştirmeyecektir.
- Aynı belirsizlik tekrar yüklendiğinde mevcut manuel karar doğal anahtar ve geçerlilik sürümüyle yeniden uygulanabilir; kaynak alanlar değişmişse karar otomatik taşınmayacak ve yeniden doğrulama isteyecektir.

## 25. Belgeler dosyasının bağımsız operasyon kategorisi — onaylandı

- `Belgeler` dosyası Nakit, Havale, Çek ve Senet tahsilat dosyalarıyla birleştirilmeyecektir. Ayrı `operasyonel sevk/evrak kontrolü` kategorisinde saklanacaktır.
- Bu kaynak yalnız o gün çıkan siparişlerin kontrolünde, temel tahsilat aktarımı ve hesap kapama kayıtları henüz oluşmadan önce yönlendirici/ön bilgi sağlayacaktır. Belgeler kalıcı bir finansal kaynak değil, resmî tahsilat gelene kadar yaşayan geçici operasyon katmanıdır.
- Belgeler kaydı müşteri bakiyesini azaltmayacak, faturayı kapatmayacak, tahsilat toplamına, CEI, DSO, aging, vadesi geçmiş tutar veya temsilci finansal performansına girmeyecektir.
- Dosyadaki `Tutar` işareti finansal borç/alacak hareketi olarak yorumlanmayacaktır. Operasyon ekranında gerekiyorsa belge yüz değeri `abs(Tutar)` olarak etiketli biçimde gösterilebilecek; bu değer resmi tahsilat değildir.
- Belgeler kaydı için en az `belge numarası, müşteri, tarih, vade tarihi, ödeme tipi, belge türü/tipi, çek-senet numarası, statü, çıktı/ödeme durumu ve ilgili ham dosya satırı` korunacaktır.
- Operasyon ekranı `evrak/belge mevcut`, `resmi tahsilat aktarımı bekleniyor`, `kontrol gerekli` gibi durumlar üretebilir. Bu durumlar finansal geçerlilik veya hesap kapama anlamına gelmeyecektir.
- Belgeler yüklemesi hiçbir zaman doğrudan aktif Sevkiyat Takip görünümüne eklenmez. Önce staging alanında dosya içi mükerrer kontrolü yapılır, sonra bütün geçmiş resmî Nakit/Havale/Çek/Senet arşiviyle mutabakat kurulur; yalnız resmî karşılığı bulunmayan satırlar geçici aktif görünümde yayımlanır.
- Kaynak önceliği kesin olarak `resmî tahsilat > Belgeler` olacaktır. Arşivde 2–3 Ağustos resmî kayıtları varken aynı kayıtları taşıyan Belgeler dosyası 4 Ağustos'ta yüklense bile eşleşen olay Sevkiyat Takip'te ikinci kez görünmez ve hiçbir toplamda ikinci kez sayılmaz.
- Eşleştirme önceliği: aynı kalıcı kaynak/belge kimliği; sonra aynı müşteri + normalize mutlak tutar + uyumlu ödeme sınıfı + etkin tarih; bunlar yoksa kontrollü tarih penceresindeki benzersiz adaydır. Birden çok aday, tutar/tarih çelişkisi veya yetersiz anahtar otomatik birleşmez; `AMBIGUOUS_RECONCILIATION` olarak kullanıcı kontrolüne çıkar.
- Resmî/Belgeler ayrımı satırdaki `Aktarıldı/Aktarılmadı` metninden, dosya adından tahmin edilen serbest metinden veya sonradan eşleşip eşleşmemesinden çıkarılmayacaktır. Her yükleme baştan kayıtlı `source_kind` ile alınır: `BELGELER_TEMP` yalnız operasyonel ve finansal etkisizdir; `OFFICIAL_CASH`, `OFFICIAL_TRANSFER`, `OFFICIAL_CHECK`, `OFFICIAL_NOTE` ise kendi onaylı parser ve şemalarından gelen resmî kaynaklardır. Kaynak kimliği sonradan değiştirilemez.
- Belgeler ve resmî satırlar ayrı kalıcı olay kimliklerini korur. Mutabakat bunlardan birini diğerine dönüştürmez; `temp_event_id ↔ official_event_id`, eşleşme yöntemi, güven düzeyi, karar zamanı ve varsa kullanıcı onayı taşıyan ayrı bir bağlantı oluşturur. Böylece kaynak, kanıt ve sonradan iptal geçmişi kaybolmaz.
- Aynı Belgeler kapsamı tekrar yüklenirse satırlar mevcut geçici kümeye eklenmez. Bayi + kapsanan gün + kaynak türü için yeni snapshot staging'de doğrulanır ve geçerli geçici görünüm atomik olarak yenilenir; böylece aynı dosyanın/aynı günün yeniden yüklenmesi mükerrer üretmez.
- Gün içinde resmî tahsilat dosyaları yüklendiğinde mutabakat yeniden çalışır. Eşleşen resmî kayıt kanonik olay olur; karşılık Belgeler kaydı aktif operasyon görünümünden kaldırılır. Eşleşmeyen Belgeler satırı resmî tahsilat sayılmaz ve gün sonunda otomatik silinmez.
- `Belgeler mutabakat oranı = resmî kayda kesin eşleşmiş veya kullanıcı tarafından eşleşmesi onaylanmış benzersiz geçerli Belgeler satırı / mutabakat kapsamındaki benzersiz geçerli Belgeler satırı × 100` olarak hesaplanır. Dosya içi mükerrer, parse edilemeyen ve kapsam dışı satırlar paydaya sessizce karıştırılmaz; ayrı veri kalite sayıları olarak gösterilir.
- Mutabakat oranı `%80 ve üzerindeyse` batch `RECONCILED_WITH_EXCEPTIONS` olur. Eşleşenler resmî kayıtla değiştirilir; eşleşmeyenler müşteri, belge, tarih, tutar, ödeme tipi, olası adaylar ve eşleşmeme nedeniyle ayrı istisna raporuna çıkarılır. Bu satırlar yalnız yetkili kullanıcının tekil veya toplu kararıyla silinebilir/kapsam dışı bırakılabilir.
- Mutabakat oranı `%80 altındaysa` batch `LOW_MATCH_REVIEW` olur. Bu durum yanlış gün, eksik resmî kaynak, yanlış dosya veya şema değişikliği ihtimalidir; eşleşmeyen satırlarda otomatik silme/sona erdirme yapılmaz. Kesin eşleşmiş satırlar yine çift görünmez; ancak batch tamamlandı kabul edilmez ve kullanıcıya kaynak/kapsam incelemesi sunulur.
- `%80` eşiği otomatik eşleşme kalitesini gevşetmez. Eşik batch'in iş akışı durumunu belirler; tek bir satır ancak kesin anahtarlarla veya kullanıcı onayıyla eşleşmiş sayılır. Belirsiz adaylar oran payına girmez.
- İstisna raporundaki kullanıcı silmesi ham Excel satırını değiştirmez. Aktif geçici olay geri alınabilir `MANUAL_EXCLUDED/DELETED` override'ıyla görünüm ve hesaplardan çıkar; kullanıcı, zaman, gerekçe ve önceki durum denetim izinde kalır. Aynı olay tekrar yüklenirse mevcut manuel-değişiklik çatışma kuralıyla yeniden onaya gelir.
- Bir Belgeler satırı önceki tam snapshot'ta bulunup aynı kapsamın sonraki tam Belgeler snapshot'ında yoksa önce arşivdeki ve yeni gelen resmî kayıtlarla mutabakat aranır. Resmî eşleşme varsa `MATCHED_REPLACED`; yoksa kayıt `REMOVED_BEFORE_TRANSFER` (`BELGE_SİLİNDİ_AKTARILMADI`) olur. Bu kayıt aktif sevkiyat/tahsilat sinyalinden hemen çıkar, fakat neden ve geçmiş sürümleri denetim/fark ekranında kalır.
- `REMOVED_BEFORE_TRANSFER` hiçbir zaman nakit girişi, tahsilat, avans veya fatura kapama kanıtı değildir. Daha önce bu geçici sinyale dayanılarak sevk edilmiş/teslim edilmiş bir fatura varsa Fatura Kontrol `PREPAYMENT_SIGNAL_DISAPPEARED` uyarısı üretir; resmî ödeme sonradan gelirse uyarı yeni hesap çalıştırmasında kapanır.
- Kaybolan geçici satır daha sonraki Belgeler snapshot'ında yeniden görünürse eski olay sessizce canlandırılmaz. Yeni sürüm `REAPPEARED_AFTER_REMOVAL` uyarısıyla bağlanır; kullanıcı değişikliği, kaynak düzeltmesi veya gerçek yeni olay ayrımı doğal anahtar ve ham satır karşılaştırmasıyla kontrol edilir.
- Resmî kaynak devralınca eşleşen geçici kayıt ekran, API ve hesap sonuçlarından çıkar. Tekrar yükleme, manuel değişiklik ve denetim gereksinimleri nedeniyle ham dosya satırı ile `MATCHED_REPLACED/MANUAL_EXCLUDED` karar izi değiştirilemez denetim katmanında tutulur; bunlar hiçbir iş hesabına katılmaz.
- Sevkiyat/Fatura kontrol sorguları iki kaynağı `UNION ALL` ile toplamayacaktır. Tek kanonik görünüm kullanılır: varsa resmî olay, yoksa yalnız aktif ve mutabakatsız geçici Belgeler sinyali. Aynı ekonomik olay için en fazla bir görünür kayıt ve bir tutar katkısı bulunur.
- Resmi tahsilat bulunmayan Belgeler kaydı `tahsilat yapılmış` sayılmayacak ve bakiye hesabına geçici olarak bile girmeyecektir.
- AI ve raporlar bu kaynağı `operasyonel yönlendirici belge` olarak adlandıracak; tahsilat, kapama veya nakit girişi olarak yorumlamayacaktır.
- Sevkiyat/Fatura Kontrol ekranında kaynak etiketi zorunludur: `Geçici Belgeler`, `Resmî Tahsilat`, `Belge silindi–aktarılmadı` veya `Mutabakat gerekli`. Kullanıcı aynı tutarın hangi kanıta dayandığını her zaman görebilmelidir.

### Belgeler–resmî tahsilat gerçek veri mutabakat testi

- `Belgeler (9).xlsx` içindeki 106 satır, resmî Nakit/Havale/Çek/Senet arşivindeki 4.244 satırla çapraz test edilmiştir. Belgeler'in 106 kaydının tamamı aynı `Belge Numarası` ile tam bir resmî kayda eşleşmiş; sıfır eşleşmeyen ve sıfır çoklu belge numarası adayı bulunmuştur.
- 106 eşleşmenin tamamında `Belgeler.Müşteri = resmî Cari Kodu 2`, `abs(Belgeler.Tutar) = resmî Tutar` ve `Belgeler.Tarih = resmî Fatura Tarihi` birebir tutmuştur. Bu nedenle örnekte resmî kaydı Belgeler karşılığından ayıran en güçlü kesişim anahtarı `Belge Numarası`; zorunlu doğrulama alanları müşteri, mutlak tutar ve tarihtir.
- Ödeme kaynağı haritası gerçek veride `55 Kredi Kartı + 44 Nakit → Nakit resmî dosyası`, `5 Banka havalesi → Havale resmî dosyası`, `2 Alınan Çek → Çek resmî dosyası` olarak birebir doğrulanmıştır. Kredi Kartı, resmî Nakit dosyasında ayrı ödeme alt türü taşımadığı için eşleşmiş Belgeler'deki alt tür yalnız kaynak/provenance zenginleştirmesi olarak korunabilir; finansal kaynak sınıfını değiştirmez.
- İki Alınan Çek kaydında Belgeler `Çek Senet Numarası`, resmî Çek `Çek No` ile de birebir tutmuştur. Çek/Senet eşleşmesinde araç numarası mevcutsa ek zorunlu doğrulama alanıdır.
- Eşleşen resmî kayıtların 102'sinde `Aktarıldı`, 4'ünde `Aktarılamadı` yazmaktadır; 106'sının tamamı `Kayıt Tipi=CREATED`'dır. Önceki karara uygun olarak `Aktarıldı/Aktarılamadı` eşleşme, kaynak sınıfı veya finansal geçerlilik anahtarı değildir.
- Bu örnek setinde Belgeler'de bulunup resmî arşivde hiç bulunmayan kayıt olmadığı ve yalnız tek Belgeler snapshot'ı bulunduğu için `REMOVED_BEFORE_TRANSFER` vakası gerçek veriyle gözlenememiştir. Bu durum ancak aynı kapsam için en az iki ardışık tam Belgeler snapshot'ı ve sonraki resmî yükleme birlikte bulunduğunda ampirik olarak doğrulanabilir; o zamana kadar kural sentetik kabul testiyle korunacaktır.
- Üretim eşleştirme sırası gerçek bulguya göre netleştirilmiştir: önce aynı `Belge Numarası` adayı bulunur; müşteri + mutlak tutar + tarih + beklenen resmî kaynak sınıfı doğrulanır; Çek/Senette araç numarası da doğrulanır. Belge numarası yok/değişmişse aynı bileşik alanların yalnız benzersiz sonucu otomatik eşleşebilir. Tutmayan veya birden çok adaylı kayıt manuel mutabakattır.

## 26. Resmi tahsilat kaynaklarının ortak modeli — Havale/Çek kapama ve Senet iade/karşılıksız kuralları onaylandı

### Kaynak inceleme bulguları

- Resmi tahsilat kaynakları yalnız `Nakit`, `Havale`, `Çek` ve `Senet` dosyalarıdır. Örneklerde toplam 4.244 satır ve kaynaklar arasında çakışmayan 4.244 belge numarası vardır.
- Nakit dosyasında 3.815 kayıt (`3.812 CREATED`, `3 CANCELLED`), Havale dosyasında 396 kayıt (`388 CREATED`, `8 CANCELLED`), Çek dosyasında 25 kayıt (`24 CREATED`, `1 CANCELLED`), Senet dosyasında 8 kayıt (`8 CREATED`) vardır.
- Dört kaynağın tamamında tutarlar pozitiftir, para birimi TRY'dir ve örnekte bütün kayıtlar geçerli `500...` müşteri koduna bağlanabilmektedir. Müşteri kodu fiilen `Cari Kodu 2` alanında bulunur; `Cari Kodu` çoğunlukla boştur.
- Örnek kaynaklar içinde aynı `Belge Numarası` tekrarı yoktur. Bu bulgu gelecekte mükerrer kontrolünü kaldırmaz.
- Tahsilat iptallerinde faturalardaki gibi EDOCUMENTNO bulunmamaktadır. Bazı CANCELLED kayıtlar `aynı yöntem + müşteri + tutar + işlem tarihi` ile tek CREATED adaya bağlanırken bazıları birden fazla CREATED aday taşır; bu nedenle tutar/müşteri benzerliğine dayanarak bütün iptaller otomatik eşleştirilemez.

### Havale–Çek hesap bağlantısı ve Senet karşılaştırması — bulgu ve iş etkisi onaylandı

- Kullanıcının görsel örneğiyle bağlantı alanı kesinleştirilmiştir: `Havale.Hesap No = Çek.Çek Hesap No`. Alan `Çek No` değildir.
- Örnek Havale dosyasında `Hesap No` yalnız 7 satırda doludur. Bunların 6 satırındaki hesap numarası Çek dosyasında en az bir `Çek Hesap No` ile eşleşir; `8736712` örnek dosyada eşleşmez.
- Eşleşen hesap kümeleri: `58509805`, `13074781`, `5951982`, `443058`. `13074781` üç Havale satırı ve iki Çek kaydıyla; `5951982` bir Havale satırı ve dört Çek kaydıyla bağlantılıdır.
- Bu nedenle hesap numarası tekil tahsilat anahtarı değildir. Aynı hesap birden fazla çek ve havale kaydını bağlayabilir; yalnız hesap eşleşmesiyle bir hareketi mükerrer saymak veya bakiyeden çıkarmak güvenli değildir.
- Bazı hesap bağlantılarında müşteri, işlem tarihi ve tutar da farklıdır. Hesap numarası şimdilik `aynı banka/çek hesabı ilişki kümesi` oluşturur; iki finansal hareketin aynı olay olup olmadığı ek iş kuralı veya daha güçlü belge bağlantısıyla belirlenmelidir.
- Mevcut örnekte hiçbir `Çek No`, Havale dosyasındaki herhangi bir alanla birebir eşleşmemiştir. Bağlantı yalnız `Çek Hesap No ↔ Hesap No` alanındadır.
- Aynı test Senet için uygulanmıştır. Mevcut sekiz Senet kaydında `Senet No ↔ Havale Hesap No`, Senet Belge Numarası ↔ Havale alanı veya Senet ↔ Çek/Belgeler arasında `aynı belge no` eşleşmesi bulunmamıştır.
- CANCELLED olmayan sekiz Senet kaydının kendi içinde `aynı Belge Numarası` veya `aynı Fatura Tarihi + Vade Tarihi + Tutar` kombinasyonu tekrarı yoktur. Belgeler, Havale ve Çek kaynaklarında da aynı belge ya da aynı tarih-vade-tutar kombinasyonuyla eşleşen Senet kaydı bulunmamıştır.
- Senetler Nakit kaynağıyla da karşılaştırılmıştır. Aynı belge numarası, aynı müşteri+tutarın Senet vade günündeki tahsilatı, müşteri şartı olmadan aynı tutarın vade günündeki tahsilatı veya Senet kabul gününde aynı müşteri+tutar eşleşmesi bulunmamıştır.
- İki CREATED Senet kaydında `Fatura Tarihi = Vade Tarihi`dir ve belge numaraları diğer altı kayıttan farklı olarak `180...` ile başlar: `1800005800 / 123700000012 / 5000214405 / 31.07.2026 / 123.824,00 TL` ve `1800005619 / 123700000013 / 5000082798 / 20.07.2026 / 526.219,00 TL`.
- Kullanıcı açıklamasıyla bu iki kayıt kesinleşmiştir: `180...` belge numaralı ve tarih=vade davranışlı bu satırlar yeni Senet tahsilatı değil, Senedin karşılıksız çıkması/Senet iadesi işlemidir.
- Bu bulgu nedeniyle Nakit+Havale+Çek+Senet tutarlarının doğrudan tamamını toplayan tahsilat formülü henüz etkinleştirilmeyecektir. Özellikle Havale–Çek ilişkisinin iş anlamı kesinleşmeden aynı ekonomik olayın iki kez sayılma riski vardır.

### Havale ile Çek ödeme/kapama eşleşmesi — onaylandı

- Bir Havale kaydı ile açık/riskteki Çek kaydı yalnız `Havale.Hesap No = Çek.Çek Hesap No` **ve** `Havale.Tutar = Çek.Tutar` koşulları birlikte sağlanırsa ödeme/kapama adayı olacaktır. Hesap numarası tek başına yeterli değildir.
- Tutar karşılaştırması para biriminin kesin ondalık değeriyle yapılacaktır. Para birimleri farklıysa kur çevrimiyle otomatik eşleşme yapılmayacaktır.
- Her iki kayıt CREATED/geçerli olmalı, iptal grubunda bulunmamalı ve Çek daha önce başka bir kapama hareketiyle ödenmiş olmamalıdır.
- Tek benzersiz aday varsa Havale hareketi yeni müşteri tahsilatı olarak sayılmayacak; ilgili Çek kaydına `settlement_event_id` ile bağlanacaktır.
- Eşleşmeyle Çek durumu `Ödendi` olacaktır. Ödeme tarihi Havale kaydının işlem/Fatura Tarihi, ödenen tutar eşleşen Havale tutarıdır. Çek tutarı o tarihten itibaren çek portföy riskinden düşecektir.
- Çek müşteriden alındığı tarihte cari hesabı zaten etkilediği için ödeme/kapama Havalesi müşteri cari hesabını ikinci kez azaltmayacak; tahsilat performansına ikinci kez eklenmeyecektir.
- Çek kapama Havalesi müşteri ekstresi, normal Havale listesi, tahsilat toplamı, dashboard, dışa aktarım ve AI'ın normal havale dökümünde gösterilmeyecektir. Ham hareket ve çekle bağlantısı yalnız teknik denetim/çek detayında korunacaktır.
- Aynı hesap ve tutarla birden fazla açık Çek adayı varsa sistem otomatik seçim yapmayacak; çek no, belge no, müşteri, çek kabul/vade tarihi ve Havale tarihiyle adayları kullanıcıya gösterecek ve Bölüm 24 uyarınca manuel eşleştirme isteyecektir.
- Havale tarihi Çek kabul tarihinden önceyse otomatik eşleşme yapılmayacak ve veri kalite uyarısı üretilecektir.
- Sonradan Havale veya Çek CANCELLED/geçersiz duruma düşerse kapama bağlantısı yeni calculation run'da geri alınacak; Çek başka geçerli kapama yoksa tekrar `Ödenmedi/Riskte` durumuna dönecek ve portföy riskine geri eklenecektir.
- Aynı dosyanın tekrar yüklenmesi ikinci ödeme oluşturmayacak; `Çek + settlement Havale` bağlantısı idempotent olacaktır.
- Mevcut örnek dosyada hesap numarası eşleşmeleri vardır fakat aynı anda hesap+tutar birebir eşleşen kayıt bulunmamıştır. Bu nedenle örnek veride otomatik `Ödendi` sonucuna geçen Çek yoktur; kural bir yıllık veri ve gelecek yüklemelerde çalışacaktır.

### Senet iadesi / karşılıksız Senet — onaylandı

- Senet dosyasındaki kullanıcı tarafından doğrulanmış `180...` belge türü yeni Senet kabulü değildir; `NOTE_RETURN_BOUNCED_CANDIDATE` yani Senet iadesi/karşılıksız çıkma adayıdır. Sistem olayı tespit eder fakat finansal sonucunu kullanıcı kararı olmadan uygulamaz.
- İade/karşılıksız olayının tarihi kaynak `Fatura Tarihi` olacaktır. Vade tarihi ayrıca korunacak; örneklerde işlem tarihi ile vade tarihi aynıdır.
- Sistem her Senet yüklemesinde iade/karşılıksız adayını bütün Senet geçmişinde öncelikle aynı `Senet No` ile orijinal kabul kaydı adaylarına bağlayacaktır. Müşteri, tutar, para birimi ve varsa diğer belge alanları aday güvenini gösterecek; tek aday olsa dahi nihai işlem etkisi kullanıcı onayı bekleyecektir.
- Kullanıcı karar ekranında en az orijinal Senet, iade/karşılıksız belge, müşteri, tutar, kabul tarihi, vade, mevcut Senet durumu, mevcut cari bakiye, mevcut risk ve her seçeneğin tahmini bakiye/risk/performans etkisini görecektir.
- Kullanıcı en az şu işlemlerden birini seçebilecektir:
  - `Bakiyeye ekle / borcu yeniden aç`: Senet tutarını müşteri cari borcuna ekler; Senedi karşılıksız/iade riskine taşır.
  - `Bakiyeden düş / tahsilat olarak uygula`: Kullanıcı kararıyla tutarı cari borçtan düşer; hangi belgeye dağıtılacağı sonraki eşleştirme kuralına uyar.
  - `Cari bakiyeyi etkileme, riskte tut`: Bakiye değişmez; Senet seçilen normal veya karşılıksız risk sınıfında izlenir.
  - `Ödendi olarak işaretle`: Senet riskini kapatır; bakiye etkisi karar ekranında ayrıca açıkça seçilir ve sessizce varsayılmaz.
  - `Orijinal belge ile birlikte sil/geçersiz kıl`: Orijinal Senet ve iade kaydını normal görünüm ile resmi hesaplardan birlikte çıkarır; ham kayıt ve soft-delete denetim izi korunur.
  - `Yalnız bu kaydı kapsam dışı bırak/sil`: İade adayını işlemez; orijinal Senet önceki onaylı durumunda kalır.
- Kullanıcı karar verene kadar iade adayı `PENDING_USER_DECISION` durumunda tutulacak, müşteri bakiyesi, tahsilat performansı ve Senet riskinde otomatik artış/azalış üretmeyecektir. Son onaylı orijinal Senet durumu geçerli kalacaktır.
- Karar sonucunda Senet durumu, bakiye etkisi, risk sınıfı, ekstre görünürlüğü ve tahsilat performansı ayrı alanlar olarak kaydedilecektir; bir seçeneğin diğer etkileri zorunlu olarak varsayılmayacaktır.
- Kullanıcı kararıyla bakiye yeniden açılırsa bunun hangi fatura/vade yaşına döneceği sonraki fatura-tahsilat/FIFO kuralına uyacaktır; sistem yeni satış faturası uydurmayacaktır.
- Ekstrede gösterim de kullanıcı kararının parçası olacaktır. Sil/geçersiz kılınan çift normal ekstrede görünmeyecek; bakiye/risk etkisi verilen iade olayı ise kendi işlem adıyla gösterilebilecektir.
- Aynı iade kaydının tekrar yüklenmesi borcu ikinci kez artırmayacak; Senet lifecycle olayı ve cari ters hareket idempotent olacaktır.
- Kullanıcı kararı daha sonra değiştirilebilir veya geri alınabilir; önceki karar ve hesap sonuçları korunacak, orijinal Senet ile cari/risk hesapları yeni calculation run ile seçilen yeni karara göre güncellenecektir.
- Aynı kayıt sonraki Excel yüklemesinde yeniden gelirse Bölüm 27'deki manuel-kaynak çatışma raporu çalışacak; kullanıcı kararı sessizce bozulmayacaktır.

### Ortak tahsilat modeli

- Dört kaynak ortak `collection_events` tablosunda tutulacak ve `collection_method` alanı `CASH`, `BANK_TRANSFER`, `CHECK`, `PROMISSORY_NOTE` değerlerinden biri olacaktır.
- Ortak kayıt alanları en az `source_document_no, customer_id, transaction_date, amount, currency, record_type, collection_method, raw_import_row_id, validity_status` olacaktır.
- Kaynağa özel ayrıntılar ayrı yöntem detayında saklanacaktır: Nakit için kasa/tahsilatçı; Havale için banka/hesap/açıklama; Çek için çek no/banka/hesap/vade; Senet için senet no/vade.
- Normalize müşteri kodu birebir `500...` metin değeri taşıyan alandan alınacaktır. `Cari Kodu` ve `Cari Kodu 2` farklı iki 500 kodu taşıyorsa otomatik seçim yapılmayacak ve kullanıcı belirsizlik görevine düşecektir.
- Belge doğal anahtarı en az `collection_method + source_document_no` olacaktır. Aynı dosyanın veya geçmiş belgenin yeniden yüklenmesi ikinci tahsilat oluşturmayacaktır.
- `Tutar` kesin pozitif tahsilat yüz değeridir. Geçerli tahsilat müşteri cari borcunu azaltan alacak hareketi olarak bu tutarla kaydedilecektir. Negatif veya sıfır tutar gelirse otomatik işaret düzeltmesi yapılmayacak ve veri kalite kontrolüne alınacaktır.
- Para birimi kaynakta saklanacaktır. TRY dışı kayıt gelecekte gelirse döviz kuru olmadan TRY tutarı uydurulmayacak; dövizli bakiye/kur politikası ayrıca gerekecektir.

### Tarih ve yöntem davranışı

- Nakit ve Havale için kaynakta `Fatura Tarihi` adıyla gelen alan tahsilat işlem tarihi olarak normalize edilecek ve cari borcu o tarihte azaltacaktır.
- Önerilen Çek/Senet davranışı: müşteri çek veya senedi teslim ettiğinde, kaynak `Fatura Tarihi` tahsilat/kabul tarihi kabul edilerek müşteri ticari borcu o tarihte azaltılacaktır. Araç aynı anda ayrı çek/senet portföy riski olarak açılacak; `Vade Tarihi` yalnız vade/risk takvimini belirleyecektir.
- Çek/Senet vadesi gelmemiş olsa da aynı müşteri faturası açık borçta tutulup çek/senet de tahsilat sayılırsa borç iki kez risk olarak görünmemelidir. Bu nedenle `müşteri açık ticari borcu` ile `çek/senet portföy riski` ayrı metrikler olacaktır.
- Çek/senet ödeme/karşılıksız/portföy durumu için resmi kaynak sağlanmadığı sürece sistem aracın ödendiğini veya karşılıksız kaldığını uydurmayacaktır; yalnız kabul edilen araç ve vade riski gösterilecektir. `Belgeler` dosyası bu resmi finansal durumu oluşturmaz.

### Aktarım durumu ve kayıt geçerliliği

- Faturalarda onaylanan genel yaklaşım tahsilatlara da önerilmektedir: `Aktarıldı/Aktarılamadı` entegrasyon alanları finansal geçerlilik filtresi olmayacak ve tamamen görmezden gelinecektir. Havale dosyasındaki ayrı `Durum=Aktif` ham kaynak alanı korunabilir; iş etkisi ayrıca tanımlanmadıkça hesap filtresi olmayacaktır.
- Tahsilatın iş geçerliliğini `Kayıt Tipi=CREATED/CANCELLED`, müşteri, belge doğal anahtarı, tutar, tarih ve aktif iptal kontrolü belirleyecektir.
- Her tahsilat yüklemesinde yeni ve bütün geçmiş kayıtlar üzerinde iptal/mükerrer kontrolü zorunlu çalışacaktır. Geçerli iptal çifti bulunduğunda CREATED ve CANCELLED birlikte tahsilat, hesap kapama, CEI ve temsilci performansından çıkarılacak ve standart raporlarda gösterilmeyecektir.
- Tahsilat iptali için varsa gelecekte sağlanan açık ters kayıt referansı birinci önceliktir. Yoksa aynı yöntem, müşteri, tutar ve işlem tarihi temel aday grubudur; Nakit için kasa/tahsilatçı, Havale için banka/hesap/açıklama, Çek/Senet için araç numarası ve vade gibi alanlar eşleşmeyi doğrular.
- Tek benzersiz ve çelişkisiz aday yoksa sistem otomatik orijinal tahsilat silmeyecek; kullanıcıya adaylar ve bakiye etkisiyle manuel çözüm görevi açacaktır. Bölüm 24'teki sürümlü manuel düzeltme ve yeniden hesaplama kuralları uygulanacaktır.
- İptal edilmiş tahsilatlar ham denetim verisinde kalacak fakat normal tahsilat listesi, müşteri ekstresi, dashboard, dışa aktarım ve AI cevaplarında gösterilmeyecektir.

### Toplamlar ve açıklama

- Aday `Geçerli tahsilat = geçerli CREATED tahsilat yüz değerleri toplamı - Çek kapaması olarak sınıflandırılan Havale hareketleri`; iptal grubundaki hem CREATED hem CANCELLED her durumda dışarıdadır. Senet kapama davranışı ayrıca kesinleştirilecektir.
- Yöntem bazlı tahsilat, müşteri/temsilci/SSM/şirket toplamları alt grup yüzdelerinin ortalamasıyla değil geçerli olay tutarlarının toplamıyla üretilecektir.
- AI toplam tahsilatı yöntem, dönem ve organizasyona ayırabilecek; çek/senet kabulü ile nakit/banka girişini aynı kavrammış gibi yorumlamayacak ve portföy riskini ayrıca belirtecektir.

## 27. Tüm finansal işlemlerde manuel ekleme, düzenleme, kapsam dışı bırakma ve silme — onaylandı

- Kullanıcı en az satış faturası, satın alma faturası, virman/devir, nakit-havale tahsilatı, çek, senet ve diğer tanımlı finansal hareketlerde manuel kayıt ekleyebilecek, düzenleyebilecek, hesaplamadan çıkarabilecek ve silebilecektir.
- Manuel eklenen kayıtlar `source_type=MANUAL` olarak işaretlenecek ve Excel'den gelen kayıtlarla aynı şema, zorunlu alan, mükerrerlik, iptal, müşteri kodu, tarih, tutar, para birimi ve iş kuralı doğrulamalarından geçecektir.
- İçe aktarılmış ham satır kullanıcı düzenlemesiyle fiziksel olarak değiştirilmeyecektir. Düzenleme, normalize işlem üzerinde yeni bir sürüm/override oluşturacak; ham kaynak değeri ve önceki normalize sürümler korunacaktır.
- `Hesaplamadan çıkar` işlemi kaydı kullanıcıya görünür tutacak fakat seçilen geçerlilik tarihinden itibaren resmi metrik ve bakiyelerde kullanmayacaktır. Çıkarma nedeni zorunlu olacak ve etkilediği sonuçlar gösterilecektir.
- Kullanıcının `Sil` işlemi uygulamada kaydı normal listelerden ve bütün resmi hesaplardan kaldıracaktır. Teknik olarak denetim ve geri alma için soft-delete/tombstone kullanılacak; kim, ne zaman, hangi gerekçeyle sildiği ve önceki değerler saklanacaktır.
- Silinen veya kapsam dışı bırakılan kayıt geri alınabilecek; geri alma da yeni bir işlem sürümü oluşturacaktır. Yetkili kullanıcı dışında geçmiş denetim izi fiziksel olarak silinemeyecektir.
- Manuel düzenleme arayüzü alan bazında eski değer, yeni değer, hesap etkisi ve doğrulama hatalarını gösterecektir. Kritik alanlar en az müşteri, belge/araç no, işlem türü, tarih/vade, tutar, para birimi, CREATED/CANCELLED, yöntem ve bağlantı alanlarıdır.
- Her manuel değişiklikte gerekçe zorunlu; not veya kanıt dosyası isteğe bağlı olacaktır. `created_by/changed_by`, tarih-saat ve geçerlilik başlangıcı saklanacaktır.
- Değişiklik kaydedildiğinde bağımlılık grafiği üzerinden etkilenen cari bakiye, açık fatura, aging, DSO, tahsilat, çek/senet riski, temsilci/SSM performansı, raporlar ve AI analizleri yeni calculation run ile yeniden hesaplanacaktır.
- Bir manuel değişiklik mükerrerlik, iptal veya Havale–Çek kapama bağlantısını belirsiz hale getirirse kullanıcıya Bölüm 24 kapsamında çözüm görevi gösterilecek; resmi yayın, kritiklik kuralına göre bekletilecektir.
- AI manuel kayıt/değişiklikleri hesaplarda kullanabilecek fakat kullanıcı işlemiymiş gibi gizlemeyecektir. Sorulduğunda sonucun ne kadarının kaynak Excel, ne kadarının manuel ekleme/düzeltmeden geldiğini açıklayacaktır.

### Manuel değiştirilmiş kaydın yeniden yüklenmesi — onaylandı

- Daha önce kullanıcı tarafından eklenmiş, düzenlenmiş, kapsam dışı bırakılmış, silinmiş veya manuel eşleştirilmiş bir işlemin doğal anahtarı ilerideki Excel yüklemesinde yeniden gelirse sistem bunu normal upsert olarak sessizce uygulamayacaktır.
- Sistem önce yeni ham satırı ayrı kaynak sürümü olarak kaydedecek; ardından `son kaynak sürümü`, `aktif manuel sürüm` ve `yeni gelen kaynak sürümü` arasında alan bazlı üçlü karşılaştırma yapacaktır.
- Kaynak satır önceki kaynakla tamamen aynıysa manuel karar korunacak; tekrar yükleme yeni finansal hareket oluşturmayacak. Yine de kayıt manuel değişiklikli olduğu için yükleme kontrol özetinde `manuel override korunarak yeniden görüldü` olarak raporlanacaktır.
- Yeni gelen kaynak satır önceki kaynaktan farklıysa `manual_source_conflict` uyarısı üretilecek. Kullanıcıya belge/doğal anahtar, müşteri, işlem türü, eski kaynak değeri, manuel değer, yeni kaynak değeri, değişen alanlar, dosya/yükleme zamanı ve olası bakiye/risk/performans etkisi gösterilecektir.
- Kullanıcı en az şu kararları verebilecektir: `manuel sürümü koru`, `yeni kaynak sürümünü kabul et`, `alan bazında birleştir`, `kapsam dışı bırak`, `silinmiş durumda tut`, `manuel bağlantıyı yeniden seç`.
- Kullanıcı karar verene kadar son onaylı manuel sürüm resmi hesaplarda geçerli kalacak; yeni gelen kaynak sürümü `pending_user_approval` durumunda tutulacak ve aynı hareketi ikinci kez hesaplara sokmayacaktır.
- Çatışmalı kayıt yeni bir iptal, ödeme, vade veya tutar gibi kritik olay taşıyorsa kullanıcıya yüksek öncelikli bildirim verilecek ve etkilenen sonuçlar `bekleyen kaynak güncellemesi` uyarısı taşıyacaktır. İlgisiz diğer kayıtların yüklenmesi devam edebilecektir.
- Onay sonrasında yeni işlem sürümü oluşturulacak, karar ve gerekçe saklanacak ve yalnız etkilenen bağımlılık zinciri yeniden hesaplanacaktır. Eski kaynak, manuel sürüm ve reddedilen/kabul edilen yeni kaynak denetim için korunacaktır.
- Kullanıcı isterse aynı alan için `bu kaynaktan gelen değeri gelecekte otomatik kabul et` veya `manuel değeri kilitle` politikası tanımlayabilecek; politika alan, kaynak türü, işlem türü ve geçerlilik tarihleriyle sınırlı ve geri alınabilir olacaktır.
- AI çatışma çözülmeden yeni kaynak değerini kullanmayacak; raporda aktif manuel sürümü kullandığını ve bekleyen kaynak güncellemesini açıklayacaktır.

## 28. Satın Alma dosyasındaki SATIN ALMA, İADE ve HİZMET ayrımı — onaylandı

### Kaynak bulgusu

- `Satın_Alma_(Veri_Yazma)` örnek dosyasında toplam `1.325` kayıt bulunmaktadır: `345 HIZMET`, `886 IADE` ve `94 SATIN ALMA`.
- Örnek dosyada HIZMET ve IADE kayıtlarının tamamı birebir `500...` müşteri koduna bağlıdır. SATIN ALMA kayıtlarının hiçbiri `500...` müşteri koduna bağlı değildir; bunlar tedarikçi firma hareketleridir.
- Örnek dosyadaki bütün kayıtlar `Fatura Durum=CREATED` durumundadır. Bu bulgu gelecek yüklemelerde iptal kontrolünü kaldırmaz.

### Finansal sınıflandırma ve bakiye etkisi

- `Tip=SATIN ALMA` kayıtları tedarikçi firma ile ilgilidir ve bu uygulamanın müşteri cari, tahsilat, finansal performans ve raporlama hesaplarında tamamen görmezden gelinecektir. Ham kaynak denetim amacıyla saklanabilir; müşteri finansal olayına dönüşmez.
- `Tip=IADE` kayıtları `CUSTOMER_RETURN_COLLECTION` sınıfına dönüştürülecektir. Geçerli CREATED IADE tutarı müşterinin cari borcunu `Fatura Tarihi` itibarıyla azaltır ve tahsilat sayılır.
- `Tip=HIZMET` kayıtları `CUSTOMER_SERVICE_COLLECTION` sınıfına dönüştürülecektir. Geçerli CREATED HIZMET tutarı müşterinin cari borcunu `Fatura Tarihi` itibarıyla azaltır ve tahsilat sayılır.
- IADE ve HIZMET aynı toplam tahsilata dahil olabilir fakat ayrı yöntem/sınıf olarak korunacak ve raporlanacaktır. Nakit, Havale, Çek veya Senet türüne dönüştürülmeyecek; kullanıcı ve AI toplam tahsilatın ne kadarının IADE, HIZMET ve diğer tahsilat yöntemlerinden geldiğini ayırabilecektir.
- IADE ve HIZMET satış cirosunu azaltan satış faturası, nakit/banka girişi veya yeni Sellout hareketi değildir. Finansal etkileri müşteri cari borcunu azaltan ayrı tahsilat/alacak hareketidir. `FIN-002 financial_revenue` hesabına girmezler.
- Geçerli IADE ve HIZMET olayları müşteri borcunu azalttığı için Paket 10 FIFO motorunda açık faturalara dağıtılır. Bu allocation'lar fatura kapama tarihini, tahsilat gerçekleşme gününü ve 3/6/12 aylık fatura–tahsilat hız/toplam/oran metriklerini etkiler; ancak `NONCASH_RETURN_SERVICE` sınıfıyla nakit tahsilattan ayrı katkı olarak gösterilir. `SATIN ALMA` bu hesapların hiçbirine girmez.
- IADE ve HIZMET kayıtları kullanıcı tarafından yüklenen anlık fiziksel stoğu artırmayacak veya azaltmayacaktır. Mevcut stok yalnız son başarılı aktif Malzemeler yüklemesinden gelir.
- Dosyanın `Durum=Aktarıldı/Aktarılamadı/...` alanı diğer finansal kaynaklarda olduğu gibi hesaplamada kullanılmayacaktır. Geçerliliği belge tipi, birebir `500...` müşteri, sayısal tutar, `Fatura Tarihi`, CREATED/CANCELLED durumu ve iptal/mükerrer kontrolleri belirler.
- IADE ve HIZMET için her yüklemede yeni kayıtlar bütün geçmişle karşılaştırılarak aktif iptal ve mükerrer kontrolünden geçirilecektir. Öncelikle `aynı EDOCUMENTNO + aynı müşteri + aynı Tip` kullanılacak; tutar, fatura no ve tarih doğrulama alanları olacaktır. Benzersiz ve güvenli eşleşme yoksa otomatik bakiye değişikliği yapılmayacak ve manuel çözüm görevi açılacaktır.
- Geçerli iptal çifti oluşursa hem CREATED hem CANCELLED olay cari bakiye, tahsilat, temsilci/SSM finansal performansı ve normal raporlardan çıkarılacak; daha önce yapılmış fatura dağıtımları geri alınacaktır.
- Müşteri/temsilci/SSM dönem tahsilat toplamı artık geçerli `Nakit + normal Havale + Çek kabulü + Senet kabulü + IADE + HIZMET` ekonomik olaylarının toplamıdır. Çek kapama Havalesi ikinci kez sayılmaz; Senet iadesi/karşılıksız adayında ise Bölüm 26'daki kullanıcı kararı geçerlidir.

## Devam noktası — yeni oturumda buradan başla

Bu başlığın önceki cari-risk/FIFO listesi tamamlanmıştır ve artık tarihsel devam işaretidir. Güncel devam noktası dosyanın en sonundaki **“Güncel devam noktası”** bölümüdür. Yeni oturumda önce bu dosya, hesaplama matrisi ve aşamalı kodlama planı okunmalı; onaylanmış kararlar yeniden sorulmamalıdır.

## Kodlama planı çalışma kuralı — onaylandı

- İş kararları netleştirilirken eş zamanlı olarak `KODLAMA_ASAMALI_UYGULAMA_PLANI.md` güncellenecektir.
- Kodlama tek seferde bütün kararlar için yapılmayacak; yalnız kapsamı, şeması, servis sözleşmesi, testleri ve kabul kriterleri tamamlanmış tek bir bölüm Terra'ya verilecektir.
- Terra yalnız `READY_FOR_TERRA` durumundaki bağımsız uygulama paketini kodlayacak; sonraki aşamanın kuralını varsaymayacak veya önceden uygulamayacaktır.
- Her yeni onay, ilgili metrik kimlikleri ve kodlama paketiyle bağlanacak; karar değişikliğinde paket/test/migration etkisi ayrıca sürümlenecektir.
- Bir paketin kabul testleri tamamlanmadan ona bağımlı sonraki paket uygulamaya açılmayacaktır.

## Hedef yayın ve veri mimarisi — onaylandı

- React/Vite arayüz Vercel üzerinde yayımlanacaktır.
- Resmi ilişkisel veri deposu Supabase PostgreSQL olacaktır. Supabase otomatik REST API yalnız kontrollü veri erişimi için kullanılacak; finansal iş kuralları servis/domain katmanında uygulanacaktır.
- Express/Vercel Functions katmanı veri, karmaşık hesaplama ve AI API'si olacaktır.
- IndexedDB yalnız geçici önizleme veya istemci cache'i olabilir; resmi finansal kayıt kaynağı olmayacaktır.
- Supabase Auth ve Row Level Security kullanılacak; service-role ve Gemini anahtarları hiçbir zaman tarayıcıya açılmayacaktır.
- Mevcut sekiz Gemini anahtarı backend ortam değişkeninde korunacak; AI anahtar/model geçişi backend tarafında çalışacaktır.
- Ücretsiz plan geliştirme/doğrulama içindir. Resmi üretim geçişinden önce kapasite, günlük yedek, erişilebilirlik ve log saklama gereksinimleri yeniden kontrol edilecektir.

## Cari etki tarihi ve çek/senet cari-risk ayrımı — onaylandı

- Geçerli satış faturası vergi dahil tutarıyla `Fatura Tarihi` itibarıyla müşteri cari borcunu artırır.
- Geçerli Nakit, normal Havale, IADE ve HIZMET olayları kendi `Fatura Tarihi` itibarıyla müşteri cari borcunu azaltır.
- Geçerli Çek ve Senet kabulü kaynak `Fatura Tarihi` itibarıyla müşteri cari borcunu azaltır; aynı anda eşit yüz değerli ayrı bir Çek/Senet portföy riski açar.
- Çek veya Senedin sonradan ödenmesi müşteri carisini ikinci kez azaltmaz. Ödeme yalnız ilgili kıymetli evrakın açık portföy riskini ödeme tarihi itibarıyla kapatır.
- Çek kapama Havalesi müşteri cari hareketi veya ikinci tahsilat değildir. Bölüm 26'daki gizleme ve denetim kuralları geçerlidir.
- `Cari açık bakiye`, `açık Çek riski` ve `açık Senet riski` ayrı metrik ve rapor alanlarıdır. Bunların hiçbiri diğerinin yerine gösterilemez.
- `Toplam müşteri riski = max(0, cari bakiye) + açık Çek riski + açık Senet riski` olarak hesaplanır. Alacaklı/negatif cari bakiye kıymetli evrak riskini matematiksel olarak mahsup etmez; ayrıca gösterilir.
- Senet iadesi/karşılıksız Senet adayında otomatik cari veya risk değişikliği yapılmaz. Bölüm 26 uyarınca son onaylı durum korunur ve kullanıcının ayrı bakiye/risk/statü kararı uygulanır.
- İptal veya manuel geçersizleştirme, orijinal olayın cari ve risk etkisini yeni calculation run'da geri alır; olayın yaptığı fatura dağıtımları da çözülür.
- Satın Alma dosyasındaki `Tip=SATIN ALMA` bu hesapların hiçbirine girmez. IADE ve HIZMET ise Bölüm 28'deki ayrı tahsilat sınıflarıyla cariyi azaltır.

## Fatura–tahsilat dağıtımı: en eski açık fatura FIFO — onaylandı

- Bir müşteriye ait her geçerli tahsilat/alacak olayı yalnız aynı müşterinin açık satış faturalarına dağıtılır. Müşteriler arasında otomatik kapatma veya mahsup yapılmaz.
- Varsayılan ve resmi dağıtım kuralı basittir: gelen tahsilat, `Fatura Tarihi` en eski olan açık faturadan başlayarak düşülür.
- Sıralama `Fatura Tarihi ASC` olacaktır. Aynı Fatura Tarihine sahip birden fazla açık fatura varsa sonuç her çalıştırmada aynı olsun diye sırasıyla normalize Fatura No/doğal belge anahtarı ve kalıcı işlem kimliği kullanılır. Bu eşitlik sırası yalnız teknik determinizmdir; yeni bir ticari öncelik oluşturmaz.
- Tahsilat tutarı ilk faturanın açık tutarından küçükse fatura kısmen kapanır ve kalan açık tutar korunur.
- Tahsilat tutarı ilk faturanın açık tutarından büyükse fatura tamamen kapanır; kalan tahsilat aynı FIFO sırasındaki sonraki açık faturaya aktarılır.
- Tek tahsilat birden fazla faturayı, tek fatura da farklı tarihlerde gelen birden fazla tahsilatı kapatabilir. Her parça ayrı `invoice_allocation` kaydı olarak tutulur.
- Bütün açık faturalar kapandıktan sonra artan tahsilat `dağıtılmamış müşteri alacağı/avans` olarak kalır. Yeni bir fatura daha sonra oluşursa bu mevcut alacak, yeni faturanın oluştuğu tarihte FIFO kuralıyla faturaya uygulanır; geçmiş kesim sonuçlarına gelecek veri sızdırılmaz.
- Fatura kapama tarihi, faturaya dağıtılan son gerekli tahsilat parçasının etkin tarihidir. Faturadan önce oluşmuş dağıtılmamış alacak yeni faturayı kapatıyorsa kapama/dağıtım tarihi fatura tarihinden önce olamaz; etkin tarih `max(fatura tarihi, alacak olay tarihi)` olur.
- Nakit, normal Havale, Çek kabulü, Senet kabulü, IADE ve HIZMET aynı FIFO dağıtım motoruna girer. Çek kapama Havalesi ikinci bir dağıtım oluşturmaz. Senet iadesi/karşılıksız olayında yalnız kullanıcının onayladığı bakiye etkisi dağıtımları değiştirir.
- Geçerli bir fatura veya tahsilat sonradan iptal edilir, kapsam dışı bırakılır, silinir ya da tutarı/tarihi değiştirilirse ona bağlı dağıtımlar çözülür ve ilgili müşterinin olayları etkin tarihe göre yeniden oynatılarak FIFO dağıtımı yeniden kurulur.
- Kullanıcı açıkça manuel bir fatura bağlantısı seçerse bu karar sürümlü override olarak saklanabilir; varsayılan otomatik yöntem her zaman FIFO'dur ve manuel bağlantı ham hareketi değiştirmez.

### İlk başlangıç yılı devir bakiye faturası — onaylandı

- Bu otomatik kural yalnız sistemin veri geçmişinin başlamasından önceki bakiyeyi içeri alan yapılandırılmış `initial_baseline_year` için çalışır.
- İlk başlangıç yılındaki pozitif müşteri devir bakiyesi, ilgili `devir_yılı` için **1 Ocak tarihli** özel bir faturalama/açık borç kaydı olarak oluşturulacaktır.
- Kayıt türü `OPENING_BALANCE_INVOICE` olacaktır. Normal satış faturasıyla aynı FIFO açık borç kuyruğuna girer; gelen tahsilat en eski açık kayıt kuralıyla önce uygun devir faturasına dağıtılabilir.
- Devir yılı yükleme tarihinden türetilmez. Dosyanın/aktarımın açıkça seçilmiş dönem yılı kullanılır; yıl güvenilir biçimde çözülemiyorsa kullanıcı kararı olmadan kayıt yayımlanmaz.
- Aynı bayi + müşteri + devir yılı için yeniden yükleme ikinci bir ekonomik devir faturası üretmez. Kaynak değişmişse sürüm farkı ve finansal etkisi kullanıcı onayına sunulur.
- Devir faturası cari borcu, açık fatura tutarını, yaşlandırmayı ve fatura kapama gününü etkiler. Yaş ve kapama günü başlangıcı ilgili yılın 1 Ocak tarihidir.
- Devir faturası aylık faturalama kaydında Ocak ayına girer; 3/6/12 fatura–tahsilat hesabında pencere Ocak ayını içeriyorsa paydada yer alır. Devir tutarı ve toplam içindeki payı her zaman normal satış faturalarından ayrı sınıflandırılır.
- Devir faturası ticari satış/ciro değildir. `FIN-002 financial_revenue`, Sellout, FKNS, ürün satışı, stok ve ticari satış performansına dahil edilmez.
- Ortalama fatura kapama ve tahsilat gerçekleşme günlerinde devir faturası 1 Ocak tarihinden ölçülerek kullanılabilir; AI ve rapor sonucun ne kadarının devir bakiyeden kaynaklandığını ayrıca açıklamak zorundadır.
- İlk başlangıç yılındaki negatif/alacaklı otomatik devir bakiye tamamen görmezden gelinir ve finansal etkisi `0` kabul edilir. Fatura, tahsilat, avans veya dağıtılmamış alacak üretmez; ham satır yalnız teknik denetim izinde `INITIAL_NEGATIVE_OPENING_IGNORED` nedeniyle korunur.
- Bu negatif-devir istisnası yalnız `initial_baseline_year` otomatik aktarımı içindir. Normal finansal hareketlerde oluşan alacaklı bakiye, fazla tahsilat veya manuel `DEVIR_ALACAK` bu kuralla sıfırlanmaz.
- Sonraki yıl geçişlerinde yeni otomatik devir faturası veya sıfırlama yapılmaz. Önceki yılın açık satış/devir kayıtları, virman lotları, allocation'ları ve dağıtılmamış gerçek alacakları kendi orijinal tarihleriyle kesintisiz devam eder; yaşlandırma 1 Ocak'ta yeniden başlamaz.

### Manuel fatura/belge girişi ve iki yönlü devir — onaylandı

- Kullanıcı tek bir manuel fatura/belge/işlem ekleme alanından en az `SATIS_FATURASI`, `HIZMET`, `IADE`, `DEVIR_BORC`, `DEVIR_ALACAK` ve `CARILER_ARASI_VIRMAN` türlerini seçebilecektir. Tür seçimi alanları, finansal yönü, sınıflandırmayı ve önizleme açıklamasını belirler.
- `DEVIR_BORC`, seçilen müşterinin cari borcunu artıran özel bir faturalama/açık borç kaydıdır. Kullanıcının seçtiği belge tarihiyle FIFO, açık fatura, aging ve kapama hesaplarına girer; fakat satış/ciro, Sellout, FKNS, stok veya satış performansı değildir.
- `DEVIR_ALACAK`, seçilen müşterinin cari borcunu azaltan özel alacak/mahsup olayıdır. Kullanıcının seçtiği belge tarihinde FIFO ile en eski açık faturalama kaydına dağıtılır; açık borç yoksa dağıtılmamış müşteri alacağı olarak kalır.
- `DEVIR_ALACAK` gerçek para tahsilatı değildir. Nakit/Havale/Çek/Senet/IADE/HIZMET tahsilat toplamına, likiditeye ve temsilci tahsilat performansına girmez; ekstrede ayrı `Devir Alacak` sınıfında görünür.
- Manuel `DEVIR_BORC` ve `DEVIR_ALACAK` yılın herhangi bir tarihinde girilebilir. Bunlar ilk başlangıç yılına özgü negatif otomatik devir görmezden gelme kuralından etkilenmez.
- `CARILER_ARASI_VIRMAN` seçildiğinde form tek müşteri/devir yönü yerine zorunlu `kaynak müşteri`, `hedef müşteri`, `virman tarihi`, `pozitif tutar` ve açıklama alanlarını açar. Kaynak ile hedef aynı olamaz. İşlem, aşağıdaki cariler arası virman kurallarına göre tek `transfer_id` altında dengeli iki taraf oluşturur.
- `DEVIR_BORC/DEVIR_ALACAK` ile `CARILER_ARASI_VIRMAN` birbirinin yerine kullanılamaz: devir tek müşterinin bakiyesine manuel borç/alacak düzeltmesidir; virman mevcut alacağı iki müşteri arasında şirket toplamını değiştirmeden taşır.
- Kullanıcı devir yönünü açıkça seçer; sistem tutarın işaretinden sessizce borç/alacak yönü türetmez. Tutar pozitif girilir, ekonomik yön belge türünden gelir.
- Bütün manuel türlerde müşteri, belge tarihi, pozitif tutar, açıklama ve benzersiz/sürümlü kayıt kimliği zorunludur. Satış faturasında gerekli ticari belge alanları; HIZMET/IADE'de kendi sınıf alanları ayrıca doğrulanır.
- Kaydetmeden önce cari bakiye etkisi, FIFO/aging etkisi, dahil olacağı ve dışarıda kalacağı metrikler kullanıcıya önizlenir. Kayıt manuel kaynak olarak etiketlenir; düzenleme, hesap dışına çıkarma, soft delete ve geri alma sürümlü denetim iziyle yapılır.

### Cariler arası virman — onaylandı

- Virman, açık bir alacak/borç parçasının sorumluluğunu kaynak müşteriden hedef müşteriye taşıyan çift taraflı tek ekonomik olaydır. Kaynak müşterinin cari borcu azalır, hedef müşterinin cari borcu aynı tutarda artar; şirket toplam cari alacağı değişmez.
- Her virman tek bir `transfer_id` altında dengeli `TRANSFER_OUT` ve `TRANSFER_IN` taraflarına sahip olacaktır. İki tarafın tutarı, para birimi ve etkin tarihi birebir eşit değilse virman resmi sonuçlara yayımlanmaz.
- Varsayılan seçim kaynak müşterinin FIFO sırasındaki en eski açık faturalama kayıtlarından başlar. Virman tutarı birden fazla faturaya dağılıyorsa her parça kendi kaynak fatura bağlantısıyla saklanır; bir faturanın yalnız bir kısmı aktarılabilir.
- Aktarılan parça hedef müşteride yeni bir ticari satış faturası oluşturmaz. `transferred_receivable_lot` olarak kaynak fatura/devir kaydı, orijinal fatura tarihi, kaynak müşteri, hedef müşteri, virman tarihi ve aktarılan tutar bağlantılarıyla izlenir.
- Hedef müşterinin aging ve FIFO sıralamasında orijinal fatura tarihi korunur. Virman tarihi borcun yaşını sıfırlamaz. Kaynak kayıt yıl başı devir faturasıysa 1 Ocak tarihi hedef müşteride de korunur.
- Orijinal tarih aging sırasını belirlese de hedef müşteri sorumluluğu virman etkin tarihinden önce başlayamaz. Hedefte daha önce oluşmuş dağıtılmamış alacak/avans varsa aktarılmış parçaya en erken virman tarihinde uygulanabilir; geçmiş rapor kesimlerine gelecek virman sızdırılmaz.
- Virman anı tahsilat veya fatura kapama tarihi değildir. Kaynaktaki parça `TRANSFERRED_OUT` olur; hedef müşteriden gelen gerçek tahsilat veya geçerli cari azaltan olay aktarılmış parçayı kapattığında gerçek allocation/kapama tarihi oluşur.
- Orijinal faturanın tamamı, kaynakta kalan ve hedefe aktarılan bütün parçalar kapandığında tamamen kapanmış sayılır. Parça bazlı sorumlu müşteri ve kapanış izi ayrıca korunur.
- Virman satış, ciro veya tahsilat değildir. `FIN-002 financial_revenue`, aylık ticari satış, aylık tahsilat, Sellout, FKNS ve temsilci satış/tahsilat performansına girmez. Finansal açık bakiye/risk sorumluluğu ise virman tarihinden itibaren hedef müşterinin bağlı olduğu organizasyonda görünür.
- Şirket düzeyinde virman toplam açık alacağı değiştiremez. Müşteri/temsilci/SSM dağılımı değişebilir; rapor bu değişimi satış veya tahsilat başarısı olarak yorumlamaz.
- Virman iptal edilir, tutarı/tarihi/hedefi değiştirilir veya manuel olarak geçersiz kılınırsa hem kaynak hem hedef müşterinin receivable lot ve FIFO/allocation zinciri aynı calculation run içinde birlikte yeniden oynatılır.
- Kullanıcı isterse kaynak fatura parçalarını manuel seçebilir. Bu seçim sürümlü override'dır; aksi halde deterministik FIFO uygulanır.

## Açık fatura yaşlandırması: faturadan geçen gün ve haftalık dilimler — onaylandı

- Müşteri satış faturalarına ayrı bir ticari `Vade Tarihi` veya müşteriye özel vade günü atanmayacaktır. Yaşlandırmanın tek zaman değeri, faturanın kesilmesinden rapor/kesim tarihine kadar geçen gündür.
- `Fatura yaş günü = rapor tarihi - Fatura Tarihi` takvim günü farkıdır. Saat ve saat dilimi hesaba katılmaz; iki tarih yerel takvim tarihi olarak karşılaştırılır. Fatura kesildiği gün yaş `0`dır.
- Sistem ayrıca `vade aşımı gün sayısı` adlı ikinci bir sayısal değer üretmeyecek, analiz etmeyecek veya ekranda göstermeyecektir.
- İşletme açısından `28` gün sınırı aşılmış kabul edilir. Bu yalnız `28 gün sınırı içinde / 28 gün sınırını aşmış` sınıflandırması ve uyarısıdır; ayrı bir gecikme günü metriği değildir. İlk sınır aşımı yaşı `29` gündür.
- Yaşlandırma yalnız FIFO dağıtımı sonrasında açık tutarı bulunan geçerli satış faturası, otomatik/manüel `DEVIR_BORC` ve virmanla devralınmış receivable lot kayıtlarına uygulanır. Tam kapanmış, iptal edilmiş veya geçersiz kayıtlar güncel açık yaşlandırmaya girmez; kısmi kayıtta yalnız kalan açık tutar kullanılır.
- Hesap motoru her açık fatura için kesin `invoice_age_days` değerini saklar ve istenen herhangi bir gün aralığını hesaplayabilir. Bu iç hesap ayrıntısı rapor sayfasını gereksiz sayıda kolonla genişletmez.
- Standart rapor gösterim dilimleri `0–6`, `7–13`, `14–20`, `21–28`, `29–45`, `46–60`, `61–89` ve `90+` olacaktır. Böylece ilk dört kısa takip diliminden sonra görünüm 45, 60 ve 90 gün karar eşiklerinde özetlenir.
- `90+` teknik olarak `invoice_age_days >= 90` demektir; önceki dilim bu nedenle `61–89`da biter. Arada gün boşluğu veya üst üste binme yoktur.
- Detay/AI sorgusu kesin gün değeri üzerinden başka bir aralık hesaplayabilir; standart sayfa kolonları kullanıcı açıkça değiştirmedikçe bu sekiz dilimdir.
- Her dilimin tutarı, o dilime düşen faturaların kalan açık tutarları toplamıdır. Dilim toplamları müşteri açık fatura toplamına birebir eşit olmalıdır.
- Gelecek tarihli fatura negatif yaşla yaşlandırılmaz; veri kalite sorunu oluşturur ve çözülene kadar resmi aging dağılımına alınmaz.
- AI yalnız fatura yaş gününü ve yaş dilimini kullanır. Örneğin `43 günlük açık fatura` veya `43–49 gün diliminde X TL` diyebilir; ayrı bir `15 gün vadesi geçmiş` değeri üretmez.
- Çek/Senet portföy riski fatura yaşlandırmasına karıştırılmaz. Kıymetli evrak vade/risk görünümü Bölüm 26 ve cari-risk ayrımı kurallarına göre ayrı raporlanır.

### Açık faturaların ortalama gün hesabı — onaylandı

- Müşteri için `Ortalama Açık Fatura Yaşı = round(Σ(açık_tutar_i × fatura_yaş_günü_i) / Σ(açık_tutar_i))` formülü kullanılır.
- Yalnız FIFO sonrasında `açık_tutar > 0` olan geçerli satış faturası, `DEVIR_BORC` ve devralınmış receivable lot kayıtları pay ve paydaya girer. Kapalı/iptal kayıt, dağıtılmamış müşteri alacağı, Çek/Senet riski ve negatif/alacaklı bakiye ortalamaya girmez; devir payı ayrıca açıklanır.
- Açık fatura bulunmuyorsa sonuç `null/yok` olur; `0 gün` gösterilmez. Gerçekten bugün kesilmiş açık fatura varsa sonuç doğal olarak `0 gün` olabilir.
- Temsilci, SSM ve şirket ortalaması müşteri ortalamalarının basit ortalaması değildir. Seçili kapsamdaki bütün pozitif açık fatura tutarları üzerinden aynı ağırlıklı formül doğrudan yeniden hesaplanır.
- Hesapta kesin decimal açık tutarlar ve tam günler kullanılır; yalnız kullanıcı gösteriminde sonuç en yakın tam güne yuvarlanır.
- Metrik adı `Ortalama Açık Fatura Yaşı`dır. `Ortalama Vade` veya `Ortalama Vade Tarihi` adı kullanılmayacaktır; sistemde ticari vade tarihi yoktur.

### Referans ve mevcut uygulama denetimi

- Referans uygulamadaki `gunFatura` ve pozitif `kalanBorc` ile tutar-ağırlıklı ortalama yaklaşımı korunacaktır.
- Referans uygulamanın `0–6, 7–13, 14–20, 21–27, 28–34, +35` kolonları kullanıcı kararındaki yeni özet görünümle değiştirilmiştir.
- Mevcut React uygulamasındaki `current/30/60/90/over90` dağılımı ve `daysOverdue` adı yeni modele taşınmayacaktır; değer gerçekte vade aşımı değil fatura yaşıdır.
- Referanstaki Cari Ekstre farkını bugünün tarihli sanal açık faturaya dönüştürme yaklaşımı kullanılmayacaktır. Kaynağı açıklanamayan bakiye farkı veri kalite/uzlaştırma kaydıdır; yapay fatura ve yapay yaş üretmez.
- Referans kodundaki `VADE_ESIGI_GUN=23` ile mevcut uygulama testlerindeki `>=28` kabulleri kullanıcı kararıyla geçersizdir. Yeni sınıflandırma yalnız `invoice_age_days > 28` yani ilk kez 29. günde çalışır.

### 28 gün sınırını aşmış açık alacak oranı — onaylandı

- Metrik adı `28 Gün Sınırını Aşmış Açık Alacak Oranı`dır. Formül `100 × Σ(invoice_age_days > 28 olan positive_open_amount) / Σ(tüm positive_open_amount)` olacaktır.
- Pay ve payda aynı müşteri/temsilci/SSM/şirket kapsamı ile aynı kesim tarihinde hesaplanacaktır. Pay, `FIN-011 over_28_open_amount`; payda FIFO sonrasındaki bütün pozitif açık fatura ve receivable lot tutarlarının toplamıdır.
- Paydayı `toplam müşteri riski` yapmak önerilmemektedir. Çek/Senet portföy riski cari hesabı kabul tarihinde azaltmış ayrı bir risk katmanıdır; fatura yaşına sahip değildir ve bu orana karıştırılması 29+ günlük açık fatura yoğunluğunu bozar.
- Negatif cari bakiye, dağıtılmamış müşteri alacağı, açık Çek/Senet riski ve başka müşterilerin alacaklı bakiyeleri paydayı azaltmaz veya artırmaz. Tahsilat/alacak olaylarının etkisi yalnız FIFO allocation sonrasında kalan açık tutar üzerinden zaten hesaba yansır.
- Geçerli `DEVIR_BORC`, `OPENING_BALANCE_INVOICE` ve virmanla devralınan açık receivable lot pay ve paydaya girer; devir kaynaklı tutar ayrıca açıklanır. Virman sonrası müşteri/organizasyon sahipliği hedefe geçer, fakat orijinal fatura tarihi ve yaşı korunur.
- Açık fatura toplamı `0` ise sonuç `null/yok` olacaktır. `%0` yalnız açık fatura bulunduğu halde 29+ günlük açık tutar gerçekten sıfırsa üretilebilir.
- Temsilci, SSM ve şirket oranı müşteri yüzdelerinin basit veya ağırlıksız ortalaması değildir; seçili kapsamdaki payların toplamı, paydaların toplamına bölünür.
- Pasif/iptal müşteri finansal raporlama kapsamına ilişkin onaylı `100 TL ve üzeri borçlu bakiye` kuralı bu metriğin müşteri/organizasyon kapsamına da uygulanır. Sellout/FKNS kapsamı bu finansal oranı etkilemez.
- Referans/mevcut uygulamadaki `30+` aging bucket toplamını net bakiyeye bölme yaklaşımı reddedilmiştir: işletme sınırı ilk kez 29. gündür, yaklaşık bucket kullanımı doğru tutarı vermez; net bakiyede açık faturayla ilgisiz mahsuplar bulunabilir.
- Mevcut `calculateOverdueRatio` fonksiyonunun sonucu `%0–%100` aralığına zorla sıkıştırması yeni motora taşınmayacaktır. Yeni pay, tanımı gereği aynı paydanın alt kümesi olduğu için oran doğal olarak `%0–%100` aralığındadır; aralık dışı sonuç veri/hesap kalite hatasıdır.
- AI bu metriği `28 günü aşan açık alacak oranı`, `29+ açık alacak payı` ve benzeri Türkçe niyetlerle eşleştirebilir; ayrı bir `vade aşımı günü` türetmez. Yanıtta en az pay, payda, oran, dönem/kesim, önceki karşılaştırma ve artışı taşıyan müşteri/fatura katkıları açıklanır.

## Muhasebesel DSO — onaylandı

### İş anlamı ve formül

- DSO, seçili dönemde ticari alacağın satış hacmine göre ortalama kaç günlük satışa karşılık geldiğini ölçer. `Ortalama Açık Fatura Yaşı`, `Fatura Kapama Günü` ve `Tahsilat Gerçekleşme Günü` ile aynı metrik değildir.
- Önerilen resmi formül `DSO gün = Σ(dönemdeki her takvim gününün gün sonu pozitif açık ticari alacağı) / Σ(dönemdeki geçerli ticari satış faturası)`dır.
- Bu formül matematiksel olarak `günlük ortalama pozitif açık alacak / dönem ticari satışları × dönemdeki gerçek takvim günü sayısı` ile aynıdır. Günlük zaman ağırlıklı bakiye, yalnız dönem başı ve dönem sonu bakiyesinin basit ortalamasından daha doğru olduğu için tercih edilmiştir.
- Gün sonu açık alacak, merkezi olay defteri ve FIFO/allocation zincirinden yeniden kurulur. Günlük Excel bakiye yüklemesi veya kullanıcı tarafından ayrıca günlük snapshot girilmesi gerekmez.
- Aynı gün kesilip aynı gün tamamen kapanan fatura gün sonu açık alacağa girmez; satış paydasına girer. Tarihler yalnız yerel takvim tarihiyle değerlendirilir.

### Pay ve payda kapsamı

- Günlük açık alacak payına geçerli satış faturaları, `OPENING_BALANCE_INVOICE`, manuel `DEVIR_BORC` ve virmanla devralınmış açık receivable lotların o gün sonundaki pozitif kalan tutarları girer.
- Ticari satış paydasına yalnız geçerli vergi dahil müşteri satış faturaları girer. `OPENING_BALANCE_INVOICE`, manuel `DEVIR_BORC`, `DEVIR_ALACAK`, virman, Sellout TL, IADE/HIZMET, tedarikçi satın alma ve iptal grupları satış paydasına girmez.
- IADE/HIZMET, normal tahsilat ve diğer geçerli cari azaltan olaylar FIFO sonrasında günlük açık alacağı düşürür; ayrıca satış tutarı gibi paydaya yazılmaz.
- Çek/Senet kabulü cari faturayı kapattığı tarihte günlük açık alacağı düşürür. Daha sonraki kıymetli evrak ödeme süresi DSO'ya eklenmez; bu süre portföy/risk ve nakde dönüş metriğinde ayrıca izlenecektir.
- Negatif cari bakiye ve dağıtılmamış müşteri alacağı başka açık faturaları veya müşterileri mahsup ederek günlük pozitif açık alacak toplamını küçültmez.

### Dönem, toplulaştırma ve sınır durumları

- Aylık DSO gerçek takvim ayının bütün gün sonlarını kullanır. 3/6/12 aylık DSO, ilgili tamamlanmış takvim penceresindeki günlük açık alacakların ve ticari satışların tamamı üzerinden tek kez hesaplanır; aylık DSO değerlerinin basit ortalaması alınmaz.
- Dönem gün sayısı 28/29/30/31 ve çok aylı pencerelerde gerçek takvimden gelir. `N×30` yaklaşımı kullanılmaz.
- Cari ay DSO'su ayrı `MTD/PARTIAL` sonuçtur; yalnız tamamlanmış günleri kapsar ve tamamlanmış ay DSO'suyla aynı statüde karşılaştırılmaz.
- Temsilci/SSM/şirket DSO'su alt müşteri DSO'larının ortalaması değildir. Her gün ilgili kapsamın pozitif açık lotları ve dönem satışları yeniden toplanır.
- Virman tarihinde açık lot sorumluluğu kaynak organizasyondan hedef organizasyona geçer. Şirket DSO'su değişmez; temsilci/SSM katkısı virman etkin tarihinden itibaren hedefte görünür. Orijinal fatura tarihi korunur fakat DSO günlük sahiplik üzerinden hesaplanır.
- Dönem ticari satış toplamı `0` ise DSO `null` olur. Açık alacak varsa `NO_SALES_WITH_OPEN_RECEIVABLE` risk durumu; açık alacak da yoksa `NO_ACTIVITY` nedeni gösterilir. Sonsuz, sıfır veya yapay gün üretilmez.
- DSO dönem gün sayısını aşabilir; özellikle eski/devir alacak veya zayıf tahsilat varsa bu geçerli bir sonuçtur. Sonuç yapay üst sınıra sıkıştırılmaz.
- Başlangıç bakiyesi, gün sonu olay zinciri veya satış kaynağı kapsamı eksikse eksik gün sıfır sayılmaz. `coverage_days`, `expected_days`, `opening_reconciliation_status` ve satış coverage sonucu birlikte saklanır; resmi DSO gerekirse `PARTIAL/BLOCKED` olur.

### Devir etkisi ve açıklanabilirlik

- Devir kaynaklı açık alacak ana DSO'nun günlük alacak payında kalır; çünkü işletmenin taşıdığı gerçek alacaktır. Ancak ticari satış paydasına eklenerek DSO yapay biçimde düşürülemez.
- `Devir DSO katkısı = Σ(gün sonu açık devir tutarı) / Σ(dönem ticari satış faturası)` ayrıca hesaplanır. AI ve rapor toplam DSO'yu, devir katkısını ve devir dışı katkıyı ayırabilir.
- İlk baz yıl öncesi hareketler bulunmadığından devir alacağının gerçek oluşum/kapanma davranışı ayrıca coverage notu taşır. Sonraki yıllarda geçmiş olaylar mevcut olacağı için yeni otomatik devir yaratılmaz ve DSO tarihi sıfırlanmaz.

### Referans/mevcut uygulama kararı ve AI

- Referansın günlük snapshot'lardaki `kalanBorc × avgVadeGun / kalanBorc` hesabına DSO demesi `REJECT/RENAME` edilmiştir. Bu hesap `Ortalama Açık Fatura Yaşı`dır ve zaten ayrı onaylı metriktir.
- Mevcut uygulamadaki dönem sonu bakiye veya dağınık özetlerden türetilen DSO benzeri yorumlar resmi metrik olarak taşınmaz. Yeni DSO yalnız merkezi olay defteri, gün sonu açık lot ve ticari satış sonuçlarından gelir.
- Basit `dönem sonu alacak / dönem satış × gün`, yalnız karşılaştırmalı karakterizasyon alanı olabilir; dönem içi dalgalanmayı kaçırdığı için resmi DSO değildir. `(açılış+kapanış)/2` yaklaşımı da günlük zaman ağırlıklı veri üretilebildiği sürece kullanılmaz.
- AI `DSO`, `alacakların satışa göre dönüş günü` ve benzeri niyetleri `FIN-013`e; `açık faturalar ortalama kaç günlük` sorusunu `FIN-011A`ya yönlendirir. İki sonucu birbirinin adıyla sunmaz.
- AI DSO yorumunda en az dönem/kapsam, DSO günü, önceki tamamlanmış dönem farkı, açık alacak ve satış değişiminin ayrı katkısı, devir katkısı, en etkili müşteri/temsilci, coverage ve Çek/Senet riskinin metrik dışında olduğu bilgisini kullanır.

## 29+ günlük alacak tahsilat etkinliği (CEI) — onaylandı

### Metrik amacı ve formül

- Sistem sözleşmesel vade kullanmadığı için genel finans literatüründeki `vadesi gelmiş alacak` kavramı doğrudan uygulanamaz. Bu nedenle uygulamadaki CEI, açıkça `29+ Günlük Alacak Tahsilat Etkinliği` olarak adlandırılacaktır.
- Önerilen formül `CEI = 100 × dönem içinde uygun 29+ alacağa uygulanan geçerli cari azaltan allocation / düzeltilmiş 29+ tahsil edilebilir alacak havuzu`dur.
- `Düzeltilmiş 29+ havuz = dönem başı 29+ açık tutar + dönem içinde ilk kez 29+ yaşına ulaşan açık tutar + yeniden açılan 29+ tutar + 29+ virman girişleri − iptal/geçersizlik kaynaklı performans dışı çıkışlar − 29+ virman çıkışları`.
- Aynı açık receivable lot parçası aynı dönem/kapsam içinde havuza yalnız bir kez girer. Önceki dönemden 29+ açık gelen tutar açılış havuzundadır; yeni dönemde yeniden `yaşlandı` diye ikinci kez eklenmez.
- Önceden gerçekten kapanmış bir 29+ lot, tahsilat iptali/geri alma veya kullanıcının onayladığı Çek/Senet ters bakiye etkisiyle yeniden açılırsa geri gelen tutar `aged_reinstatement` olarak havuza eklenir. Bu giriş tahsilat başarısı değildir; sonraki allocation'ın paydasız biçimde CEI'yi yükseltmesini önler.
- Pay, tahsilat toplamından veya bakiye farkından türetilmez. FIFO/manual allocation kaydının bağlandığı lot, allocation etkin tarihinde `invoice_age_days > 28` ise yalnız o allocation tutarı uygun kapama sayılır.

### Hangi olaylar başarı sayılır?

- Nakit, normal Havale, Çek kabulü, Senet kabulü, IADE ve HIZMET allocation'ları 29+ lotu kapattıkları tutar kadar paya girer. Sonuç ayrıca `nakit/banka`, `kıymetli evrak kabulü` ve `cari mahsup` olarak ayrılır; likidite girişiyle aynı şeymiş gibi yorumlanmaz.
- Çek kapama Havalesi ikinci tahsilat değildir ve CEI payına girmez. Çek/Senedin daha sonra ödenmesi cari alacağı ikinci kez kapatmaz.
- `DEVIR_ALACAK` gerçek tahsilat/likidite değildir. Cari düzeltme olarak 29+ lotu kapatırsa ana CEI payına gizlice eklenmez; `manual_balance_adjustment` mutabakat sınıfında ayrıca gösterilir. Böylece manuel düzeltme tahsilat performansını yapay yükseltemez.
- Virman tahsilat değildir. Kaynak kapsamda 29+ virman çıkışı havuzdan performans dışı çıkar; hedef kapsamda aynı açık parça virman tarihinde 29+ ise havuza transfer-in olarak girer. Şirket düzeyinde transfer-in/out birbirini götürür ve havuz/CEI değişmez.
- Fatura veya devir borcu iptali, kayıt geçersizliği, soft-delete ve kullanıcı tarafından `bakiyeye etkisiz` kararı tahsilat başarısı değildir. İlgili tutar havuzdan `non_performance_exit` olarak çıkarılır; paya yazılmaz.
- Tahsilat iptali veya manuel değişiklik allocation zincirini yeniden oynatır. Önceden başarı sayılan kapama geri alınabilir; yeni calculation run resmî CEI'yi yeniden üretir.

### Dönem ve toplulaştırma

- Standart ana dönem tamamlanmış takvim ayıdır. 3/6/12 aylık CEI, pencere başındaki 29+ açık havuz ve pencere içinde ilk kez uygun hâle gelen lotlar üzerinden tek kez hesaplanır; aylık CEI yüzdelerinin ortalaması alınmaz.
- Cari ay sonucu `MTD/PARTIAL` olarak ayrı gösterilir. Dönemin son gününde ilk kez 29+ olan açık tutar da havuza girer; AI bunun kısa takip süresini katkı açıklamasında belirtir.
- Müşteri, temsilci, SSM ve şirket CEI'si alt yüzdelerin ortalaması değildir. İlgili kapsamın uygun kapama payları ve düzeltilmiş havuzları yeniden toplanır.
- Pasif/iptal müşterilerin finansal kapsama alınması onaylı `100 TL ve üzeri borçlu bakiye` kuralına uyar. Sellout/FKNS kapsamı CEI'yi etkilemez.
- Payda `0` ise sonuç `%100` değil `null/NO_ELIGIBLE_AGED_RECEIVABLE` olur. Havuz var fakat uygun kapama yoksa sonuç gerçek `%0`dır.
- Oran tanımı gereği `%0–%100` aralığındadır. Aralık dışı sonuç clamp edilmez; lotun iki kez sayılması, yanlış transfer veya allocation mutabakatı için veri kalite hatası oluşturur.

### Devir, coverage ve mutabakat

- `OPENING_BALANCE_INVOICE` ve manuel `DEVIR_BORC`, yaşları 29+ olduğunda havuza girer. Tahsilatla kapatılan kısımları paya girebilir; devir havuzu ve devirden tahsil edilen tutar ayrıca açıklanır.
- İlk baz yıl öncesi ayrıntı bulunmadığından açılış devir lotlarının köken coverage'ı sınırlıdır; ancak 1 Ocak tarihli onaylı lot ve sonraki gerçek allocation'lar gözlendiği ölçüde dönem CEI'si hesaplanabilir. Coverage sonucu yorum güvenini ayrıca taşır.
- Her sonuç için `açılış 29+`, `yeni 29+`, `aged_reinstatement`, `transfer-in`, `uygun kapama`, `manuel düzeltme`, `iptal/geçersizlik çıkışı`, `transfer-out` ve `kapanış 29+` tutarları lot bazında mutabık olmalıdır.
- Eksik dönem başı olay geçmişi, eksik allocation zinciri veya çözümlenmemiş iptal/manuel çatışma varsa eksik kayıt sıfır kabul edilmez; CEI `PARTIAL/BLOCKED` ve coverage nedenleriyle döner.

### Referans/mevcut uygulama kararı ve AI

- Mevcut React `calculateCEI(collections, sales, currentReceivables)` fonksiyonundaki `collections / (collections + currentReceivables)` formülü `REJECT` edilmiştir. Dönem, 29+ uygunluk ve hangi faturanın kapandığı bilgisi yoktur; IADE/HIZMET'i de tahsilat performansına karıştırır.
- Referanstaki klasik görünümlü `(dönem başı bakiye + dönem satış − dönem sonu toplam bakiye) / (dönem başı bakiye + dönem satış − dönem sonu vadesiz bakiye)` formülü resmî hesap olarak `REJECT/CHARACTERIZATION_ONLY`dır. `23 gün` eşiği yanlıştır; eski arşivde müşteri ortalama yaşından yaklaşık vadesiz bakiye üretir; iptal/virman/düzeltme gibi bakiye azalışlarını tahsilat sanabilir.
- Referans temsilci tablosundaki `tahsilat / (tahsilat + kalan borç)` ayrıca ana CEI formülünden farklıdır ve `REJECT` edilmiştir. Şirket ve temsilci aynı merkezi pay/havuz sözleşmesini kullanacaktır.
- AI `CEI`, `29+ tahsilat etkinliği`, `eski borç tahsilat başarısı` gibi niyetleri `FIN-014`e yönlendirir. `Tahsilat/fatura oranı` sorusunu ise onaylı ayrı dönemsel akış oranına yönlendirir; iki metriği karıştırmaz.
- AI sonucu düz yüzde olarak sunmaz: pay/havuz, açılış-yeni yaşlanan ayrımı, tahsilat sınıfı, devir etkisi, kapanış 29+, geçmiş dönem farkı, katkıyı taşıyan müşteriler/temsilciler, coverage ve önerilen takip listesini açıklar.

## Açıklanabilir finansal sağlık skoru ve bağımsız risk bayrakları — onaylandı

### Temel tasarım kararı

- Finansal sağlık tek bir kara kutu sayı olmayacaktır. Sonuç; `bileşen puanları`, `aktif ağırlıklar`, `ham metrikler`, `risk bayrakları`, `coverage/güven` ve `kural sürümü` ile birlikte üretilecektir.
- Skor müşteri düzeyinde `0–100` aralığında açıklayıcı bir önceliklendirme göstergesidir. Tek başına sevkiyat durdurma, müşteri pasifleştirme, kredi limiti değiştirme veya başka bir finansal işlem yapamaz. Bu işlemler ileride ayrı, kullanıcı onaylı politika ve mutasyon akışıdır.
- Gerçek risk bayrakları skordan ayrıdır. Örneğin teyitli karşılıksız evrak, skor orta görünse bile gizlenmez; veri eksikliği de skor cezası gibi değil güven sorunu olarak gösterilir.
- Excel'deki kredi limiti kullanılmayacaktır. Onaylı `FIN-016` sistem içi limit, finansal sağlık skorunun girdisi değildir; sağlık skoru limit davranış faktörüne tek yönlü girdi olabilir. Böylece limit ile skor arasında döngüsel bağımlılık oluşmaz.

### Önerilen v1 bileşenleri ve ağırlıkları

- `Yaşlandırma sağlığı — %35`: Güncel pozitif açık tutarın yaş yapısını ölçer. `0–28` gün cezasız, `29–45` için `25`, `46–60` için `50`, `61–89` için `75`, `90+` için `100` ceza uygulanır. `aging_score = 100 − Σ(dilim_tutar_payı × dilim_cezası)`.
- `29+ tahsilat etkinliği — %25`: Son 12 tamamlanmış ayın onaylı `FIN-014 CEI` yüzdesidir. Uygun eski alacak havuzu yoksa `%100` varsayılmaz; bileşen null olur.
- `Toplam risk yükü — %20`: `toplam müşteri riski / son 12 kapsanmış ayın ortalama aylık ticari satışı` ile kaç aylık satış büyüklüğünde risk taşındığını ölçer. Başlangıç kırıkları `≤1 ay:100`, `1–2:80`, `2–3:60`, `3–4:40`, `4–6:20`, `>6:0`dır.
- `Gerçek fatura kapanma davranışı — %10`: Son 12 tamamlanmış ayda kapanan faturaların tutar-ağırlıklı gerçek kapanma günüdür. Başlangıç puanı `≤28:100`; `29–45` aralığında `100→70`, `46–60` aralığında `70→40`, `61–90` aralığında `40→10`, `>90:0` olacak şekilde doğrusal azalır.
- `Çek/Senet güvenilirliği — %10`: `100 × (1 − teyitli karşılıksız/iade tutarı / sonucu gözlenmiş vadesi gerçekleşmiş evrak tutarı)`. Yalnız ödeme eşleşmesi veya kullanıcı kararıyla sonucu kesinleşmiş evrak paydaya girer. Vadesi gelmemiş ya da vadesi geldiği hâlde sonucu bekleyen evrak başarı sayılmaz; bileşen paydaya girmez ve ayrı risk/coverage bayrağı oluşturur.
- DSO ayrı bir teşhis ve trend metriğidir; yaşlandırma/risk yüküyle yüksek korelasyonu nedeniyle v1 bileşik puana ayrıca eklenmez. AI DSO değişimini yorumda kullanır fakat aynı riski iki kez cezalandırmaz.

### Null, coverage ve yeniden ağırlıklandırma

- Her bileşen kendi coverage sözleşmesini sağlamıyorsa null olur; uydurma varsayılan değer kullanılmaz. Özellikle mevcut uygulamadaki veri yokken `paymentTrendDays=30` fallback'i yasaktır.
- Null bileşen varsa kalan bileşenler yalnız aktif ağırlık toplamına bölünerek yeniden ağırlıklandırılır: `health_score = Σ(puan × aktif ağırlık) / Σ(aktif ağırlık)`.
- Kullanılabilir başlangıç ağırlığı `%60`ın altındaysa veya ikiden az uygun bileşen varsa resmî skor üretilmez; `INSUFFICIENT_DATA` döner. Böylece tek bir iyi görünen alan müşteriyi yapay biçimde sağlıklı göstermez.
- Coverage/güven sonucu `HIGH/MEDIUM/LOW/INSUFFICIENT` olarak ayrıca döner ve sağlık puanına eklenip çıkarılmaz. Eksik veri finansal davranışın kendisi değildir.
- Hiç açık alacağı olmayan müşteri otomatik `100` almaz. Güncel aging bileşeni null olur; yeterli geçmiş CEI, kapanma ve evrak verisi varsa geçmiş davranış skoru üretilebilir, yoksa sonuç yetersiz veridir.

### Risk bayrakları ve skor bandı

- Başlangıç gösterim bantları sürümlüdür: `85–100 Sağlıklı`, `70–84 İzlemeli`, `50–69 Yüksek Risk`, `<50 Kritik Risk`. Bant adı skorun yanında bileşen ve güvenle gösterilir; tek başına otomatik aksiyon değildir.
- Skordan bağımsız bayraklar en az `90+ açık alacak`, `teyitli karşılıksız/iade evrak`, `sonucu bekleyen vadesi geçmiş evrak`, `satış olmadan taşınan açık risk`, `29+ oranda hızlı bozulma`, `kritik veri coverage sorunu` ve `çözümlenmemiş manuel/kaynak çatışması` olacaktır.
- `Hızlı bozulma`, tek günlük farktan değil sürümlü karşılaştırma kuralından üretilecektir. Başlangıç önerisi son tamamlanmış ay ile önceki tamamlanmış ay arasında hem maddi TL eşiği hem oran değişimi birlikte sağlandığında bayrak üretmektir; kesin maddilik eşiği daha sonra sistem parametresidir.
- Pasif/iptal müşteri pozitif borçlu bakiyesi `100 TL ve üzeriyse` finansal risk raporunda ve bağlı temsilci sorumluluğunda görünür. Müşteri statüsü skorun içine keyfî ceza olarak eklenmez; ayrı kapsam/etikettir.

### Toplulaştırma ve organizasyon

- Temsilci/SSM/şirket için müşteri sağlık puanlarının basit ortalaması ana portföy sonucu olamaz. Organizasyon özeti ham tutarları ve bileşen pay/payda değerlerini yeniden toplar; ayrıca müşteri skor dağılımını `sağlıklı/izlemeli/yüksek/kritik/yetersiz veri` adet ve risk tutarıyla gösterir.
- Virman sonrası açık risk ve aging sorumluluğu etkin tarihten itibaren hedef müşterinin organizasyonuna geçer. Geçmiş tahsilat/kapanma davranışı olay tarihindeki sorumlu organizasyonla korunur; virman tahsilat başarısı değildir.
- Devir kaynaklı açık tutar, aging ve risk yüküne girer; devir payı ayrıca açıklanır. İlk baz yıl coverage sınırlaması güven sonucunda görünür.

### Referans/mevcut uygulama kararı ve AI

- Mevcut `calculateFinancialHealthScore` içindeki aynı 30+/60+/90+ yaş etkisini üst üste bindiren cezalar, sabit `paymentTrendDays=30`, `%0–100` clamp ve skor içinden otomatik sevkiyat durdurma metni `REJECT` edilmiştir.
- Mevcut Dashboard'daki sabit `30 günlük sektör hedefi`, `60+ ise acil sevkiyat kısıtı` ve kaynağı sürümlenmemiş öneriler resmî kural olarak taşınmaz.
- Korunacak fikirler `KEEP/REVISE` olarak şunlardır: yaş yapısı, tahsilat davranışı, risk büyüklüğü ve kıymetli evrak güvenilirliğini birlikte değerlendirmek; ancak her biri merkezi metrik ve ayrı açıklanabilir bileşen olacaktır.
- AI yalnız toplam skoru söylemez. Her cevapta en güçlü ve en zayıf bileşenleri, toplam puana puan etkisini, bağımsız risk bayraklarını, önceki dönem değişimini, devir/virman etkisini, coverage/güveni ve önerilen takip önceliğini açıklar.
- AI `skor düşük, sevkiyatı durdur` gibi otomatik karar vermez. `RECOMMENDATION` olarak gerekçeli seçenek sunabilir; uygulanması ayrı kullanıcı onayı ve yetkili mutasyon aracı gerektirir.

## Sistem tarafından hesaplanan iç kredi/risk limiti — onaylandı

### Limitin anlamı ve tüketimi

- Excel Master içindeki kredi limiti okunabilir ham/audit alanı olarak tutulabilir fakat hiçbir sistem limiti, skor, rapor, fallback veya karşılaştırma hesabında kullanılmayacaktır.
- Yeni metrik `Sistem Önerilen Toplam Risk Limiti`dir. Yalnız cari açık bakiyeyi değil, onaylı `Toplam Müşteri Riski = max(0,cari açık) + açık Çek riski + açık Senet riski` tutarını sınırlar.
- Çek/Senet kabulü cariyi düşürüp eşit kıymetli evrak riski açtığı için toplam limit kullanımı değişmez. Evrak gerçekten ödendiğinde veya kullanıcı tarafından onaylı başka risk kapama olayı gerçekleştiğinde limit boşluğu açılır.
- `Limit kullanımı = toplam müşteri riski / etkin iç limit`; `kullanılabilir limit = max(0, etkin iç limit − toplam müşteri riski)`. Limit aşımı geçmiş hareketi, bakiyeyi veya evrakı değiştirmez; rapor/uyarı ve kullanıcı inceleme görevi üretir.
- Önerilen limit mevcut riski formül girdisi yapmaz. Aksi hâlde müşteri borçlandıkça sistem limitinin yükselmesi gibi ters teşvik oluşur. Mevcut risk yalnız kullanım ve boşluk hesabında kullanılır.

### Önerilen v1 formülü

- `Ham önerilen limit = min(operating_need_limit, cash_realization_capacity_limit) × behavior_factor`.
- Sonuç konfigüre edilmiş `1.000 TL` birimine en yakın değere yuvarlanır; iç hesap kesin decimal kalır. Yuvarlama birimi sürümlü parametredir.
- `operating_need_limit`, müşterinin normal ticari faaliyetini bir 28 günlük döngüde karşılamak için beklenen brüt fatura ihtiyacıdır. Tercih edilen değer, gelecek 28 günlük geçerli ticari fatura tahmininin `%75` quantile'ıdır.
- Finansal tahmin modeli için yeterli geçmiş/model coverage yoksa fallback, son 12 tamamlanmış aydaki takvim uyumlu kayan 28 günlük geçerli ticari fatura toplamlarının `%75` quantile'ıdır. Eksik gün sıfır kabul edilmez.
- Ticari ihtiyaçta yalnız vergi dahil geçerli satış faturaları bulunur. Devir, virman, IADE/HIZMET, tedarikçi satın alma ve Sellout TL limiti büyütmez.
- `cash_realization_capacity_limit`, son 12 tamamlanmış ayın kayan 28 günlük gerçek nakit/risk azaltma toplamlarının muhafazakâr `%25` quantile'ıdır. Böylece tek seferlik büyük tahsilat limiti yapay yükseltmez.
- Nakit ve normal Havale cari riski azalttığı tarihte; Çek/Senet ise kabul tarihinde değil gerçekten ödendiğinde nakit/risk azaltma kapasitesine bir kez girer. Çek kapama Havalesi ikinci tahsilat olarak sayılmaz.
- IADE/HIZMET cari bakiyeyi ekonomik olarak azaltmaya devam eder fakat olağan nakit ödeme kapasitesini kanıtlamadığı için limit kapasitesini artırmaz. Manuel `DEVIR_ALACAK`, iptal, virman ve bakiye düzeltmeleri de kapasiteye girmez.

### Davranış faktörü, güven ve manuel inceleme

- Başlangıç davranış faktörü onaylı finansal sağlık skorundan gelir: `85–100 → 1,00`, `70–84 → 0,80`, `50–69 → 0,50`, `<50 → 0,25`.
- Sağlık skoru tek başına limit işlemi değildir. `LOW/INSUFFICIENT` güven, teyitli açık karşılıksız evrak, sonucu bekleyen kritik evrak, kritik veri çatışması veya hesaplanamayan ihtiyaç/kapasite halinde sistem tutar uydurmaz; `MANUAL_REVIEW` döner.
- Hiç geçmişi olmayan yeni müşteri otomatik olarak mevcut müşterilerden türetilmiş sahte limite sahip olmaz. Başlangıç/starter limit politikası ayrıca kullanıcı tarafından tanımlanana kadar öneri `null/NEW_CUSTOMER_REVIEW` olur.
- Pasif/iptal müşteri pozitif borçlu bakiye kuralıyla finansal raporda kalır; ancak yeni limit önerisi `REVIEW_ONLY` görünür ve otomatik limit artışı önerilmez.

### Sürüm, değişim kontrolü ve kullanıcı override'ı

- Sistem `raw_recommended_limit`, `governed_recommended_limit`, `effective_internal_limit`, `current_exposure`, `usage`, `headroom`, `policy_version`, `confidence` ve `next_review_date` değerlerini ayrı saklar.
- Normal koşulda önceki etkin limite göre tek incelemede `%25`ten büyük artış veya azalış doğrudan yayınlanmaz; karşılaştırmalı kullanıcı incelemesine gider. Bu governor gerçek ham öneriyi gizlemez.
- Teyitli kritik riskte sistem `%25`ten büyük düşüş önerebilir fakat otomatik uygulamaz. Kullanıcı etkiyi gördükten sonra onaylar, farklı tutar girer veya mevcut limiti geçici korur.
- Kullanıcı iç limiti sürümlü gerekçe, geçerlilik başlangıç/bitiş tarihi ve inceleme tarihiyle değiştirebilir. Sonraki sistem hesaplaması aktif override'ı sessizce ezmez; eski etkin limit, yeni sistem önerisi ve beklenen kullanım etkisini onaya sunar.
- Limit değişikliği yeni satış/tahsilat/bakiye olayı üretmez. Yalnız politika/karar sürümü ve raporlama durumunu değiştirir.

### İzleme, stres ve portföy kontrolü

- Sistem yalnız bugünkü kullanımı değil, onaylı fatura tahminiyle `28 günlük projected_exposure` değerini de hesaplar. Tahmin gerçek değildir; `FORECAST` olarak ayrı gösterilir.
- Başlangıç stres görünümü en az `tahsilat kapasitesi %25 düşerse`, `tahsilat 14 gün gecikirse` ve `öngörülen satış %25 artarsa` senaryolarında projected usage/headroom üretir. Stres sonucu etkin limiti otomatik değiştirmez.
- Temsilci/SSM/şirket görünümünde limitlerin ortalaması alınmaz. Toplam etkin limit, toplam risk, toplam boşluk, limit aşan müşteri adedi/tutarı ve risk yoğunlaşması gösterilir.
- Müşteri limitleri müşteri talebine göre otomatik büyümez; sürümlü risk toleransı, davranış, ödeme kapasitesi ve tahmini gelecek maruziyetle izlenir. Bu yaklaşım güncel Basel ilkelerindeki karşı taraf bazlı toplam maruziyet, gelecek maruziyet, stres ve limit kullanımının sürekli izlenmesi prensipleriyle uyumludur.

### Referans/mevcut uygulama kararı ve AI

- Mevcut `shadowLimit = monthlyAvgCollection × reliabilityScore × 1,5` formülü `REJECT` edilmiştir. `1,5` katsayısı dayanıksızdır; tahsilat tarih aralığını `÷30` ile aya çevirir; eski borç tahsilatı ve Çek/Senet kabulü limiti şişirebilir; toplam riski ve coverage'ı ölçmez.
- Mevcut formülün veri yokken Master/Excel `declaredLimit` değerine dönmesi kullanıcı kararıyla kesin olarak yasaktır.
- Master parser'ın aynı müşteri satırlarındaki kredi limitlerini toplaması yeni modele taşınmaz. Aynı müşteri satırlarının birden fazla gelme sebebi ürün/bira-distile ayrımıdır; finansal limit alanı zaten kullanılmayacaktır.
- AI `önerilen limit`, `kullanılabilir limit`, `limit kullanımı` ve `neden değişti` niyetlerini ayrı çözer. Cevapta faaliyet ihtiyacı, nakit kapasitesi, davranış faktörü, mevcut toplam risk, boşluk, coverage, risk bayrakları, önceki limit farkı ve stres görünümü bulunur.
- AI limit tutarını prompt içinde hesaplamaz ve limit önerisini kesin kredi kararı gibi sunmaz. Resmî sayı merkezi motorun metric result'ından gelir; değişiklik ayrı kullanıcı onayı gerektiren mutasyon önizlemesidir.

## Temsilci ve SSM finansal performans karnesi — onaylandı

### Satış performansı ile finansal portföy performansının ayrılması

- Temsilci kartında satış ve finansal sonuçlar yan yana gösterilebilir fakat tek formülde sessizce birleştirilmeyecektir. Sellout litre/hedef performansı satış sütunudur; finansal portföy performansı yalnız geçerli finansal olaylar ve müşteri riskinden gelir.
- Vergi dahil ticari fatura cirosu finansal bağlamda gösterilir; ancak yüksek fatura kesmek tek başına tahsilat başarısı değildir ve finansal skor puanını doğrudan artırmaz.
- Sellout TL, ürün/FKNS hedefleri, KA irsaliyesi, Belgeler operasyon kaydı, devir ve virman satış/tahsilat performansına girmez.
- Finansal performans skoru başlangıçta prim/hakediş tutarı üretmez. Parasal prim bütçesi, barajı, tavanı ve satış-finans ağırlığı daha sonra ayrı kullanıcı onaylı politika olarak tanımlanabilir.

### Önerilen finansal performans skoru

- `Temsilci Finansal Performans Skoru = %40 29+ CEI + %30 29 güne kalmadan kapanma + %20 vadesi gelen evrak gerçekleşmesi + %10 limit disiplini`.
- Null bileşenler aktif ağırlık toplamına göre yeniden ağırlıklandırılır. Kullanılabilir başlangıç ağırlığı `%60`ın altındaysa veya ikiden az bileşen varsa resmî skor yerine `INSUFFICIENT_DATA` üretilir.
- Skor dönem bazında tamamlanmış takvim ayı için hesaplanır. Cari ay yalnız `MTD/PARTIAL` görünümüdür; tamamlanmış ay sıralamasına aynı statüyle girmez.
- Başlangıç gösterim bantları sağlık skoruyla aynı okunabilirlikte `85–100 güçlü`, `70–84 iyi/izlemeli`, `50–69 gelişmeli`, `<50 kritik takip` olabilir; bant sürümlüdür ve otomatik prim/ceza/işlem değildir.

### Bileşen 1 — 29+ eski alacak tahsilat etkinliği (%40)

- Onaylı `FIN-014` aynı temsilci/SSM dönemi için ham pay ve havuzlardan yeniden hesaplanır. Müşteri CEI yüzdelerinin veya temsilci yüzdelerinin ortalaması alınmaz.
- Açılış 29+ portföy, dönem içinde yeni 29+ olan tutar, yeniden açılan tutar, uygun kapamalar ve kapanış 29+ ayrı gösterilir.
- Virman ve organizasyon reassignment tahsilat değildir. Kaynak havuzdan performans dışı çıkış, hedef havuza giriş olarak taşınır; şirket sonucunu değiştirmez.

### Bileşen 2 — 29 güne kalmadan kapanma (%30)

- Dönem cohort'u, orijinal fatura/receivable lot tarihine göre 29. günü seçilen döneme düşen geçerli principal parçalarıdır.
- `Pre-29 kapanma oranı = 100 × 28. gün sonuna kadar ekonomik olarak kapanan uygun principal / dönem cohort'undaki düzeltilmiş principal`.
- Kısmi kapanmada yalnız kapanan tutar paya girer. Nakit, normal Havale, Çek/Senet kabulü ve IADE/HIZMET allocation'ları kendi sınıflarıyla kapanma sayılabilir; Çek/Senet kabulünün toplam riski bitirmediği ayrıca evrak bileşeninde izlenir.
- `DEVIR_ALACAK`, iptal, soft-delete, virman ve müşteri/temsilci reassignment başarılı kapanma değildir; cohort mutabakatında performans dışı çıkış/giriş olarak ayrılır.
- Payda sıfırsa null olur; dönem içinde 29. güne ulaşacak fatura olmaması otomatik `%100` değildir.

### Bileşen 3 — vadesi gelen Çek/Senet gerçekleşmesi (%20)

- `Evrak gerçekleşme oranı = 100 × seçili dönemde vadesi gelip dönem sonuna kadar gerçekten ödenen geçerli Çek/Senet tutarı / seçili dönemde vadesi gelen toplam geçerli Çek/Senet tutarı`.
- Sonucu bekleyen, ödenmemiş, teyitli iade/karşılıksız evrak paydada kalır ve paya girmez. Sonradan ödeme hangi dönemde gerçekleştiyse gecikmeli recovery olarak ayrıca görünür; geçmiş dönem snapshot sonucu denetimde korunur, yeniden ifade politikası ayrıca versiyonlanır.
- Çek kapama Havalesi yalnız ilgili evrakın gerçek ödeme kanıtıdır; ayrıca cari tahsilat olarak ikinci kez yazılmaz.
- Vadesi gelen geçerli evrak yoksa bileşen null olur; `%100` varsayılmaz.

### Bileşen 4 — iç limit disiplini (%10)

- Günlük etkin iç limit ve günlük toplam müşteri riski üzerinden `limit_disiplin_puanı = 100 × (1 − Σ günlük aşım tutarı / Σ günlük pozitif toplam risk)` hesaplanır.
- Bu alan tek günlük küçük aşım ile ay boyu büyük aşımı aynı saymaz; hem süreyi hem tutarı ölçer. Günlük toplam risk yoksa veya etkin limit tanımlı değilse null olur.
- Kullanıcı onaylı geçici limit istisnası gerçek etkin limit sürümünde görünür. İstisna dönemi gizlenmez; rapor `standart limit / onaylı istisna / gerçekleşen risk` ayrımını gösterir.

### Zorunlu bağlam metrikleri — skora karışmaz

- Her temsilci/SSM kartında en az ticari fatura cirosu, ekonomik tahsilat ve yöntem sınıfları, gerçek nakit/risk azaltma, açılış-kapanış cari, açık Çek, açık Senet ve toplam risk, 29+ açık tutar/oran, DSO, ortalama açık fatura yaşı, limit kullanımı ve müşteri sağlık dağılımı gösterilir.
- Devir, virman, müşteri reassignment, iptal/geçersizlik ve manuel düzeltme etkileri ayrı mutabakat satırıdır. Bunlar başarı/başarısızlık gibi yorumlanmaz.
- Pasif/iptal müşterilerin 100 TL ve üzeri borçları ve skora/tutarlara katkısı ayrıca gösterilir.

### Dönemsel sorumluluk ve organizasyon sahipliği

- Satış/ciro sahibi, fatura tarihindeki geçerli temsilcidir. Tahsilat ve allocation başarısının sahibi, allocation etkin tarihindeki geçerli temsilcidir. Günlük açık risk/aging/limit sahibi o gün geçerli temsilcidir.
- Temsilci değişikliğinde eski temsilci geçmiş satış ve gerçekleşmiş tahsilat olaylarını korur; değişiklik tarihindeki kalan açık lot/risk yeni temsilciye performans dışı portföy transferiyle geçer. Yeni temsilci değişiklik öncesi gecikmenin yaratıcısı gibi gösterilmez fakat devir aldığı tarihten sonraki takip sorumluluğu kendisindedir.
- Normalleştirilmiş temsilcisi belirsiz müşteri şirket düzeyinde `Atanmamış Finansal Portföy` altında kalır; başka temsilciye yapay atanmaz.
- Temsilcinin SSM bağlantısı belirsizse temsilci sonucu üretilebilir fakat SSM toplamına sessizce eklenmez; `SSM ataması inceleme bekliyor` kapsam farkı gösterilir.
- SSM finansal skoru bağlı temsilci skorlarının ortalaması değildir. SSM'nin CEI pay/havuzu, pre-29 cohort'u, vadesi gelen/ödenen evrakı ve günlük limit aşım alanı ham olaylardan yeniden toplanır. Temsilci skor dağılımı ayrıca gösterilir.

### Pasif/iptal müşteri dönem cohort'u

- Noktasal/as-of finansal listede pasif/iptal müşteri yalnız pozitif borçlu bakiyesi `≥100 TL` ise görünür.
- Dönem performansında müşteri açılışta veya dönem içindeki herhangi bir gün `≥100 TL` pozitif borçlu olduysa dönem cohort'una girer ve dönem sonuna kadar mutabakat için kalır. Tahsilatla bakiyenin 100 TL altına düşmesi başarılı tahsilatı rapordan geriye dönük silmez.
- Müşteri hiçbir gün 100 TL eşiğine ulaşmadıysa pasif/iptal kayıt temsilci finansal performansına girmez; şirket audit toplamında gerekirse ayrı gösterilir.

### Referans/mevcut uygulama kararı ve AI

- Mevcut `tahsilat / (tahsilat + kalan borç)` verimlilik oranı ve aylık `tahsilat / satış` fallback'i ana temsilci performans formülü olarak `REJECT` edilmiştir; dönem cohort'u, eski borç, yeni satış ve risk transferlerini ayıramaz.
- Mevcut prim formülündeki `netErime = tahsilat + ayİçiÇekSenetRiski − yeniFatura`, Çek/Senet kabulünü ödül gibi kullanırken aynı anda risk cezası üretmesi nedeniyle reddedilmiştir.
- Sabit `30 gün aging`, `15.000 TL riskli müşteri`, ciro hedefi olarak `ay başı bakiye × 0,5`, veri yokken `50 puan`, `5.000 TL prim tavanı` ve hardcoded A/B/C/D eşikleri resmî politikaya taşınmaz.
- Korunacak yaklaşım; tahsilat, aging, cari/risk ve ciroyu aynı ekranda ayrı boyutlar olarak sunmak ve hesap ayrıntısını açıklamaktır. Bu alanlar yeni merkezi metriklerden gelir.
- AI `temsilci finansal performansı` sorusunda skoru, dört bileşeni, güçlü/zayıf alanları, dönem farkını, müşteri katkılarını, pasif/iptal borç etkisini, devir/virman/reassignment ve coverage'ı yorumlar. `satış performansı` sorusunda ise litre/hedef ve fatura cirosunu ayrı tanımlarla sunar.
- AI temsilci veya SSM sıralamasında null/yetersiz veri skorunu sıfır gibi en kötü sıraya koymaz; ayrı coverage grubunda gösterir. Skor farkının maddi olup olmadığını ham pay/payda ve risk tutarıyla açıklar.

## Fatura kapama günü ve 3/6/12 aylık fatura–tahsilat metrikleri — onaylandı

### Kavram ayrımı

- `Açık fatura yaşı`, rapor tarihinde hâlâ açık olan faturanın yaş günüdür; önceki bölümdeki aging metriğidir.
- `Fatura kapama günü`, tamamen kapanmış bir faturanın Fatura Tarihinden son gerekli tahsilat/allocation tarihine kadar geçen gerçek takvim günüdür.
- `Tahsilat gerçekleşme günü`, bir tahsilat parçasının bağlandığı faturanın tarihinden o allocation parçasının etkin tarihine kadar geçen gerçek takvim günüdür. Kısmi tahsilatları da ölçer.
- Bu üç değer birbirinin yerine kullanılamaz ve `DSO` adı altında birleştirilemez. Muhasebesel DSO, yukarıdaki onaylı `FIN-013 accounting_dso_days` metriğidir ve yalnız kendi dönemsel günlük-bakiye formülüyle hesaplanacaktır.

### Fatura bazında kapama günü

- FIFO allocation sonrasında bir faturanın açık tutarı ilk kez tam `0` olduğunda `invoice_close_date`, bunu sağlayan son allocation parçasının etkin tarihidir.
- `invoice_close_days = invoice_close_date - invoice_date` yerel takvim günü farkıdır. Aynı gün kapanan fatura `0 gün`dür.
- Kısmen açık fatura için `invoice_close_date` ve `invoice_close_days` null kalır; mevcut açık fatura yaşı ayrıca hesaplanır.
- Tahsilattan önce oluşmuş müşteri alacağı/avans yeni faturayı aynı gün kapatırsa kapama günü `0`dır; negatif kapama günü üretilemez.
- Fatura veya allocation sonradan iptal/manuel geçersiz olursa kapama geri alınır. Fatura yeniden açılabilir; yeni calculation run kendi kapama tarihini üretir, eski sonuç denetimde kalır.

### Dönemsel ortalama kapama ve tahsilat günü

- Bir dönemin `tutar-ağırlıklı ortalama fatura kapama günü`, o dönemde tamamen kapanan ve kaynak faturası sistemde gözlenen faturalar için `Σ(fatura_tutarı × invoice_close_days) / Σ(fatura_tutarı)` formülüdür.
- Aynı kapsam için adet bazlı basit ortalama ayrıca hesaplanabilir; standart raporun ana değeri tutar-ağırlıklı ortalamadır. İki değer açıkça ayrı adlandırılır.
- Faturanın dönem üyeliğini `invoice_close_date` belirler. Fatura önceki ay kesilmiş olsa bile bu ay tam kapanmışsa bu ayın kapama metriğine girer.
- `Tutar-ağırlıklı ortalama tahsilat gerçekleşme günü = Σ(allocation_tutarı × allocation_gün_farkı) / Σ(allocation_tutarı)` formülüdür. Dönem üyeliğini allocation etkin tarihi belirler ve kısmi tahsilatlar dahildir.
- Çek/Senet kabulü cariyi kapatan allocation tarihi olarak kullanılır; Çek/Senedin bankada daha sonra ödenmesi müşterinin fatura kapama/tahsilat gününü ikinci kez değiştirmez. Araç kabulden ödemeye kadar geçen süre ayrı portföy metriğidir.
- Nakit, normal Havale, Çek kabulü, Senet kabulü, IADE ve HIZMET allocation'ları gerçekleşme günü hesabına girer. Çek kapama Havalesi girmez. Senet iade/karşılıksız olayında yalnız kullanıcı tarafından onaylanan bakiye etkisi replay sonucunu değiştirir.
- Onaylı yıl başı devir bakiye, önceki karara göre özel `OPENING_BALANCE_INVOICE` olarak oluşturulur ve 1 Ocak tarihinden itibaren kapama hesabına girer. Bu kayıt gerçek ticari satış faturası olmadığı için devir payı ayrıca açıklanır. Ne satış faturasına ne de onaylı devir faturasına bağlanabilen kaynaksız bakiye ise fatura uydurulmadan `eşleştirilemeyen tutar` ve coverage sorunu olarak kalır.
- Kapama/gerçekleşme günü metriği için eşleşen tutar, toplam uygun tahsilat tutarı ve coverage yüzdesi birlikte saklanır. Coverage yetersizse AI ve rapor sonucu kesin müşteri alışkanlığı gibi sunamaz.

### Takvim ayı ve 3/6/12 aylık pencereler

- Temel finansal dönem gerçek takvim ayıdır; sabit `30 gün = 1 ay` yaklaşımı kullanılmaz.
- Standart karşılaştırma pencereleri `son 3 tamamlanmış ay`, `son 6 tamamlanmış ay` ve `son 12 tamamlanmış ay`dır.
- Seçilen rapor ayı tamamlanmışsa pencere seçilen ay ve önceki `N-1` takvim ayını kapsar. Cari ay henüz tamamlanmadıysa 3/6/12 gerçekleşmiş ortalamalar önceki son tamamlanmış ayda biter; cari ay ayrıca `MTD/ay içi gerçekleşen` olarak gösterilir.
- Cari ay tutarı tamamlanmış ay ortalamasına karıştırılmaz. İstenirse `MTD / geçen_takvim_günü × aydaki_toplam_gün` run-rate üretilir fakat bu `FORECAST` olarak etiketlenir, gerçekleşmiş ortalama değildir.
- Bir ayın sıfır kabul edilebilmesi için o kaynak ve ay için veri kapsamının tam olduğu doğrulanmalıdır. Eksik yükleme sessizce sıfır ay olarak ortalamayı düşüremez.
- N aylık pencerede resmi aylık ortalama yalnız kapsaması doğrulanmış N takvim ayı varsa üretilir. Yetersiz geçmişte mevcut ay sayısıyla başka isim altında yaklaşık sonuç gösterilebilir ancak `3/6/12 aylık resmi ortalama` denemez.

### Aylık fatura ve tahsilat formülleri

- `Aylık fatura toplamı = Σ geçerli vergi dahil satış faturası + Σ pencereye düşen OPENING_BALANCE_INVOICE + Σ manuel DEVIR_BORC`; dönem her kaydın belge/orijinal fatura tarihidir. Ticari satış, başlangıç devri ve manuel borç sınıfları ile payları ayrı gösterilir. CANCELLED/iptal grubu, Sellout TL, IADE, HIZMET, `DEVIR_ALACAK`, virman ve tedarikçi SATIN ALMA dahil değildir; ticari ciro yalnız satış faturası sınıfıdır.
- `Aylık tahsilat toplamı = Σ geçerli cari azaltan ekonomik tahsilat olayları`; Nakit, normal Havale, Çek kabulü, Senet kabulü, IADE ve HIZMET dahildir. Çek kapama Havalesi ve iptal grupları dahil değildir.
- Tahsilat toplamı ayrıca yöntem/sınıf bazında ayrılır; `nakit/banka likidite girişi`, `Çek/Senet kabulü` ve `IADE/HIZMET cari mahsupları` aynı ekonomik toplam altında görülebilir fakat birbirinin aynısı gibi yorumlanmaz.
- `N aylık ortalama fatura = N aylık geçerli fatura toplamı / N`.
- `N aylık ortalama tahsilat = N aylık geçerli tahsilat toplamı / N`.
- `N aylık tahsilat/fatura oranı = Σ tahsilat / Σ fatura × 100` olarak toplamlar üzerinden hesaplanır; aylık yüzdelerin basit ortalaması yapılmaz. Eski dönem borçları tahsil edildiğinde oran `%100`ü aşabilir ve bu hata değildir.
- Fatura adedi, tahsilat olay adedi ve fatura başına ortalama tutar ayrıca üretilebilir. `Ortalama fatura tutarı = Σ fatura tutarı / geçerli benzersiz fatura adedi`; satır adedi kullanılmaz.
- Müşteri, temsilci, SSM ve şirket sonuçları aynı olay tabanından yeniden toplanır; müşteri oranlarının veya ortalamalarının basit ortalaması yapılmaz.

### Referans/mevcut uygulama kararı

- Referanstaki 3/6/12 pencere uzunlukları `KEEP` edilmiştir. Uygulama biçimi `REVISE` edilerek sabit gün yaklaşımı yerine 3/6/12 tamamlanmış gerçek takvim ayı kullanılmıştır.
- Referanstaki `toplam/N ay` aylık fatura ve tahsilat ortalaması, kapsama doğrulaması eklenerek korunmuştur.
- Referans ve mevcut uygulamadaki `N×30 günlük kayan pencere` reddedilmiştir; ay uzunluğu ve kısmi cari ay nedeniyle yanlı sonuç üretir.
- Eski `(aylık fatura / aylık tahsilat) × 30` geri dönüş formülü reddedilmiştir; bu gerçek fatura kapama süresi değildir.
- Referans ve mevcut uygulamadaki `ortalama tahsilat tarihi − ortalama fatura tarihi` yaklaşımı reddedilmiştir. Onaylı devir bakiyenin 1 Ocak tarihli özel fatura olması bu yaklaşık formülü geri getirmez; yeni sistem gerçek FIFO allocation ve fatura kapanışı üzerinden gün hesabı yapar. Kaynaksız diğer farklar için sanal fatura üretilmez.
- Mevcut uygulamanın tahsilat yokken sözleşmesel vade veya sabit `18/28 gün` döndürmesi reddedilmiştir. Veri yoksa sonuç null ve coverage uyarısıdır; sistemde sözleşmesel vade bulunmamaktadır.
- Referansın güncel açık bakiyenin tutar-ağırlıklı yaşına `DSO` demesi terminolojik olarak reddedilmiştir. Bu değer `Ortalama Açık Fatura Yaşı`dır; gerçekleşmiş kapama günü ve muhasebesel DSO'dan ayrıdır.

## Mevcut AI analizi ve geliştirme sırası — planlama kuralı

- AI geliştirme kapsamı mevcut uygulama analiz edilmeden uygulanmayacaktır. Var olan niyet sınıflandırması, araç declaration/registry yapısı, kullanıcı onaylı mutasyon akışı, fallback, rapor üretimi, tanı ve test yetenekleri önce karakterizasyon testleriyle kayda alınacaktır.
- Mevcut AI parçaları topluca korunmuş veya topluca reddedilmiş sayılmaz. Her parça `KEEP`, `REVISE`, `REJECT` veya `ADD` sınıfıyla değerlendirilecektir.
- İlk AI kodlama adımı yeni özellik geliştirmek değil, mevcut niyet→araç→handler→hesap bağımlılık haritasını ve deprecation envanterini üretmektir.
- Mevcut yapıda korunacak ana yaklaşımlar registry ayrımı, tek yürütme sınırı fikri, açık kullanıcı onayı bekleyen mutasyonlar, küçük araç alt kümesi, deterministik fallback hedefi ve regresyon senaryolarıdır.
- Mevcut dağınık hesap servisleri, prompt içine yazılmış eski formüller, tipsiz sonuçlar, tarayıcı Gemini anahtarları, doğrudan istemci model çağrısı, kalıcı silme ve gerçek yürütme olmayan alt-ajan iddiaları hedef sisteme aynen taşınmayacaktır.
- Ayrıntılı mevcut durum denetimi, hedef sözleşmeler, AI alt paketleri ve Terra kabul kapıları `AI_MEVCUT_DURUM_VE_GELISTIRME_PLANI.md` dosyasında tanımlanmıştır.

## İleri finansal analiz ve raporlama kapsamı — onaylandı

- Kalan finansal analiz parametreleri tek tek yeniden onaya sunulmadan; güncel, açıklanabilir ve veri uydurmayan varsayılanlarla kesinleştirilecektir. Parametreler sürümlü politika kaydıdır; kullanıcı ileride ekleyebilir, çıkarabilir veya yeni sürümle değiştirebilir.
- Temel finansal gerçekler `FIN-*`, bunlardan türetilen ileri analizler `FAN-*` ailesinde tutulacaktır. Tahmin, çıkarım, senaryo ve öneri gerçekleşmiş finansal olay gibi kaydedilmeyecektir.
- Onaylı ileri kapsam; yoğunlaşma/Pareto ve HHI, aging geçiş matrisi, fatura kohortu ve ödeme sağkalımı, 29+ yük köprüsü, toplam risk ve gerçek nakit/risk azaltma köprüleri, Çek/Senet vade merdiveni, 13 haftalık nakit tahmini ve geri testi, bozulma/anomali sinyalleri, finansal davranış segmenti, açıklanabilir takip önceliği, stres ve karşı taraf senaryoları, restatement, kapanış mutabakatı, eş grup kıyası ve müşteri 360 raporunu içerir.
- Yönetimsel beklenen zarar yalnız yeterli geçmişle kalibre edilen veya kullanıcı varsayımlı `SCENARIO_ONLY` sonuçtur; resmî muhasebe karşılığı değildir. Ürün/müşteri kârlılığı ise maliyet, iskonto, lojistik ve hizmet maliyeti kaynağı gelene kadar hesaplanmayacaktır.
- `FAN-015` tahsilat takip önceliği v1 ağırlıkları risk maddiliği `%30`, aging şiddeti `%25`, vadesi gelmiş araç riski `%20`, bozulma `%15`, limit aşımı `%10`dur. Kullanılabilir ağırlık `%60`ın altındaysa sonuç null; puan işlem veya sevkiyat kararı üretmez.
- `FAN-016` başlangıç stres seti tahsilat `%25` düşüş, tahsilat `14 gün` gecikme, ticari fatura `%25` artış/azalış, araç gerçekleşmesinin tarihsel alt çeyreğe inmesi, en büyük müşteri tahsilatının sıfırlanması ve birleşik olumsuz senaryodur. Bunlar sürümlü varsayımdır, gerçekleşmiş sonuç değildir.
- Her gelişmiş rapor; en önemli bulgu, uygun karşılaştırma, katkı analizi, kanıtlı risk/anomali, veri güven sınırı, ayrı etiketli gelecek/senaryo ve ölçülebilir takip önerisi üretebilecek sözleşmeye sahip olacaktır. AI düz rapor sunmakla yetinmeyecek; fakat desteklenmeyen kesin neden uydurmayacaktır.
- Grafiklerin görsel tasarımı kod aşamasında yapılacaktır. Şimdiden yalnız merkezi sonuç bağlama, filtre, karşılaştırma, yuvarlama, coverage, drill-down ve grafik türü sözleşmeleri kesinleştirilmiştir; widget içinde bağımsız istemci formülü yasaktır.
- Ayrıntılı `FAN-001..046` çekirdek ve paket-alt sözleşmeleri, standart 13 rapor, bilinçli hesaplanmayacak alanlar ve AI yorum sırası `FINANSAL_ANALIZ_VE_RAPOR_KATALOGU.md` dosyasında bağlayıcı olarak tanımlanmıştır.

## AI tarafından görsel, Excel ve PDF rapor paketi üretimi — onaylandı

- Kullanıcı AI'dan herhangi bir onaylı raporu, analizi veya dönemsel karşılaştırmayı ekranda görsel rapor, Excel çalışma kitabı, PDF rapor ve seçili grafik/görsel çıktısı olarak isteyebilecektir.
- AI önce metrik, kapsam, dönem, karşılaştırma, filtre ve çıktı türünü semantik plana çözecek; bütün formatlar tek `report_snapshot/result_manifest` üzerinden üretilecektir. AI, Excel/PDF için ayrı formül veya ayrı sayı hesaplamayacaktır.
- Standart karşılaştırmalar metriğin kendi onaylı dönem sözleşmesine göre cari dönem–önceki eş dönem, tamamlanmış ay–önceki ay, yılın aynı dönemi ve kullanıcı tarafından seçilen iki geçerli dönemdir. `3/6/12` tamamlanmış ay pencereleri yalnız onaylı finansal müşteri fatura–tahsilat metriklerinde kullanılır; Sellout ana filtresine uygulanmaz. Eksik veya farklı kapsamlı dönemler sessizce karşılaştırılmaz; coverage farkı raporda görünür.
- PDF; kapak, yönetici özeti, dönemsel karşılaştırma, temel KPI'lar, grafikler, katkı/risk bulguları, AI yorumu ve önerileri, veri güveni, metodoloji ve gerektiğinde detay eklerinden oluşan baskıya hazır bir rapor olacaktır.
- Excel; `Yönetici Özeti`, `Dönem Karşılaştırma`, ilgili analiz sayfaları, `Detay Veri`, `Veri Kalitesi` ve `Metodoloji` sekmelerinden oluşacaktır. Detay veri sekmeleri filtrelenebilir tablo biçiminde, birleştirilmiş hücresiz ve yeniden analiz edilebilir olacaktır.
- Görsel çıktı, raporun seçili kart/grafiklerini yüksek çözünürlüklü PNG ve uygun grafiklerde SVG olarak üretebilecektir. Görseller kaynak dönemini, ölçü birimini ve coverage/uyarı işaretini taşıyacaktır.
- Tasarım sistemi sürümlü tema, renk semantiği, tipografi, logo/kurum başlığı, tablo stili, sayfa ölçüsü ve grafik yerleşimi tanımlar. Risk/başarı renkleri yalnız renkle anlatılmaz; metin, ikon veya desen desteği bulunur.
- Her çıktı rapor başlığı, oluşturulma zamanı, veri kesim tarihi, filtre özeti, metrik/kural sürümü, calculation run, güven/coverage ve gizlilik sınıfını taşır. Eski bir snapshot yeniden indirildiğinde sonradan değişmiş sayı ile sessizce yeniden üretilmez.
- Yetki ve veri kapsamı export sırasında yeniden kontrol edilir. Temsilci yalnız yetkili portföyü, SSM yalnız bağlı kapsamı, yönetici ise yetkisine göre şirket kapsamını dışa aktarabilir. AI yetkisiz ayrıntıyı özet veya görsele sızdıramaz.
- Büyük detaylar PDF'ye sıkıştırılıp okunmaz hâle getirilmeyecek; PDF yönetim özeti ve seçili detayları, Excel ise tam yetkili satır detayını taşıyacaktır.

## AI evrensel cevap yoğunluğu ve token verimliliği — onaylandı

- Bu davranış yalnız hazır rapor/analiz ekranlarında değil; müşteri, ürün, Sellout, FKNS, stok, sipariş ihtiyacı, finans, tahsilat, Çek/Senet, organizasyon, veri kalitesi, karşılaştırma, tahmin, senaryo ve sistemde sorulabilecek diğer bütün bağlamlarda geçerlidir.
- AI her durumda önce sorunun doğrudan cevabını ve iş yorumunu sohbet içinde verir. Kullanıcı yalnız “dosyaya bak” denilerek cevapsız bırakılmaz.
- Sonuç küçük ve anlaşılırsa `INLINE` modunda kısa cevap, gerekli sayı ve yorum verilir; gereksiz PDF/Excel üretilmez.
- Sonuç çok boyutlu veya veri yoğunsa `INLINE_PLUS_VISUAL` ya da `REPORT_PACK` modu seçilir. Sohbette 3–7 maddelik önem sıralı özet, temel sonuç, karşılaştırma, en önemli katkı/risk, belirsizlik ve öneri verilir; tam detay görsel rapor, PDF ve/veya Excel çıktısına yönlendirilir.
- Yoğunluk kararı yalnız satır sayısına bağlı değildir. Tahmini bağlam tokenı, sonuç satır/kolon sayısı, metrik ve dönem sayısı, boyut sayısı, karşılaştırma/anomali sayısı, kullanıcı niyeti ve ayrıntının sohbet içinde okunabilirliği sürümlü `response_delivery_policy` ile birlikte değerlendirilir.
- Ham veri satırları varsayılan olarak modele yığılmaz. Merkezi motor önce toplulaştırma, mutabakat, top-N katkı, önemli fark, anomali, coverage ve örnek drill-down kimliklerinden bir `analysis_digest` üretir; AI yorumunu bu doğrulanmış özet üzerinden yapar.
- Tek kullanıcı sorusunda temel ilke `bir hesaplama → bir doğrulanmış analiz manifesti → bir AI yorum/claim seti → çoklu çıktı`dır. PDF, Excel, görsel ve sohbet için aynı analiz tekrar tekrar modele gönderilmez.
- PDF/XLSX/PNG/SVG render işlemleri kod tabanlı şablon motorunda yapılır ve normal durumda yeni model çağrısı/token tüketimi oluşturmaz. AI metni gerekiyorsa bir kez üretilip izinli formatlarda yeniden kullanılır.
- Kullanıcı ayrıntıya indiğinde bütün veri yeniden yüklenmez; seçilen müşteri, ürün, temsilci, dönem, belge veya katkı için sayfalı/lazy drill-down sorgusu yapılır.
- Aynı kullanıcı yetkisi, veri snapshot'ı, soru semantik planı, filtre, karşılaştırma ve metrik sürümüne ait güvenli sonuçlar cache anahtarıyla yeniden kullanılabilir. Kaynak/sürüm/yetki değişirse cache geçersizdir.
- Token bütçesi aşılacak diye sonuç kesilip sessizce eksik sunulmaz. Önce daha güçlü sunucu toplulaştırması, top-N+`diğer`, sayfalama ve artifact yönlendirmesi uygulanır; dışlanan detay sayısı/tutarı ve erişim yolu kullanıcıya bildirilir.
- AI kısa özet üretirken yalnız sayı tekrar etmez; yorumlama zorunluluğu korunur. Ancak token tasarrufu adına kanıtsız neden, sahte kesinlik veya önemli karşı görüş/belirsizlik atlanamaz.

## ST Tahsilat/Litre günlük tarih eşleştirmesi — onaylandı

- ST Tahsilat/Litre raporunun ana tarihi etkin Sellout tarihidir. Normal günlerde `D` gününün onaylı Sellout net litresi yalnız `D−1` takvim günündeki Belgeler operasyonel tahsilat sinyaliyle eşleştirilecektir; ham Faturalama Tarihi diğer bütün Sellout raporlarında korunur.
- Tek takvim istisnası pazartesi/pazar taşımasıdır: ay sonu olmayan pazar ile pazartesi Sellout net litreleri pazartesi paydasında birleşir; önceki cumartesi ve pazar Belgeler sinyalleri payda değil pay olarak toplanır. Örnek: `9 Ağustos Pazar + 10 Ağustos Pazartesi Sellout litresi ↔ 8 Ağustos Cumartesi + 9 Ağustos Pazar Belgeler tahsilatı`.
- Normal gün örneği: `4 Ağustos Sellout litresi ↔ 3 Ağustos Belgeler tahsilatı`. Aynı gün tahsilatı, en yakın dolu tahsilat günü veya bütün geçmiş tahsilat bu rapora kaydırılamaz. Cuma Sellout'u perşembeyi, cumartesi Sellout'u cumayı kullanır; yalnız pazartesi iki günlük hafta sonu penceresine sahiptir.
- Tarihler Europe/Istanbul yerel takvim tarihi olarak ele alınır. Ay ve yıl sınırı normal takvimle geçilir; örneğin `1 Ağustos Sellout ↔ 31 Temmuz tahsilat`.
- Sellout tarafı daha önce onaylanan `Faturalama Tarihi`, müşteri kapsamı, iptal/iade ve net litre kurallarını kullanır. Kümülatif/tüm dönem Sellout litresi günlük rapora girmez.
- Belgeler tarafı resmî tahsilat, fatura kapama veya cari hareket değildir. `Müşteri Tahsilat` türündeki `Nakit`, `Kredi Kartı`, `Banka havalesi` ve `Sanal Pos` kayıtları operasyonel nakit/tahsilat sinyali olarak sınıflanır. Alınan Çek/Senet ve tanımsız türler ST nakit toplamına girmez; dışlama nedeni ve tutarı görünür kalır.
- `collection_dates(D) = normal pazartesi ise {D−2,D−1}, diğer günlerde {D−1}` olarak tanımlanır; ay sonu pazarın izleyen pazartesisinde yalnız `{D−1}` kullanılır. `ST operasyonel TL/L = collection_dates(D) içindeki operasyonel tahsilat sinyali toplamı / effective_sellout_date=D olan net litre toplamı`. Net litre `≤0` ise sonuç null olur. Zorunlu Sellout veya tahsilat günlerinden biri eksikse sonuç `PARTIAL_COVERAGE` olur; eksik gün sıfır ya da en yakın günle doldurulmaz.
- Bu TL/L değeri ürün fiyatı, ciro, resmî tahsilat verimliliği veya fatura kapama oranı değildir. Yalnız bir önceki gün alınan operasyonel tahsilat sinyali ile ertesi gün faturalanan Sellout hacmi arasındaki saha operasyonu göstergesidir.
- Temsilci kırılımında iki günün müşteri kayıtları Master'daki geçerli temsilci sorumluluğuyla ayrı ayrı gruplanır ve aynı temsilci seviyesinde eşleştirilir. SSM sonucu bağlı temsilcilerin ham tahsilat ve litre toplamlarından yeniden hesaplanır; temsilci TL/L oranlarının ortalaması alınmaz.
- Dönemsel ST TL/L, seçilen `[A,B]` içindeki etkin Sellout günlerinin `collection_dates(D)` eşlemelerinden oluşturulur. Pay `eşleşen benzersiz kanonik operasyonel tahsilat kayıtlarının Σ tutarı`, payda `Σ etkin net litre`dir; günlük oranların basit ortalaması yapılmaz. Aynı Sellout satırı veya tahsilat olayı birden fazla sonuç penceresine giremez; ay sonu pazar istisnası bu nedenle izleyen pazartesinin cumartesi tahsilatını tekrar kullanmasını engeller.
- Ürün, ürün ailesi ve kanal Sellout litre kırılımları raporda gösterilebilir; ancak Belgeler tahsilatı ürüne bağlanamadığı için toplam tahsilat ürünlere keyfî olarak dağıtılmaz ve ürün bazlı resmî ST TL/L üretilmez.
- Günlük/temsilci/dönem karşılaştırmaları aynı `collection_dates(D)` eşleşmesini kullanır. Her sonuç Sellout tarihini, bir veya iki tahsilat tarihini, her kaynak gününün coverage'ını ve dışlanan Belgeler tutarını açıkça taşır.
- Referans uygulamadaki gerçek Yükleme Raporu litresi ve mevcut React uygulamasındaki kümülatif Sellout litresi bu yeni kural için kullanılmayacaktır. Yeni resmî litre kaynağı kullanıcının onayladığı günlük Sellout verisidir.

### Pazar Sellout'unun pazartesiye taşınması ve ay sonu istisnası — onaylandı

- Ayın son takvim günü **olmayan** pazar günündeki Sellout satırları bağımsız pazar sonucu üretmez; `effective_sellout_date` pazartesiye taşınır. Pazartesi paydası pazar+pazartesi geçerli net litre toplamıdır, payı ise cumartesi+pazar operasyonel tahsilat sinyalidir.
- Pazar ayın son takvim günü ise dönem kapanışını bozmamak için Sellout pazar gününde kalır ve cumartesi tahsilatıyla eşleşir. İzleyen pazartesi bu durumda yalnız pazar tahsilatını kullanır; cumartesi tahsilatı ikinci kez kullanılamaz.
- Ham `Faturalama Tarihi` değiştirilmez. Taşıma yalnız ST Tahsilat/Litre metriğinin sürümlü `effective_sellout_date` alanında yapılır; normal Sellout, aylık litre, FKNS ve fatura raporlarının tarihini değiştirmez.
- Günlük ve dönemsel ST sonuçlarında her ham Sellout satırı ve her kanonik tahsilat olayı en fazla bir sonuç penceresine katkı verebilir. Ay sonu istisnası dahil çift sayım varsa sonuç yayımlanmaz ve veri/algoritma hatası olarak raporlanır.

## Fatura Kontrol / Fatura Takip modülü — onaylandı

- Modülün amacı, **faturası kesilmiş ve teslimatı tamamlanmış** satışları finansal kanıtlarla kontrol etmektir. Aynı gün fatura toplamından aynı gün tahsilat toplamı çıkarılarak “kapandı/açık” sonucu üretmek yasaktır; resmî sonuç Paket 10'daki müşteri bazlı FIFO olay/allocation zincirinden gelir.
- Aday belge, geçerli satış faturası ile `Teslim Edildi` veya `Depodan Teslim` durumundaki sevkiyatın güvenli biçimde bağlandığı kayıttır. Fatura–sevkiyat bağlantısı tekil değilse otomatik finansal hüküm verilmez; `INVOICE_DELIVERY_MATCH_UNRESOLVED` incelemesi açılır.
- Her aday için fatura oluşmadan hemen önceki açık fatura yığını; belge adedi, açık tutar ve en eski faturanın yaşıyla gösterilir. Fatura sonrasındaki güncel açık yığın ayrıca gösterilir. Böylece “müşteriye üst üste açık fatura bırakılmış mı?” sorusu iki farklı zaman kesiminde cevaplanır.
- Fatura öncesindeki açık yığın yaşlandırma dilimlerine ayrılır. Yeni fatura/teslimat günü `D` için `D−1` ve `D` tarihli geçerli cari azaltan olayların FIFO allocation'ları incelenir; hangi yaş dilimindeki eski faturadan ne kadar düşüldüğü ayrı gösterilir. Böylece “yaşlandırmadan tahsilat alınmış mı?” sorusu toplam tahsilatla değil, gerçekten eski faturaya uygulanmış tutarla cevaplanır.
- Yaşlandırmadan tahsilat görünümü en az `allocation öncesi yaş dilimi`, `eski açık tutar`, `D−1 allocation`, `D allocation`, `kalan açık tutar` ve tahsilat sınıfını taşır. Nakit/Havale/Kart, Çek/Senet kabulü ve IADE/HIZMET aynı FIFO motorunda cari azaltabilir; fakat yalnız nakit benzeri sınıflar peşin ödeme kontrolüne girer.
- Önceden açık faturalar varken yeni teslim edilmiş fatura oluşması tek başına kesin hata değildir. Eski yığında tutar/yaş bulunması, `D−1/D` döneminde eski faturaya allocation bulunmaması ve yeni faturanın da açık kalması birlikte önem seviyesini yükseltir; dayanaklar ayrı gösterilir.
- FIFO allocation izi, tahsilatın eski faturaları mı kapattığını, yeni faturaya ne kadar ulaştığını ve yeni faturanın açık/kısmi/kapalı durumunu açıklar. Tek bir tahsilatın doğrudan yeni faturaya ait olduğu yalnız allocation veya onaylı manuel bağlantıyla söylenebilir.
- Fatura tarihinden bir önceki yerel takvim günündeki resmî nakit benzeri tahsilatlar ayrıca aranır. Nakit, kredi kartı/POS ve normal banka havalesi resmî peşin ödeme kanıtı olabilir; Çek/Senet kabulü, IADE/HIZMET, devir ve virman nakit peşin ödeme diye etiketlenemez.
- Önceki günden taşınan dağıtılmamış resmî müşteri alacağı yeni faturaya FIFO ile uygulanmışsa `OFFICIAL_PREPAYMENT_APPLIED` kanıtıdır. Önceki gün tahsilat bulunması fakat eski faturalara gitmesi yalnız bağlamdır; yeni faturanın peşin kapandığı anlamına gelmez.
- Fatura kartında `D−1 tahsilat var/yok`, `D−1 tutarın eski faturaya giden kısmı`, `yeni faturaya uygulanan kısmı` ve `dağıtılmamış kalan kısmı` birbirinden ayrılır. Kullanıcı önceki gün tahsilatını görür; sistem bağlantı bulunmadan bu tutarı yeni faturanın ödemesi saymaz.
- Fatura günü içindeki işlem sırası kaynakta saat taşımıyorsa aynı gün tahsilatın sevkten önce mi sonra mı alındığı kesin söylenmez; `SAME_DAY_SEQUENCE_UNKNOWN` olarak gösterilir. Saat veya onaylı manuel ilişki varsa kronoloji kullanılabilir.
- Belgeler kaydı yalnız `OPERATIONAL_PREPAYMENT_SIGNAL` ön sinyalidir; resmî cari, tahsilat veya fatura kapama kanıtı değildir. Resmî kayıt gelince Bölüm 25/OPS-DOC kurallarıyla onun yerini alır. Ön sinyal kaybolur ve resmileşmezse `PREPAYMENT_SIGNAL_DISAPPEARED` alarmı oluşur.
- Teslimat anında müşterinin açık Çek/Senet riski ayrıca gösterilir. Açık kıymetli evrak riski varken yeni teslimat için resmî nakit benzeri peşin kanıt yoksa `INSTRUMENT_RISK_WITHOUT_CASH_PREPAYMENT` inceleme alarmı verilir; sistem otomatik sevkiyat iptali, bakiye değişikliği veya kullanıcı yerine karar üretmez.
- Asgari alarm kümesi: `DELIVERED_WITHOUT_INVOICE`, `INVOICED_WITHOUT_DELIVERY_CONFIRMATION`, `INVOICE_DELIVERY_MATCH_UNRESOLVED`, `PRIOR_OPEN_INVOICE_STACK`, `AGED_OPEN_BALANCE_WITHOUT_COLLECTION`, `NEW_INVOICE_REMAINS_OPEN`, `INSTRUMENT_RISK_WITHOUT_CASH_PREPAYMENT`, `SAME_DAY_SEQUENCE_UNKNOWN`, `PREPAYMENT_SIGNAL_DISAPPEARED`, `DATA_COVERAGE_INCOMPLETE`.
- Ekran her alarmı önem seviyesi, dayanak belge/olay/allocation kimlikleri, hesap kesimi, kaynak etiketi ve kapanma koşuluyla gösterir. “Sorunlu” yorumu yalnız tanımlı alarm ve yeterli coverage ile üretilebilir; veri yokluğu müşteri davranışı gibi yorumlanamaz.

### Fatura–satış belgesi–teslimat bağlantısı: gerçek veri doğrulaması ve kesin eşleştirme sırası

- Gerçek kaynaklarda sipariş/sevkiyat dosyası `Satış Belge No`, `Fatura No`, `Müşteri No`, `Sipariş Toplam Tutar`, `Satış Belgesi Tarihi`, `İstenilen Tsl. Trh.` ve `Teslimat Durumu`; satış faturası dosyası `Sipariş Numarası`, `Fatura No`, `Cari Kodu 2`, `Satış Tutarı`, `Fatura Tarihi`, `Fatura Durum` ve `EDOCUMENTNO` alanlarını taşır.
- Belge numaraları metin kimliğidir. Karşılaştırma için boşluk/noktasal Excel gösterimi temizlenir ve yalnız sayısal kimliklerde baştaki sıfırlar normalize edilir; kaynak değer ayrıca aynen saklanır. Örnek: siparişte `900119477`, satışta `0900119477`; siparişte `20251430`, satışta `0020251430` aynı normalize kimliktir.
- Birinci güçlü bağlantı `sipariş.Fatura No ↔ satış.Fatura No`; ikinci bağımsız güçlü bağlantı `sipariş.Satış Belge No ↔ satış.Sipariş Numarası`dır. İki anahtar da doluysa aynı satış faturasına ulaşmak zorundadır. Farklı hedef üretirse `INVOICE_ORDER_KEY_CONFLICT` olur ve otomatik bağlantı kurulmaz.
- İki güçlü anahtar aynı faturayı gösterir, `Müşteri No = Cari Kodu 2`, satış faturası `Tip=SATIS`, `Fatura Durum=CREATED` ve iptal kontrolü geçerse bağlantı `CONFIRMED_DUAL_KEY` olur. Tutar eşitliği zorunlu mutabakat kontrolüdür; fark varsa bağlantı yayınlanmaz.
- Güçlü anahtarlardan yalnız biri kaynakta mevcutsa otomatik bağlantı ancak anahtar tek aday üretir, müşteri ve vergi dahil tutar birebir eşleşir, diğer anahtar gerçekten boştur ve fatura geçerliyse `CONFIRMED_SINGLE_KEY` olabilir. Diğer anahtar dolu fakat eşleşmiyorsa single-key geri düşümü yasaktır.
- `Müşteri + tutar + tarih` veya müşteri adı benzerliği güçlü belge anahtarının yerine geçemez. Bunlar yalnız manuel inceleme aday sıralamasında kullanılır. Aynı müşteri/tutar/tarih birden fazla aday verirse otomatik seçim yapılmaz.
- Fatura tarihi bağlantı anahtarı değildir. Gerçek 25 kesin eşleşmenin 23'ünde Fatura Tarihi=Satış Belgesi Tarihi, birinde Fatura Tarihi=İstenilen Teslim Tarihi ve birinde ikisinden de farklıdır. Tarih farkı görünür kanıt/uyarıdır fakat tek başına doğru belge bağlantısını bozmaz.
- `Teslim Edildi/Depodan Teslim` olup sipariş kaynağında Fatura No boşsa `DELIVERED_WITHOUT_INVOICE_REFERENCE`; siparişte Fatura No dolu fakat satış faturası kaynağında bulunamıyorsa `ORDER_INVOICE_REFERENCE_NOT_IN_SALES_SOURCE` üretilir. İkinci durum “fatura kesilmemiş” anlamına gelmez; kaynak kapsamı/eşleşme istisnasıdır.
- Gerçek dosya regresyonu: 126 sipariş satırı → 87 satış belgesi; 73 tamamlanmış belgede Fatura No mevcut, 4 tamamlanmış belgede Fatura No boş; mevcut satış faturası yüklemesinde 25 belge çift anahtarla kesin bağlıdır. Bu 25'te anahtar çatışması `0`, müşteri farkı `0`, tutar farkı `0`, belirsiz aday `0`dır. Kalan kayıtlar otomatik olarak yanlış/faturasız sayılmaz; kapsam ve eşleşme durumuyla raporlanır.

### Fatura Kontrol alarm önem sırası ve tek belge kontrol kartı

- Modül tek bir açıklanabilir toplam durum üretir: `BLOCKED_DATA`, `CRITICAL_REVIEW`, `HIGH_RISK`, `ATTENTION` veya `CLEAR_WITH_EVIDENCE`. Bu durum bir kredi/sağlık skoru değildir ve otomatik finansal/sevkiyat işlemi yapmaz; en yüksek etkin alarmın sunum önceliğidir.
- `BLOCKED_DATA`: kaynak coverage eksikliği, iki güçlü anahtar çatışması, çoklu aday, müşteri/tutar uyuşmazlığı veya fatura–teslimat bağının güvenli kurulamaması. Sistem bu durumda müşteri davranışı hakkında “sorunlu/sorunsuz” hükmü vermez.
- `CRITICAL_REVIEW`: coverage tamken teslim tamamlanmış fakat siparişte Fatura No referansı yok; önceden sevk kararında görülen peşin Belgeler sinyali kaybolmuş ve resmileşmemiş; geçerli fatura iptal edilmiş olduğu halde teslim bağlantısı etkin kalmış gibi doğrudan belge bütünlüğü olaylarıdır.
- `HIGH_RISK`: açık Çek/Senet riski varken yeni teslimat için resmî nakit benzeri peşin allocation bulunmaması; 29+ yaşlı açık bakiye bulunması, D−1/D'de bu eski lotlara geçerli allocation yapılmaması ve yeni teslim edilmiş faturanın açık kalması. Bu alarm ticari inceleme ister fakat otomatik sevkiyat durdurmaz.
- `ATTENTION`: önceki açık fatura yığını, 0–28 gün içindeki açık bakiyeden tahsilat alınmaması, yeni faturanın kısmi/açık kalması, aynı gün olay saatinin bilinmemesi veya doğrulanmış fakat olağan dışı tarih farkı gibi takip bağlamlarıdır. Tek başına kesin uygunsuzluk değildir.
- `CLEAR_WITH_EVIDENCE`: bağlantı doğrulanmış, teslim tamamlanmış, gerekli kaynak coverage'ı tam, bloke/kritik/yüksek alarm yok ve kontrol edilen finansal kanıtlar açıkça sunulmuşsa kullanılır. “Clear” borç yok demek değildir; yalnız tanımlı kontrol penceresinde açıklanamayan kritik durum bulunmadığını ifade eder.
- Aynı belgede birden fazla alarm korunur; kart durumu en yüksek önem seviyesinden gelir. Alarm sırası `BLOCKED_DATA > CRITICAL_REVIEW > HIGH_RISK > ATTENTION > CLEAR_WITH_EVIDENCE`dir. Kullanıcı düşük seviyeleri ve bütün dayanakları açabilmelidir.
- Tek belge kontrol kartı sırasıyla şu bölümleri gösterir: (1) müşteri, temsilci/SSM, sipariş–fatura–e-belge kimlikleri; (2) satış, istenilen teslim, fatura ve teslim tarih/durumları; (3) çift/tek anahtar bağlantı kanıtı ve coverage; (4) fatura tutarı ve teslimat tutarı mutabakatı; (5) fatura öncesi açık yığın ve yaş dilimleri; (6) D−1/D resmî tahsilat-allocation ayrımı; (7) aday faturaya uygulanan peşin nakit ve coverage oranı; (8) teslim anındaki açık Çek/Senet riski; (9) aday faturanın güncel açık/kısmi/kapalı durumu; (10) önem sıralı alarmlar, kanıt bağlantıları ve kullanıcı inceleme durumu.
- Kartta toplam tahsilat ile allocation aynı sayı gibi gösterilemez. D−1/D için `toplam geçerli cari azaltan olay`, `eski lotlara allocation`, `aday faturaya allocation`, `dağıtılmamış alacak`, `nakit benzeri peşin`, `Çek/Senet kabulü` ve `kapsam dışı/geçici sinyal` ayrı satırlardır ve kontrol toplamıyla mutabık olmalıdır.
- Liste ekranı varsayılan olarak en yüksek alarm, sonra en eski açık fatura yaşı, sonra fatura tutarı azalan ve belge kimliği sırasıyla deterministik dizilir. Filtreler toplam durum, alarm kodu, fatura/teslim tarihi, müşteri, temsilci, SSM, kanal, yaş dilimi, Çek/Senet riski ve peşin coverage durumunu kapsar.

## Sevkiyat Takip modülü — onaylandı

- Modülün amacı, **istenilen teslim tarihi bugün olan ve bugün dağıtıma çıkacak siparişleri** operasyonel olarak kontrol etmektir. Finansal fatura kontrolü, tahsilat/fatura kapama veya açık bakiye hesabı bu modülün ana sonucu değildir.
- Resmî sipariş kaynağı `export (10).xlsx` benzeri satış belgesi dosyasıdır. Rapor günü `İstenilen Tsl. Trh.` alanından seçilir; `Satış Belgesi Tarihi` yalnız bağlamdır. Master müşteri/kanal/organizasyon zenginleştirmesi sağlar fakat sipariş üretmez.
- Ana belge anahtarı `Satış Belge No`dur. Kaynakta aynı belge birden çok satırda bulunabilir ve `Sipariş Toplam Tutar` her satırda tekrar edebilir; tutar belge seviyesinde **yalnız bir kez** sayılır. Satır tutarlarını toplamak yasaktır.
- Belge seviyesi teslimat durumu, bütün satır durumlarının kümesinden türetilir: yalnız açık/yüklemeye alınmadı → `READY_OR_WAITING`; sevkiyatta → `IN_TRANSIT`; yalnız teslim → `COMPLETED`; ertelendi → `DEFERRED`; reddedildi/iptal → `REJECTED_OR_CANCELLED`; birbiriyle farklı aktif durumlar → `PARTIAL_OR_MIXED`.
- `PARTIAL_OR_MIXED` belgede toplam tutar yine bir kez gösterilir. Kaynak satırlarında kalem tutarı bulunmadığından toplam tutar durumlara dağıtılamaz; durum kümesi ve satır adetleri birlikte sunulur.
- Sevkiyat Takip iki ana görünüm sınıfı kullanır: `Depo Satışı`, `Soğuk Satış&Depozito` → `SIPARIS`; `Sevki Ertelenecek Sp` → `EMANET_SP`. `Key Account Sipariş` kaynak/audit ve yükleme kontrolünde korunur fakat Sevkiyat Takip listesi, kartları, belge adedi ve tutar toplamlarında gösterilmez. Reklam malzemesi, reddedilmiş ve iptal edilmiş belgeler de iki aktif toplamın dışındadır. Bilinmeyen yeni tür sessizce aktife alınmaz, eşleme görevine gider.
- Bugünkü görünüm sipariş belgelerini müşteri ve belge bazında listeler; `Yüklemeye Alınmadı`, `Sevkiyatta`, `PARTIAL_OR_MIXED` ve veri eksiği öncelikli operasyon kuyruklarıdır. Tamamlanan/ertelenen/reddedilenler ayrı özet ve filtrelerde korunur.
- Belgeler ve resmî tahsilat bu ekranda yalnız peşin ödeme/operasyon bağlamı olarak gösterilebilir. Bölüm 25'teki kanonik `resmî > geçici Belgeler` görünümü kullanılmalı; iki kaynak `UNION ALL` ile toplanamaz. Siparişi olmayan tahsilat müşterileri sevkiyat listesine yeni satır olarak eklenemez.
- Sipariş tutarı eksi Belgeler/tahsilat tutarı “açık sipariş”, “açık fatura”, “tahsil edildi” veya “ödeme kapsamı” diye adlandırılamaz. Finansal karar gerekiyorsa kullanıcı belge üzerinden Fatura Kontrol/Cari detayına geçer ve resmî FIFO sonucu açılır.
- Asgari veri kalite kontrolleri: boş/tekrar eden satış belge anahtarı, aynı belgede çelişkili müşteri veya toplam tutar, geçersiz istenilen teslim tarihi, bilinmeyen belge türü/durum, iptal-red çelişkisi, fatura/sevkiyat bağlantı belirsizliği ve kaynak coverage eksikliğidir.

### Günlük Sevkiyat Takip operasyon durumu, kartı ve istisna kuyruğu

- Sevkiyat Takip yalnız Europe/Istanbul yerel takvimindeki **bugünü** gösterir. Ana liste `İstenilen Tsl. Trh.=bugün` belgeleridir; kullanıcıya açık geçmiş gün seçimi, geçmiş sipariş listesi veya `GECİKMİŞ AÇIK SEVK` kuyruğu bulunmaz.
- Belge seviyesinde tek operasyon durumu üretilir: `BLOCKED_DATA`, `MIXED_REVIEW`, `ACTION_NOW`, `IN_TRANSIT`, `COMPLETED`, `DEFERRED` veya `EXCLUDED`. Bu sıralama finansal risk değil, saha operasyon önceliğidir.
- `BLOCKED_DATA`: belge anahtarı, müşteri, istenilen teslim tarihi veya belge tutarı çelişkili; bilinmeyen belge türü/durum; aktif snapshot coverage'ı yetersiz. Belge yanlış operasyon durumuna zorlanmaz.
- `MIXED_REVIEW`: aynı satış belgesinde birden fazla aktif teslimat durumu bulunur. Kaynakta kalem tutarı olmadığı için belge toplamı durumlara bölünmez; durum kümesi, her durumdaki satır sayısı ve belge tutarı bir kez gösterilir.
- `ACTION_NOW`: rapor tarihinde dağıtıma çıkması beklenen, reddedilmemiş/iptal edilmemiş ve henüz `Yüklemeye Alınmadı` durumundaki belgedir. Bu durum “sevkiyata uygun finansal onay verildi” anlamına gelmez; yalnız operasyonel aksiyon kuyruğudur.
- `IN_TRANSIT`: belge durum kümesi yalnız `Sevkiyatta`; `COMPLETED`: yalnız `Teslim Edildi` veya `Depodan Teslim`; `DEFERRED`: yalnız gerçek teslimat durumu `Ertelendi`; `EXCLUDED`: red veya iptal nedeniyle aktif dağıtım kapsamı dışı belgedir. `EMANET_SP` bir tür/görünüm sınıfıdır, `DEFERRED` durumuyla aynı şey değildir.
- Günlük üst özet belge adedi ve tutarı ayrı verir: `Bugün Planlanan`, `Aksiyon Bekleyen`, `Sevkiyatta`, `Karma/İnceleme`, `Tamamlanan`, `Ertelenen`, `Red/İptal` ve `Veri Blokajı`. Her tutar `Satış Belge No` seviyesinde bir kez toplanır; durumlar arası toplam mutabakatı kontrol edilir.
- Sıfır/boş sipariş tutarı otomatik olarak hatalı sayılmaz; özellikle tutar taşımayan belge türlerinde `AMOUNT_NOT_PROVIDED` açıklamasıyla adet metrikleri korunur. Tutarı olmayan belge genel TL toplamına sıfır katkı verir fakat coverage paydasında görünür; AI bunu gerçek 0 TL satış diye yorumlayamaz.
- Tek belge kartı şu sırayla gösterilir: (1) satış belge no, müşteri, temsilci/SSM ve kanal; (2) belge türü, satış tarihi, istenilen teslim tarihi; (3) operasyon durumu ve kaynak satır durum kümesi; (4) yükleme numarası, Fatura No ve varsa güvenli fatura bağlantısı; (5) belge seviyesinde tekil sipariş tutarı ve tutar coverage'ı; (6) resmî/geçici peşin ödeme bağlam etiketi; (7) veri kalite/operasyon istisnaları; (8) ham kaynak satırlarına ve Fatura Kontrol/Cari detayına geçiş.
- `Yükleme numarası` boş veya `0` ise gerçek yükleme bağlantısı sayılmaz. `ACTION_NOW` belgede yükleme numarası yokluğu normal bekleyen durum olabilir; `IN_TRANSIT` veya `COMPLETED` belgede yoksa `MISSING_LOAD_REFERENCE` incelemesi üretilir fakat teslimat statüsünü otomatik geri almaz.
- Siparişte Fatura No bulunması operasyon kartında yalnız referanstır. `COMPLETED` + Fatura No boşsa Fatura Kontrol'e `DELIVERED_WITHOUT_INVOICE_REFERENCE`; Fatura No var fakat satış kaynağında yoksa `ORDER_INVOICE_REFERENCE_NOT_IN_SALES_SOURCE` handoff'u yapılır. Sevkiyat ekranı kendi başına fatura/cari hükmü vermez.
- Geçici/resmî ödeme bağlamı yalnız `OPS-DOC-005` kanonik görünümünden gelir ve `TEMP_SIGNAL`, `OFFICIAL_CONTEXT`, `AMBIGUOUS`, `NONE` olarak etiketlenir. Bu bağlam sipariş tutarından düşülmez; “ödendi/sevke uygun” sonucuna çevrilmez. Kullanıcı finansal ayrıntı için Fatura Kontrol/Cari ekranına geçer.
- Aynı gün yeni tam sipariş dosyası yüklenirse önceki aktif günlük kümenin tamamının yerini atomik olarak alır; ekleme/append yapılmaz. Bugünkü görünüm yalnız son başarılı günlük snapshot'tır. Başarısız yüklemede son geçerli aynı-gün snapshot korunur.
- Kullanıcıya açık sipariş geçmişi tutulmaz. Teknik denetimde dosya hash'i, yükleme zamanı/kullanıcı, kapsam günü, satır-kontrol sayıları, yayın sonucu ve manuel çatışma izi kalabilir; bunlar sipariş geçmişi ekranı, dönemsel sevkiyat raporu veya AI geçmiş analizi oluşturmaz.
- Her başarılı günlük publish sırasında `Teslim Edildi/Depodan Teslim` ve güvenli fatura bağlantısı bulunan belgenin yalnız Fatura Kontrol için gerekli kimlik, teslim kanıtı ve kaynak provenance'ı `invoice_delivery_handoff` kaydına hemen ve idempotent aktarılır. Ertesi gün bu belge Sevkiyat Takip'te görünmez; finansal/yaşlandırma geçmişi Fatura Kontrol'den izlenir.
- Teslim edilmiş fakat fatura referansı eksik/bağlanamayan belge de Fatura Kontrol istisnasına handoff edilir. Teslim edilmemiş, ertelenmiş, reddedilmiş veya iptal edilmiş sipariş için Sevkiyat geçmiş kaydı oluşturulmaz; yeni gün dosyasında bugünün teslim tarihiyle tekrar gelirse yeni aktif günlük görünümde yer alır.
- İstisna kuyruğu yalnız bugünkü aktif snapshot için en az şu kodları taşır: `MISSING_DOCUMENT_ID`, `CONFLICTING_CUSTOMER`, `CONFLICTING_DOCUMENT_AMOUNT`, `INVALID_REQUESTED_DELIVERY_DATE`, `UNKNOWN_ORDER_TYPE`, `UNKNOWN_DELIVERY_STATUS`, `MIXED_ACTIVE_STATUS`, `CANCELLED_ACTIVE_CONFLICT`, `MISSING_LOAD_REFERENCE`, `PAYMENT_CONTEXT_AMBIGUOUS`, `SOURCE_COVERAGE_INCOMPLETE`.
- Liste sırası `BLOCKED_DATA`, `MIXED_REVIEW`, `ACTION_NOW`, `IN_TRANSIT`, `COMPLETED`, `DEFERRED`, `EXCLUDED`; aynı sınıfta istenilen teslim zamanı varsa artan, sonra belge tutarı azalan ve kalıcı satış belge no artan sıradır.

### Sevkiyat Takip ve Fatura Kontrol kullanıcı işlemleri, manuel çözüm ve handoff

- Sevkiyat Takip yalnız bugünkü aktif kaynak snapshot'ı üzerinde kullanıcı işlemi kabul eder. Kullanıcı mevcut belgeyi düzeltme overlay'iyle değiştirebilir, bugünkü görünümden kapsam dışı bırakabilir, soft-delete yapabilir/geri alabilir, fatura adayıyla bağlantı seçebilir veya veri kalite istisnasını çözebilir. Ham Excel satırı hiçbir işlemde değiştirilmez.
- Sipariş manuel düzeltmesi en az eski aktif kaynak değeri, önerilen yeni değer, etkilenecek operasyon durumu/özet/handoff, gerekçe ve kullanıcıyı kaydetmeden önce gösteren önizleme gerektirir. Onaydan sonra yeni sürümlü override oluşur; fiziksel silme yapılmaz.
- Aynı sipariş aynı gün yeni Excel yüklemesinde yeniden gelirse genel üçlü karşılaştırma uygulanır: önceki kaynak, aktif manuel override ve yeni kaynak. Yeni kaynak değişmemişse override korunur ve kullanıcıya yeniden görüldüğü bildirilir; kaynak değişmişse onaya kadar manuel sürüm etkin kalır ve çatışma kuyruğu açılır.
- Kullanıcı bugünkü siparişi kapsam dışı bıraktığında günlük adet/tutar ve operasyon durumundan çıkar. Belge daha önce Fatura Kontrol'e handoff edilmişse işlem önizlemesi bu adayı sessizce silmez; Fatura Kontrol'de `SOURCE_ORDER_MANUALLY_EXCLUDED` yeniden değerlendirme uyarısı ve yeni kanıt sürümü oluşturur.
- Fatura Kontrol ana olarak read-model ve inceleme ekranıdır. Kullanıcı alarmı `ACKNOWLEDGED` yapabilir, not/kanıt ekleyebilir, güvenli adaylar arasından fatura–teslimat bağlantısı seçebilir, yanlış bağlantıyı kaldırabilir veya kaynak finansal/sipariş kaydının düzeltme ekranına geçebilir.
- `ACKNOWLEDGED` yalnız “kullanıcı gördü/inceledi” demektir; alarmın ekonomik nedeni devam ediyorsa `RESOLVED` sayılmaz, ana overall-state hesaplamasından çıkarılmaz ve AI bunu kapanmış sorun gibi yorumlayamaz. Neden ortadan kalkar ya da onaylı çözüm uygulanırsa alarm `RESOLVED`; yeni kaynak/iptal/değişiklik nedeni geri getirirse `REOPENED` olur.
- Kullanıcının manuel fatura–teslimat bağlantısı `MANUAL_LINK_OVERRIDE` olarak iki kaynak kimliğine bağlanır; müşteri ve tutar çelişkisi varsa etki önizlemesi ve açık yüksek önem uyarısı olmadan onaylanamaz. Ham belge anahtarları korunur. Yeni yükleme anahtarları değiştirirse bağlantı otomatik yeniden kullanılmaz, tekrar onaya gider.
- Fatura Kontrol kartındaki “peşin alındı”, “yaşlı faturadan tahsilat düşüldü”, “fatura kapandı”, “Çek/Senet ödendi” gibi finansal durumlar salt işaret kutusuyla değiştirilemez. Kullanıcı ya mevcut resmî olayı/araç kaydını güvenli biçimde bağlar ya da Paket 09/11 ortak manuel finansal işlem ekranına geçer; bakiye, FIFO allocation, aging ve risk etkisi burada önizlenip onaylandıktan sonra merkezi motor yeniden hesaplar.
- Kullanıcı FIFO'nun varsayılan sonucundan farklı belirli bir tahsilat–fatura bağlantısı seçerse bu, Paket 10'daki `MANUAL_ALLOCATION_OVERRIDE` işlemidir. Etkilenecek eski/yeni faturalar, açık tutarlar, yaşlandırma, kapama günleri, temsilci/SSM metrikleri ve geri alma sonucu önizlenmeden uygulanamaz.
- İş akışı durumları `OPEN`, `ACKNOWLEDGED`, `PENDING_USER_APPROVAL`, `RESOLVED`, `REOPENED`, `REJECTED_RESOLUTION`dır. Her geçiş kullanıcı/rol, zaman, gerekçe, önceki/yeni değer, dayanak kimlikleri ve calculation run ile değişmez denetim izi taşır.
- Yetki capability tabanlıdır: en az `dispatch.view`, `dispatch.upload`, `dispatch.override_today`, `invoice_control.view`, `invoice_control.acknowledge`, `invoice_control.resolve_link`, `financial_transaction.mutate`, `manual_allocation.override` ayrı izinlerdir. Tek bayi olması tüm kullanıcıların bütün mutasyon yetkisine sahip olduğu anlamına gelmez; RLS ve backend denetimi hem önizlemede hem commit'te çalışır.
- `invoice_delivery_handoff` her başarılı bugünkü sipariş yayını sırasında hemen ve idempotent olarak güncellenir; gün sonunu beklemek gerekmez. Aynı satış belgesi+teslim kanıtı+fatura bağlantı sürümü ikinci aday üretmez. Sonraki kaynak/manuel değişiklik mevcut Fatura Kontrol adayının yeni kanıt sürümünü ve gerekli yeniden hesaplamayı oluşturur.
- Fatura Kontrol'den Sevkiyat Takip'e dönüş yalnız belge bugün aktif günlük snapshot'ta hâlâ varsa mümkündür. Geçmiş teslim için Sevkiyat geçmiş ekranı açılmaz; kart satış/fatura/cari kaynak detayına gider.

## Güncel devam noktası

- Ana veri modeli; yükleme kartları, parser imzaları, atomik aktif-küme değiştirme, resmî/geçici mutabakat, rapor API yaklaşımı ve AI araç sınırlarıyla birlikte aşamalı kod planına bağlanmıştır.
- Fatura Kontrol ve Sevkiyat Takip iş kuralları; hesap matrisi kimlikleri, veri varlıkları, API sözleşmeleri, AI araçları ve Terra kabul testleriyle paketlenmiştir. Gerçek kaynaklardaki fatura–satış belgesi–teslimat bağlantısının kesin anahtarları ve belirsizlik sırası da doğrulanmıştır.
- Fatura Kontrol ve Sevkiyat Takip'in veri, hesap, ekran, kullanıcı işlemi, manuel çözüm, yetki ve handoff sözleşmeleri tamamlanmıştır.
- Paket 00 — Teknik temel ve karakterizasyon; tanımlı test/build/lint ve güvenlik kapılarıyla `ACCEPTED` durumundadır.
- Paket 01 sürümlü ham veri/yükleme omurgası; PostgreSQL şeması, RLS, import state machine'i, atomik yayın fonksiyonu, backend API'leri ve kabul testleriyle `ACCEPTED` durumundadır.
- Paket 01A Geçici Belgeler staging/snapshot; exact `BELGELER_TEMP` contract'ı, finansal etkisizlik, dosya içi dedup/çatışma, full-vs-partial kapsam, immutable snapshot diff'i, atomik active pointer, PostgreSQL/RLS/API/outbox ve 50 bağımsız testle teknik olarak tamamlanmıştır. Paket `BLOCKED`, hazırlık seviyesi `TECHNICALLY_SPECIFIED`dır; Paket 00/01/02 kabul edilmeden kodlanmaz.
- Paket 02 tek müşteri/organizasyon/durum/kanal modeli; kaynak contract, temporal PostgreSQL şeması, alan çözümü, durum/kanal/segment/temsilci/SSM kuralları, API ve kabul testleriyle `ACCEPTED` durumundadır. Yerel kabul kanıtı Bayrampaşa Master için 819 kaynak satırı, 779 geçerli `500...` satırı ve 398 benzersiz geçerli müşteri kontrolüdür; 25 temsilci çatışması yayın istisnasıdır, müşteri kimliği veya temporal bütünlük hatası değildir.
- Paket 03 ürün ailesi, paket varyantı, dönüşüm grafiği ve litre modeli; temiz migration zinciri, 75 SQL kabul testi, backend/panel/safety kapıları ve anonim yerel karakterizasyon ile `ACCEPTED` durumundadır. Paket 03A/04/05/06 kapsamları bu uygulamaya alınmamıştır.
- Paket 03A Malzemeler / Anlık Stok yükleme alanı; exact parser imzası, aktif tam-küme atomik değiştirme, miktar/litre completeness, freshness, API, UI kartı, AI-semantic descriptor, kesin dosya kapsamı ve kabul testleriyle teknik olarak tamamlanmıştır. Paket `READY_FOR_TERRA`dır; Paket 00–03 kabulü tamamlanmıştır.
- Paket 04 Sellout olayları ve aylık performans; exact kaynak contract'ı, Faturalama Tarihi, overlap/multiset satır kimliği, iade/iptal sınıflandırma sınırı, sürümlü manuel çözüm/geri alma, belge×aile olayı, temporal müşteri/organizasyon sorumluluğu, temsilci hedef sürümleri, API, AI-semantic descriptor, kesin dosya kapsamı ve kabul testleriyle uygulanmış ve `ACCEPTED` durumundadır. Paket 03A teknik ön koşul değildir.
- Paket 04A ST Tahsilat/Litre; saf Europe/Istanbul takvimi, pazar/pazartesi ve ay sonu istisnası, kanonik Belgeler→resmî takeover, exact pay/payda, temporal sorumluluk, coverage, dönem toplaması, API, AI-semantic descriptor, kesin dosya kapsamı ve kabul testleriyle teknik olarak tamamlanmıştır. Paket `BLOCKED`, hazırlık seviyesi `TECHNICALLY_SPECIFIED`dır; Paket 00–04 ile 01A/08/08A kabul edilmeden kodlanmaz.
- Paket 05 FKNS motoru; aylık kesim portföyü, genel ve kanal FKNS, tarihçeli ürün×kanal uygunluğu, aile/varyant birleştirme, çoklu ürün OR kümeleri, net elde tutulan noktalar, rep→SSM→şirket toplulaştırması, ikincil hedefler, coverage, API, AI-semantic descriptor, kesin dosya kapsamı ve kabul testleriyle teknik olarak tamamlanmıştır. Paket `BLOCKED`, hazırlık seviyesi `TECHNICALLY_SPECIFIED`dır; Paket 00–04 kabul edilmeden kodlanmaz.
- Paket 06 aktif stok, KA talebi, tahmin, stok günü, güvenlik stoğu ve sipariş ihtiyacı teknik şartnamesi tamamlanmıştır; bağımlılıkları kabul edilene kadar `BLOCKED/TECHNICALLY_SPECIFIED` durumundadır.
- Paket 06A Ticari Stok yükleme ve rapor modülü; exact Excel contract'ı, satır sınıfları, atomik tam-küme değiştirme, PostgreSQL/RLS, rapor API'leri, UI/export sınırı, AI-semantic descriptor ve gerçek veri kabul testleriyle teknik olarak tamamlanmıştır. Paket `BLOCKED`, hazırlık seviyesi `TECHNICALLY_SPECIFIED`dır; Paket 00–03 kabul edilmeden kodlanmaz.
- Paket 07 Satış Faturası ve aktif iptal motoru; exact kaynak contract'ı, sürümlü olay kimliği, bütün geçmişte CREATED↔CANCELLED kontrolü, vergi dâhil ciro, bitemporal restatement, PostgreSQL/RLS, API, UI/export ve AI-semantic kabul testleriyle teknik olarak tamamlanmıştır. Paket `BLOCKED`, hazırlık seviyesi `TECHNICALLY_SPECIFIED`dır; Paket 00–02 kabul edilmeden kodlanmaz.
- Paket 07A Sipariş/teslimat belge omurgası; exact kaynak contract'ı, belge seviyesinde tekilleştirme, bütün-belge tutarını bir kez alma, durum kümesi, güçlü fatura bağlantıları, günlük atomik snapshot, PostgreSQL/RLS, API, UI/export ve AI-semantic kabul testleriyle teknik olarak tamamlanmıştır. Paket `BLOCKED`, hazırlık seviyesi `TECHNICALLY_SPECIFIED`dır; Paket 00–02 ve 07 kabul edilmeden kodlanmaz.
- Paket 07B Bugünkü Sevkiyat Takip; Sipariş/Emanet SP görünüm sınıfları, Key Account dışlama, yalnız sunucu bugünü, merkezi operasyon durumu, belge kartı ve özet mutabakatı, kanonik ödeme bağlamı, istisna kuyruğu, bugünkü manuel işlemler, idempotent Fatura Kontrol handoff'u, PostgreSQL/RLS, API, UI/export ve AI-semantic kabul testleriyle teknik olarak tamamlanmıştır. Paket `BLOCKED`, hazırlık seviyesi `TECHNICALLY_SPECIFIED`dır; çekirdek için Paket 00–02/07/07A, tam kabul için ayrıca 01A/08/08A beklenir.
- Paket 08 Tahsilat ve kıymetli evrak motoru; dört exact kaynak contract'ı, sürümlü tahsilat olayları, aktif iptal/mükerrer kontrolü, Nakit/Havale cari etkisi, Çek/Senet kabul-risk ayrımı, Havale–Çek kapama/reversal, Senet iade/karşılıksız kullanıcı disposition'ı, PostgreSQL/RLS, API, UI/export ve AI-semantic kabul testleriyle teknik olarak tamamlanmıştır. Paket `BLOCKED`, hazırlık seviyesi `TECHNICALLY_SPECIFIED`dır; Paket 00–02 kabul edilmeden kodlanmaz.
- Paket 08A Resmî tahsilatın Belgeler katmanını devralması; deterministik aday/eşleşme sırası, tam arşiv mutabakatı, kanonik kaynak önceliği, `%80` batch iş akışı, snapshot kaybolma/reappearance davranışı, kullanıcı yönetimli istisna kuyruğu, downstream invalidation/outbox, PostgreSQL/RLS, API, UI/export ve AI-semantic kabul testleriyle teknik olarak tamamlanmıştır. Paket `BLOCKED`, hazırlık seviyesi `TECHNICALLY_SPECIFIED`dır; Paket 00/01/01A/02/08 kabul edilmeden kodlanmaz.
- Paket 08B Senet/bono hazırlama ve yazdırma; referans modal/A5 bono karakteri, sürümlü hukuk ve issuer profili, kaynak tutar provenance'ı, integer-kuruş taksit bölümü, vade planı, immutable PDF/print/reprint/void audit'i ve resmî Senet kabulünden kesin ayrımla teknik olarak tamamlanmıştır. Paket `BLOCKED`, hazırlık seviyesi `TECHNICALLY_SPECIFIED`dır; Paket 00/01/02/07A/08 ile approved-active hukuk/issuer/retention politikaları kabul edilmeden kodlanmaz/açılmaz.
- Paket 09 IADE/HIZMET tahsilatı; exact Satın Alma kaynak contract'ı, kesin üçlü tip router'ı, müşteri/tedarikçi ayrımı, sürümlü belge olayı, aktif iptal ve mükerrer kontrolü, nakit dışı cari azaltma semantiği, kontrol denklemleri, PostgreSQL/RLS, API, UI/export ve AI-semantic kabul testleriyle teknik olarak tamamlanmıştır. Paket `BLOCKED`, hazırlık seviyesi `TECHNICALLY_SPECIFIED`dır; Paket 00/01/02/08 kabul edilmeden kodlanmaz.
- Paket 10 Cari defter, fatura dağıtımı ve aging; olay defteri, receivable lot, deterministik FIFO, dağıtılmamış alacak, allocation replay, devir/virman, açık fatura, exact gün ve standart aging dilimleri, temel 3/6/12 gün/ay gerçekleri, PostgreSQL/RLS, API, UI/export ve AI-semantic kabul testleriyle teknik olarak tamamlanmıştır. Paket `BLOCKED`, hazırlık seviyesi `TECHNICALLY_SPECIFIED`dır; Paket 00/01/02/07/08/09 kabul edilmeden kodlanmaz.
- Paket 10A Teslim edilmiş Fatura Kontrol; idempotent teslim handoff'u, çift/tek güçlü anahtar bağlantısı, fatura öncesi ve güncel açık yığın, D−1/D allocation kanıtı, resmî peşin coverage, Çek/Senet riski, kanıtlı alarm router'ı, inceleme workflow'u, PostgreSQL/RLS, API, UI/export ve AI-semantic kabul testleriyle teknik olarak tamamlanmıştır. Paket `BLOCKED`, hazırlık seviyesi `TECHNICALLY_SPECIFIED`dır; Paket 00/01/01A/02/07/07A/07B/08/08A/10 kabul edilmeden kodlanmaz.
- Paket 04B Sellout tarihsel karşılaştırma ve AI raporlama; açık/kapalı/genel litre KPI'ları, aylık kanal dağılımı, toplam trend, ayrıntılı ay tablosu, eş dönem/yıllık karşılaştırma, katkı analizi, coverage, PDF/XLSX/görsel artifact ve AI anlatı sözleşmesiyle teknik olarak tamamlanmıştır. Paket `BLOCKED`, hazırlık seviyesi `TECHNICALLY_SPECIFIED`dır; Paket 00–04 ile artifact için 12E ve canlı AI için 14 kabul edilmeden tam kullanıcı teslimi açılamaz.
- Paket 11 Manuel işlem, override ve kaynak çatışması; domain-adapter'lı ortak form, tipli etki önizlemesi, immutable commit, kapsam dışı/soft-delete/restore, manuel allocation ve link override, alan bazlı üçlü kaynak karşılaştırması, politika güvenliği, dependency invalidation, PostgreSQL/RLS, API/UI ve AI güvenli mutasyon testleriyle teknik olarak tamamlanmıştır. Paket `BLOCKED`, hazırlık seviyesi `TECHNICALLY_SPECIFIED`dır; Paket 00/01/02/07/08/09/10 ve ilgili operasyonel override'lar için 07A/07B/10A kabul edilmeden kodlanmaz.
- Paket 12A Temel finansal read model ve mutabakat; Paket 10 defter/FIFO gerçeklerini kopyalamadan günlük cari/lot/araç/organizasyon pozisyonu, DSO, 29+ CEI, 3/6/12 finansal akış, coverage ve kapanış mutabakatı üretecek biçimde teknik olarak tamamlanmıştır. Alt paket `BLOCKED`, hazırlık seviyesi `TECHNICALLY_SPECIFIED`dır; Paket 00/01/02/07/08/09/10/11 ile Paket 13 metric registry/calculation-run çekirdeği kabul edilmeden kodlanmaz.
- Paket 12B Finansal skor, iç limit ve organizasyon karnesi; açıklanabilir müşteri sağlık skoru, tek yönlü skor→limit bağı, sürümlü iç limit önerisi/override'ı, temporal sorumluluk ve temsilci/SSM finansal karnesiyle teknik olarak tamamlanmıştır. Alt paket `BLOCKED`, hazırlık seviyesi `TECHNICALLY_SPECIFIED`dır; Paket 12A ve Paket 13 çekirdeği kabul edilmeden kodlanmaz.
- Paket 12C Kohort, migration ve yoğunlaşma; portföy yoğunlaşması, lot-slice aging geçişi, gözlemlenebilir fatura vintage'ı, right-censored ödeme survival'ı, 29+ yük köprüsü, finansal davranış segmenti ve güvenli peer benchmark ile teknik olarak tamamlanmıştır. Alt paket `BLOCKED`, hazırlık seviyesi `TECHNICALLY_SPECIFIED`dır; Paket 12A/12B ve Paket 13 çekirdeği kabul edilmeden kodlanmaz.
- Paket 12D Nakit tahmini, erken uyarı ve senaryo; doğrudan nakit ile ekonomik kapanışı ayıran 13 haftalık görünüm, rolling-origin model kapısı, sürümlü bozulma/anomali sinyalleri, açıklanabilir tahsilat önceliği, immutable stres/karşı taraf/management loss senaryoları ve AI Odak teslimatıyla teknik olarak tamamlanmıştır. Alt paket `BLOCKED`, hazırlık seviyesi `TECHNICALLY_SPECIFIED`dır; Paket 12A–12C ve Paket 13 çekirdeği kabul edilmeden kodlanmaz.
- Paket 12E rapor, grafik, snapshot, PDF/XLSX/PNG/SVG artifact, drill-down ve AI Odak ortak gösterim katmanı; tek manifest, immutable sürüm, canonical filtre, güvenli export ve 80 bağımsız testle teknik olarak tamamlanmıştır. Alt paket `BLOCKED`, hazırlık seviyesi `TECHNICALLY_SPECIFIED`dır; Paket 00/01/02, Paket 13 çekirdeği ve raporun tükettiği domain paketleri kabul edilmeden kodlanmaz.
- Paket 12F aksiyon günlüğü ve sonuç ölçümü; native vaka/faaliyet/ödeme sözü kaynağı, prospective kayıt, 7/14/30 resmî sonuç, çift sayım önleme, zamansal ilişki ve randomize deney dışında nedensellik reddiyle teknik olarak tamamlanmıştır. Alt paket `BLOCKED`, hazırlık seviyesi `TECHNICALLY_SPECIFIED`dır; Paket 00/01/02/10/12A/12D ve Paket 13 çekirdeği kabul edilmeden kodlanmaz.
- Paket 13 merkezi metrik motoru; immutable registry/version, tipli grain/unit/period, cycle-safe dependency DAG, canonical plan/run, exact result envelope, coverage/reconciliation, lease/fencing, atomik publication, scoped invalidation/replay/restatement, RLS/API/observability ve 80 bağımsız testle teknik olarak tamamlanmıştır. Paket `BLOCKED`, hazırlık seviyesi `TECHNICALLY_SPECIFIED`dır; Paket 00/01/02 kabul edilmeden kodlanmaz.
- Paket 14 AI semantik ve yorum katmanı; backend-only provider geçidi, sürümlü Türkçe katalog, tipli plan/bağlam/belirsizlik, araç güvenlik duvarı, deterministic digest, evidence-bound claim/validator, güvenli mutation confirmation, cache/eval/RLS ve 100 bağımsız testle teknik olarak tamamlanmıştır. Paket `BLOCKED`, hazırlık seviyesi `TECHNICALLY_SPECIFIED`dır; Paket 00/02/13 ile tüketilecek domain paketleri kabul edilmeden kodlanmaz/açılmaz.
- Paket 15 kontrollü geçiş ve legacy kapatma; capability control plane, immutable migration/backfill manifesti, semantik fark sınıfları, readiness/four-eyes, deterministic canary, tek-yazar cutover, veri kaybetmeyen rollback/incident ve retention-gated retirement ile 100 bağımsız test üzerinden teknik olarak tamamlanmıştır. Paket `BLOCKED`, hazırlık seviyesi `TECHNICALLY_SPECIFIED`dır; Paket 00–14 kabul edilmeden kodlanmaz ve kod kabulü production cutover yetkisi vermez.
- Yol haritasındaki 31 bağımsız paketin tamamı teknik olarak planlanmıştır. Paket 00 `READY_FOR_TERRA`; Paket 01–15 ve bütün alt paketler bağımlılıkları bekleyen `BLOCKED / TECHNICALLY_SPECIFIED` durumundadır. Bundan sonraki iş, planlama paketi eklemek değil Paket 00'dan başlayarak tek tek uygulama/kabul zinciridir.
- Sonraki konu açılırken onaylı kararlar yeniden sorulmayacak; referans/mevcut uygulama yalnız karakterizasyon ve regresyon kanıtı olarak kullanılacaktır.

## Paket 01 teknik omurga kararı — onaylı planlama standardı

- Kaynak dosya özel Supabase Storage alanında, metadata/ham satır/sürüm/doğrulama/yayın zinciri PostgreSQL'de tutulacaktır. Tarayıcıdaki IndexedDB veya React state resmî kayıt değildir.
- Ham kaynak satırı değişmez ve silinmez. Düzeltme yeni record version, kullanıcı kararı veya sonraki manuel override katmanında yapılır; kaynak dosya–sheet–satır provenance'ı korunur.
- İş kaynağı parser'ları sürümlü `source_contract_versions` imzasına bağlanır. Kaynak türü, kapsam ve parser contract açıkça çözülmeden kayıt yayımlanamaz.
- Aynı dosyanın yeniden yüklenmesi ayrı audit batch'i oluşturabilir; ancak aynı `source_kind + scope_key + server-verified SHA-256 + parser contract` ikinci aktif snapshot veya ekonomik olay üretmez.
- Import durumları yalnız izinli state machine geçişi ve append-only event ile değişir. Terminal batch geriye yürütülmez; yeniden deneme ilişkili yeni attempt'tir.
- Aktif veri yayını `source_kind+scope_key` kilidi altında tek transaction ile yapılır. Blocking issue, eski validation run veya kontrol toplamı farkı yayını engeller; hata hâlinde son geçerli snapshot eksiksiz korunur.
- `FULL_REPLACE`, `APPEND_ONLY` ve `UPSERT_VERSIONED` davranışları kaynak contract'ında açıkça seçilir. Genel varsayılan append değildir; özellikle günlük snapshot kaynakları yeni başarılı tam kümeyle atomik değişir.
- Bütün ingestion tablolarında RLS aktiftir. `import.view/create/validate/review/publish/audit` ayrı capability'lerdir; browser'a service-role anahtarı verilmez ve backend service-role kullanıcı yetkisini atlamak için kullanılamaz.
- Yeni import API'si Supabase bearer auth kullanır ve mevcut AI endpoint'inin app-secret zincirinden ayrılır. Publish/review kararlarında body içindeki kullanıcı kimliği güvenilmez; aktör `auth.uid()` üzerinden belirlenir.
- Mevcut kök `.gitignore` içindeki `backend/` tam dışlama kaldırılacaktır; yalnız kaynak kod izlenir, `.env`, `node_modules`, gerçek Excel/veri ve anahtarlar dışarıda kalır. Böylece Terra'nın backend teslimatı Git diff ve kabul testleriyle denetlenebilir olur.
- Paket 01 hiçbir müşteri/ürün/fatura finansal kuralını, gerçek Excel parser'ını, UI yükleme kartını veya metriği önceden kodlamaz. Bunlar Paket 01 omurgasını kullanan sonraki bağımsız paketlerde uygulanır.

## Paket 02 müşteri ve organizasyon modeli — kesin teknik karar

- `CUSTOMER_MASTER` tam snapshot kaynağıdır. Dosyada güvenilir kesim tarihi varsa iş zamanı odur; yoksa yükleme tamamlanma anı `UPLOAD_TIME_FALLBACK` olarak kullanılır. Eski tarihli yükleme geçmişi kullanıcı onayı olmadan değiştirmez.
- Müşteri kodu kırpılmış kaynak metni olarak birebir saklanır ve yalnız `500` ile başlama koşulu uygulanır. Sayıya çevirme, sıfır ekleme, noktadan bölme veya fuzzy müşteri eşleştirmesi yapılmaz.
- Aynı müşteri kodunun Bira/Distile satırları tek müşteri kimliğine bağlanır fakat bütün ham satırlar ayrı observation/provenance olarak kalır. Kalıcı division alanı oluşturulmaz.
- Profil alanları satır sırasına göre seçilmez. Aynı dolu değer tekilleştirilir; boş kardeş satır dolu kardeşten provenance ile tamamlanabilir; farklı dolu değer `CONFLICT_REVIEW` olur. Kredi limitleri toplanmaz veya yayımlanmaz.
- Durum önceliği: herhangi bir Aktif→`ACTIVE`; aktif yok ve herhangi bir Pasif→`PASSIVE`; yalnız bütün satırlar tanınmış iptalse→`CANCELLED`; unknown-only veya cancelled+unknown→`UNKNOWN`. Tanınmayan raw durum issue olarak korunur.
- Yeni tam Master snapshot'ında bulunmayan eski müşteri silinmez ve iptal varsayılmaz; `NOT_PRESENT_IN_CURRENT_MASTER` coverage durumuna geçer. Geçmiş as-of sonuçları eski sürümden yeniden üretilebilir.
- Kanal yalnız Master'dan gelir. Açık ve Kapalı aday birlikteyse müşteri iki kanala birden yazılmaz; `UNCLASSIFIED + CHANNEL_CONFLICT` olur. Sellout kanalı fallback değildir.
- Segment tarihçeli Master boyutudur ve standart KPI'ları kendiliğinden değiştirmez; AI/rapor filtresi olarak kullanılabilir. Eksik veya çelişkili segment ayrı resolution durumu taşır.
- Aynı müşteride tek temsilci adayı atanır; farklı adaylar adları birleştirilmeden incelemeye gider. Çözülemeyen müşteri başka temsilciye yapay atanmaz ve şirket seviyesinde mutabakat kapsamında kalır.
- Temsilci→SSM baskınlığı yalnız benzersiz aktif, SSM bilgili müşterilerden `max_count/known_active_count` ile hesaplanır. `≥%90` otomatik kanonik atama; altı, payda 0 veya tie incelemedir. Sabit 1/2/10 müşteri aykırılık eşiği yoktur.
- Müşterinin rapor SSM'si raw müşteri satırından doğrudan değil, kesim tarihindeki kanonik temsilci→SSM atamasından gelir. Temsilcisi çözülemeyen müşteri doğrudan SSM performansına yazılmaz.
- Aktif müşterisi olmayan temsilcinin `FINANCIAL_ONLY` tutulması Paket 10/12'nin günlük pozitif bakiye ve `100 TL` kuralından gelir; Paket 02 müşteri sayısına veya Master kredi limitine bakarak karar vermez.
- Mevcut parserdaki kredi limiti toplama, temsilci/kanalı `/` ile birleştirme, tabela adına Bira/Distile ekleme, eksik müşteriyi yapay Aktif üretme ve 30 TL gizleme davranışları yeni modele taşınmayacaktır.
- Master alan çatışmaları kimliği belli bütün batch'i zorunlu reddetmez; snapshot `PUBLISHED_WITH_EXCEPTIONS`, ilgili müşteri/alan `PARTIAL/UNRESOLVED` olabilir. Kimlik/snapshot/temporal bütünlük sorunu ise yayın blokajıdır.
- Paket 02 yeni modeli server-side `customer_master_v2` flag arkasında paralel üretir; mevcut UI ve IndexedDB davranışı Paket 15 kontrollü cutover'a kadar değiştirilmez.

## Paket 03 ürün ailesi, dönüşüm grafiği ve litre modeli — kesin teknik karar

- Her malzeme kodu ham metni korunan ayrı paket varyantıdır; 6'lı/12'li/24'lü kodlar overwrite edilmez. Resmî toplulaştırma yönlü ana/parçalı haritayla değil, tarihçeli `ürün ailesi → varyantlar` modeli ve fiziksel litreyle yapılır.
- Paket işlemi yönü kalıcı ana kod, ikmal varyantı veya aile adı belirlemez. Bira/Distile sınıfına göre dönüşüm yönü seçilmez; ad temizleme ve kod benzerliği yalnız inceleme adayı olabilir.
- Dönüşüm kanıtı `source_qty × source_lpu = target_qty × target_lpu` fiziksel eşitliğiyle saklanır. Edge oranları kesin ondalık/rasyonel mantıkla değerlendirilir; ters işlem, çevrim ve çoklu yol aynı eşdeğerliği vermiyorsa bileşen otomatik yayımlanmaz.
- İki yayımlanmış aileyi birleştiren veya aileyi bölen yeni kanıt sessiz uygulanmaz. Etki önizlemesi, kullanıcı onayı ve yeni temporal membership sürümü gerekir; geçmiş as-of üyeliği değiştirilmez.
- Sellout ve KA litre adayları ayrı kaynak kanıtlarıdır ve yalnız pozitif geçerli satırlardan `Σlitre/Σmiktar` ile hesaplanır. Basit satır oranı ortalaması yapılmaz; iade/iptal/teknik hareket öğrenme kümesine girmez.
- Resmî litre önceliği `istikrarlı Sellout → istikrarlı KA → doğrulanmış graph anchor yayılımı → onaylı katalog/master veya kullanıcı kararı`dır. Graph tek başına mutlak litre yaratamaz; anchor gerekir. Kaynak çatışması gizlenmez.
- `units_per_case × unit_volume_ml / 1000` yalnız açık yapısal alanlardan fiziksel kontrol adayıdır; ürün adından hacim veya paket adedi parse edilerek resmî katsayı oluşturulmaz.
- Katsayı eksik/çelişkili hacim ürününde ham miktar kalır, litre ve bağımlı resmî metrik NULL/blocked veya partial coverage olur. `volume_tracked=false` yalnız açık katalog/kullanıcı kararıyla verilir.
- Aile üyeliği, canonical stok varyantı, ikmal varyantı ve litre katsayısı geçerlilik tarihli ve kanıt bağlantılıdır. Düzeltme overwrite etmez; yeni sürüm ve downstream restatement adayı üretir.
- Mevcut `productUtils.ts` ile `selloutParser.ts` sabit tabloları v2 kaynağı değildir. `154558/154559` için yanlış `150003` eşlemesi ve iki tablonun kendi arasındaki fark yeni modele taşınmaz.
- Paket 03 `PRD-001..007` ve `PRD-013..016`yı uygular; aktif stok, stok günü, Sellout, KA, FKNS, hedef ve sipariş sonuçlarını önceden üretmez. Server-side `product_catalog_v2` flag'i varsayılan kapalıdır; UI cutover Paket 15'tedir.
- Paket 03'ün AI alt teslimatı canlı model çağrısı değil ortak semantic descriptor'dır. AI ürün ailesi–varyant ayrımını, as-of sürümünü, kanıt/coverage'ı açıklayabilir; ürün adından aile veya litre uyduramaz.

## Paket 03A Malzemeler / Anlık Stok — kesin teknik karar

- `CURRENT_STOCK_AVAILABLE` yalnız exact `Malzeme numarası + Malzeme tanımı + Tahditsiz kullanılabilir` başlık imzasıyla tanınan, tek varsayılan depo kapsamlı `FULL_REPLACE` kaynağıdır. Dosya adı ve metadata iş tarihi değildir; `as_of_at` doğrulanmış sunucu yükleme zamanıdır.
- Yeni dosya staging'de bütünüyle doğrulanır. Başarılı yayın önceki aktif domain kümesinin tamamını tek transaction'da değiştirir; hata/rollback eski aktifi ve eski `as_of_at` değerini korur. Aynı kodun farklı miktarlı tekrarları toplanmaz ve yayını bloklar.
- Önceki stok değerlerinden günlük geçmiş, trend, stok farkı veya tüketim üretilmez. Paket 01'in yetkili teknik import kanıtı iş stok geçmişi değildir ve rapor/AI/current-stock API'sine açılamaz.
- `Tahditsiz kullanılabilir` negatif olamaz; kesin decimal sıfır geçerlidir. Boş dosya sıfır stok sayılmaz. Bilinmeyen fakat kesin ürün kodu ham miktarla unresolved varyant olarak kalabilir; fuzzy eşleştirme yapılmaz.
- Varyant miktarı kaynak haliyle ve kendi UOM'uyla korunur. Varyant litresi `miktar × geçerli LPU`; farklı paketler yalnız litre üzerinden ailede birleşir. 6'lı/12'li varyant kartları ayrı kalır.
- Pozitif stoklu bir varyantta aile veya LPU eksikse bilinen litre ara toplamı gösterilebilir fakat resmî aile/şirket litre toplamı `NULL/PARTIAL`dır; eksik bölüm sıfır sayılmaz. Sıfır miktarlı eksik LPU toplamı bozmaz fakat kod coverage istisnasıdır.
- Canonical koli eşdeğeri kesin decimal korunur ve yalnız görselde `ROUND_HALF_UP` tam koliye yuvarlanır. Bu değer stok günü/tükenme/güvenlik/sipariş hesabına geri beslenmez.
- Varsayılan freshness `FRESH <24 saat`, `WARNING 24–<48 saat`, `STALE ≥48 saat`tir. Bayatlık miktarı düşürmez; her cevap aktif zaman ve uyarı taşır. Başarısız yükleme freshness saatini yenilemez.
- Önceki aktife göre kod sayısında `%20+` veya karşılaştırılabilir bilinen litrede `%30+` mutlak fark sürümlü yayın önizleme uyarısıdır; blokaj veya kalıcı stok geçmişi değildir.
- React `Günlük Veri` alanında v2 bearer-auth kullanan ayrı yükleme kartı bulunur. Preview olmadan publish yapılamaz; current-stock IndexedDB/customerService'e yazılmaz ve genel Arşivi Temizle backend aktif stoğu silemez.
- Paket 03A `PRD-008..011`, `STK-001..006` ve `STK-015..018`i uygular. Stok günü, tahmin, hedef ve sipariş Paket 06; canlı AI aracı Paket 14; cutover Paket 15 kapsamındadır. `current_stock_v2` flag varsayılan kapalıdır.

## Paket 04 Sellout olayları ve aylık performans — kesin teknik karar

- `SELLOUT_TRADITIONAL` için zorunlu roller `Satış Belgesi, Müşteri No, Malzeme Kodu, Miktar, Litre, Faturalama Tarihi`dir. Dönem yalnız Faturalama Tarihidir; sipariş/teslim/girilen faturalama veya yükleme zamanı fallback değildir.
- Kaynak litre gerçekleşen hacmin resmi değeridir; LPU×miktarla overwrite edilmez. Paket 03 katsayısı yalnız doğrulama/evidence içindir. 6'lı/12'li varyant satırları hamda ayrı, aile raporunda litreyle birleşiktir.
- Sellout Net/Brüt/iskonto TL ve kanal/temsilci alanları raw-only'dir. Para KPI'ı üretmez; kanal ve sorumluluk yalnız temporal Master'dan gelir. Muhasebeleşme/aktarılma durumu performans filtresi değildir.
- Çakışan aylık/yıllık yüklemeler kör append değildir. Kanonik satır signature'ı ve batch içi occurrence çokluğu multiset olarak uzlaştırılır; aynı faturadaki iki özdeş gerçek satır korunur, aynı/örtüşen dosya bunları ikinci kez çoğaltmaz. Satır sırası/rastgele ID kimlik değildir.
- Belge v1 doğal anahtarı `müşteri+Satış Belgesi+Faturalama Tarihi`dir. Aynı belgedeki bütün ürün satırları korunur; aynı aile varyantları belge×aile düzeyinde litreyle toplanır. Böylece tek müşteri/tek faturadaki toplu satış belge/aile/satır katkısıyla ayırt edilir.
- Pozitif satış, explicit ürün iadesi, kesin bağlanmış iptal tersi, teknik hareket ve sınıflandırılamayan negatif ayrıdır. İşaret/kod öneki tek başına iade/iptal değildir. Bilinmeyen negatif nete otomatik yazılmaz; `PARTIAL_CLASSIFICATION` ve etki litresiyle raporlanır.
- Brüt litre pozitif satış; iade litre explicit iadelerin mutlak toplamı; ters etki yalnız kesin iptal çiftleri; net litre `brüt−iade−ters`tir. Negatif Sellout fiziksel stok, cari veya finansal iade/tahsilat oluşturmaz.
- Yalnız olay kesiminde ACTIVE müşteri Sellout performansına girer. Pasif/iptal müşterinin finansal `≥100 TL` istisnası Sellout'a uygulanmaz. İlk tarihçeli Master öncesinde current Master yalnız açık `INITIAL_MASTER_PROXY` ve partial provenance ile kullanılabilir; sonraki Master değişiklikleri geriye yayılmaz.
- Aktif ama kanal/rep/SSM çözümü eksik litre şirket mutabakatında kalır; Açık/Kapalıya veya başka kişiye tahminle yazılmaz. Gerçekleşme olay tarihindeki rep/SSM'ye bağlanır.
- Resmi hedef girişi yalnız temsilci×ay×Açık/Kapalı exact litresidir ve versioned/auditlidir. Hedef sürümü ayın `owner_ssm_assignment_id` bağlantısını sabitler; sonraki hiyerarşi değişikliği hedefi sessiz taşımaz. SSM/şirket hedefi temsilci hedeflerinin toplamından türetilir; ayrı manuel üst hedef tutulmaz. Eksik hedef 0 değildir; hedef 0/eksikte attainment NULL, hedef üstü sonuç `%100`de kırpılmaz.
- Kapsam manifesti doğrulanmadan boş gün sıfır değildir. Onaylı kapsam içindeki satışsız gün 0, eksik gün NULL'dır. Bu ayrım aylık performans ve sonraki tahmin/stok günü paketlerine aynı coverage olarak aktarılır.
- Sellout raporunun ana dönem seçimi yalnız `yıl + takvim ayı`dır. Yayımlanmış Sellout olaylarının bulunduğu bütün aylar kronolojik bir filtre kataloğunda `2025 Ocak`, `2025 Şubat`, `2025 Mart` biçiminde ayrı seçenekler olarak görünür; ay numarası yıl olmadan gösterilmez. Kullanıcı tek seferde bir ay seçer, sonuç o ayın `Faturalama Tarihi` aralığından gelir.
- `3/6/12 ay` Sellout raporu filtresi veya Sellout gerçekleşme toplama kuralı değildir. Bu pencereler yalnız müşteri finansal analizindeki fatura kapama/tahsilat günü, aylık toplam fatura, aylık toplam tahsilat ve tahsilat/fatura oranı sözleşmelerine aittir. Sellout ekranı bu finansal pencereleri taklit etmez.
- Paket 04 `EVT-001/001A/003..009`, `ACT-001..013`, `TGT-001..004/007..008`i uygular. FKNS 05, tahmin/stok 06, finansal ciro 07/10, ST Tahsilat/Litre 04A, canlı AI 14 ve UI cutover 15 kapsamındadır. `sellout_events_v2` varsayılan kapalıdır.

## Paket 04A ST Tahsilat/Litre — kesin teknik karar

- Metrik yalnız Europe/Istanbul yerel takviminde çalışır. Ay sonu olmayan pazar Sellout'u yalnız bu metrikte pazartesiye taşınır; normal pazartesi paydası pazar+pazartesi Sellout net litresi, payı cumartesi+pazar kanonik operasyonel tahsilat sinyalidir. Pazar ay sonuysa kendi gününde cumartesiyi, izleyen pazartesi yalnız pazarı kullanır.
- Aynı gün, en yakın dolu gün, tatil/iş günü veya dosya varlığı fallback'i yoktur. Ham Faturalama Tarihi normal Sellout, aylık hedef ve FKNS için değişmez; ST etkin günü sürümlü türetilmiş alandır.
- Payda yalnız Paket 04'ün uygun ACTIVE müşteri net litresidir: pozitif satış−explicit iade−kesin iptal tersi. Kümülatif litre, hedef, stok, brüt fallback ve mutlak değer kullanılamaz. Net litre `≤0` ise oran null olur.
- Pay yalnız `Müşteri Tahsilat` içindeki Nakit, Kredi Kartı/POS, Banka Havalesi ve Sanal Pos kanonik operasyon sinyalidir. Çek, Senet, IADE/HIZMET, devir, virman, ters/iptal ve tanımsız türler dışlanır; dışlanan tutar ve neden görünürdür.
- Kaynak önceliği `resmî olay > eşleştiği TEMP_ACTIVE Belgeler`dir; aynı ekonomik olay en fazla bir kez sayılır. Doğrudan resmî olay kendi onaylı tarihini kullanır. Belgeler'i devralan resmî olayda belge+müşteri+tutar+tarih kesin ortaklığı aranır; kontrollü pencereyle bulunup tarihi farklı aday ST gününe sessiz taşınmaz ve kullanıcı incelemesine gider.
- `Aktarıldı/Aktarılmadı` metni ST uygunluğunu belirlemez. Resmî iptal, kaybolan geçici sinyal veya kullanıcı mutabakat kararı yeni calculation run üretir; eski sonuç overwrite edilmez.
- Sellout ve tahsilat bileşeni kendi olay günündeki temporal temsilci/SSM'ye yazılır. Temsilci değişimi iki farklı günün kaynağını zorla tek kişiye taşımaz. SSM/şirket oranı alt oranların ortalaması değil `ΣTL/Σlitre`dir; unresolved sorumluluk şirket reconciliation'ında kalır.
- Ürün/aile/kanal litre kırılımı sunulabilir; operasyon tutarı ürün veya kanala keyfî dağıtılmaz ve ürün/kanal bazlı resmî ST TL/L oluşturulmaz.
- Coverage her Sellout ve tahsilat kaynak günü için `COMPLETE_ZERO/COMPLETE_OBSERVED/PARTIAL/MISSING`dır. Zorunlu tek bir gün eksikse resmi günlük ve dönem oranı null/partial olur; bilinen bileşenler yalnız `observed_only` etiketiyle gösterilebilir. Satır yokluğu tek başına sıfır değildir.
- Dönem sonucu günlük oran ortalaması değil, etkin gün çiftlerindeki benzersiz kanonik operasyon tutarlarının toplamının benzersiz net litre toplamına bölümüdür. Her Sellout line ve tahsilat olayı yalnız bir day pair'e katkı verir; ihlal yayını bloklar.
- Bu metrik operasyonel saha göstergesidir; fiyat, ciro, resmî tahsilat performansı, müşterinin litre başına ödediği tutar, FIFO veya fatura kapama oranı değildir. API ve AI descriptor bu semantik sınırı zorunlu taşır.
- Paket 04A `STL-001..011`i uygular; `stl_metrics_v2` varsayılan kapalıdır. Paket 01A/08/08A'nın kanonik operasyon görünümünü kopyalamaz, versioned sonuçlarını okur. Canlı AI Paket 14, UI cutover Paket 15 kapsamındadır.

## Yerel geliştirme ve test ortamı — kesin teknik karar

- Yeni PostgreSQL/Supabase yapısı production servisine bağlanmadan lokalde uçtan uca kullanılabilir olacaktır. Önerilen varsayılan `Supabase CLI + Docker`; eşdeğer migration/PostgreSQL özellikleri sağlanırsa belgelenmiş native PostgreSQL alternatifi desteklenebilir.
- Yerel React, Express, PostgreSQL/Auth/Storage/RLS, migration, anonim seed, health-check, test, feature flag, PDF/XLSX üretimi ve reset akışı tek runbook ile çalıştırılacaktır. Gerçek Excel dosyaları kullanıcı bilgisayarından yalnız yerel veritabanına yüklenebilir.
- Gemini/AI yerelde backend `.env` anahtarlarıyla veya deterministik mock sağlayıcıyla sınanabilir. Anahtarlar tarayıcı bundle'ına, Git'e, seed'e, log'a veya test çıktısına girmez.
- `local`, `preview` ve `production` project ref/URL/key/veritabanları kesin ayrıdır. Yerel komut yanlışlıkla remote veritabanını resetleyemez veya gerçek veriyi seed olarak dışa aktaramaz.
- Her domain paketinin kabulü yerel migration→anonim seed→hesap/API→RLS→rollback/reset yolunu doğrular. Gerçek müşteri/ürün/belge satırları committed fixture değildir.

## Paket 05 FKNS motoru — kesin teknik karar

- FKNS aylıktır. Tamamlanmış ay ay sonu, cari ay Europe/Istanbul as-of kesimindeki tek müşteri portföyünü kullanır; pay ve payda aynı kesim durumu/kanal/rep/SSM kümesine bağlanır. Ay içi rep değişiminde müşteri kesim sahibine bir kez yazılır.
- Genel fatura FKNS'nin payı Paket 04'te ay içinde en az bir geçerli pozitif Sellout document event'i bulunan uygun aktif benzersiz müşteridir; payda satıştan bağımsız uygun aktif müşteri evrenidir. Sellout TL kullanılmaz, Paket 07 finansal fatura ileride yalnız mutabakat kanıtıdır.
- Yalnız ACTIVE ve doğrulanmış geleneksel uygun müşteri paydadadır. Pasif/iptal müşterinin `≥100 TL` finansal istisnası uygulanmaz. OPEN/CLOSED yalnız temporal Master'dan gelir; Sellout kanalı, KARMA/unknown→Açık ve satış çoğunluğu fallback'i yasaktır.
- Genel fatura payında aynı ayın birden çok belgesi müşteriyi çoğaltmaz. Yalnız iade/teknik/unknown negatif pay oluşturmaz; kesin iptal belgeyi kaldırır, gerçek ürün iadesi geçmiş pozitif faturalama noktasını geriye dönük silmez.
- Resmi ürün FKNS tarihçeli `ürün ailesi×kanal` eligibility kuralı gerektirir. Uygunluk ürün adı, kod öneki veya satışların `%5` kanal payından türetilmez. Kural eksikse resmi/hedef FKNS null; ham ürün penetrasyonu ayrı ve açık etikettedir.
- Paket varyantları ailede birleşir. Tek aile payı, aileye uygun olup en az bir varyantta pozitif satış alan müşterilerin benzersiz kümesidir. Kod/varyant kırılımı yalnız drill-down'dır.
- Çoklu ürün varsayılanı OR'dur: pay `müşteri aileye uygun AND aileyi aldı` kümelerinin, payda seçili aile uygunluk kümelerinin birleşimidir. Aynı müşteri kaç ürün/varyant alırsa alsın bir kez sayılır. Bir aile eligibility'si eksikse bütün resmi seçim partial/null olur; aile sessizce atılmaz.
- `Net elde tutulan nokta`, müşteri×ay×aile net litresi `>0` olanların OR kümesidir; pozitif-alım FKNS'nin yerine geçmez, tam iade etkisini ayrıca gösterir.
- SSM/şirket sonucu alt yüzdelerin ortalaması değil benzersiz müşteri pay/payda kümelerinden yeniden hesaplanır. Unresolved rep/SSM şirket reconciliation'ında kalır, başka kişiye tahminle yazılmaz.
- İkincil FKNS hedefi rep×ay×genel-kanal veya tek ürün ailesi için exact `%0..100` sürümlü orandır. Gerekli tam müşteri `ceil(payda×hedef/100)`dır. Üst hedef oranı target-equivalent noktalarla ağırlıklı türetilir; eksik hedef 0 değildir ve geçici çoklu OR seçimine aile hedefleri toplanmaz.
- Eksik Master/Sellout/ürün/eligibility coverage resmi oranı null/partial yapar. Eksik dönemde observed buyer alt sınırı gösterilebilir fakat müşteri “almadı” diye etiketlenmez. Non-buyer yalnız tam coverage altında tanımlıdır.
- Paket 05 `FKNS-001..017`yi uygular; `fkns_engine_v2` varsayılan kapalıdır. Mevcut frontend FKNS fonksiyonları ve AI araçları Paket 15 cutover'ına kadar değişmez. Canlı AI Paket 14 kapsamındadır.

## Paket 06 KA talebi, stok günü ve sipariş motoru — kesin teknik karar

- Paket 06, Paket 04 geleneksel Sellout talebi ile ayrı `KA_DELIVERY_DEMAND` kaynağını ürün ailesi×kanal×gün seviyesinde ayrı modeller; yalnız ortak aile fiziksel stok tüketim yolunda toplar. Geleneksel tarih `Faturalama Tarihi`, KA tarih yalnız satırdaki `Yükleme Tarihi`dir.
- KA dosya imzası en az bayi, sipariş veren müşteri, ürün, Yükleme Tarihi, İrsaliye No, litre ve miktardır. Satış belgesi/Efes sipariş numarası belge mutabakatında kullanılır. KA yönetici/müdür alanları Master temsilci/SSM yerine geçmez; İrsaliye Net Tutarı talep, stok, fiyat veya finans hesabına girmez.
- KA tarihçesi aktif snapshot değildir; örtüşen yüklemeler multiset reconcile ve immutable revision ile tekilleştirilir. Kaynak exact litre gerçekleşendir; Paket 03 LPU yalnız doğrulama kanıtıdır. Kapsamı doğrulanmış satışsız gün `0`, eksik gün `NULL`dır.
- `İrsaliye Listesi (2).xlsx` yerel regresyon kontrolü `1.587 satır, 115 belge, 38 müşteri, 41 ürün, 24 gün, 78.635,96 L, 7.793 miktar, doğal anahtar tekrarı 0` toplamlarını doğrular. `151428` küçük LPU oran farkı kaynak yuvarlaması olarak tolerans/evidence incelemesine gider; satır silinmez veya kaynak litre overwrite edilmez.
- Tahmin serisi tam takvim günlerinden kurulur; sıfır günleri atarak satışlı gün ortalaması alınmaz. Rolling-origin geri test mevsimsel naif, yakın dönem/hafta-günü ve aralıklı talep modellerini karşılaştırır; seçim WAPE+bias yanında stockout/fazla stok etkisini kullanır. En fazla sağlanan bir yıllık geçmişten aday pencere seçilir, sabit altı ay zorunlu değildir.
- Gelecek tahmin negatif olamaz. İade/ters talebi netleştirir fakat gerçek stoğu artırmaz ve negatif gelecekte inbound gibi projekte edilmez. Bilinmeyen kampanya/tatil için sabit 2026 takvimi veya çarpan uydurulmaz.
- `hedef bazlı kalan`, `dinamik kalan` ve `etkin kalan=max(hedef,dinamik)` ayrı saklanır. Ani hız hedefi aşarsa gerekli litre yükselir; hedef dinamik yolu düşüremez ve gerçekleşmiş satış yeniden sipariş ihtiyacına eklenmez.
- Tek müşteri/tek faturadaki toplu satış gerçekleşen ve hedef performansında tam kalır. Yalnız geleceğe devam güveni; benzersiz gün/belge/müşteri yayılımı ve normal belge dağılımına göre düşebilir. KA devam güveninde FKNS değil yükleme günü, irsaliye/sipariş ve müşteri tekrarı kullanılır.
- Cari ay hedef açığı yalnız o ayın kalan günlerine dağıtılır. Stok günü sonraki aya geçtiğinde aynı açık tekrarlanmaz; sonraki ay hedefi varsa kendi sürümü, yoksa seçilmiş taban günlük yol kullanılır.
- Fiziksel stok yalnız son aktif Malzemeler `Tahditsiz kullanılabilir` kümesidir. Sellout, KA, alış, iade, transfer, Ticari Stok, inbound, rezerve veya backorder bunu değiştiremez. Bayat snapshot tahminle bugüne düşürülmez; aynı son miktar yükleme yaşı/bayatlık uyarısıyla kalır.
- Anlık stok görünümünde 6'lı/12'li/ana varyantlar ayrı miktar+litre gösterilir. Stok günü ailede exact litreyle birleşir; canonical koli eşdeğeri exact saklanır, yalnız ekranda `round` edilir. Pozitif stoklu eksik aile/LPU resmî toplam, stok günü ve siparişi partial/null yapar.
- Günlük projeksiyon sorgu kesimindeki son bilinen stoktan ileriye gider; tahmin gerçek snapshot diye sunulmaz. Gün içi kalan gün oranı ile EOD başlangıç politikası sürümlüdür. İlk `≤0` geçiş tam+kesirli stok günü verir; varsayılan 365 günlük ufukta tükenmeme `>365/NOT_WITHIN_HORIZON`dır, kesin 365/400 değildir.
- Koruma süresi, servis quantile'ı, SS yöntemi, planlama ufku ve aile istisnaları tarihçeli policy'dir; kaynaktan uydurulmaz. Ana SS rolling-origin H-günlük kümülatif tahmin hatasının yukarı quantile'ıdır; geri düşme doğrulanmış grup→tampon gün→manuel. Geçerli politika yoksa SS sıfır değil NULL, açık DISABLED politika yalnız sıfırdır.
- Fiziksel stok günü, SS eşiğine gün ve `koruma talebi+SS` kritik eşiğine gün ayrıdır. Planlama ufku koruma süresini kapsıyorsa koruma talebi ihtiyaçta ikinci kez sayılmaz.
- `brüt ihtiyaç=planlama ufku etkin talebi+SS+onaylı ek koruma`, `net sipariş L=max(0,brüt ihtiyaç−stok)`tır. Dinamik-only/SS-excluded ihtiyaç yalnız açık ara sonuçtur. Paket miktarı sürümlü ikmal varyantı LPU'suna `ceil` edilir; ikmal varyantı yoksa litre kalır, miktar null. MOQ/inbound kaynağı yokken sıfır varsayılmaz.
- Paket 06 backend/domain paketidir; `stock_planning_v2` varsayılan kapalıdır. Referans `09-stok-gun.js`, mevcut frontend ve AI davranışı Paket 15/14 cutover'ına kadar değişmez. Paket 06A Ticari Stok bu motorun girdisi değildir.

## Paket 06A Ticari Stok yükleme ve rapor modülü — kesin teknik karar

- Ticari Stok, müşteride/noktada kalan ticari veya emanet ürünün son geçerli mevcut-durum kaynağıdır. Bayi `WAREHOUSE_CURRENT` stoğundan tamamen ayrıdır; stok günü, güvenlik stoğu, tükenme, sipariş, Sellout, FKNS ve finansal hesapların girdisi olamaz.
- `Ürünler.xlsx` için doğrulanan contract `SAPUI5 dışa aktarımı!A1:W5870` ve 23 sütundur. Zorunlu kimlik/ölçü imzası `Satış Organizasyonu + Belge Numarası + Müşteri No + Malzeme Kodu + Depoda Kalan Mk. + Depoda Kalan Lt.`dir. Serbest fuzzy başlık eşleme yapılmaz.
- Ticari stok kesimi dosyadaki `Yaratma Tarihi` değildir. Bu alan yalnız belge provenance'ıdır; aktif kümenin `as_of_at` değeri başarılı yayının Europe/Istanbul zamanıdır.
- Kullanılacak tek sayısal ölçüler kaynak exact `Depoda Kalan Mk.` ve `Depoda Kalan Lt.`dir. `Sevk Edilmiş Mik./Lt.` ile `Toplam Mik./Lt.` normalize modele, rapora, export'a ve AI aracına alınmaz; bunlardan oran veya hareket uydurulmaz.
- Ana toplama ölçüsü litredir. Miktar yalnız aynı malzeme/varyantta toplanabilir; farklı ürün miktarları şirket, SSM, temsilci veya müşteri için genel koli toplamı olamaz. Ürün ailesi yalnız exact kaynak litreleri toplar; Paket 03 LPU kaynak litreyi overwrite etmez.
- İki ölçüsü pozitif satır aktiftir; ikisi sıfır satır aktif rapordan çıkar. Negatif, tek taraflı pozitif/işaret çelişkisi, exact çözülemeyen kimlik ve `bayi+belge+müşteri+malzeme` doğal anahtar tekrarı publish'i bloklar. Exact tekrar dahi sessiz toplanmaz veya düşürülmez.
- Yeni geçerli dosya önceki aktif ticari stok kümesinin tamamını tek transaction'da değiştirir. Hatalı yayın eski aktifi ve kesim zamanını korur; concurrent publish optimistic active id ile tek kazanan üretir. Önceki raw import denetim amacıyla saklansa da rapor/AI geçmiş stok trendine açılamaz.
- Kullanıcı tarafından değiştirilmiş doğal anahtar yeniden yüklenirse üçlü karşılaştırma `önceki kaynak → kullanıcı etkin değeri → yeni kaynak` çalışır. Kaynak değişmediyse manuel karar korunur; değiştiyse `REUPLOAD_CONFLICT` kullanıcı onayına gider.
- Resmî müşteri durumu, kanal, segment, temsilci ve SSM temporal Master'dan gelir. Dosya temsilcisi/ad/hiyerarşi provenance ve DQ kanıtıdır; resmî sorumluluğu değiştirmez. Pasif/iptal müşterideki her pozitif ticari stok görünür; finansal `100 TL` eşiği uygulanmaz.
- Şirket, müşteri, ürün/aile, temsilci, SSM, kanal, segment, durum, yoğunlaşma ve istisna read model'leri aynı aktif import ve calculation run'a bağlanır. Top-N payı ve HHI yalnız yoğunlaşma sinyalidir; neden, tüketim veya finansal risk kanıtı değildir.
- Gerçek kaynak regresyonu `5.869 kaynak satırı, 426 pozitif satır, 103 belge, 81 müşteri, 38 ürün, 8 dosya temsilcisi, 12.800 kalan miktar, 151.185,59 L kalan litre, doğal anahtar tekrarı 0` değerlerini exact doğrular. Genel `12.800` yalnız parser kontrol toplamıdır, şirket koli KPI'ı değildir.
- Paket `CST-001..013`ü uygular. `commercial_stock_v2` varsayılan kapalıdır; canlı AI Paket 14, genel cutover Paket 15 kapsamındadır. Paket 03A/06 fiziksel stok motoru bu kaynağı okuyamaz.

## Paket 07 Satış faturası ve aktif iptal motoru — kesin teknik karar

- Satış faturası kaynağı `Tip, Fatura Durum, Fatura No, EDOCUMENTNO, Sipariş Numarası, Cari Kodu, Cari Kodu 2, Fatura Tarihi, Satış Tutarı` exact rollerinden tanınır. Serbest fuzzy başlık veya müşteri adı eşlemesi yapılmaz.
- Geçerli aday `Tip=SATIS`, birebir `500...` müşteri, `CREATED|CANCELLED` durum, dolu fatura kimliği, geçerli Fatura Tarihi ve pozitif exact vergi dâhil Satış Tutarı taşır. Dönem yalnız Fatura Tarihidir.
- `Durum=Aktarıldı/Aktarılamadı/Aktarılamadı (Cari)` entegrasyon provenance'ıdır ve finansal sonucu değiştirmez. Örnekteki üç aktarılamayan satırın `51.755,67 TL` tutarı yalnız bu alan nedeniyle dışlanmaz.
- `Satış Tutarı` vergi dâhil fatura yüz değeridir. `Vergi Toplamı` ikinci kez eklenmez. Sellout TL, IADE, HIZMET, tedarikçi SATIN ALMA, devir ve virman finansal ciroya girmez.
- Kaynak kayıt anahtarı `tek bayi + Tip + Fatura No`dur. Aynı içerik idempotent, aynı anahtarda değişen müşteri/tarih/tutar/durum/e-belge/sipariş immutable revision conflict'tir. Örtüşen veya kısmi yeni dosyada görünmeyen eski fatura silinmez; kaynak tarihsel olaydır, full-replace snapshot değildir.
- İptal kontrolü her yüklemede yeni ve bütün geçmiş event'ler üzerinde çalışır. Öncelik aynı `EDOCUMENTNO + müşteri`; exact tutar/para birimi/tip zorunlu, sipariş iki tarafta doluysa eşit, CANCELLED tarihi CREATED'dan önce değil olmalıdır. Fatura No'ların farklı olması geçerlidir.
- EDOCUMENTNO yoksa yalnız benzersiz `müşteri + sipariş + exact tutar + para birimi + tip + karşıt durum` çifti kontrollü fallback'tir. Fatura No, müşteri+tutar+tarih veya ad benzerliği tek başına otomatik iptal kuramaz.
- Eşleme bire birdir. Eşleşmeyen CANCELLED, çoklu aday, tutar/para birimi/sipariş/chronology çatışması batch'i review/validation_failed durumunda tutar; sistem keyfî orijinal seçmez veya iptali yok sayarak publish etmez.
- Güvenli CREATED ve CANCELLED aynı cancellation group'a bağlanır ve ikisi birlikte ciro, normal fatura listesi, ekstre, dashboard, export ve AI normal dökümünden çıkar. CANCELLED yeni negatif satış veya tahsilat değildir.
- Sonradan gelen iptal güncel/restated görünümde orijinal Fatura Tarihi dönemini düzeltir. Önceden yayımlanmış calculation run overwrite edilmez; knowledge cutoff ile eski bilinen sonuç ve bugünkü düzeltilmiş sonuç ayrılır.
- Paket 07 yalnız fatura geçerliliği ve vergi dâhil ciro üretir. Açık/kısmi/ödendi durumu, FIFO, aging, kapama günü ve Fatura Kontrol alarmı sırasıyla Paket 10/10A'dan gelir; Paket 07 bunları tahmin etmez.
- Fatura geçerliliği müşteri ACTIVE olmasına bağlı değildir. Pasif/iptal müşteri faturası finansal olayda kalır; `≥100 TL` portföy/temsilci katılım eşiği sonraki kesim bakiyesi motorunda uygulanır, fatura silme filtresi değildir.
- Gerçek kaynak regresyonu `4.423 kaynak, 3.922 adet 500'lü SATIS, 3.916 CREATED, 6 CANCELLED`; altı iptal çifti farklı Fatura No fakat aynı EDOCUMENTNO+sipariş+müşteri+tutar ile birebir eşleşir. Normal geçerli CREATED sonucu `3.910`dur.
- Paket `FIN-000`, `FIN-001`, `FIN-001A..001D` ve `FIN-002`yi uygular. `sales_invoice_v2` varsayılan kapalıdır; canlı AI Paket 14, genel cutover Paket 15 kapsamındadır.

## Paket 07A Sipariş/teslimat belge omurgası — kesin teknik karar

- Kaynak `SALES_ORDER_DISPATCH_SNAPSHOT`, contract `sales-order.dispatch-snapshot.v1`dir. Exact zorunlu roller `Satış Belge Türü Tnm., Müşteri No, Satış Belgesi Tarihi, İstenilen Tsl. Trh., Fatura No, Red Statüsü Tnm., Yükleme numarası, Sipariş Toplam Tutar, Teslimat Durumu, Satış Belge No`dur; fuzzy başlık/dosya adı eşlemesi yoktur.
- Müşteri yalnız exact `Müşteri No` içindeki `500...` kodudur. Ad, dosya temsilcisi ve Fatura Alıcısı resmî müşteri/sorumluluk fallback'i değildir. Farklı 500'lü Fatura Alıcısı `BILL_TO_CUSTOMER_CONFLICT` incelemesidir; resmî müşteriyi otomatik değiştirmez.
- Belge doğal anahtarı `tek bayi + normalized Satış Belge No`dur. Kaynak kimliği raw metin olarak korunur; yalnız rakamsal güvenli kimliklerde baştaki sıfır karşılaştırma için normalize edilir. Boş, salt 0, hassasiyeti kayıp scientific notation gerçek kimlik değildir.
- Aynı belge çok satırda bulunabilir. Müşteri, satış/teslim tarihi, tür, exact toplam tutar ve dolu fatura referansı belge içinde tutarlı olmak zorundadır; çelişki `ORDER_DOCUMENT_FIELD_CONFLICT` ve publish blokajıdır.
- `Sipariş Toplam Tutar` bütün-belge tutarıdır ve `numeric(20,2)` ile belge seviyesinde yalnız bir kez alınır. Satır tutarlarını toplamak veya mixed durumda tutarı statülere/yükleme numaralarına bölmek yasaktır. Sipariş tutarı ciro, tahsilat, açık fatura veya bakiye değildir.
- Tür router'ı `Soğuk Satış&Depozito/Depo Satışı→SIPARIS`, `Sevki Ertelenecek Sp→EMANET_SP`, `Key Account Sipariş→KEY_ACCOUNT_EXCLUDED`, reklam→ayrı reklam, red/iptal→kapsam dışı sınıfını kullanır. Key Account satırı ham/audit ve kaynak kontrol toplamında kalır; görünür liste/özet ve tutara sıfır katkı verir. Bilinmeyen tür sessizce aktif olmaz.
- Tür ve teslimat durumu bağımsız eksenlerdir. `Sevki Ertelenecek Sp` türündeki belge, satır durumu `Teslim Edildi` ise `EMANET_SP+COMPLETED`; `Ertelendi` ise `EMANET_SP+DEFERRED`; her ikisi varsa `EMANET_SP+PARTIAL_OR_MIXED` gösterilir. Tür adındaki “ertelenecek” ifadesi tek başına durum üretmez.
- Teslim durumları `Yüklemeye Alınmadı→READY_OR_WAITING`, `Sevkiyatta→IN_TRANSIT`, `Teslim Edildi/Depodan Teslim→COMPLETED`, `Ertelendi→DEFERRED`, red/iptal→`REJECTED_OR_CANCELLED`dır. Belge sonucu bütün satırların benzersiz durum kümesidir; farklı sınıflar `PARTIAL_OR_MIXED`, son satır/çoğunluk yaklaşımı yasaktır.
- Yükleme numarası 0/boşsa gerçek referans değildir. Aynı belge altındaki birden fazla geçerli yükleme numarası tek değere zorlanmaz; kanıt kümesi olarak korunur ve kendi başına belge conflict'i değildir.
- Fatura bağlantısının iki güçlü anahtarı `sipariş.Fatura No↔satış.Fatura No` ve `sipariş.Satış Belge No↔satış.Sipariş Numarası`dır. İki anahtar aynı tek geçerli `SATIS+CREATED` faturayı, exact müşteri ve vergi dâhil tutarı doğrularsa `CONFIRMED_DUAL_KEY` olur.
- İki güçlü anahtar farklı hedef üretirse `INVOICE_ORDER_KEY_CONFLICT` ve otomatik link yoktur. Yalnız bir anahtar gerçekten mevcutsa benzersiz fatura+müşteri+tutarla `CONFIRMED_SINGLE_KEY` mümkündür; dolu fakat çelişkili ikinci anahtar varken fallback yasaktır.
- Müşteri+tutar+tarih ve ad yakınlığı yalnız manuel aday kanıtıdır; otomatik bağlantı değildir. Fatura tarihi bağ anahtarı değildir. İptal edilmiş/CANCELLED/geçersiz fatura link adayı olamaz.
- Siparişte Fatura No boşluğu “faturasız” hükmü üretmez. Dolu referansın satış kaynağında bulunmaması `ORDER_INVOICE_REFERENCE_NOT_IN_SALES_SOURCE`; eksik kaynak kapsamı `COVERAGE_INCOMPLETE`; çoklu aday `AMBIGUOUS` olarak ayrı taşınır.
- Manuel link ham kimlikleri değiştirmeyen sürümlü override'dır. Kaynak anahtarı/müşteri/tutar sonraki yüklemede değişirse karar otomatik taşınmaz, `PENDING_USER_APPROVAL` olur; değişmeyen kaynakta kullanıcı kararı korunur ve bildirilir.
- Sipariş kaynağı geçmiş hareket değil günlük tam snapshot'tır. Scope `tek bayi + açık reportDate`tir; reportDate yükleme zamanından tahmin edilmez ve `İstenilen Tsl. Trh.` kapsamıyla uyuşmalıdır. Aynı gün yeni başarılı tam yükleme eskisini atomik değiştirir; başarısız yükleme eski aktifi korur.
- Eski snapshot belge/durumları iş geçmişi, geçmiş-açık sevk veya AI trendi üretmez; yalnız teknik import audit'i kalabilir. Teslim/fatura kanıtının kalıcılığı Paket 07B'nin idempotent Fatura Kontrol handoff'uyla sağlanır.
- Gerçek `export (10).xlsx` regresyonu `126 satır/87 belge`, `4 çok satırlı belge`, `en çok 17 satır/belge` ve belge içi müşteri/tutar/tarih/tür/fatura conflict `0` sonuçlarını verir.
- Gerçek satır türleri `59 Soğuk Satış&Depozito, 58 Sevki Ertelenecek Sp, 8 Key Account Sipariş, 1 Depo Satışı`; durumlar `112 Teslim Edildi, 7 Yüklemeye Alınmadı, 3 Ertelendi, 2 Sevkiyatta, 1 Depodan Teslim, 1 Reddedildi`dir.
- Belge durum kümeleri `74 yalnız Teslim Edildi, 7 yalnız Yüklemeye Alınmadı, 2 yalnız Sevkiyatta, 1 Depodan Teslim, 1 Reddedildi, 2 Teslim Edildi+Ertelendi`dir. Son iki belge `PARTIAL_OR_MIXED` kalır.
- Tamamlanma kanıtı taşıyan 77 belgenin 73'ünde dolu, 4'ünde boş Fatura No vardır; iki mixed belge yalnız bu sayım nedeniyle tekil COMPLETED'a çevrilmez. Mevcut satış arşiviyle doğrulanmış 25 dual-key bağda müşteri/tutar/anahtar conflict ve ambiguity 0'dır.
- Paket 07A bugünkü operasyon sıralaması/ödeme bağlamını Paket 07B'ye; açık fatura, FIFO, aging ve risk yorumunu Paket 10/10A'ya bırakır. Canlı AI Paket 14, genel cutover Paket 15 kapsamındadır.
- Paket `ORDOP-001..004`, `ORDOP-006`, `ORDOP-008`, `ORDOP-014`, `ORDOP-021` ve ortak belge kimliği/link omurgasını uygular. `sales_order_backbone_v2` varsayılan kapalıdır.

## Paket 07B Bugünkü Sevkiyat Takip — kesin teknik karar

- Sevkiyat Takip yalnız sunucunun `Europe/Istanbul` bugünü ve Paket 07A'nın o güne ait son aktif tam snapshot'ını gösterir. İstemci tarihi, geçmiş gün seçimi, geçmiş sipariş listesi, gecikmiş açık sevk veya durum zinciri yoktur. Snapshot yok/eskimişse sonuç 0 değil açık coverage eksikliğidir.
- İki görünür sınıf vardır: `Depo Satışı/Soğuk Satış&Depozito→SIPARIS`, `Sevki Ertelenecek Sp→EMANET_SP`. `Key Account Sipariş→KEY_ACCOUNT_EXCLUDED`; ham/audit ve import kontrolünde kalır fakat liste, kart, adet, tutar ve handoff'a sıfır katkı verir.
- Tür ve operasyon durumu bağımsızdır. Emanet SP `COMPLETED/DEFERRED/IN_TRANSIT/MIXED_REVIEW` olabilir; tür adındaki “ertelenecek” tek başına durum değildir. Sipariş türü de gerçek `Ertelendi` durumuyla `DEFERRED` olabilir.
- Merkezi durum önceliği `BLOCKED_DATA > MIXED_REVIEW > ACTION_NOW > IN_TRANSIT > COMPLETED > DEFERRED > EXCLUDED`dır. Bu saha operasyon sırasıdır; finansal risk, ödeme veya sevke uygunluk onayı değildir. UI kendi status formülünü yazamaz.
- Sipariş ve Emanet SP ayrı sekme/sayaçtır; her birinde Aksiyon Bekleyen, Sevkiyatta, Karma/İnceleme, Tamamlanan, Ertelenen ve Veri Blokajı alt grupları bulunur. Bir belge yalnız bir görünüm sınıfına ve bir overall state'e katkı verir.
- Varsayılan listede aynı `customer_id + displayClass` altındaki farklı `Satış Belge No` değerleri tek müşteri satırında gösterilebilir. Satır `belge adedi + Σ document_amount_once` taşır; açıldığında belgeler kimlik, durum, tutar, fatura/yükleme bağı, istisna ve aksiyon bakımından ayrı kalır. Aynı müşteri Sipariş ve Emanet SP arasında tek grupta birleştirilmez.
- Müşteri toplamı önce her belge tutarını bir kez alır, sonra farklı belgeleri toplar. Tekrarlanan kaynak satırları toplamı büyütmez. Bir alt belgede tutar bilinmiyorsa müşteri grup coverage'ı `PARTIAL`; bilinen ara toplam eksiksiz toplam diye sunulmaz.
- Müşteri grubuna bütün belgeleri temsil eden sahte tek operasyon durumu verilmez. Durum adet/tutar dağılımı ve yalnız sıralama için en yüksek öncelikli `attentionState` gösterilir. Fatura linki, manuel işlem ve Fatura Kontrol handoff'u belge bazında kalır.
- Özetler benzersiz belge adedi ve `Σ document_amount_once` üretir. Durum alt toplamları görünür evrenle, Sipariş+Emanet SP toplamları genel görünür toplamla birebir mutabık olmalıdır. Key Account yalnız `excludedByType` kaynak kontrolünde görülebilir.
- Boş/0 tutar belgeyi adet listesinden çıkarmaz; `AMOUNT_NOT_PROVIDED` coverage ile TL toplamına sıfır katkı verir ve gerçek 0 TL sipariş diye yorumlanmaz. Negatif/non-numeric veya belge içi farklı dolu tutar `BLOCKED_DATA`dır.
- Belge kartı kimlik, temporal Master sorumluluk, görünüm sınıfı, tarihler, overall/status set, yükleme/fatura referansları, tekil tutar, ödeme bağlamı, istisna, izinli aksiyon ve provenance bloklarını aynı snapshot/run'dan taşır.
- Boş/0 yükleme numarası gerçek referans değildir. ACTION_NOW için bilgi; IN_TRANSIT/COMPLETED için `MISSING_LOAD_REFERENCE` incelemesidir ve operasyon durumunu geri almaz. Birden fazla geçerli yükleme no kanıt kümesidir.
- Fatura bağı yalnız Paket 07A sonucudur; ekran fuzzy/tarih join'i kurmaz. COMPLETED+boş Fatura No `DELIVERED_WITHOUT_INVOICE_REFERENCE`; dolu fakat satış kaynağında yoksa `ORDER_INVOICE_REFERENCE_NOT_IN_SALES_SOURCE`; conflict/ambiguity/coverage ayrı state'tir, “faturasız” diye sadeleştirilmez.
- Ödeme bağlamı yalnız `OPS-DOC-005` kanonik görünümüdür ve `TEMP_SIGNAL/OFFICIAL_CONTEXT/AMBIGUOUS/NONE/UNAVAILABLE_DEPENDENCY` etiketlerinden biridir. Resmî kayıt geçici Belgeler sinyalini devralır; aynı ekonomik olay iki kez gösterilmez/toplanmaz.
- Aynı müşterinin aynı gün birden fazla siparişi varsa ödeme tutarı siparişlere dağıtılmaz, `NOT_ALLOCATED_TO_ORDER` müşteri-gün bağlamıdır. Varsayılan müşteri grup başlığında bir kez gösterilir; alt belgeler aynı context id'ye referans verir. Siparişi olmayan ödeme müşterisi yeni sevkiyat kartı oluşturmaz.
- Sipariş tutarı eksi ödeme hesaplanmaz ve açık sipariş/ödendi/peşin/sevke uygun/kalan sonucu üretilmez. Finansal gerçek Paket 10/10A/Cari detayındadır.
- Her başarılı publish'te tamamlanan görünür Sipariş/Emanet SP belgeleri güvenli fatura bağı veya kodlu teslim-fatura istisnasıyla `invoice_delivery_handoff`a idempotent aktarılır. Completed kanıtlı mixed belge normal completed olmaz; mixed evidence ile incelemeye gider.
- Key Account, reklam, red/iptal, yalnız ACTION_NOW/IN_TRANSIT/DEFERRED belge handoff üretmez. Handoff kimliği belge+teslim kanıtı+link+override sürümüdür; retry çoğaltmaz, değişiklik yeni evidence/restatement üretir.
- Bugünkü manuel işlemler preview→commit ile `EDIT_OVERLAY, EXCLUDE_TODAY, SOFT_DELETE, RESTORE, RESOLVE_EXCEPTION, LINK_INVOICE_CANDIDATE`dır. Ham satır değişmez; stale preview/yetki/sürüm/idempotency yeniden doğrulanır. Finansal olay/FIFO/aging/araç durumu dispatch flag'iyle değiştirilemez.
- Aynı-gün yeniden yüklemede kaynak değişmediyse override korunur; değiştiyse `PENDING_USER_APPROVAL`. Yeni güne eski override taşınmaz. Kapsam dışı bırakma önceki handoff'u silmez, yeni kanıt sürümü üretir.
- API yalnız `/api/v2/dispatch/today...` ailesidir; tarih/geçmiş uçları `DISPATCH_HISTORY_NOT_SUPPORTED` döndürür. Cursor snapshot'a pinlidir; publish sonrası eski cursor `409 SNAPSHOT_CHANGED` alır.
- UI yalnız Sipariş ve Emanet SP sekmelerini gösterir; Key Account sekmesi/sayacı/filtresi yoktur. XLSX/PDF/görsel/API aynı bugünkü snapshot, filtre, belge/tutar ve coverage sonucunu kullanır ve Key Account exclusion notunu taşır.
- AI yalnız bugünü, görünüm sınıfı ve kanıtlı bağlamı yorumlar; Key Account'ı dahil etmez, Emanet SP'yi otomatik ertelenmiş saymaz, ödeme sinyalini tahsilat/finansal onay diye sunmaz ve geçmiş sevkiyat uydurmaz.
- Paket `ORDOP-005`, `ORDOP-007`, `ORDOP-009..013`, `ORDOP-017..020`, `ORDOP-022`yi uygular. `dispatch_today_v2` varsayılan kapalıdır. Çekirdek Paket 00–02/07/07A'ya; tam ödeme bağlamı ve paket kabulü 01A/08/08A'ya bağlıdır.

## Paket 08 Tahsilat ve kıymetli evrak motoru — kesin teknik karar

- Resmî kaynaklar yalnız immutable source kind ile `OFFICIAL_CASH/OFFICIAL_TRANSFER/OFFICIAL_CHECK/OFFICIAL_NOTE`dur. Dosya adı, Aktarıldı metni veya sonradan eşleşme source kind belirlemez. Belgeler bu paketin finansal kaynağı değildir.
- Ortak exact roller belge no, Fatura Tarihi, Cari Kodu/Cari Kodu 2, Tutar, İşlem/Belge Para Birimi ve Kayıt Tipidir. Nakit Kasa/Tahsilatçı; Havale Banka/Hesap/Açıklama; Çek Çek No/Çek Hesap No/Vade; Senet Senet No/Vade imzası taşır. Fuzzy parser yoktur.
- Müşteri yalnız exact 500 kodundan; tutar pozitif `numeric(20,2)` ve uyumlu para biriminden çözülür. Fatura Tarihi tahsilat/kabul işlem tarihidir; yükleme tarihi fallback değildir. Vade yalnız araç risk takvimidir.
- Aktarıldı/Aktarılamadı ve Havale `Durum=Aktif` entegrasyon provenance'ıdır, finansal geçerlilik filtresi değildir. İş geçerliliği source kind, customer, belge, tarih, tutar/currency, CREATED/CANCELLED ve aktif iptal kontrolünden gelir.
- Doğal anahtar `tek bayi + yöntem + belge no`dur. Aynı içerik idempotent; aynı anahtarda değişen ekonomik/detail içerik immutable source revision conflict'tir. Kaynak tarihsel event'tir, yeni dosyada yokluk silme değildir.
- Her yüklemede bütün geçmiş üzerinde aktif iptal kontrolü çalışır. Önce açık reversal reference; yoksa yöntem+müşteri+tutar/currency+tarih ve yöntem detayı. Tek benzersiz exact CREATED↔CANCELLED yoksa otomatik seçim yapılmaz ve publish review'da kalır.
- Güvenli iptal çiftinin ikisi de tahsilat, cari, araç riski, performans, normal liste/export/AI'dan çıkar. CANCELLED negatif tahsilat değildir; sonradan iptal yeni restated run üretir.
- Geçerli Nakit ve normal Havale kabul/işlem tarihinde müşteri carisini azaltacak ve tahsilat performansına girecek event üretir; araç riski açmaz.
- Geçerli Çek/Senet kabulü aynı anda eşit yüz değerli cari azaltıcı collection event ve ayrı portföy riski açar. Araç ödendiğinde cari/performance ikinci kez azalmaz. Vade geçişi tek başına paid/bounced üretmez.
- Havale–Çek otomatik kapama yalnız exact `Hesap No=Çek Hesap No + Tutar + currency`, geçerli CREATED olaylar, açık tek Çek ve doğru kronolojiyle çalışır. Hesap no tek başına yeterli değildir; çoklu aday kullanıcı incelemesidir. Müşteri eşitliği zorunlu kapama anahtarı değildir, açık kanıttır.
- Güvenli kapamada Çek PAID olur ve risk Havale tarihinde kapanır. Havale `CHECK_SETTLEMENT_TRANSFER` olarak cari/performance'a 0 ikinci etki verir; normal Havale, ekstre, dashboard/export ve AI'dan gizlenir, Çek detay/audit'te kalır.
- Havale/Çek sonradan iptal/geçersiz olursa settlement geri alınır; başka closure yoksa Çek riski yeniden açılır. Aynı çift ikinci settlement oluşturmaz.
- Senet `Belge No 180... + Fatura Tarihi=Vade Tarihi` v1 rule'uyla `NOTE_RETURN_BOUNCED_CANDIDATE` olur, normal kabul sayılmaz. Orijinal aday önce Senet No, sonra müşteri+tutar/currency kanıtıyla bulunur; tek adayda dahi ekonomik etki kullanıcı kararı bekler.
- Senet disposition seçenekleri borcu yeniden aç, tahsilat uygula, bakiye etkisiz riskte tut, ödendi işaretle, orijinal+iade çiftini geçersiz kıl, yalnız iadeyi dışla olarak tanımlıdır. Lifecycle, bakiye, performans, risk ve ekstre görünürlüğü ayrı boyutlardır; biri diğerini varsaymaz.
- Pending Senet adayı yeni bakiye/tahsilat/risk deltası üretmez; son onaylı orijinal durum kalır. Preview→commit version/capability/reason/idempotency ile çalışır; karar değişikliği/geri alma yeni sürüm ve calculation run'dır.
- Gelen tahsilatın en eski açık faturaya dağıtımı Paket 10 FIFO motorudur. Paket 08 yalnız resmî olay, etkin tarih ve araç lifecycle kanıtını üretir; açık/kapalı fatura veya aging tahmin etmez.
- Gerçek regresyon `3815 Nakit, 396 Havale, 25 Çek, 8 Senet = 4244`; record type `3812/3, 388/8, 24/1, 8/0 CREATED/CANCELLED`; belge no tekrarı ve non-500 müşteri 0'dır.
- Raw tutar kontrol toplamları iptal/settlement/disposition öncesi `97.083.073,37 Nakit; 19.834.738,52 Havale; 13.619.169,42 Çek; 1.981.395,91 Senet TL`dir.
- Gerçek Havale örneğinde 7 dolu Hesap No, 6 Çek hesap kümesi eşleşmesi ve 4 ortak hesap değeri vardır; exact hesap+tutar settlement 0'dır. Gerçek Senette iki 180... iade/karşılıksız adayı vardır.
- Paket `COLL-001..022`, `FIN-003`, `FIN-019..021` olay/risk çekirdeğini uygular. `official_collections_v2` varsayılan kapalıdır; 08A Belgeler takeover, 08B Senet/bono hazırlama-yazdırma, 09 IADE/HIZMET, 10 FIFO/aging ve 14 canlı AI ayrı paketlerdir.

## Paket 08A Resmî tahsilatın Belgeler katmanını devralması — kesin teknik karar

- Paket 08A finansal tahsilat üretmez. Paket 01A'nın immutable `BELGELER_TEMP` snapshot olayları ile Paket 08'in geçerli kanonik `OFFICIAL_CASH/OFFICIAL_TRANSFER/OFFICIAL_CHECK/OFFICIAL_NOTE` olayları arasında sürümlü mutabakat bağlantısı ve tek kanonik operasyon sinyali üretir.
- Ön koşullar Paket 00, 01, 01A, 02 ve 08'dir. Paket 07A/07B, 04A, 10/10A ve 14 downstream tüketicidir; 08A'nın teknik ön koşulu değildir. 08A kabulü downstream paketlerin ödeme bağlamı kapısını açar, onları erkenden uygulamaz.
- Belgeler parser/snapshot mantığı Paket 01A'dan, resmî tahsilat geçerliliği/iptal/araç lifecycle mantığı Paket 08'den aynen okunur; 08A bu kuralları kopyalamaz veya yeniden yorumlamaz. Mevcut `shipmentBelgelerParser`, `collectionParser`, `customerService` ve IndexedDB akışları yalnız karakterizasyon kaynağıdır, resmî kayıt değildir.
- Mutabakat evreni aynı bayi içindeki benzersiz geçerli Belgeler olayları ile `knowledge_cutoff_at` anına kadar yayımlanmış bütün geçmiş geçerli resmî tahsilat arşividir. Yalnız son dosya veya aynı yükleme günü aranmaz. İptal edilmiş, settlement nedeniyle gizlenmiş ya da Senet disposition ile geçersiz kılınmış resmî olay kanonik ödeme kanıtı olamaz.
- Ödeme tipi haritası `Kredi Kartı|Nakit→OFFICIAL_CASH`, `Banka havalesi→OFFICIAL_TRANSFER`, `Alınan Çek→OFFICIAL_CHECK`, `Alınan Senet→OFFICIAL_NOTE`dur. Bilinmeyen/boş tip otomatik aday üretmez. Kredi Kartı alt türü provenance olarak korunur; resmî Nakit olayının yöntem sınıfını değiştirmez.
- Normalize Belgeler doğal anahtarı `dealer_id + scope_date + normalized_document_no + occurrence`dır. Exact aynı satır tekrarları Paket 01A'da tekilleştirilir; aynı belge numarasında ekonomik alanları farklı iki satır sessizce birleşmez ve `TEMP_DOCUMENT_KEY_CONFLICT` olur. Belge, müşteri ve araç kimlikleri text kalır; baştaki sıfır keyfî eklenmez.
- Eşleştirme deterministik iki kademedir. Kademe 1 aynı normalize `Belge Numarası` ile aday bulur ve exact bayi, müşteri, `abs(Tutar)`, para birimi, ortak doğrulanmış işlem tarihi ve beklenen source kind alanlarının tamamını doğrular; Çek/Senette dolu araç numarası da exact olmak zorundadır. Tek sonuç `EXACT_DOCUMENT_KEY`dir.
- Belge numarası boş, güvenilmez veya resmî tarafta değişmişse Kademe 2 yalnız exact `dealer + customer + amount + currency + expected source kind` bileşiğini kontrollü tarih penceresinde arar. Tarih penceresi sürümlü parametredir; v1 varsayılanı `0 gün`dür. Sınırı keyfî genişletmek veya yakın tutar/ad/fuzzy tarih kullanmak yasaktır. Tek sonuç `UNIQUE_COMPOSITE` olabilir.
- Belge numarası adayının ekonomik doğrulama alanlarından biri çelişiyorsa Kademe 2'ye düşülmez; `DOCUMENT_KEY_FIELD_CONFLICT` oluşur. Sıfır aday `UNMATCHED`, birden çok aday `AMBIGUOUS_RECONCILIATION`, tarih çelişkisi `OPERATIONAL_DATE_CONFLICT`, bilinmeyen ödeme tipi `UNSUPPORTED_PAYMENT_TYPE` olur. Otomatik skor/eşik bu sonuçları kesin eşleşmeye çeviremez.
- Eşleşme iki kaynak olayını birleştirmez veya kimliğini değiştirmez. `temp_event_id ↔ official_collection_event_id`, yöntem, rule version, aday kanıtı, karar, calculation run, knowledge cutoff ve varsa kullanıcı karar sürümü immutable reconciliation link/revision zincirinde tutulur.
- Kanonik görünüm önceliği `valid official > TEMP_ACTIVE`dir. Kesin veya kullanıcı onaylı bağlantıda resmî olay aynı transaction/read-model publish sınırında geçici sinyali devralır; aynı ekonomik olay ekran, API, ST Tahsilat/Litre, Sevkiyat ödeme bağlamı, export ve AI descriptor sonucunda en fazla bir kez görünür. İki tabloyu `UNION ALL` ile toplamak yasaktır.
- Resmî olay sonradan iptal/geçersiz/restated olursa eski bağlantı overwrite edilmez. Yeni mutabakat run'ı bağlantıyı `OFFICIAL_INVALIDATED` yapar; hâlâ geçerli ve etkin bir `TEMP_ACTIVE` kaynak varsa kanonik sinyal ona geri düşebilir, yoksa sinyal kaldırılır ve açık istisna üretilir. Eski calculation run sonuçları knowledge cutoff ile değişmez.
- Aynı kapsamın ardışık tam Belgeler snapshot'ında kaybolan olay için önce bütün resmî arşiv mutabakatı çalışır. Eşleşirse `MATCHED_REPLACED`; eşleşmezse `REMOVED_BEFORE_TRANSFER` olur ve aktif sinyalden çıkar. Kısmi snapshot yokluk kanıtı değildir. Sonradan yeniden görünme eski revision'ı sessizce canlandırmaz; `REAPPEARED_AFTER_REMOVAL` review olayı üretir.
- `REMOVED_BEFORE_TRANSFER` tahsilat, nakit, avans, cari azaltma veya fatura kapama değildir. Geçici sinyal kullanılarak teslim/fatura handoff'u oluşmuşsa outbox üzerinden `PREPAYMENT_SIGNAL_DISAPPEARED`; resmî olay sonradan gelirse yeni run ile kapanış olayı yayımlanır.
- Batch paydası yalnız mutabakat kapsamındaki benzersiz geçerli Belgeler olaylarıdır. Parse hatası, dosya içi mükerrer, `TEMP_DOCUMENT_KEY_CONFLICT`, yetkili kapsam dışı ve desteklenmeyen kayıtlar paydaya sessizce girmez; her biri ayrı DQ sayımı ve tutarıyla raporlanır. Pay yalnız kesin otomatik veya etkin kullanıcı onaylı eşleşmelerdir; ambiguous/unmatched paya girmez. Payda 0 ise oran null'dır.
- `match_rate = 100 × matched_valid_unique / in_scope_valid_unique`. Oran tam `%80` ise `RECONCILED_WITH_EXCEPTIONS`, altındaysa `LOW_MATCH_REVIEW`dur. Bu eşik yalnız batch iş akışını belirler; satır eşleştirme şartını gevşetmez, eşleşmeyeni silmez ve `%80+` batch'i `tam mutabık` yapmaz.
- İstisna kuyruğu en az `UNMATCHED`, `AMBIGUOUS_RECONCILIATION`, `DOCUMENT_KEY_FIELD_CONFLICT`, `OPERATIONAL_DATE_CONFLICT`, `UNSUPPORTED_PAYMENT_TYPE`, `REMOVED_BEFORE_TRANSFER`, `REAPPEARED_AFTER_REMOVAL`, `OFFICIAL_INVALIDATED` nedenlerini; kaynak/aday kimlikleri, müşteri, tutar/currency, tarihler, tip, araç no, coverage ve rule version kanıtını taşır.
- Yetkili kullanıcı yalnız `CONFIRM_MATCH`, `KEEP_UNMATCHED`, `MANUAL_EXCLUDE`, `RESTORE_EXCLUDED` ve aday kalmamış kayıt için `MARK_REMOVED` kararlarını preview→commit ile verebilir. `CONFIRM_MATCH` exact dealer/customer/amount/currency/source kind çatışmasını geçersiz kılamaz; tarih/belge no istisnasını gerekçeyle çözebilir. Toplu karar yalnız aynı neden, aynı batch ve aynı beklenen sürüm kümesinde çalışır.
- Manuel karar ham satırı değiştirmez; actor, capability, reason, before/after, candidate set hash, expected source/batch/decision version ve idempotency key ile immutable revision üretir. Sonraki snapshot/resmî revision ekonomik alanı değiştirirse karar otomatik taşınmaz, `REUPLOAD_CONFLICT/PENDING_USER_APPROVAL` olur. Aynı kaynak değişmediyse karar idempotent korunur.
- Her mutabakat publish'i tek transaction'da link revision'larını, batch sonucunu, kanonik read model'i ve transactional outbox kayıtlarını üretir. Hata/rollback önceki kanonik görünümü korur. Eşzamanlı aynı kapsam run'ında tek kazanan vardır; stale publish/commit `409` alır.
- Downstream invalidation en az `OPS_CANONICAL_SIGNAL_CHANGED`, `ST_COLLECTION_COMPONENT_CHANGED`, `DISPATCH_PAYMENT_CONTEXT_CHANGED`, `PREPAYMENT_SIGNAL_DISAPPEARED` olaylarını taşır. Paket 08A downstream hesapları kendisi kopyalamaz; consumer idempotency key aynı değişikliği ikinci kez uygulatmaz.
- Normal kullanıcı görünümü yalnız kanonik sinyali gösterir. Audit yetkisi geçici ve resmî iki olayı, adayları, link/karar geçmişini görebilir. Geçici tutar açıkça `operasyonel belge yüz değeri`; resmî tutar `resmî tahsilat bağlamı`dır. Hiçbiri Paket 10 olmadan belirli sipariş/faturaya dağıtılmaz.
- Paket en az `operational_reconciliation_runs`, `operational_reconciliation_candidates`, `operational_reconciliation_link_versions`, `operational_reconciliation_issues`, `operational_signal_versions`, `operational_reconciliation_decision_versions`, `operational_reconciliation_previews` ve `operational_reconciliation_outbox` varlıklarını kurar. Raw Paket 01A ve resmî Paket 08 tablolarına sahiplik etmez.
- RLS/capability ayrımı `operational_reconciliation.view`, `audit`, `run`, `publish`, `decision.preview`, `decision.commit`, `export`tur. Service-role actor/capability denetimini atlayamaz. Tenant/dealer sınırı aday aramasında ve manuel linkte fail-closed'dur.
- API; run validate/preview/publish, batch/detail, exceptions, candidate explanation, decision preview/commit ve canonical context read uçlarını ayrı tutar. Liste/cursor sonuçları batch/run sürümüne pinlidir; yeni publish sonrası stale cursor `409 RECONCILIATION_RUN_CHANGED` alır.
- UI batch oranını geçerli pay/payda ve DQ ayrımıyla, kaynak dağılımını, exception queue'yu, before/after takeover önizlemesini ve kullanıcı karar etkisini gösterir. `%80` yeşil “tamamı eşleşti” etiketi değildir. XLSX/PDF/görsel/API aynı run, filtre, pay/payda, durum, istisna ve kanonik toplamla birebir mutabık olur.
- Paket canlı model çağrısı yapmaz. Paket 14 için `get_operational_payment_context`, `explain_operational_reconciliation`, `list_operational_reconciliation_exceptions` descriptor'larını üretir. AI `TEMP_SIGNAL`ı tahsilat/ödendi diye sunamaz; `OFFICIAL_CONTEXT`i belirli sipariş/fatura kapaması sayamaz; ambiguous/removed/coverage durumunu açıkça belirtir.
- Gerçek regresyon `106/106` exact belge no eşleşmesi, müşteri+mutlak tutar+tarih sapması `0`, çoklu/eşleşmeyen `0`, dağılım `99 OFFICIAL_CASH (55 Kredi Kartı + 44 Nakit), 5 OFFICIAL_TRANSFER, 2 OFFICIAL_CHECK`tir. İki Çekte araç no da exacttır. Dört `Aktarılamadı` yalnız bu alan nedeniyle reddedilmez.
- Tek gerçek Belgeler snapshot'ı nedeniyle `REMOVED_BEFORE_TRANSFER`, reappearance, `%79/%80`, ambiguity, official invalidation ve concurrent/stale karar davranışları sentetik fixture ile kanıtlanır; gerçek veriyle gözlenmiş gibi raporlanmaz.
- Paket `OPS-DOC-004..010` devralma/mutabakat çekirdeğini uygular; `operational_reconciliation_v2` varsayılan kapalıdır. Paket 09, 10/10A, 11, 14 ve genel cutover Paket 15 kapsamındadır.

## Paket 08B Senet/bono hazırlama ve yazdırma — kesin teknik karar

- Referans `KESAN-BAYI-PANEL-main` içindeki müşteri satırından açılan lacivert `Senet Yazdır` modalı, Açık Sipariş/Sevki Ertelenen/Manuel seçimleri, 1–12 adet, her bono için tutar-vade kartı ve çift çerçeveli A5 yatay klasik BONO görünümü hedef UX karakterizasyonudur. Görsel akış korunur; referans hesap ve güvenlik açıkları korunmaz.
- Paket 08B'nin ön koşulları Paket 00/01/02/07A/08'dir. 07B ertelenen sevkiyat, 10 açık invoice, 11 controlled manual ve 12E ortak artifact adapter'ları opsiyoneldir. Feature flag `promissory_note_printing_v2` varsayılan kapalıdır.
- 6102 sayılı TTK m.776–777 karakterizasyonuna göre final şablon `BONO/emre yazılı senet`, hukukça onaylı kayıtsız-şartsız belirli bedel vaadi, vade, açık ödeme yeri, lehtar, düzenlenme tarihi/yeri ve düzenleyenin ıslak imzası alanını taşır. Sistem hukuki geçerlilik kararı vermez; imza üretmez; e-imza/aval/ciro/protesto/hukuk takibi kapsam dışıdır.
- Alacaklı unvanı, ödeme/düzenlenme yeri, mahkeme veya diğer hukuk cümlesi frontend constant'ı değildir. Issuer profile, legal template ve retention policy immutable version/approval/effective interval/hash ile `APPROVED_ACTIVE` olmadan final generate/print açılamaz. Kullanıcı üretim ekranında hukuk metnini serbest düzenleyemez.
- V1 yalnız TRY/Türkçe'dir. Tutar source kind'ı `OPEN_ORDER_AMOUNT`, varsa `DEFERRED_DISPATCH_AMOUNT`, varsa `OPEN_INVOICE_PRINCIPAL` veya gerekçeli `MANUAL_PROPOSED_AMOUNT`tır. Kalan borç/toplam risk yalnız bağlam; sipariş tutarı borç veya resmî kabul kanıtı değildir. Her source run/revision/entity/result/as-of/currency/coverage ile pinlenir; değişiklik stale preview üretir.
- Tutar integer kuruştur. `total=q×count+r`; ilk `count−1` parça `q`, son parça `q+r`; adet `1..12`, her parça pozitif ve toplam exacttır. Rakam/yazı tutarı aynı minor unit'i vermek zorundadır; `100,00/3=33,33+33,33+33,34` golden fixture'dır.
- Her bono vadesi zorunlu, issue date'ten önce olamaz ve sıra azalamaz; aynı vade açık uyarıyla mümkündür. Issue date Türkiye bugün varsayılanı; değişiklik ayrı capability/reason/policy range ister.
- Debtor snapshot exact Müşteri Master revision'ından gelir. Tabela/müşteri unvanı tekrar önleme, adres+ilçe/il tekilleştirmesi korunur. Borçlu unvanı, VKN/TCKN, adres, issue/payment place eksikse yalnız `TASLAK — EKSİK BİLGİ` preview; boş imzalanabilir final bono yoktur.
- Her grup ve bono immutable kimlik/numara taşır. Lifecycle `DRAFT→PREVIEWED→GENERATED→PRINT_REQUESTED→PRINT_CONFIRMED`; ayrıca `SUPERSEDED/VOIDED` vardır. Print dialog başarı kanıtı değildir; explicit confirm gerekir. Bu durumların hiçbiri Paket 08 `OFFICIAL_NOTE`, tahsilat, cari azaltma, risk, FIFO/aging veya performans etkisi değildir.
- İlk üretim `ORİJİNAL`; reprint görünür `KOPYA — Yeniden Baskı N`, actor/reason/time/original hash taşır. Generated snapshot yerinde değişmez; değişiklik yeni revision/no/hash; void fiziki kopyayı yok etmiş sayılmaz ve void belge reprint edilemez.
- Resmî Senet importu sonradan exact draft no/customer/amount/currency/due ile link adayı olabilir. Tek exact aday bile otomatik kabul değildir; Paket 08 source validity/publish/lifecycle tek finansal otoritedir. Print artifact resmî source'un yerini alamaz.
- Final server-side deterministik PDF'dir: A5 landscape `210×148mm`, margin 0, safe padding 8mm, her bono ayrı sayfa, son sayfa sonrası boş sayfa yok, embed Türkçe font, grayscale/siyah-beyaz yüksek kontrast ve taşmasız uzun metin. Preview ve PDF aynı snapshot/content hash'ten gelir; istemci ayrı tutar/metin hesaplamaz.
- PDF/PII indirme kısa ömürlü ve yeniden yetki kontrollüdür; artifact saklama approved retention policy'ye bağlı, TCKN/VKN log/telemetry/AI descriptor'a gereksiz yazılmaz. RLS tenant/dealer/customer kapsamını source, artifact, download ve audit'te fail-closed uygular.
- Capabilities `instrument_print.view/preview/generate/print/reprint/void/audit`, `issue_date.override`, `template.manage/approve`, `retention.manage` olarak ayrıdır. Generate/reprint/void preview hash, expected versions, actor capability, reason gereken durumda reason ve idempotency ile çalışır.
- AI yalnız eligibility/source/status read sonuçlarını açıklar ve preview workflow'u açabilir; hukuk metni/tutar/vade/taraf düzenleyemez, otomatik generate/print/reprint/void yapamaz ve `PRINT_CONFIRMED`ı resmî Senet kabulü diye sunamaz.
- Paket `NOTEPRINT-001..015` sözleşmelerini uygular. Mevcut hardcoded şirket/mahkeme, floating split, eksik Master'da ikinci tıkla boş baskı ve `window.print=başarılı/resmî senet` davranışı yalnız karakterizasyon kaynağıdır.

## Paket 09 IADE/HIZMET tahsilatı — kesin teknik karar

- Paket 09'un kaynağı immutable `PURCHASE_WRITEOFF` source kind ve `purchase-writeoff.v1` exact contract'ıdır. Mevcut dosya adı algılama, `includes()` tip yönlendirmesi, bilinmeyen tipi HIZMET'e düşürme, belge satırlarını tutar ekleyerek birleştirme ve frontend/IndexedDB finansal kaydı hedef tasarıma taşınmaz.
- Teknik ön koşullar Paket 00, 01, 02 ve 08'dir. Paket 08A gerekli değildir. Paket 10 FIFO/cari read model'i, Paket 11 genel manuel mutasyon, Paket 12 finansal analiz ve Paket 14 canlı AI downstream tüketicidir.
- Exact zorunlu roller `Tip, Fatura Durum, Fatura No, EDOCUMENTNO, Cari Kodu, Cari Kodu2, Fatura Tarihi, Tutar`dır. `Fatura Tipi, Satış Per. No, Durum/Aktarım Durum` yalnız provenance olabilir. Dosya adı veya fuzzy/alternatif başlık publish contract'ı değildir.
- Tip router'ı yalnız normalize exact `IADE`, `HIZMET`, `SATIN ALMA` değerlerini kabul eder. `KREDI`, `DEKONT`, `ALACAK`, `ALIM`, `PURCHASE`, boş veya başka bir değer otomatik IADE/HIZMET olmaz; `UNKNOWN_PURCHASE_TYPE` ile finansal yayın dışıdır.
- `SATIN ALMA` tedarikçi hareketidir. Ham/revision/audit ve kaynak kontrol toplamında kalır; müşteri masterına zorla bağlanmaz ve müşteri cari, ekonomik tahsilat, nakit, ciro, Sellout, stok, FIFO, aging, temsilci/SSM performansı, normal müşteri ekstresi, dashboard, export veya AI normal müşteri dökümüne sıfır katkı verir.
- `IADE` yalnız `CUSTOMER_RETURN_COLLECTION`, `HIZMET` yalnız `CUSTOMER_SERVICE_COLLECTION` üretir. İkisi de müşterinin cari borcunu `Fatura Tarihi`nde azaltan nakit dışı ekonomik tahsilattır; birbirine, Nakit/Havale/Çek/Senet'e veya satış faturasına dönüştürülemez.
- IADE/HIZMET için müşteri `Cari Kodu2` ve `Cari Kodu` alanlarındaki exact metin `500...` adaylarından çözülür. Tek aday geçerli; ikisi aynıysa geçerli; iki farklı 500 kodu `CUSTOMER_CODE_CONFLICT`; 500 olmayan/boş değer `CUSTOMER_NOT_RESOLVED`dır. Müşteri adı, vergi no veya tedarikçi satırı fallback değildir.
- Finansal olay müşteri ACTIVE olmasına bağlı değildir; geçerli 500 müşteri olayı pasif/iptal durumda da kaynak gerçeği olarak kalır. Temsilci/SSM finansal sorumluluğu olay tarihindeki temporal Master'dan çözülür; çözümsüz hacim şirkette reconciliation'da kalır, başka kişiye tahminle yazılmaz.
- `Fatura No`, `EDOCUMENTNO` ve müşteri kodları text kimliğidir. Raw korunur; çevresel boşluk ve güvenli Excel `.0` artığı karşılaştırma anahtarında temizlenebilir. Baştaki sıfır keyfî eklenmez; hassasiyet kaybı/scientific notation güvenle çözülemiyorsa publish bloklanır.
- `Tutar` pozitif exact `numeric(20,2)`dır. Sıfır, negatif, non-numeric veya hassasiyet kaybı finansal olaya girmez. Kaynakta para birimi alanı yoksa import manifestinde açık `TRY` contract default'u zorunludur; sessiz currency varsayımı veya kur dönüşümü yoktur. Başka currency v1'de bloklanır.
- Etkin tarih yalnız geçerli `Fatura Tarihi`dir. Upload zamanı, vade, dosya adı veya bugünün tarihi fallback olamaz. Geçmiş tarihli belge kendi gerçek takvim ayına ve Paket 10 allocation replay kuyruğuna girer.
- Doğal source key `dealer_id + Tip + normalized Fatura No`dur. Aynı key ve aynı kanonik içerik idempotenttir. Aynı key'de customer, date, amount/currency, EDOCUMENTNO, record type veya provenance ekonomik alanı değişirse sessiz toplama/upsert yoktur; immutable `SOURCE_REVISION_CONFLICT` ve kullanıcı incelemesi oluşur.
- Aynı Fatura No'lu iki satırın tutarlarını toplamak yasaktır. Exact aynı satır import/row occurrence olarak dedup edilir; aynı source key'de farklı tutar/müşteri/tarih ayrı ekonomik olay kabul edilmez ve conflict olur. Aynı dosyanın/örtüşen dosyanın tekrar yüklenmesi ikinci cari azaltma üretmez.
- `Fatura Durum` yalnız exact `CREATED|CANCELLED`dır. `Durum/Aktarıldı/Aktarılamadı` entegrasyon provenance'ıdır ve finansal geçerliliği değiştirmez. Bilinmeyen record type publish'i bloklar.
- İptal kontrolü her yüklemede yeni ve bütün geçmiş IADE/HIZMET event revision'ları üzerinde çalışır. Otomatik çift için aynı dealer, `EDOCUMENTNO`, customer, Tip, amount ve currency; karşıt CREATED/CANCELLED ve geçerli kronoloji zorunludur. İki tarafta Fatura No aynıysa kanıt olarak korunur, farklıysa tek başına engel değildir.
- EDOCUMENTNO eksikse veya aynı anahtar birden çok CREATED adayı verirse sistem tutar/ad/tarih yakınlığıyla seçim yapmaz; `MISSING_CANCELLATION_KEY` veya `AMBIGUOUS_CANCELLATION` üretir. Güvenli tekil çift yokken CANCELLED negatif tahsilat olarak uygulanmaz ve batch review'da kalır.
- Güvenli iptal çiftinin CREATED ve CANCELLED olayları cari, ekonomik tahsilat, performans, normal liste/ekstre/export/AI ve Paket 10 allocation kaynağından birlikte çıkar. Önceden yayımlanmış allocation varsa yeni restatement/invalidation outbox ile replay edilir; eski calculation run overwrite edilmez.
- Resmî IADE/HIZMET toplamı `valid_return_amount + valid_service_amount`dır; sınıflar ve event adetleri ayrı taşınır. Bu toplam `FIN-003` ekonomik tahsilata dahildir fakat `cash_like`, banka/nakit girişi, araç kabul/ödeme, `FIN-002` ciro veya stok hareketi değildir.
- Geçerli IADE/HIZMET olayları Paket 10'a `debit_reducing_event` olarak etkin Fatura Tarihiyle verilir ve en eski açık faturaya FIFO uygulanır. Allocation parçası `NONCASH_RETURN_SERVICE` sınıfını korur; fatura bu parçayla tamamen kapanırsa kapama tarihi ve kapama günü oluşur, kısmi parçalar tahsilat gerçekleşme günü hesabına girer.
- Paket 12'nin 3/6/12 finansal pencerelerinde IADE/HIZMET; aylık ekonomik tahsilat toplamı, tahsilat/fatura oranı, tutar-ağırlıklı tahsilat gerçekleşme günü ve gerçekten kapattığı faturaların kapama günü sonuçlarına dahil olur. Nakit ödeme hızı ayrıca istendiğinde IADE/HIZMET dışlanır; standart ekonomik kapanma sonucu her sınıfın tutar/gün katkısını ayrı verir. `SATIN ALMA` bütün bu pay, payda ve gün hesaplarında sıfır katkılıdır.
- Kontrol denklemi her batch/run için `source_rows = return_rows + service_rows + supplier_rows + unknown_type_rows`; IADE/HIZMET için `eligible_rows = valid_created + valid_cancelled + cancelled_pair_members + duplicate_rows + conflict_rows + invalid_rows + pending_review_rows` ayrık kümelerini zorunlu kılar. Kayıp/çakışan satır veya currency/tutar toplamı farkı publish'i bloklar.
- Tutar mutabakatı source type ve currency bazında raw toplam, geçerli CREATED toplamı, iptal grubu etkisiz toplamı, conflict/invalid/pending toplamı ve yayımlanan ekonomik tahsilat toplamını ayrı gösterir. `SATIN ALMA` tutarı kontrol toplamında görünür fakat müşteri finansal toplamına hiçbir zaman girmez.
- Publish validate→preview→commit akışıdır; source revision, cancellation group, event, kontrol toplamı ve transactional outbox tek transaction'da yazılır. Hata önceki geçerli görünümü korur. Aynı source scope için concurrent publish tek kazanan; stale commit `409`dur.
- Outbox en az `CREDIT_ADJUSTMENT_PUBLISHED`, `CREDIT_ADJUSTMENT_INVALIDATED`, `CUSTOMER_LEDGER_REPLAY_REQUIRED`, `FINANCIAL_METRIC_RESTATEMENT_REQUIRED` taşır. Paket 09 FIFO/aging sonucunu kendisi hesaplamaz; Paket 10 idempotent replay eder.
- Normal UI ayrı `IADE` ve `HIZMET` listesi/özeti ile `SATIN ALMA/unknown/conflict/cancellation` audit-istisna alanlarını sunar. Kullanıcı toplam ekonomik tahsilat ile nakit tahsilatı aynı sayı gibi göremez. SATIN ALMA normal müşteri ekranına sızmaz.
- Paket 11 kabul edilene kadar genel manuel IADE/HIZMET ekleme, düzenleme, silme/geri alma yoktur. Paket 09 yalnız kaynak importu ve cancellation exception incelemesini üretir; ham olayı frontend formuyla değiştirmez.
- RLS/capability ayrımı `credit_adjustment.view/upload/validate/publish/audit`, `credit_adjustment.cancellation.review`, `credit_adjustment.export`tur. Service-role tenant/dealer ve actor capability kontrolünü atlayamaz.
- Paket canlı model çağrısı yapmaz. Paket 14 için `get_credit_adjustments`, `get_credit_adjustment_summary`, `explain_credit_adjustment`, `list_credit_adjustment_exceptions` descriptor'larını üretir. AI IADE/HIZMET'i nakit girişi, satış iadesiyle stok artışı veya ciro düzeltmesi diye sunamaz; SATIN ALMA'yı müşteri hareketi sayamaz.
- Gerçek regresyon `1.325 = 886 IADE + 345 HIZMET + 94 SATIN ALMA`dır. Örnekte 1.231 IADE/HIZMET satırının tamamı exact 500 müşteriye bağlı, 94 SATIN ALMA satırının hiçbiri 500 müşteriye bağlı değildir ve 1.325 satırın tamamı CREATED'dır. Bu dağılım production sabiti değil fixture kontrolüdür.
- Gerçek fixture CANCELLED içermediği için tekil iptal, missing EDOCUMENTNO, ambiguity, sonradan iptal/restatement, source revision conflict, currency ve concurrent publish senaryoları sentetik fixture ile kanıtlanır; gerçek gözlem gibi raporlanmaz.
- Paket `FIN-004/004A..004K` ve `FIN-003`ün IADE/HIZMET adapter'ını uygular; `credit_adjustments_v2` varsayılan kapalıdır. Paket 10/10A, 11, 12, 14 ve genel cutover 15 ayrı kapsamdır.

## Paket 10 Cari defter, fatura dağıtımı ve aging — kesin teknik karar

- Paket 10'un teknik ön koşulları Paket 00, 01, 02, 07, 08 ve 09'dur. Paket 08A operasyonel devralma olduğu için finansal FIFO ön koşulu değildir. Paket 10A, 11, 12, 14 ve 15 downstream tüketicidir.
- Paket, yalnız yayımlanmış ve finansal geçerliliği kesinleşmiş olayları tüketir. Sellout TL, geçici Belgeler sinyali, sipariş/sevkiyat tutarı, SATIN ALMA, Çek kapama Havalesinin ikinci etkisi, iptal çiftleri ve çözülmemiş kaynak çatışmaları cari/FIFO girdisi değildir.
- Merkezi defter yönü tutar işaretinden tahmin edilmez. Geçerli satış faturası, `OPENING_BALANCE_INVOICE`, manuel `DEVIR_BORC` ve virmanla devralınan lot borç artırır; geçerli Nakit, normal Havale, Çek/Senet kabulü, IADE/HIZMET ve manuel `DEVIR_ALACAK` borç azaltır. Virman iki müşteride dengeli lot sahipliği değişimidir.
- Para birimleri ayrı defter zinciridir. Paket 10 v1 resmî read model'i yalnız TRY üretir; farklı currency sessiz kur çevrimiyle birleşmez ve ilgili sonuç `UNSUPPORTED_CURRENCY/BLOCKED_COVERAGE` olur.
- `receivable_lot` normal satış faturası veya özel borç kaydının ekonomik anaparasını temsil eder. Satış faturası kimliği Paket 07 olay kimliğidir; aynı faturanın satırları ikinci lot veya ikinci anapara oluşturmaz.
- Pozitif ilk başlangıç bakiyesi yalnız `initial_baseline_year` için 1 Ocak tarihli `OPENING_BALANCE_INVOICE` lotudur. Negatif otomatik başlangıç bakiyesi finansal etki üretmez. Sonraki yıl başlarında yeni devir veya sıfırlama yapılmaz.
- Varsayılan resmî allocation sırası aynı müşteri ve currency içinde `origin_invoice_date ASC, normalized_document_key ASC, receivable_lot_id ASC`dır. Virmanla devralınan parçada orijinal tarih ve belge kimliği korunur; transfer tarihi FIFO yaşını sıfırlamaz.
- Cari azaltan olaylar `effective_date ASC, source_class_order ASC, source_event_key ASC, debit_reducing_event_id ASC` ile deterministik oynatılır. `source_class_order` yalnız aynı gün teknik determinizm sağlar ve sürümlü sabittir; ticari yöntem önceliği veya nakit üstünlüğü oluşturmaz.
- Bir azaltan olay önce mevcut en eski açık lotlara parça parça uygulanır. Tek olay birden çok lotu, tek lot birden çok olayı kullanabilir; her parça immutable `invoice_allocation_version` kaydıdır.
- Açık lot kalmadığında artan tutar aynı müşteri/currency için `unallocated_customer_credit` olarak kalır. Sonraki lot doğduğunda kredi ancak `max(lot tarihi, kredi olay tarihi)` etkin tarihiyle uygulanır; gelecekteki faturadan geçmiş kesime bilgi sızmaz.
- Allocation sınıfı kaynak olaydan korunur: `CASH`, `BANK_TRANSFER`, `INSTRUMENT_ACCEPTANCE_CHECK`, `INSTRUMENT_ACCEPTANCE_NOTE`, `NONCASH_RETURN_SERVICE`, `MANUAL_CREDIT_TRANSFER`, `PREEXISTING_UNALLOCATED_CREDIT`. IADE ve HIZMET ayrıca alt sınıfını korur. Çek/Senet ödeme tarihi yeni allocation değildir.
- `MANUAL_CREDIT_TRANSFER` cariyi ve açık lotu azaltabilir ancak aylık ekonomik tahsilat, nakit, likidite ve tahsilat performansına girmez. Genel manuel oluşturma/override arayüzü Paket 11'dedir; Paket 10 yalnız yayımlanmış domain olayını işler.
- Cari bakiye, kesime kadar geçerli borç artıran olaylar eksi geçerli borç azaltan olaylardır. `sum(open_lot_amount) - unallocated_credit = customer_balance` eşitliği müşteri/currency düzeyinde sağlanır; pozitif risk kapsamı ayrıca `max(0, customer_balance)`dır.
- Çek/Senet kabulü cariyi ve FIFO'yu kabul tarihinde azaltırken aynı tutarda ayrı araç riski açar. Paket 10 araç lifecycle'ını yeniden hesaplamaz; Paket 08 sonucunu bakiye/risk köprüsünde ayrı tüketir.
- Bir olay iptal, geçersiz, tarih/tutar/müşteri değişikliği veya sürümlü kullanıcı kararıyla etkilenirse eski allocation overwrite edilmez. En erken etkilenen tarihten müşteri/currency zinciri yeni calculation run'da deterministik replay edilir; eski run denetimde kalır.
- Virman, kaynak müşterinin seçilen veya varsayılan FIFO açık lot parçalarını hedef müşteriye taşır. Şirket net etkisi sıfır, kaynak ve hedef ters eşit etkili, orijinal fatura/tarih/anapara izi korunmuş olmalıdır. Virman iptalinde iki müşteri aynı run içinde birlikte replay edilir.
- Fatura açık tutarı `max(0, principal - kesime kadar geçerli allocation)`dır. Tam kapanma tarihi açık tutarı sıfırlayan son gerekli allocation'ın etkin tarihidir; açık/kısmi faturada null, aynı gün veya ön krediyle kapanmada en az fatura tarihi ve kapanma günü `0`dır.
- Allocation gerçekleşme günü `max(0, allocation_effective_date - origin_invoice_date)`; tamamen kapanmış faturanın kapama günü yerel takvim `close_date - origin_invoice_date`dır. Negatif gün üretilemez.
- IADE/HIZMET allocation'ları ekonomik gerçekleşme ve kapanma günlerine dağıtılan tutarı kadar katılır; `cash_only` hız bunları dışlar. SATIN ALMA iki hızda da bulunmaz. Ekonomik ve cash-only sonuç aynı etiket altında birleştirilemez.
- 3/6/12 pencereleri seçilen `period_end_month`ta biten tamamlanmış takvim aylarıdır. `N×30 gün`, upload tarihi veya cari ayı tam ay sayma yoktur. Cari ay yalnız ayrıca `MTD/PARTIAL` olarak sunulabilir.
- Paket 10 temel gerçekleri üretir: fatura ayı/tutarı, allocation ayı/tutarı/sınıfı, allocation gerçekleşme günü, tam kapanma ayı/günü ve coverage. 3/6/12 toplam/ortalama/oran read model'leri bu gerçeklerden üretilebilir; skor, DSO, CEI, tahmin ve ileri analiz Paket 12'nindir.
- Aylık fatura toplamı geçerli satış faturası + pencereye düşen `OPENING_BALANCE_INVOICE` + manuel `DEVIR_BORC`tur; sınıflar ayrıdır. Aylık ekonomik tahsilat Nakit + normal Havale + Çek/Senet kabulü + IADE + HIZMETtir. `DEVIR_ALACAK`, virman, iptal ve Çek kapama Havalesi dışarıdadır.
- 3/6/12 tahsilat/fatura oranı `100 × Σ ekonomik tahsilat / Σ fatura`dır; aylık oranların ortalaması değildir ve eski borç tahsilatı nedeniyle `%100`ü aşabilir. Fatura paydası sıfırsa null'dır.
- Yaş yalnız kesim tarihinde pozitif açık tutarı kalan lot için `as_of_date - origin_invoice_date` yerel takvim günüdür. Ayrı ticari vade/gecikme günü uydurulmaz; gelecek tarihli lot `FUTURE_DATED_RECEIVABLE` ile resmî aging dışında kalır.
- Standart aging dilimleri `0–6, 7–13, 14–20, 21–28, 29–45, 46–60, 61–89, 90+`tır. İç motor exact günü korur. Dilim toplamı pozitif açık lot toplamına birebir eşit olmalıdır.
- `29+` yalnız `age_days > 28`dir. Ağırlıklı ortalama açık yaş `Σ(open_amount×age_days)/Σ(open_amount)`tır; açık lot yoksa null, alt grup ortalamalarının ortalaması yasaktır.
- Organizasyon görünümü olay/lot tarihindeki temporal sorumluluk izini ve kesim tarihindeki sahiplik bağını ayrı taşır. Çözümsüz sorumluluk şirket toplamında kalır; başka temsilci/SSM'ye tahminle atanmaz.
- Pasif/iptal müşteri olayı silinmez. Kesim tarihinde pozitif borçlu bakiye `≥100,00 TRY` ise finansal kapsamda görünür; eşik faturayı/allocation'ı geçersiz yapmaz.
- Paket en az `customer_ledger_events`, `receivable_lots`, `receivable_lot_versions`, `debit_reducing_events`, `invoice_allocation_versions`, `unallocated_credit_positions`, `receivable_transfer_versions`, `receivable_transfer_lot_parts`, `ledger_calculation_runs`, `ledger_replay_requests`, `ledger_reconciliation_results`, `invoice_position_results`, `aging_position_results`, `financial_period_coverage` ve transactional outbox varlıklarını kurar.
- Her yayımlanmış run `as_of_date`, `knowledge_cutoff`, kaynak snapshot/revision seti, kural/metric sürümleri, tenant/dealer kapsamı, code version, giriş/çıkış hash'leri ve durum taşır. Aynı manifest aynı sonucu verir; aynı scope/as-of için concurrent publish tek kazanan, stale publish `409`dur.
- Zorunlu denklikler müşteri/currency bazında defter bakiyesi↔açık lot−dağıtılmamış alacak, lot anaparası↔allocation+açık tutar, azaltan olay tutarı↔allocation+dağıtılmamış tutar ve şirket bazında virman net `0`dır. Kritik farkta run yayımlanmaz.
- API en az run preview/publish/status, müşteri cari özeti, ekstre, açık faturalar, allocation açıklaması, aging özeti/detayı, dönem coverage ve 3/6/12 temel hız/akış sonuçlarını ayrı salt-okunur uçlarla sunar. Liste cursor'ı calculation run'a pinlenir; run değişiminde stale cursor `409` alır.
- UI müşteri cari özeti, açık fatura tablosu, allocation drill-down, dağıtılmamış alacak, exact gün/aging dilimi, ekonomik vs cash-only ödeme hızı ve coverage/istisna alanlarını gösterir. Cari bakiye, açık fatura, araç riski ve toplam risk aynı sayı gibi sunulmaz.
- RLS/capability ayrımı en az `ledger.view`, `ledger.audit`, `ledger.run`, `ledger.publish`, `ledger.replay`, `ledger.export`tur. Paket 10 normal kullanıcıya finansal mutasyon yetkisi vermez; service role tenant/dealer ve actor capability sınırını atlayamaz.
- Paket canlı model çağrısı yapmaz. Paket 14 için tipli `get_customer_ledger`, `get_open_invoices`, `explain_invoice_allocation`, `get_customer_aging`, `get_payment_speed` ve `explain_ledger_reconciliation` descriptor'larını üretir.
- AI belirli faturayı yalnız allocation kanıtıyla kapandı/kısmi/açık diye anlatır; `TEMP_SIGNAL`, sipariş tutarı, aynı gün toplamı veya bakiye farkından kapama uydurmaz. 3/6/12 yanıtında pencere aylarını, ekonomik/cash-only tanımını, IADE/HIZMET ve devir katkısını, coverage ile run/kesimi açıklar.
- Mevcut `panel/src/calculations/cariCalculations.ts`, `panel/src/services/customerAnalytics.ts`, `customerService.ts`, `customerQueries.ts`, AI read tool registry ve müşteri analiz bileşenleri yalnız davranış envanteri/regresyon kaynağıdır. Sabit 18/28 gün, sanal fatura, `N×30`, bakiye farkından ödeme ve frontend state/IndexedDB resmî kayıt yaklaşımı hedefe taşınmaz.
- Feature flag `customer_ledger_v2` varsayılan kapalıdır. Paket 10A Fatura Kontrol, Paket 11 genel manuel işlem/override, Paket 12 ileri finansal metrik/rapor, Paket 14 canlı AI handler ve Paket 15 cutover bu pakette erkenden uygulanmaz.

## Paket 10A Teslim edilmiş Fatura Kontrol — kesin teknik karar

- Paket 10A'nın ön koşulları Paket 00, 01, 01A, 02, 07, 07A, 07B, 08, 08A ve 10'dur. Paket 09, Paket 10'un IADE/HIZMET allocation girdisi üzerinden dolaylı bağımlılıktır. Paket 11, 12, 14 ve 15 downstream tüketicidir.
- Modül yalnız teslim kanıtı bulunan satış belgesini ve bağlı/geçerli satış faturasını finansal kanıtlarla inceler. Geçmiş sevkiyat listesi, sevk onay motoru, kredi kararı, müşteri sağlık skoru veya otomatik finansal mutasyon değildir.
- Aday kaynağı Paket 07B'nin immutable/idempotent `invoice_delivery_handoff` revision'ıdır. Yalnız `Teslim Edildi`, `Depodan Teslim` veya tamamlanmış satır kanıtı taşıyan mixed-review handoff'u kabul edilir; teslim edilmemiş/ertelenmiş/red/iptal belge normal aday olmaz.
- Teslim var fakat fatura referansı eksik/bağlanamıyor veya fatura var fakat teslim teyidi yoksa normal bağlı aday uydurulmaz; ayrı istisna adayı ve coverage durumu üretilir.
- Bağlantı birinci olarak normalize `sipariş.Fatura No ↔ satış.Fatura No`, ikinci olarak `sipariş.Satış Belge No ↔ satış.Sipariş Numarası` güçlü anahtarlarını kullanır. İkisi doluysa aynı tek faturayı göstermelidir.
- Çift anahtar sonucunda exact müşteri, vergi dâhil tutar, `Tip=SATIS`, aktif `CREATED` fatura ve iptal geçerliliği zorunludur. Çelişki varsa otomatik bağlantı yoktur.
- Kontrollü tek-anahtar fallback yalnız diğer güçlü anahtar gerçekten boşsa; tek aday, exact müşteri/tutar ve geçerli fatura şartıyla mümkündür. Dolu fakat çelişkili anahtar varken fallback yasaktır.
- Müşteri+tutar+tarih, ad benzerliği veya yakın tutar otomatik bağlantı anahtarı değildir; yalnız manuel inceleme aday sıralaması olabilir. Fatura tarihi eşitliği join şartı değildir.
- Handoff doğal kimliği `dealer_id + sales_document_id + delivery_evidence_revision + invoice_link_revision`dır. Aynı revision ikinci aday üretmez; kaynak değişimi mevcut adayın yeni evidence revision'ını ve yeni control run'ı üretir.
- Her kontrol run'ı `as_of_date`, `knowledge_cutoff`, Paket 07/07A/07B/08/08A/10 kaynak revision/run kimlikleri, rule version, scope ve manifest hash taşır. Eski sonuç overwrite edilmez.
- Aday fatura anı `D`, geçerli satış faturasının `Fatura Tarihi`dir. Teslim tarihi ayrıca bağlam ve araç riski kesimidir; fatura tarihi ile teslim tarihi farklıysa iki anlam sessizce birleştirilmez.
- `prior_open_stack`, aday lot doğmadan hemen önce aynı müşteri/currency üzerindeki pozitif açık lotlardır; aday fatura dahil değildir. Adet, tutar, en eski exact yaş ve standart aging dağılımı taşır.
- `current_open_stack`, seçilen rapor kesimindeki açık lotlardır; aday faturanın `OPEN/PARTIALLY_ALLOCATED/CLOSED` durumu ayrıca gösterilir. Önceki ve güncel yığın birbirinin yerine kullanılamaz.
- D−1 ve D incelemesi yalnız Paket 10'un yayımlanmış allocation gerçeklerinden gelir. Toplam tahsilat, bakiye farkı veya aynı gün fatura−tahsilat farkı allocation kanıtı değildir.
- Yaşlandırmadan tahsilat kanıtı, allocation anındaki eski lot yaşı/dilimi, D−1 allocation, D allocation, sınıf ve kalan açık tutarı gösterir. IADE/HIZMET eski lotu ekonomik olarak kapatabilir fakat nakit peşin sayılmaz.
- D−1 resmî nakit benzeri sınıf Nakit, Kredi Kartı/POS ve normal banka Havalesidir. Çek/Senet kabulü, IADE/HIZMET, `DEVIR_ALACAK`, virman ve operasyonel Belgeler peşin nakit coverage payına girmez.
- D−1 resmî olayın bulunması yeni faturanın peşin ödendiğini kanıtlamaz. Yalnız bu olaydan kalan dağıtılmamış alacağın aday faturaya D tarihinde gerçekten allocation olması `OFFICIAL_PREPAYMENT_APPLIED`dır.
- `cash_prepayment_coverage = aday faturaya uygulanmış uygun resmî nakit benzeri peşin allocation / aday fatura anaparası`. Payda sıfır/geçersiz veya kaynak coverage eksikse null'dır; oran `%100`ü aşmaz, artan alacak ayrıca gösterilir.
- D−1 kontrol denklemi resmî cari azaltan toplamı `eski lot allocation + aday lota D'de uygulanan ön kredi + D−1 sonu dağıtılmamış + kapsam dışı/uygulanamaz + geçersiz/iptal` ayrık sınıflarına mutabık tutar. Aynı tutar iki sınıfta bulunamaz.
- Aynı gün kaynak saat/kronoloji kanıtı taşımıyorsa tahsilatın teslimden önce olduğu söylenemez ve `SAME_DAY_SEQUENCE_UNKNOWN` oluşur. Tarih eşitliği tek başına peşin kanıt değildir.
- Belgeler yalnız `OPERATIONAL_PREPAYMENT_SIGNAL`dır. Resmî tahsilatla devralındığında aynı ekonomik bağlam iki kez görünmez; kaybolup resmileşmezse `PREPAYMENT_SIGNAL_DISAPPEARED` alarmı oluşur.
- Teslim anındaki açık Çek ve Senet riski Paket 08'in instrument position sonucundan ayrı gösterilir. Araç kabulü cariyi azaltmış olsa da gerçek nakit peşin değildir; açık araç riski cari/açık fatura tutarıyla mahsup edilmez.
- Alarm üretimi tanımlı kod, coverage, evidence kimlikleri ve rule version ister. Veri eksikliğinde müşteri davranışı sonucu değil `BLOCKED_DATA` üretilir.
- Overall önceliği `BLOCKED_DATA > CRITICAL_REVIEW > HIGH_RISK > ATTENTION > CLEAR_WITH_EVIDENCE`dır. Bu değer skor değildir; aynı adayın bütün alt alarmları korunur.
- `HIGH_RISK` yaşlı açık borcun varlığıyla tek başına oluşmaz. Coverage tamken 29+ eski açık lot, D−1/D bu lotlara allocation yokluğu ve aday faturanın açık kalması birlikte gerekir. 0–28 günlük aynı bağlam `ATTENTION`dır.
- Açık Çek/Senet riski + aday faturaya resmî nakit benzeri peşin allocation yokluğu ayrıca `INSTRUMENT_RISK_WITHOUT_CASH_PREPAYMENT` alarmıdır; otomatik sevkiyat engeli değildir.
- `CLEAR_WITH_EVIDENCE` yalnız bağlantı, teslim, finansal ve operasyonel coverage tam; bloke/kritik/yüksek/attention alarmı yok ve kanıtlar yayımlanmışsa oluşur. “Müşterinin borcu yok” anlamına gelmez.
- Review workflow `OPEN, ACKNOWLEDGED, PENDING_USER_APPROVAL, RESOLVED, REOPENED, REJECTED_RESOLUTION` durumlarını taşır. Acknowledge alarm nedenini veya severity'yi değiştirmez; neden yeni run'da kalkarsa resolved olur, geri gelirse reopened olur.
- Kullanıcı `ACKNOWLEDGE`, `ADD_NOTE`, güvenli `CONFIRM_LINK/SELECT_LINK/REMOVE_LINK`, `OPEN_SOURCE_EDIT` ve `REQUEST_MANUAL_ALLOCATION` akışlarını capability kontrollü preview→commit ile başlatabilir. Paket 10A genel finansal mutasyonu kendisi uygulamaz.
- Manuel link `MANUAL_LINK_OVERRIDE` revision'ıdır; ham belge kimliklerini değiştirmez. Kaynak anahtar/revision değişirse karar sessizce taşınmaz, yeniden onay ister.
- “Peşin alındı”, “fatura kapandı”, “Çek/Senet ödendi” veya allocation sonucu salt flag/acknowledge ile değiştirilemez. Finansal mutation/allocation override Paket 11 üzerinden Paket 10 replay'i tetikler.
- Paket en az `invoice_delivery_control_runs`, `invoice_delivery_candidates`, `invoice_delivery_candidate_versions`, `invoice_control_evidence`, `invoice_control_evidence_links`, `invoice_control_alert_versions`, `invoice_control_workflow_versions`, `invoice_control_resolution_previews`, `invoice_control_source_coverage`, `invoice_control_outbox` varlıklarını kurar.
- Publish aynı transaction'da candidate/evidence/alert/workflow projection, control totals, active run pointer ve outbox üretir. Stale source/preview/publish `409`; rollback önceki yayımlanmış kartı korur.
- RLS/capability ayrımı en az `invoice_control.view`, `audit`, `run`, `publish`, `acknowledge`, `resolve_link`, `request_financial_action`, `export`tur. Service role tenant/dealer ve actor capability kontrolünü atlayamaz.
- Liste; severity, en eski açık yaş DESC, fatura tutarı DESC, kalıcı belge kimliği ASC ile deterministik sıralanır. Filtreler durum/alarm, tarih, müşteri, temsilci/SSM, kanal, aging, araç riski, peşin coverage, link ve coverage durumunu destekler.
- Tek kart kimlik/sorumluluk, zaman çizgisi, link/tutar mutabakatı, prior/current stack, aged allocation, D−1 split, resmî peşin, operasyon sinyali, FIFO path, araç riski, current invoice state, alert/workflow ve coverage bloklarını aynı manifestten gösterir.
- Paket canlı model çağrısı yapmaz. Paket 14 için `get_delivered_invoice_controls`, `explain_invoice_control_alert`, `get_invoice_control_evidence`, `get_prepayment_evidence` descriptor'larını üretir; Sevkiyat araçlarından ayrıdır.
- Gerçek golden fixture `126 satır→87 satış belgesi`, `73 tamamlanmış+Fatura No`, `4 tamamlanmış+Fatura No boş`, `25 CONFIRMED_DUAL_KEY`; kesin bağlılarda müşteri/tutar/anahtar çatışması ve ambiguity `0` sonuçlarını doğrular. `23/1/1` tarih dağılımı join şartı yapılmaz.
- Gerçek fixture yalnız gözlenen bağlantı profilini kanıtlar. Kaybolan sinyal, single-key, ambiguity, same-day saat yokluğu, 29+ risk, araç riski, manual link, stale/concurrency ve rollback senaryoları sentetik fixture ile açıkça ayrılır.
- Feature flag `delivered_invoice_control_v2` varsayılan kapalıdır. Paket 11 genel mutation/override, Paket 12 skor/ileri rapor, Paket 14 canlı AI handler ve Paket 15 cutover bu pakette erkenden uygulanmaz.

## Paket 04B Sellout tarihsel karşılaştırma ve AI raporlama — kesin teknik karar

- Kullanıcının sağladığı iki sayfalık “Sellout Aylık Litre Raporu” yalnız görsel/karakterizasyon örneğidir. Örnekteki başlık+dönem+kanal tanımı, üç KPI kartı, aylık Açık/Kapalı sütun grafiği, toplam litre trendi, detaylı aylık tablo, genel toplam ve kaynak/üretim tarihi yapısı hedef raporun asgari görünümüdür; kaynakta olabilecek hesap hataları aynen taşınmaz.
- Paket 04B domain read model'i için Paket 00–04'e; PDF/XLSX/PNG/SVG ortak artifact üretimi için Paket 12E'ye; doğal dil niyet/yorum ve kullanıcıya teslim için Paket 14'e bağımlıdır. 04B hesap sözleşmesi 12E/14 beklenirken teknik olarak hazırlanabilir fakat AI artifact teslimi bağımlılıklar olmadan açılmaz.
- Raporun tek ölçü birimi litredir. Sellout TL, finansal ciro, tahsilat, fiyat, ST Tahsilat/Litre, stok veya fatura metrikleri bu rapora girmez.
- Aylık dönem yalnız geçerli Sellout olayının `Faturalama Tarihi`nden `YYYY-MM` olarak gelir. Upload tarihi, dosya adı veya rapor üretim tarihi dönem belirlemez.
- Ana Sellout ekranının tek-ay filtresi korunur. Tarihsel karşılaştırma ayrı rapor sözleşmesidir; kullanıcı explicit `from_month/to_month` veya iki explicit dönem seçer. Finansal anlamdaki `3/6/12` hazır filtresi Sellout'a eklenmez.
- Desteklenen comparison türleri `NONE`, `PREVIOUS_MONTH`, `SAME_MONTH_PREVIOUS_YEAR`, `PREVIOUS_EQUAL_PERIOD`, `EXPLICIT_PERIODS`dir. Her karşılaştırmada iki dönem aynı ay sayısı, aynı kapsam/filtre ve karşılaştırılabilir coverage taşır; aksi halde `NON_COMPARABLE/PARTIAL`dır.
- Eksik ay veya doğrulanmamış kaynak boşluğu sıfır litre değildir. Yalnız coverage'ı tam ve satışsız olduğu doğrulanmış ay `ZERO` olabilir. Grafik ve tabloda `MISSING/PARTIAL/ZERO` ayrı görünür.
- Kanal yalnız temporal Master eşlemesidir: `Standart Açık + Otel + Horeca → Açık Kanal`; `Standart Kapalı + Ekomini → Kapalı Kanal`. Kanalı çözülemeyen aktif litre genel şirket toplamında kalır ve `UNCLASSIFIED_CHANNEL` olarak ayrıca gösterilir; Açık/Kapalıya tahminle dağıtılmaz.
- KPI kartları `Açık Kanal net litre`, `Kapalı Kanal net litre`, `Genel net litre`dir. `Genel = Açık + Kapalı + çözümsüz kanal` denklemi zorunludur; örnekte çözümsüz yoksa genel iki kanal toplamına eşittir.
- Varsayılan ana ölçü `ACT-004 net_litres`tir. Brüt satış, iade ve varsa doğrulanmış ters etki rapor manifestinde ayrı bileşenlerdir. İade gizlenmez; net litre formülü aynı Paket 04 metric version'ından gelir.
- Aylık kanal grafiği her takvim ayında Açık ve Kapalı net litreyi yan yana gösterir. Çözümsüz kanal varsa üçüncü seri veya görünür mutabakat notu olur; genel toplamdan kaybolmaz.
- Toplam litre trendi aynı ayların genel net litresidir. Grafik noktaları aylık detay tablosuyla aynı `metric_result_id` ve ham exact değeri kullanır; görselden yeniden hesap yapılmaz.
- Detay tablo her ay için `Ay/Yıl`, Açık, Kapalı, Çözümsüz, Genel net litre, brüt litre, iade litre, coverage durumu ve gerekirse kıyas farkını taşır. Türkçe etiket `2025 Ocak`, makine anahtarı `2025-01`dır.
- Genel toplam satırı tabloda görünen aylık ham exact değerlerin toplamıdır. Kanal ve genel kontrol denklemleri gösterim yuvarlamasından önce sağlanır; PDF'de locale `tr-TR`, litre gösterimi en fazla bir ondalıkla olabilir.
- Tarihsel karşılaştırma her KPI ve ay için cari değer, kıyas değer, mutlak fark ve güvenli yüzde değişim üretir. Kıyas değeri 0 ise yüzde null ve `BASE_ZERO`; kapsam/coverage farklıysa `NON_COMPARABLE` olur.
- Ek karşılaştırma kanıtları Açık/Kapalı kanal pay değişimi (yüzde puan), toplam litre değişimi ve aylık katkı sıralamasıdır. Alt grup yüzdeleri ortalanmaz; ham litrelerden yeniden hesaplanır.
- AI yalnız sayı tekrarı yapmaz. Önce dönem/toplam değişimini, sonra kanal değişimini, en güçlü yükseliş/düşüş aylarını ve mevcutsa ürün ailesi/müşteri/temsilci/SSM katkılarını, ardından iade ve coverage etkisini açıklar.
- “Neden arttı/azaldı?” cevabı yalnız katkı kırılımlarını kanıt olarak kullanır; kampanya, hava, fiyat, rakip veya saha nedeni veri yoksa kesin neden olarak uydurulmaz. Bunlar ancak kullanıcı tarafından sağlanan dış kanıtla inference olabilir.
- Rapor başlığında rapor adı, cari dönem, varsa kıyas dönemi, ay sayısı, kapsam/filtre özeti ve kanal tanımı bulunur. “18 aylık” gibi ifade gerçek kapsanan ay sayısından türetilir.
- İlk sayfa en az üç KPI kartı, aylık kanal dağılımı, toplam trend ve kısa AI yönetici özeti içerir. İkinci ve sonraki sayfalar detay tablo, karşılaştırma tablosu, katkı/istisna, coverage, kaynak ve metodolojiyi taşır.
- Çok uzun dönemlerde grafik okunabilirlik için en fazla 24–36 aylık görünür pencere veya sayfalı/facet çözümü kullanır; hiçbir ay sessizce atılmaz. Tablo bütün ayları sayfalı olarak korur.
- Rapor renkleri kanal semantiğini tutarlı taşır; fakat renk tek bilgi kanalı değildir. Legend, başlık, eksen ve tablo fallback zorunludur. Negatif/iade etkileri grafiklerde açık işaretlenir.
- PDF A4 baskıya hazırdır; kırpılmış grafik, taşan tablo, okunmaz eksen etiketi veya sayfa dışında kalan içerik kalite kapısını geçemez. XLSX aynı manifestten özet, aylık veri, karşılaştırma, katkı, coverage ve metodoloji sekmeleri üretir. PNG/SVG seçili grafik/özet artifact'ıdır.
- Rapor footer'ı kaynak kind/snapshot, `calculation_run_id`, metric/template/renderer versions, coverage, rapor oluşturma zamanı ve isteyen kullanıcı/AI planını taşır. Eski artifact güncel veriyle sessizce değişmez.
- AI niyetleri en az “Ocak 2025–Haziran 2026 Sellout litre raporu”, “2025 Mart ile 2026 Martı karşılaştır”, “son iki eş dönemi kıyasla”, “Açık/Kapalı kanal değişimini yorumla”, “PDF ve Excel hazırla” isteklerini çözer.
- AI küçük sonuçta sohbet içi özet, orta sonuçta özet+görsel, yoğun dönem/kırılımda `REPORT_PACK` seçer. Bütün formatlar tek result manifest ve tek claim setini yeniden kullanır; PDF için ikinci kez sayı/yorum üretmez.
- Paket en az `sellout_comparison_runs`, `sellout_comparison_periods`, `sellout_monthly_report_facts`, `sellout_period_comparison_results`, `sellout_comparison_contributions`, `sellout_report_manifests`, `sellout_report_claims` read-model varlıklarını ve 12E artifact bağlarını kurar.
- API en az dönem catalog/validate, comparison preview/run, monthly facts, contributions, report manifest ve artifact request/status uçlarını taşır. Mutasyon veya Sellout düzeltmesi rapor endpoint'ine gizlenmez.
- RLS müşteri/temsilci/SSM/dealer kapsamını hem summary hem detail hem artifact'ta korur. Cache key authorization scope, period/filter/comparison, source snapshot, metric/template versions içerir.
- Gerçek PDF'deki `Ocak 2025–Haziran 2026`, 18 aylık örnek ve Açık/Kapalı/Genel düzen görsel golden fixture olabilir; sayıların production sabiti olduğu varsayılmaz. Test, örnek yapının yeniden üretilebilirliğini ve kaynak manifest denkliklerini ayrı kanıtlar.
- Feature flag `sellout_historical_reports_v2` varsayılan kapalıdır. Paket 04 ana tek-ay ekranı, Paket 04A ST, finansal 3/6/12 ve Paket 15 cutover bu paket tarafından değiştirilmez.

## Paket 11 Manuel işlem, override ve kaynak çatışması — kesin teknik karar

- Paket 11'in finansal çekirdek ön koşulları Paket 00, 01, 02, 07, 08, 09 ve 10'dur. Sipariş/Fatura Kontrol link ve bugünkü operasyon override'ları için ayrıca Paket 07A, 07B ve 10A kabul edilmelidir. Paket 12, 14 ve 15 downstream tüketicidir.
- Paket, bütün ham kaynak satırlarını immutable tutar. Kullanıcı hiçbir Excel satırını, source revision'ı, eski karar sürümünü veya yayımlanmış calculation run'ı yerinde değiştiremez; her işlem yeni manual transaction/override/decision revision'ıdır.
- V1 ortak manuel finansal türleri `SATIS_FATURASI`, `IADE`, `HIZMET`, `NAKIT_TAHSILAT`, `HAVALE_TAHSILAT`, `CEK_KABUL`, `SENET_KABUL`, `DEVIR_BORC`, `DEVIR_ALACAK`, `CARILER_ARASI_VIRMAN`dır. Her tür Paket 07/08/09/10 domain adapter'ına gider; ortak form kendi finansal formülünü yazmaz.
- `SATIN_ALMA` tedarikçi hareketidir ve müşteri finansal manuel formunda desteklenmez. Kullanıcı bu türle müşteri cari, tahsilat, fatura, FIFO veya aging olayı oluşturamaz.
- Tutar tüm türlerde pozitif exact decimal girilir; ekonomik yön seçilen işlem türünden gelir. Negatif tutardan borç/alacak, iade, iptal veya virman yönü türetmek yasaktır.
- Bütün türlerde dealer, exact müşteri, belge/etkin tarih, currency, pozitif tutar, açıklama/gerekçe ve idempotency key zorunludur. Tür bazında belge no, yöntem, banka/kasa, araç no, vade, kaynak/hedef müşteri veya satış belge alanları ayrıca zorunlu olabilir.
- `SATIS_FATURASI` Paket 07 ile aynı müşteri/belge/tutar/tarih/currency/mükerrer/iptal doğrulamasından geçer; vergi dâhil borç lotu ve ticari ciro etkisi üretir. Manuel kaynak etiketi/provenance ayrıca görünür.
- `IADE/HIZMET` Paket 09 sınıflarını ve Paket 10 `NONCASH_RETURN_SERVICE` allocation semantiğini kullanır. Nakit/likidite, stok veya SATIN ALMA etkisi üretmez.
- `NAKIT/HAVALE/CEK/SENET` Paket 08 exact yöntem, iptal, doğal anahtar ve instrument lifecycle kurallarına uyar. Çek/Senet kabulü cariyi azaltıp ayrı araç riski açar; ödeme/settlement ikinci cari azaltma değildir.
- `DEVIR_BORC` ve `DEVIR_ALACAK` Paket 10 kararlarıyla çalışır. Birincisi özel açık borç lotu; ikincisi performans dışı cari azaltan allocation/unallocated credit'tir. Ticari ciro veya gerçek tahsilat gibi gösterilmez.
- `CARILER_ARASI_VIRMAN` farklı exact kaynak/hedef müşteri, aynı TRY currency, etkin tarih ve pozitif tutar ister. Tek `transfer_id` altında dengeli iki taraf ve kaynak lot parçaları atomik oluşur; şirket neti sıfırdır.
- Ortak mutation akışı `validate → preview → explicit confirmation → commit → publish/outbox → downstream replay`dır. Preview olmadan commit veya sohbet metninden doğrudan mutation yoktur.
- Preview en az before/after olayını, cari bakiye etkisini, lot/allocation/FIFO/aging/kapama etkisini, instrument riskini, aylık fatura/tahsilat ve performans dahil/dışarı sınıflarını, etkilenen müşteri/org/dönemleri, coverage/DQ ve geri alma sonucunu gösterir.
- Preview `preview_id`, canonical request hash, source/transaction/decision expected versions, actor/capabilities, scope, policy/rule versions, dependency impact plan ve expiration taşır. Commit'te aynı hash ve yetki yeniden doğrulanır.
- Aynı idempotency key ve aynı canonical body aynı sonucu döndürür. Aynı key farklı body `409 IDEMPOTENCY_CONFLICT`; stale preview/source/decision/capability `409/403`dür.
- Manuel ekleme `source_type=MANUAL` immutable event revision'ı oluşturur. Düzenleme eski event'i overwrite etmez; yeni transaction version ve supersedes bağı oluşturur.
- `HESAPLAMADAN_CIKAR` kaydı audit/normal detay görünümünde tutar fakat seçilen effective_from itibarıyla resmî hesaplardan çıkarır. Neden ve hesap etkisi zorunludur.
- `SOFT_DELETE` kaydı normal liste ve resmî hesaplardan kaldıran tombstone revision'ıdır; ham kaynak/audit kalır. `RESTORE` önceki kaydı fiziksel olarak canlandırmaz, yeni etkin revision ve yeni calculation run üretir.
- Değişiklik veya geri alma iptal/mükerrer/settlement/instrument/link tutarlılığını belirsiz hale getirirse commit ilgili domain publish kapısında durur veya `PENDING_USER_APPROVAL` görevi üretir; kullanıcı onayı olmadan kritik ekonomik etki yayımlanmaz.
- `MANUAL_ALLOCATION_OVERRIDE`, kullanıcının cari azaltan bir olayın hangi uygun fatura lotlarına ne kadar bağlanacağını seçmesidir. Toplam seçili allocation olay tutarını aşamaz; customer/currency/effective-time sınırı korunur; kullanılmayan tutar normal FIFO/unallocated kurallarına döner.
- Allocation override preview'i varsayılan FIFO ile önerilen override'ı; eski/yeni lot açık tutarlarını, kapanma günlerini, aging/29+, CEI/performans etkisini ve geri alma sonucunu yan yana gösterir. Commit Paket 10 müşteri zincirini immutable replay eder.
- Manuel fatura–teslim linki veya operasyonel belge override'ı ham anahtarları değiştirmez; iki source id ve evidence version'a bağlıdır. Kaynak kimlik/revision değişirse karar otomatik reuse edilmez.
- Kullanıcı tarafından değiştirilmiş doğal anahtar yeni kaynak yüklemesinde gelirse `previous_source (O)`, `active_effective/manual (M)` ve `new_source (N)` alan bazlı üçlü karşılaştırılır.
- `N=O` ise kaynak değişmemiştir; manuel karar korunur, ikinci ekonomik olay yoktur ve `OVERRIDE_REAPPLIED_UNCHANGED_SOURCE` bildirimi oluşur.
- `N≠O` ise kayıt sessiz upsert edilmez. Yeni source revision immutable saklanır; `MANUAL_SOURCE_CONFLICT/PENDING_USER_APPROVAL` açılır ve son onaylı manuel/effective revision resmî hesapta kalır.
- Üçlü diff her alan için eski kaynak, etkin manuel, yeni kaynak, değişim sahibi, veri tipi, kritiklik, before/after ekonomik etki ve candidate resolution taşır. Kritik alanlar customer, type/direction, amount, currency, effective/due date, record status, belge/araç no ve event/link kimlikleridir.
- Conflict kararları `KEEP_MANUAL`, `ACCEPT_NEW_SOURCE`, `FIELD_MERGE`, `EXCLUDE_FROM_CALCULATION`, `KEEP_SOFT_DELETED`, `RESELECT_LINK`tir. `FIELD_MERGE` alan bazlı provenance taşır; invariant/customer/currency/domain doğrulamasını atlayamaz.
- Kullanıcı karar verene kadar yeni kaynak ikinci event, iptal, allocation, araç risk veya rapor sonucu üretmez. Kritik bekleyen değişiklik etkilenen raporlarda `PENDING_SOURCE_UPDATE` coverage/uyarı durumu taşır; ilgisiz kayıtların güvenli publish'i ayrı scope kurallarıyla devam edebilir.
- Field source policy yalnız açık `AUTO_ACCEPT_SOURCE` veya `LOCK_MANUAL`dır; source kind + transaction type + field + tenant/dealer + validity ile dar kapsamlı, versioned ve geri alınabilirdir. Policy customer/currency/type/invariant, iptal, instrument veya RLS güvenlik kapılarını aşamaz.
- `AUTO_ACCEPT_SOURCE` yalnız policy kapsamındaki alan değişikliğini kabul eder; yeni source yine raw/revision/audit ve domain validation'dan geçer. `LOCK_MANUAL` kaynağı silmez; conflict/evidence görünürlüğünü ve kritik bildirimleri korur.
- Toplu conflict/override kararı yalnız aynı source kind, transaction type, reason, field set, policy version ve aynı güvenlik kapsamındaki kayıtlar için preview edilebilir. Kritik customer/currency/type veya instrument link değişikliklerinde toplu otomatik onay yasaktır.
- Her commit tek transaction'da transaction/override/conflict decision revision, audit evidence links, dependency invalidation/replay request, current projection ve transactional outbox üretir. Hata/rollback önceki etkin revision ve calculation run'ı korur.
- Downstream impact registry en az Paket 07 invoice/revenue, Paket 08 collection/instrument, Paket 09 credit adjustment, Paket 10 ledger/FIFO/aging/3-6-12 facts, Paket 10A Fatura Kontrol, Paket 12 metrics/reports ve Paket 14 semantic cache invalidation olaylarını taşır.
- Paket en az `manual_transactions`, `manual_transaction_versions`, `manual_override_versions`, `manual_transaction_evidence`, `manual_mutation_previews`, `manual_mutation_commits`, `manual_source_conflicts`, `manual_source_conflict_fields`, `manual_conflict_decision_versions`, `manual_field_source_policy_versions`, `manual_allocation_override_versions`, `manual_link_override_versions`, `manual_dependency_impact_plans`, `manual_mutation_outbox` varlıklarını kurar.
- RLS/capabilities en az `financial_transaction.view`, `mutate`, `exclude`, `soft_delete`, `restore`, `audit`, `manual_source_conflict.view/resolve`, `manual_source_policy.manage`, `manual_allocation.override`, `manual_link.override`, `manual_evidence.upload/view` olarak ayrılır. Service role actor/capability/scope kontrolünü atlayamaz.
- API; type schema/list, validate/preview/commit, version history, exclude/delete/restore, conflict queue/detail/preview/commit, field policy, allocation override ve impact/replay status uçlarını ayrı tutar. Read endpoint'e gizli mutation konulmaz.
- UI tek ortak kabukta işlem türü seçimine göre domain alanlarını açar; tür değiştiğinde eski türün uygunsuz alanlarını temizler ve yeniden validate eder. Before/after, etkiler, warnings/blocked reasons, provenance, evidence ve açık confirmation tek ekranda görünür.
- AI mutation araçları yalnız tipli draft ve preview oluşturabilir. Kullanıcıya etkileri açıklayıp açık onay istemeden commit çağıramaz; onay bağlamı preview hash/id ve expiration'a bağlıdır. AI soft-delete'i fiziksel silme, acknowledgement'ı çözüm veya manuel kaydı kaynak Excel diye sunamaz.
- Normal rapor ve AI cevapları manuel katkıyı source/manual olarak ayırır; bekleyen conflict'i, aktif effective revision'ı ve calculation run'ı açıklar. Çözülmemiş yeni kaynak değeri sonuçta kullanılamaz.
- Mevcut `transactionMutations.ts`, `aiMutationToolRegistry.ts`, `archiveService.ts`, `customerState.ts`, transaction types ve manual management testleri yalnız karakterizasyon/regresyon kaynağıdır. Frontend state/IndexedDB mutation'ı, fiziksel silme, ham satır overwrite ve AI'nin doğrudan commit'i hedefe taşınmaz.
- Feature flag `manual_transactions_v2` varsayılan kapalıdır. Paket 12 ileri analiz, Paket 14 canlı AI commit orkestrasyonu ve Paket 15 cutover bu pakette erkenden açılmaz.

## Paket 12A Temel finansal read model ve mutabakat — kesin teknik karar

- Paket 12A'nın ön koşulları Paket 00, 01, 02, 07, 08, 09, 10 ve 11 ile Paket 13'ün metric registry, dependency graph, immutable calculation run ve result publication çekirdeğidir. Paket 12B–12E, Paket 14 ve Paket 15 downstream tüketicidir.
- Paket 10 müşteri defteri, receivable lot, FIFO allocation, açık fatura, aging ve temel 3/6/12 gerçekleşmiş gerçeklerin tek resmî sahibidir. Paket 12A bunları yeniden sınıflandırmaz veya ikinci FIFO çalıştırmaz; yayımlanmış Paket 10 sonuç kimliklerini bağlayarak günlük ve dönemsel finansal read model üretir.
- Paket 08 açık Çek/Senet lifecycle ve riskinin; Paket 07 ticari fatura/ciro olayının; Paket 09 IADE/HIZMET sınıfının; Paket 11 etkin manuel revision ve çözülmemiş kaynak çatışmasının sahibidir. 12A hiçbir upstream ham olayı düzeltmez veya sessiz fallback ile yeniden yorumlamaz.
- Bütün sonuçlar `tenant/dealer, scope_type/id, currency, as_of_date veya period, knowledge_cutoff, source_run_set, metric/rule versions, calculation_run_id` ile kimliklenir. `as_of_date` Europe/Istanbul yerel gün sonunu içerir; gelecekte bilinen revision geçmiş knowledge cutoff'a sızmaz.
- V1 resmî sonuçlar TRY zinciridir. Başka currency çevrilmez veya TRY ile toplanmaz; kur kanıtı olmayan kapsam `UNSUPPORTED_CURRENCY/BLOCKED_COVERAGE`dır.
- `financial_daily_positions` her müşteri ve gün için cari bakiye, pozitif borçlu bakiye, açık lot toplamı, dağıtılmamış alacak, açık Çek, açık Senet ve toplam riski ayrı exact decimal alanlarda tutar. `total_exposure=max(0, customer_balance)+cheque_exposure+note_exposure`; negatif cari araç riskini mahsup etmez.
- `receivable_lot_daily_ownership` açık lot parçasının orijinal belge/tarih, o günkü sorumlu müşteri/temsilci/SSM, açık tutar, yaş, standart aging dilimi, 29+ durumu, devir/virman sınıfı ve upstream lot/allocation kimliklerini taşır. Virman yaşı sıfırlamaz; hedef sorumluluğu virman tarihinden önce başlamaz.
- `instrument_daily_positions` araç yüz değeri, türü, kabul/vade/sonuç tarihleri, kesin lifecycle durumu, açık risk tutarı, müşteri ve günlük organizasyon sahipliğini Paket 08 sonucundan materialize eder. Kabul cariyi azaltır ve araç riskini açar; gerçek ödeme araç riskini azaltır fakat cariyi ikinci kez azaltmaz.
- Günlük organizasyon sahipliği temporal Master ve `FIN-017F` kuralına göre belirlenir. Fatura satış sorumluluğu fatura günündeki; allocation/tahsilat sorumluluğu allocation günündeki; günlük açık risk sorumluluğu ilgili gündeki organizasyondur. Belirsiz hiyerarşi yanlış temsilciye dağıtılmaz, şirket kapsamı ve DQ'da kalır.
- Paket 12A `FIN-006..012` ve `FIN-019..025A` için upstream exact sonuçları aynı kimliklerle sunar; kopya formül sonucu üretmez. `FIN-013/013A/013B`, `FIN-014/014A/014B/014C`, dönemsel `FIN-026..031A`, `FAN-020/021` ve risk köprüsü girdisi olan sınıflı günlük olay deltalarının publication sahibidir.
- Muhasebesel DSO yalnız `Σ günlük gün sonu pozitif açık ticari alacak / Σ dönem ticari satış faturası`dır. Aylık veya tamamlanmış 3/6/12 pencerede bütün gün/payda yeniden toplanır; aylık DSO ortalaması, dönem sonu bakiye yaklaşımı veya Ortalama Açık Fatura Yaşı kullanılamaz.
- DSO günlük alacağında devir/virmanla taşınan açık lot bulunur; ticari satış paydasında devir, virman, IADE/HIZMET, SATIN ALMA ve Sellout TL bulunmaz. Satış sıfırsa sonuç null ve `NO_SALES_WITH_OPEN_RECEIVABLE/NO_ACTIVITY`; eksik açılış veya gün coverage'ı resmi sonucu `PARTIAL/BLOCKED` yapar.
- 29+ CEI yalnız uygun 29+ havuz ve allocation parçalarından lot bazlı hesaplanır. Nakit, normal Havale, Çek/Senet kabulü ve IADE/HIZMET allocation'ı ayrı başarı sınıflarıdır; Çek kapama Havalesi, settlement ikinci etkisi, `DEVIR_ALACAK`, virman, iptal ve soft-delete başarı değildir.
- IADE/HIZMET 3/6/12 standart `ECONOMIC` ödeme hızı, ekonomik tahsilat toplamı ve tahsilat/fatura oranına allocation/olay sözleşmesindeki kadar girer; `CASH_ONLY` hızdan dışlanır. SATIN ALMA bütün müşteri fatura, tahsilat, gün, DSO, CEI ve risk sonuçlarında sıfır katkılıdır.
- 3/6/12 pencere seçilen `period_end_month` ile biten tamamlanmış gerçek takvim aylarıdır. `N×30 gün`, upload tarihi ve Sellout ay filtresi değildir. Cari ay yalnız ayrı `MTD/PARTIAL`; eksik ay sıfır sayılmaz.
- `financial_event_deltas` her kanonik olayın cari, açık lot, ticari fatura, ekonomik tahsilat, cash-like tahsilat, araç riski ve toplam risk etkisini ayrı kolonlarda taşır. Çek/Senet kabulünde cari `-X`, araç `+X`, toplam risk `0`; settlement'ta cari `0`, araç/toplam risk `-X`; şirket içi virmanda şirket toplamı `0`dır.
- İade/iptal/manual restatement eski günlük satırı overwrite etmez. En erken etkilenen tarihten yeni immutable 12A run'ı oluşur; yalnız etkilenen müşteri, iki taraflı virman kapsamı, organizasyon üstleri, dönemler ve bağlı metrikler invalidation alır.
- `financial_reconciliation_runs/items` en az `balance=open_lots−unallocated_credit`, lot principal, azaltan olay, aging toplamı, instrument lifecycle, müşteri→organizasyon→şirket rollup, virman net sıfır ve `opening position + classified deltas = closing position` denkliklerini kanıtlar.
- Parasal/kimlik/lot/allocation/instrument/virman denkliği bozuksa veya kritik kaynak eksikse durum `NOT_READY` ve publish blokajıdır. `READY_WITH_WARNINGS` yalnız bütün parasal denklikler exact sağlanırken sonucu değiştirmeyen, görünür non-critical coverage uyarılarında kullanılabilir. Tam ve uyarısız sonuç `READY`dır.
- `period_coverage_results` kaynak, zaman, müşteri, tutar, allocation, instrument, hierarchy ve manual-conflict boyutlarını ayrı tutar. Tek keyfî ortalama güven yüzdesi yoktur. Sonuç `COMPLETE`, `PARTIAL`, `BLOCKED` veya `NOT_APPLICABLE`; rapor güveni `HIGH/MEDIUM/LOW/INSUFFICIENT` olarak sürümlü policy ve metric eligibility ile türetilir.
- Çözülmemiş kritik Paket 11 çatışmasında son onaylı etkin değer hesapta kalır; pending yeni kaynak ikinci etki üretmez. Etkilenen kapsam `PENDING_SOURCE_UPDATE` olarak coverage ve mutabakat manifestinde görünür.
- Run akışı `request/plan → pin upstream manifests → calculate daily positions/deltas/period metrics → reconcile → publish active pointer + outbox`tır. Aynı manifest/rule/code aynı output hash'i üretir; stale upstream run publish'i `409`, rollback önceki active run'ı korur.
- Minimum API ailesi run preview/start/status/publish, daily positions, lot ownership, instrument positions, event deltas, reconciliation summary/items, coverage, DSO, CEI ve 3/6/12 financial-flow sorgularıdır. Bütün liste cursor'ları calculation run'a pinlenir; read endpoint mutasyon içermez.
- UI temel finansal görünümünde cari, açık lot, dağıtılmamış alacak, açık Çek, açık Senet ve toplam riski ayrı kartlar olarak gösterir; seçilen ay/as-of, tamamlanmış 3/6/12, `ECONOMIC/CASH_ONLY`, coverage ve run görünürdür. DSO, Ortalama Açık Fatura Yaşı, Fatura Kapama Günü ve Tahsilat Gerçekleşme Günü aynı etiketle sunulamaz.
- Drill-down zinciri sonuç→gün/period numerator-denominator→müşteri/org katkısı→lot/allocation/instrument→upstream event/source revision şeklindedir. Normal kullanıcı ham kanıt yetkisi olmadan source içeriği göremez.
- RLS/capability ayrımı en az `financial_position.view`, `financial_metric.view`, `financial_reconciliation.view/run/publish`, `financial_coverage.view`, `financial_audit.view`tır. Service role tenant/dealer, actor ve scope sınırını atlayamaz.
- AI araçları `get_financial_position`, `get_financial_reconciliation`, `get_accounting_dso`, `get_aged_receivable_cei`, `get_payment_speed` ve `explain_financial_metric` read araçlarıdır. Her cevap exact metric id, run, as-of/period, mode, pay/payda, coverage, exclusions ve drill-down refs taşır; AI bu pakette mutasyon yapamaz.
- Mevcut `cariCalculations.ts`, `customerService.ts`, `customerAnalytics.ts`, `customerQueries.ts`, `AiRiskAnalysisPage.tsx`, `AiRepPerformancePage.tsx`, AI read tool/declaration dosyaları ve testleri yalnız karakterizasyon/regresyon kaynağıdır. Eski yaklaşık DSO/CEI, `30/60/90 overdue`, net bakiye paydayı kullanan oran, client-side skor veya otomatik sevkiyat önerisi yeni resmî modele taşınmaz.
- Paket 12A sağlık skoru/limit/temsilci karnesi (12B), kohort/migration/yoğunlaşma (12C), tahmin/sinyal/senaryo (12D), rapor artifact'ı (12E), canlı AI orkestrasyonu (14) veya cutover (15) uygulamaz.
- Feature flag `financial_read_models_v2` varsayılan kapalıdır. Paket kabul edilmeden mevcut dashboard/AI sonuçları resmî 12A sonucu diye yeniden etiketlenmez.

## Paket 12B Finansal skor, iç limit ve organizasyon karnesi — kesin teknik karar

- Paket 12B'nin doğrudan ön koşulları Paket 12A'nın yayımlanmış günlük pozisyon/DSO/CEI/coverage/mutabakat sonuçları ve Paket 13 metric registry/calculation-run çekirdeğidir. Paket 07–11 bağımlılıkları 12A üzerinden gelir. Paket 12C–12E, 14 ve 15 downstream tüketicidir.
- Paket üç ayrı calculator ailesidir: müşteri finansal sağlık skoru (`FIN-015*`), sistem önerilen toplam risk limiti (`FIN-016*`) ve temsilci/SSM finansal performans karnesi (`FIN-017*`). Ortak policy/coverage/publication altyapısı kullanırlar fakat formülleri veya sonuç anlamları birleştirilmez.
- Sağlık skoru, limit ve karne yalnız analitik sonuçtur. Hiçbiri satış, tahsilat, cari, müşteri durumu, sevkiyat, prim veya etkin limiti otomatik değiştiren finansal olay üretemez.
- Müşteri sağlık skoru v1 ağırlıkları aging `%35`, son 12 tamamlanmış ay 29+ CEI `%25`, toplam risk yükü `%20`, gerçek fatura kapanma davranışı `%10`, Çek/Senet güvenilirliği `%10`dur. DSO tanısal bağlamdır; korelasyon nedeniyle skora ikinci kez eklenmez.
- Aging bileşeni `100−Σ(bucket_share×penalty)`dir; cezalar `0–28:0`, `29–45:25`, `46–60:50`, `61–89:75`, `90+:100`. Açık alacak yoksa bileşen null, otomatik 100 değildir.
- CEI bileşeni yalnız tam coverage'lı son 12 tamamlanmış ay `FIN-014` sonucudur. Uygun 29+ havuz yoksa null; gerçek havuz ve sıfır uygun kapama varsa gerçek 0'dır.
- Risk yükü `total_exposure / covered_12m_average_monthly_commercial_sales` ay sayısıdır. Puan kırıkları `≤1:100`, `1–2:80`, `2–3:60`, `3–4:40`, `4–6:20`, `>6:0`; satış paydası/coverage yoksa null. Devir/virman/IADE/HIZMET/SATIN ALMA ticari satış paydasını büyütmez.
- Kapanma davranışı son 12 tamamlanmış ayın tutar-ağırlıklı gerçek fatura kapama günüdür. `≤28:100`; `29–45:100→70`, `46–60:70→40`, `61–90:40→10` doğrusal; `>90:0`. Açık/kısmi fatura ve dağıtılmamış alacak kapanmış gibi paydaya girmez.
- Araç güvenilirliği yalnız sonucu gözlenmiş vadesi gerçekleşmiş araçlarda `100×(1−confirmed_dishonored_amount/outcome_observed_matured_amount)`dır. Vadesi gelmemiş veya sonucu bekleyen araç paydaya girmez; pending durum ayrıca risk bayrağıdır. Sonradan recovery ilk olumsuz kanıtı silmez.
- Null bileşenler kalan aktif ağırlık toplamına göre yeniden ağırlıklandırılır. Kullanılabilir başlangıç ağırlığı `%60`ın altındaysa veya uygun bileşen sayısı ikiden azsa skor null/`INSUFFICIENT_DATA`dır. Formüller doğal `0–100` dışında sonuç üretirse clamp edilmez, `BLOCKED_DQ` olur.
- Sağlık bantları sürümlü olarak `85–100 SAGLIKLI`, `70–<85 IZLEMELI`, `50–<70 YUKSEK_RISK`, `<50 KRITIK_RISK`tir. Güven `HIGH/MEDIUM/LOW/INSUFFICIENT` ayrı sonuçtur; puana ceza/bonus olarak karıştırılmaz.
- Skordan bağımsız risk bayrakları en az 90+ açık tutar, teyitli karşılıksız/iade araç, sonucu bekleyen vadesi geçmiş araç, satışsız açık risk, sürümlü maddilik kuralıyla hızlı bozulma, kritik coverage ve unresolved manual/source conflict'tir. Bayrak skor bandının içinde saklanmaz ve otomatik işlem değildir.
- Excel/Master kredi limiti raw/audit dışında hiçbir skor, önerilen limit, fallback, kullanım veya karşılaştırma hesabına giremez.
- Sistem limit formülü `round_unit(min(operating_need_limit, cash_realization_capacity_limit) × behavior_factor)`dır. Mevcut risk öneri formülünün girdisi değildir; yalnız kullanım ve boşlukta tüketilir.
- `operating_need_limit`, onaylı uyumlu Paket 12D tahmini varsa gelecek 28 günlük ticari fatura dağılımının `%75` quantile'ıdır. Böyle tahmin yoksa son 12 tamamlanmış ve tam coverage'lı aydaki bütün takvim uyumlu kayan 28 günlük ticari fatura toplamlarının `PERCENTILE_CONT(0.75)` sonucudur; method/fallback açıkça saklanır.
- `cash_realization_capacity_limit`, aynı tarihsel coverage içindeki kayan 28 günlük gerçek `cash_risk_relief` toplamlarının `PERCENTILE_CONT(0.25)` sonucudur. Nakit, normal Havale ve Çek/Senetin gerçek ödemesi bir kez girer; araç kabulü, ikinci Çek kapama Havalesi, IADE/HIZMET, devir alacak, iptal, virman ve manuel bakiye düzeltmesi girmez.
- Davranış faktörü sağlık skorundan tek yönlüdür: `85–100:1.00`, `70–<85:0.80`, `50–<70:0.50`, `<50:0.25`. Limit sağlık skoruna geri beslenmez; döngüsel bağımlılık publish blokajıdır.
- V1 yuvarlama birimi `1.000 TRY`, yöntem `HALF_UP`tır; ham exact tutar ve yuvarlanmış öneri ayrı saklanır. Coverage/güven yetersizliği, yeni müşteri, kritik açık araç/manual conflict veya hesaplanamayan ihtiyaç/kapasite sahte tutar üretmez; `MANUAL_REVIEW/NEW_CUSTOMER_REVIEW` olur.
- Limit kullanımı `total_exposure/effective_internal_limit`, headroom `max(0,effective_internal_limit−total_exposure)`dır. Limit 0/null ise kullanım/headroom null ve neden kodludur; limit aşımı yalnız `EXCEEDED` bayrağı/inceleme görevidir.
- Normal koşulda önceki etkin limite göre mutlak değişim `%25`i aşarsa governed recommendation kullanıcı incelemesi bekler. Önceki limit 0/null ise yüzde uydurulmaz. Kritik riskte daha büyük düşüş önerilebilir fakat otomatik uygulanmaz.
- İç limit override'ı immutable, gerekçeli, başlangıç/bitiş ve next review tarihli kullanıcı kararıdır. Yeni sistem önerisi aktif override'ı sessiz ezmez; karşılaştırmalı preview ve açık onay gerekir. Süresi dolan override otomatik olarak geçmiş öneriyi canlandırmaz, güncel öneriyle yeni effective decision üretir.
- Temsilci/SSM finansal karne v1 ağırlıkları 29+ CEI `%40`, 29 güne kalmadan kapanma `%30`, vadesi gelen araç gerçekleşmesi `%20`, limit disiplini `%10`dur. Null yeniden ağırlıklandırma için yine başlangıç ağırlığı `≥%60` ve en az iki bileşen gerekir.
- Pre-29 cohort, orijinal lot tarihinden 29. günü seçilen tamamlanmış aya düşen düzeltilmiş principal'dır. Pay yalnız 28. gün sonuna kadar ekonomik allocation ile kapanan tutardır; DEVIR_ALACAK, iptal, soft-delete, virman ve reassignment başarı değildir.
- Araç gerçekleşme oranı, dönemde vadesi gelen geçerli araçların dönem sonuna kadar gerçekten ödenen tutarı / toplam vadesi gelen tutarıdır. Pending, ödenmemiş, iade ve karşılıksız paydada kalır; sonradan ödeme ayrı recovery olayıdır.
- Limit disiplini `100×(1−Σ daily_excess_amount/Σ daily_positive_total_exposure)`dır. Günlük etkin limit yoksa bileşen null; kullanıcı onaylı istisna etkin limit revision'ında ve context'te görünür.
- Finansal karne tamamlanmış takvim ayı içindir. MTD ayrı partial'dır; satış/litre/hedef sonucu finansal skorla tek puana birleştirilmez ve bu paket prim/hakediş üretmez.
- Sorumluluk temporal `FIN-017F` sonucudur: fatura sahibi fatura tarihinde, allocation sahibi allocation tarihinde, günlük risk/limit sahibi ilgili günde belirlenir. Reassignment kalan portföyü performans dışı taşır; geçmiş başarı/başarısızlığı yeniden yazmaz.
- SSM skoru temsilci skorlarının ortalaması değildir; CEI havuzu/payları, pre-29 cohort, vadesi gelen/ödenen araç ve günlük limit alanları SSM kapsamından ham yeniden toplanır. Belirsiz SSM ataması sessiz dağıtılmaz.
- Pasif/iptal müşteri as-of görünümde pozitif borçlu bakiyesi `≥100 TRY` ise; dönem karnesinde açılışta veya herhangi bir günde bu eşiğe ulaştıysa dönem sonuna kadar cohort'ta kalır. Sonradan eşik altına düşmesi gerçekleşmiş tahsilatı geçmişten silmez.
- Her score/limit/performance result policy version, calculation run, as-of/period, component raw inputs, numerator/denominator, active/original weights, null reason, coverage/confidence, flags, contributions, temporal responsibility ve upstream result refs taşır.
- Run aynı pinli 12A manifesti ve policy/code version'la deterministiktir. Policy değişikliği, upstream restatement, hierarchy change veya override kararı eski result'ı overwrite etmeden yalnız etkilenen müşteri/org/dönem için yeni immutable run/outbox üretir.
- API sağlık sonucu/detail/history, limit recommendation/preview/decision/history, representative/SSM performance/detail/distribution ve policy read uçlarını ayırır. Salt-okunur metric route içine mutasyon gizlenmez.
- RLS/capabilities en az `financial_score.view`, `financial_limit.view`, `financial_limit.review/override`, `financial_performance.view`, `financial_policy.view/manage`, `financial_score.audit` olarak ayrılır. Kullanıcının göremediği müşteri contribution'ı özet, export veya AI üzerinden sızamaz.
- AI score/limit/karne sayılarını prompt içinde hesaplamaz. En güçlü/zayıf bileşen, puan etkisi, null/coverage, bağımsız risk bayrakları, dönem farkı, devir/virman/reassignment ve limit provenance'ını açıklar; skor düşük diye sevkiyat durdurma, limit değiştirme veya prim cezası uygulayamaz.
- Mevcut `calculateFinancialHealthScore`, `calculateCEI`, `shadowLimit`, `netErime`, `primRiskCezasiYeni`, hardcoded 30/60/90 eşikleri ve risk/prim sayfaları yalnız karakterizasyon kaynağıdır. Sabit fallback, clamp, Master limit fallback, çift risk cezası ve otomatik sevkiyat/prim kararı hedefe taşınmaz.
- Paket 12B kohort/migration/yoğunlaşma (12C), tahmin/stres/sinyal (12D; yalnız varsa onaylı forecast input olarak tüketilir), report artifact (12E), aksiyon atfı (12F), canlı AI handler (14) veya cutover (15) uygulamaz.
- Feature flag `financial_scoring_limits_v2` varsayılan kapalıdır. Kabul edilmeden mevcut sağlık/risk/prim ekranı resmî 12B sonucu diye yeniden etiketlenmez.

## Bütün raporlarda AI Odak Analiz alanı — kesin çapraz katman kararı

- Her domain raporu, liste kartı veya uygun detay ekranı `AI Odak Analiz` adlı ortak bir yorum alanı sunabilir. Bu alan yeni metrik hesaplamaz; ilgili domain'in yayımlanmış result/evidence manifestini önem sırasıyla yorumlar.
- Sorumluluk üçe ayrılır: domain paketi tipli `focus_context` ve deterministik `focus_digest` üretir; Paket 12E ortak gösterim/widget/snapshot/export altyapısını sağlar; Paket 14 kanıt bağlı doğal dil claim'lerini üretir. UI veya prompt formül yazamaz.
- Liste ekranında bütün satırlar için otomatik ayrı model çağrısı yasaktır. Varsayılan kapalı/özet görünüm server-side deterministik digest'tir. Tam AI anlatısı kullanıcı açtığında, seçili kayıtlar için toplu istediğinde veya rapor snapshot'ı yayımlandığında üretilir ve manifest+yetki+policy hash ile cache edilir.
- `focus_context` en az `focus_key, domain, entity_type/id, report/widget, scope, as_of/period, source/result/run ids, domain state/priority, metric/evidence refs, coverage, exclusions, freshness, allowed actions` taşır.
- `ai_focus_analysis` en az başlık, tek cümlelik durum özeti, en fazla üç belirleyici bulgu, ilgili karşılaştırma/katkı, risk veya fırsat, coverage/belirsizlik, önerilen sonraki kontrol/aksiyon, claim types ve evidence refs taşır. Kanıt yoksa yorum uydurmak yerine `Yorum için veri yetersiz` gösterilir.
- Gösterim alanları: rapor üstünde filtre/KPI sonrasında portföy özeti; liste/kart satırında açılır kısa analiz; detay drawer/sayfasında kanıt ve drill-down; PDF'de yalnız maddi seçilmiş claim'ler; XLSX'te claim/evidence tablosu. Aynı snapshot bütün yüzeylerde aynı claim setini kullanır.
- Mevcut uygulamanın görsel ve etkileşim karakteri bağlayıcı regresyon referansıdır: rapor içindeki koyu cam görünümlü akıcı AI yorum paneli, durum rozeti, belirgin sol durum çizgisi, `CFO Aksiyon Tavsiyesi` benzeri ikinci anlatı alanı; kart üzerinde `✨ GÜNLÜ ODAK ANALİZİ` hover/focus penceresi, yazı yazma etkisi ve yaklaşık sekiz saniyelik yorum dönüşümü; geniş müşteri detay penceresi, sekmeli `Analiz` görünümü, metrik kartları, trend/dağılım grafikleri ve mor-mavi içgörü kartı korunur. Yeni tasarım bunları kuru madde listesine indirgemez.
- Korunan sunum eski hesaplama anlamının korunması değildir. Akıcı paragraflar yalnız `focus_digest/claim set` içindeki kanıt bağlı bulguların doğal dil sunumudur. Mevcut `shadowLimit`, Master limit fallback'i, sabit ödeme profilleri, yanlış 30/60/90 veya 90/180/365 dönem eşlemesi, sözleşmesel olmayan `kontrat vadesi` ve dayanağı olmayan kesin neden/limit/sevkiyat tavsiyeleri reddedilir.
- Karttaki `AI Odak Analiz ↗` eylemi geniş müşteri detay penceresini doğrudan `Analiz` sekmesinde açar; mevcut `Ekstre & Detay ↗` eylemi ekstre bağlamını korur. Hover olmayan dokunmatik ortamda görünür düğme, klavyede focus/Enter/Space eşdeğeri bulunur.
- Yazı yazma ve dönüşümlü yorum davranışı masaüstünde korunur; kullanıcı pencerenin üzerine geldiğinde veya klavye odağı içindeyken okunabilirlik için dönüşüm duraklar. `prefers-reduced-motion` etkinse yazı yazma/fade/dönüşüm animasyonu kapatılır ve tam metin durağan gösterilir.
- Alan durumları domain severity'sini yeniden hesaplamaz. `BLOCKED_DATA`, `CRITICAL_REVIEW`, `ACTION_NOW`, `ATTENTION`, `CLEAR/STABLE_WITH_EVIDENCE` gibi etiketler yalnız domain tarafından sağlanan state/priority mapping policy'sinden gelir; model kendi risk rengi veya sevkiyat kararı icat edemez.
- Her claim `FACT/INFERENCE/FORECAST/SCENARIO/RECOMMENDATION` türü, materiality, confidence, supporting result/evidence ids ve caveat taşır. FACT ile öneri aynı cümlede etiketsiz birleştirilemez; kanıtsız neden kesinleştirilemez.
- Sevkiyat raporunda sipariş odak analizi yalnız bugünkü Paket 07B sipariş/sevkiyat kartı, müşteri/organizasyon kimliği, Paket 08/08A resmî-geçici ödeme bağlamı, Paket 10 cari/açık lot/FIFO/aging, Paket 10A varsa teslim kontrolü ve Paket 12A/12B finansal bağlamını yetki ve coverage sınırında birleştirir.
- Sevkiyat analizinin sırası `sipariş operasyon durumu → müşteri cari/risk bağlamı → resmî ödeme/peşin kanıtı → eski açık fatura/FIFO etkisi → araç riski → veri boşluğu → önerilen kullanıcı kontrolü`dür. Sipariş tutarı eksi ödeme ile “ödenen/kalan” uydurulmaz.
- `BELGELER_TEMP` yalnız geçici operasyon sinyalidir. Resmî tahsilat/allocation olmadan “ödendi, peşin alındı, fatura kapandı” claim'i üretmez. Çek/Senet kabulü nakit ödeme değildir; açık araç riski ayrıca görünür.
- Bugünkü sevkiyat kartı geçmiş sipariş raporuna dönüşmez. Teslim edilmiş/geçmiş belge analizi Paket 10A Fatura Kontrol veya ilgili tarihsel rapora yönlendirilir. `CLEAR_WITH_EVIDENCE` borçsuzluk veya gelecekte risksizlik değildir; `BLOCKED_DATA` durumunda davranış hükmü verilmez.
- Kart başına odak analizi en fazla bir durum cümlesi, üç kanıt, iki önerilen kontrol ve bir coverage notu gösterir. Daha fazla ayrıntı drill-down veya rapor paketindedir; model ham büyük tabloyu bağlama almaz.
- Kullanıcı `neden?` dediğinde aynı `focus_key/analysis_id` üzerinden takip eder; yeni filtre/as-of/run/permission değişiminde eski analiz stale olur ve yeniden oluşturulur. Eski claim audit'te kalır, güncel kartta sessizce yeniden kullanılmaz.
- AI Odak Analiz read-only'dir. Aksiyon düğmesi ayrı yetki kontrollü domain workflow veya Paket 11 preview'ına gider; anlatı içinden doğrudan mutation yoktur.
- RLS yalnız kullanıcının görebildiği metric/evidence/claim'i taşır. Cache anahtarı authorization scope, focus context, run/snapshot, policy/model/prompt version ve locale içerir; farklı yetkiler arasında paylaşılmaz.
- Erişilebilirlikte durum yalnız renk değildir; başlık, ikon+metin, kısa özet, `Neden böyle?`, `Kanıtları gör`, `Sonraki kontrol` ve güncellik/run bilgisi bulunur. Boş/loading/error/stale/blocked durumları ayrı tasarlanır.
- Ortak feature flag `ai_focus_analysis_v2` varsayılan kapalıdır. Domain digest'i bulunmayan raporda serbest promptla geçici yorum alanı açılmaz.

## Paket 12C Kohort, migration ve yoğunlaşma — kesin teknik karar

- Paket 12C'nin ön koşulları Paket 12A daily financial position/lot ownership/coverage/reconciliation, Paket 12B health/limit/temporal responsibility ve Paket 13 registry/run çekirdeğidir. Paket 12D/12E/14/15 downstream tüketicidir.
- Her kohort yalnız ilgili as-of/period ve knowledge cutoff'ta bilinen olay/dimension ile kurulur. Gelecekteki ödeme, iptal, müşteri durumu, temsilci veya segment geçmiş üyeliğe sızamaz.
- Ticari fatura, otomatik/manüel devir borcu ve transferred receivable lot origin class'ları ayrı tutulur. SATIN ALMA, Sellout, Belgeler ve sipariş tutarı principal değildir.
- Tutar, lot parçası, fatura ve müşteri adetleri ayrı ölçüdür. Kısmi allocation tutar başarısıdır; bütün principal kapanmadan fatura adedi tam kapanmış sayılmaz.
- `FAN-001` seçilen tek pozitif ölçü üzerinde Top-N/Pareto ve `HHI=10.000×Σshare²` üretir. Negatif cari pozitif riski mahsup etmez; sıfır toplam null; HHI neden veya risk kararı değildir.
- `FAN-002` grain'i principal slice'ın ay başı bucket/owner durumundan ay sonu bucket veya `ECONOMICALLY_CLOSED/TRANSFERRED_OUT/REASSIGNED_OUT/NON_PERFORMANCE_EXIT` durumuna geçişidir. Dönem içi yeni/transfer/reassignment girişleri ayrı origin state'tir.
- Migration exact kontrolü `opening + new/transfer/reassignment in = closing open + economic close + transfer/reassignment out + non-performance exit`tir. Virman/reassignment tahsilat değildir; şirket neti 0'dır.
- `FAN-003` vintage horizon'ları 7/14/21/28/45/60/90 gündür. Payda yalnız horizon gününü gözlemleyecek kadar yaşlanmış adjusted principal; pay yalnız horizon gün sonuna kadar ekonomik kapanan principal'dır. Genç/açık invoice gelecek horizon'da sahte başarısızlık değildir.
- `FAN-004` amount-weighted survival `S(t)=Π(1−economic_close_amount_t/at_risk_amount_t)` sözleşmesidir. Açık principal cutoff'ta right-censored; virman/reassignment sahiplik değişimi; cancellation/soft-delete competing non-performance exit'tir.
- Survival yeterlilik v1 aynı seviyede en az 30 gözlemlenebilir invoice ve 10 ekonomik kapanma olayıdır. Fallback `CUSTOMER→REP→CHANNEL→COMPANY`; company de yetersizse null. Ticari ve devir serileri birleşmez; sonuç `INFERENCE`tır.
- `FAN-005` 29+ köprüsü `opening + newly aged + reinstatement + transfer/reassignment in − eligible aged settlement − non-performance exit − transfer/reassignment out = closing` denkliğidir. IADE/HIZMET ekonomik kapamada; DEVIR_ALACAK manual adjustment'tadır.
- `FAN-014` Master segmentini değiştirmeyen tek ana davranış segmenti ve çoklu evidence tag üretir. Priority: kritik manual/coverage, yeni-yetersiz, satışsız açık risk, araç ağırlıklı, kalıcı eski borç, 29+ toparlama, büyüyen risk, sağlıklı döngü, karma izlemeli.
- Segment v1 sınırları: üç ay gözlem; araç payı `≥50%`; kalıcı 29+ üç ay `≥50%`; toparlama 29+ tutarda `≥25%` azalış ve trailing-3 CEI `≥70`; büyüyen risk exposure `≥25%` ve satış büyümesinden `≥10` puan hızlı; sağlıklı skor `≥70` ve 29+ `<25%`. Maddilik `max(10.000 TRY, trailing-3 average exposure×5%)`dır.
- `FAN-022` yalnız aynı metric/version/unit/period/coverage uygun peers ile median/P25/P75/percentile üretir. Fallback `segment+channel+rep→segment+channel+SSM→segment+channel+company→channel+company→company`; her seviyede en az 10 eligible entity, yoksa null.
- Metric direction metadata'sı zorunludur; yüksek yüzdelik her metrikte iyi sayılmaz. Peer farkı nedensellik, kredi kararı veya temsilci adaleti hükmü değildir. RLS minimum-group koruması detail sızıntısını engeller.
- Asgari varlıklar cohort definitions/memberships, aging migration facts, vintage, survival, concentration, aged burden flow, behavior policy/results, peer policy/results, publication ve outbox'tır. Membership/result eski run'da update/delete edilmez.
- Run pin upstream/policies→membership→analyses→reconciliation→atomic publication/outbox akışıdır. Aynı manifest/policy/code aynı hash; restatement yalnız etkilenen cohort/scope/period'u yeni immutable run'da değiştirir.
- API concentration, migration, vintage, survival, aged burden, segment, peer ve cohort member uçlarını ayrı sunar. DTO result kind, measure, pay/payda/risk set, censoring/fallback, coverage, run ve drill-down taşır; cursor run'a pinlenir.
- UI heatmap, vintage, survival+risk table, 29+ waterfall, Pareto/HHI, segment ve peer percentile görünümünde table fallback ve coverage/censoring/transfer açıklaması verir. Artifact üretimi Paket 12E'dedir.
- AI migration'ı tahsilat başarısı, survival'ı kesin ödeme tarihi, HHI'yı kayıp, segmenti Master sınıfı veya peer farkını neden diye sunamaz. Her 12C ekranı en maddi üç kanıtı taşıyan AI Odak context/digest üretir.
- Feature flag `financial_cohort_analytics_v2` varsayılan kapalıdır. Mevcut yaklaşık aging/Pareto/risk görünümü resmî 12C sonucu diye yeniden etiketlenmez.

## Paket 12D Nakit tahmini, erken uyarı ve senaryo — kesin teknik karar

- Paket 12D'nin doğrudan ön koşulları yayımlanmış Paket 12A finansal position/coverage/reconciliation, Paket 12B health/effective internal limit, Paket 12C survival/concentration/segment sonuçları ve Paket 13 registry/run çekirdeğidir. Paket 12E/12F/14/15 downstream tüketicidir.
- Her run `as_of` gün sonu ve `knowledge_cutoff`ta pinlenir. Ufuk, as-of sonrasındaki `1–7, 8–14, …, 85–91` takvim günü olmak üzere 13 ardışık yedi günlük kovadır; Europe/Istanbul tarihi ve açık başlangıç/kapalı bitiş tarihleri sonuçta saklanır.
- Gerçekleşmiş `economic_collection`, `cash_risk_relief`, nakit dışı kapanış ve `FORECAST/SCENARIO` sonuçları ayrı türlerdir. IADE/HIZMET ve Çek/Senet kabulü ekonomik kapanış olabilir ama nakit değildir; Sellout TL, `BELGELER_TEMP`, KA irsaliye, sipariş tutarı, SATIN ALMA, devir/virman ve manuel bakiye nakit tahminine girmez.
- Fatura kaynaklı beklenen doğrudan nakit, mevcut açık ticari invoice principal'ının tarihsel competing-risk geçişlerinden yalnız `DIRECT_CASH/BANK_TRANSFER` cause-specific olasılığıyla üretilir. `INSTRUMENT_ACCEPTANCE` ve `NONCASH_RETURN_SERVICE` ayrı competing çıkıştır; nakit diye sayılmaz. Açık Çek/Senet ise yalnız gerçek settlement tutarı/zamanı için ayrı kalibre edilir. İki seri daha sonra tek kez toplanır.
- Baz görünüm iki kapsam taşır: `EXISTING_BOOK`, yalnız kesimdeki açık fatura ve açık araçlar; `EXTENDED_OPERATING`, buna yeterli geri testten geçmiş gelecek ticari fatura tahmini ve onun doğrudan nakit dönüşümünü ekler. Extended model yetersizse existing book yayımlanabilir, extended null/`INSUFFICIENT_HISTORY` olur; sıfır veya uydurma satış eklenmez.
- Ticari fatura tahmini yalnız pozitif resmî ticari fatura serisidir. En az 26 tam haftada trailing-median challenger; en az 52 tam haftada seasonal-naive challenger çalışır. Varsayılan model rolling-origin kapısından seçilir; 12B'nin 28 günlük operating-need P75'i yalnız `APPROVED` extended modelden tüketilebilir, aksi halde onaylı tarihsel fallback kullanılır.
- P25/P50/P75 ayrı haftalık noktaları toplamakla oluşturulmaz. V1, pinli residual bloklarından run hash'ine bağlı deterministik seed ile 1.000 yol üretir; müşteri/hafta bağı korunur, nonnegative state transition uygulanır. Her grain'de `P25≤P50≤P75`, 4/13 haftalık kümülatif değerler aynı yol toplamlarının quantile'ıdır.
- Rolling-origin backtest yalnız origin tarihinde bilinen revision/dimension'ları kullanır. En az 26 eligible origin gerekir. Challenger ancak hem 4 hem 13 haftalık WAPE'de seasonal/trailing-naive bazdan en az `%5` iyi, hiçbir zorunlu ufukta `%10`dan fazla kötü değil ve P25–P75 coverage `%40–%80` aralığındaysa `APPROVED` olur. Gerçek toplam 0 ise WAPE/bias null; MAE ve absolute error yine saklanır.
- Erken uyarı ayrı immutable occurrence'tır, sağlık skorunun içine gizlenmez. V1 eşikleri: yeni 29+ tutarı recent-3 ortalaması prior-3'ten en az `%20` ve maddi tutar kadar yüksek; 29+ payı en az `10` puan artmış; CEI en az `10` puan düşmüş; DSO en az `7 gün` ve `%15` yükselmiş; exposure en az `%20` büyümüş ve ticari fatura büyümesini en az `10` puan aşmış. Limit aşımı, vadesi geçmiş pending/olumsuz araç, satışsız maddi açık risk ve kritik manual/source conflict kendi exact state'leriyle sinyal üretir.
- Sinyal maddiliği `max(10.000 TRY, trailing-3 average total exposure×5%)`dır; küçük tabandaki büyük yüzde tek başına sinyal değildir. Cari ay karşılaştırması önceki ayların aynı geçen gün sayısıyla yapılır; eksik gün sıfır değildir. `OPEN/ACKNOWLEDGED/RESOLVED` lifecycle gerçeği değiştirmez; acknowledgement yalnız kullanıcı kaydıdır.
- Robust anomali için aylık en az 12 veya haftalık en az 26 tam gözlem gerekir. `robust_z=0.6745×(x−median)/MAD`, eşik `|z|≥3.5`; MAD 0 ise `Q1−3×IQR / Q3+3×IQR`, o da 0 ise uygun dönemsel kıyas+maddilik fallback'i kullanılır, aksi halde null. Anomali neden değildir.
- Tahsilat önceliği v1 ağırlıkları `%30 risk maddiliği + %25 aging şiddeti + %20 vadesi geçmiş araç riski + %15 bozulma + %10 limit aşımı`dır. Raw bileşenler aynı yetkili portföy içindeki `CUME_DIST×100` ile ölçeklenir; kullanılabilir başlangıç ağırlığı `<%60` ise skor null. Kritik manual/source conflict puansız `MANUAL_REVIEW` olarak listenin başında; kalanlar score DESC, material amount DESC, customer id ASC sıralanır.
- Tahsilat önceliği çalışma sırası önerisidir. Müşteriye otomatik temas, tahsilat kaydı, müşteri/limit/sevkiyat değişikliği veya “ödemeyecek” hükmü üretmez. Aksiyon sonucu/atfetme Paket 12F kapsamıdır.
- Senaryo motoru baz forecast/result'ı kopyalamadan referanslar ve gerçek tabloları değiştirmez. V1 şokları: doğrudan tahsilat `%25` düşük; tahsilat `14 gün` gecikmeli; gelecek ticari fatura `%25` yüksek/düşük; araç settlement olasılığı tarihsel P25; en büyük müşteri tahsilatı 0; birleşik olumsuz. Birleşik sıra `invoice shock→14 gün kaydırma→%25 haircut→instrument P25→top-customer zero`dur; aynı akış iki kez şoklanmaz.
- Top-counterparty testi, as-of pozitif total exposure DESC ve customer id tiebreak ile Top 1/5/10'u sabitler. `NEW_SALES_CONTINUE` ve `NEW_SALES_STOP` iki ayrı varsayımdır. Mevcut faturalar silinmez; yalnız varsayımsal gelecek akış değişir. Sonuç kayıp iddiası değil duyarlılıktır.
- Yönetimsel beklenen zarar resmî muhasebe karşılığı değildir. `scenario_expected_loss=positive_EAD×calibrated_PD×calibrated_LGD`; kalibrasyon için aynı cohort'ta en az 50 tam gözlemlenmiş müşteri-ufuk ve 10 stress event, LGD için 180 günlük tam recovery horizon gerekir. Yetersizse yalnız açık kullanıcı PD/LGD varsayımıyla `SCENARIO_ONLY`, aksi halde null. IADE/HIZMET ekonomik recovery olabilir; araç kabulü ancak 180 gün içinde gerçek settlement olursa recovery'dir.
- Her forecast/signal/priority/scenario sonucu run, policy/model/calibration version, result kind, scope/currency, as-of/horizon, base and upstream result refs, coverage/exclusions, fallback, input/output hash ve contribution/evidence refs taşır. Para birimleri onaylı FX politikası olmadan toplanmaz.
- Run akışı `pin upstream/policy/model→eligibility/calibration→forecast paths→backtest/model gate→signals/anomalies→priority→optional scenarios→reconcile→atomic publication/outbox`tır. Aynı manifest/sürüm/seed aynı sonuç hash'ini üretir; restatement eski sonucu overwrite etmez.
- UI 13 haftalık fatura doğrudan nakit/araç settlement/toplam bant grafiği, existing-vs-extended seçimi, actual-vs-forecast backtest, sinyal timeline/evidence, öncelik kuyruğu ve baz-vs-senaryo karşılaştırması sunar. FORECAST ve SCENARIO gerçekleşmiş değerlerden renk+etiket+desenle ayrılır; bütün grafiklerde tablo fallback vardır.
- AI araçları forecast/backtest/signal/anomaly/priority/scenario sonuçlarını yalnız exact result ids ile açıklar. “Şu tarihte kesin öder”, “bu müşteri kaybedilecek”, “muhasebe karşılığı”, “otomatik ara/engelle” diyemez. AI Odak digest en maddi üç forecast/signal/priority/scenario kanıtını, model güvenini ve next check'i taşır; mevcut akıcı AI görünümü korunur.
- Mevcut istemci `risk`, `cashflow`, `payment profile`, `shadowLimit`, sabit 18/28 gün, hardcoded müşteri profili veya genel tavsiye metinleri yalnız karakterizasyon kaynağıdır. Bunlar model, kalibrasyon, nakit tahmini veya öncelik skoru diye yeniden kullanılmaz.
- Feature flag `financial_forecast_signals_v2` varsayılan kapalıdır. Paket 12D report artifact (12E), aksiyon sonucu/atfetme (12F), canlı AI orchestration (14) veya cutover (15) uygulamaz.

## Paket 12E Rapor, grafik, drill-down ve artifact teslimi — kesin teknik karar

- Paket 12E'nin ön koşulları Paket 00/01/02 kimlik-yetki omurgası ve Paket 13 metric registry/immutable calculation run/publication çekirdeğidir. Her rapor ayrıca yalnız tükettiği domain paketleri kabul edilince açılır. Paket 14 yeni doğal dil claim üretimi için downstream'dir; deterministik snapshot, grafik ve export çekirdeğini bloke etmez.
- Paket hesap motoru değildir. Widget, chart, PDF, XLSX, PNG/SVG, drill-down, UI veya prompt domain metriği/formülü çalıştıramaz; yalnız yayımlanmış `metric_result_id/result_hash`, coverage ve evidence refs'i bağlar.
- `report_definition`, widget/filter/drill-down/chart bağı ve template `DRAFT→VALIDATED→APPROVED_ACTIVE→RETIRED` yaşam döngüsünde immutable sürümlenir. Normal kullanıcı yalnız approved-active sürüm çalıştırır; onay overwrite değil yeni auditli sürümdür.
- Tek `report_snapshot`; definition version, calculation/source run set, knowledge cutoff, canonical filter/scope/period/comparison, authorization scope, locale/timezone ve sonuç manifestini pinler. Published snapshot değişmez; yeni kaynak/metrik/policy yeni snapshot üretir.
- Manifest her hücre/seri/nokta için exact ve display value, unit/precision, result/run/version, state/reason, coverage/evidence; ayrıca totals, exclusions, unresolved, top-N+`DİĞER`, chart/table/drill/claim refs taşır. UI ve bütün artifact'lar aynı manifesti kullanır.
- Filtre şeması tipli ve allowlist'tir. Semantik olarak aynı filtre canonical JSON/hash üretir; `null/empty/ALL_AUTHORIZED/all-explicit` karışmaz. Kullanıcı kapsamı RLS ile kesişir ve yetkisiz değer varlığı sızdırılmaz.
- Sellout geçmiş dönem filtresi ayrı `YYYY-MM` aylarıdır. Finansal `ROLLING_3/6/12` tamamlanmış takvim ayı penceresidir; iki dönem modeli birbirine çevrilmez. MTD yalnız açık `PARTIAL`, eksik ay sıfır değildir.
- Karşılaştırmada metric/scope/filter/currency/coverage eşliği aranır. Base zero yüzde `null/BASE_ZERO`; kapsam farkı `NON_COMPARABLE/PARTIAL`dır. Exact delta görüntü yuvarlamasından hesaplanmaz.
- Run `REQUESTED→VALIDATING→CALCULATING→SNAPSHOTTING→QUALITY_CHECK→PUBLISHED`; export `QUEUED→AUTHORIZING→RENDERING→VALIDATING→PUBLISHED` durumlarını izler. Terminal hata/iptal yarım veya ikinci publish bırakmaz. Aynı idempotency key/body aynı nesne, farklı body `409`dur.
- Restatement eski snapshot/artifact'ı değiştirmez. Eski/yeni result ids, exact delta, state/coverage ve source reason taşıyan diff üretilir; UI eski sonucu açık `STALE/RESTATED` gösterir.
- İlk widget/chart ailesi KPI, line/area, stacked bar, waterfall, heatmap, Pareto, survival/vintage, scatter/bubble, detail/priority table ve `AI_FOCUS`tur. Chart spec yalnız result refs, dimension/series, unit, display, axis/stack/sort, semantic color, tooltip ve table fallback taşır.
- Null, missing, partial, blocked, non-comparable, gerçek zero, forecast ve scenario yalnız renkle değil metin/ikon/desenle ayrılır. Waterfall, stack, Pareto ve top-N+diğer exact control-total kapısından geçer; her chart erişilebilir table fallback ve kaynak drill-down sunar.
- Drill-down serbest SQL değildir; definition sürümündeki allowlist target/dimension/column/sort/filter map ile snapshot'a pinli çalışır. Keyset cursor deterministiktir; kesilme görünürdür; satırlardan resmî toplam yeniden hesaplanmaz.
- Evidence, detail ve export yetkileri ayrıdır. Ham payload, gizli settlement, audit alanı, VKN/TCKN/tam adres ilgili capability olmadan ekrana, dosyaya, AI context'ine veya telemetry'ye sızmaz.
- Artifact isteği istemciden sayı/formül/HTML/storage path almaz. Private storage, kısa ömürlü scope-bound download, üretim ve indirmede yeniden authorization, immutable content hash, retention/legal-hold ve download audit zorunludur.
- PDF sürümlü A4 portrait/landscape şablondan kapak, kapsam/dönem/kesim, yönetici özeti, KPI/kıyas, grafik/katkı, gerçekleşen–forecast–scenario ayrımı, DQ/coverage ve metodoloji üretir. Font embed, Türkçe glif, sayfa başlığı/numarası, kırpılma/taşma ve son boş sayfa kalite kapıları vardır.
- XLSX en az Yönetici Özeti, Dönem Karşılaştırma, rapor analizi, Detay Veri, Veri Kalitesi, AI Odak Analiz ve Metodoloji sekmelerini taşır. Detay Table/filter/freeze header ve gerçek veri tipleri kullanır; resmî KPI ayrı Excel formülüyle yeniden hesaplanmaz; formula injection, macro ve external link yasaktır.
- PNG en az 2× ve kırpılmasız; SVG sanitize edilmiş, scriptsiz ve external-resource'suzdur. Görsel başlık, dönem, birim, coverage/uyarı ve kısa snapshot id'yi kendi içinde taşır.
- `AI_FOCUS` mevcut koyu cam paneli, durum rozeti/sol vurgu, akıcı özet+aksiyon, typewriter/dönüşümlü hover-focus alanı ve geniş Analiz modalının mor-mavi karakterini korur. Touch/klavye/reduced-motion/pause davranışı eşdeğerdir; eski formüller ve dayanağı olmayan hükümler korunmaz.
- Paket 14 yokken deterministic AnalysisDigest ve mevcut onaylı claim seti kullanılabilir; yeni anlatı `AI_NARRATIVE_UNAVAILABLE` olur ama sayısal rapor çalışır. Tek claim seti HTML/PDF/XLSX/görsel/sohbette reuse edilir; renderer model çağırmaz.
- Teslim politikası `INLINE|INLINE_PLUS_VISUAL|REPORT_PACK`tır. Her mod doğrudan cevabı sohbette tutar; yoğun detay artifact/drill-down'a gider. Token baskısı coverage, ters maddi bulgu veya `DİĞER` mutabakatını sessizce düşüremez.
- Cache authorization scope, semantic plan, snapshot/manifest, filter/period/comparison, metric/report/template/policy/model/prompt versions ve locale hash'leriyle ayrılır. Yetki/run değişiminde eski claim/artifact ref stale olur ve kullanıcılar arasında paylaşılmaz.
- Capabilities `report.view/run/drilldown/export.summary/export.detail/artifact.download/audit/definition.manage/approve/template.manage/approve` olarak ayrılır. Service role actor/scope kontrolünü atlayamaz; bütün read/job/artifact/download/audit yolları fail-closed'dur.
- Paket 12E Paket 13 engine'i, domain formülleri, Paket 14 model/semantic handler'ı, Paket 12F aksiyon atfı veya Paket 15 cutover'ı uygulamaz. Feature flag `report_artifacts_v2` varsayılan kapalıdır.

## Paket 12F Aksiyon günlüğü, sonuç ölçümü ve güvenli atıf — kesin teknik karar

- V1 aksiyon kaynağı bu paketin native vaka/faaliyet/ödeme sözü günlüğüdür; haricî CRM beklenmez. Gelecek entegrasyonlar aynı immutable identity/version/idempotency sözleşmesine uyan adapter'dır.
- Önerinin gösterilmesi, açılması veya vakaya dönüştürülmesi kullanıcı aksiyonu değildir; recommendation adoption hunisidir. Conversion finansal başarı sayılmaz.
- Vaka customer×currency×measurement policy grain'indedir ve aynı anda yalnız bir aktif ölçüm vakası olabilir. Örtüşen yeni öneri ikinci pencere açmaz, mevcut vakaya provenance adayı olur.
- Faaliyet PLANNED ile başlamış sayılmaz. Yalnız occurred_at/actor/outcome taşıyan PERFORMED faaliyet ölçüm anchor'ı olabilir. Recorded_at sunucu zamanıdır.
- Finansal sonuç bilinmeden önce kaydedilen faaliyet prospective eligible'dır. Sonradan geriye girilen faaliyet audit'te kalır fakat sonuç/performans ölçümüne girmez; düzeltme geçmişe dönük eligibility kazandırmaz.
- İlk eligible performed activity sonrası Europe/Istanbul `1–7`, `1–14`, `1–30` kümülatif horizonları ölçülür. Tamamlanmamış horizon `IMMATURE`dır; zero veya başarısızlık değildir.
- Kullanıcının faaliyet outcome'u finansal olay/tutar oluşturamaz. Gözlenen sonuç yalnız Paket 08–10/12A canonical event/allocation/result ids'den gelir.
- Ekonomik tahsilat, direct cash, IADE/HIZMET, Çek/Senet kabulü, araç gerçek settlement'ı, yeni ticari exposure ve diğer risk deltaları ayrı exact alanlardır. Araç kabulü nakit değildir; settlement cariyi ikinci kez azaltmaz.
- `EXCLUSIVE_ACTIVE_CASE` yöntemi aynı customer×currency canonical event'ini en fazla bir vakaya bağlar. Case içindeki farklı faaliyetlere tutar dağıtılmaz; faaliyet görünümü yalnız timeline'dır. 7/14/30 kümülatif sonuçları birbirine eklenmez.
- Vaka sonucu FAN-006 uyumlu opening+classified deltas=closing exposure bridge taşır. Yeni satış, iptal, virman/reassignment, manual/source restatement ayrı gösterilir; basit açılış-kapanış farkı başarı değildir.
- Ödeme sözü yalnız performed `COMMITMENT_RECEIVED` faaliyetten, positive integer minor TRY amount, due date ve `ECONOMIC_RELIEF|DIRECT_CASH_ONLY|INSTRUMENT_SETTLEMENT_ONLY` kind ile açılır. Serbest not söz kaydı değildir.
- Promise allocation kind içinde due-date, created-at, id sırasıyla minor-unit FIFO'dur. Bir event parçası iki sözü karşılamaz. On-time due EOD, late recovery +7 gün; fulfilled promised amountta cap, excess vaka sonucunda ayrıdır.
- Promise sonucu OPEN/PARTIAL/KEPT on-time/late/BROKEN/CANCELLED_INVALID olarak maturity ile üretilir. Sözün tutulması müşteri taahhüt FACT'idir; takip veya AI nedensel başarısı değildir.
- Adoption, due activity completion, contact, promise amount ve observed relief oranları exact pay/payda, excluded reasons, retrospective count, currency, horizon ve coverage taşır. Adet/tutar/müşteri oranları karıştırılmaz; denominator zero null'dır.
- Organization raporu vaka sahibini, faaliyeti yapanı ve finansal olayın temporal sahibini ayrı gösterir. Reassignment geçmiş eylem/sonucu yeniden yazmaz; belirsiz org şirkette coverage açığıdır. V1 prim, ceza veya temsilci sıralaması üretmez.
- Normal ölçüm `TEMPORAL_ASSOCIATION`dır. Previous period, before/after, contacted-vs-not veya matched cohort yalnız `DESCRIPTIVE_ASSOCIATION`; selection bias caveat'i zorunludur. “Aksiyon sayesinde” veya “AI tahsil etti” denemez.
- `CAUSAL_LIFT` yalnız assignment öncesi approved-active protocol, immutable eligibility/population/unit/strata/30-day primary metric/exclusions ve deterministic randomized assignment ile hesaplanabilir. Primary analiz ITT'dir; crossover deviation'dır, grup değiştirmez.
- Deney primary metric'i her kolda `Σmin(30d economic relief,baseline eligible exposure)/Σbaseline eligible exposure`; lift treatment−control yüzde-puandır. Her kolda ≥30 eligible unit, ≥10 relief event ve ≥%90 coverage gerekir.
- Causal interval 2.000 seed'li stratified bootstrap ile %95'tir. Interval 0'ı içerirse `INCONCLUSIVE`, kalite kapısı geçmezse `CAUSAL_BLOCKED`; ikisi de sahte olumlu/olumsuz etki üretmez. İkincil analiz `EXPLORATORY`dır.
- Outcome snapshot immutable'dır. İptal/reversal/manual/source restatement yeni run/diff ve deterministic promise/event replay üretir; eski rapor sessiz değişmez.
- AI recommendation→activity→promise→official outcome sırasını açıklar; draft preview hazırlayabilir fakat açık confirmation/capability olmadan case/activity/promise oluşturamaz, faaliyeti performed veya sözü kept yapamaz.
- Paket 12E aynı snapshotta funnel, workflow, promise, 7/14/30 sonuç, exposure bridge, coverage ve deney etiketlerini UI/PDF/XLSX'e taşır. Association/causal/inconclusive/blocked durumları ayrıdır.
- RLS/capabilities case/activity/note/commitment/outcome/experiment/export ve AI'da fail-closed'dur. Serbest not ayrı yetkidir; PII telemetry'ye yazılmaz. Service role expected-version/idempotency/actor kontrolünü atlayamaz.
- Paket dış iletişim yapmaz; tahsilat, limit, sevkiyat, customer status, prim veya ceza mutasyonu üretmez; Paket 12D priority'yi, Paket 13 engine'i, Paket 14 canlı handler'ı ve Paket 15 cutover'ı uygulamaz. Feature flag `financial_action_outcomes_v2` varsayılan kapalıdır.

## Paket 13 Merkezi metrik motoru — kesin teknik karar

- Paket 13 domain formülü üretmez; onaylı domain metric version'larını tipli registry, dependency DAG, deterministic calculation run ve atomik publication sözleşmesiyle çalıştırır. UI, rapor, export ve AI resmî sayıyı yeniden hesaplamaz.
- `metric_key` kalıcı, approved version immutable'dır. Formül/calculator/dependency/unit/grain/date/eligibility/null/rounding/coverage değişikliği yeni version üretir. Çakışan etkin sürüm ve onaysız/retired çalıştırma yoktur.
- Grain/dimension/unit/currency/period allowlist ve tipli sözleşmedir. Sellout `CALENDAR_MONTH YYYY-MM`, finansal 3/6/12 `COMPLETED_MONTH_WINDOW`dır; eksik ay zero değildir. Uyumsuz unit/currency onaylı FX dependency'si olmadan birleşmez.
- Dependency graph required/optional ve source/metric edge'lerini sürümler. Self/dolaylı cycle reddedilir; closure/topological sıra deterministiktir. Planner yalnız minimal transitive closure'ı ve pinli source/result/version/code girdilerini kullanır.
- Canonical request Unicode/enum/date/currency/list/default'ları normalize eder; `null/empty/ALL` ayrıdır. Request+plan+authorization hash'i idempotency/cache sınırıdır; aynı key farklı body `409`dur.
- Run state machine immutable eventlerle yürür. Lease server time, heartbeat ve fencing token taşır; eski worker result veya publish yazamaz. Calculator pinsiz active table, network, wall clock veya random okuyamaz; forecast yalnız pinli seed/model version kullanır.
- Resmî para/litre exact decimal, adet integer'dır. Dependency display-rounded değeri değil ham exact sonucu tüketir. Her sonuç metric/run/plan/version/scope/period/value/unit/pay-payda/components/status/source/dependency/coverage/reconciliation/exclusion/evidence/hash zarfını taşır.
- `VALUE`, gerçek `ZERO`, `NULL_NOT_APPLICABLE`, `MISSING`, `PARTIAL`, `BLOCKED`, `IMMATURE`, `NON_COMPARABLE`, `BASE_ZERO` ayrıdır ve tüketicide birbirine çevrilemez.
- Contribution exact control total'a mutabıktır ve izinsiz leaf double count yoktur. Coverage source/time/identity/classification/amount/dependency ve domain bileşenlerini ayrı pay/payda/state/reason ile taşır; keyfî tek ortalama üretmez.
- Reconciliation sürümlü denklem ve yalnız kaynak hassasiyeti toleransıyla çalışır. Açıklanamayan fark, reproducibility hash farkı veya zorunlu coverage eksiği publish'i bloklar.
- Publication manifest/results/outbox/active pointer tek transaction'dır; pointer en son compare-and-swap ile değişir. Stale upstream, kısmi sonuç, concurrency veya hata önceki active publication'ı korur. Running/staging sonuç normal API'de güncel görünmez.
- Source/manual/parameter/hierarchy/dependency değişikliği tipli invalidation ve minimal impact plan üretir. Earliest date, müşteri/entity, iki taraflı virman, temporal org, dönem, metric/report/tool closure'ı bulunur. Scope güvenli çözülemezse sessiz global replay yerine blokaj vardır.
- Replay yalnız etkilenen zincirde yeni immutable run üretir. Restatement eski result/publication'ı değiştirmez; old/new id, exact delta, state/coverage/reconciliation ve neden diff'i taşır. Backfill dry-run active pointer'ı değiştirmez.
- RLS ve ayrı registry/run/result/replay capability'leri bütün summary/detail/evidence/audit yollarında fail-closed'dur. Cache auth scope ve bütün sürümlerle ayrılır. Telemetry PII/raw detail/secret taşımaz; lease, retry, DQ, stale publish ve determinism durumları izlenir.
- Paket 13 canlı model, claim, grafik, artifact, domain mutation veya legacy cutover uygulamaz. Paket 14 yalnız approved descriptor ve published result envelope okur; Paket 15'e kadar `metric_engine_v2` varsayılan kapalıdır.

## Paket 14 AI semantik ve yorum katmanı — kesin teknik karar

- AI resmî sayıyı hesaplamaz. Türkçe isteği tipli `SemanticQueryPlan`a çözer, yalnız server-owned approved araçlarla Paket 13 `PUBLISHED` sonuçlarını alır ve evidence-bound claim seti üretir.
- Provider çağrısı yalnız backend'dedir. Tarayıcı API key'i/doğrudan SDK, hard-coded app secret, istemci tool declaration'ı ve unrestricted model/provider seçimi yasaktır. Anahtar/model/timeout/retry/rate/token/circuit-breaker politikası sürümlüdür ve secret telemetry'ye girmez.
- Türkçe catalog resmî ad, güvenli eş anlam/yazım/ek varyantı, forbidden legacy anlam, unit, entity/dimension/filter, period/comparison/result kind, capability ve karşı örnekleri immutable version olarak taşır.
- Resolver Türkçe Unicode/İ-I-ı-i ve tarih ifadelerini normalize eder fakat müşteri/belge/ürün kodunda baştaki sıfır veya precision kaybetmez. Entity yalnız Paket 02/domain canonical resolver ref'iyle kesinleşir; ad benzerliği tek başına yeterli değildir.
- Sellout geçmişi ayrı `YYYY-MM` aylarıdır; finansal 3/6/12 seçilen bitiş ayıyla tamamlanmış takvim aylarıdır. Sevkiyat yalnız bugünkü, anlık stok son snapshot'tır. “Vade” bağlam adaylarına ayrılır; kaynaksız sözleşmesel gün uydurulmaz.
- `RESOLVED_EXACT`, güvenli varsayımlı çözüm, `AMBIGUOUS_BLOCKING`, `UNSUPPORTED` ve `UNAUTHORIZED` ayrıdır. İki maddi farklı adayda model confidence çözüm sayılmaz; kullanıcı açıklaması olmadan tool/sayı yoktur.
- Takip sorusu yalnız aynı tenant/user/conversation'daki izinli response context'ini TTL, permission ve publication/restatement kontrolüyle daraltır. Başka sohbet/kullanıcı bağlamı ve sessiz entity/scope genişlemesi yoktur.
- Tool registry input/output schema, read/preview/commit class, capability, scope, result kind, timeout/size ve handler version taşır. İstemci/model endpoint, schema, tool veya capability ekleyemez. Tool verisi untrusted'tır; içindeki prompt talimatı yürütülmez.
- Read araçları yalnız Paket 13 published `MetricResultEnvelope` döndürür. Client rows, ham Excel, IndexedDB, grafik pikseli veya prompt içi formül resmî sonuç değildir. Staging/retired/blocked metrikte legacy fallback yoktur.
- Orchestrator v1 policy'si dört round, sekiz tool call ve iki paralel read call ile sınırlıdır; loop/fan-out/oversize açık reason code ile kesilir. Mutation call'ları paralel yürütülmez.
- Deterministic digest direct answer, comparison, top contribution+OTHER, anomaly/risk, forecast/scenario refs, coverage/exclusion, counterevidence ve drill-down refs'i modelden önce hazırlar. Model materiality/eşik/top-N/yüzdeyi yeniden hesaplamaz.
- Claim türleri `FACT/INFERENCE/FORECAST/SCENARIO/RECOMMENDATION`dır. Her sayı exact/display result/component ref'e bağlanır; entity/unit/period/state/kind birebirdir. Öneri hedef, gerekçe, beklenen metric, risk, owner ve review horizon taşır; uygulanmış işlem değildir.
- Causal dil yalnız Paket 12F geçerli randomize `CAUSAL_LIFT` sonucu için kullanılabilir. Diğer takip sonuçları temporal/descriptive association'dır; “AI tahsil etti/aksiyon sayesinde” denmez.
- Modelden bağımsız validator sayı birebirliği, provenance, scope/yetki, coverage/restatement, claim kind/dil, unsupported causality/gelecek/müşteri hükmü, recommendation ölçülebilirliği, counterevidence ve hassas veri kapılarını fail-closed uygular.
- Mevcut AI Odak koyu cam, akıcı özet+aksiyon, typewriter hover/focus ve geniş mor-mavi Analiz modalı Paket 12E'de aynı claim setiyle korunur. Full set en fazla üç maddi bulgu ve iki next check taşır; ayrıntı drill-down/rapordadır.
- Mutation normal model oturumunda COMMIT aracı görmez. AI yalnız draft/preview hazırlar; exact preview id/hash/özet/expiry UI'da gösterilip kullanıcı açık confirmation event'i vermeden commit yoktur. Serbest “tamam”, stale preview veya permission/version değişikliği geçersizdir.
- Prompt, dosya hücresi, müşteri adı/notu ve tool output untrusted data'dır. VKN/TCKN, adres, banka detayı, hassas not ve raw Excel minimize edilir; model shell/SQL/storage/secret erişimi alamaz.
- Cache auth/context/publication/catalog/tool/policy/prompt/model/locale sürümleriyle ayrılır. Restatement eski cevabı değiştirmez. Provider/validator yokken published direct result ve deterministic digest çalışır; yeni anlatı `AI_NARRATIVE_UNAVAILABLE`, doğrulanamayan cevap `AI_RESPONSE_BLOCKED`dır.
- Deterministik anonim eval CI kapısıdır; kritik hallucination/security/mutation/RLS hatası 0, resmî sayı birebirliği ve required provenance %100 olmadan release açılamaz. Live provider eval yalnız ayrı smoke/quality çalışmasıdır.
- Feature flag `ai_semantic_v2` varsayılan kapalıdır. Shadow mode kullanıcıya v2 cevap/mutation göstermez. Paket 15 kabulü olmadan legacy AI route'u kaldırılmaz veya sessiz v2'ye çevrilmez.

## Paket 15 Kontrollü geçiş ve legacy kapatma — kesin teknik karar

- Cutover tek global flag değildir; customer/product/Sellout/stok/finans/operasyon/rapor/AI/read/write capability'leri dependency DAG altında ayrı route state taşır. Server route pointer resmîdir; client/localStorage/IndexedDB flag'i karar veremez.
- Route yaşam döngüsü `LEGACY_ONLY→V2_SHADOW→V2_COMPARE→V2_CANARY_READ→V2_PRIMARY_READ→WRITE_FROZEN→V2_PRIMARY_WRITE→LEGACY_READ_ONLY→LEGACY_DISABLED→LEGACY_RETIRED`dir. Aynı request legacy+v2 karıştıramaz; v2 primary hatasında sessiz per-request fallback yoktur.
- Cohort stable hash/named membership ile deterministiktir. Varsayılan dalgalar internal→pilot→%10→%25→%50→%100; minimum 48 saat ve bir iş döngüsü gözlemi vardır. Finansal write en az beş iş günü stabil read canary ister. Eşik düşürme sürümlü approval gerektirir.
- Legacy envanter her route/file/store/table/job/tool/deep link/secret'i `KEEP_UX/REPLACE_SEMANTICS/MIGRATE_DATA/ARCHIVE_AUDIT/DISABLE_ROUTE/REMOVE_CODE/RETAIN_REFERENCE_ONLY` sınıfında owner/replacement/removal gate ile izler. Static graph ve runtime telemetry birlikte active consumer olmadığını kanıtlar.
- Mevcut AI görsel karakteri korunur; client formülleri, shadowLimit, yanlış DSO/CEI/vade/3-6-12, Sellout TL=ciro, Belgeler=tahsilat, sipariş−ödeme kalanı, client model key'i ve fiziksel silme korunmaz.
- Resmî migration yalnız immutable raw dosya/snapshot/event ve approved parser/domain contract'tan yapılır. IndexedDB, React state, legacy normalize toplam veya ekran export'u resmî kaynak değildir. Kaynaksız alan `LEGACY_UNVERIFIED`/coverage açığıdır.
- Migration manifest source hash, scope/period, row/hash, valid/excluded/quarantine, exact totals, identity, versions, target snapshot/run/publication, coverage/reconciliation ve approvals taşır. Dry-run/write/validate/publish ayrıdır; idempotenttir; rollback v2 raw/event/result'ı silmez.
- Historical backfill gelecekteki knowledge/dimension revision'ı geçmişe sızdırmaz. Tarihçesi tutulmayan anlık stok için geçmiş/trend icat edilmez. Quarantine active publication'a girmez.
- Legacy-v2 comparison aynı scope/entity/metric intent/period/filter/dimension/currency/cutoff exact refs'iyle yapılır. Farklar `EXACT_MATCH/DISPLAY_ONLY/EXPECTED_SEMANTIC_CHANGE/SOURCE_COVERAGE_DIFFERENCE/LEGACY_DEFECT_CONFIRMED/V2_DEFECT_CONFIRMED/NON_COMPARABLE/UNEXPLAINED_DIFFERENCE` sınıflarıdır.
- Expected fark yalnız decision/matrix/test ref, exact metric/scope ve beklenen yön/denklemle allowlist edilir; wildcard yoktur. V2 defect veya unexplained fark cutover'ı bloklar. Legacy'ye eşitlik v2 domain invariant/reconciliation kapısının yerine geçmez.
- Readiness package/deploy/migration/DQ/reconciliation/reproducibility/RLS/PII/secret/SLO/cache/session/artifact/support/rollback runbook kanıtlarını tek hash'te pinler. Input değişince approval stale olur.
- Go/no-go technical+domain owner four-eyes ister; finansal write ve AI mutation ayrıca security approver ister. Production control plane step-up auth, kısa confirmation, expected-state ve idempotency ile çalışır.
- Kritik leak, duplicate/missing financial event, failed reconciliation, unexplained official metric mismatch, unauthorized mutation, writer invariant, corruption veya AI numeric/provenance/confirmation ihlali `FREEZE_AND_ALERT` üretir. Varsayılan %2/15dk error veya p95 SLO+2× baseline dalgayı durdurur; freeze veri silmez.
- Read cutover route pointer, capability version, cohort, cache namespace, minimum client build ve outbox'ı atomik CAS ile değiştirir. Page/modal/API/AI/PDF/XLSX aynı v2 manifesti kullanır; stale cache/cursor/claim/artifact yeni gibi reuse edilmez.
- Write cutover drain→watermark→WRITE_FROZEN→tek v2 writer pointer→legacy read-only→preview/commit/read/metric/outbox smoke mutabakatı sırasını izler. Client dual-write ve primary'de legacy write fallback yasaktır.
- Write rollback v2 eventlerini silmez. Post-cutover eventler exact geri senkron edilmeden legacy yeniden writer olamaz; güvenli değilse read-only ve forward-fix uygulanır. Read rollback route pointer'ı geri alır ama v2 kanıt/result/audit'i korur.
- Incident recovery root cause, etkilenen ids, düzeltme/restatement, kullanıcı bildirimi, regression ref ve yeni readiness approval ister. Stale sonuç güncelmiş gibi gösterilmez.
- Legacy en az 30 gün v2 primary/fallbacksiz stabilite; finansal write için bir tam ay kapanış/reconciliation görmeden disabled olamaz. Normal report/AI/write üretimi read-only legacy'de kapalıdır.
- Retirement route/deep link/job/cron/export/tool/service-worker/cache consumer sıfır; retention/legal hold, backup restore, audit export, key revoke, dependency/license/storage lifecycle ve runbook kapıları geçince yapılır. Raw/audit/revision/event/result UI kapanınca silinmez; fiziksel drop ayrı destructive migration/onaydır.
- Paket 15 kodunun kabulü production route değişikliği değildir. Her capability için readiness preview, exact cohort/from-to, four-eyes approval ve auditli execute ayrıca gerekir.
