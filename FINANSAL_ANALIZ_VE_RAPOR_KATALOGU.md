# İleri Finansal Analiz ve Rapor Kataloğu

**Durum:** Onaylı hedef kapsam  
**Amaç:** Cari, fatura, tahsilat, Çek/Senet, devir, virman ve organizasyon verilerinden üretilecek ileri finansal analizleri; formül, veri yeterliliği, rapor ve AI davranışıyla birlikte tanımlamak.  
**Bağlayıcı kaynaklar:** `VERITABANI_YENIDEN_TASARIM_KARARLARI.md`, `SISTEM_HESAPLAMA_MATRISI.md`, `KODLAMA_ASAMALI_UYGULAMA_PLANI.md` ve `AI_MEVCUT_DURUM_VE_GELISTIRME_PLANI.md`.

## 1. Değişmez ilkeler

- Resmî finansal tutar Sellout TL'den değil, geçerli müşteri faturaları ve onaylı finansal olaylardan gelir.
- Paket 04B Sellout tarihsel litre raporu finansal rapor değildir. Aynı ortak PDF/XLSX/görsel altyapısını kullanabilir fakat Sellout litre, kanal trendi veya karşılaştırmasını ciro, tahsilat, fiyat, kârlılık ya da 3/6/12 fatura ödeme hızı olarak yorumlayamaz.
- `Cari açık`, `açık Çek`, `açık Senet` ve `toplam risk` ayrı tutulur. Çek/Senet kabulü cariyi azaltıp aynı tutarda araç riski açtığı için toplam riski tek başına azaltmaz.
- Gerçekleşmiş sonuç `FACT`, istatistiksel çıkarım `INFERENCE`, gelecek değer `FORECAST`, varsayımlı sonuç `SCENARIO`, takip önerisi `RECOMMENDATION` olarak etiketlenir.
- Sıfır, null, yetersiz kapsam ve bloke sonuç farklıdır. Veri yokken sektör ortalaması, sahte sıfır, otomatik 50/100 puan veya uydurma neden kullanılmaz.
- Oranlar alt grup oranlarının ortalamasıyla değil, ham pay ve paydaların seçilen kapsamda yeniden toplanmasıyla hesaplanır.
- Her sonuç `metric_definition_version`, `calculation_run_id`, kesim/dönem, filtreler, pay/payda veya bileşenler, coverage, güven ve kaynak izini taşır.
- Kullanıcı düzeltmesi sürümlüdür. Sonraki yükleme bu kayda dokunursa değişiklik karşılaştırılır; kaynak değer kullanıcı kararını sessizce ezmez.
- Paket 11 kaynak çatışması açıkken son onaylı manuel/effective revision rapor tabanıdır; yeni source değeri `PENDING_SOURCE_UPDATE` olarak açıklanır ve ikinci ekonomik etki üretmez. Manuel ekleme, devir, virman, allocation override, exclude/delete/restore etkileri source veriden ayrı contribution ve restatement sınıfı taşır.
- Skor, tahmin, uyarı ve öneri hiçbir finansal hareketi, müşteri durumunu, limiti veya sevkiyatı otomatik değiştirmez.
- Paket 08B ile üretilen `DRAFT/PREVIEWED/GENERATED/PRINT_REQUESTED/PRINT_CONFIRMED` bono belgesi finansal olay değildir. Yalnız Paket 08'in geçerli resmî Senet kabulü cari azaltma ve araç riski açar; basılı taslak açık Senet, tahsilat, nakit veya risk hesabına girmez.

### Paket 10 gerçekleşmiş temel veri sınırı

- İleri analizlerin cari, açık lot, allocation, kapanma günü ve aging tabanı Paket 10'un yayımlanmış immutable calculation run sonucudur. Rapor veya AI bu gerçekleri Sellout, Belgeler, sipariş tutarı, bakiye farkı ya da istemci state'inden yeniden kuramaz.
- 3/6/12 finansal pencere seçilen `period_end_month` ile biten tamamlanmış takvim aylarıdır; `N×30 gün` ve Sellout filtreleri değildir. Cari ay ancak ayrı `MTD/PARTIAL` görünür, eksik ay sıfır sayılmaz.
- Tam fatura kapanma günü yalnız anaparayı sıfırlayan son allocation'dan; tahsilat gerçekleşme günü allocation parçalarından hesaplanır. Dağıtılmamış müşteri alacağı bir lota bağlanana kadar gün metriğinin pay/paydasına girmez.
- Standart ekonomik hız IADE/HIZMET allocation katkısını içerir; `cash_only` hız dışlar. İki mod, fatura kapanma günü ve allocation gerçekleşme günü ayrı etiketlenir. SATIN ALMA bütün müşteri finansal sonuçlarında dışarıdadır.
- Paket 10'un temel denklikleri sağlanmadan Paket 12 sonucu yayımlanamaz: `cari=open lot−dağıtılmamış alacak`, `lot anaparası=allocation+açık`, `azaltan olay=allocation+dağıtılmamış`, aging dilimleri=açık lot ve virman şirket neti=`0`.
- Paket 10A Fatura Kontrol alarmı finansal performans metriği veya müşteri sağlık skoru değildir. İleri raporlar bu alarmı yalnız belge-level review bağlamı olarak, aynı control/ledger run ve evidence kimlikleriyle gösterebilir; `BLOCKED_DATA` kötü performans, `CLEAR_WITH_EVIDENCE` borçsuzluk sayılmaz.

### Paket 12A resmî read model ve mutabakat sınırı

- Paket 12A Paket 10 defter/FIFO sonucunu kopyalamaz; aynı upstream result kimliklerinden günlük müşteri/lot/araç/organizasyon pozisyonu ve dönemsel metric result üretir. Çift ledger, ikinci allocation veya UI formülü resmî kaynak olamaz.
- Bütün temel finansal raporlar cari, açık lot, dağıtılmamış alacak, açık Çek, açık Senet ve toplam riski ayrı alanlarda taşır. Çek/Senet kabulünde toplam risk tek başına azalmaz; gerçek settlement cariyi ikinci kez azaltmaz.
- DSO, CEI ve 3/6/12 sonuçları aynı run'da numerator/denominator, contribution, coverage ve reconciliation kimlikleriyle yayımlanır. Alt dönem oran/ortalamaları ortalanmaz; seçilen kapsamın ham pay/paydasından yeniden hesaplanır.
- `FAN-020` parasal/lot/allocation/instrument/virman/rollup denkliklerinden `NOT_READY`, `READY_WITH_WARNINGS` veya `READY` üretir. `READY_WITH_WARNINGS`, exact parasal denklik bozukken kullanılamaz.
- `FAN-021` kaynak, zaman, müşteri, tutar, allocation, instrument, hierarchy ve manual-conflict coverage boyutlarını ayrı gösterir; tek keyfî coverage ortalaması yoktur. Eksik ay/müşteri/tutar sıfır değildir.
- 12A `financial_event_deltas` görünümü açılış+deltalar=kapanış köprüsünü kurar. Satış, ekonomik tahsilat, gerçek cash/risk relief, IADE/HIZMET, araç kabul/ödeme, devir, virman, iptal ve manual restatement sınıfları birbirine karıştırılmaz.
- Paket 12B skor/limit/karne, 12C kohort/migration/yoğunlaşma, 12D tahmin/senaryo, 12E artifact ve AI anlatı teslimini bu resmî sonuç zarfından tüketir; hiçbiri 12A sonuçlarını kendi formülüyle yeniden hesaplayamaz.

### Paket 12B skor, limit ve karne sınırı

- Sağlık skoru, önerilen limit ve organizasyon karnesi üç ayrı analitik sonuç ailesidir. Aynı policy/coverage altyapısını kullanabilirler; ancak limit skora geri beslenmez, satış/litre puanı finansal karneyle birleşmez ve hiçbir sonuç otomatik finansal/operasyonel mutasyon üretmez.
- Müşteri sağlık sonucu toplam puanın yanında beş component'ın raw metriği, pay/payda, original/active weight, puan katkısı, null nedeni, coverage/güven ve bağımsız risk bayraklarını taşır. Null component 0 değildir; aktif başlangıç ağırlığı `<%60` veya uygun bileşen `<2` ise skor yayımlanmaz.
- DSO sağlık skoruna dahil değildir; aynı yaş/risk davranışını ikinci kez cezalandırmadan teşhis ve trend bağlamında gösterilir. Pasif/iptal müşteri durumu da keyfî skor cezası değildir.
- Sistem limitinde Master/Excel kredi limiti kullanılmaz. Need P75, cash-risk-relief capacity P25, behavior factor, raw/rounded/governed/effective limit, current exposure, usage/headroom ve override ayrı rapor alanlarıdır.
- Mevcut toplam risk limit önerisini büyüten formül girdisi değildir. Çek/Senet kabulü toplam risk/limit kullanımını tek başına değiştirmez; gerçek araç ödemesi risk ve headroom'u değiştirir. IADE/HIZMET cariyi azaltabilir fakat cash capacity'yi büyütmez.
- Temsilci/SSM finansal karne; CEI, pre-29 ekonomik kapanma, due instrument realization ve günlük limit discipline bileşenlerini ham pay/paydalardan yeniden hesaplar. SSM sonucu temsilci skorlarının ortalaması değildir; null skor 0 gibi sıralanmaz.
- Raporlarda sağlık band dağılımı hem müşteri adedi hem total exposure ile; limit görünümü toplam etkin limit/risk/headroom ve aşım adedi/tutarıyla; karne görünümü context metrics ve temporal responsibility ile sunulur.
- Limit override ancak sürümlü preview/açık onayla etkinleşir. Sağlık skoru sevkiyat, limit önerisi kredi onayı ve finansal karne prim/hakediş kararı değildir.

### Paket 12C kohort ve karşılaştırmalı davranış sınırı

- Migration lot principal parçalarının ay başından ay sonuna gerçek geçişidir; ekonomik kapanma, açık bucket, transfer/reassignment ve non-performance exit ayrı tutulur. Transfer veya iptal tahsilat başarısı değildir.
- Vintage horizon paydası yalnız ilgili günü gözlemleyecek kadar yaşlanmış principal'dır. Genç/açık faturayı gelecek 45/60/90 gün horizon'unda başarısız saymak yasaktır.
- Payment survival amount-weighted ve right-censored `INFERENCE`tır. Median gün çıkmıyorsa null olur; müşteri örneği yetersizse rep/channel/company fallback'i ve örnek sayısı gösterilir.
- 29+ yük köprüsü açılış, yeni yaşlanma, reinstatement, ekonomik kapanma, non-performance ve transferleri exact mutabık tutar. IADE/HIZMET ekonomik kapama katkısı; DEVIR_ALACAK performans dışı düzeltmedir.
- Davranış segmenti Master segmentini veya müşteri status'unu değiştirmez. Tek ana class, çoklu evidence tag, priority policy, maddilik ve coverage taşır; yeterli veride hiçbir kesin sınıfa uymayan kayıt `KARMA_IZLEMELI`dir.
- Peer benchmark yalnız aynı metric/version/unit/period/coverage cohort'unda, en az 10 eligible entity ile median/P25/P75/percentile üretir. Fallback seviyesi ve metric direction görünmeden “iyi/kötü” yorumu yapılamaz.

### Paket 12D tahmin, sinyal, öncelik ve senaryo sınırı

- 13 haftalık nakit görünümü `EXISTING_BOOK` ve yeterliyse `EXTENDED_OPERATING` kapsamlarını ayırır. Her hafta as-of sonrasındaki yedi takvim günüdür; fatura doğrudan nakdi, mevcut araç settlement'ı ve toplam seri ayrı gösterilir.
- Fatura ekonomik kapanma eğrisi nakit eğrisi değildir. Doğrudan Nakit/Banka Havalesi cause-specific geçişi tahmin edilir; IADE/HIZMET, Çek/Senet kabulü, virman ve devir nakit olmaz. Açık araçların gerçek settlement beklentisi ayrı modelden gelir.
- Gelecek ticari fatura ve residual quantile modeli rolling-origin kapısını geçmezse extended sonuç null'dır. P25/P50/P75 deterministik 1.000 ortak yolun quantile'ıdır; haftalık quantile'lar toplanarak 13 hafta uydurulmaz.
- Bozulma sinyali, robust anomali ve tahsilat önceliği sırasıyla `INFERENCE`, `INFERENCE`, `RECOMMENDATION`dır. Sağlık skoruna gizlenmez, neden/ödeme sözü/otomatik müşteri işlemi olmaz.
- Stres ve karşı taraf testleri immutable baz result'a bağlı `SCENARIO`dur. Yönetimsel beklenen zarar yalnız yeterli kalibrasyon veya açık kullanıcı varsayımıyla `SCENARIO_ONLY`; hiçbir durumda resmî muhasebe karşılığı değildir.
- FORECAST/SCENARIO görsel ve metinsel olarak gerçekleşmiş sonuçtan ayrılır. Model/backtest/coverage/fallback/varsayım ve exact result/evidence kimliği görünmeden AI kesin nakit tarihi, kayıp veya aksiyon hükmü veremez.

## 2. İleri finansal metrik sözleşmeleri

Bu aile temel `FIN-*` sonuçlarını yeniden tanımlamaz. `FAN-*` kimlikleri, temel sonuçlardan üretilen ileri analizleri ifade eder.

### FAN-001 — Portföy yoğunlaşması ve Pareto

- **Kapsam:** müşteri, temsilci, SSM, kanal veya segment × dönem/kesim.
- **Ölçüler:** ticari fatura, ekonomik tahsilat, cari açık, 29+ açık, açık Çek, açık Senet ve toplam risk ayrı ayrı seçilebilir.
- **Sonuçlar:** ilk 1/5/10/20 müşterinin payı, seçilen ilk N payı, kümülatif Pareto eğrisi ve HHI.
- **Formül:** `top_n_share = 100 × Σ(top N positive contribution) / Σ(all positive contribution)`; `HHI = 10.000 × Σ(customer_share_decimal²)`.
- Sıfır toplamda sonuç null olur. Negatif bakiye pozitif risk yoğunlaşmasını mahsup etmez. HHI ve Pareto bir risk kararı değil, yoğunlaşma göstergesidir.

### FAN-002 — Aylık aging geçiş matrisi

- Ay başındaki her açık lot parçası kendi yaş diliminden; ay sonunda bulunduğu yaş dilimi, `CLOSED`, `INVALIDATED` veya `TRANSFERRED_OUT` durumuna izlenir.
- Matris hem tutar hem lot/müşteri adedi üretir. Yaş ilerlemesi ile gerçek kapama birbirinden ayrılır.
- Virman ve organizasyon değişimi başarı/başarısızlık değildir; kaynak çıkışı ve hedef girişi olarak mutabakat kolonunda görünür.
- Her başlangıç satırında `Σ hedef durum tutarı = başlangıç uygun tutarı + geçerli dönem içi düzeltmeler` olmalıdır.

### FAN-003 — Fatura kohortu/vintage kapanma eğrisi

- Faturalar kesildikleri takvim ayına göre kohortlanır; ticari fatura ile başlangıç/manüel devir ayrı seri olur.
- Gün `7, 14, 21, 28, 45, 60, 90` için: `100 × o gün sonuna kadar ekonomik olarak kapanmış kohort anaparası / o günü gözlemleyecek kadar yaşlanmış uygun kohort anaparası`.
- Henüz ilgili güne ulaşmamış faturalar paydaya girmez. İptal/geçersiz çıkış performans sayılmaz; virman orijinal fatura ve yaş izini korur.
- Tek fatura üzerindeki çoklu satış satırları fatura kimliği ve toplam anapara üzerinden ele alınır; satır sayısı müşteri/fatura adedini şişirmez.

### FAN-004 — Ödeme süresi sağkalım analizi

- Sağdan sansürlü açık faturaları dışlamadan Kaplan–Meier benzeri tutar-ağırlıklı açık kalma eğrisi üretir.
- `S(d)`, bir fatura anaparası parçasının `d` gün sonunda hâlâ açık olma olasılığıdır. Medyan kapanma günü yalnız `S(d) ≤ 0,50` gözlenirse üretilir; aksi halde null.
- Müşteri örneği yetersizse sırasıyla temsilci/kanal/şirket kohortuna geri düşülür ve kullanılan seviye açıklanır. Devir ve ticari fatura eğrileri karıştırılmaz.

### FAN-005 — Yeni 29+ giriş ve eski alacak yükü değişimi

- `new_29_plus_inflow`: dönem içinde ilk kez 29. güne giren açık anapara.
- `aged_settlement_outflow`: 29+ iken ekonomik olarak kapanan tutar.
- `aged_burden_change = closing_29_plus - opening_29_plus`.
- Açıklama köprüsü açılış, yeni 29+, reinstatement, virman giriş/çıkış, performans dışı çıkış, uygun kapama ve kapanış bileşenlerini mutabık tutar.
- CEI'nin yerine geçmez; CEI etkinliği, bu metrik ise stok ve akış değişimini gösterir.

### FAN-006 — Toplam risk değişim köprüsü

- `closing_total_exposure = opening_total_exposure + Σ(valid event total-exposure deltas)`.
- Köprü; ticari fatura, devir borç/alacak, nakit/banka, IADE/HIZMET, araç kabulü, araç gerçek ödemesi, iade/karşılıksız kullanıcı kararı, iptal, virman ve manuel düzeltmeyi ayrı sınıflarda gösterir.
- Çek/Senet kabulünde cari `-X`, araç riski `+X`, toplam risk etkisi `0` olarak görünür. Şirket içi virmanın şirket toplam etkisi `0` olmalıdır.
- Açıklanamayan fark `UNRECONCILED` olarak veri kalitesi blokajı üretir; “diğer” içine gizlenmez.

### FAN-007 — Ekonomik tahsilat ve gerçek nakit/risk azaltma köprüsü

- `economic_collection`: cari borcu geçerli biçimde azaltan Nakit, normal Havale, Çek/Senet kabulü, IADE ve HIZMET sınıflarının toplamıdır.
- `cash_risk_relief`: Nakit, normal Havale ve Çek/Senetin gerçek ödenmesiyle şirket toplam riskini/nakit alacağını gerçekten azaltan tutardır; aynı ekonomik olay bir kez sayılır.
- `noncash_relief`: IADE/HIZMET ve kullanıcı kararlı diğer nakit dışı azaltımlar ayrı gösterilir.
- IADE/HIZMET allocation'ları 3/6/12 ekonomik fatura kapama ve tahsilat gerçekleşme günü sonuçlarına gerçekten dağıtılan tutarları kadar girer; `cash_only` ödeme hızı bunları dışlar. SATIN ALMA her iki hızın, toplam fatura/tahsilatın ve tahsilat/fatura oranının dışındadır.
- Çek kapama Havalesi ekstrede/tahsilatta ikinci hareket değildir; yalnız aracın gerçek ödeme sonucunu ve risk kapanışını kanıtlar.

### FAN-008 — Çek/Senet vade merdiveni

- Kesim tarihindeki geçerli açık araçlar `geçmiş vade`, `0–7`, `8–14`, `15–30`, `31–60`, `61–90`, `91+` gün vade gruplarında tutar ve adet olarak gösterilir.
- Çek ve Senet ayrı seri, müşteri/temsilci/SSM/şirket ayrı yeniden toplulaştırma seviyeleridir.
- Vadesi gelmiş ama kullanıcı kararı bekleyen araç açık riskte ve `OUTCOME_PENDING` etiketiyle kalır; kendiliğinden ödenmiş veya karşılıksız sayılmaz.

### FAN-009 — Araç gerçekleşme beklentisi

- Gelecek vade dilimindeki araç tutarı, yalnız sonucu gözlenmiş geçmiş araçların tür/müşteri kohortundan hesaplanan gerçekleşme olasılığıyla çarpılır.
- Müşteri örneği yetersizse temsilci, kanal ve şirket sırasıyla geri düşme seviyeleridir. `expected_cash = Σ(face_value × calibrated_realization_probability)`.
- Gözlem sayısı, tutar kapsamı, model sürümü ve geri düşme seviyesi zorunludur. Bu sonuç `FORECAST`tur; ödenecek kesin tutar değildir.

### FAN-010 — 13 haftalık tahsilat/nakit görünümü

- Her gelecek `1–7, …, 85–91` gün kovası için üç ayrı seri üretir: açık faturalardan beklenen doğrudan nakit, mevcut açık araçlardan beklenen gerçek settlement ve toplam. `EXISTING_BOOK` ile onaylı gelecek ticari fatura ekleyen `EXTENDED_OPERATING` ayrı kapsamdır.
- Fatura tarafı `FAN-004` ekonomik survival'ını nakit gibi kullanmaz; cash/transfer, instrument acceptance ve noncash close competing-risk cause'ları içinden yalnız doğrudan nakit olasılığını tüketir. Araç tarafı `FAN-008/009` vade, gerçek settlement zamanı ve gerçekleşme olasılığını kullanır.
- Sonuç deterministik 1.000 ortak residual yolundan `P25/P50/P75` bantla verilir. 4/13 hafta quantile'ı aynı path toplamlarından gelir; haftalık P25/P50/P75 ayrı ayrı toplanmaz. Bilinen araç vadesi takvimdir, ödeme olasılığı tahmindir.
- Sellout TL, Belgeler ve KA irsaliye nakit tahminine girmez. Başlangıç bakiyesi veya olay kapsamı eksikse resmî tahmin bloke/partial olur.

### FAN-011 — Finansal tahmin geri testi

- Her geçmiş kesimde yalnız o tarihte bilinen verilerle yeniden tahmin yapılır; gelecek bilgi sızıntısı yasaktır.
- Haftalık ve 4/13 haftalık ufuklarda `MAE`, `WAPE = Σ|actual-forecast|/Σ|actual|`, `bias = Σ(forecast-actual)/Σactual` ve tahmin aralığı coverage hesaplanır.
- Gerçek toplam sıfırsa WAPE/bias null olur. En az 26 origin gerekir; challenger hem 4 hem 13 hafta WAPE'de naif bazdan en az `%5` iyi, zorunlu hiçbir ufukta `%10`dan fazla kötü değil ve P25–P75 coverage `%40–%80` ise `APPROVED` olabilir.

### FAN-012 — Erken bozulma sinyalleri

- Sinyaller skorun içinde saklanmaz; kanıtlarıyla ayrı olaylardır: yeni 29+ hızlanması, 29+ payında artış, CEI düşüşü, DSO artışı, toplam riskin satıştan hızlı büyümesi, limit aşımı, vadesi gelmiş sonuç bekleyen/olumsuz araç, satışsız açık risk ve manuel çatışma.
- Başlangıç v1 karşılaştırması son 3 tamamlanmış ayı önceki 3 ayla; cari ayı aynı gün sayısına normalize edilmiş geçmiş aylarla karşılaştırır.
- Bir sinyal hem değişimin yönünü hem maddi tutar/pay katkısını taşımalıdır. Küçük taban kaynaklı büyük yüzdeler tek başına kritik uyarı üretmez.

### FAN-013 — Robust anomali tespiti

- Aylık/haftalık seri yeterliyse medyan ve MAD tabanlı robust z-skoru kullanılır; MAD sıfırsa IQR veya deterministik dönemsel kıyas geri düşmesi uygulanır.
- Anomali yalnız “beklenenden farklı” demektir; neden değildir. AI, katkı yapan müşteri/temsilci/işlem sınıflarını ayrıca kanıtlamadan nedensellik kuramaz.
- Model girdisi, pencere, mevsimsel grup, eşik ve sürüm sonuçla saklanır.

### FAN-014 — Finansal davranış segmenti

- Master müşteri segmentini değiştirmeyen ayrı, sürümlü analitik sınıflamadır.
- Başlangıç sınıfları: `YENI_YETERSIZ_VERI`, `SAGLIKLI_DONGU`, `BUYUYEN_RISK`, `29_PLUS_TOPARLAMA`, `KALICI_ESKI_BORC`, `ARAC_AGIRLIKLI`, `SATISSIZ_ACIK_RISK`, `KRITIK_MANUEL_INCELEME`.
- Sınıf; FIN-012/013/014/015/021, araç payı, satış etkinliği ve coverage kurallarından açıklanabilir biçimde üretilir. Tek müşteri bir ana sınıf ve birden fazla kanıt etiketi taşıyabilir.

### FAN-015 — Açıklanabilir tahsilat takip önceliği

- Bu bir çalışma sırası önerisidir; tahsilat veya müşteri durumu işlemi değildir.
- Sürümlü v1 puanı: risk maddiliği `%30`, aging şiddeti `%25`, vadesi gelmiş araç riski `%20`, son dönem bozulma `%15`, etkin limit aşımı `%10`.
- Her bileşen portföy içi yüzdelik veya onaylı temel metrik bandından `0–100`e gelir. Kullanılabilir ağırlık `<%60` ise puan null; kritik kullanıcı kararı/çatışması varsa sıraya puansız `MANUAL_REVIEW` olarak girer.
- Liste, toplam puanın yanında tutar etkisi ve ilk üç katkı nedenini göstermek zorundadır. Kullanıcı takip sonucunu ileride kaydederse öneri başarısı ayrıca ölçülebilir.

### FAN-016 — Stres ve senaryo motoru

- Gerçek veri değiştirilmeden varsayımlı projeksiyon oluşturur. Başlangıç senaryoları: tahsilat `%25` düşük, tahsilat `14 gün` gecikmeli, ticari fatura `%25` yüksek/düşük, vadesi gelen araç gerçekleşmesi tarihsel alt çeyrekte, en büyük müşteri tahsilatı sıfır ve birleşik olumsuz senaryo.
- Sonuçlar: 4/13 haftalık beklenen toplam risk, cari/araç kırılımı, 29+ tutar/pay, iç limit kullanım/boşluk, nakit görünümü ve yoğunlaşma.
- Her senaryo `SCENARIO` etiketi, varsayım seti ve baz sonuç farkıyla gösterilir; gerçek tahminle birleştirilmez.

### FAN-017 — En büyük karşı taraf kaybı testi

- İlk 1/5/10 müşterinin belirli ufukta ödeme yapmadığı, yeni satışın seçime göre devam ettiği/durduğu iki ayrı senaryo çalışır.
- Risk ve nakit etkisi müşteri bazlı katkıdan yeniden hesaplanır; mevcut faturalar silinmez, varsayımsal ödeme akışı değiştirilir.
- Portföy yoğunluğu yüksekliğini tek başına “kayıp” saymaz; yalnız duyarlılığı gösterir.

### FAN-018 — Yönetimsel beklenen zarar senaryosu

- Muhasebe karşılığı değildir. `scenario_expected_loss = exposure_at_default × calibrated_PD × calibrated_LGD` yalnız yönetimsel stres/karşılaştırma için hesaplanabilir.
- Stress event, maddi pozitif exposure'ın 90+ duruma geçip 30 ardışık gün kalması veya pozitif exposure varken teyitli olumsuz araç sonucudur; customer-horizon başına en fazla bir event. `PD=event customer-horizon/eligible customer-horizon`, EAD event/cutoff'taki pozitif total exposure'dır.
- `LGD=1−min(180 günlük geçerli economic recovery,event EAD)/event EAD`; araç kabulü ancak gerçek settlement olursa recovery'dir. Fallback `segment+channel→channel→company`; her seviyede en az 50 tam horizon ve 10 event gerekir.
- Yeterli event/recovery örneği yoksa sonuç üretilmez veya açık kullanıcı PD/LGD varsayımlarıyla `SCENARIO_ONLY` çalışır. Resmî muhasebe karşılığı adıyla sunulmaz.

### FAN-019 — Yeniden açıklama/restatement etkisi

- Önceden yayımlanan snapshot ile aynı dönem için güncel kurallarla yeniden hesaplanan sonucu karşılaştırır.
- Fark; geç yükleme, iptal eşleşmesi, kullanıcı düzeltmesi, kaynak güncellemesi, kural sürümü ve hiyerarşi/virman değişimi olarak ayrıştırılır.
- Kullanıcı `o tarihte yayımlanan` ile `bugünkü bilgiyle yeniden hesaplanan` sonucu seçebilir; ikisi sessizce birbirinin yerine geçmez.

### Paket 12D alt sözleşme kimlikleri — FAN-035..046

- `FAN-035`: as-of/knowledge-cutoff/timezone ve 13×7 günlük forecast kovalarını sabitler.
- `FAN-036`: açık invoice principal'ında direct cash/transfer ile instrument/noncash/non-performance/censor competing-risk cause'larını ayırır.
- `FAN-037`: açık Çek/Senet için type ve fallback kontrollü gerçek settlement hafta dağılımını üretir.
- `FAN-038`: 26/52 tam hafta uygunluğu ve rolling-origin kapısıyla gelecek ticari invoice modelini seçer; onaysız model extended sonuç veya 12B P75 girdisi olmaz.
- `FAN-039`: deterministik 1.000 ortak path, nonnegative state ve haftalık/4/13 hafta coherent P25/P50/P75 üretir.
- `FAN-040`: minimum 26 origin, 4/13 hafta `%5` WAPE kazancı, horizon başına `%10` non-inferiority ve `%40–%80` interval coverage ile model promotion yapar.
- `FAN-041/042`: sürümlü bozulma eşikleri, maddilik ve immutable `OPEN/ACKNOWLEDGED/RESOLVED` occurrence zinciridir.
- `FAN-043`: minimum history, median/MAD mutlak z `3.5`, 3×IQR ve kontrollü fallback ile robust anomali üretir.
- `FAN-044`: raw component'ları portföy içi `CUME_DIST` ile ölçekleyip `%30/%25/%20/%15/%10` açıklanabilir tahsilat önceliğine dönüştürür; `<%60` coverage null'dır.
- `FAN-045`: immutable base üzerinde sürümlü scenario state transition ve çift şok engelidir.
- `FAN-046`: 90+ 30 gün kalıcılık/olumsuz araç stress event'i, positive EAD, 180 gün LGD ve 50/10 kalibrasyon kapılı management-loss senaryosudur.

### FAN-020 — Finansal mutabakat ve kapanış hazır olma

- Cari defter toplamı, açık lotlar, dağıtılmamış alacak, Çek/Senet riski, allocation, iptal grupları, virman çiftleri ve manuel override'lar için kontrol toplamları üretir.
- Zorunlu denklikler: açık lot toplamı ile pozitif cari kapsam mutabakatı; araç olayları ile açık araç portföyü; dengeli virman şirket etkisi `0`; rapor köprülerinin açıklanamayan farkı `0`.
- Kritik fark, belirsiz iptal/kapama veya eksik başlangıç kapsamı varsa dönem `NOT_READY`; uyarılar çözülmüş ve tüm kritik denklikler sağlanmışsa `READY_WITH_WARNINGS/READY` olur.

### FAN-021 — Veri kapsam ve güven özeti

- Her rapor için beklenen/gelen dönem, satır, tutar ve müşteri kapsamını; manuel değişiklik, çözülmemiş çatışma, dışlanan tutar ve geri düşme seviyesini gösterir.
- `coverage_ratio` yalnız mevcut satır sayısı değildir; ilgili metriğin pay/paydasına girebilecek tutarın ne kadarının güvenli şekilde işlendiğini de taşır.
- Güven seviyesi iş performansına karışmaz. Düşük güven iyi/kötü sonuç değil, yorum sınırıdır.

### FAN-022 — Eş grup ve dönem kıyasları

- Müşteri/temsilci/SSM; kendi önceki dönemi, aynı kanal, aynı Master segmenti ve şirket dağılımıyla ayrı kıyaslanabilir.
- Eş grup en az 10 uygun birim ve yeterli coverage içermiyorsa dağılım yüzdeliği verilmez; daha üst gruba geri düşülür.
- Kıyas medyan, P25/P75 ve yüzdelik sıra ile yapılır. Eş grup sonucu resmî hedef veya kredi kararı değildir.

### FAN-023 — Müşteri 360 finansal özet

- Tek müşteri için bakiye/risk kırılımı, açık faturalar ve yaşları, 3/6/12 akışları, DSO/CEI, kapanma davranışı, araç vade merdiveni, sağlık/limit, son değişimler, uyarılar, veri güveni ve manuel kararları tek sözleşmede birleştirir.
- Özet yeni formül üretmez; bağlı temel ve ileri `metric_result_id` değerlerini düzenler.

### FAN-024 — Takip önerisi sonuç ölçümü

- Kaynak Paket 12F'nin native vaka/faaliyet/ödeme sözü günlüğüdür. Recommendation `PRESENTED/OPENED/CONVERTED/DISMISSED/EXPIRED`, vaka, planlanan/gerçekleşen faaliyet ve resmî finansal sonuç ayrı tutulur.
- Yalnız finansal sonuç bilinmeden önce kaydedilmiş `PERFORMED` faaliyet prospective eligible'dır. Planlanan veya geriye dönük kayıt anchor/başarı değildir.
- İlk eligible faaliyet sonrasında 7/14/30 günlük kümülatif pencerelerde yalnız Paket 08–10/12A canonical event/result ids gözlenir. Ekonomik, direct cash, IADE/HIZMET, araç kabulü ve araç settlement ayrı; kullanıcı beyanı finansal tutar kaynağı değildir.
- Tek customer×currency aktif vaka aynı olayı iki vakaya bağlamayı önler. Vaka içindeki faaliyetlere tutar paylaştırılmaz. Açılış+deltalar=kapanış risk köprüsünde yeni satış, iptal, transfer ve restatement ayrıdır.
- Ödeme sözü kind/tutar/vade ile immutable kaydedilir; event parçaları due-date FIFO ile tek söze bağlanır. On-time, +7 gün late, partial, broken ve excess ayrıdır. Sözün tutulması aksiyon nedenselliği değildir.
- Adoption, faaliyet tamamlama, contact, promise amount ve observed relief oranları exact pay/payda/coverage/maturity taşır. Tamamlanmamış horizon başarısızlık değildir.
- Normal çıktı `TEMPORAL_ASSOCIATION`; before/after veya contacted-vs-not yalnız `DESCRIPTIVE_ASSOCIATION`dır. `CAUSAL_LIFT` ancak ön kayıtlı randomize deney, ITT, her kolda ≥30 unit/≥10 event, ≥%90 coverage ve 2.000 bootstrap %95 interval kapısını geçerse verilir. Zero-cross `INCONCLUSIVE`, kalite eksiği `CAUSAL_BLOCKED`dır.
- Bu ölçüler prim, ceza, limit, sevkiyat veya müşteri statüsü kararı değildir; AI “sayesinde” veya “AI tahsil etti” diyemez.

## 3. Standart rapor kataloğu

1. **Yönetici finansal kokpit:** toplam risk kırılımı, değişim köprüsü, 29+ yük, DSO, CEI, nakit görünümü, yoğunlaşma, kritik uyarı ve veri güveni.
2. **Aging ve tahsilat merkezi:** standart yaş dilimleri, yeni 29+ giriş, eski alacak kapama, CEI ve müşteri katkıları.
3. **Müşteri 360:** `FAN-023` sözleşmesi ve lot/belge drill-down'ı.
4. **Temsilci/SSM finansal karnesi:** `FIN-017` bileşenleri, bağlam metrikleri, müşteri dağılımı ve sorumluluk transfer mutabakatı; satış/litre karnesi ayrı sekme/seri.
5. **Çek/Senet risk ve vade merkezi:** açık risk, vade merdiveni, gerçekleşme, sonuç bekleyen/iade/karşılıksız adaylar ve kullanıcı karar kuyruğu.
6. **13 haftalık nakit görünümü:** fatura/araç kaynaklı P25/P50/P75, gerçek-vs-tahmin ve model güveni.
7. **Kohort ve ödeme davranışı:** fatura vintage eğrisi, sağkalım eğrisi, 28/45/60/90 kapanma oranları.
8. **Risk geçiş/migration raporu:** aging geçiş ısı haritası, kapama ve performans dışı çıkış mutabakatı.
9. **Yoğunlaşma ve karşı taraf riski:** Pareto, HHI, ilk N ve en büyük müşteri stresleri.
10. **Limit, boşluk ve stres laboratuvarı:** önerilen/etkin limit, kullanım, değişim, senaryo sonuçları; mutasyon yoktur.
11. **Tahsilat takip önceliği:** açıklanabilir müşteri sırası, maddi tutar, nedenler, kullanıcı kararları ve ileride aksiyon sonucu.
12. **Mutabakat, veri kalitesi ve restatement:** kapanış hazır olma, kontrol farkları, geç/yeniden yükleme ve yayımlanmış-vs-güncel sonuç değişimi.
13. **Gelişmiş AI analizi:** kullanıcı tarafından seçilen herhangi bir raporda geçmiş–bugün–gelecek, katkı, anomali, risk, belirsizlik ve izlenebilir öneri.

## 4. Bilinçli olarak hesaplanmayacak alanlar

- **Müşteri/ürün kârlılığı ve brüt marj:** ürün maliyeti, iskonto, lojistik ve hizmet maliyeti kaynağı olmadan hesaplanmaz.
- **Resmî muhasebe karşılığı:** onaylı muhasebe politikası ve gerekli temerrüt/geri kazanım geçmişi olmadan üretilmez; `FAN-018` yalnız yönetimsel senaryodur.
- **Kesin tahsilat nedeni veya AI nedenselliği:** temas/aksiyon ve dış olay verisi yoksa korelasyon neden olarak sunulmaz.
- **Belgeler/KA/Sellout TL kaynaklı finansal gelir veya nakit:** onaylı ayrım nedeniyle yasaktır.

## 5. Rapor ve grafik sözleşmesi

Grafiklerin görsel tasarımı kod aşamasında yapılacaktır; ancak veri sözleşmesi şimdiden sabittir:

- Her widget `report_definition_version`, `widget_key`, `metric_result_ids`, boyutlar, filtreler, dönem, comparison, display unit, rounding, coverage ve drill-down tanımı taşır.
- Widget içinde JavaScript/istemci formülü yazılmaz. Tüm sayılar merkezi metrik/analiz motorundan gelir.
- Desteklenen ilk görsel türleri: KPI kartı, çizgi/alan, yığılmış kolon, waterfall, heatmap, Pareto, survival/vintage eğrisi, dağılım/bubble, tablo ve açıklanabilir öncelik listesi.
- Her grafik tablo görünümüne ve kaynak sonuca drill-down verebilir. Yuvarlanmış etiket ile kesin ham değer ayrı tutulur.
- Varsayılan yönetici sayfası sade olabilir; detay metrikler katalogdan çıkarılmaz, filtre/rapor/AI ile erişilebilir kalır.

## 6. AI yorumlama sözleşmesi

Her rapor cevabı mümkün olduğunda şu sırayı uygular:

1. En önemli gerçekleşmiş bulgu ve kapsamı.
2. Uygun önceki dönem/hedef/eş grup karşılaştırması.
3. Farkın müşteri, temsilci, işlem sınıfı veya yaş dilimi katkıları.
4. Kanıtlı risk/anomali ve veri güven sınırı.
5. Ayrı etiketli gelecek tahmini veya senaryo.
6. Dayanak sonuç kimliklerine bağlı, ölçülebilir takip önerisi.

AI düz sayı tekrarıyla yetinmez; fakat veri desteklemiyorsa fikir üretmek adına kesin neden uydurmaz. “Bence” niteliğindeki yorum dahi `INFERENCE` veya `RECOMMENDATION` olarak işaretlenir ve dayanakları gösterilir.

### 6.1 AI Odak Analiz gösterim sözleşmesi

- Ortak alan adı kullanıcı arayüzünde `AI Odak Analiz`dir. Portföy raporunda KPI'ların altında; liste/kartta açılır compact alan; detay drawer'da evidence drill-down; PDF'de maddi özet; XLSX'te claim/evidence tablosu olarak gösterilir.
- Mevcut uygulamadaki koyu cam rapor paneli, durum rozeti ve sol vurgu; akıcı özet ile ayrı aksiyon/öngörü paragrafı; karttaki typewriter ve dönüşümlü `✨ GÜNLÜ ODAK ANALİZİ`; geniş sekmeli müşteri `Analiz` penceresi, metrik kartları, trend/dağılım grafikleri ve mor-mavi içgörü kartı korunacak sunum dilidir. En fazla üç bulgu/iki kontrol kuralı akıcı paragrafı yasaklamaz; paragrafın kanıt kapsamını sınırlar.
- `AI Odak Analiz ↗` geniş pencereyi doğrudan `Analiz`, `Ekstre & Detay ↗` ekstre bağlamında açar. Hover olmayan cihaz, klavye odağı, Escape/focus dönüşü ve `prefers-reduced-motion` eşdeğerleri zorunludur; focus/pointer içerideyken otomatik yorum dönüşümü durur.
- Bu koruma yalnız UX kabuğu ve anlatım ritmi içindir. `shadowLimit`, Master limit fallback'i, hardcoded ödeme profilleri, yanlış 3/6/12 gün eşlemesi, sözleşme kaydı olmadan `kontrat vadesi`, allocation olmadan kapanma ve kanıtsız kesin tavsiye katalog sonucu değildir.
- Compact görünüm model çağrısı yapmayan domain digest'idir. Tam anlatı kullanıcı açışı, seçili toplu analiz veya snapshot publish'iyle oluşturulur. Liste satırı başına otomatik model çağrısı yapılmaz.
- Kart içeriği en fazla bir durum cümlesi, üç belirleyici bulgu, iki sonraki kontrol ve bir coverage/güncellik notudur. Daha fazla ayrıntı drill-down veya report pack'e gider.
- Claim'ler domain state'i, metric/result/evidence id'leri ve aynı snapshot'tan gelir. Model severity, KPI, bakiye, kalan sipariş veya ödeme durumu hesaplamaz.
- Sevkiyat odak görünümü sırasıyla bugünkü sipariş durumu, müşteri cari/toplam risk, resmî ödeme ve gerçek allocation, eski açık lot/FIFO, araç riski, coverage ve sonraki kontrolü gösterir. TEMP Belgeler yalnız operasyon sinyalidir; sipariş tutarı eksi ödeme finansal sonuç değildir.
- `BLOCKED_DATA`da yorum eksik kanıtı söyler; `CLEAR_WITH_EVIDENCE`ı borçsuzluk veya garantiye genişletmez. Geçmiş/teslim edilmiş sevkiyat analizi Fatura Kontrol'e yönlendirilir.
- `Neden böyle?`, `Kanıtları gör` ve `Sonraki kontrol` eylemleri bulunur. Sonraki kontrol butonu yalnız yetkili ayrı workflow/preview açar; AI metni mutasyon yapmaz.
- Loading, empty, stale, error, blocked ve unauthorized durumları ayrı; durum renk dışında ikon+metinle; run/as-of ve son güncelleme bilgisiyle erişilebilir gösterilir.
- Card, sohbet, PDF ve XLSX aynı `analysis_id/claim_id` setini kullanır. Yetki, context, run, policy/model/prompt veya locale değişince cache ayrılır ve eski analiz stale olur.

## 7. Dönemsel karşılaştırma ve çok formatlı rapor paketi

### 7.1 Karşılaştırma sözleşmesi

- `PREVIOUS_PERIOD`: seçili dönemle aynı uzunluktaki hemen önceki dönem.
- `PREVIOUS_MONTH`: tamamlanmış takvim ayı ile önceki tamamlanmış ay.
- `YEAR_OVER_YEAR`: aynı takvim gün/ay aralığının önceki yıl karşılığı.
- `ROLLING_3/6/12`: tamamlanmış gerçek takvim aylarından oluşan onaylı pencereler.
- `ROLLING_3/6/12` bu katalogdaki müşteri finansal fatura–tahsilat analizlerine aittir: fatura/tahsilat günleri, aylık toplam fatura, aylık toplam tahsilat ve tahsilat/fatura oranı. Sellout raporunun dönem filtresi değildir; Sellout ayrı `YYYY-MM` aylarıyla çalışır.
- `CUSTOM_PERIOD_PAIR`: kullanıcının seçtiği iki açık tarih aralığı.
- Her karşılaştırmada dönem tarihleri, gün sayıları, coverage, kapsam/filtre eşitliği, mutlak fark, yüzde fark ve uygun olduğunda katkı kırılımı saklanır.
- Önceki değer `0` ise yüzde değişim null ve `BASE_ZERO` neden kodudur; sonsuz büyüme veya `%100` uydurulmaz. Kapsamlar farklıysa sonuç `NON_COMPARABLE` veya açık normalizasyon notuyla verilir.

### 7.2 Ortak rapor paketi

Tek bir `report_snapshot` aşağıdaki formatların tamamını besler:

1. **Ekran/HTML:** etkileşimli filtre, tooltip, drill-down, tablo görünümü ve AI anlatısı.
2. **PDF:** A4 yatay/dikey şablona uygun, baskıya hazır yönetim raporu.
3. **Excel/XLSX:** düzenli özet ve yeniden analiz edilebilir detay sekmeleri.
4. **Görsel:** paylaşılabilir yüksek çözünürlüklü PNG; uygun vektörel grafiklerde SVG.

Formatlar ayrı hesap yapmaz. Görünüm için yuvarlama yapılabilir fakat ham değer ve `metric_result_id` manifestte korunur.

### 7.3 PDF rapor yapısı

1. Kapak: rapor adı, kapsam, dönem, karşılaştırma, veri kesimi ve gizlilik.
2. Yönetici özeti: en önemli 3–7 bulgu, temel riskler ve ölçülebilir öneriler.
3. KPI karşılaştırma tablosu: cari, kıyas, fark, değişim, güven ve kısa yorum.
4. Grafikler: yalnız iş kararını destekleyen seçili görseller; dekoratif grafik eklenmez.
5. Katkı ve istisnalar: sonucu taşıyan müşteriler/temsilciler/sınıflar ile önemli anomaliler.
6. Gelecek görünümü: varsa tahmin ve senaryo, gerçekleşmiş bölümden görsel olarak ayrılmış.
7. Veri kalitesi ve kapsam: eksikler, dışlanan tutar, manuel karar ve güven sınırı.
8. Metodoloji/ek: metrik tanımları, filtreler, sürümler ve gerektiğinde detay tablolar.

Sayfa taşmaları, bölünen tablo başlıkları, okunamayacak küçük yazı ve kırpılmış grafik kabul hatasıdır. Üstbilgi/altbilgi sayfa numarası ve kısa rapor kimliği taşır.

### 7.4 Excel çalışma kitabı yapısı

- `Yönetici Özeti`: KPI kart benzeri hücre düzeni, kısa AI bulguları ve rapor kapsamı.
- `Dönem Karşılaştırma`: ölçü, cari değer, kıyas değeri, mutlak/yüzde fark, birim, güven ve neden kodu.
- Analize özel sekmeler: Aging, Tahsilat, Çek-Senet, Kohort, Tahmin, Yoğunlaşma veya rapor türüne göre gerekli alt küme.
- `Detay Veri`: satır seviyeli yetkili kayıtlar; Excel Table, filtre, sabit başlık, doğru veri tipi ve birleştirilmemiş hücreler.
- `Veri Kalitesi`: coverage, dışlama, çatışma, bekleyen kullanıcı kararı ve mutabakat sonuçları.
- `Metodoloji`: metrik kimliği/adı, sürümü, formül özeti, dönem, filtre, calculation run ve oluşturma bilgisi.

Özet sayfalarında biçim/formül bulunabilir; resmî metrik değeri workbook içinde yeniden hesaplanan bağımsız Excel formülüne emanet edilmez. Detay–özet kontrol toplamları export üretiminde doğrulanır.

### 7.5 Görsel tasarım ilkeleri

- Türkçe sayı/tarih biçimi, tutarlı TL/litre/koli/yüzde/gün birimleri ve tek tip ondalık politikası.
- Başarı, risk, nötr, tahmin ve senaryo için sürümlü semantik renkler; koyu/açık tema ve baskı karşılığı.
- Erişilebilir kontrast; durum yalnız renk ile anlatılmaz.
- Yönetim raporunda görsel hiyerarşi: sonuç → karşılaştırma → neden/katkı → öneri.
- Uzun müşteri adları, yüksek değerler, null/blocked sonuçlar ve çok serili grafikler için taşma/okunabilirlik testleri.

### 7.6 AI rapor üretme davranışı

AI, örneğin “son 3 ayı önceki 3 ayla karşılaştır, yorumla ve PDF/Excel hazırla” isteğini şu plana çözer:

`report_key → metric set → scope/filters → current period → comparison period → result manifest → interpretation claims → template version → requested artifacts`.

AI hangi grafiklerin rapora alınacağını maddilik ve anlatı katkısına göre seçebilir; resmî sayıları değiştiremez. Çıktı üretiminden önce yetki, coverage ve karşılaştırılabilirlik kontrolü çalışır. Başarılı işte kullanıcıya kısa özetle birlikte indirilebilir artifact bağlantıları ve kullanılan dönem/filtre özeti döner.

### 7.7 Snapshot, filtre ve restatement kesinliği

- Her rapor çalışması approved definition version, yayımlanmış calculation/source run seti, knowledge cutoff, canonical scope/filter/period/comparison, authorization scope, locale/timezone ve tek sonuç manifestine pinlenir.
- Widget, grafik, AI, PDF, XLSX veya görsel metrik formülü çalıştırmaz. Her değer `metric_result_id`, exact/display value, unit, state/reason, coverage ve evidence ile manifestten gelir.
- Sellout geçmiş raporu ay bazlı `YYYY-MM` seçimidir; finansal `ROLLING_3/6/12` tamamlanmış gerçek takvim ayı penceresidir. Biri diğerine dönüştürülemez. Eksik/PARTIAL ay sıfır değildir.
- Base `0` yüzde değişimi null/`BASE_ZERO`; scope/filter/currency/coverage farkı `NON_COMPARABLE/PARTIAL`dır. Delta exact değerlerden hesaplanır, görüntü yuvarlamasından değil.
- Published snapshot/artifact değişmez. Yeni kaynak, metric veya policy yeni snapshot üretir; restatement eski/yeni result id, exact delta, state/coverage ve neden diff'iyle görünür.

### 7.8 Drill-down, export ve kalite güvenliği

- Drill-down snapshot'a pinli allowlist dimension/column/filter/sort üzerinden keyset sayfalanır; serbest SQL veya satırdan yeni resmî toplam yoktur. Kesilen sonuç ve kalan adet görünürdür; `DİĞER` ana top-N toplamına mutabıktır.
- Özet, detay export ve artifact download yetkileri ayrıdır. Üretim ve indirme anında RLS/capability tekrar kontrol edilir; daralan yetki eski dosyayı açamaz.
- Artifact private storage'da immutable content hash, template/renderer version, confidentiality, retention/expiry ve download audit taşır. Renderer hatası yarım dosya yayımlamaz.
- PDF bütün sayfa visual QA; XLSX gerçek veri tipi/sekme/Table/control-total ve formula-injection kontrolü; PNG/SVG çözünürlük/kırpılma/sanitize kontrolü geçmeden publish edilmez.
- HTML, PDF, XLSX, PNG, SVG, sohbet ve AI Odak aynı snapshot/manifest/result/claim ids ve exact sayılara çapraz-format mutabakat verir. Format başına yeni hesap veya model çağrısı yoktur.

### 7.9 Ortak AI Odak rapor gösterimi

- Raporlarda KPI sonrası koyu cam akıcı analiz paneli; kartta typewriter/dönüşümlü hover-focus alanı; detayda geniş `Analiz` modalı ve mor-mavi içgörü karakteri korunur. Touch, klavye ve reduced-motion eşdeğerdir.
- Görsel korunumu eski hesap semantiğini korumaz. Panel yalnız domain `focus_digest` ve evidence-bound claim setini sunar; sevkiyat/limit/tahsilat/stok/muhasebe mutasyonu yapmaz.
- Paket 14 anlatı sağlayamıyorsa deterministic digest ve sayısal rapor üretimi sürer; yeni anlatı `AI_NARRATIVE_UNAVAILABLE` olarak açıkça işaretlenir.

### 7.10 Paket 13 merkezî sonuç ve yayın sözleşmesi

- Finansal formül/eligibility/FIFO/anlam sahipliği ilgili domain paketindedir. Paket 13 yalnız approved metric/calculator version, dependency DAG, canonical calculation run, exact result envelope, coverage/reconciliation ve atomik publication çalıştırır.
- Her finansal sonuç `metric_result_id, calculation_run_id, publication_id, metric/version, FACT|INFERENCE|FORECAST|SCENARIO|RECOMMENDATION, customer/org/currency scope, as-of/period, exact raw/display, pay/payda/components, source/dependency refs, coverage, reconciliation, exclusions/evidence` taşır.
- IADE/HIZMET ekonomik 3/6/12 fatura-ödeme akışına onaylı domain metriği üzerinden katılır; satış cirosu veya direct cash olmaz. SATIN ALMA müşteri metriğine sokulmaz. Paket 13 bu sınıfları yeniden yorumlamaz.
- `ZERO`, `MISSING`, `PARTIAL`, `BLOCKED`, `IMMATURE`, `NON_COMPARABLE` ve `BASE_ZERO` ayrıdır. Sellout ay filtresi ile finansal tamamlanmış 3/6/12 penceresi registry period type düzeyinde karışamaz.
- Kaynak/iptal/manual/allocation/hierarchy/parameter değişimi minimal impact plan ve yeni immutable publication üretir. Eski sonuç/artifact değişmez; restatement old/new exact delta, state, coverage, reconciliation ve neden diff'i verir.
- Ekran, AI, PDF, XLSX ve drill-down aynı published result ids/exact değerleri tüketir; client, renderer veya prompt finansal toplamı yeniden hesaplayamaz.

### 7.11 Paket 14 finansal semantik ve claim güvenliği

- Finansal AI yalnız approved descriptor ve Paket 13 published result envelope'ını kullanır. “Ciro”, “bakiye”, “açık fatura”, “toplam risk”, “tahsilat”, “nakit”, “ödeme hızı”, “DSO”, “CEI”, “vade” ve “limit” birbirinin fallback metriği değildir.
- 3/6/12 ödeme hızı tamamlanmış takvim ayı penceresidir. Ekonomik sürüm IADE/HIZMET allocation katkısını içerir; `cash_only` içermez. SATIN ALMA müşteri finansal olayına girmez. AI hangi tanımı kullandığını pay/payda, gün ve katkı refs'iyle açıklar.
- Belgeler geçici sinyali tahsilat/peşin/kapama; Çek/Senet kabulü nakit; settlement ikinci cari azaltma; acknowledgement resolution; `CLEAR_WITH_EVIDENCE` borç yokluğu olarak genişletilemez.
- FACT/INFERENCE/FORECAST/SCENARIO/RECOMMENDATION ayrımı korunur. Tahmin kesin ödeme, scenario muhasebe karşılığı, anomaly neden, priority kredi/temas kararı veya randomize olmayan takip sonucu causal başarı değildir.
- Modelden bağımsız validator her sayıyı exact financial result/component'a; entity/currency/as-of/period/state/coverage/restatement bilgisini claim'e bağlar. Kanıtsız neden, müşteri hükmü, otomatik sevkiyat/limit/tahsilat önerisi veya gizli mutasyon publish edilemez.
- Yoğun finansal sonuç deterministic digest ve Paket 12E manifestiyle `REPORT_PACK`; küçük soru doğrudan `INLINE` cevaplanır. Her format aynı claim/result setini kullanır ve format başına yeniden model çağrılmaz.

### 7.12 Paket 15 finansal cutover ve legacy retirement

- Finansal source/import, ledger/allocation, read model, analytics/report, AI read ve mutation ayrı capability dalgalarıdır. Upstream source/FIFO/reconciliation hazır olmadan finansal rapor veya AI yalnız legacy sonucu v2 diye etiketleyemez.
- Migration immutable satış/tahsilat/IADE-HIZMET/araç/manual source ve revision'larından yapılır; client bakiye, eski aging dağılımı, shadow limit veya rapor export'u resmî başlangıç verisi değildir.
- Legacy-v2 comparison aynı customer/currency/as-of/knowledge cutoff/period/grain/source manifestte exact bakiye, lot principal, allocation, açık fatura, araç riski, DSO/CEI/3-6-12 pay-payda ve coverage'ı karşılaştırır. Onaylı semantik farklar decision/matrix ref'i taşır; unexplained delta ve v2 defect go'yu bloklar.
- Read cutover ekran/API/AI/PDF/XLSX'i aynı v2 publication'a atomik geçirir. V2 hata verince eski finansal formül veya client state'e sessiz fallback yapılamaz; last valid result stale etiketi veya açık unavailable gösterilir.
- Write cutover legacy inflight drain, watermarks, `WRITE_FROZEN`, tek v2 writer ve preview→commit→ledger/allocation→metric/outbox smoke mutabakatı ister. Dual-write ile iki ekonomik olay üretmek yasaktır.
- Write rollback v2 olay/revision/audit'i silmez ve post-cutover eventler exact reconcile edilmeden legacy writer'ı açmaz. Gerekirse sistem read-only kalır ve forward-fix/restatement yapılır.
- Legacy finansal write/read yolu bir tam ay kapanış ve reconciliation ile en az 30 gün fallbacksiz v2 primary görülmeden disabled olmaz. Raw source, financial event, allocation, audit ve calculation result retention nedeniyle korunur; UI/kod kapatma fiziksel veri silme değildir.

## 8. Bütün soru türleri için evrensel sunum politikası

Bu bölüm finansal raporlarla sınırlı değildir. Sistem içindeki her AI sorusu aynı sunum yöneticisinden geçer.

### 8.1 Teslim modları

| Mod | Kullanım | Sohbet çıktısı | Ayrıntı |
|---|---|---|---|
| `INLINE` | Tek/az metrik, dar kapsam, okunabilir küçük sonuç | Doğrudan cevap + kısa yorum + gerekli kanıt | İsteğe bağlı drill-down |
| `INLINE_PLUS_VISUAL` | Karşılaştırmalı veya orta yoğunlukta sonuç | Kısa özet + temel görsel/tablo + yorum | Tam ekran görsel ve export eylemleri |
| `REPORT_PACK` | Çok dönemli, çok boyutlu, çok satırlı veya kapsamlı analiz | 3–7 önem sıralı bulgu + sonuç/risk/öneri + coverage | Şık görsel rapor, PDF, Excel ve sayfalı detay |

Dosya üretimi cevabın yerine geçmez. Her modda kullanıcı sorusunun esas sonucu sohbet içinde bulunur.

### 8.2 Yoğunluk değerlendirmesi

`response_delivery_policy` aşağıdakileri birlikte değerlendirir:

- tahmini serialize edilmiş sonuç/token büyüklüğü,
- satır, kolon, metrik, dönem ve boyut sayısı,
- karşılaştırma, katkı ve anomali sayısı,
- kullanıcının özet/detay/export niyeti,
- mobil/masaüstü okunabilirliği ve seçili kanal,
- gizlilik/yetki nedeniyle detayın gösterilebilirliği.

Eşikler sürümlüdür ve telemetriyle ayarlanır. Tek bir sabit satır sayısı bütün soru türlerine uygulanmaz.

### 8.3 Analysis digest

Model girdisi mümkün olduğunda şu doğrulanmış pakettir:

`direct_result, comparison, top_contributions, material_exceptions, anomaly_signals, confidence_coverage, excluded_remainder, drilldown_refs, result_manifest_id`.

Top-N kullanıldığında kalan bölüm `diğer` toplamıyla mutabık tutulur; kaç kayıt/tutarın sohbette gösterilmediği açıklanır. Ham ayrıntı yetkili Excel veya sayfalı drill-down'da korunur.

### 8.4 Token ve tekrar kullanım politikası

- Aynı soru için PDF, Excel ve görsel başına yeniden AI analizi yapılmaz.
- Deterministik grafik/dosya renderer'ı model çağrısı yapmaz.
- Claim/anlatı seti uygun formatlara bir kez yazılır; şablon yalnız sunumu değiştirir.
- Cache anahtarı en az `tenant/user authorization scope + semantic plan + snapshot + filters + period/comparison + metric/template versions` içerir.
- Ayrıntı isteği yalnız seçili drill-down dilimini getirir; önceki bütün bağlamı tekrar taşımak zorunda değildir.
- Bütçe baskısında önce sunucu toplulaştırması ve artifact yönlendirmesi kullanılır; yorum, coverage ve önemli karşı bulgu kesilmez.

### 8.5 Kısa özet kalite kapısı

Yoğun sonuç özeti en az şunları kapsar:

1. Kullanıcının sorusuna tek cümlelik doğrudan cevap.
2. En maddi gerçekleşmiş bulgu ve uygun kıyas.
3. En önemli katkı veya risk.
4. Coverage/belirsizlik varsa kısa uyarı.
5. Uygulanabilir yorum/öneri veya neden öneri verilemediği.
6. Tam detayın hangi görsel, PDF, Excel veya drill-down çıktısında bulunduğu.

Özet, bütün KPI'ları sırayla tekrarlamaz; önem sırasına göre seçer. Ancak ters yöndeki önemli bir bulguyu anlatıyı sadeleştirmek adına saklayamaz.
